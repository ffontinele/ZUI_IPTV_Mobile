// seriesStore — Zustand store for the Series (TV Show) screen.
// Mirrors moviesStore: fetches all series once, filters client-side by category.
// Persists: watchlistIds, currentEpisode, watchProgress, sortBy, activeCategory.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useSourceStore } from '@/state/sourceStore';
import { usePlayerStore } from '@/state/playerStore';
import { useUIStore } from '@/state/uiStore';
import { useToast } from '@/components/ui/Toast';
import {
  getSeriesCategories,
  getSeriesStreams,
  getSeriesInfo,
  buildSeriesEpisodeUrl,
} from '@/services/series.service';
import type { Series, SeriesCategory, SeriesSort, CurrentEpisode } from '@/types/series';
import type { XtreamCredentials, XtreamSeriesEpisode, XtreamSeriesInfoResponse } from '@/types/xtream';

// ─── Sort helpers ────────────────────────────────────────────────────────────

const SORT_ORDER: SeriesSort[] = ['newEpisode', 'added', 'rating', 'year', 'title'];

function sortSeries(series: Series[], by: SeriesSort): Series[] {
  const copy = [...series];
  switch (by) {
    case 'newEpisode': return copy.sort((a, b) => (b.isNewEpisode ? 1 : 0) - (a.isNewEpisode ? 1 : 0));
    case 'rating':     return copy.sort((a, b) => b.rating - a.rating);
    case 'year':       return copy.sort((a, b) => b.year - a.year);
    case 'title':      return copy.sort((a, b) => a.title.localeCompare(b.title, 'tr'));
    case 'added':
    default:           return copy; // API order = newest first
  }
}

// ─── Client-side category filter ─────────────────────────────────────────────

function computeVisible(
  all: Series[],
  activeCategory: string,
  watchlistIds: string[],
  watchProgress: Record<string, number>
): Series[] {
  if (!activeCategory || activeCategory === '') return all;
  if (activeCategory === '__watchlist__') {
    return all.filter(s => watchlistIds.includes(s.id));
  }
  if (activeCategory === '__resume__') {
    return all.filter(s => {
      const p = watchProgress[s.id] ?? 0;
      return p > 0 && p < 0.99;
    });
  }
  return all.filter(s => s.categoryId === activeCategory);
}

// ─── Helper: get first enabled Xtream source credentials ────────────────────

function getXtreamCreds(): XtreamCredentials | null {
  const sources = useSourceStore.getState().sources;
  const src = sources.find(s => s.enabled && s.type === 'xtream');
  return src ? (src.config as XtreamCredentials) : null;
}

// ─── Build category list with real counts ────────────────────────────────────

function buildCategories(
  rawCats: SeriesCategory[],
  allSeries: Series[],
  watchlistIds: string[],
  watchProgress: Record<string, number>
): SeriesCategory[] {
  const countMap: Record<string, number> = {};
  for (const s of allSeries) {
    if (s.categoryId) countMap[s.categoryId] = (countMap[s.categoryId] ?? 0) + 1;
  }

  const regularCats = rawCats.map(c => ({
    ...c,
    count: countMap[c.id] ?? 0,
  })).filter(c => c.count > 0);

  const specials: SeriesCategory[] = [];
  const resumeCount = Object.values(watchProgress).filter(p => p > 0 && p < 0.99).length;
  specials.push({ id: '__resume__', label: 'Continuar Assistindo', count: resumeCount });
  specials.push({ id: '__watchlist__', label: 'Favoritos', count: watchlistIds.length });

  return [...specials, ...regularCats];
}

// ─── Store type ──────────────────────────────────────────────────────────────

export type SeriesStatus = 'idle' | 'loading' | 'error' | 'ready';

type SeriesStore = {
  allSeries: Series[];
  visibleSeries: Series[];
  categories: SeriesCategory[];
  activeCategory: string;
  watchlistIds: string[];
  currentEpisode: Record<string, CurrentEpisode>;
  watchProgress: Record<string, number>;
  sortBy: SeriesSort;
  categorySearch: string;
  newThisWeekCount: number;
  status: SeriesStatus;
  error: string | null;

  // Episode browser modal
  detailsSeriesId: string | null;
  reopenSeriesId: string | null;
  reopenSeason: number | null;
  detailsInfo: XtreamSeriesInfoResponse | null;
  detailsStatus: 'idle' | 'loading' | 'error' | 'ready';
  detailsError: string | null;
  detailsActiveSeason: number;

  hiddenCategoryIds: string[];

  // Actions
  loadSeriesData: () => Promise<void>;
  setActiveCategory: (id: string) => void;
  setCategorySearch: (q: string) => void;
  setActiveSeason: (seriesId: string, season: number) => void;
  cycleSort: () => void;
  toggleWatchlist: (id: string) => void;
  setWatchProgress: (id: string, progress: number) => void;
  setCurrentEpisode: (id: string, ep: import("@/types/series").CurrentEpisode) => void;
  clearResume: () => void;
  clearWatchlist: () => void;
  playSeries: (id: string) => void;
  openSeriesDetails: (id: string) => Promise<void>;
  closeSeriesDetails: () => void;
  setDetailsActiveSeason: (season: number) => void;
  playEpisode: (episode: XtreamSeriesEpisode, seriesTitle: string, seasonKey: string) => void;

  toggleHiddenCategory: (id: string) => void;

  // Internal
  _recompute: () => void;
  _updateSpecials: () => void;
};

// ─── Store ───────────────────────────────────────────────────────────────────

export const useSeriesStore = create<SeriesStore>()(
  persist(
    (set, get) => ({
      allSeries: [],
      visibleSeries: [],
      categories: [],
      activeCategory: '',
      watchlistIds: [],
      currentEpisode: {},
      watchProgress: {},
      hiddenCategoryIds: [],
      sortBy: 'added',
      categorySearch: '',
      newThisWeekCount: 0,
      status: 'idle',
      error: null,
      detailsSeriesId: null,
      reopenSeriesId: null,
      reopenSeason: null,
      detailsInfo: null,
      detailsStatus: 'idle',
      detailsError: null,
      detailsActiveSeason: 1,

      // ── Load series data ────────────────────────────────────────────────

      loadSeriesData: async () => {
        const creds = getXtreamCreds();
        if (!creds) {
          set({ status: 'error', error: 'Fonte Xtream não encontrada. Adicione uma fonte Xtream em Configurações.' });
          return;
        }

        set({ status: 'loading', error: null });

        try {
          const [rawCategories, allSeries] = await Promise.all([
            getSeriesCategories(creds),
            getSeriesStreams(creds),
          ]);

          {
            const validIds = new Set(allSeries.map(x => x.id));
            const pw = Object.fromEntries(Object.entries(get().watchProgress).filter(([id]) => validIds.has(id)));
            const pc = Object.fromEntries(Object.entries(get().currentEpisode).filter(([id]) => validIds.has(id)));
            if (Object.keys(pw).length !== Object.keys(get().watchProgress).length || Object.keys(pc).length !== Object.keys(get().currentEpisode).length) {
              set({ watchProgress: pw, currentEpisode: pc });
            }
          }
          const { watchlistIds, watchProgress, sortBy } = get();
          const catLabelMap = new Map(rawCategories.map(c => [c.id, c.label]));
      const labeledSeries = allSeries.map(sr => ({ ...sr, categoryLabel: catLabelMap.get(sr.categoryId ?? '') }));
      const ceMap = get().currentEpisode;
      const sorted = sortSeries(labeledSeries, sortBy).map(sr => {
        const ce = ceMap[sr.id];
        return ce ? { ...sr, currentEpisode: ce } : sr;
      });
          const categories = buildCategories(rawCategories, sorted, watchlistIds, watchProgress);
          const newThisWeekCount = sorted.filter(s => s.isNew).length;

          const persisted = get().activeCategory;
          const validCats = categories.map(c => c.id);
          const activeCategory =
            persisted && validCats.includes(persisted)
              ? persisted
              : (categories.find(c => c.id !== '__resume__' && c.id !== '__watchlist__')?.id ?? '');

          const visibleSeries = computeVisible(sorted, activeCategory, watchlistIds, watchProgress);

          set({
            allSeries: sorted,
            visibleSeries,
            categories,
            activeCategory,
            newThisWeekCount,
            status: 'ready',
            error: null,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Não foi possível carregar os dados';
          set({ status: 'error', error: msg });
        }
      },

      // ── Category ────────────────────────────────────────────────────────

      setActiveCategory: (id) => {
        set({ activeCategory: id });
        get()._recompute();
      },

      setCategorySearch: (q) => {
        set({ categorySearch: q });
        get()._recompute();
      },

      // ── Season selection (updates activeSeason on the series object) ────

      setActiveSeason: (seriesId, season) => {
        const updated = get().allSeries.map(s =>
          s.id === seriesId ? { ...s, activeSeason: season } : s
        );
        set({ allSeries: updated });
        get()._recompute();
      },

      // ── Sort ────────────────────────────────────────────────────────────

      cycleSort: () => {
        const current = get().sortBy;
        const idx = SORT_ORDER.indexOf(current);
        const next = SORT_ORDER[(idx + 1) % SORT_ORDER.length];
        const sorted = sortSeries(get().allSeries, next);
        set({ sortBy: next, allSeries: sorted });
        get()._recompute();
      },

      // ── Hidden categories ────────────────────────────────────────────────────
      toggleHiddenCategory: (id) => {
        const prev = get().hiddenCategoryIds;
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        set({ hiddenCategoryIds: next });
      },

      // ── Watchlist ───────────────────────────────────────────────────────

      toggleWatchlist: (id) => {
        const prev = get().watchlistIds;
        const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
        set({ watchlistIds: next });
        get()._updateSpecials();
        get()._recompute();
      },

      setWatchProgress: (id, progress) => {
        const next = { ...get().watchProgress, [id]: progress };
        set({ watchProgress: next });
        const g = get() as any;
        if (g._updateSpecials) g._updateSpecials();
      },

      clearResume: () => {
        set({ watchProgress: {}, currentEpisode: {} });
        const g = get() as any;
        if (g._updateSpecials) g._updateSpecials();
        get()._recompute();
      },

      clearWatchlist: () => {
        set({ watchlistIds: [] });
        const g = get() as any;
        if (g._updateSpecials) g._updateSpecials();
        get()._recompute();
      },

      setCurrentEpisode: (id, ep) => {
        const next = { ...get().currentEpisode, [id]: ep };
        set({ currentEpisode: next });
        const g = get() as any;
        if (g._updateSpecials) g._updateSpecials();
      },

      // ── Playback ────────────────────────────────────────────────────────

      playSeries: (id) => {
        const series = get().allSeries.find(s => s.id === id);
        if (!series) return;

        const creds = getXtreamCreds();
        if (!creds) return;

        // Fire-and-forget: fetch episode list then navigate to player
        void (async () => {
          try {
            const info = await getSeriesInfo(creds, series.seriesId ?? parseInt(id, 10));
            const seasonKeys = Object.keys(info.episodes ?? {}).sort((a, b) => Number(a) - Number(b));
            const firstSeasonKey = seasonKeys[0];
            if (!firstSeasonKey) {
              useToast.getState().show('Bu dizi için bölüm bulunamadı');
              return;
            }
            const firstEp = info.episodes[firstSeasonKey]?.[0];
            if (!firstEp) {
              useToast.getState().show('Bu dizi için bölüm bulunamadı');
              return;
            }

            const url = buildSeriesEpisodeUrl(creds, firstEp.id, firstEp.container_extension);
            const seasonNum = String(Number(firstSeasonKey)).padStart(2, '0');
            const epNum = String(firstEp.episode_num).padStart(2, '0');
            const epName = `${series.title} · S${seasonNum}·E${epNum}`;

            // Salvar creds no window para playNextEpisode
        (window as any).__ZUI_XTREAM_CREDS = creds;
        usePlayerStore.getState().setSource({
              id: `series-${id}-s${firstSeasonKey}e${firstEp.episode_num}`,
              name: epName,
              url,
              sourceType: 'xtream',
            });
            usePlayerStore.getState().setSeriesContext({
              seriesId: id,
              seasonKey: Number(firstSeasonKey),
              episodeIndex: 0,
              allEpisodes: info.episodes[firstSeasonKey],
              seriesTitle: series.title,
            });
            useUIStore.getState().navigate('player');
          } catch {
            useToast.getState().show('Não foi possível carregar o episódio');
          }
        })();
      },

      openSeriesDetails: async (id) => {
        const creds = getXtreamCreds();
        if (!creds) {
          useToast.getState().show('Xtream kaynağı bulunamadı');
          return;
        }
        const series = get().allSeries.find(s => s.id === id);
        const seriesId = series?.seriesId ?? parseInt(id, 10);

        set({ detailsSeriesId: id, detailsStatus: 'loading', detailsError: null, detailsInfo: null });

        try {
          const info = await getSeriesInfo(creds, seriesId);
          const seasonNums = Object.keys(info.episodes).map(Number).sort((a, b) => a - b);
          const firstSeason = seasonNums[0] ?? 1;
    const rs = get().reopenSeason;
    const keepSeason = rs != null && seasonNums.includes(rs) ? rs : firstSeason;
          set({ detailsInfo: info, detailsStatus: 'ready', detailsActiveSeason: keepSeason, reopenSeason: null });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Não foi possível carregar a lista de episódios';
          set({ detailsStatus: 'error', detailsError: msg });
        }
      },

      closeSeriesDetails: () => {
        set({ detailsSeriesId: null, detailsInfo: null, detailsStatus: 'idle', detailsError: null });
      },

      setDetailsActiveSeason: (season) => {
        set({ detailsActiveSeason: season });
      },

      playEpisode: (episode, seriesTitle, seasonKey) => {
        set({ reopenSeriesId: get().detailsSeriesId, reopenSeason: get().detailsSeriesId ? (get().detailsActiveSeason ?? null) : null });
        const creds = getXtreamCreds();
        if (!creds) return;

        (window as any).__ZUI_XTREAM_CREDS = creds;
        const url = buildSeriesEpisodeUrl(creds, episode.id, episode.container_extension);
        const seasonNum = String(Number(seasonKey)).padStart(2, '0');
        const epNum = String(episode.episode_num).padStart(2, '0');
        const name = `${seriesTitle} · S${seasonNum}·E${epNum}`;

        usePlayerStore.getState().setSource({
          id: `series-ep-${episode.id}`,
          name,
          url,
          sourceType: 'xtream',
        });
        // Salvar contexto para botao "Proximo Episodio"
        const detailsInfo = get().detailsInfo;
        if (detailsInfo && detailsInfo.episodes[String(seasonKey)]) {
          const allEps = detailsInfo.episodes[String(seasonKey)];
          const epIndex = allEps.findIndex(e => e.id === episode.id);
          usePlayerStore.getState().setSeriesContext({
            seriesId: get().detailsSeriesId ?? '',
            seasonKey: Number(seasonKey),
            episodeIndex: epIndex >= 0 ? epIndex : 0,
            allEpisodes: allEps,
            seriesTitle,
          });
        }
        const ceNow = get().currentEpisode[get().detailsSeriesId ?? ''];
        if (ceNow && ceNow.season === Number(seasonKey) && ceNow.episode === episode.episode_num && (ceNow.resumeSec ?? 0) > 10) {
          usePlayerStore.getState().setResumeSec(ceNow.resumeSec ?? 0);
        } else {
          usePlayerStore.getState().setResumeSec(0);
        }
        get().closeSeriesDetails();
        useUIStore.getState().navigate('player');
      },

      // ── Internal ────────────────────────────────────────────────────────

      _recompute: () => {
        const { allSeries, activeCategory, watchlistIds, watchProgress, categorySearch } = get();
        if (categorySearch.trim()) {
          const q = categorySearch.toLocaleLowerCase('tr');
          set({ visibleSeries: allSeries.filter(s => s.title.toLocaleLowerCase('tr').includes(q)) });
        } else {
          set({ visibleSeries: computeVisible(allSeries, activeCategory, watchlistIds, watchProgress) });
        }
      },

      _updateSpecials: () => {
        const { categories, watchlistIds, watchProgress } = get();
        const resumeCount = Object.values(watchProgress).filter(p => p > 0 && p < 0.99).length;
        const regulars = categories.filter(c => c.id !== '__resume__' && c.id !== '__watchlist__');
        const specials: SeriesCategory[] = [];
        specials.push({ id: '__resume__', label: 'Continuar Assistindo', count: resumeCount });
        specials.push({ id: '__watchlist__', label: 'Favoritos', count: watchlistIds.length });
        set({ categories: [...specials, ...regulars] });
      },
    }),

    {
      name: 'zui-series',
      partialize: (s) => ({
        watchlistIds: s.watchlistIds,
        currentEpisode: s.currentEpisode,
        watchProgress: s.watchProgress,
        hiddenCategoryIds: s.hiddenCategoryIds,
        sortBy: s.sortBy,
        activeCategory: s.activeCategory,
      }),
    }
  )
);
