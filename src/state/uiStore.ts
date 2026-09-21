import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Screen = 'loading' | 'onboarding' | 'home' | 'channelList' | 'epg' | 'settings' | 'player' | 'movies' | 'series' | 'playlists' | 'favorites' | 'downloads' | 'recents';

// Screens that can be "returned to" after leaving the player.
export type MainScreen = 'channelList' | 'epg' | 'movies' | 'series';

type UIStore = {
  currentScreen: Screen;
  /** Last non-player, non-overlay screen — BACK from player restores this. */
  lastMainScreen: MainScreen;
  modalOpen: 'exit' | null;
  history: Screen[];

  navigate: (s: Screen) => void;
  goBack: () => boolean;
  openModal: (m: 'exit') => void;
  closeModal: () => void;
};

const MAIN_SCREENS: MainScreen[] = ['channelList', 'epg', 'movies', 'series'];

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      currentScreen: 'loading',
      lastMainScreen: 'channelList',
      modalOpen: null,
      history: [],

      navigate: (s) =>
        set((state) => ({
          currentScreen: s,
          history: s === state.currentScreen ? state.history : [...state.history, state.currentScreen].slice(-32),
          lastMainScreen: (MAIN_SCREENS as string[]).includes(s)
            ? (s as MainScreen)
            : state.lastMainScreen,
        })),
      goBack: () => {
        const h = [...get().history];
        while (h.length) {
          const prev = h.pop() as Screen;
          if (prev === 'loading' || prev === 'onboarding' || prev === get().currentScreen) continue;
          set({ currentScreen: prev, history: h });
          return true;
        }
        set({ history: h });
        return false;
      },
      openModal: (m) => set({ modalOpen: m }),
      closeModal: () => set({ modalOpen: null }),
    }),
    {
      name: 'zui-ui',
      partialize: (state) => ({ lastMainScreen: state.lastMainScreen }),
    }
  )
);
