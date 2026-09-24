// FavoritesScreen — layout igual Recentes: secoes empilhadas rolaveis
// Sem abas. So aparece a secao que tem conteudo. Visual idêntico ao Recentes/Home.
import { useEffect, useMemo } from 'react';
import { EpisodeBrowserModal } from '@/components/series/EpisodeBrowserModal';
import { MovieDetailsModal } from '@/components/movies/MovieDetailsModal';
import { usePlaylistStore } from '@/state/playlistStore';
import { useMoviesStore } from '@/state/moviesStore';
import { useSeriesStore } from '@/state/seriesStore';
import { usePlayerStore } from '@/state/playerStore';
import { useUIStore } from '@/state/uiStore';

export function FavoritesScreen() {
  useEffect(() => {
    if (useMoviesStore.getState().status === 'idle') void useMoviesStore.getState().loadVodData();
    if (useSeriesStore.getState().status === 'idle') void useSeriesStore.getState().loadSeriesData();
  }, []);

  const channelsBySource = usePlaylistStore((s) => s.channelsBySource);
  const favChannelIds = usePlaylistStore((s) => s.favoriteIds);
  const toggleChannelFav = usePlaylistStore((s) => s.toggleFavorite);

  const allMovies = useMoviesStore((s) => s.allMovies);
  const favMovieIds = useMoviesStore((s) => s.favoriteIds);
  const toggleMovieFav = useMoviesStore((s) => s.toggleFavorite);
  const openMovieDetails = useMoviesStore((s) => s.openMovieDetails);

  const allSeries = useSeriesStore((s) => s.allSeries);
  const watchlistIds = useSeriesStore((s) => s.watchlistIds);
  const toggleWatchlist = useSeriesStore((s) => s.toggleWatchlist);
  const openSeriesDetails = useSeriesStore((s) => s.openSeriesDetails);
  const detailsSeriesId = useSeriesStore((s) => s.detailsSeriesId);

  const favChannels = useMemo(() => {
    const all = Object.values(channelsBySource).flat();
    return all.filter((c: any) => favChannelIds.includes(c.id));
  }, [channelsBySource, favChannelIds]);
  const favMovies = useMemo(() => allMovies.filter((m) => favMovieIds.includes(m.id)), [allMovies, favMovieIds]);
  const favSeries = useMemo(() => allSeries.filter((s) => watchlistIds.includes(s.id)), [allSeries, watchlistIds]);

  const playChannel = (ch: any) => {
    usePlaylistStore.getState().selectChannel(ch.id);
    usePlaylistStore.getState().addToRecent(ch.id);
    usePlayerStore.getState().setSource({ id: ch.id, name: ch.name, url: ch.streamUrl });
    useUIStore.getState().navigate('player');
  };

  const total = favChannels.length + favMovies.length + favSeries.length;

  return (
    <div className="flex flex-col h-full bg-bg-base">
      <div className="sticky top-0 z-10 bg-bg-elevated border-b border-border-subtle px-3 py-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[#E8B567]">⭐ Favoritos</p>
        <h1 className="text-xl font-bold text-white leading-tight">Meus favoritos</h1>
        <p className="text-xs text-text-secondary mt-0.5">{total} item(s) · {favChannels.length} canais · {favMovies.length} filmes · {favSeries.length} séries</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {total === 0 ? (
          <div className="flex items-center justify-center h-60 text-text-muted text-sm px-6 text-center">
            Nenhum favorito ainda.<br />Toque em ⭐ num canal, filme ou série para favoritar.
          </div>
        ) : (
          <div className="p-3 flex flex-col gap-5">
            {/* Canais favoritos */}
            {favChannels.length > 0 && (
              <section>
                <h2 className="text-xs uppercase tracking-wider text-text-muted mb-2">📺 Canais favoritos</h2>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {favChannels.map((ch: any) => (
                    <div key={ch.id} className="relative shrink-0 w-36">
                      <button
                        onClick={() => playChannel(ch)}
                        className="w-full rounded-lg overflow-hidden bg-bg-elevated border border-border-subtle text-left active:bg-bg-hover"
                      >
                        <div className="aspect-video bg-bg-hover flex items-center justify-center">
                          {ch.logo ? (
                            <img src={ch.logo} alt="" className="max-w-[70%] max-h-[70%] object-contain" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <span className="text-2xl">📺</span>
                          )}
                        </div>
                        <div className="p-1.5">
                          <p className="text-[10px] text-text-primary truncate">{ch.name}</p>
                        </div>
                      </button>
                      <button
                        onClick={() => toggleChannelFav(ch.id)}
                        className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 text-sm flex items-center justify-center"
                      >⭐</button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Filmes favoritos */}
            {favMovies.length > 0 && (
              <section>
                <h2 className="text-xs uppercase tracking-wider text-text-muted mb-2">🎬 Filmes favoritos</h2>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {favMovies.map((m) => (
                    <div key={m.id} className="relative shrink-0 w-28">
                      <button
                        onClick={() => openMovieDetails(m.id)}
                        className="w-full rounded-lg overflow-hidden bg-bg-elevated border border-border-subtle text-left active:bg-bg-hover"
                      >
                        <div className="aspect-[2/3] bg-bg-hover">
                          {m.posterUrl ? (
                            <img src={m.posterUrl} alt="" className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl">🎬</div>
                          )}
                        </div>
                        <div className="p-1.5">
                          <p className="text-[10px] text-text-primary truncate">{m.title}</p>
                        </div>
                      </button>
                      <button
                        onClick={() => toggleMovieFav(m.id)}
                        className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 text-sm flex items-center justify-center"
                      >⭐</button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Séries favoritas */}
            {favSeries.length > 0 && (
              <section>
                <h2 className="text-xs uppercase tracking-wider text-text-muted mb-2">📼 Séries favoritas</h2>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {favSeries.map((s) => (
                    <div key={s.id} className="relative shrink-0 w-28">
                      <button
                        onClick={() => void openSeriesDetails(s.id)}
                        className="w-full rounded-lg overflow-hidden bg-bg-elevated border border-border-subtle text-left active:bg-bg-hover"
                      >
                        <div className="aspect-[2/3] bg-bg-hover">
                          {s.posterUrl ? (
                            <img src={s.posterUrl} alt="" className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl">📼</div>
                          )}
                        </div>
                        <div className="p-1.5">
                          <p className="text-[10px] text-text-primary truncate">{s.title}</p>
                        </div>
                      </button>
                      <button
                        onClick={() => toggleWatchlist(s.id)}
                        className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 text-sm flex items-center justify-center"
                      >⭐</button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {detailsSeriesId && <EpisodeBrowserModal />}
      <MovieDetailsModal />
    </div>
  );
}
