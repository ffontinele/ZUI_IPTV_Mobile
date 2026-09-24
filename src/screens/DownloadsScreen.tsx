// DownloadsScreen — mobile: acoes completas por card + copiar caminho REAL da pasta
import { useEffect } from 'react';
import { useDownloadsStore, formatBytes } from '@/state/downloadsStore';
import { usePlayerStore } from '@/state/playerStore';
import { useUIStore } from '@/state/uiStore';
import { useToast } from '@/components/ui/Toast';
import { Clipboard } from '@capacitor/clipboard';
import { pauseDownload, resumeDownload, cancelDownload, speedMap } from '@/services/downloadRunner';

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
    if (it.status !== 'done' || !it.filePath) {
      showToast('Ainda não está pronto para assistir');
      return;
    }
    const url = it.filePath.startsWith('file://') ? it.filePath : 'file://' + it.filePath;
    usePlayerStore.getState().setSource({ id: it.id, name: it.title, url });
    navigate('player');
  };

  const copy = async (it: any) => {
    if (it.status === 'done') {
      // Caminho REAL da pasta (/storage/emulated/0/Documents/...)
      const path = (it.filePath && !String(it.filePath).startsWith('http')) ? it.filePath : `/storage/emulated/0/Documents/${it.fileName}`;
      if (path) {
        try {
          await Clipboard.write({ string: path });
          showToast('📁 Caminho do arquivo copiado');
        } catch {
          showToast('❌ Erro ao copiar');
        }
      } else {
        showToast('Arquivo não encontrado na pasta');
      }
    } else {
      try {
        await Clipboard.write({ string: it.url });
        showToast('📋 Link do vídeo copiado');
      } catch {
        showToast('❌ Erro ao copiar');
      }
    }
  };

  const clearAll = () => {
    if (!window.confirm('Excluir TODOS os downloads?')) return;
    items.forEach((i) => cancelDownload(i.id));
    showToast('🗑 Downloads excluídos');
  };

  return (
    <div className="h-full overflow-y-auto bg-bg-base">
      <div className="p-4 pb-6 flex flex-col gap-3 max-w-3xl mx-auto">
        <header>
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#E8B567] mb-1">Biblioteca local</p>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white flex-1">Downloads</h1>
          </div>
          <p className="text-xs text-text-secondary mt-1">{items.length} item(ns) · salvos em Documents/</p>
          {items.length > 0 && (
            <button onClick={clearAll} className="mt-2 px-3.5 py-2 rounded-full bg-red-500/10 text-red-300 text-xs font-semibold">🗑 Excluir todos</button>
          )}
        </header>

        {items.length === 0 && (
          <div className="rounded-xl bg-bg-elevated border border-border-subtle p-6 flex flex-col items-center gap-2 text-text-muted text-sm text-center">
            <span className="text-3xl">⬇️</span>
            Nenhum download ainda. Baixe pela tela de detalhes de um filme ou episódio.
          </div>
        )}

        {items.map((it) => (
          <div key={it.id} className="rounded-xl bg-bg-elevated border border-border-subtle p-4 flex flex-col gap-2">
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">{it.kind === 'movie' ? '🎬' : it.kind === 'episode' ? '📼' : '📺'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{it.title}</p>
                {it.subtitle && <p className="text-[11px] text-text-secondary truncate mt-0.5">{it.subtitle}</p>}
              </div>
              <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                it.status === 'done' ? 'bg-emerald-400/15 text-emerald-300'
                : it.status === 'error' ? 'bg-red-500/15 text-red-300'
                : 'bg-[#E8B567]/15 text-[#E8B567]'
              }`}>
                {STATUS_LABEL[it.status] ?? it.status}
              </span>
            </div>

            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-[#E8B567] transition-all" style={{ width: (it.status === 'done' ? 100 : (it.progress ?? 0)) + '%' }} />
            </div>
            <p className="text-[11px] text-text-primary tabular-nums">
              {it.status === 'done' ? '100%' : `${Math.max(0, Math.round(it.progress ?? 0))}%`}
              {it.bytesDone ? ` · ${formatBytes(it.bytesDone)}${it.bytesTotal ? ' / ' + formatBytes(it.bytesTotal) : ''}` : ''}{it.status === 'downloading' && (speedMap.get(it.id) ?? 0) > 0 ? ` · ${((speedMap.get(it.id) ?? 0) / 1048576).toFixed(1)} MB/s` : ''}
            </p>
            {it.status === 'error' && it.error && (
              <p className="text-[10px] text-red-300">Erro: {it.error}</p>
            )}
            {it.status === 'done' && it.fileName && (
              <p className="text-[10px] text-text-muted truncate">📁 Documents/{it.fileName}</p>
            )}

            <div className="flex flex-wrap gap-2 mt-1">
              <button onClick={() => watch(it)} disabled={it.status !== 'done'} className={`px-3.5 py-2 rounded-full text-xs font-semibold ${it.status === 'done' ? 'bg-[#E8B567] text-[#161006]' : 'bg-bg-hover text-text-muted'}`}>
                ▶ Assistir
              </button>
              {it.status === 'error' || it.status === 'queued' ? (
                <button onClick={() => resumeDownload(it.id)} className="px-3.5 py-2 rounded-full bg-[#E8B567] text-[#161006] text-xs font-semibold">↻ Tentar novamente</button>
              ) : it.status === 'downloading' ? (
                <button onClick={() => pauseDownload(it.id)} className="px-3.5 py-2 rounded-full bg-bg-hover text-text-primary text-xs font-semibold">⏸ Pausar</button>
              ) : null}
              <button onClick={() => void copy(it)} className="px-3.5 py-2 rounded-full bg-bg-hover text-text-primary text-xs font-semibold">🔗 Copiar</button>
              <button onClick={() => cancelDownload(it.id)} className="px-3.5 py-2 rounded-full bg-red-500/10 text-red-300 text-xs font-semibold">🗑 Excluir</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
