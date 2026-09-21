// HomeScreen — versão mobile-first (compacta, sem dimensões de TV)
import { useEffect, useState } from 'react';
import { useUIStore } from '@/state/uiStore';
import { usePlaylistStore } from '@/state/playlistStore';
import { useSourceStore } from '@/state/sourceStore';

function greeting(date: Date): string {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'Bom dia';
  if (h >= 12 && h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function HomeScreen() {
  const navigate = useUIStore((s) => s.navigate);
  const sources = useSourceStore((s) => s.sources);
  const channels = usePlaylistStore((s) => s.visibleChannels);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const activeSource = sources.find((s) => s.enabled);
  const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const cards = [
    { icon: '📺', title: 'TV ao Vivo', sub: `${channels.length} canais`, screen: 'channelList' as const },
    { icon: '🎬', title: 'Filmes', sub: 'Catálogo VOD', screen: 'movies' as const },
    { icon: '📼', title: 'Séries', sub: 'Temporadas e episódios', screen: 'series' as const },
    { icon: '⚙️', title: 'Configurações', sub: 'Listas e preferências', screen: 'settings' as const },
  ];

  return (
    <div className="h-full overflow-y-auto p-4 pb-6 flex flex-col gap-4 max-w-3xl mx-auto">
      <header>
        <p className="text-[11px] uppercase tracking-[0.2em] text-primary mb-1">Bem-vindo</p>
        <h1 className="text-3xl font-bold text-white leading-tight">{greeting(now)}.</h1>
        <p className="text-xs text-text-secondary mt-1 capitalize">{dateStr} · {timeStr}</p>
      </header>

      <div className="rounded-xl bg-bg-elevated border border-border-subtle p-4">
        <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Lista ativa</p>
        {activeSource ? (
          <>
            <p className="text-sm font-semibold text-text-primary truncate">{activeSource.name}</p>
            <p className="text-xs text-text-secondary mt-0.5">{channels.length} canais carregados</p>
          </>
        ) : (
          <>
            <p className="text-sm text-text-primary">Nenhuma lista configurada</p>
            <button
              onClick={() => navigate('settings')}
              className="mt-2 px-4 py-2 rounded-full bg-primary text-bg-base text-xs font-semibold"
            >
              Adicionar lista agora
            </button>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => (
          <button
            key={c.screen}
            onClick={() => navigate(c.screen)}
            className="rounded-xl bg-bg-elevated border border-border-subtle p-4 flex flex-col items-start gap-1.5 text-left active:bg-bg-hover transition-colors"
          >
            <span className="text-2xl leading-none">{c.icon}</span>
            <span className="text-sm font-semibold text-white">{c.title}</span>
            <span className="text-[11px] text-text-secondary">{c.sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
