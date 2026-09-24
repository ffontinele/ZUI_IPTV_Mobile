// MovieDetailsModal — mobile: bottom sheet com poster, info, sinopse e acoes
import { useMoviesStore } from '@/state/moviesStore';
import { useToast } from '@/components/ui/Toast';
import { Clipboard } from '@capacitor/clipboard';
import { buildVodUrl } from '@/services/vod.service';
import { startDownload } from '@/services/downloadRunner';
import { useSourceStore } from '@/state/sourceStore';

function getCreds() {
  const src = (useSourceStore.getState().sources ?? []).find((x: any) => x.enabled && x.type === 'xtream');
  return src ? (src.config as any) : null;
}

function fmtSec(t: number): string {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = Math.floor(t % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

export function MovieDetailsModal() {
  const detailsMovieId = useMoviesStore((s) => s.detailsMovieId);
  const movie = useMoviesStore((s) => (detailsMovieId ? s.allMovies.find((m) => m.id === detailsMovieId) ?? null : null));
  const isFavorite = useMoviesStore((s) => (detailsMovieId ? s.favoriteIds.includes(detailsMovieId) : false));
  const closeMovieDetails = useMoviesStore((s) => s.closeMovieDetails);
  const playMovie = useMoviesStore((s) => s.playMovie);
  const toggleFavorite = useMoviesStore((s) => s.toggleFavorite);
  const showToast = useToast((s) => s.show);
  const resumeSec = useMoviesStore((s) => (detailsMovieId ? s.resumeSecByMovie[detailsMovieId] ?? 0 : 0));

  if (!movie) return null;

  const c1 = movie.gradient?.[0] ?? '#3A3A3A';
  const c2 = movie.gradient?.[1] ?? '#1A1A1A';

  const handlePlay = () => {
    closeMovieDetails();
    playMovie(movie.id);
  };

  const handleFromStart = () => {
    useMoviesStore.getState().clearMovieResume(movie.id);
    closeMovieDetails();
    playMovie(movie.id);
  };

  const handleDownload = () => {
    try {
      const creds = getCreds();
      if (!creds || !movie.streamId) { showToast('❌ Sem fonte Xtream ativa'); return; }
      const ext = movie.containerExtension || 'mp4';
      const url = buildVodUrl(creds, movie.streamId, ext);
      const safeTitle = movie.title.replace(/[^a-z0-9._-]+/gi, '_').slice(0, 80) || 'filme';
      showToast('⬇ Iniciando download...');
      void startDownload({
        id: `vod-${movie.id}`,
        kind: 'movie',
        title: movie.title,
        url,
        fileName: `${safeTitle}.${ext}`,
        status: 'queued',
        progress: 0,
        addedAt: Date.now(),
      } as any);
    } catch (e) {
      showToast('Erro ao baixar: ' + String((e as any)?.message ?? e));
    }
  };

  const handleCopy = async () => {
    try {
      const creds = getCreds();
      if (!creds || !movie.streamId) { showToast('❌ Sem fonte Xtream ativa'); return; }
      const ext = movie.containerExtension || 'mp4';
      const url = buildVodUrl(creds, movie.streamId, ext);
      await Clipboard.write({ string: url });
      showToast('📋 Link do vídeo copiado');
    } catch (e) {
      showToast('Erro: ' + String((e as any)?.message ?? e));
    }
  };

  const handleFavorite = () => {
    const adding = !isFavorite;
    toggleFavorite(movie.id);
    showToast(adding ? '⭐ Adicionado aos favoritos' : 'Removido dos favoritos');
  };

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 z-[960] bg-black/80 flex items-end md:items-center justify-center" onClick={closeMovieDetails}>
      <div
        className="w-full max-w-2xl max-h-[88vh] bg-bg-elevated border border-border-subtle rounded-t-2xl md:rounded-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle shrink-0">
          <h3 className="flex-1 min-w-0 text-sm font-bold text-white truncate pr-2">🎬 Detalhes do filme</h3>
          <button onClick={closeMovieDetails} className="w-8 h-8 rounded-full bg-white/10 text-sm shrink-0">✕</button>
        </div>

        {/* Conteudo scrollavel */}
        <div className="flex-1 overflow-y-auto">
          {/* Poster + info basica */}
          <div className="flex gap-4 p-4">
            <div className="shrink-0 w-[110px] aspect-[2/3] rounded-xl overflow-hidden border border-border-subtle shadow-lg">
              {movie.posterUrl ? (
                <img src={movie.posterUrl} alt={movie.title} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="w-full h-full grid place-items-center" style={{ background: `linear-gradient(155deg, ${c1}, ${c2})` }}>
                  <span className="font-serif italic text-[48px] text-white/10 leading-none">{movie.title.charAt(0)}</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              {movie.isNew && (
                <span className="inline-flex items-center gap-1 self-start px-2 py-0.5 rounded-full bg-[#E8B567]/15 text-[#E8B567] text-[9px] font-bold uppercase tracking-wider">
                  <span className="w-1 h-1 rounded-full bg-[#E8B567]" /> Novo
                </span>
              )}
              <h2 className="text-lg font-bold text-white leading-tight">{movie.title}</h2>
              <div className="flex items-center gap-2 text-[11px] text-text-secondary flex-wrap">
                {movie.rating > 0 && (
                  <span className="flex items-center gap-1 text-[#E8B567] font-bold">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    {movie.rating.toFixed(1)}
                  </span>
                )}
                {movie.rating > 0 && movie.year > 0 && <span className="w-0.5 h-0.5 rounded-full bg-white/30" />}
                {movie.year > 0 && <span>{movie.year}</span>}
                {movie.runtime && (
                  <>
                    <span className="w-0.5 h-0.5 rounded-full bg-white/30" />
                    <span>{movie.runtime}</span>
                  </>
                )}
              </div>
              {movie.genre && (
                <span className="inline-flex self-start px-2 py-0.5 rounded border border-border-subtle text-[10px] uppercase tracking-wider text-text-muted font-semibold">
                  {movie.genre}
                </span>
              )}
              {movie.categoryLabel && (
                <span className="inline-flex self-start px-2 py-0.5 rounded-full bg-[#E8B567]/10 text-[#E8B567] text-[10px] font-semibold">
                  {movie.categoryLabel}
                </span>
              )}
            </div>
          </div>

          {/* Sinopse */}
          {movie.synopsis && (
            <div className="px-4 pb-4">
              <p className="text-[11px] uppercase tracking-wider text-text-muted mb-1.5">Sinopse</p>
              <p className="text-[13px] text-text-secondary leading-relaxed">{movie.synopsis}</p>
            </div>
          )}

          {/* Acoes principais */}
          <div className="px-4 pb-4 flex flex-col gap-2">
            {resumeSec > 10 ? (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handlePlay} className="h-12 rounded-full bg-[#E8B567] text-[#161006] text-sm font-bold flex items-center justify-center gap-1.5 shadow-[0_0_20px_-4px_#E8B567]">
                  ▶ Continuar de {fmtSec(resumeSec)}
                </button>
                <button onClick={handleFromStart} className="h-12 rounded-full bg-bg-hover text-text-primary text-sm font-bold flex items-center justify-center gap-1.5">
                  ↺ Do início
                </button>
              </div>
            ) : (
              <button onClick={handlePlay} className="w-full h-12 rounded-full bg-[#E8B567] text-[#161006] text-sm font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_-4px_#E8B567]">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M7 4v16l13-8z" /></svg>
                ▶ Assistir
              </button>
            )}
            <div className="grid grid-cols-3 gap-2">
              <button onClick={handleDownload} className="h-11 rounded-full bg-bg-hover text-text-primary text-xs font-semibold flex flex-col items-center justify-center gap-0.5">
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#E8B567]" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11" /><path d="m6 11 6 6 6-6" /><path d="M5 20h14" /></svg>
                Baixar
              </button>
              <button onClick={handleCopy} className="h-11 rounded-full bg-bg-hover text-text-primary text-xs font-semibold flex flex-col items-center justify-center gap-0.5">
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-text-primary" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg>
                Copiar
              </button>
              <button onClick={handleFavorite} className={`h-11 rounded-full text-xs font-semibold flex flex-col items-center justify-center gap-0.5 ${isFavorite ? 'bg-[#E8B567]/15 text-[#E8B567]' : 'bg-bg-hover text-text-primary'}`}>
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                {isFavorite ? 'Favorito' : 'Favoritar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
