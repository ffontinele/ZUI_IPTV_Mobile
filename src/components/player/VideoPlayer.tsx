import { useEffect } from 'react';
import { CapacitorVideoPlayer } from 'capacitor-video-player';
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
  const lastMainScreen = useUIStore((s) => s.lastMainScreen);

  const { pause, resume } = useFocusable({ focusKey: 'PLAYER_ROOT' });
  useEffect(() => {
    pause();
    return () => resume();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!currentSource) return;
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
  }, [currentSource]);

  useExoWatchProgress(true);

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
