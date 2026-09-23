// downloadRunner v4 — fluxo UNICO simples, sem estado preso, caminho real
import { Filesystem, Directory } from '@capacitor/filesystem';
import { useDownloadsStore } from '@/state/downloadsStore';
import type { DownloadItem } from '@/state/downloadsStore';

const vib = (ms = 30) => { try { (navigator as any).vibrate?.(ms); } catch { /* ignore */ } };
const running = new Set<string>();

function safeName(name: string): string {
  return (name || 'download.mp4').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || 'download.mp4';
}

export function isRunning(id: string) { return running.has(id); }

export async function resolvePath(fileName: string): Promise<string> {
  try {
    const r = await Filesystem.getUri({ path: fileName, directory: Directory.Documents });
    // getUri retorna file:///storage/emulated/0/Android/data/<pkg>/files/Documents/<file>
    return decodeURIComponent(r.uri);
  } catch {
    return '';
  }
}

async function run(id: string, url: string, fileName: string) {
  running.add(id);
  try {
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`Servidor respondeu ${res.status}`);
    const total = Number(res.headers.get('Content-Length') || 0) || 0;
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    let lastStore = 0;
    while (true) {
      if (!running.has(id)) throw new Error('cancelado');
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      const now = Date.now();
      if (now - lastStore > 400) {
        lastStore = now;
        useDownloadsStore.getState().update(id, {
          status: 'downloading',
          bytesDone: received,
          bytesTotal: total || undefined,
          progress: total ? Math.min(99, (received / total) * 100) : -1,
        });
      }
    }
    // Junta e grava uma unica vez (episodios cabem; evita append complexo)
    const all = new Uint8Array(received);
    let off = 0;
    for (const c of chunks) { all.set(c, off); off += c.length; }
    let bin = '';
    const CH = 0x8000;
    for (let i = 0; i < all.length; i += CH) bin += String.fromCharCode.apply(null, Array.from(all.subarray(i, i + CH)) as any);
    const b64 = btoa(bin);
    await Filesystem.writeFile({ path: fileName, data: b64, directory: Directory.Documents, recursive: true });
    const uri = (await Filesystem.getUri({ path: fileName, directory: Directory.Documents })).uri;
    useDownloadsStore.getState().update(id, { status: 'done', progress: 100, bytesDone: received, bytesTotal: total || received, filePath: decodeURIComponent(uri) });
    vib(80);
  } catch (err) {
    useDownloadsStore.getState().update(id, { status: 'error', error: String((err as any)?.message ?? err) });
    vib(60);
  } finally {
    running.delete(id);
  }
}

export function startDownload(item: DownloadItem) {
  vib();
  if (running.has(item.id)) return; // ignora cliques repetidos
  const st = useDownloadsStore.getState();
  st.items.filter((i) => i.url === item.url && i.id !== item.id).forEach((i) => st.remove(i.id));
  const existing = st.items.find((i) => i.id === item.id);
  if (existing?.status === 'done') { st.remove(item.id); } // permite re-baixar
  const name = safeName(item.fileName || `${item.id}.mp4`);
  st.add({ ...item, fileName: name, status: 'downloading', progress: 0, bytesDone: 0, bytesTotal: undefined });
  void run(item.id, item.url, name);
}

export function pauseDownload(id: string) { running.delete(id); useDownloadsStore.getState().update(id, { status: 'queued' }); vib(); }
export function resumeDownload(id: string) {
  if (running.has(id)) return;
  const item = useDownloadsStore.getState().items.find((i) => i.id === id);
  if (!item) return;
  useDownloadsStore.getState().update(id, { status: 'downloading' });
  vib();
  void run(id, item.url, item.fileName);
}
export function cancelDownload(id: string) { running.delete(id); useDownloadsStore.getState().remove(id); vib(); }
