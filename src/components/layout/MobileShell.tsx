import { useUIStore } from '@/state/uiStore';

interface MobileShellProps {
  children: React.ReactNode;
}

const ITEMS = [
  { id: 'home',        icon: '🏠', label: 'Início',   screen: 'home' as const },
  { id: 'channelList', icon: '📺', label: 'TV ao vivo', screen: 'channelList' as const },
  { id: 'movies',      icon: '🎬', label: 'Filmes',   screen: 'movies' as const },
  { id: 'series',      icon: '📼', label: 'Séries',   screen: 'series' as const },
  { id: 'settings',    icon: '⚙️', label: 'Ajustes',  screen: 'settings' as const },
];

export function MobileShell({ children }: MobileShellProps) {
  const currentScreen = useUIStore((s) => s.currentScreen);
  const navigate = useUIStore((s) => s.navigate);

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-bg-base">
      {/* Retrato: barra inferior | Paisagem: sidebar vertical fina */}
      <nav className="order-2 md:order-1 shrink-0 h-14 md:h-full md:w-24 bg-bg-elevated border-t md:border-t-0 md:border-r border-border-subtle flex flex-row md:flex-col items-stretch md:items-center md:py-4 md:gap-1 z-20">
        <div className="hidden md:flex flex-col items-center gap-0.5 pb-3 mb-1 border-b border-border-subtle w-full">
          <span className="text-sm font-bold text-primary leading-none">ZUI</span>
          <span className="text-[9px] text-text-muted">Mobile</span>
        </div>
        {ITEMS.map((item) => {
          const active = currentScreen === item.screen;
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.screen)}
              className={[
                'flex-1 md:flex-none md:w-full flex flex-col items-center justify-center gap-0.5 py-1 md:py-2.5 md:mx-2 md:rounded-lg transition-colors',
                active ? 'md:bg-primary/10' : '',
              ].join(' ')}
            >
              <span className={`text-lg md:text-xl leading-none ${active ? '' : 'opacity-70'}`}>{item.icon}</span>
              <span className={`text-[10px] md:text-[10px] leading-tight ${active ? 'text-primary font-semibold' : 'text-text-secondary'}`}>
                {item.label}
              </span>
              <span className={`md:hidden h-0.5 w-8 rounded-full ${active ? 'bg-primary' : 'bg-transparent'}`} />
            </button>
          );
        })}
      </nav>

      {/* Conteúdo */}
      <main className="order-1 md:order-2 flex-1 overflow-y-auto min-h-0 min-w-0">
        {children}
      </main>
    </div>
  );
}
