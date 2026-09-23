// DownloadProgressBar — overlay mobile compacto com minimizar/restaurar
import { useState } from 'react';
import { useDownloadsStore } from '@/state/downloadsStore';
import { pauseDownload, resumeDownload, cancelDownload, isRunning } from '@/services/downloadRunner';

function mb(b?: number) { return b ? `${(b / 1048576).toFixed(1)} MB` : '—'; }

export function DownloadProgressBar() {
  const items = useDownloadsStore((s) => s.items);
  const [min, setMin] = useState(false);
  const active = items.find((i) => i.status === 'downloading') ?? items.find((i) => i.status === 'queued' && isRunning(i.id));
  const item = active ?? items.find((i) => i.status === 'queued');
  if (!item) return null;
  const progress = item.progress ?? 0;

  if (min) {
    return (
      <button
        onClick={() => setMin(false)}
        className="fixed bottom-20 right-3 z-40 px-3.5 py-2 rounded-full bg-[#1a1208]/95 border border-[#E8B567]/40 text-[#E8B567] text-xs font-bold shadow-lg"
      >
        ⬇ {Math.round(progress)}%
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 right-3 z-40 w-[300px] max-w-[85vw] rounded-2xl bg-[#1a1208]/95 backdrop-blur border border-[#E8B567]/40 p-3 flex flex-col gap-2 shadow-[0_8px_24px_-8px_rgba(232,181,103,0.4)]">
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0 text-[#E8B567]" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11" /><path d="m6 11 6 6 6-6" /><path d="M5 20h14" /></svg>
        <p className="flex-1 min-w-0 text-[11px] text-text-primary truncate">{item.title}{item.subtitle ? ` · ${item.subtitle}` : ''}</p>
        <span className="text-[11px] font-bold text-[#E8B567] tabular-nums">{Math.round(progress)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full bg-[#E8B567] transition-all" style={{ width: progress + '%' }} />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="flex-1 text-[10px] text-text-muted tabular-nums">{mb(item.bytesDone)} / {mb(item.bytesTotal)}</span>
        {item.status === 'downloading' ? (
          <button onClick={() => pauseDownload(item.id)} className="px-2.5 py-1 rounded-full bg-white/10 text-[10px] font-semibold text-text-primary">⏸</button>
        ) : (
          <button onClick={() => resumeDownload(item.id)} className="px-2.5 py-1 rounded-full bg-[#E8B567] text-[10px] font-bold text-[#161006]">▶</button>
        )}
        <button onClick={() => cancelDownload(item.id)} className="px-2.5 py-1 rounded-full bg-red-500/15 text-[10px] font-semibold text-red-300">🗑</button>
        <button onClick={() => setMin(true)} className="px-2.5 py-1 rounded-full bg-white/10 text-[10px] font-semibold text-text-primary">—</button>
      </div>
    </div>
  );
}
