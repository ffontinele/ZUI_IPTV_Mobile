import { useUIStore } from '@/state/uiStore';
import { useTranslation } from 'react-i18next';

interface MobileShellProps {
  children: React.ReactNode;
}

export function MobileShell({ children }: MobileShellProps) {
  const { t } = useTranslation();
  const currentScreen = useUIStore((s) => s.currentScreen);
  const navigate = useUIStore((s) => s.navigate);

  const menuItems = [
    { id: 'home', label: t('nav.home', '🏠 Home'), screen: 'home' as const },
    { id: 'channelList', label: t('nav.live_tv', '📺 TV ao vivo'), screen: 'channelList' as const },
    { id: 'movies', label: t('nav.movies', '🎬 Filmes'), screen: 'movies' as const },
    { id: 'series', label: t('nav.series', '📼 Séries'), screen: 'series' as const },
    { id: 'settings', label: t('nav.settings', '⚙️ Configurações'), screen: 'settings' as const },
  ];

  const handleMenuClick = (screen: typeof menuItems[number]['screen']) => {
    navigate(screen);
  };

  return (
    <div className="flex h-full w-full bg-bg-base text-white">
      {/* Sidebar vertical à esquerda */}
      <aside className="w-[200px] bg-bg-elevated border-r border-border-subtle flex flex-col py-4 px-2">
        <div className="mb-6 px-2">
          <h1 className="text-xl font-bold text-primary">ZUI IPTV</h1>
          <p className="text-xs text-text-secondary mt-1">Mobile</p>
        </div>
        
        <nav className="flex-1 flex flex-col gap-2">
          {menuItems.map((item) => {
            const isActive = currentScreen === item.screen;
            return (
              <button
                key={item.id}
                onClick={() => handleMenuClick(item.screen)}
                className={`
                  w-full text-left px-4 py-3 rounded-lg transition-all
                  ${isActive 
                    ? 'bg-primary/10 text-primary border-l-4 border-primary' 
                    : 'text-text-primary hover:bg-bg-hover'
                  }
                `}
              >
                <span className="text-base font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto pt-4 border-t border-border-subtle">
          <p className="text-xs text-text-muted text-center">v0.9.5</p>
        </div>
      </aside>

      {/* Área de conteúdo à direita */}
      <main className="flex-1 overflow-auto bg-bg-base">
        {children}
      </main>
    </div>
  );
}
