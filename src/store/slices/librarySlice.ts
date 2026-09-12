import { StateCreator } from 'zustand';
import type { AppState } from './types';
import {
  CategoryInfo,
  EntityDBInfo,
  EntityCategory,
  getActiveModsPath,
  getCleanModName,
  resolveCategoryEntity,
} from '../../types';
import { invoke } from '@tauri-apps/api/core';
import { message, confirm } from '@tauri-apps/plugin-dialog';
import { safeGetJSON, safeSetJSON, safeGetInt, safeGetString } from '../../utils/storage';
import {
  playToggleSound,
  playLaunchGameSound,
  playRandomizerSound,
  playTrashSound,
} from '../../utils/audio';
import { debouncedRefreshHashAnalysis, debouncedWarningsScan } from './diagnosticsSlice';

let activeScanPromise: Promise<void> | null = null;
let pendingScanRequested = false;

export interface LibrarySlice {
  activeLibraryTab: EntityCategory;
  activeModPreview: any | null;
  addAllToRandomizer: (ids: string[]) => void;
  addToRandomizer: (id: string) => void;
  categories: CategoryInfo[];
  categoryFilterMode: 'all' | 'installed' | 'actives';
  categoryIcons: Record<string, string>;
  deleteMod: (modPath: string) => Promise<void>;
  disableAllMods: () => Promise<void>;
  entitiesDB: Record<string, EntityDBInfo[]>;
  favoriteCategories: string[];
  favoriteMods: string[];
  favoriteRandomizerWeight: number;
  ignoredMods: string[];
  launchGame: () => Promise<void>;
  modSortMode: 'alpha_asc' | 'alpha_desc' | 'enabled_first' | 'disabled_first';
  previouslyEnabledMods: string[];
  randomizeMods: () => Promise<void>;
  randomizerWhitelist: string[];
  removeAllFromRandomizer: () => void;
  removeFromRandomizer: (id: string) => void;
  revertDisableAll: () => Promise<void>;
  scanModsFolder: () => Promise<void>;
  selectedCategory: string | null;
  selectedTags: string[];
  setActiveLibraryTab: (tab: EntityCategory) => void;
  setActiveModPreview: (mod: any | null) => void;
  setCategories: (categories: CategoryInfo[]) => void;
  setCategoryFilterMode: (mode: 'all' | 'installed' | 'actives') => void;
  setCategoryIcon: (categoryName: string, icon: string) => void;
  setEntitiesDB: (db: Record<string, any[]>) => void;
  setFavoriteCategories: (categories: string[]) => void;
  setFavoriteMods: (mods: string[]) => void;
  setFavoriteRandomizerWeight: (weight: number) => void;
  setIgnoredMods: (mods: string[]) => void;
  setModNote: (modPath: string, note: string) => Promise<void>;
  setModSortMode: (mode: 'alpha_asc' | 'alpha_desc' | 'enabled_first' | 'disabled_first') => void;
  setModTags: (modPath: string, tags: string[]) => Promise<void>;
  setSelectedCategory: (category: string | null) => void;
  setSelectedTags: (tags: string[]) => void;
  toggleFavoriteCategory: (categoryName: string) => void;
  toggleFavoriteMod: (modName: string) => void;
  toggleFilterTag: (tag: string) => void;
  toggleIgnoreMod: (modName: string) => void;
  toggleMod: (modPath: string, currentlyEnabled: boolean) => Promise<void>;
  togglingMods: Set<string>;
  loadCachedLibrary: () => Promise<void>;
  bulkToggleMods: (modPaths: string[], enable: boolean) => Promise<void>;
  isLoadingLibrary: boolean;
  setIsLoadingLibrary: (loading: boolean) => void;
}

export const createLibrarySlice: StateCreator<AppState, [], [], LibrarySlice> = (set, get) => ({
  isLoadingLibrary: !!safeGetString('mods_path', ''),
  setIsLoadingLibrary: (loading: boolean) => set({ isLoadingLibrary: loading }),
  activeLibraryTab: 'playable_characters',

  activeModPreview: null,

  addAllToRandomizer: (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const list = [...new Set([...get().randomizerWhitelist, ...ids])];
    safeSetJSON('randomizerWhitelist', list);
    set({ randomizerWhitelist: list });
  },

  addToRandomizer: (id: string) => {
    const list = [...new Set([...get().randomizerWhitelist, id])];
    safeSetJSON('randomizerWhitelist', list);
    set({ randomizerWhitelist: list });
  },

  categories: [],

  categoryFilterMode: (() => {
    const raw = safeGetString('categoryFilterMode', 'all');
    return raw === 'installed' || raw === 'actives' ? raw : 'all';
  })(),

  categoryIcons: safeGetJSON<Record<string, string>>('categoryIcons', {}),

  deleteMod: async (modPath: string) => {
    try {
      await invoke('delete_mod', { modPath });
      playTrashSound();
      get().scanModsFolder();
      get().incrementStat('modsDeleted');
    } catch (e: any) {
      console.error(e);
      await message(e.toString(), { title: 'Error Deleting Mod', kind: 'error' });
    }
  },

  disableAllMods: async () => {
    const { modsPath, categories, scanModsFolder } = get();
    if (!modsPath) return;

    const confirmed = await confirm('Are you sure you want to disable all mods?', {
      title: 'Disable All Mods',
      kind: 'warning',
    });
    if (!confirmed) return;

    try {
      // Record currently enabled mods before disabling
      const enabled = categories.flatMap((c) =>
        c.mods.filter((m) => m.is_enabled).map((m) => m.full_path)
      );

      const errors: string[] = await invoke('disable_all_mods', { modPaths: enabled });
      if (errors && errors.length > 0) {
        await message(`Some mods could not be disabled:\n\n${errors.join('\n')}`, {
          title: 'Warning',
          kind: 'warning',
        });
      }

      set({ previouslyEnabledMods: enabled });
      playToggleSound(false);
      scanModsFolder();
    } catch (e) {
      console.error(e);
    }
  },

  entitiesDB: {},

  favoriteCategories: safeGetJSON<string[]>('favoriteCategories', []),

  favoriteMods: safeGetJSON<string[]>('favoriteMods', []),

  favoriteRandomizerWeight: safeGetInt('favoriteRandomizerWeight', 20, 1, 100),

  ignoredMods: safeGetJSON<string[]>('ignoredMods', []),

  launchGame: async () => {
    const { gameExePath, modsPath } = get();
    if (!gameExePath) {
      alert('Please select game executable path in settings first.');
      return;
    }
    try {
      if (localStorage.getItem('hud_enabled') === 'true') {
        const activeModPaths = get().categories.flatMap((cat) =>
          cat.mods.filter((mod) => mod.is_enabled).map((mod) => mod.full_path)
        );
        await invoke('generate_in_game_ui', {
          rootPath: modsPath,
          activeModPaths,
          hudKey: get().hudKey,
          menuMode: get().hudMenuMode,
        }).catch(console.error);
      }
      await invoke('launch_game', { exePath: gameExePath });
      get().incrementStat('gameLaunches');
      playLaunchGameSound();
    } catch (e) {
      console.error(e);
    }
  },

  modSortMode: (safeGetString('modSortMode', 'alpha_asc') as any) || 'alpha_asc',

  previouslyEnabledMods: [],

  randomizeMods: async () => {
    const {
      modsPath,
      categories,
      randomizerWhitelist,
      favoriteMods,
      favoriteRandomizerWeight,
      scanModsFolder,
    } = get();
    if (!modsPath) {
      alert('Please select mods folder in settings first.');
      return;
    }
    try {
      const targetPath = getActiveModsPath(modsPath, get().activeLibraryTab);
      if (localStorage.getItem('hud_enabled') === 'true') {
        const activeModPaths = categories.flatMap((cat) =>
          cat.mods.filter((mod) => mod.is_enabled).map((mod) => mod.full_path)
        );
        await invoke('generate_in_game_ui', {
          rootPath: modsPath,
          activeModPaths,
          hudKey: get().hudKey,
          menuMode: get().hudMenuMode,
        }).catch(console.error);
      }

      const ignoredMods = safeGetJSON<string[]>('ignoredMods', []);
      const playableCharacters = (get().entitiesDB['playable_characters'] || []) as EntityDBInfo[];
      if (randomizerWhitelist.length === 0) {
        return;
      }

      const whitelistCategories = categories
        .filter((cat) => {
          if (cat.category_name === 'Unassigned' || cat.category_name === 'Multi-Character') {
            return false;
          }
          const char = resolveCategoryEntity(
            cat.category_name,
            cat.character_id,
            playableCharacters
          );
          if (char) {
            return randomizerWhitelist.includes(char.id);
          }
          return false;
        })
        .map((cat) => cat.category_name);

      const errors: string[] = await invoke('randomize_mods', {
        rootPath: targetPath,
        ignoredMods,
        whitelist: whitelistCategories,
        favoriteMods,
        favoriteWeight: favoriteRandomizerWeight,
      });

      if (errors && errors.length > 0) {
        await message(
          `Some mods could not be toggled during randomization:\n\n${errors.join('\n')}`,
          { title: 'Randomization Warning', kind: 'warning' }
        );
      } else {
        await scanModsFolder();
      }
      get().incrementStat('randomizeCount');
      playRandomizerSound();
    } catch (e) {
      console.error(e);
      await message(`Failed to randomize: ${e}`, { title: 'Error', kind: 'error' });
    }
  },

  randomizerWhitelist: safeGetJSON<string[]>('randomizerWhitelist', []),

  removeAllFromRandomizer: () => {
    safeSetJSON('randomizerWhitelist', []);
    set({ randomizerWhitelist: [] });
  },

  removeFromRandomizer: (id: string) => {
    const list = get().randomizerWhitelist.filter((x) => x !== id);
    safeSetJSON('randomizerWhitelist', list);
    set({ randomizerWhitelist: list });
  },

  revertDisableAll: async () => {
    const { previouslyEnabledMods, scanModsFolder } = get();
    if (previouslyEnabledMods.length === 0) return;

    try {
      const errors: string[] = await invoke('restore_mods_state', {
        modPaths: previouslyEnabledMods,
      });
      if (errors && errors.length > 0) {
        await message(`Some mods could not be restored:\n\n${errors.join('\n')}`, {
          title: 'Warning',
          kind: 'warning',
        });
      }
      set({ previouslyEnabledMods: [] });
      playToggleSound(true);
      scanModsFolder();
    } catch (e) {
      console.error(e);
    }
  },

  scanModsFolder: async () => {
    if (activeScanPromise) {
      pendingScanRequested = true;
      return activeScanPromise;
    }

    const executeScan = async () => {
      const { modsPath, activeLibraryTab } = get();
      if (!modsPath) {
        set({ isLoadingLibrary: false });
        return;
      }
      try {
        if (get().categories.length === 0) {
          set({ isLoadingLibrary: true });
        }
        const targetPath = getActiveModsPath(modsPath, activeLibraryTab);
        const res = await invoke<CategoryInfo[]>('scan_mods_folder', {
          rootPath: targetPath,
          taskId: 'scan:active',
        });
        set({ categories: res, isLoadingLibrary: false });
        const isLowPerf = get().performanceProfile === 'low';
        if (!isLowPerf && get().autoConflictDetectionEnabled) {
          await get().refreshHashAnalysis();
        }
        if (!isLowPerf && get().autoScriptAnalysisEnabled) {
          invoke('start_warnings_scan', { modsDir: targetPath, taskId: 'warnings:active' }).catch(
            console.error
          );
        }
      } catch (e: any) {
        const isCancelled =
          (typeof e === 'string' && e.toLowerCase().includes('cancelled')) ||
          (e?.message && String(e.message).toLowerCase().includes('cancelled'));
        if (isCancelled) {
          return;
        }
        console.error(e);
        set({ categories: [], isLoadingLibrary: false });
      }
    };

    activeScanPromise = (async () => {
      try {
        await executeScan();
      } finally {
        activeScanPromise = null;
        if (pendingScanRequested) {
          pendingScanRequested = false;
          await get().scanModsFolder();
        }
      }
    })();

    return activeScanPromise;
  },

  selectedCategory: null,

  selectedTags: [],

  setActiveLibraryTab: (tab: EntityCategory) => {
    invoke('cancel_tasks_by_prefix', { prefix: 'scan:' }).catch(() => {});
    set({
      activeLibraryTab: tab,
      categories: [],
      isLoadingLibrary: true,
      selectedCategory: null,
    });
    get()
      .loadCachedLibrary()
      .then(() => {
        get().scanModsFolder();
      });
  },

  setActiveModPreview: (mod) => set({ activeModPreview: mod }),

  setCategories: (categories: CategoryInfo[]) => set({ categories }),

  setCategoryFilterMode: (mode: 'all' | 'installed' | 'actives') => {
    localStorage.setItem('categoryFilterMode', mode);
    set({ categoryFilterMode: mode });
  },

  setCategoryIcon: (categoryName: string, icon: string) => {
    const updated = { ...get().categoryIcons, [categoryName]: icon };
    safeSetJSON('categoryIcons', updated);
    set({ categoryIcons: updated });
  },

  setEntitiesDB: (db: Record<string, any[]>) => set({ entitiesDB: db }),

  setFavoriteCategories: (categories) => {
    safeSetJSON('favoriteCategories', categories);
    set({ favoriteCategories: categories });
  },

  setFavoriteMods: (mods) => {
    safeSetJSON('favoriteMods', mods);
    set({ favoriteMods: mods });
  },

  setFavoriteRandomizerWeight: (weight: number) => {
    safeSetJSON('favoriteRandomizerWeight', weight);
    set({ favoriteRandomizerWeight: weight });
  },

  setIgnoredMods: (mods: string[]) => {
    safeSetJSON('ignoredMods', mods);
    set({ ignoredMods: mods });
  },

  setModNote: async (modPath: string, note: string) => {
    try {
      await invoke('set_mod_note', { modPath, note });
      get().incrementStat('notesWritten');
      set((state) => ({
        categories: state.categories.map((cat) => ({
          ...cat,
          mods: cat.mods.map((mod) => {
            if (mod.full_path === modPath) {
              return {
                ...mod,
                meta: {
                  ...mod.meta,
                  notes: note,
                },
              };
            }
            return mod;
          }),
        })),
      }));
    } catch (e) {
      console.error('Failed to set mod note', e);
      throw e;
    }
  },

  setModSortMode: (mode: any) => {
    localStorage.setItem('modSortMode', mode);
    set({ modSortMode: mode });
  },

  setModTags: async (modPath: string, tags: string[]) => {
    try {
      await invoke('set_mod_tags', { modPath, tags });
      set((state) => ({
        categories: state.categories.map((cat) => ({
          ...cat,
          mods: cat.mods.map((mod) => {
            if (mod.full_path === modPath) {
              return {
                ...mod,
                meta: {
                  ...mod.meta,
                  tags,
                },
              };
            }
            return mod;
          }),
        })),
      }));
    } catch (e) {
      console.error('Failed to set mod tags', e);
      throw e;
    }
  },

  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),

  setSelectedTags: (tags: string[]) => set({ selectedTags: tags }),

  toggleFavoriteCategory: (categoryName: string) => {
    const { favoriteCategories } = get();
    const newFavorites = favoriteCategories.includes(categoryName)
      ? favoriteCategories.filter((c) => c !== categoryName)
      : [...favoriteCategories, categoryName];
    set({ favoriteCategories: newFavorites });
    safeSetJSON('favoriteCategories', newFavorites);
  },

  toggleFavoriteMod: (modName: string) => {
    const { favoriteMods } = get();
    const stableName = getCleanModName(modName);
    const newFavorites = favoriteMods.includes(stableName)
      ? favoriteMods.filter((m) => m !== stableName && m !== modName)
      : [...favoriteMods, stableName];
    set({ favoriteMods: newFavorites });
    safeSetJSON('favoriteMods', newFavorites);
  },

  toggleFilterTag: (tag: string) => {
    const current = get().selectedTags;
    if (current.includes(tag)) {
      set({ selectedTags: current.filter((t) => t !== tag) });
    } else {
      set({ selectedTags: [...current, tag] });
    }
  },

  toggleIgnoreMod: (modName: string) => {
    const { ignoredMods, setIgnoredMods, scanModsFolder } = get();
    const stableName = getCleanModName(modName);
    if (ignoredMods.includes(stableName) || ignoredMods.includes(modName)) {
      setIgnoredMods(ignoredMods.filter((m) => m !== stableName && m !== modName));
    } else {
      setIgnoredMods([...ignoredMods, stableName]);
    }
    scanModsFolder();
  },

  toggleMod: async (modPath: string, currentlyEnabled: boolean) => {
    if (get().togglingMods.has(modPath)) return;
    set({ togglingMods: new Set(get().togglingMods).add(modPath) });

    // Clear the disable-all snapshot whenever the user manually changes a mod
    if (get().previouslyEnabledMods.length > 0) {
      set({ previouslyEnabledMods: [] });
    }

    try {
      const newPath = await invoke<string>('toggle_mod', { modPath, enable: !currentlyEnabled });
      playToggleSound(!currentlyEnabled);

      const { categories } = get();
      const normOldPath = modPath.replace(/\\/g, '/');
      const normNewPath = newPath.replace(/\\/g, '/');

      const newCategories = categories.map((cat) => ({
        ...cat,
        mods: cat.mods.map((mod) => {
          if (mod.full_path.replace(/\\/g, '/') === normOldPath) {
            return {
              ...mod,
              is_enabled: !currentlyEnabled,
              full_path: normNewPath,
            };
          }
          return mod;
        }),
      }));
      set({ categories: newCategories });

      get().incrementStat('modsToggled');

      const { modsPath, activeLibraryTab } = get();
      const targetPath = getActiveModsPath(modsPath, activeLibraryTab);

      if (localStorage.getItem('hud_enabled') === 'true') {
        const activeModPaths = newCategories.flatMap((cat) =>
          cat.mods.filter((mod) => mod.is_enabled).map((mod) => mod.full_path)
        );
        await invoke('generate_in_game_ui', {
          rootPath: modsPath,
          activeModPaths,
          hudKey: get().hudKey,
          menuMode: get().hudMenuMode,
        }).catch(console.error);
      }

      debouncedRefreshHashAnalysis(get());
      debouncedWarningsScan(targetPath, get().autoScriptAnalysisEnabled);

      if (get().gameIsRunning) {
        if (get().hotreloadEnabled) {
          await invoke('focus_and_send_f10').catch(console.error);
          get().incrementStat('hotReloadsTriggered');
        } else {
          get().showToast('Mods updated! Press F10 in-game to reload.');
        }
      }
    } catch (e: any) {
      console.error(e);
      await message(e.toString(), { title: 'Mod Conflict', kind: 'error' });
    } finally {
      const newToggling = new Set(get().togglingMods);
      newToggling.delete(modPath);
      set({ togglingMods: newToggling });
    }
  },

  togglingMods: new Set(),

  loadCachedLibrary: async () => {
    const { modsPath, activeLibraryTab } = get();
    if (!modsPath) {
      set({ isLoadingLibrary: false });
      return;
    }
    try {
      const targetPath = getActiveModsPath(modsPath, activeLibraryTab);
      const cached = await invoke<CategoryInfo[]>('get_cached_mods_folder', {
        rootPath: targetPath,
      });
      if (cached && Array.isArray(cached) && cached.length > 0) {
        set({ categories: cached, isLoadingLibrary: false });
      }
    } catch (e) {
      console.warn('Failed to load cached library:', e);
    }
  },

  bulkToggleMods: async (modPaths: string[], enable: boolean) => {
    if (!modPaths.length) return;
    try {
      set((state) => {
        const next = new Set(state.togglingMods);
        modPaths.forEach((p) => next.add(p));
        return { togglingMods: next };
      });
      await invoke('bulk_toggle_mods', { modPaths, enable });
      playToggleSound(enable);
      get().incrementStat('modsToggled', modPaths.length);
      await get().scanModsFolder();

      if (get().gameIsRunning) {
        if (get().hotreloadEnabled) {
          await invoke('focus_and_send_f10').catch(console.error);
          get().incrementStat('hotReloadsTriggered');
        } else {
          get().showToast('Mods updated! Press F10 in-game to reload.');
        }
      }
    } finally {
      set((state) => {
        const next = new Set(state.togglingMods);
        modPaths.forEach((p) => next.delete(p));
        return { togglingMods: next };
      });
    }
  },
});
