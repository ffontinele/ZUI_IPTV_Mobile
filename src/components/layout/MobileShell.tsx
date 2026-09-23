import { useEffect } from 'react';
import { useUIStore } from '@/state/uiStore';

interface MobileShellProps { children: React.ReactNode; }

const ITEMS = [
  { id: 'home',        icon: '🏠', label: 'Início',     screen: 'home' as const },
  { id: 'channelList', icon: '📺', label: 'TV ao vivo', screen: 'channelList' as const },
  { id: 'movies',      icon: '🎬', label: 'Filmes',     screen: 'movies' as const },
  { id: 'series',      icon: '📼', label: 'Séries',     screen: 'series' as const },
  { id: 'favorites',   icon: '⭐', label: 'Favoritos',  screen: 'favorites' as const },
  { id: 'recents',     icon: '🕘', label: 'Recentes',   screen: 'recents' as const },
  { id: 'downloads',   icon: '⬇️', label: 'Downloads',  screen: 'downloads' as const },
  { id: 'playlists',   icon: '📋', label: 'Listas',     screen: 'playlists' as const },
  { id: 'settings',    icon: '⚙️', label: 'Ajustes',    screen: 'settings' as const },
];

export function MobileShell({ children }: MobileShellProps) {

  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as Element;
      if (t && t.closest && t.closest('button')) {
        try { (navigator as any).vibrate?.(12); } catch { /* ignore */ }
      }
    };
    document.addEventListener('click', h, true);
    return () => document.removeEventListener('click', h, true);
  }, []);
  const currentScreen = useUIStore((s) => s.currentScreen);
  const navigate = useUIStore((s) => s.navigate);

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-bg-base">
      <nav className="order-2 md:order-1 shrink-0 h-14 md:h-full md:w-24 bg-bg-elevated border-t md:border-t-0 md:border-r border-border-subtle flex flex-row md:flex-col items-stretch md:items-center md:py-3 md:gap-1 z-20 overflow-x-auto md:overflow-x-hidden md:overflow-y-auto no-scrollbar">
        <div className="hidden md:flex items-center justify-center gap-2 pb-2 mb-1 border-b border-border-subtle w-full shrink-0">
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-sm font-bold text-[#E8B567] leading-none">ZUI</span>
            <span className="text-[9px] text-text-muted">Mobile</span>
          </div>
          <button onClick={() => useUIStore.getState().openModal('exit')} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[#E8B567] shrink-0"><svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v10" /><path d="M18.4 6.6a9 9 0 1 1-12.78 0" /></svg></button>
        </div>
        {ITEMS.map((item) => {
          const active = currentScreen === item.screen;
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.screen)}
              className={[
                'flex-1 md:flex-none md:w-full shrink-0 flex flex-col items-center justify-center gap-0.5 py-1 md:py-2 md:mx-1.5 md:rounded-lg transition-colors',
                active ? 'md:bg-[#E8B567]/10' : '',
              ].join(' ')}
            >
              <span className={`text-base md:text-lg leading-none ${active ? '' : 'opacity-70'}`}>{item.icon}</span>
              <span className={`text-[9px] md:text-[10px] leading-tight whitespace-nowrap md:whitespace-normal text-center ${active ? 'text-[#E8B567] font-semibold' : 'text-text-secondary'}`}>
                {item.label}
              </span>
              <span className={`md:hidden h-0.5 w-7 rounded-full ${active ? 'bg-[#E8B567]' : 'bg-transparent'}`} />
            </button>
          );
        })}
        <button onClick={() => useUIStore.getState().openModal('exit')} className="md:hidden flex-1 shrink-0 flex flex-col items-center justify-center gap-0.5 py-1">
          <span className="flex items-center justify-center h-5 text-[#E8B567]"><svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v10" /><path d="M18.4 6.6a9 9 0 1 1-12.78 0" /></svg></span>
          <span className="text-[9px] text-text-secondary">Energia</span>
        </button>
      </nav>
      <main className="order-1 md:order-2 flex-1 overflow-y-auto min-h-0 min-w-0">
        {children}
      </main>
    </div>
  );
}
