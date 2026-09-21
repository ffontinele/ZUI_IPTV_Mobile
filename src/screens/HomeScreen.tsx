// HomeScreen v2 — mobile-first com fileiras "Continuar assistindo" (estilo XtreamlyTV)
import { useEffect, useMemo, useState } from 'react';
import { useUIStore } from '@/state/uiStore';
import { usePlaylistStore } from '@/state/playlistStore';
import { useSourceStore } from '@/state/sourceStore';
import { useMoviesStore } from '@/state/moviesStore';
import { useSeriesStore } from '@/state/seriesStore';
import { usePlayerStore } from '@/state/playerStore';

function greeting(date: Date): string {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'Bom dia';
  if (h >= 12 && h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function HomeScreen() {
  const navigate = useUIStore((s) => s.navigate);
  const sources = useSourceStore((s) => s.sources);
  const [now, setNow] = useState(() => new Date());

  const channelsBySource = usePlaylistStore((s) => s.channelsBySource);
  const recentIds = usePlaylistStore((s) => s.recentIds);
  const allMovies = useMoviesStore((s) => s.allMovies);
  const movieProgress = useMoviesStore((s) => s.watchProgress);
  const playMovie = useMoviesStore((s) => s.playMovie);
  const allSeries = useSeriesStore((s) => s.allSeries);
  const currentEpisode = useSeriesStore((s) => s.currentEpisode);
  const openSeriesDetails = useSeriesStore((s) => s.openSeriesDetails);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

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

  const activeSource = sources.find((s) => s.enabled);
  const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const playChannel = (ch: any) => {
    usePlaylistStore.getState().selectChannel(ch.id);
    usePlaylistStore.getState().addToRecent(ch.id);
    usePlayerStore.getState().setSource({ id: ch.id, name: ch.name, url: ch.streamUrl });
    navigate('player');
  };

  const cards = [
    { icon: '📺', title: 'TV ao Vivo', screen: 'channelList' as const },
    { icon: '🎬', title: 'Filmes', screen: 'movies' as const },
    { icon: '📼', title: 'Séries', screen: 'series' as const },
    { icon: '⭐', title: 'Favoritos', screen: 'favorites' as const },
    { icon: '🕘', title: 'Recentes', screen: 'recents' as const },
    { icon: '📋', title: 'Listas', screen: 'playlists' as const },
    { icon: '⬇️', title: 'Downloads', screen: 'downloads' as const },
    { icon: '⚙️', title: 'Configurações', screen: 'settings' as const },
  ];

  return (
    <div className="h-full overflow-y-auto p-4 pb-6 flex flex-col gap-4 max-w-3xl mx-auto">
      <header>
        <p className="text-[11px] uppercase tracking-[0.2em] text-[#E8B567] mb-1">Bem-vindo</p>
        <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">{greeting(now)}.</h1>
        <p className="text-xs text-text-secondary mt-1 capitalize">{dateStr} · {timeStr}</p>
      </header>

      {!activeSource && (
        <div className="rounded-xl bg-bg-elevated border border-border-subtle p-4">
          <p className="text-sm text-text-[#E8B567]">Nenhuma lista configurada</p>
          <button onClick={() => navigate('playlists')} className="mt-2 px-4 py-2 rounded-full bg-[#E8B567] text-[#161006] text-xs font-semibold">
            Adicionar lista agora
          </button>
        </div>
      )}

      {recentChannels.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wider text-text-muted mb-2">📺 Últimos canais</h2>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {recentChannels.map((ch) => (
              <button key={ch.id} onClick={() => playChannel(ch)} className="shrink-0 w-36 rounded-lg bg-bg-elevated border border-border-subtle p-2 text-left active:bg-bg-hover">
                <p className="text-xs text-text-[#E8B567] truncate">{ch.name}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {resumeMovies.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wider text-text-muted mb-2">🎬 Continuar assistindo</h2>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {resumeMovies.map((m) => (
              <button key={m.id} onClick={() => playMovie(m.id)} className="shrink-0 w-28 rounded-lg overflow-hidden bg-bg-elevated border border-border-subtle text-left active:bg-bg-hover">
                <div className="aspect-[2/3] bg-bg-hover">
                  {m.posterUrl ? <img src={m.posterUrl} alt="" className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <div className="w-full h-full flex items-center justify-center text-2xl">🎬</div>}
                </div>
                <div className="p-1.5">
                  <p className="text-[10px] text-text-[#E8B567] truncate">{m.title}</p>
                  <div className="mt-1 h-1 rounded-full bg-bg-hover"><div className="h-full rounded-full bg-[#E8B567]" style={{ width: `${Math.round((movieProgress[m.id] ?? 0) * 100)}%` }} /></div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {resumeSeries.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wider text-text-muted mb-2">📼 Continuar séries</h2>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {resumeSeries.map((s) => (
              <button key={s.id} onClick={() => void openSeriesDetails(s.id)} className="shrink-0 w-28 rounded-lg overflow-hidden bg-bg-elevated border border-border-subtle text-left active:bg-bg-hover">
                <div className="aspect-[2/3] bg-bg-hover">
                  {s.posterUrl ? <img src={s.posterUrl} alt="" className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <div className="w-full h-full flex items-center justify-center text-2xl">📼</div>}
                </div>
                <p className="p-1.5 text-[10px] text-text-[#E8B567] truncate">{s.title}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map((c) => (
          <button key={c.screen} onClick={() => navigate(c.screen)} className="rounded-xl bg-bg-elevated border border-border-subtle p-3.5 flex flex-col items-start gap-1.5 text-left active:bg-bg-hover transition-colors">
            <span className="text-xl leading-none">{c.icon}</span>
            <span className="text-sm font-semibold text-white">{c.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
