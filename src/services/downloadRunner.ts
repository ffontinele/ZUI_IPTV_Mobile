// downloadRunner v6 — logica do useDownloadAndCopy EXTRAIDA (sem hook, sem React error)
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { useDownloadsStore } from '@/state/downloadsStore';
import type { DownloadItem } from '@/state/downloadsStore';
import { useToast } from '@/components/ui/Toast';

const vib = (ms = 30) => { try { (navigator as any).vibrate?.(ms); } catch {} };
const running = new Set<string>();

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

export async function startDownload(item: DownloadItem) {
  vib();
  if (running.has(item.id)) return;
  running.add(item.id);
  const showToast = useToast.getState().show;
  const st = useDownloadsStore.getState();

  // Limpa duplicados
  st.items.filter((i) => i.url === item.url && i.id !== item.id).forEach((i) => st.remove(i.id));
  const existing = st.items.find((i) => i.id === item.id);
  if (existing?.status === 'done') st.remove(item.id);

  const name = safeName(item.fileName || `${item.id}.mp4`);
  st.add({ ...item, fileName: name, status: 'downloading', progress: 0, bytesDone: 0, bytesTotal: undefined });
  showToast(' Baixando: ' + item.title);

  if (!Capacitor.isNativePlatform()) {
    st.update(item.id, { status: 'error', error: 'Download disponível apenas no Android' });
    running.delete(item.id);
    return;
  }

  let listener: any = null;
  try {
    listener = await (Filesystem as any).addListener('progress', (data: any) => {
      if (data && data.contentLength > 0 && (!data.url || data.url === item.url)) {
        const progress = Math.min(99, Math.round((data.bytes / data.contentLength) * 100));
        useDownloadsStore.getState().update(item.id, {
          progress, status: 'downloading',
          bytesDone: data.bytes, bytesTotal: data.contentLength,
        });
      }
    });
  } catch { /* progresso opcional */ }

  try {
    const res = await Filesystem.downloadFile({
      url: item.url,
      path: name,
      directory: Directory.Documents,
      recursive: true,
      progress: true,
    });
    if (listener) await listener.remove();
    // res.path vem completo do bridge nativo
    useDownloadsStore.getState().update(item.id, {
      progress: 100, status: 'done',
      filePath: res.path,
      bytesDone: undefined, bytesTotal: undefined,
    });
    showToast('✅ Download concluído: ' + item.title);
    vib(80);
  } catch (err) {
    if (listener) await listener.remove();
    const msg = String((err as Error)?.message || err);
    useDownloadsStore.getState().update(item.id, { status: 'error', error: msg });
    showToast('❌ Falha no download: ' + msg);
    vib(60);
  } finally {
    running.delete(item.id);
  }
}

export function pauseDownload(id: string) {
  running.delete(id);
  useDownloadsStore.getState().update(id, { status: 'queued' });
  vib();
}

export function resumeDownload(id: string) {
  if (running.has(id)) return;
  const item = useDownloadsStore.getState().items.find((i) => i.id === id);
  if (!item) return;
  vib();
  void startDownload(item);
}

export function cancelDownload(id: string) {
  running.delete(id);
  useDownloadsStore.getState().remove(id);
  vib();
}
