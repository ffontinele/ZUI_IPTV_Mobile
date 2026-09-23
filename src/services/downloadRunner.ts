// downloadRunner — com RESUME real via Range request + append
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { useDownloadsStore } from '@/state/downloadsStore';
import type { DownloadItem } from '@/state/downloadsStore';
import { useToast } from '@/components/ui/Toast';

const vib = (ms = 30) => { try { (navigator as any).vibrate?.(ms); } catch {} };
const running = new Set<string>();
let lastProg = 0;

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

// Tamanho atual do arquivo parcial (0 se nao existe)
async function partialSize(fileName: string): Promise<number> {
  try {
    const st = await Filesystem.stat({ path: fileName, directory: Directory.Documents });
    return st.size ?? 0;
  } catch { return 0; }
}

// Download inicial (do zero) — Filesystem.downloadFile nativo (rapido)
async function runFresh(id: string, url: string, name: string) {
  const showToast = useToast.getState().show;
  let listener: any = null;
  try {
    listener = await (Filesystem as any).addListener('progress', (data: any) => {
      if (data && data.contentLength > 0 && (!data.url || data.url === url)) {
        const now = Date.now();
        if (now - lastProg < 500) return;
        lastProg = now;
        const progress = Math.min(99, Math.round((data.bytes / data.contentLength) * 100));
        useDownloadsStore.getState().update(id, {
          progress, status: 'downloading',
          bytesDone: data.bytes, bytesTotal: data.contentLength,
        });
      }
    });
    const res = await Filesystem.downloadFile({
      url, path: name, directory: Directory.Documents, recursive: true, progress: true,
    });
    if (listener) await listener.remove();
    useDownloadsStore.getState().update(id, {
      progress: 100, status: 'done', filePath: res.path,
      bytesDone: undefined, bytesTotal: undefined,
    });
    showToast('✅ Download concluído');
    vib(80);
  } catch (err) {
    if (listener) await listener.remove();
    const msg = String((err as Error)?.message || err);
    useDownloadsStore.getState().update(id, { status: 'error', error: msg });
    showToast('❌ Falha: ' + msg);
    vib(60);
  }
}

// Resume (retoma de onde parou) — Range request + append chunks
async function runResume(id: string, url: string, name: string, fromBytes: number) {
  const showToast = useToast.getState().show;
  const CHUNK = 4 * 1024 * 1024; // 4 MB por append
  let offset = fromBytes;
  showToast(`↻ Retomando de ${(fromBytes / 1048576).toFixed(0)} MB...`);
  try {
    // Primeiro: descobre tamanho total
    const headRes = await new Promise<{ total: number; supportsRange: boolean }>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('HEAD', url, true);
      xhr.onload = () => {
        const cl = Number(xhr.getResponseHeader('Content-Length') || 0) || 0;
        const ar = xhr.getResponseHeader('Accept-Ranges') || '';
        resolve({ total: cl, supportsRange: ar.toLowerCase() === 'bytes' || cl > 0 });
      };
      xhr.onerror = () => resolve({ total: 0, supportsRange: false });
      xhr.send();
    });
    if (headRes.total && offset >= headRes.total) {
      // ja tinha terminado
      useDownloadsStore.getState().update(id, { progress: 100, status: 'done', bytesDone: headRes.total, bytesTotal: headRes.total });
      showToast('✅ Já estava concluído');
      vib(80);
      return;
    }
    // Baixa em chunks de 4MB via Range e faz append
    let last = Date.now();
    while (running.has(id)) {
      const to = headRes.total ? Math.min(offset + CHUNK - 1, headRes.total - 1) : offset + CHUNK - 1;
      const chunk = await new Promise<ArrayBuffer>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';
        xhr.setRequestHeader('Range', `bytes=${offset}-${to}`);
        xhr.onload = () => resolve((xhr.response as ArrayBuffer) ?? new ArrayBuffer(0));
        xhr.onerror = () => reject(new Error('Falha de rede'));
        xhr.send();
      });
      if (!running.has(id)) return;
      const b64 = abToB64(chunk);
      await Filesystem.appendFile({ path: name, data: b64, directory: Directory.Documents });
      offset += chunk.byteLength;
      const now = Date.now();
      if (now - last > 400) {
        last = now;
        const total = headRes.total || 0;
        useDownloadsStore.getState().update(id, {
          status: 'downloading', bytesDone: offset, bytesTotal: total || undefined,
          progress: total ? Math.min(99, (offset / total) * 100) : -1,
        });
      }
      if (chunk.byteLength < CHUNK || (headRes.total && offset >= headRes.total)) break;
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
  running.delete(id);
  useDownloadsStore.getState().update(id, { status: 'queued' });
  vib();
}

export async function cancelDownload(id: string) {
  running.delete(id);
  const item = useDownloadsStore.getState().items.find((i) => i.id === id);
  if (item?.fileName && (item.status === 'done' || item.status === 'error' || item.status === 'queued')) {
    try {
      await Filesystem.deleteFile({ path: item.fileName, directory: Directory.Documents });
    } catch { /* arquivo ja nao existe */ }
  }
  useDownloadsStore.getState().remove(id);
  vib();
}
