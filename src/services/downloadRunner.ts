// downloadRunner — executor real de downloads: progresso, pausa/retomo (Range), arquivo no aparelho
import { Filesystem, Directory } from '@capacitor/filesystem';
import { LocalNotifications } from '@capacitor/local-notifications';
import { useDownloadsStore } from '@/state/downloadsStore';
import type { DownloadItem } from '@/state/downloadsStore';

const xhrs = new Map<string, XMLHttpRequest>();
let lastNotify = 0;

const vib = (ms = 30) => { try { (navigator as any).vibrate?.(ms); } catch { /* ignore */ } };

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(',')[1]);
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });
}

export function isRunning(id: string) { return xhrs.has(id); }

export async function notifyPermission() {
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display === 'prompt') await LocalNotifications.requestPermissions();
  } catch { /* ignore */ }
}

async function notify(title: string, body: string) {
  try {
    await LocalNotifications.cancel({ notifications: [{ id: 71 }] });
    await LocalNotifications.schedule({ notifications: [{ id: 71, title, body, silent: true }] });
  } catch { /* ignore */ }
}

function run(id: string, url: string, from: number, fileName: string) {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.responseType = 'blob';
  if (from > 0) xhr.setRequestHeader('Range', `bytes=${from}-`);
  xhr.onprogress = (e) => {
    const done = from + e.loaded;
    const total = e.lengthComputable ? from + e.total : 0;
    useDownloadsStore.getState().update(id, {
      status: 'downloading',
      bytesDone: done,
      bytesTotal: total || undefined,
      progress: total ? Math.min(99, (done / total) * 100) : 0,
    });
    const now = Date.now();
    if (now - lastNotify > 2000) {
      lastNotify = now;
      void notify('Baixando...', `${Math.round((done / (total || done)) * 100)}% · ${fileName}`);
    }
  };
  xhr.onload = async () => {
    xhrs.delete(id);
    try {
      const blob = xhr.response as Blob;
      const b64 = await blobToBase64(blob);
      const serverIgnoredRange = from > 0 && xhr.status === 200;
      if (from > 0 && !serverIgnoredRange) {
        await Filesystem.appendFile({ path: fileName, data: b64, directory: Directory.Documents });
      } else {
        await Filesystem.writeFile({ path: fileName, data: b64, directory: Directory.Documents, recursive: true });
      }
      const uri = (await Filesystem.getUri({ path: fileName, directory: Directory.Documents })).uri;
      useDownloadsStore.getState().update(id, { status: 'done', progress: 100, filePath: uri });
      vib(80);
      void notify('Download concluído', fileName);
    } catch (err) {
      useDownloadsStore.getState().update(id, { status: 'error', error: String(err) });
    }
  };
  xhr.onerror = () => { xhrs.delete(id); useDownloadsStore.getState().update(id, { status: 'error', error: 'Falha de rede' }); };
  xhr.onabort = () => { xhrs.delete(id); };
  xhrs.set(id, xhr);
  xhr.send();
}

export function startDownload(item: DownloadItem) {
  const st = useDownloadsStore.getState();
  // G: limpa duplicados/fantasma da mesma URL
  st.items.filter((i) => i.url === item.url && i.id !== item.id).forEach((i) => st.remove(i.id));
  const existing = st.items.find((i) => i.id === item.id);
  const from = existing?.status === 'done' ? 0 : (existing?.bytesDone ?? 0);
  st.add({ ...item, status: 'downloading', progress: 0, bytesDone: from, bytesTotal: existing?.bytesTotal });
  vib();
  void notifyPermission();
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
  useDownloadsStore.getState().update(id, { status: 'downloading' });
  vib();
  run(id, item.url, item.bytesDone ?? 0, item.fileName);
}

export function cancelDownload(id: string) {
  const x = xhrs.get(id);
  if (x) { x.abort(); xhrs.delete(id); }
  useDownloadsStore.getState().remove(id);
  vib();
}
