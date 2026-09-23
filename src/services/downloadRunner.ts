// downloadRunner v5 — XHR puro (sem fetch/CapacitorHttp), sem estado preso
import { Filesystem, Directory } from '@capacitor/filesystem';
import { useDownloadsStore } from '@/state/downloadsStore';
import type { DownloadItem } from '@/state/downloadsStore';

const vib = (ms = 30) => { try { (navigator as any).vibrate?.(ms); } catch {} };
const running = new Set<string>();

function safeName(name: string): string {
  return (name || 'download.mp4').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || 'download.mp4';
}

export function isRunning(id: string) { return running.has(id); }

export async function resolvePath(fileName: string): Promise<string> {
  try {
    const r = await Filesystem.getUri({ path: fileName, directory: Directory.Documents });
    return decodeURIComponent(r.uri);
  } catch { return ''; }
}

function downloadXHR(url: string, onProgress: (loaded: number, total: number) => void, aliveCheck: () => boolean): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onprogress = (e) => { if (aliveCheck()) onProgress(e.loaded, e.lengthComputable ? e.total : 0); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve((xhr.response as ArrayBuffer) ?? new ArrayBuffer(0));
      } else {
        reject(new Error(`Servidor respondeu ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Falha de rede'));
    xhr.onabort = () => reject(new Error('Cancelado'));
    xhr.send();
    // Permite cancelamento externo
    const check = setInterval(() => { if (!aliveCheck()) { xhr.abort(); clearInterval(check); } }, 500);
    xhr.onloadend = () => clearInterval(check);
  });
}

async function run(id: string, url: string, fileName: string) {
  running.add(id);
  try {
    const data = await downloadXHR(
      url,
      (loaded, total) => {
        const now = Date.now();
        useDownloadsStore.getState().update(id, {
          status: 'downloading',
          bytesDone: loaded,
          bytesTotal: total || undefined,
          progress: total ? Math.min(99, (loaded / total) * 100) : -1,
        });
      },
      () => running.has(id)
    );
    if (!running.has(id)) return;
    // Converte pra base64 em blocos (memoria segura)
    const bytes = new Uint8Array(data);
    let bin = '';
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) {
      bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CH)) as any);
    }
    const b64 = btoa(bin);
    await Filesystem.writeFile({ path: fileName, data: b64, directory: Directory.Documents, recursive: true });
    const uri = (await Filesystem.getUri({ path: fileName, directory: Directory.Documents })).uri;
    useDownloadsStore.getState().update(id, {
      status: 'done', progress: 100,
      bytesDone: data.byteLength, bytesTotal: data.byteLength,
      filePath: decodeURIComponent(uri),
    });
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
  if (running.has(item.id)) return;
  const st = useDownloadsStore.getState();
  st.items.filter((i) => i.url === item.url && i.id !== item.id).forEach((i) => st.remove(i.id));
  const existing = st.items.find((i) => i.id === item.id);
  if (existing?.status === 'done') st.remove(item.id);
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
