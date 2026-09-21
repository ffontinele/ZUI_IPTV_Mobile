// MoviesScreen — layout mobile-first para ZUI IPTV Mobile
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMoviesStore } from '@/state/moviesStore';
import { MovieDetailsModal } from '@/components/movies/MovieDetailsModal';

export function MoviesScreen() {
  const { t } = useTranslation();
  const visibleMovies = useMoviesStore(s => s.visibleMovies);
  const activeCategory = useMoviesStore(s => s.activeCategory);
  const categories = useMoviesStore(s => s.categories);
  const status = useMoviesStore(s => s.status);
  const error = useMoviesStore(s => s.error);
  const loadVodData = useMoviesStore(s => s.loadVodData);
  const setActiveCategory = useMoviesStore(s => s.setActiveCategory);
  const playMovie = useMoviesStore(s => s.playMovie);
  const openMovieDetails = useMoviesStore(s => s.openMovieDetails);
  const detailsMovieId = useMoviesStore(s => s.detailsMovieId);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'idle' || status === 'error') {
      void loadVodData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedMovie = selectedId
    ? visibleMovies.find(m => m.id === selectedId)
    : visibleMovies[0] ?? null;

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-full bg-bg-base">
        <div className="flex flex-col items-center gap-3 text-text-secondary">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">{t('movies.loading', 'Carregando filmes...')}</span>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center justify-center h-full bg-bg-base p-6">
        <div className="flex flex-col items-center gap-3 text-center max-w-sm">
          <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <p className="text-sm text-text-secondary">{error ?? t('movies.error', 'Erro ao carregar')}</p>
          <button
            onClick={() => void loadVodData()}
            className="mt-2 px-6 py-2 rounded-full bg-primary text-bg-base text-sm font-semibold"
          >
            {t('common.retry', 'Tentar novamente')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-bg-base overflow-hidden">
      {/* Hero do filme selecionado (banner grande no topo) */}
      {selectedMovie && (
        <div className="relative w-full aspect-video bg-bg-elevated shrink-0">
          {selectedMovie.backdropUrl ?? selectedMovie.posterUrl ? (
            <img
              src={selectedMovie.backdropUrl ?? selectedMovie.posterUrl}
              alt={selectedMovie.title}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl">🎬</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-bg-base via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h2 className="text-xl font-bold text-white mb-1 line-clamp-2">{selectedMovie.title}</h2>
            <div className="flex gap-2">
              <button
                onClick={() => playMovie(selectedMovie.id)}
                className="px-4 py-2 rounded-full bg-primary text-bg-base text-sm font-semibold"
              >
                ▶ Assistir
              </button>
              <button
                onClick={() => openMovieDetails(selectedMovie.id)}
                className="px-4 py-2 rounded-full bg-white/10 text-white text-sm font-semibold backdrop-blur"
              >
                ℹ️ Detalhes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Categorias em scroll horizontal */}
      <div className="shrink-0 border-b border-border-subtle bg-bg-elevated">
        <div className="flex overflow-x-auto gap-2 p-3 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id);
                setSelectedId(null);
              }}
              className={`
                shrink-0 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all
                ${activeCategory === cat.id
                  ? 'bg-primary text-bg-base'
                  : 'bg-bg-hover text-text-primary'
                }
              `}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de filmes (responsivo) */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {visibleMovies.map((movie) => (
            <button
              key={movie.id}
              onClick={() => setSelectedId(movie.id)}
              onDoubleClick={() => playMovie(movie.id)}
              className={`
                flex flex-col rounded-lg overflow-hidden bg-bg-elevated text-left transition-all
                ${selectedId === movie.id ? 'ring-2 ring-primary' : 'hover:ring-1 ring-border-subtle'}
              `}
            >
              <div className="aspect-[2/3] bg-bg-hover relative">
                {movie.posterUrl ? (
                  <img
                    src={movie.posterUrl}
                    alt={movie.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">🎬</div>
                )}
              </div>
              <div className="p-2">
                <p className="text-xs font-medium text-text-primary line-clamp-2 leading-tight">
                  {movie.title}
                </p>
              </div>
            </button>
          ))}
        </div>
        {visibleMovies.length === 0 && (
          <div className="flex items-center justify-center h-32 text-text-muted text-sm">
            {t('movies.empty', 'Nenhum filme nesta categoria')}
          </div>
        )}
      </div>

      {detailsMovieId && <MovieDetailsModal />}
    </div>
  );
}
