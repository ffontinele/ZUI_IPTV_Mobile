// RecentsScreen — pasta unica de "assistidos recentemente / continuar" das 3 categorias
import { useMemo, useState } from 'react';
import { usePlaylistStore } from '@/state/playlistStore';
import { useMoviesStore } from '@/state/moviesStore';
import { useSeriesStore } from '@/state/seriesStore';
import { usePlayerStore } from '@/state/playerStore';
import { useUIStore } from '@/state/uiStore';

type Tab = 'channels' | 'movies' | 'series';

export function RecentsScreen() {
  const [tab, setTab] = useState<Tab>('channels');

  const channelsBySource = usePlaylistStore((s) => s.channelsBySource);
  const recentIds = usePlaylistStore((s) => s.recentIds);
  const allMovies = useMoviesStore((s) => s.allMovies);
  const movieProgress = useMoviesStore((s) => s.watchProgress);
  const playMovie = useMoviesStore((s) => s.playMovie);
  const allSeries = useSeriesStore((s) => s.allSeries);
  const currentEpisode = useSeriesStore((s) => s.currentEpisode);
  const openSeriesDetails = useSeriesStore((s) => s.openSeriesDetails);

  const recentChannels = useMemo(() => {
    const all = Object.values(channelsBySource).flat();
    return recentIds.map((id) => all.find((c) => c.id === id)).filter(Boolean) as any[];
  }, [recentIds, channelsBySource]);

  const resumeMovies = useMemo(
    () => Object.entries(movieProgress)
      .filter(([, p]) => p > 0.02 && p < 0.98)
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
    useUIStore.getState().navigate('player');
  };

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'channels', label: '📺 Canais', count: recentChannels.length },
    { id: 'movies', label: '🎬 Filmes', count: resumeMovies.length },
    { id: 'series', label: '📼 Séries', count: resumeSeries.length },
  ];

  return (
    <div className="flex flex-col h-full bg-bg-base">
      <div className="sticky top-0 z-10 bg-bg-elevated border-b border-border-subtle p-3 flex flex-col gap-2">
        <h1 className="text-lg font-bold text-white px-1">🕘 Recentes / Continuar</h1>
        <div className="flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap ${tab === t.id ? 'bg-[#E8B567] text-[#161006] font-semibold' : 'bg-bg-hover text-text-primary'}`}
            >
              {t.label} · {t.count}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'channels' && (
          recentChannels.length === 0 ? <Empty msg="Nenhum canal assistido recentemente." /> :
          recentChannels.map((ch) => (
            <div key={ch.id} onClick={() => playChannel(ch)} className="flex items-center gap-3 px-3 py-2.5 border-b border-border-subtle/40 active:bg-bg-hover">
              <span className="text-lg">📺</span>
              <span className="flex-1 text-sm text-text-primary truncate">{ch.name}</span>
              <span className="text-xs text-text-muted">▶</span>
            </div>
          ))
        )}
        {tab === 'movies' && (
          resumeMovies.length === 0 ? <Empty msg="Nenhum filme em andamento. Assista um filme e ele aparecerá aqui." /> :
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 p-3">
            {resumeMovies.map((m) => (
              <button key={m.id} onClick={() => playMovie(m.id)} className="rounded-lg overflow-hidden bg-bg-elevated border border-border-subtle text-left active:bg-bg-hover">
                <div className="aspect-[2/3] bg-bg-hover">
                  {m.posterUrl ? <img src={m.posterUrl} alt="" className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <div className="w-full h-full flex items-center justify-center text-3xl">🎬</div>}
                </div>
                <div className="p-1.5">
                  <p className="text-[10px] text-text-primary truncate">{m.title}</p>
                  <div className="mt-1 h-1 rounded-full bg-bg-hover"><div className="h-full rounded-full bg-[#E8B567]" style={{ width: `${Math.round((movieProgress[m.id] ?? 0) * 100)}%` }} /></div>
                </div>
              </button>
            ))}
          </div>
        )}
        {tab === 'series' && (
          resumeSeries.length === 0 ? <Empty msg="Nenhuma série em andamento." /> :
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 p-3">
            {resumeSeries.map((s) => (
              <button key={s.id} onClick={() => void openSeriesDetails(s.id)} className="rounded-lg overflow-hidden bg-bg-elevated border border-border-subtle text-left active:bg-bg-hover">
                <div className="aspect-[2/3] bg-bg-hover">
                  {s.posterUrl ? <img src={s.posterUrl} alt="" className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <div className="w-full h-full flex items-center justify-center text-3xl">📼</div>}
                </div>
                <p className="p-1.5 text-[10px] text-text-primary truncate">{s.title}</p>
                {currentEpisode[s.id] && (
                  <p className="px-1.5 pb-1.5 text-[9px] text-[#E8B567]">S{currentEpisode[s.id].season} E{currentEpisode[s.id].episode}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="flex items-center justify-center h-40 text-text-muted text-sm px-6 text-center">{msg}</div>;
}
