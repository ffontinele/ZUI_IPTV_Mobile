// PlaylistsScreen v2 — cards largos com Editar, mostrar senha, validade
import { useEffect, useState } from 'react';
import { useSourceStore } from '@/state/sourceStore';
import { usePlaylistStore } from '@/state/playlistStore';
import { useUIStore } from '@/state/uiStore';
import { useToast } from '@/components/ui/Toast';

export function PlaylistsScreen() {
  const sources = useSourceStore((s) => s.sources);
  const syncSource = useSourceStore((s) => s.syncSource);
  const channelsBySource = usePlaylistStore((s) => s.channelsBySource);
  const navigate = useUIStore((s) => s.navigate);
  const showToast = useToast((s) => s.show);

  const [showPass, setShowPass] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ url: '', username: '', password: '', name: '' });

  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.keyCode === 461) { e.preventDefault(); e.stopImmediatePropagation(); setEditing(null); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [editing]);

  const openEdit = (src: any) => {
    const cfg = src.config ?? {};
    const urlKey = ['url', 'host', 'server', 'baseUrl', 'serverUrl'].find((k) => typeof cfg[k] === 'string' && cfg[k]) ?? 'url';
    setEditing({ ...src, __urlKey: urlKey });
    setForm({
      url: cfg[urlKey] ?? src.url ?? '',
      username: cfg.username ?? '',
      password: cfg.password ?? '',
      name: src.name ?? '',
    });
  };

  const saveEdit = () => {
    if (!editing) return;
    const st = useSourceStore.getState() as any;
    const patch = {
      name: form.name || editing.name,
      config: { ...(editing.config ?? {}), [editing.__urlKey ?? 'url']: form.url, url: form.url, username: form.username, password: form.password },
    };
    if (typeof st.updateSource === 'function') st.updateSource(editing.id, patch);
    else if (typeof st.editSource === 'function') st.editSource(editing.id, patch);
    else useSourceStore.setState({ sources: st.sources.map((x: any) => (x.id === editing.id ? { ...x, ...patch } : x)) });
    setEditing(null);
    showToast('Lista atualizada');
    void syncSource(editing.id);
  };

  const toggleEnabled = (id: string) => {
    const st = useSourceStore.getState() as any;
    if (typeof st.toggleSource === 'function') st.toggleSource(id);
    else if (typeof st.setSourceEnabled === 'function') {
      const src = st.sources.find((x: any) => x.id === id);
      st.setSourceEnabled(id, !src?.enabled);
    } else {
      useSourceStore.setState({ sources: st.sources.map((x: any) => (x.id === id ? { ...x, enabled: !x.enabled } : x)) });
    }
  };

  const removeSource = (id: string) => {
    if (!window.confirm('Excluir esta lista? Os canais dela saem do aparelho.')) return;
    const st = useSourceStore.getState() as any;
    if (typeof st.removeSource === 'function') st.removeSource(id);
    else if (typeof st.deleteSource === 'function') st.deleteSource(id);
    else useSourceStore.setState({ sources: st.sources.filter((x: any) => x.id !== id) });
  };

  const expiryOf = (src: any): string => {
    const raw = src.expiresAt ?? src.expiry ?? src.expDate ?? src.config?.expDate ?? src.config?.exp_date ?? src.userInfo?.exp_date;
    if (!raw) return 'Ilimitada';
    const d = typeof raw === 'number' ? new Date(raw * 1000) : new Date(raw);
    if (isNaN(d.getTime())) return String(raw);
    return d.toLocaleDateString('pt-BR');
  };

  const enabledCount = sources.filter((s) => s.enabled).length;

  return (
    <div className="h-full overflow-y-auto bg-bg-base">
      <div className="p-4 pb-6 flex flex-col gap-4 max-w-3xl mx-auto">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#E8B567] mb-1">Listas</p>
            <h1 className="text-2xl font-bold text-white leading-tight">Listas de Reprodução</h1>
            <p className="text-xs text-text-secondary mt-1">{sources.length} lista(s) · {enabledCount} ativa(s)</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => useUIStore.getState().openModal('exit')}
              title="Reiniciar aplicativo"
              className="w-10 h-10 rounded-full bg-white/10 border border-[#E8B567]/40 flex items-center justify-center text-[#E8B567]"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v10" /><path d="M18.4 6.6a9 9 0 1 1-12.78 0" /></svg>
            </button>
            <button onClick={() => navigate('onboarding')} className="px-4 py-2.5 rounded-full bg-[#E8B567] text-[#161006] text-sm font-semibold">
              + Nova lista
            </button>
          </div>
        </header>

        {sources.length === 0 && (
          <div className="rounded-xl bg-bg-elevated border border-border-subtle p-6 text-center text-sm text-text-muted">
            Nenhuma lista ainda. Toque em "+ Nova lista" para começar.
          </div>
        )}

        <div className="flex flex-col gap-3">
          {sources.map((src: any) => (
            <div key={src.id} className="rounded-xl bg-bg-elevated border border-border-subtle p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-base font-bold text-white truncate flex-1 min-w-0">{src.name ?? src.config?.url ?? src.id}</p>
                <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold ${src.enabled ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/10 text-text-muted'}`}>
                  {src.enabled ? 'ATIVA' : 'INATIVA'}
                </span>
                <span className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#E8B567]/15 text-[#E8B567]">
                  ⏳ {expiryOf(src)}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap text-[12px] text-text-secondary">
                <span>{src.type === 'xtream' ? 'Xtream Codes' : 'M3U'}</span>
                <span>·</span>
                <span>{(channelsBySource[src.id] ?? []).length} canais</span>
                <span>·</span>
                <span>{src.syncedAt ? `atualizada ${new Date(src.syncedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}` : 'nunca sincronizada'}</span>
              </div>

              {src.type === 'xtream' && (
                <div className="rounded-lg bg-bg-hover/50 px-3 py-2 flex flex-col gap-1">
                  <p className="text-[11px] text-text-muted truncate">{(src.config?.url ?? src.config?.host ?? src.config?.server ?? '')}</p>
                  <p className="text-[11px] text-text-secondary">
                    👤 {src.config?.username ?? '—'} &nbsp;·&nbsp; 🔑 {showPass[src.id] ? (src.config?.password ?? '—') : '••••••••'}
                    <button onClick={() => setShowPass((m) => ({ ...m, [src.id]: !m[src.id] }))} className="ml-2 px-1.5 py-0.5 rounded bg-white/10 text-[11px]">
                      {showPass[src.id] ? '🙈' : '👁'}
                    </button>
                  </p>
                </div>
              )}
              {src.type !== 'xtream' && (
                <p className="text-[11px] text-text-muted truncate">{src.config?.url ?? ''}</p>
              )}

              <div className="flex flex-wrap gap-2">
                <button onClick={() => toggleEnabled(src.id)} className={`px-3.5 py-2 rounded-full text-xs font-semibold ${src.enabled ? 'bg-[#E8B567] text-[#161006]' : 'bg-bg-hover text-text-primary'}`}>
                  {src.enabled ? '✓ Ativa' : 'Ativar'}
                </button>
                <button onClick={() => void syncSource(src.id)} className="px-3.5 py-2 rounded-full bg-bg-hover text-text-primary text-xs font-semibold">
                  ⟳ Atualizar
                </button>
                <button onClick={() => openEdit(src)} className="px-3.5 py-2 rounded-full bg-bg-hover text-text-primary text-xs font-semibold">
                  ✏️ Editar
                </button>
                <button onClick={() => removeSource(src.id)} className="px-3.5 py-2 rounded-full bg-red-500/10 text-red-300 text-xs font-semibold">
                  🗑 Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <div className="fixed top-0 left-0 right-0 bottom-0 z-[950] bg-black/70 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl bg-bg-elevated border border-border-subtle p-4 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white">✏️ Editar lista</h3>
            <label className="text-[11px] text-text-muted">Nome</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg bg-bg-hover px-3 py-2.5 text-sm text-text-primary outline-none" />
            <label className="text-[11px] text-text-muted">URL do servidor</label>
            <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="w-full rounded-lg bg-bg-hover px-3 py-2.5 text-sm text-text-primary outline-none" />
            {editing.type === 'xtream' && (
              <>
                <label className="text-[11px] text-text-muted">Usuário</label>
                <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="w-full rounded-lg bg-bg-hover px-3 py-2.5 text-sm text-text-primary outline-none" />
                <label className="text-[11px] text-text-muted">Senha</label>
                <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded-lg bg-bg-hover px-3 py-2.5 text-sm text-text-primary outline-none" />
              </>
            )}
            <div className="flex gap-2 mt-1">
              <button onClick={saveEdit} className="flex-1 px-4 py-2.5 rounded-full bg-[#E8B567] text-[#161006] text-sm font-semibold">Salvar</button>
              <button onClick={() => setEditing(null)} className="flex-1 px-4 py-2.5 rounded-full bg-bg-hover text-text-primary text-sm font-semibold">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
