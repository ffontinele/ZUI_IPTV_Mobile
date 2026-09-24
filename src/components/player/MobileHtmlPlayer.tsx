// MobileHtmlPlayer — player HTML5 com gestos: volume (dir), brilho (esq), seek por tap
import { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '@/state/playerStore';
import { useSeriesStore } from '@/state/seriesStore';
import { useMoviesStore } from '@/state/moviesStore';
import { useUIStore } from '@/state/uiStore';
import { useToast } from '@/components/ui/Toast';

function fmtT(s: number) {
  if (!isFinite(s) || isNaN(s)) return '--:--';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function MobileHtmlPlayer({ onFallback }: { onFallback: () => void }) {
  const currentSource = usePlayerStore((s) => s.currentSource);
  const seriesContext = usePlayerStore((s) => s.seriesContext);
  const playNext = usePlayerStore((s) => s.playNextEpisode);
  const playPrev = usePlayerStore((s) => s.playPrevEpisode);
  const navigate = useUIStore((s) => s.navigate);
  const lastMainScreen = useUIStore((s) => s.lastMainScreen);
  const showToast = useToast((s) => s.show);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [ind, setInd] = useState<{ t: 'vol' | 'bri'; v: number } | null>(null);
  const [bri, setBri] = useState(1);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [candIdx, setCandIdx] = useState(0);
  const swipe = useRef<{ y: number; side: 'l' | 'r'; base: number; moved: boolean } | null>(null);
  const hideT = useRef<number | null>(null);
  const lastSave = useRef(0);

  const url = candIdx === 0 ? (currentSource?.url ?? '') : (currentSource?.streamUrlCandidates?.[candIdx - 1] ?? '');

  const poke = () => {
    setVisible(true);
    if (hideT.current) clearTimeout(hideT.current);
    hideT.current = window.setTimeout(() => setVisible(false), 3500);
  };
  useEffect(() => { poke(); return () => { if (hideT.current) clearTimeout(hideT.current); }; }, []);

  const saveProgress = (time: number, duration: number) => {
    if (!currentSource || !duration || !isFinite(duration)) return;
    const ratio = time / duration;
    if (currentSource.id.startsWith('series-') && seriesContext) {
      useSeriesStore.getState().setWatchProgress(seriesContext.seriesId, ratio);
      const ce = useSeriesStore.getState().currentEpisode[seriesContext.seriesId];
      if (ce) useSeriesStore.getState().setCurrentEpisode(seriesContext.seriesId, { ...ce, resumeSec: Math.floor(time) });
    } else if (currentSource.id.startsWith('vod-')) {
      useMoviesStore.getState().setWatchProgress(currentSource.id.replace('vod-', ''), ratio);
    }
  };

  const applyVol = (v: number) => {
    const vv = Math.max(0, Math.min(1, v));
    if (videoRef.current) videoRef.current.volume = vv;
    setInd({ t: 'vol', v: vv });
    poke();
  };
  const applyBri = (b: number) => {
    const bb = Math.max(0.1, Math.min(1, b));
    setBri(bb);
    setInd({ t: 'bri', v: bb });
    poke();
  };

  const onDown = (e: React.PointerEvent) => {
    const side = e.clientX < window.innerWidth / 2 ? 'l' : 'r';
    swipe.current = {
      y: e.clientY, side, moved: false,
      base: side === 'r' ? (videoRef.current?.volume ?? 1) : bri,
    };
  };
  const onMove = (e: React.PointerEvent) => {
    const s = swipe.current;
    if (!s) return;
    const dy = s.y - e.clientY;
    if (Math.abs(dy) > 8) s.moved = true;
    if (!s.moved) return;
    const delta = dy / (window.innerHeight * 0.6);
    if (s.side === 'r') applyVol(s.base + delta);
    else applyBri(s.base + delta);
  };
  const onUp = (e: React.PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    setTimeout(() => setInd(null), 600);
    if (!s || s.moved) return;
    // Tap: bordas = seek ±10s, centro = play/pause
    const x = e.clientX / window.innerWidth;
    const v = videoRef.current;
    if (!v) return;
    if (x < 0.35) { v.currentTime = Math.max(0, v.currentTime - 10); showToast('⏪ -10s'); poke(); }
    else if (x > 0.65) { v.currentTime = Math.min(v.duration || 0, v.currentTime + 10); showToast('⏩ +10s'); poke(); }
    else {
      if (v.paused) { void v.play(); } else { v.pause(); }
      poke();
    }
  };

  if (!currentSource) return null;

  return (
    <div className="fixed inset-0 z-[970] bg-black touch-none" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <video
        key={url}
        ref={videoRef}
        src={url}
        className="w-full h-full object-contain"
        playsInline
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          setDur(v.duration || 0);
          const st = usePlayerStore.getState();
          if (st.resumeSec > 10) v.currentTime = st.resumeSec;
          else if (st.resumeRatio > 0.02 && st.resumeRatio < 0.95 && v.duration) v.currentTime = st.resumeRatio * v.duration;
          st.setResumeSec(0); st.setResumeRatio(0);
          void v.play().catch(() => {});
        }}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          setCur(v.currentTime);
          const now = Date.now();
          if (now - lastSave.current > 5000) { lastSave.current = now; saveProgress(v.currentTime, v.duration || 0); }
        }}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onError={() => {
          const cands = currentSource.streamUrlCandidates ?? [];
          if (candIdx < cands.length) { showToast('Tentando formato alternativo...'); setCandIdx(candIdx + 1); }
          else { showToast('Formato não suportado no player web — abrindo player nativo'); onFallback(); }
        }}
      />

      {/* Dimmer de brilho */}
      <div className="absolute inset-0 pointer-events-none bg-black" style={{ opacity: 1 - bri }} />

      {/* Indicador volume/brilho */}
      {ind && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none bg-black/70 backdrop-blur px-5 py-3 rounded-2xl flex items-center gap-3 text-white">
          <span className="text-2xl">{ind.t === 'vol' ? '🔊' : '☀️'}</span>
          <div className="w-32 h-2 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full bg-[#E8B567]" style={{ width: ind.v * 100 + '%' }} />
          </div>
          <span className="text-sm tabular-nums w-10 text-right">{Math.round(ind.v * 100)}%</span>
        </div>
      )}

      {/* Controles */}
      <div className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center gap-3">
          <button onClick={() => { saveProgress(videoRef.current?.currentTime ?? 0, videoRef.current?.duration ?? 0); navigate(lastMainScreen); }} className="w-10 h-10 rounded-full bg-black/50 text-white text-lg pointer-events-auto">←</button>
          <p className="flex-1 min-w-0 text-white text-sm font-semibold truncate">{currentSource.name}</p>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex flex-col gap-2">
          {seriesContext && (
            <div className="flex gap-2">
              <button onClick={() => { const r = playPrev(); if (r === 'no_more') showToast('⏮ Início da série'); }} className="flex-1 h-11 rounded-full bg-white/10 text-white text-xs font-bold pointer-events-auto">⏮ Anterior</button>
              <button onClick={() => { const r = playNext(); if (r === 'no_more') showToast('⏭ Fim dos episódios'); }} className="flex-1 h-11 rounded-full bg-white/10 text-white text-xs font-bold pointer-events-auto">⏭ Próximo</button>
            </div>
          )}
          <input
            type="range" min={0} max={dur || 0} value={cur} step={1}
            onChange={(e) => { const v = videoRef.current; if (v) v.currentTime = Number(e.target.value); }}
            className="w-full pointer-events-auto accent-[#E8B567]"
          />
          <div className="flex items-center justify-between text-white text-[11px] tabular-nums">
            <span>{fmtT(cur)} / {fmtT(dur)}</span>
            <button onClick={() => { const v = videoRef.current; if (!v) return; if (v.paused) void v.play(); else v.pause(); poke(); }} className="px-4 py-1.5 rounded-full bg-white/10 text-sm font-bold pointer-events-auto">
              {paused ? '▶' : '⏸'}
            </button>
            <span className="opacity-60 text-[9px]">deslize: dir=volume · esq=brilho · tap: bordas=±10s centro=play</span>
          </div>
        </div>
      </div>
    </div>
  );
}
