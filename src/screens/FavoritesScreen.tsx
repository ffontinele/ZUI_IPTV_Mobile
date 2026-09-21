// FavoritesScreen — favoritos de canais, filmes e series num so lugar
import { useMemo, useState } from 'react';
import { usePlaylistStore } from '@/state/playlistStore';
import { useMoviesStore } from '@/state/moviesStore';
import { useSeriesStore } from '@/state/seriesStore';
import { usePlayerStore } from '@/state/playerStore';
import { useUIStore } from '@/state/uiStore';

type Tab = 'channels' | 'movies' | 'series';

export function FavoritesScreen() {
  const [tab, setTab] = useState<Tab>('channels');

  const channelsBySource = usePlaylistStore((s) => s.channelsBySource);
  const favChannelIds = usePlaylistStore((s) => s.favoriteIds);
  const toggleChannelFav = usePlaylistStore((s) => s.toggleFavorite);

  const allMovies = useMoviesStore((s) => s.allMovies);
  const favMovieIds = useMoviesStore((s) => s.favoriteIds);
  const toggleMovieFav = useMoviesStore((s) => s.toggleFavorite);
  const playMovie = useMoviesStore((s) => s.playMovie);

  const allSeries = useSeriesStore((s) => s.allSeries);
  const watchlistIds = useSeriesStore((s) => s.watchlistIds);
  const toggleWatchlist = useSeriesStore((s) => s.toggleWatchlist);
  const openSeriesDetails = useSeriesStore((s) => s.openSeriesDetails);

  const favChannels = useMemo(() => {
    const all = Object.values(channelsBySource).flat();
    return all.filter((c) => favChannelIds.includes(c.id));
  }, [channelsBySource, favChannelIds]);
  const favMovies = useMemo(() => allMovies.filter((m) => favMovieIds.includes(m.id)), [allMovies, favMovieIds]);
  const favSeries = useMemo(() => allSeries.filter((s) => watchlistIds.includes(s.id)), [allSeries, watchlistIds]);

  const playChannel = (ch: any) => {
    usePlaylistStore.getState().selectChannel(ch.id);
    usePlaylistStore.getState().addToRecent(ch.id);
    usePlayerStore.getState().setSource({ id: ch.id, name: ch.name, url: ch.streamUrl });
    useUIStore.getState().navigate('player');
  };

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'channels', label: '📺 Canais', count: favChannels.length },
    { id: 'movies', label: '🎬 Filmes', count: favMovies.length },
    { id: 'series', label: '📼 Séries', count: favSeries.length },
  ];

  return (
    <div className="flex flex-col h-full bg-bg-base">
      <div className="sticky top-0 z-10 bg-bg-elevated border-b border-border-subtle p-3">
        <div className="flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap ${tab === t.id ? 'bg-[#E8B567] text-[#161006]' : 'bg-bg-hover text-text-[#E8B567]'}`}
            >
              {t.label} · {t.count}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'channels' && (
          favChannels.length === 0 ? <Empty msg="Nenhum canal favorito ainda. Toque na ☆ de um canal para favoritar." /> :
          favChannels.map((ch: any) => (
            <div key={ch.id} onClick={() => playChannel(ch)} className="flex items-center gap-3 px-3 py-2.5 border-b border-border-subtle/40 active:bg-bg-hover">
              <span className="flex-1 text-sm text-text-[#E8B567] truncate">{ch.name}</span>
              <button onClick={(e) => { e.stopPropagation(); toggleChannelFav(ch.id); }} className="px-2">⭐</button>
            </div>
          ))
        )}
        {tab === 'movies' && (
          favMovies.length === 0 ? <Empty msg="Nenhum filme favorito ainda." /> :
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 p-3">
            {favMovies.map((m) => (
              <div key={m.id} className="relative rounded-lg overflow-hidden bg-bg-elevated">
                <button onClick={() => playMovie(m.id)} className="w-full">
                  <div className="aspect-[2/3] bg-bg-hover">
                    {m.posterUrl ? <img src={m.posterUrl} alt="" className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <div className="w-full h-full flex items-center justify-center text-3xl">🎬</div>}
                  </div>
                  <p className="p-2 text-xs text-text-[#E8B567] line-clamp-2 leading-tight text-left">{m.title}</p>
                </button>
                <button onClick={() => toggleMovieFav(m.id)} className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 text-sm">⭐</button>
              </div>
            ))}
          </div>
        )}
        {tab === 'series' && (
          favSeries.length === 0 ? <Empty msg="Nenhuma série favorita ainda." /> :
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 p-3">
            {favSeries.map((s) => (
              <div key={s.id} className="relative rounded-lg overflow-hidden bg-bg-elevated">
                <button onClick={() => void openSeriesDetails(s.id)} className="w-full">
                  <div className="aspect-[2/3] bg-bg-hover">
                    {s.posterUrl ? <img src={s.posterUrl} alt="" className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <div className="w-full h-full flex items-center justify-center text-3xl">📼</div>}
                  </div>
                  <p className="p-2 text-xs text-text-[#E8B567] line-clamp-2 leading-tight text-left">{s.title}</p>
                </button>
                <button onClick={() => toggleWatchlist(s.id)} className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 text-sm">⭐</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="flex items-center justify-center h-40 text-text-muted text-sm px-6 text-center">{msg}</div>
  );
}
