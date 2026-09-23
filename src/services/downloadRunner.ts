// downloadRunner v8 — hibrido: downloadFile rapido + XHR fallback + polling progresso
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { useDownloadsStore } from '@/state/downloadsStore';
import type { DownloadItem } from '@/state/downloadsStore';
import { useToast } from '@/components/ui/Toast';

const vib = (ms = 30) => { try { (navigator as any).vibrate?.(ms); } catch {} };
const running = new Set<string>();
const paused = new Set<string>();
const pollers = new Map<string, number>();

function safeName(s: string): string {
  return s.replace(/[^a-z0-9._-]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase().slice(0, 120) || 'download.mp4';
}

export function isRunning(id: string) { return running.has(id); }

export async function resolvePath(fileName: string): Promise<string> {
  try {
    const r = await Filesystem.getUri({ path: fileName, directory: Directory.Documents });
    return decodeURIComponent(r.uri);
  } catch { return ''; }
}

function abToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CH)) as any);
  }
  return btoa(bin);
}

async function partialSize(fileName: string): Promise<number> {
  try {
    const st = await Filesystem.stat({ path: fileName, directory: Directory.Documents });
    return st.size ?? 0;
  } catch { return 0; }
}

// Polling de progresso (fallback quando listener nao dispara)
function startPolling(id: string, fileName: string, totalHint?: number) {
  stopPolling(id);
  const interval = window.setInterval(async () => {
    if (!running.has(id) || paused.has(id)) { stopPolling(id); return; }
    const size = await partialSize(fileName);
    if (size > 0) {
      const total = totalHint || 0;
      const progress = total ? Math.min(99, (size / total) * 100) : -1;
      useDownloadsStore.getState().update(id, {
        status: 'downloading', bytesDone: size, bytesTotal: total || undefined, progress,
      });
    }
  }, 2000);
  pollers.set(id, interval);
}

function stopPolling(id: string) {
  const int = pollers.get(id);
  if (int) { clearInterval(int); pollers.delete(id); }
}

// Download fresco via API nativa (rapido)
async function runFresh(id: string, url: string, name: string) {
  const showToast = useToast.getState().show;
  startPolling(id, name);
  try {
    const res = await Filesystem.downloadFile({
      url, path: name, directory: Directory.Documents, recursive: true, progress: true,
    });
    stopPolling(id);
    if (paused.has(id)) {
      useDownloadsStore.getState().update(id, { status: 'queued' });
      return;
    }
    useDownloadsStore.getState().update(id, {
      progress: 100, status: 'done', filePath: res.path,
      bytesDone: undefined, bytesTotal: undefined,
    });
    showToast('✅ Download concluído');
    vib(80);
  } catch (err) {
    stopPolling(id);
    if (paused.has(id)) {
      useDownloadsStore.getState().update(id, { status: 'queued' });
      return;
    }
    const msg = String((err as Error)?.message || err);
    useDownloadsStore.getState().update(id, { status: 'error', error: msg });
    showToast('❌ Falha: ' + msg);
    vib(60);
  }
}

// Resume via XHR puro (sem CapacitorHttp) + append chunks
async function runResume(id: string, url: string, name: string, fromBytes: number) {
  const showToast = useToast.getState().show;
  const CHUNK = 4 * 1024 * 1024;
  let offset = fromBytes;
  showToast(`↻ Retomando de ${(fromBytes / 1048576).toFixed(0)} MB...`);
  startPolling(id, name);
  try {
    const headRes = await new Promise<{ total: number }>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('HEAD', url, true);
      xhr.onload = () => {
        const cl = Number(xhr.getResponseHeader('Content-Length') || 0) || 0;
        resolve({ total: cl });
      };
      xhr.onerror = () => resolve({ total: 0 });
      xhr.send();
    });
    if (headRes.total && offset >= headRes.total) {
      stopPolling(id);
      useDownloadsStore.getState().update(id, { progress: 100, status: 'done', bytesDone: headRes.total, bytesTotal: headRes.total });
      showToast('✅ Já estava concluído');
      vib(80);
      return;
    }
    while (running.has(id) && !paused.has(id)) {
      const to = headRes.total ? Math.min(offset + CHUNK - 1, headRes.total - 1) : offset + CHUNK - 1;
      const chunk = await new Promise<ArrayBuffer>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';
        xhr.setRequestHeader('Range', `bytes=${offset}-${to}`);
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve((xhr.response as ArrayBuffer) ?? new ArrayBuffer(0));
          } else {
            reject(new Error(`HTTP ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('Falha de rede'));
        xhr.send();
      });
      if (paused.has(id) || !running.has(id)) { stopPolling(id); return; }
      const b64 = abToB64(chunk);
      await Filesystem.appendFile({ path: name, data: b64, directory: Directory.Documents });
      offset += chunk.byteLength;
      if (chunk.byteLength < CHUNK || (headRes.total && offset >= headRes.total)) break;
    }
    stopPolling(id);
    if (paused.has(id)) {
      useDownloadsStore.getState().update(id, { status: 'queued', bytesDone: offset });
      return;
    }
    if (!running.has(id)) return;
    const uri = (await Filesystem.getUri({ path: name, directory: Directory.Documents })).uri;
    useDownloadsStore.getState().update(id, {
      progress: 100, status: 'done', filePath: decodeURIComponent(uri),
      bytesDone: offset, bytesTotal: headRes.total || offset,
    });
    showToast('✅ Download concluído (retomado)');
    vib(80);
  } catch (err) {
    stopPolling(id);
    if (paused.has(id)) {
      useDownloadsStore.getState().update(id, { status: 'queued', bytesDone: offset });
      return;
    }
    const msg = String((err as Error)?.message || err);
    useDownloadsStore.getState().update(id, { status: 'error', error: 'Retomada: ' + msg });
    showToast('❌ Retomada falhou: ' + msg);
    vib(60);
  }
}

export async function startDownload(item: DownloadItem) {
  vib();
  if (running.has(item.id)) return;
  running.add(item.id);
  paused.delete(item.id);
  const st = useDownloadsStore.getState();
  st.items.filter((i) => i.url === item.url && i.id !== item.id).forEach((i) => st.remove(i.id));
  const name = safeName(item.fileName || `${item.id}.mp4`);
  st.add({ ...item, fileName: name, status: 'downloading', progress: 0, bytesDone: 0, bytesTotal: undefined });
  useToast.getState().show('⬇ Iniciando download...');
  if (!Capacitor.isNativePlatform()) {
    st.update(item.id, { status: 'error', error: 'Android apenas' });
    running.delete(item.id); return;
  }
  try { await runFresh(item.id, item.url, name); }
  finally { running.delete(item.id); }
}

export async function resumeDownload(id: string) {
  if (running.has(id)) return;
  const item = useDownloadsStore.getState().items.find((i) => i.id === id);
  if (!item) return;
  vib();
  running.add(id);
  paused.delete(id);
  const st = useDownloadsStore.getState();
  st.update(id, { status: 'downloading', error: undefined });
  const from = await partialSize(item.fileName);
  if (!Capacitor.isNativePlatform()) {
    st.update(id, { status: 'error', error: 'Android apenas' });
    running.delete(id); return;
  }
  try {
    if (from > 0) {
      await runResume(id, item.url, item.fileName, from);
    } else {
      await runFresh(id, item.url, item.fileName);
    }
  } finally { running.delete(id); }
}

export function pauseDownload(id: string) {
  paused.add(id);
  running.delete(id);
  stopPolling(id);
  useDownloadsStore.getState().update(id, { status: 'queued' });
  vib();
}

export async function cancelDownload(id: string) {
  paused.add(id);
  running.delete(id);
  stopPolling(id);
  const item = useDownloadsStore.getState().items.find((i) => i.id === id);
  if (item?.fileName && (item.status === 'done' || item.status === 'error' || item.status === 'queued')) {
    try {
      await Filesystem.deleteFile({ path: item.fileName, directory: Directory.Documents });
    } catch { /* arquivo ja nao existe */ }
  }
  useDownloadsStore.getState().remove(id);
  vib();
}
