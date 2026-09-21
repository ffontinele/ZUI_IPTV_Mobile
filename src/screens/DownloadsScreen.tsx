// DownloadsScreen — lista de downloads com progresso e remocao
import { useEffect } from 'react';
import { useDownloadsStore } from '@/state/downloadsStore';

const STATUS_LABEL: Record<string, string> = {
  queued: 'Na fila',
  downloading: 'Baixando',
  done: 'Concluído',
  error: 'Erro',
};

export function DownloadsScreen() {
  const items = useDownloadsStore((s) => s.items);
  const remove = useDownloadsStore((s) => s.remove);

  useEffect(() => {
    useDownloadsStore.getState().hydrate();
  }, []);

  return (
    <div className="flex flex-col h-full bg-bg-base">
      <div className="sticky top-0 z-10 bg-bg-elevated border-b border-border-subtle p-4">
        <h1 className="text-lg font-bold text-white">Downloads</h1>
        <p className="text-xs text-text-secondary mt-0.5">{items.length} item(ns)</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-text-muted text-sm">
            <span className="text-3xl">⬇️</span>
            Nenhum download ainda
          </div>
        )}
        {items.map((it) => (
          <div key={it.id} className="px-4 py-3 border-b border-border-subtle/40">
            <div className="flex items-start gap-3">
              <span className="text-xl">{it.kind === 'movie' ? '🎬' : '📼'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate">{it.title}</p>
                {it.subtitle && <p className="text-xs text-text-secondary truncate">{it.subtitle}</p>}
                <div className="mt-2 h-1.5 rounded-full bg-bg-hover overflow-hidden">
                  <div
                    className={`h-full rounded-full ${it.status === 'error' ? 'bg-red-400' : it.status === 'done' ? 'bg-emerald-400' : 'bg-primary'}`}
                    style={{ width: `${Math.min(100, it.progress) }%` }}
                  />
                </div>
                <p className="text-[11px] text-text-muted mt-1">
                  {STATUS_LABEL[it.status] ?? it.status} · {Math.round(it.progress)}%
                </p>
              </div>
              <button onClick={() => remove(it.id)} className="px-2 py-1 text-base">🗑</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
