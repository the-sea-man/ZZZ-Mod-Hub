import { StateCreator } from 'zustand';
import type { AppState, TutorialId, AppNotification, UserStats } from './types';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import {
  safeGetJSON,
  safeSetJSON,
  safeGetInt,
  safeGetBool,
  safeGetString,
} from '../../utils/storage';
import { playQuickSnapSuccessSound, playQuickSnapErrorSound } from '../../utils/audio';

export interface StatsAchievementsSlice {
  activeTutorial: TutorialId | null;
  clearTutorials: () => void;
  executeQuickSnap: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  hasSeenAllAchievementsConfetti: boolean;
  hudKey: string;
  hudMenuMode: 'interactive' | 'classic';
  incrementStat: (stat: keyof UserStats, amount?: number) => void;
  isQuickSnapping: boolean;
  lastReadNotificationTimestamp: number;
  markNotificationRead: (id: string) => void;
  markNotificationsRead: () => void;
  markTutorialSeen: (id: TutorialId) => void;
  notifications: AppNotification[];
  quickSnapperAutoReload: boolean;
  quickSnapperCropH: number;
  quickSnapperCropW: number;
  quickSnapperCropX: number;
  quickSnapperCropY: number;
  quickSnapperEnabled: boolean;
  quickSnapperHotkey: string;
  readNotifications: string[];
  setActiveTutorial: (id: TutorialId | null) => void;
  setHasSeenAllAchievementsConfetti: (val: boolean) => void;
  setHudKey: (key: string) => void;
  setHudMenuMode: (mode: 'interactive' | 'classic') => void;
  setQuickSnapperAutoReload: (enabled: boolean) => void;
  setQuickSnapperCrop: (x: number, y: number, w: number, h: number) => void;
  setQuickSnapperEnabled: (enabled: boolean) => void;
  setQuickSnapperHotkey: (hotkey: string) => void;
  tutorialsSeen: Record<string, boolean>;
  userStats: UserStats;
}

export const createStatsAchievementsSlice: StateCreator<
  AppState,
  [],
  [],
  StatsAchievementsSlice
> = (set, get) => ({
  activeTutorial: (safeGetString('activeTutorial', '') || null) as TutorialId | null,

  clearTutorials: () => {
    localStorage.removeItem('tutorialsSeen');
    localStorage.removeItem('hasSeenAllAchievementsConfetti');
    localStorage.removeItem('activeTutorial');
    set({ tutorialsSeen: {}, hasSeenAllAchievementsConfetti: false, activeTutorial: null });
  },

  executeQuickSnap: async () => {
    if (get().isQuickSnapping) return;
    set({ isQuickSnapping: true });

    try {
      const state = get();
      if (!state.quickSnapperEnabled) return;

      const targetCategoryName = state.selectedCategory;
      if (!targetCategoryName) {
        playQuickSnapErrorSound();
        state.showToast('Quick Snapper: Please select a character in the Library first.');
        return;
      }

      const category = state.categories.find((c) => c.category_name === targetCategoryName);
      if (!category) {
        playQuickSnapErrorSound();
        state.showToast(`Quick Snapper: Character '${targetCategoryName}' not found.`);
        return;
      }

      const enabledModIndex = category.mods.findIndex((m) => m.is_enabled);
      if (enabledModIndex === -1) {
        playQuickSnapErrorSound();
        state.showToast(`Quick Snapper: No enabled mod found in ${targetCategoryName}.`);
        return;
      }

      const enabledMod = category.mods[enabledModIndex];

      // 1. Take and crop screenshot of currently enabled mod
      await invoke<string>('take_and_crop_screenshot', {
        modPath: enabledMod.full_path,
        x: state.quickSnapperCropX,
        y: state.quickSnapperCropY,
        width: state.quickSnapperCropW,
        height: state.quickSnapperCropH,
      });
      state.incrementStat('quickSnapsTaken');

      // 2. Find next mod without preview
      let nextModToEnable: typeof enabledMod | null = null;
      for (let i = enabledModIndex + 1; i < category.mods.length; i++) {
        if (!category.mods[i].preview_url) {
          nextModToEnable = category.mods[i];
          break;
        }
      }
      if (!nextModToEnable) {
        for (let i = 0; i < enabledModIndex; i++) {
          if (!category.mods[i].preview_url) {
            nextModToEnable = category.mods[i];
            break;
          }
        }
      }

      // 3. Disable currently enabled mod
      const disabledPath = await invoke<string>('toggle_mod', {
        modPath: enabledMod.full_path,
        enable: false,
      });

      // 4. Enable next mod without preview (if found)
      let enabledPath: string | null = null;
      if (nextModToEnable && nextModToEnable.full_path !== enabledMod.full_path) {
        enabledPath = await invoke<string>('toggle_mod', {
          modPath: nextModToEnable.full_path,
          enable: true,
        });
      }

      // 5. Send single F10 hotreload if game is running and auto-reload is enabled
      if (state.quickSnapperAutoReload && state.gameIsRunning && state.hotreloadEnabled) {
        await invoke('focus_and_send_f10').catch(console.error);
        state.incrementStat('hotReloadsTriggered');
      }

      // 6. Instantly update Zustand categories in-place without heavy disk / INI scans
      const normOld1 = enabledMod.full_path.replace(/\\/g, '/');
      const normNew1 = disabledPath.replace(/\\/g, '/');
      const normOld2 = nextModToEnable ? nextModToEnable.full_path.replace(/\\/g, '/') : null;
      const normNew2 = enabledPath ? enabledPath.replace(/\\/g, '/') : null;

      // Because enabledMod was renamed to disabledPath on disk, preview.png now lives in disabledPath
      const actualPreviewFilePath = `${disabledPath.replace(/[/\\]+$/, '')}/preview.png`;
      const previewUrl = `${convertFileSrc(actualPreviewFilePath)}?t=${Date.now()}`;

      const updatedCategories = get().categories.map((cat) => {
        if (cat.category_name !== targetCategoryName) return cat;
        return {
          ...cat,
          mods: cat.mods.map((m) => {
            const mNorm = m.full_path.replace(/\\/g, '/');
            if (mNorm === normOld1) {
              return {
                ...m,
                is_enabled: false,
                full_path: normNew1,
                preview_url: previewUrl,
                thumbnail_url: undefined,
              };
            }
            if (normOld2 && mNorm === normOld2 && normNew2) {
              const nextPreview = m.preview_url
                ? `${convertFileSrc(`${normNew2.replace(/[/\\]+$/, '')}/preview.png`)}?t=${Date.now()}`
                : undefined;
              return {
                ...m,
                is_enabled: true,
                full_path: normNew2,
                ...(nextPreview ? { preview_url: nextPreview, thumbnail_url: undefined } : {}),
              };
            }
            return m;
          }),
        };
      });
      set({ categories: updatedCategories });

      // 7. Update in-game HUD asynchronously if enabled
      if (localStorage.getItem('hud_enabled') === 'true') {
        const activeModPaths = updatedCategories.flatMap((cat) =>
          cat.mods.filter((mod) => mod.is_enabled).map((mod) => mod.full_path)
        );
        invoke('generate_in_game_ui', {
          rootPath: state.modsPath,
          activeModPaths,
          hudKey: state.hudKey,
          menuMode: state.hudMenuMode,
        }).catch(console.error);
      }

      // 8. Success audio cue and non-blocking toast
      playQuickSnapSuccessSound();
      state.showToast(
        nextModToEnable && nextModToEnable.full_path !== enabledMod.full_path
          ? `Captured '${enabledMod.name}' → Enabled '${nextModToEnable.name}'`
          : `Captured '${enabledMod.name}' — All mods in ${targetCategoryName} have previews!`
      );
    } catch (e: any) {
      console.error('Quick Snapper failed:', e);
      playQuickSnapErrorSound();
      get().showToast(`Quick Snapper error: ${e}`);
    } finally {
      set({ isQuickSnapping: false });
    }
  },

  fetchNotifications: async () => {
    try {
      const rawBase = get().dbUrl.trim().replace(/\/+$/, '');
      const notificationsUrl = `${rawBase}/notifications.json`;

      const res = await fetch(notificationsUrl);
      if (res.ok) {
        const notifications = await res.json();
        if (Array.isArray(notifications)) {
          set({ notifications });
        }
      }
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
    }
  },

  hasSeenAllAchievementsConfetti: safeGetBool('hasSeenAllAchievementsConfetti', false),

  hudKey: safeGetString('hudKey', 'h'),

  hudMenuMode: (() => {
    const raw = safeGetString('hudMenuMode', 'classic');
    if (raw === 'interactive') {
      const isDevTesting =
        import.meta.env.DEV || localStorage.getItem('dev_enable_interactive_hud') === 'true';
      return isDevTesting ? 'interactive' : 'classic';
    }
    return 'classic';
  })(),

  incrementStat: (stat, amount = 1) => {
    const currentVal = get().userStats[stat] ?? 0;
    const newStats = { ...get().userStats, [stat]: currentVal + amount };
    safeSetJSON('userStats', newStats);
    set({ userStats: newStats });
  },

  isQuickSnapping: false,

  lastReadNotificationTimestamp: safeGetInt('lastReadNotificationTimestamp', 0),

  markNotificationRead: (id: string) => {
    const { readNotifications } = get();
    const strId = String(id).trim();
    if (!strId) return;
    const existing = (readNotifications || []).map((i) => String(i).trim());
    if (!existing.includes(strId)) {
      const newRead = [...existing, strId];
      safeSetJSON('readNotifications', newRead);
      set({ readNotifications: newRead });
    }
  },

  markNotificationsRead: () => {
    const { notifications, readNotifications } = get();
    const notifIds = (notifications || []).map((n) => String(n.id).trim()).filter(Boolean);
    const existing = (readNotifications || []).map((id) => String(id).trim()).filter(Boolean);
    const newRead = Array.from(new Set([...existing, ...notifIds]));
    const now = Date.now();
    safeSetJSON('readNotifications', newRead);
    localStorage.setItem('lastReadNotificationTimestamp', now.toString());
    set({ readNotifications: newRead, lastReadNotificationTimestamp: now });
  },

  markTutorialSeen: (id) => {
    const newSeen = { ...get().tutorialsSeen, [id]: true };
    safeSetJSON('tutorialsSeen', newSeen);
    set({ tutorialsSeen: newSeen });
  },

  notifications: [],

  quickSnapperAutoReload: safeGetBool('quickSnapperAutoReload', true),

  quickSnapperCropH: safeGetInt('quickSnapperCropH', 1000),

  quickSnapperCropW: safeGetInt('quickSnapperCropW', 800),

  quickSnapperCropX: safeGetInt('quickSnapperCropX', 860),

  quickSnapperCropY: safeGetInt('quickSnapperCropY', 100),

  quickSnapperEnabled: safeGetBool('quickSnapperEnabled', false),

  quickSnapperHotkey: safeGetString('quickSnapperHotkey', 'Alt+Shift+S'),

  readNotifications: safeGetJSON<string[]>('readNotifications', []),

  setActiveTutorial: (id) => {
    if (id) {
      localStorage.setItem('activeTutorial', id);
    } else {
      localStorage.removeItem('activeTutorial');
    }
    set({ activeTutorial: id });
  },

  setHasSeenAllAchievementsConfetti: (val) => {
    localStorage.setItem('hasSeenAllAchievementsConfetti', val ? 'true' : 'false');
    set({ hasSeenAllAchievementsConfetti: val });
  },

  setHudKey: (key: string) => {
    localStorage.setItem('hudKey', key);
    set({ hudKey: key });
  },

  setHudMenuMode: (mode: 'interactive' | 'classic') => {
    const isDevTesting =
      import.meta.env.DEV || localStorage.getItem('dev_enable_interactive_hud') === 'true';
    const finalMode = !isDevTesting && mode === 'interactive' ? 'classic' : mode;
    localStorage.setItem('hudMenuMode', finalMode);
    set({ hudMenuMode: finalMode });
  },

  setQuickSnapperAutoReload: (enabled: boolean) => {
    localStorage.setItem('quickSnapperAutoReload', enabled ? 'true' : 'false');
    set({ quickSnapperAutoReload: enabled });
  },

  setQuickSnapperCrop: (x: number, y: number, w: number, h: number) => {
    localStorage.setItem('quickSnapperCropX', x.toString());
    localStorage.setItem('quickSnapperCropY', y.toString());
    localStorage.setItem('quickSnapperCropW', w.toString());
    localStorage.setItem('quickSnapperCropH', h.toString());
    set({ quickSnapperCropX: x, quickSnapperCropY: y, quickSnapperCropW: w, quickSnapperCropH: h });
  },

  setQuickSnapperEnabled: (enabled: boolean) => {
    localStorage.setItem('quickSnapperEnabled', enabled ? 'true' : 'false');
    set({ quickSnapperEnabled: enabled });
  },

  setQuickSnapperHotkey: (hotkey: string) => {
    localStorage.setItem('quickSnapperHotkey', hotkey);
    set({ quickSnapperHotkey: hotkey });
  },

  tutorialsSeen: safeGetJSON<Record<string, boolean>>('tutorialsSeen', {}),

  userStats: {
    modsInstalledLocal: 0,
    modsInstalledGB: 0,
    keybindsChanged: 0,
    modsDeleted: 0,
    quickSnapsTaken: 0,
    gameLaunches: 0,
    randomizeCount: 0,
    modsToggled: 0,
    filtersUsed: 0,
    cloudSyncs: 0,
    notesWritten: 0,
    modsInstalledDragDrop: 0,
    batchOpsPerformed: 0,
    globalSearchesUsed: 0,
    smartDownloadsUsed: 0,
    hotReloadsTriggered: 0,
    modsUpdated: 0,
    conflictsViewed: 0,
    previews3d: 0,
    modsSplit: 0,
    imagesCropped: 0,
    backupsExported: 0,
    warningsFixed: 0,
    autoSortsUsed: 0,
    tagsEdited: 0,
    huntingModeUsed: 0,
    categoryMapped: 0,
    languagePacksUsed: 0,
    customColorPicked: 0,
    konamiCodeEntered: 0,
    filterConfigChanged: 0,
    ...safeGetJSON<Record<string, number>>('userStats', {}),
  },
});
