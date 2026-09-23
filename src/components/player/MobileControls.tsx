// MobileControls — overlay de gestos mobile: volume (direita), brilho (esquerda), prox/anterior
import { useEffect, useRef, useState } from 'react';
import { CapacitorVideoPlayer } from 'capacitor-video-player';
import { usePlayerStore } from '@/state/playerStore';
import { useToast } from '@/components/ui/Toast';

const PLAYER_ID = 'exo-player';

// Brilho = overlay escuro CSS (1 - brilho)
let currentBrightness = 1;
let brightnessListeners: Array<(b: number) => void> = [];
function setBrightness(b: number) {
  currentBrightness = Math.max(0.1, Math.min(1, b));
  brightnessListeners.forEach((l) => l(currentBrightness));
}

export function useBrightness() {
  const [b, setB] = useState(currentBrightness);
  useEffect(() => {
    brightnessListeners.push(setB);
    return () => { brightnessListeners = brightnessListeners.filter((l) => l !== setB); };
  }, []);
  return b;
}

export function MobileControls({ onExit }: { onExit: () => void }) {
  const seriesContext = usePlayerStore((s) => s.seriesContext);
  const playNext = usePlayerStore((s) => s.playNextEpisode);
  const playPrev = usePlayerStore((s) => s.playPrevEpisode);
  const currentSource = usePlayerStore((s) => s.currentSource);
  const showToast = useToast((s) => s.show);
  const brightness = useBrightness();
  const [visible, setVisible] = useState(true);
  const [indicator, setIndicator] = useState<{ type: 'volume' | 'brightness'; value: number } | null>(null);
  const swipeRef = useRef<{ startY: number; startX: number; side: 'left' | 'right' | null; baseValue: number } | null>(null);
  const hideTimer = useRef<number | null>(null);
  const volRef = useRef(1);

  useEffect(() => {
    const hide = () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => { setVisible(false); setIndicator(null); }, 4000);
    };
    hide();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, []);

  const show = () => {
    setVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => { setVisible(false); setIndicator(null); }, 4000);
  };

  const applyVolume = async (v: number) => {
    v = Math.max(0, Math.min(1, v));
    volRef.current = v;
    try { await CapacitorVideoPlayer.setVolume({ playerId: PLAYER_ID, volume: v }); } catch { /* ignore */ }
    setIndicator({ type: 'volume', value: v });
    show();
  };

  const applyBrightness = (b: number) => {
    setBrightness(b);
    setIndicator({ type: 'brightness', value: b });
    show();
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const x = e.clientX;
    const side = x < window.innerWidth / 2 ? 'left' : 'right';
    swipeRef.current = {
      startY: e.clientY, startX: x, side,
      baseValue: side === 'right' ? volRef.current : currentBrightness,
    };
    show();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const s = swipeRef.current;
    if (!s || !s.side) return;
    const dy = s.startY - e.clientY;
    const scale = window.innerHeight * 0.6;
    const delta = dy / scale;
    if (s.side === 'right') applyVolume(s.baseValue + delta);
    else applyBrightness(s.baseValue + delta);
  };

  const handlePointerUp = () => {
    swipeRef.current = null;
    setTimeout(() => setIndicator(null), 600);
  };

  const handleTap = (e: React.MouseEvent) => {
    const x = e.clientX;
    if (x < window.innerWidth * 0.25 || x > window.innerWidth * 0.75) {
      show();
      return;
    }
    // Tap central: play/pause
    try { CapacitorVideoPlayer.isPlaying({ playerId: PLAYER_ID }).then((r: any) => {
      if (r?.result) CapacitorVideoPlayer.pause({ playerId: PLAYER_ID });
      else CapacitorVideoPlayer.play({ playerId: PLAYER_ID });
    }); } catch { /* ignore */ }
  };

  const goNext = () => {
    const res = playNext();
    if (res === 'no_more') showToast('⏭ Fim dos episódios');
    else showToast('⏭ Próximo episódio');
  };
  const goPrev = () => {
    const res = playPrev();
    if (res === 'no_more') showToast('⏮ Início da série');
    else showToast('⏮ Episódio anterior');
  };

  return (
    <>
      {/* Overlay de brilho (dimmer CSS) */}
      <div className="fixed inset-0 z-[970] pointer-events-none bg-black" style={{ opacity: 1 - brightness }} />

      {/* Indicador de volume/brilho */}
      {indicator && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[980] pointer-events-none bg-black/70 backdrop-blur px-5 py-3 rounded-2xl flex items-center gap-3 text-white">
          <span className="text-2xl">{indicator.type === 'volume' ? '🔊' : '☀️'}</span>
          <div className="w-32 h-2 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full bg-[#E8B567]" style={{ width: (indicator.value * 100) + '%' }} />
          </div>
          <span className="text-sm tabular-nums w-10 text-right">{Math.round(indicator.value * 100)}%</span>
        </div>
      )}

      {/* Zona de gestos */}
      <div
        className="fixed inset-0 z-[975]"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleTap}
      />

      {/* Controles visiveis */}
      <div className={`fixed inset-0 z-[978] pointer-events-none transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}>
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-auto flex items-center gap-3">
          <button onClick={onExit} className="w-10 h-10 rounded-full bg-black/50 text-white text-lg">←</button>
          <p className="flex-1 min-w-0 text-white text-sm font-semibold truncate">{currentSource?.name}</p>
        </div>

        {/* Bottom bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent pointer-events-auto">
          {seriesContext && (
            <div className="flex gap-2 mb-3">
              <button onClick={goPrev} className="flex-1 h-11 rounded-full bg-white/10 text-white text-xs font-bold">⏮ Anterior</button>
              <button onClick={goNext} className="flex-1 h-11 rounded-full bg-white/10 text-white text-xs font-bold">⏭ Próximo</button>
            </div>
          )}
          <div className="flex items-center gap-3 text-white text-[11px]">
            <span className="text-[9px] opacity-60">👆 deslize vertical · direita = volume · esquerda = brilho · toque central = play/pause</span>
          </div>
        </div>
      </div>
    </>
  );
}
