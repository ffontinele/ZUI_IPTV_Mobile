import { useEffect, useState } from 'react';
import { CapacitorVideoPlayer } from 'capacitor-video-player';
import { Capacitor } from '@capacitor/core';
import { useSeriesStore } from '@/state/seriesStore';
import { useMoviesStore } from '@/state/moviesStore';
import { NativePlayer, nativePlayerFlag } from '@/services/nativePlayer';
import { buildSeriesEpisodeUrl } from '@/services/series.service';
import type { PluginListenerHandle } from '@capacitor/core';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { usePlayerStore } from '@/state/playerStore';
import { useUIStore } from '@/state/uiStore';
import { useExoWatchProgress } from '@/hooks/useExoWatchProgress';
import { ErrorOverlay } from './ErrorOverlay';
import { Spinner } from '@/components/common/Spinner';
import type { PlaybackAttempt } from '@/types/player';

const PLAYER_ID = 'exo-player';

export function VideoPlayer() {
  const playerState = usePlayerStore((s) => s.state);
  const error = usePlayerStore((s) => s.error);
  const currentSource = usePlayerStore((s) => s.currentSource);
  const setState = usePlayerStore((s) => s.setState);
  const setError = usePlayerStore((s) => s.setError);

  const navigate = useUIStore((s) => s.navigate);
  const [useJeep, setUseJeep] = useState(false);
  const lastMainScreen = useUIStore((s) => s.lastMainScreen);

  const { pause, resume } = useFocusable({ focusKey: 'PLAYER_ROOT' });
  useEffect(() => {
    pause();
    return () => resume();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!currentSource) return;
    if (!useJeep && nativePlayerFlag() && Capacitor.isNativePlatform()) return;
    setState('loading');
    let cancelled = false;
    const listeners: PluginListenerHandle[] = [];

    const seekResume = async () => {
      const st = usePlayerStore.getState();
      const ratio = st.resumeRatio;
      const sec = st.resumeSec;
      try {
        if (ratio > 0.02 && ratio < 0.95) {
          const d: any = await CapacitorVideoPlayer.getDuration({ playerId: PLAYER_ID });
          const dur = typeof d?.value === 'number' ? d.value : 0;
          if (dur > 0) {
            const target = ratio * dur;
            if (target > 5 && target < dur - 5) {
              await CapacitorVideoPlayer.setCurrentTime({ playerId: PLAYER_ID, seektime: target });
            }
          }
        } else if (sec > 10) {
          await CapacitorVideoPlayer.setCurrentTime({ playerId: PLAYER_ID, seektime: sec });
        }
      } catch (e) {
        console.warn('[ExoPlayer] seek resume falhou:', e);
      }
      st.setResumeRatio(0);
      st.setResumeSec(0);
    };

    (async () => {
      try {
        listeners.push(await (CapacitorVideoPlayer as any).addListener('jeepCapVideoPlayerReady', () => {
          void seekResume();
        }));
        listeners.push(await (CapacitorVideoPlayer as any).addListener('jeepCapVideoPlayerExit', () => {
          if (cancelled) return;
          // Dispara Backspace virtual: o RemoteRouter trata a saida
          // e reabre o modal de episodios de series se necessario
          const fire = (target: EventTarget) => {
            const e: any = new KeyboardEvent('keydown', {
              key: 'Backspace', code: 'Backspace', bubbles: true, cancelable: true,
            } as any);
            try {
              Object.defineProperty(e, 'keyCode', { value: 461 });
              Object.defineProperty(e, 'which', { value: 461 });
            } catch { /* ignora */ }
            target.dispatchEvent(e);
          };
          fire(window);
          fire(document);
        }));
        listeners.push(await (CapacitorVideoPlayer as any).addListener('jeepCapVideoPlayerEnded', () => {
          usePlayerStore.getState().playNextEpisode();
        }));

        await CapacitorVideoPlayer.initPlayer({
          mode: 'fullscreen',
          url: currentSource.url,
          playerId: PLAYER_ID,
          headers: currentSource.headers || {},
          exitOnEnd: false,
          showControls: true,
          chromecast: false,
          title: currentSource.name || '',
        });
        if (!cancelled) setState('playing');
      } catch (err) {
        console.error('[ExoPlayer] erro:', err);
        if (!cancelled) {
          setError({ code: 'fatal', message: 'ExoPlayer falhou: ' + (err as Error).message, recoverable: false });
          setState('error');
        }
      }
    })();

    return () => {
      cancelled = true;
      listeners.forEach((h) => { h.remove(); });
      CapacitorVideoPlayer.stopAllPlayers().catch(() => {});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSource, useJeep]);

  useExoWatchProgress(true);

  useEffect(() => {
    if (!currentSource || useJeep) return;
    if (!Capacitor.isNativePlatform() || !nativePlayerFlag()) return;
    let cancelled = false;
    const st0 = usePlayerStore.getState();
    const resume = st0.resumeSec > 10 ? st0.resumeSec : 0;
    const savePos = (pos: number, dur: number) => {
      if (!dur || !isFinite(dur)) return;
      if (pos < 10) return; // so salva apos 10s (evita lixo e nao some dos Recentes)
      const ratio = pos / dur;
      const id = currentSource.id;
      if (id.startsWith('series-')) {
        const ctx = usePlayerStore.getState().seriesContext;
        if (ctx) {
          useSeriesStore.getState().setWatchProgress(ctx.seriesId, ratio);
          const ep = ctx.allEpisodes?.[ctx.episodeIndex];
          useSeriesStore.getState().setCurrentEpisode(ctx.seriesId, {
            season: ctx.seasonKey,
            episode: ep?.episode_num ?? 0,
            title: ep?.title ?? '',
            remaining: '',
            resumeSec: Math.floor(pos),
          });
        }
      } else if (id.startsWith('vod-')) {
        useMoviesStore.getState().setWatchProgress(id.replace('vod-', ''), ratio);
        useMoviesStore.getState().setResumeSecMovie(id.replace('vod-', ''), Math.floor(pos));
      }
    };
    (async () => {
      try {
        const res = await NativePlayer.play({ url: currentSource.url, title: currentSource.name, resumeSec: resume, resumeRatio: st0.resumeRatio, hasSeries: !!st0.seriesContext });
        if (cancelled) return;
        savePos(res?.position ?? 0, res?.duration ?? 0);
        usePlayerStore.getState().setResumeSec(0);
        navigate(useUIStore.getState().lastMainScreen);
      } catch {
        if (!cancelled) setUseJeep(true);
      }
    })();
    const sub = NativePlayer.addListener('episodeNav', (d: any) => {
      const st = usePlayerStore.getState();
      const ctx = st.seriesContext;
      if (!ctx) return;
      const idx = ctx.episodeIndex + (d?.dir === 'next' ? 1 : -1);
      const eps = ctx.allEpisodes ?? [];
      if (idx < 0 || idx >= eps.length) return;
      const ep = eps[idx];
      const creds = (window as any).__ZUI_XTREAM_CREDS;
      if (!creds) return;
      const url = buildSeriesEpisodeUrl(creds, ep.id, ep.container_extension ?? 'mp4');
      const sn = String(Number(ctx.seasonKey)).padStart(2, '0');
      const en = String(ep.episode_num).padStart(2, '0');
      st.setSeriesContext({ ...ctx, episodeIndex: idx });
      st.setResumeSec(0);
      useSeriesStore.getState().setCurrentEpisode(ctx.seriesId, { season: ctx.seasonKey, episode: ep.episode_num, title: ep.title ?? '', remaining: '', resumeSec: 0 });
      void NativePlayer.switchUrl({ url, title: `${ctx.seriesTitle} · S${sn}·E${en}` });
    });
    const subProg = NativePlayer.addListener('progress', (d: any) => {
      savePos(d?.position ?? 0, d?.duration ?? 0);
    });
    return () => { cancelled = true; sub.remove(); subProg.remove(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSource, useJeep]);

  const handleBack = () => {
    setError(null);
    navigate(lastMainScreen);
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {playerState === 'loading' && <Spinner />}
      {error && !error.recoverable && (
        <ErrorOverlay message={error.message} attempts={[] as PlaybackAttempt[]} onBack={handleBack} />
      )}
    </div>
  );
}
