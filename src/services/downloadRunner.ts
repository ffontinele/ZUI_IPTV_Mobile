// downloadRunner — wrapper do useDownloadAndCopy original (Filesystem.downloadFile nativo)
import { useDownloadsStore } from '@/state/downloadsStore';
import type { DownloadItem } from '@/state/downloadsStore';
import { useDownloadAndCopy } from '@/hooks/useDownloadAndCopy';

const vib = (ms = 30) => { try { (navigator as any).vibrate?.(ms); } catch {} };
const running = new Set<string>();

export function isRunning(id: string) { return running.has(id); }

export async function resolvePath(fileName: string): Promise<string> {
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const r = await Filesystem.getUri({ path: fileName, directory: Directory.Documents });
    return decodeURIComponent(r.uri);
  } catch { return ''; }
}

export function startDownload(item: DownloadItem) {
  vib();
  if (running.has(item.id)) return;
  running.add(item.id);
  const st = useDownloadsStore.getState();
  st.items.filter((i) => i.url === item.url && i.id !== item.id).forEach((i) => st.remove(i.id));
  const existing = st.items.find((i) => i.id === item.id);
  if (existing?.status === 'done') st.remove(item.id);
  const name = (item.fileName || `${item.id}.mp4`).replace(/[^a-z0-9._-]+/gi, '_').slice(0, 120) || 'download.mp4';
  st.add({ ...item, fileName: name, status: 'downloading', progress: 0, bytesDone: 0, bytesTotal: undefined });

  // Usa o hook original que FUNCIONAVA
  const { download } = useDownloadAndCopy();
  download({
    id: item.id,
    kind: item.kind,
    title: item.title,
    subtitle: item.subtitle,
    url: item.url,
    fileName: name,
  }).finally(() => { running.delete(item.id); });
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
  startDownload(item);
}

export function cancelDownload(id: string) {
  running.delete(id);
  useDownloadsStore.getState().remove(id);
  vib();
}
