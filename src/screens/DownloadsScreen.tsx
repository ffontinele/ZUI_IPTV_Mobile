// DownloadsScreen — mobile: todas as acoes dentro de cada card
import { useEffect } from 'react';
import { useDownloadsStore } from '@/state/downloadsStore';
import { usePlayerStore } from '@/state/playerStore';
import { useUIStore } from '@/state/uiStore';
import { useToast } from '@/components/ui/Toast';
import { pauseDownload, resumeDownload, cancelDownload, resolvePath } from '@/services/downloadRunner';
import { Clipboard } from '@capacitor/clipboard';

const STATUS_LABEL: Record<string, string> = {
  queued: 'Na fila',
  downloading: 'Baixando',
  done: 'Concluído',
  error: 'Erro',
};

export function DownloadsScreen() {
  const items = useDownloadsStore((s) => s.items);
  const navigate = useUIStore((s) => s.navigate);
  const showToast = useToast((s) => s.show);

  useEffect(() => {
    useDownloadsStore.getState().hydrate();
  }, []);

  const watch = (it: any) => {
    if (it.status !== 'done' || !it.filePath) { showToast('Ainda não está pronto para assistir'); return; }
    const url = it.filePath.startsWith('file://') ? it.filePath : 'file://' + it.filePath;
    usePlayerStore.getState().setSource({ id: it.id, name: it.title, url });
    navigate('player');
  };

  const copy = async (it: any) => {
    if (it.status === 'done' && it.fileName) {
      const real = await resolvePath(it.fileName);
      try { await Clipboard.write({ string: real || it.filePath || '' }); showToast(real ? 'Caminho real copiado' : 'Arquivo não encontrado'); } catch { showToast('Erro ao copiar'); }
    } else {
      try { await Clipboard.write({ string: it.url }); showToast('Link do vídeo copiado'); } catch { showToast('Erro ao copiar'); }
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-bg-base">
      <div className="p-4 pb-6 flex flex-col gap-3 max-w-3xl mx-auto">
        <header>
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#E8B567] mb-1">Biblioteca local</p>
          <h1 className="text-2xl font-bold text-white">Downloads</h1>
          <p className="text-xs text-text-secondary mt-1">{items.length} item(ns)</p>
          {items.length > 0 && (
            <button onClick={() => { if (window.confirm('Excluir TODOS os downloads?')) items.forEach((i) => cancelDownload(i.id)); }} className="mt-2 self-start px-3.5 py-2 rounded-full bg-red-500/10 text-red-300 text-xs font-semibold">🗑 Excluir todos</button>
          )}
        </header>

        {items.length === 0 && (
          <div className="rounded-xl bg-bg-elevated border border-border-subtle p-6 flex flex-col items-center gap-2 text-text-muted text-sm text-center">
            <span className="text-3xl">⬇️</span>
            Nenhum download ainda. Baixe pela tela de detalhes de um filme ou episódio.
          </div>
        )}

        {items.map((it) => (
          <div key={it.id} className="rounded-xl bg-bg-elevated border border-border-subtle p-3.5 flex flex-col gap-2.5">
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0">{it.kind === 'movie' ? '🎬' : '📼'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white leading-snug line-clamp-2">{it.title}</p>
                {it.subtitle && <p className="text-[11px] text-text-secondary truncate mt-0.5">{it.subtitle}</p>}
              </div>
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${it.status === 'done' ? 'bg-emerald-400/15 text-emerald-300' : it.status === 'error' ? 'bg-red-500/15 text-red-300' : 'bg-[#E8B567]/15 text-[#E8B567]'}`}>
                {STATUS_LABEL[it.status] ?? it.status}
              </span>
            </div>

            <div className="h-1.5 rounded-full bg-bg-hover overflow-hidden">
              <div
                className={`h-full rounded-full ${it.status === 'error' ? 'bg-red-400' : it.status === 'done' ? 'bg-emerald-400' : 'bg-[#E8B567]'}`}
                style={{ width: `${Math.min(100, it.progress)}%` }}
              />
            </div>
            <p className="text-[11px] text-text-primary">{it.progress < 0 ? 'baixando… ' + (it.bytesDone ? (it.bytesDone/1048576).toFixed(1)+' MB' : '') : Math.round(it.progress) + '%'}</p>
            {it.status === 'error' && it.error && (<p className="text-[10px] text-red-300 mt-0.5">Erro: {it.error}</p>)}

            {it.status === 'done' && it.fileName && (
              <p className="text-[10px] text-text-muted truncate">📁 Documents/{it.fileName}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => watch(it)}
                className={`px-3.5 py-2 rounded-full text-xs font-semibold ${it.status === 'done' ? 'bg-[#E8B567] text-[#161006]' : 'bg-bg-hover text-text-muted'}`}
              >
                ▶ Assistir
              </button>
              {it.status === 'downloading' ? (
                <button onClick={() => pauseDownload(it.id)} className="px-3.5 py-2 rounded-full bg-bg-hover text-text-primary text-xs font-semibold">⏸ Pausar</button>
              ) : it.status === 'queued' ? (
                <button onClick={() => resumeDownload(it.id)} className="px-3.5 py-2 rounded-full bg-[#E8B567] text-[#161006] text-xs font-semibold">▶ Retomar</button>
              ) : null}
              <button onClick={() => copy(it)} className="px-3.5 py-2 rounded-full bg-bg-hover text-text-primary text-xs font-semibold">
                🔗 Copiar
              </button>
              <button onClick={() => cancelDownload(it.id)} className="px-3.5 py-2 rounded-full bg-red-500/10 text-red-300 text-xs font-semibold">
                🗑 Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
