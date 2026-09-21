// ChannelList — mobile-first: busca + categorias + lista larga (sem painel de preview)
import { useMemo, useState } from 'react';
import { usePlaylistStore } from '@/state/playlistStore';
import { usePlayerStore } from '@/state/playerStore';
import { useUIStore } from '@/state/uiStore';

export function ChannelList() {
  const visibleChannels = usePlaylistStore((s) => s.visibleChannels);
  const categories = usePlaylistStore((s) => s.categories);
  const activeCategory = usePlaylistStore((s) => s.activeCategory);
  const setActiveCategory = usePlaylistStore((s) => s.setActiveCategory);
  const favoriteIds = usePlaylistStore((s) => s.favoriteIds);
  const toggleFavorite = usePlaylistStore((s) => s.toggleFavorite);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visibleChannels;
    return visibleChannels.filter((c) => c.name.toLowerCase().includes(q));
  }, [visibleChannels, query]);

  const play = (ch: any) => {
    usePlaylistStore.getState().selectChannel(ch.id);
    usePlaylistStore.getState().addToRecent(ch.id);
    usePlayerStore.getState().setSource({ id: ch.id, name: ch.name, url: ch.streamUrl });
    useUIStore.getState().navigate('player');
  };

  const chip = (on: boolean) =>
    `shrink-0 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${on ? 'bg-[#E8B567] text-[#161006]' : 'bg-bg-hover text-text-[#E8B567]'}`;

  return (
    <div className="flex flex-col h-full bg-bg-base">
      <div className="sticky top-0 z-10 bg-bg-elevated border-b border-border-subtle p-3 flex flex-col gap-2">
        <div className="flex items-center gap-2 rounded-full bg-bg-hover px-4 py-2">
          <span className="text-sm">🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar canal..."
            className="flex-1 bg-transparent outline-none text-sm text-text-[#E8B567] placeholder:text-text-muted"
          />
        </div>
        <div className="flex overflow-x-auto gap-2 no-scrollbar">
          <button onClick={() => setActiveCategory(null)} className={chip(activeCategory === null)}>Todos</button>
          {categories.map((c) => (
            <button key={c.name} onClick={() => setActiveCategory(c.name)} className={chip(activeCategory === c.name)}>
              {c.name} · {c.count}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.map((ch: any) => (
          <div
            key={ch.id}
            onClick={() => play(ch)}
            className="flex items-center gap-3 px-3 py-2.5 border-b border-border-subtle/40 active:bg-bg-hover cursor-pointer"
          >
            {ch.logo ? (
              <img src={ch.logo} alt="" className="w-9 h-9 rounded bg-white/5 object-contain shrink-0" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <span className="w-9 h-9 rounded bg-white/5 flex items-center justify-center text-sm shrink-0">📺</span>
            )}
            <span className="flex-1 text-sm text-text-[#E8B567] truncate">{ch.name}</span>
            <button
              onClick={(e) => { e.stopPropagation(); toggleFavorite(ch.id); }}
              className="px-2 py-1 text-base"
            >
              {favoriteIds.includes(ch.id) ? '⭐' : '☆'}
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="flex items-center justify-center h-32 text-text-muted text-sm">
            Nenhum canal encontrado
          </div>
        )}
      </div>
    </div>
  );
}
