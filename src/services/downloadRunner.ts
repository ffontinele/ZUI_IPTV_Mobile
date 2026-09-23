// downloadRunner v2 — sem notificacao externa, resposta robusta, retentativa limpa
import { Filesystem, Directory } from '@capacitor/filesystem';
import { useDownloadsStore } from '@/state/downloadsStore';
import type { DownloadItem } from '@/state/downloadsStore';

const xhrs = new Map<string, XMLHttpRequest>();
const vib = (ms = 30) => { try { (navigator as any).vibrate?.(ms); } catch { /* ignore */ } };

// Interrupcoes de sessao anterior: downloading -> queued (retomavel)
{
  const st = useDownloadsStore.getState();
  st.items.filter((i) => i.status === 'downloading').forEach((i) => st.update(i.id, { status: 'queued' }));
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(',')[1]);
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });
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

export function isRunning(id: string) { return xhrs.has(id); }

function run(id: string, url: string, from: number, fileName: string) {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.responseType = 'arraybuffer';
  if (from > 0) xhr.setRequestHeader('Range', `bytes=${from}-`);
  xhr.onprogress = (e) => {
    const done = from + e.loaded;
    const cl = Number(xhr.getResponseHeader?.('Content-Length') ?? 0) || 0;
    const total = e.lengthComputable ? from + e.total : (cl ? from + cl : 0);
    useDownloadsStore.getState().update(id, {
      status: 'downloading',
      bytesDone: done,
      bytesTotal: total || undefined,
      progress: total ? Math.min(99, (done / total) * 100) : -1,
    });
  };
  xhr.onload = async () => {
    xhrs.delete(id);
    try {
      const resp: any = xhr.response;
      let b64: string;
      if (resp instanceof ArrayBuffer && resp.byteLength > 0) b64 = abToB64(resp);
      else if (resp instanceof Blob && resp.size > 0) b64 = await blobToBase64(resp);
      else if (typeof resp === 'string' && resp.length > 0) b64 = resp.includes(',') ? resp.split(',')[1] : resp;
      else throw new Error('Resposta vazia do servidor');
      const serverIgnoredRange = from > 0 && xhr.status === 200;
      if (from > 0 && !serverIgnoredRange) {
        await Filesystem.appendFile({ path: fileName, data: b64, directory: Directory.Documents });
      } else {
        await Filesystem.writeFile({ path: fileName, data: b64, directory: Directory.Documents, recursive: true });
      }
      const uri = (await Filesystem.getUri({ path: fileName, directory: Directory.Documents })).uri;
      useDownloadsStore.getState().update(id, { status: 'done', progress: 100, filePath: uri });
      vib(80);
    } catch (err) {
      useDownloadsStore.getState().update(id, { status: 'error', error: String(err) });
      vib(60);
    }
  };
  xhr.onerror = () => { xhrs.delete(id); useDownloadsStore.getState().update(id, { status: 'error', error: 'Falha de rede' }); };
  xhr.onabort = () => { xhrs.delete(id); };
  xhrs.set(id, xhr);
  xhr.send();
}

export function startDownload(item: DownloadItem) {
  const st = useDownloadsStore.getState();
  st.items.filter((i) => i.url === item.url && i.id !== item.id).forEach((i) => st.remove(i.id));
  const existing = st.items.find((i) => i.id === item.id);
  const from = !existing || existing.status === 'error' || existing.status === 'done' ? 0 : (existing.bytesDone ?? 0);
  st.add({ ...item, status: 'downloading', progress: 0, bytesDone: from, bytesTotal: undefined, error: undefined });
  vib();
  run(item.id, item.url, from, item.fileName);
}

export function pauseDownload(id: string) {
  const x = xhrs.get(id);
  if (x) { x.abort(); xhrs.delete(id); }
  useDownloadsStore.getState().update(id, { status: 'queued' });
  vib();
}

export function resumeDownload(id: string) {
  const item = useDownloadsStore.getState().items.find((i) => i.id === id);
  if (!item) return;
  useDownloadsStore.getState().update(id, { status: 'downloading', error: undefined });
  vib();
  run(id, item.url, item.bytesDone ?? 0, item.fileName);
}

export function cancelDownload(id: string) {
  const x = xhrs.get(id);
  if (x) { x.abort(); xhrs.delete(id); }
  useDownloadsStore.getState().remove(id);
  vib();
}
