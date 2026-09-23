// downloadRunner v3 — download em pedacos de 6MB (memoria segura), 1 clique = 1 download
import { Filesystem, Directory } from '@capacitor/filesystem';
import { useDownloadsStore } from '@/state/downloadsStore';
import type { DownloadItem } from '@/state/downloadsStore';

const CHUNK = 6 * 1024 * 1024;
const controllers = new Map<string, { xhr: XMLHttpRequest | null; alive: boolean }>();
const vib = (ms = 30) => { try { (navigator as any).vibrate?.(ms); } catch { /* ignore */ } };
let lastStore = 0;

// Sessao anterior interrompida: downloading -> queued
{
  const st = useDownloadsStore.getState();
  st.items.filter((i) => i.status === 'downloading').forEach((i) => st.update(i.id, { status: 'queued' }));
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

export function isRunning(id: string) { return controllers.get(id)?.alive === true; }

function chunk(url: string, from: number, to: number, holder: { xhr: XMLHttpRequest | null; alive: boolean }) {
  return new Promise<{ status: number; data: ArrayBuffer; total: number }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    holder.xhr = xhr;
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.setRequestHeader('Range', `bytes=${from}-${to}`);
    xhr.onload = () => {
      let total = 0;
      const cr = xhr.getResponseHeader?.('Content-Range');
      if (cr) { const m = cr.match(/\/(\d+)$/); if (m) total = Number(m[1]); }
      if (!total) total = Number(xhr.getResponseHeader?.('Content-Length') ?? 0) || 0;
      resolve({ status: xhr.status, data: (xhr.response as ArrayBuffer) ?? new ArrayBuffer(0), total });
    };
    xhr.onerror = () => reject(new Error('Falha de rede'));
    xhr.onabort = () => reject(new Error('pause'));
    xhr.send();
  });
}

async function runLoop(id: string, url: string, fileName: string, startOffset: number) {
  const holder = { xhr: null as XMLHttpRequest | null, alive: true };
  controllers.set(id, holder);
  let offset = startOffset;
  let total = 0;
  try {
    while (holder.alive) {
      const res = await chunk(url, offset, offset + CHUNK - 1, holder);
      if (res.status === 416 || res.data.byteLength === 0) break;
      const b64 = abToB64(res.data);
      if (offset === 0) {
        await Filesystem.writeFile({ path: fileName, data: b64, directory: Directory.Documents, recursive: true });
      } else {
        await Filesystem.appendFile({ path: fileName, data: b64, directory: Directory.Documents });
      }
      if (res.total) total = res.total;
      if (res.status === 200) { offset = res.data.byteLength; total = total || offset; break; }
      offset += res.data.byteLength;
      if (total && offset >= total) break;
      const now = Date.now();
      if (now - lastStore > 500) {
        lastStore = now;
        useDownloadsStore.getState().update(id, {
          status: 'downloading',
          bytesDone: offset,
          bytesTotal: total || undefined,
          progress: total ? Math.min(99, (offset / total) * 100) : -1,
        });
      }
    }
    if (!holder.alive) return;
    const uri = (await Filesystem.getUri({ path: fileName, directory: Directory.Documents })).uri;
    useDownloadsStore.getState().update(id, { status: 'done', progress: 100, bytesDone: offset, bytesTotal: total || offset, filePath: uri });
    vib(80);
  } catch (err) {
    if (!holder.alive) return;
    useDownloadsStore.getState().update(id, { status: 'error', error: String((err as any)?.message ?? err) });
    vib(60);
  } finally {
    controllers.delete(id);
  }
}

export function startDownload(item: DownloadItem) {
  vib();
  if (isRunning(item.id)) return; // cliques repetidos ignorados
  const st = useDownloadsStore.getState();
  st.items.filter((i) => i.url === item.url && i.id !== item.id).forEach((i) => st.remove(i.id));
  const existing = st.items.find((i) => i.id === item.id);
  const from = !existing || existing.status === 'error' || existing.status === 'done' ? 0 : (existing.bytesDone ?? 0);
  const safeName = (item.fileName || `${item.id}.mp4`).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 120);
  st.add({ ...item, fileName: safeName, status: 'downloading', progress: 0, bytesDone: from, bytesTotal: undefined });
  void runSafe(item.id, item.url, safeName, from);
}

// Sonda 1 byte: servidor suporta Range? Se sim, blocos; se nao, download direto
async function runSafe(id: string, url: string, fileName: string, from: number) {
  const holder = { xhr: null as XMLHttpRequest | null, alive: true };
  controllers.set(id, holder);
  try {
    const probe = await chunk(url, 0, 0, holder);
    if (!holder.alive) return;
    if (probe.status === 206) {
      controllers.delete(id);
      await runLoop(id, url, fileName, from);
    } else {
      // Sem Range: baixa inteiro em blob e grava de uma vez
      const data = await new Promise<ArrayBuffer>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        holder.xhr = xhr;
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = () => resolve((xhr.response as ArrayBuffer) ?? new ArrayBuffer(0));
        xhr.onerror = () => reject(new Error('Falha de rede'));
        xhr.onabort = () => reject(new Error('pause'));
        xhr.send();
      });
      if (!holder.alive) return;
      const b64 = abToB64(data);
      await Filesystem.writeFile({ path: fileName, data: b64, directory: Directory.Documents, recursive: true });
      const uri = (await Filesystem.getUri({ path: fileName, directory: Directory.Documents })).uri;
      useDownloadsStore.getState().update(id, { status: 'done', progress: 100, bytesDone: data.byteLength, bytesTotal: data.byteLength, filePath: uri });
      controllers.delete(id);
      vib(80);
    }
  } catch (err) {
    controllers.delete(id);
    useDownloadsStore.getState().update(id, { status: 'error', error: String((err as any)?.message ?? err) });
    vib(60);
  }
}

export function pauseDownload(id: string) {
  const c = controllers.get(id);
  if (c) { c.alive = false; c.xhr?.abort(); controllers.delete(id); }
  useDownloadsStore.getState().update(id, { status: 'queued' });
  vib();
}

export function resumeDownload(id: string) {
  if (isRunning(id)) return;
  const item = useDownloadsStore.getState().items.find((i) => i.id === id);
  if (!item) return;
  useDownloadsStore.getState().update(id, { status: 'downloading' });
  vib();
  void runLoop(id, item.url, item.fileName, item.bytesDone ?? 0);
}

export function cancelDownload(id: string) {
  const c = controllers.get(id);
  if (c) { c.alive = false; c.xhr?.abort(); controllers.delete(id); }
  useDownloadsStore.getState().remove(id);
  vib();
}
