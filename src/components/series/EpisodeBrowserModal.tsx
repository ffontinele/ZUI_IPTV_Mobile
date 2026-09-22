// EpisodeBrowserModal — mobile: temporadas em chips, episodios com marca de "onde parou"
import { useEffect, useMemo } from 'react';
import { useSeriesStore } from '@/state/seriesStore';
import { useDownloadsStore } from '@/state/downloadsStore';
import { buildSeriesEpisodeUrl } from '@/services/series.service';

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function EpisodeBrowserModal() {
  const detailsSeriesId = useSeriesStore((s) => s.detailsSeriesId);
  const detailsInfo = useSeriesStore((s) => s.detailsInfo) as any;
  const detailsStatus = useSeriesStore((s) => s.detailsStatus);
  const detailsActiveSeason = useSeriesStore((s) => s.detailsActiveSeason);
  const setDetailsActiveSeason = useSeriesStore((s) => s.setDetailsActiveSeason);
  const playEpisode = useSeriesStore((s) => s.playEpisode);
  const closeSeriesDetails = useSeriesStore((s) => s.closeSeriesDetails);
  const currentEpisode = useSeriesStore((s) => s.currentEpisode);

  const seriesTitle = useMemo(
    () => useSeriesStore.getState().allSeries.find((s) => s.id === detailsSeriesId)?.title ?? '',
    [detailsSeriesId]
  );
  const ce = detailsSeriesId ? currentEpisode[detailsSeriesId] : undefined;

  // Abre ja na temporada do ultimo episodio assistido
  useEffect(() => {
    if (ce && ce.season) setDetailsActiveSeason(ce.season);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailsSeriesId]);

  if (!detailsSeriesId) return null;

  const episodesBySeason: Record<string, any[]> = detailsInfo?.episodes ?? {};
  const seasonKeys = Object.keys(episodesBySeason).sort((a, b) => Number(a) - Number(b));
  const activeKey = String(detailsActiveSeason ?? seasonKeys[0] ?? '');
  const episodes: any[] = episodesBySeason[activeKey] ?? [];

  const credsOf = () => (window as any).__ZUI_XTREAM_CREDS;

  const download = (ep: any) => {
    const creds = credsOf();
    if (!creds) return;
    const ss = String(Number(activeKey)).padStart(2, '0');
    const nn = String(ep.episode_num).padStart(2, '0');
    useDownloadsStore.getState().add({
      id: `series-ep-${ep.id}`,
      kind: 'episode',
      title: seriesTitle,
      subtitle: `S${ss}:E${nn} - ${ep.title ?? ''}`,
      url: buildSeriesEpisodeUrl(creds, ep.id, ep.container_extension),
      fileName: `${seriesTitle}_S${ss}E${nn}.${ep.container_extension ?? 'mp4'}`,
      status: 'queued',
      progress: 0,
      addedAt: Date.now(),
    } as any);
  };

  const copy = (ep: any) => {
    const creds = credsOf();
    if (!creds) return;
    try { (navigator as any).clipboard?.writeText(buildSeriesEpisodeUrl(creds, ep.id, ep.container_extension)); } catch { /* ignore */ }
  };

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 z-[960] bg-black/80 flex items-end md:items-center justify-center" onClick={closeSeriesDetails}>
      <div className="w-full max-w-2xl max-h-[88vh] bg-bg-elevated border border-border-subtle rounded-t-2xl md:rounded-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle shrink-0">
          <h3 className="flex-1 min-w-0 text-sm font-bold text-white truncate">📼 {seriesTitle}</h3>
          <button onClick={closeSeriesDetails} className="w-8 h-8 rounded-full bg-white/10 text-sm shrink-0">✕</button>
        </div>

        <div className="flex gap-2 px-4 py-2 overflow-x-auto no-scrollbar border-b border-border-subtle shrink-0">
          {seasonKeys.map((k) => (
            <button
              key={k}
              onClick={() => setDetailsActiveSeason(Number(k))}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold ${activeKey === k ? 'bg-[#E8B567] text-[#161006]' : 'bg-bg-hover text-text-primary'}`}
            >
              S{String(Number(k)).padStart(2, '0')}
              {ce && ce.season === Number(k) ? ' · ▶' : ''}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {detailsStatus === 'loading' && (
            <div className="flex items-center justify-center h-32 text-text-secondary text-sm">Carregando episódios...</div>
          )}
          {detailsStatus === 'ready' && episodes.length === 0 && (
            <div className="flex items-center justify-center h-32 text-text-muted text-sm">Nenhum episódio nesta temporada</div>
          )}
          {episodes.map((ep) => {
            const isResume = !!ce && ce.season === Number(activeKey) && ce.episode === ep.episode_num;
            const thumb = ep.still ?? ep.image ?? ep.img ?? ep.cover ?? null;
            return (
              <div key={ep.id} className={`flex items-center gap-3 px-4 py-3 border-b border-border-subtle/40 ${isResume ? 'bg-[#E8B567]/10 border-l-4 border-l-[#E8B567]' : ''}`}>
                <span className="w-9 h-9 shrink-0 rounded-lg bg-[#E8B567] text-[#161006] font-bold text-xs flex items-center justify-center">
                  {String(ep.episode_num).padStart(2, '0')}
                </span>
                {thumb ? (
                  <img src={thumb} alt="" className="w-16 h-10 rounded object-cover shrink-0" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : null}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">{ep.title ?? `Episódio ${ep.episode_num}`}</p>
                  {isResume && (
                    <p className="text-[11px] text-[#E8B567] font-semibold mt-0.5">▶ Continuar de {fmt(ce?.resumeSec ?? 0)}</p>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => playEpisode(ep, seriesTitle, activeKey)} className="w-9 h-9 rounded-full bg-[#E8B567] text-[#161006] text-sm font-bold">▶</button>
                  <button onClick={() => download(ep)} className="w-9 h-9 rounded-full bg-bg-hover text-sm">⬇</button>
                  <button onClick={() => copy(ep)} className="w-9 h-9 rounded-full bg-bg-hover text-sm">🔗</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
