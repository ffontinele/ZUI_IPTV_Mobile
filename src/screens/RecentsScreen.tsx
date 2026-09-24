// RecentsScreen v2 — visual identico ao da Home (secoes com fileiras horizontais)
import { useEffect, useMemo } from 'react';
import { usePlaylistStore } from '@/state/playlistStore';
import { useMoviesStore } from '@/state/moviesStore';
import { useSeriesStore } from '@/state/seriesStore';
import { usePlayerStore } from '@/state/playerStore';
import { useUIStore } from '@/state/uiStore';
import { EpisodeBrowserModal } from '@/components/series/EpisodeBrowserModal';

export function RecentsScreen() {
  const navigate = useUIStore((s) => s.navigate);
  const channelsBySource = usePlaylistStore((s) => s.channelsBySource);
  const recentIds = usePlaylistStore((s) => s.recentIds);
  const allMovies = useMoviesStore((s) => s.allMovies);
  const movieProgress = useMoviesStore((s) => s.watchProgress);
  const openMovieDetails = useMoviesStore((s) => s.openMovieDetails);
  const allSeries = useSeriesStore((s) => s.allSeries);
  const currentEpisode = useSeriesStore((s) => s.currentEpisode);
  const openSeriesDetails = useSeriesStore((s) => s.openSeriesDetails);
  const detailsSeriesId = useSeriesStore((s) => s.detailsSeriesId);

  useEffect(() => {
    if (useMoviesStore.getState().status === 'idle') void useMoviesStore.getState().loadVodData();
    if (useSeriesStore.getState().status === 'idle') void useSeriesStore.getState().loadSeriesData();
  }, []);

  const recentChannels = useMemo(() => {
    const all = Object.values(channelsBySource).flat();
    return recentIds.map((id) => all.find((c) => c.id === id)).filter(Boolean) as any[];
  }, [recentIds, channelsBySource]);

  const resumeMovies = useMemo(
    () => Object.entries(movieProgress)
      .filter(([, p]) => p > 0.001 && p < 0.98)
      .map(([id]) => allMovies.find((m) => m.id === id))
      .filter(Boolean) as any[],
    [movieProgress, allMovies]
  );

  const resumeSeries = useMemo(
    () => Object.keys(currentEpisode)
      .map((id) => allSeries.find((s) => s.id === id))
      .filter(Boolean) as any[],
    [currentEpisode, allSeries]
  );

  const playChannel = (ch: any) => {
    usePlaylistStore.getState().selectChannel(ch.id);
    usePlaylistStore.getState().addToRecent(ch.id);
    usePlayerStore.getState().setSource({ id: ch.id, name: ch.name, url: ch.streamUrl });
    navigate('player');
  };

  const empty = recentChannels.length === 0 && resumeMovies.length === 0 && resumeSeries.length === 0;

  return (
    <div className="h-full overflow-y-auto p-4 pb-6 flex flex-col gap-5 max-w-3xl mx-auto">
      <header>
        <p className="text-[11px] uppercase tracking-[0.2em] text-[#E8B567] mb-1">Sua biblioteca</p>
        <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">Recentes / Continuar</h1>
        <p className="text-xs text-text-secondary mt-1">Tudo o que você assistiu recentemente, em um só lugar</p>
      </header>

      {empty && (
        <div className="rounded-xl bg-bg-elevated border border-border-subtle p-6 text-center text-sm text-text-muted">
          Nada por aqui ainda. Assista algo em TV, Filmes ou Séries e aparecerá nesta tela.
        </div>
      )}

      {recentChannels.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2"><h2 className="text-xs uppercase tracking-wider text-text-muted">📺 Últimos canais</h2><button onClick={() => usePlaylistStore.setState({ recentIds: [] } as any)} className="text-[10px] px-2.5 py-1 rounded-full bg-red-500/10 text-red-300 font-semibold">🗑 Limpar</button></div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {recentChannels.map((ch) => (
              <button key={ch.id} onClick={() => playChannel(ch)} className="shrink-0 w-36 rounded-lg overflow-hidden bg-bg-elevated border border-border-subtle text-left active:bg-bg-hover">
                <div className="aspect-video bg-bg-hover flex items-center justify-center p-3">
                  {ch.logo ? <img src={ch.logo} alt="" className="w-full h-full object-contain" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <span className="text-2xl">📺</span>}
                </div>
                <p className="p-1.5 text-[10px] text-text-primary truncate">{ch.name}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {resumeMovies.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2"><h2 className="text-xs uppercase tracking-wider text-text-muted">🎬 Continuar assistindo</h2><button onClick={() => useMoviesStore.getState().clearResume()} className="text-[10px] px-2.5 py-1 rounded-full bg-red-500/10 text-red-300 font-semibold">🗑 Limpar</button></div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {resumeMovies.map((m) => (
              <button key={m.id} onClick={() => openMovieDetails(m.id)} className="shrink-0 w-28 rounded-lg overflow-hidden bg-bg-elevated border border-border-subtle text-left active:bg-bg-hover">
                <div className="aspect-[2/3] bg-bg-hover">
                  {m.posterUrl ? <img src={m.posterUrl} alt="" className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <div className="w-full h-full flex items-center justify-center text-2xl">🎬</div>}
                </div>
                <div className="p-1.5">
                  <p className="text-[10px] text-text-primary truncate">{m.title}</p>
                  <div className="mt-1 h-1 rounded-full bg-bg-hover"><div className="h-full rounded-full bg-[#E8B567]" style={{ width: `${Math.round((movieProgress[m.id] ?? 0) * 100)}%` }} /></div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {resumeSeries.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2"><h2 className="text-xs uppercase tracking-wider text-text-muted">📼 Continuar séries</h2><button onClick={() => useSeriesStore.getState().clearResume()} className="text-[10px] px-2.5 py-1 rounded-full bg-red-500/10 text-red-300 font-semibold">🗑 Limpar</button></div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {resumeSeries.map((s) => (
              <button key={s.id} onClick={() => void openSeriesDetails(s.id)} className="shrink-0 w-28 rounded-lg overflow-hidden bg-bg-elevated border border-border-subtle text-left active:bg-bg-hover">
                <div className="aspect-[2/3] bg-bg-hover">
                  {s.posterUrl ? <img src={s.posterUrl} alt="" className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <div className="w-full h-full flex items-center justify-center text-2xl">📼</div>}
                </div>
                <p className="p-1.5 text-[10px] text-text-primary truncate">{s.title}</p>
                {currentEpisode[s.id] && (
                  <p className="px-1.5 pb-1.5 text-[9px] text-[#E8B567]">S{currentEpisode[s.id].season} E{currentEpisode[s.id].episode}</p>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {detailsSeriesId && <EpisodeBrowserModal />}
    </div>
  );
}
