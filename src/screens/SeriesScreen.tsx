// SeriesScreen — mobile-first (chips + grid rolavel + tap abre episodios)
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSeriesStore } from '@/state/seriesStore';
import { EpisodeBrowserModal } from '@/components/series/EpisodeBrowserModal';

let lastSeriesSel: { cat: string; id: string | null } = { cat: '', id: null };

export function SeriesScreen() {
  const { t } = useTranslation();
  const visibleSeries = useSeriesStore(s => s.visibleSeries);
  const activeCategory = useSeriesStore(s => s.activeCategory);
  const categories = useSeriesStore(s => s.categories);
  const status = useSeriesStore(s => s.status);
  const error = useSeriesStore(s => s.error);
  const loadSeriesData = useSeriesStore(s => s.loadSeriesData);
  const setActiveCategory = useSeriesStore(s => s.setActiveCategory);
  const setCategorySearch = useSeriesStore(s => s.setCategorySearch);
  const searchQuery = useSeriesStore(s => s.categorySearch);
  const watchlistIds = useSeriesStore(s => s.watchlistIds);
  const toggleWatchlist = useSeriesStore(s => s.toggleWatchlist);
  const openSeriesDetails = useSeriesStore(s => s.openSeriesDetails);
  const detailsSeriesId = useSeriesStore(s => s.detailsSeriesId);

  const [selectedId, setSelectedId] = useState<string | null>(() => (lastSeriesSel.cat === useSeriesStore.getState().activeCategory ? lastSeriesSel.id : null));
  const select = (id: string | null) => { setSelectedId(id); lastSeriesSel = { cat: useSeriesStore.getState().activeCategory, id }; };

  useEffect(() => {
    if (status === 'idle' || status === 'error') {
      void loadSeriesData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => setCategorySearch(''), []);

  const selected = selectedId
    ? visibleSeries.find(s => s.id === selectedId)
    : visibleSeries[0] ?? null;

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-full bg-bg-base">
        <div className="flex flex-col items-center gap-3 text-text-secondary">
          <div className="w-8 h-8 border-2 border-[#E8B567] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">{t('series.loading', 'Carregando séries...')}</span>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center justify-center h-full bg-bg-base p-6">
        <div className="flex flex-col items-center gap-3 text-center max-w-sm">
          <span className="text-3xl">⚠️</span>
          <p className="text-sm text-text-secondary">{error ?? t('series.error', 'Erro ao carregar')}</p>
          <button
            onClick={() => void loadSeriesData()}
            className="mt-2 px-6 py-2 rounded-full bg-[#E8B567] text-[#161006] text-sm font-semibold"
          >
            {t('common.retry', 'Tentar novamente')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-bg-base">
      {/* Hero compacto da serie selecionada */}
      {selected && (
        <div className="relative w-full h-44 md:h-56 bg-bg-elevated">
          {(selected.backdropUrl ?? selected.posterUrl) ? (
            <img
              src={(selected.backdropUrl ?? selected.posterUrl)!}
              alt={selected.title}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl">📼</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-bg-base via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h2 className="text-lg md:text-xl font-bold text-white mb-1 line-clamp-1">{selected.title}</h2>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] text-text-secondary">★ {selected.rating?.toFixed(1) ?? '—'}</span>
              <span className="text-[11px] text-text-secondary">· {selected.seasons} temporada(s)</span>
            </div>
            <button
              onClick={() => void openSeriesDetails(selected.id)}
              className="px-4 py-2 rounded-full bg-[#E8B567] text-[#161006] text-sm font-semibold"
            >
              📼 Ver episódios
            </button>
            <button
              onClick={() => toggleWatchlist(selected.id)}
              className="px-4 py-2 rounded-full bg-white/10 text-white text-sm font-semibold backdrop-blur"
            >
              {watchlistIds.includes(selected.id) ? '⭐ Favoritado' : '☆ Favoritar'}
            </button>
          </div>
        </div>
      )}

      {/* Categorias em chips (fixas no topo ao rolar) */}
      <div className="sticky top-0 z-10 border-b border-border-subtle bg-bg-elevated">
        <div className="px-3 pt-3">
          <div className="flex items-center gap-2 rounded-full bg-bg-hover px-4 py-2">
            <span className="text-sm">🔍</span>
            <input value={searchQuery} onChange={(e) => setCategorySearch(e.target.value)} placeholder="Buscar série..." className="flex-1 bg-transparent outline-none text-sm text-text-[#E8B567] placeholder:text-text-muted" />
          </div>
        </div>
        <div className="flex overflow-x-auto gap-2 p-3 no-scrollbar">
          {categories.filter((cat) => cat.id !== '__resume__' && cat.id !== '__favorites__').map((cat) => (
            <button
              key={cat.id}
              onClick={() => { setActiveCategory(cat.id); setSelectedId(null); lastSeriesSel = { cat: cat.id, id: null }; }}
              className={`
                shrink-0 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all
                ${activeCategory === cat.id ? 'bg-[#E8B567] text-[#161006]' : 'bg-bg-hover text-text-[#E8B567]'}
              `}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de series */}
      <div className="p-3">
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {visibleSeries.map((serie) => (
            <button
              key={serie.id}
              onClick={() => select(serie.id)}
              onDoubleClick={() => void openSeriesDetails(serie.id)}
              className={`
                flex flex-col rounded-lg overflow-hidden bg-bg-elevated text-left transition-all
                ${selectedId === serie.id ? 'ring-2 ring-[#E8B567] bg-[#E8B567]/10' : ''}
              `}
            >
              <div className="aspect-[2/3] bg-bg-hover relative">
                {serie.posterUrl ? (
                  <img
                    src={serie.posterUrl}
                    alt={serie.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">📼</div>
                )}
                {searchQuery && serie.categoryLabel && (
                  <span className="absolute bottom-1 left-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] text-[#E8B567] font-semibold truncate text-center backdrop-blur-sm">
                    {serie.categoryLabel}
                  </span>
                )}
              </div>
              <div className="p-2">
                <p className="text-xs font-medium text-text-[#E8B567] line-clamp-2 leading-tight">{serie.title}</p>
              </div>
            </button>
          ))}
        </div>
        {visibleSeries.length === 0 && (
          <div className="flex items-center justify-center h-32 text-text-muted text-sm">
            {t('series.empty', 'Nenhuma série nesta categoria')}
          </div>
        )}
      </div>

      {detailsSeriesId && <EpisodeBrowserModal />}
    </div>
  );
}
