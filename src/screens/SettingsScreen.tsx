// SettingsScreen — mobile: cards uniformes, sem Downloads (aba propria), modais leves
import { useEffect, useState } from 'react';
import { useSettingsStore, LANGUAGE_LOCALES } from '@/state/settingsStore';
import { useParentalStore } from '@/state/parentalStore';
import { usePlaylistStore } from '@/state/playlistStore';
import { useMoviesStore } from '@/state/moviesStore';
import { useSeriesStore } from '@/state/seriesStore';

type Modal = null | 'lang' | 'subs' | 'hideTv' | 'hideMovies' | 'hideSeries';

export function SettingsScreen() {
  const [modal, setModal] = useState<Modal>(null);

  const settings = useSettingsStore((s) => s as any);
  const parental = useParentalStore((s) => s as any);

  const playlist = usePlaylistStore((s) => s as any);
  const movies = useMoviesStore((s) => s as any);
  const series = useSeriesStore((s) => s as any);

  // BACK fecha o modal primeiro
  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.keyCode === 461) { e.preventDefault(); e.stopImmediatePropagation(); setModal(null); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [modal]);

  const lang = settings.language ?? settings.locale ?? 'pt';
  const locales: any[] = Array.isArray(LANGUAGE_LOCALES)
    ? (LANGUAGE_LOCALES as any[]).map((l) => (typeof l === 'string' ? { code: l, label: l } : { code: l.code ?? l.id, label: l.label ?? l.name ?? l.code }))
    : Object.entries(LANGUAGE_LOCALES as any).map(([code, label]) => ({ code, label }));

  const setLang = (code: string) => {
    const st = useSettingsStore.getState() as any;
    if (typeof st.setLanguage === 'function') st.setLanguage(code);
    else if (typeof st.setLocale === 'function') st.setLocale(code);
    else useSettingsStore.setState({ language: code } as any);
    setModal(null);
  };

  const subsEnabled = settings.subtitleEnabled ?? settings.subtitlesEnabled ?? false;
  const subsSize = settings.subtitleSize ?? 'medium';
  const toggleSubs = () => {
    const st = useSettingsStore.getState() as any;
    if (typeof st.setSubtitleEnabled === 'function') st.setSubtitleEnabled(!subsEnabled);
    else if (typeof st.toggleSubtitles === 'function') st.toggleSubtitles();
    else useSettingsStore.setState({ subtitleEnabled: !subsEnabled } as any);
  };
  const setSubsSize = (sz: string) => {
    const st = useSettingsStore.getState() as any;
    if (typeof st.setSubtitleSize === 'function') st.setSubtitleSize(sz);
    else useSettingsStore.setState({ subtitleSize: sz } as any);
  };

  const parentalOn = parental.enabled ?? false;
  const toggleParental = () => {
    const st = useParentalStore.getState() as any;
    if (typeof st.toggle === 'function') st.toggle();
    else if (typeof st.setEnabled === 'function') st.setEnabled(!parentalOn);
    else useParentalStore.setState({ enabled: !parentalOn } as any);
  };

  const recentCount = (playlist.recentIds ?? []).length;
  const movieResumeCount = Object.values(movies.watchProgress ?? {}).filter((p: any) => p > 0.02 && p < 0.98).length;
  const seriesResumeCount = Object.keys(series.currentEpisode ?? {}).length;

  const Card = ({ icon, title, sub, onClick, right }: any) => (
    <button onClick={onClick} className="rounded-xl bg-bg-elevated border border-border-subtle p-4 min-h-[88px] flex items-center gap-3 text-left active:bg-bg-hover transition-colors">
      <span className="w-10 h-10 shrink-0 rounded-full bg-white/5 flex items-center justify-center text-lg">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-white leading-snug">{title}</span>
        <span className="block text-[11px] text-text-secondary mt-0.5 truncate">{sub}</span>
      </span>
      {right && <span className="shrink-0 text-[10px] font-semibold text-text-muted uppercase">{right}</span>}
    </button>
  );

  const Section = ({ title, children }: any) => (
    <section className="flex flex-col gap-3">
      <h2 className="text-[11px] uppercase tracking-[0.2em] text-text-muted">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </section>
  );

  return (
    <div className="h-full overflow-y-auto bg-bg-base">
      <div className="p-4 pb-6 flex flex-col gap-5 max-w-3xl mx-auto">
        <header>
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#E8B567] mb-1">Preferências</p>
          <h1 className="text-2xl font-bold text-white">Configurações</h1>
        </header>

        <Section title="Privacidade e visibilidade">
          <Card icon="🔒" title="Controle Parental" sub={parentalOn ? 'Ativado' : 'Desativado'} onClick={toggleParental} right={parentalOn ? 'ON' : 'OFF'} />
          <Card icon="📺" title="Ocultar categorias de TV" sub={`${(playlist.hiddenCategories?.size ?? 0)} oculta(s)`} onClick={() => setModal('hideTv')} />
          <Card icon="🎬" title="Ocultar categorias de Filmes" sub={`${(movies.hiddenCategoryIds ?? []).length} oculta(s)`} onClick={() => setModal('hideMovies')} />
          <Card icon="📼" title="Ocultar categorias de Séries" sub={`${(series.hiddenCategoryIds ?? []).length} oculta(s)`} onClick={() => setModal('hideSeries')} />
        </Section>

        <Section title="Idioma e legendas">
          <Card icon="🌐" title="Alterar Idioma" sub={locales.find((l) => l.code === lang)?.label ?? lang} onClick={() => setModal('lang')} />
          <Card icon="💬" title="Configurações de Legenda" sub={subsEnabled ? `Ativada · ${subsSize}` : 'Desativada'} onClick={() => setModal('subs')} />
        </Section>

        <Section title="Histórico e dados">
          <Card icon="🕘" title="Limpar canais recentes" sub={`${recentCount} canais`} onClick={() => usePlaylistStore.setState({ recentIds: [] } as any)} />
          <Card icon="🎬" title="Limpar progresso de Filmes" sub={`${movieResumeCount} em andamento`} onClick={() => movies.clearResume?.()} />
          <Card icon="📼" title="Limpar progresso de Séries" sub={`${seriesResumeCount} em andamento`} onClick={() => series.clearResume?.()} />
          <Card icon="⭐" title="Limpar favoritos de canais" sub={`${(playlist.favoriteIds ?? []).length} favoritos`} onClick={() => { usePlaylistStore.setState({ favoriteIds: [] } as any); }} />
        </Section>
      </div>

      {modal && (
        <div className="fixed top-0 left-0 right-0 bottom-0 z-[950] bg-black/70 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="w-full max-w-md max-h-[80vh] overflow-y-auto rounded-2xl bg-bg-elevated border border-border-subtle p-4 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            {modal === 'lang' && (
              <>
                <h3 className="text-sm font-bold text-white">Idioma do aplicativo</h3>
                {locales.map((l) => (
                  <button key={l.code} onClick={() => setLang(l.code)} className={`px-4 py-2.5 rounded-full text-sm font-medium text-left ${lang === l.code ? 'bg-[#E8B567] text-[#161006]' : 'bg-bg-hover text-text-primary'}`}>
                    {l.label}
                  </button>
                ))}
              </>
            )}
            {modal === 'subs' && (
              <>
                <h3 className="text-sm font-bold text-white">Legendas</h3>
                <button onClick={toggleSubs} className={`px-4 py-2.5 rounded-full text-sm font-semibold ${subsEnabled ? 'bg-[#E8B567] text-[#161006]' : 'bg-bg-hover text-text-primary'}`}>
                  {subsEnabled ? '✓ Ativadas' : 'Ativar legendas'}
                </button>
                {['small', 'medium', 'large'].map((sz) => (
                  <button key={sz} onClick={() => setSubsSize(sz)} className={`px-4 py-2.5 rounded-full text-sm text-left ${subsSize === sz ? 'bg-[#E8B567] text-[#161006]' : 'bg-bg-hover text-text-primary'}`}>
                    Tamanho: {sz === 'small' ? 'Pequeno' : sz === 'medium' ? 'Médio' : 'Grande'}
                  </button>
                ))}
              </>
            )}
            {modal === 'hideTv' && (
              <>
                <h3 className="text-sm font-bold text-white">Ocultar categorias de TV</h3>
                {(playlist.categories ?? []).map((c: any) => {
                  const hidden = playlist.hiddenCategories?.has?.(c.name) ?? false;
                  return (
                    <button key={c.name} onClick={() => playlist.toggleHiddenCategory?.(c.name)} className={`px-4 py-2.5 rounded-full text-sm text-left ${hidden ? 'bg-red-500/15 text-red-300' : 'bg-bg-hover text-text-primary'}`}>
                      {hidden ? '🚫' : '👁'} {c.name} · {c.count}
                    </button>
                  );
                })}
              </>
            )}
            {modal === 'hideMovies' && (
              <>
                <h3 className="text-sm font-bold text-white">Ocultar categorias de Filmes</h3>
                {(movies.categories ?? []).filter((c: any) => c.id !== '__resume__' && c.id !== '__favorites__').map((c: any) => {
                  const hidden = (movies.hiddenCategoryIds ?? []).includes(c.id);
                  return (
                    <button key={c.id} onClick={() => movies.toggleHiddenCategory?.(c.id)} className={`px-4 py-2.5 rounded-full text-sm text-left ${hidden ? 'bg-red-500/15 text-red-300' : 'bg-bg-hover text-text-primary'}`}>
                      {hidden ? '🚫' : '👁'} {c.label} · {c.count}
                    </button>
                  );
                })}
              </>
            )}
            {modal === 'hideSeries' && (
              <>
                <h3 className="text-sm font-bold text-white">Ocultar categorias de Séries</h3>
                {(series.categories ?? []).filter((c: any) => c.id !== '__resume__' && c.id !== '__favorites__').map((c: any) => {
                  const hidden = (series.hiddenCategoryIds ?? []).includes(c.id);
                  return (
                    <button key={c.id} onClick={() => series.toggleHiddenCategory?.(c.id)} className={`px-4 py-2.5 rounded-full text-sm text-left ${hidden ? 'bg-red-500/15 text-red-300' : 'bg-bg-hover text-text-primary'}`}>
                      {hidden ? '🚫' : '👁'} {c.label} · {c.count}
                    </button>
                  );
                })}
              </>
            )}
            <button onClick={() => setModal(null)} className="px-4 py-2.5 rounded-full bg-bg-hover text-text-primary text-sm font-semibold">
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
