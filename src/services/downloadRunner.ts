// downloadRunner v9 — SIMPLES: downloadFile nativo + polling progresso (sem resume complexo)
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { useDownloadsStore } from '@/state/downloadsStore';
import type { DownloadItem } from '@/state/downloadsStore';
import { useToast } from '@/components/ui/Toast';

const vib = (ms = 30) => { try { (navigator as any).vibrate?.(ms); } catch {} };
const running = new Set<string>();
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

async function partialSize(fileName: string): Promise<number> {
  try {
    const st = await Filesystem.stat({ path: fileName, directory: Directory.Documents });
    return st.size ?? 0;
  } catch { return 0; }
}

// Polling de progresso a cada 2s (funciona pra filme E serie)
function startPolling(id: string, fileName: string) {
  stopPolling(id);
  const interval = window.setInterval(async () => {
    if (!running.has(id)) { stopPolling(id); return; }
    const size = await partialSize(fileName);
    if (size > 0) {
      useDownloadsStore.getState().update(id, {
        status: 'downloading', bytesDone: size, progress: -1, // -1 = indeterminate
      });
    }
  }, 2000);
  pollers.set(id, interval);
}

function stopPolling(id: string) {
  const int = pollers.get(id);
  if (int) { clearInterval(int); pollers.delete(id); }
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
  
  startPolling(item.id, name);
  try {
    const res = await Filesystem.downloadFile({
      url: item.url, path: name, directory: Directory.Documents, recursive: true, progress: true,
    });
    stopPolling(item.id);
    useDownloadsStore.getState().update(item.id, {
      progress: 100, status: 'done', filePath: res.path,
      bytesDone: undefined, bytesTotal: undefined,
    });
    useToast.getState().show('✅ Download concluído');
    vib(80);
  } catch (err) {
    stopPolling(item.id);
    const msg = String((err as Error)?.message || err);
    useDownloadsStore.getState().update(item.id, { status: 'error', error: msg });
    useToast.getState().show('❌ Falha: ' + msg);
    vib(60);
  } finally {
    running.delete(item.id);
  }
}

// Resume SIMPLIFICADO: so reinicia (sem XHR/append complexo)
export async function resumeDownload(id: string) {
  const item = useDownloadsStore.getState().items.find((i) => i.id === id);
  if (!item) return;
  vib();
  useToast.getState().show('↻ Reiniciando download...');
  await startDownload(item);
}

export function pauseDownload(id: string) {
  running.delete(id);
  stopPolling(id);
  useDownloadsStore.getState().update(id, { status: 'queued' });
  vib();
}

export async function cancelDownload(id: string) {
  running.delete(id);
  stopPolling(id);
  const item = useDownloadsStore.getState().items.find((i) => i.id === id);
  if (item?.fileName) {
    try {
      await Filesystem.deleteFile({ path: item.fileName, directory: Directory.Documents });
    } catch { /* ja nao existe */ }
  }
  useDownloadsStore.getState().remove(id);
  vib();
}
