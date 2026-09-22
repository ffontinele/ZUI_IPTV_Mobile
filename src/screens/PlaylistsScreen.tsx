// PlaylistsScreen — mobile: tela inteira rola, cards uniformes
import { useSourceStore } from '@/state/sourceStore';
import { usePlaylistStore } from '@/state/playlistStore';
import { useUIStore } from '@/state/uiStore';

export function PlaylistsScreen() {
  const sources = useSourceStore((s) => s.sources);
  const syncSource = useSourceStore((s) => s.syncSource);
  const channelsBySource = usePlaylistStore((s) => s.channelsBySource);
  const navigate = useUIStore((s) => s.navigate);

  const toggleEnabled = (id: string) => {
    const st = useSourceStore.getState() as any;
    if (typeof st.toggleSource === 'function') st.toggleSource(id);
    else if (typeof st.setSourceEnabled === 'function') {
      const src = st.sources.find((x: any) => x.id === id);
      st.setSourceEnabled(id, !src?.enabled);
    } else {
      useSourceStore.setState({ sources: st.sources.map((x: any) => (x.id === id ? { ...x, enabled: !x.enabled } : x)) });
    }
  };

  const removeSource = (id: string) => {
    if (!window.confirm('Excluir esta lista? Os canais dela saem do aparelho.')) return;
    const st = useSourceStore.getState() as any;
    if (typeof st.removeSource === 'function') st.removeSource(id);
    else if (typeof st.deleteSource === 'function') st.deleteSource(id);
    else useSourceStore.setState({ sources: st.sources.filter((x: any) => x.id !== id) });
  };

  const enabledCount = sources.filter((s) => s.enabled).length;

  return (
    <div className="h-full overflow-y-auto bg-bg-base">
      <div className="p-4 pb-6 flex flex-col gap-4 max-w-3xl mx-auto">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#E8B567] mb-1">Listas</p>
            <h1 className="text-2xl font-bold text-white leading-tight">Listas de Reprodução</h1>
            <p className="text-xs text-text-secondary mt-1">{sources.length} lista(s) · {enabledCount} ativa(s)</p>
          </div>
          <button
            onClick={() => navigate('onboarding')}
            className="shrink-0 px-4 py-2.5 rounded-full bg-[#E8B567] text-[#161006] text-sm font-semibold"
          >
            + Nova lista
          </button>
        </header>

        {sources.length === 0 && (
          <div className="rounded-xl bg-bg-elevated border border-border-subtle p-6 text-center text-sm text-text-muted">
            Nenhuma lista ainda. Toque em "+ Nova lista" para começar.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sources.map((src: any) => (
            <div key={src.id} className="rounded-xl bg-bg-elevated border border-border-subtle p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{src.name ?? src.config?.url ?? src.id}</p>
                  <p className="text-[11px] text-text-secondary truncate">{src.type === 'xtream' ? 'Xtream Codes' : 'M3U'} · {(channelsBySource[src.id] ?? []).length} canais</p>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${src.enabled ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/10 text-text-muted'}`}>
                  {src.enabled ? 'ATIVA' : 'INATIVA'}
                </span>
              </div>
              <p className="text-[11px] text-text-muted truncate">{src.config?.url ?? ''}</p>
              <p className="text-[11px] text-text-muted">
                {src.syncedAt ? `Atualizada: ${new Date(src.syncedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : 'Nunca sincronizada'}
              </p>
              <div className="flex gap-2 mt-auto">
                <button onClick={() => toggleEnabled(src.id)} className={`flex-1 px-3 py-2 rounded-full text-xs font-semibold ${src.enabled ? 'bg-[#E8B567] text-[#161006]' : 'bg-bg-hover text-text-primary'}`}>
                  {src.enabled ? '✓ Ativa' : 'Ativar'}
                </button>
                <button onClick={() => void syncSource(src.id)} className="flex-1 px-3 py-2 rounded-full bg-bg-hover text-text-primary text-xs font-semibold">
                  ⟳ Atualizar
                </button>
                <button onClick={() => removeSource(src.id)} className="px-3 py-2 rounded-full bg-red-500/10 text-red-300 text-xs font-semibold">
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
