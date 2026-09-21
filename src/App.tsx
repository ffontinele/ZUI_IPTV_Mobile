import { App as CapApp } from '@capacitor/app';
import { useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { VideoPlayer } from '@/components/player/VideoPlayer';
import { Onboarding } from '@/screens/Onboarding';
import { ChannelList } from '@/screens/ChannelList';
import { EPGScreen } from '@/screens/EPGScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { MoviesScreen } from '@/screens/MoviesScreen';
import { SeriesScreen } from '@/screens/SeriesScreen';
import { PlaylistsScreen } from '@/screens/PlaylistsScreen';
import { SplashScreen } from '@/components/SplashScreen';
import { ExitModal } from '@/components/common/ExitModal';
import { useUIStore } from '@/state/uiStore';
import { usePlaylistStore } from '@/state/playlistStore';
import { useSourceStore } from '@/state/sourceStore';
import { useEpgStore } from '@/state/epgStore';
import { epgCache } from '@/services/epgCache';
import { isEPGStale } from '@/services/epg.service';
import { useParentalStore } from '@/state/parentalStore';
import { useLogoCacheStore } from '@/state/logoCacheStore';
import { Toast } from '@/components/ui/Toast';
import { DownloadProgressBar } from '@/components/downloads/DownloadProgressBar';
import { useToast } from '@/components/ui/Toast';
import { useSupabaseRealtime } from '@/hooks/useSupabaseRealtime';
import { MobileShell } from '@/components/layout/MobileShell';

const SIX_HOURS = 6 * 60 * 60 * 1000;

function useCloudSync() {
  const { t } = useTranslation();
  const showToast = useToast((s) => s.show);
  const onSuccess = useCallback(() => {
    showToast(t('app.cloud_list_added'));
    usePlaylistStore.getState().setActiveSourceFilter('all');
    if (useUIStore.getState().currentScreen === 'onboarding') {
      usePlaylistStore.getState().loadAllFromDB()
        .then(() => useUIStore.getState().navigate('home'))
        .catch(console.error);
    }
  }, [showToast, t]);
  useSupabaseRealtime(onSuccess);
}

function useInitApp() {
  const navigate = useUIStore((s) => s.navigate);
  const loadAllFromDB = usePlaylistStore((s) => s.loadAllFromDB);
  const loadFromDB = useSourceStore((s) => s.loadFromDB);
  const loadEpgFromCache = useEpgStore((s) => s.loadFromCache);
  const syncEpg = useEpgStore((s) => s.syncEPG);

  useEffect(() => {
    (async () => {
      await loadFromDB();
      const sources = useSourceStore.getState().sources;

      if (sources.length === 0) {
        navigate('onboarding');
        return;
      }

      await loadAllFromDB();
      await loadEpgFromCache();
      await useParentalStore.getState().loadFromDB();
      await useLogoCacheStore.getState().loadFromDB();

      navigate('home');
      useUIStore.setState({ lastMainScreen: 'channelList' });

      const stale = sources.filter(
        (s) => s.enabled && (!s.syncedAt || Date.now() - s.syncedAt > SIX_HOURS)
      );
      for (const src of stale) {
        useSourceStore
          .getState()
          .syncSource(src.id)
          .catch((err: unknown) => console.warn(`Stale sync failed for ${src.id}:`, err));
      }

      if (await isEPGStale()) {
        const meta = await epgCache.getEPGMeta();
        if (meta?.url) {
          syncEpg(meta.url).catch(console.error);
        }
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export default function App() {
  const { t } = useTranslation();
  useInitApp();
  useCloudSync();
  const screen = useUIStore((s) => s.currentScreen);
  const modalOpen = useUIStore((s) => s.modalOpen);
  const closeModal = useUIStore((s) => s.closeModal);

  // BACK do Android (main.tsx converte backButton em keyCode 461)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.keyCode !== 461) return;
      const st = useUIStore.getState();
      if (st.modalOpen) { st.closeModal(); return; }
      if (st.currentScreen === 'player') { st.navigate(st.lastMainScreen); return; }
      if (st.currentScreen !== 'home') { st.navigate('home'); return; }
      st.openModal('exit');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const renderScreen = () => {
    switch (screen) {
      case 'loading':     return <SplashScreen />;
      case 'onboarding':  return <Onboarding />;
      case 'home':        return <HomeScreen />;
      case 'channelList': return <ChannelList />;
      case 'epg':         return <EPGScreen />;
      case 'settings':    return <SettingsScreen />;
      case 'movies':      return <MoviesScreen />;
      case 'series':      return <SeriesScreen />;
      case 'playlists':   return <PlaylistsScreen />;
      case 'player':      return <VideoPlayer />;
      default:            return <SplashScreen />;
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-bg-base">
      <MobileShell>
        {renderScreen()}
      </MobileShell>
      <DownloadProgressBar />
      <Toast />

      {modalOpen === 'exit' && (
        <ExitModal
          title={t('app.exit_title')}
          message={t('app.exit_message')}
          onExit={() => { try { CapApp.exitApp(); } catch { window.close(); } }}
          onReload={() => { window.location.reload(); }}
          onCancel={() => closeModal()}
        />
      )}
    </div>
  );
}
