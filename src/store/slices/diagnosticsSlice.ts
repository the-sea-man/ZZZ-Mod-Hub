import { StateCreator } from 'zustand';
import type { AppState } from './types';
import {
  HashAnalysisResult,
  ModConflict,
  UpdateAvailable,
  ModUpdateCheckRequest,
  ModWarning,
} from '../../types/ipc';
import { EntityDBInfo, getActiveModsPath } from '../../types';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { check } from '@tauri-apps/plugin-updater';
import { safeGetJSON, safeSetJSON, safeGetString, safeGetBool } from '../../utils/storage';
import { playSyncSound } from '../../utils/audio';

let hashAnalysisDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let warningsScanDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export function debouncedRefreshHashAnalysis(store: {
  refreshHashAnalysis: () => Promise<void>;
  autoConflictDetectionEnabled?: boolean;
}) {
  if (store.autoConflictDetectionEnabled === false) return;
  if (hashAnalysisDebounceTimer) clearTimeout(hashAnalysisDebounceTimer);
  hashAnalysisDebounceTimer = setTimeout(() => {
    store.refreshHashAnalysis().catch(console.error);
  }, 400);
}

export function debouncedWarningsScan(targetPath: string, autoScriptAnalysisEnabled?: boolean) {
  if (autoScriptAnalysisEnabled === false) return;
  if (warningsScanDebounceTimer) clearTimeout(warningsScanDebounceTimer);
  warningsScanDebounceTimer = setTimeout(() => {
    invoke('start_warnings_scan', { modsDir: targetPath }).catch(console.error);
  }, 500);
}

export interface DiagnosticsSlice {
  appUpdateAvailable: boolean;
  appVersion: string;
  autoCheckUpdates: boolean;
  availableUpdates: UpdateAvailable[];
  checkAppUpdates: () => Promise<{ available: boolean; latestVersion?: string }>;
  checkForUpdates: () => Promise<void>;
  checkModUpdates: () => Promise<void>;
  conflictWarningLevel: 'light' | 'heavy';
  dbUrl: string;
  enabledWarningRules: Record<string, boolean>;
  fetchAppVersion: () => Promise<string>;
  fetchCachedDatabase: () => Promise<void>;
  getFilteredWarnings: (modPath: string) => ModWarning[];
  ignoreModUpdate: (gbModId: number, timestamp: number) => void;
  ignoredModUpdates: Record<number, number>;
  isCheckingAppUpdates: boolean;
  isCheckingUpdates: boolean;
  isSyncing: boolean;
  latestAppVersion: string | null;
  modConflicts: ModConflict[];
  modUpdates: Record<string, UpdateAvailable>;
  modWarnings: Record<string, ModWarning[]>;
  removeModWarning: (modPath: string, ruleId?: string) => void;
  refreshHashAnalysis: () => Promise<void>;
  setAutoCheckUpdates: (val: boolean) => void;
  setAvailableUpdates: (updates: UpdateAvailable[]) => void;
  setConflictWarningLevel: (level: 'light' | 'heavy') => void;
  setDbUrl: (url: string) => void;
  setModUpdates: (updates: UpdateAvailable[]) => void;
  setModWarnings: (warnings: Record<string, ModWarning[]>) => void;
  setWarningRule: (ruleId: string, enabled: boolean) => void;
  staleHashes: Record<string, string[]>;
  syncDatabase: () => Promise<void>;
  toggleWarningRule: (ruleId: string) => void;
}

export const createDiagnosticsSlice: StateCreator<AppState, [], [], DiagnosticsSlice> = (
  set,
  get
) => ({
  appUpdateAvailable: false,

  appVersion: '1.0.2',

  autoCheckUpdates: safeGetBool('autoCheckUpdates', false),

  availableUpdates: [],

  checkAppUpdates: async () => {
    set({ isCheckingAppUpdates: true });
    try {
      try {
        const update = await check();
        if (update) {
          set({
            latestAppVersion: update.version,
            appUpdateAvailable: true,
            isCheckingAppUpdates: false,
          });
          return { available: true, latestVersion: update.version };
        }
      } catch (err) {
        console.warn('Tauri updater plugin check failed, falling back to direct endpoint:', err);
      }

      const res = await fetch(
        'https://raw.githubusercontent.com/the-sea-man/ZZZ-Mod-Hub/main/updater.json'
      );
      if (res.ok) {
        const data = await res.json();
        const current = get().appVersion;
        const onlineVer = data.version;
        const isNewer = !!onlineVer && onlineVer !== current;
        set({
          latestAppVersion: onlineVer,
          appUpdateAvailable: isNewer,
          isCheckingAppUpdates: false,
        });
        return { available: isNewer, latestVersion: onlineVer };
      }

      set({ isCheckingAppUpdates: false });
      return { available: false, latestVersion: get().appVersion };
    } catch (e) {
      console.error('Failed to check app updates:', e);
      set({ isCheckingAppUpdates: false });
      return { available: false };
    }
  },

  checkForUpdates: async () => {
    const { categories, isCheckingUpdates } = get();
    if (isCheckingUpdates) return;
    set({ isCheckingUpdates: true });

    try {
      const requests: ModUpdateCheckRequest[] = [];
      categories.forEach((cat) => {
        cat.mods.forEach((m) => {
          if (m.meta?.gb_mod_id && m.meta?.downloaded_at) {
            const downloadedAtNum = parseInt(m.meta.downloaded_at, 10);
            if (!isNaN(downloadedAtNum)) {
              requests.push({
                mod_path: m.full_path,
                gb_mod_id: m.meta.gb_mod_id,
                downloaded_at: downloadedAtNum,
              });
            }
          }
        });
      });

      if (requests.length > 0) {
        const updates = await invoke<UpdateAvailable[]>('check_mod_updates', { mods: requests });
        const ignored = get().ignoredModUpdates || {};
        const filtered = updates.filter((u) => (ignored[u.gb_mod_id] || 0) < u.new_timestamp);
        set({ availableUpdates: filtered });
      } else {
        set({ availableUpdates: [] });
      }
    } catch (e) {
      console.error('Failed to check for mod updates:', e);
    } finally {
      set({ isCheckingUpdates: false });
    }
  },

  checkModUpdates: async () => {
    const { categories } = get();
    // Gather all installed mods with gb_mod_id
    const reqs: { mod_path: string; gb_mod_id: number; downloaded_at: number }[] = [];

    categories.forEach((cat) => {
      cat.mods.forEach((mod) => {
        if (mod.meta?.gb_mod_id && mod.meta?.downloaded_at) {
          const timestamp = parseInt(mod.meta.downloaded_at, 10);
          if (!isNaN(timestamp)) {
            reqs.push({
              mod_path: mod.full_path,
              gb_mod_id: mod.meta.gb_mod_id,
              downloaded_at: timestamp,
            });
          }
        }
      });
    });

    if (reqs.length > 0) {
      try {
        const updates = await invoke<UpdateAvailable[]>('check_mod_updates', {
          mods: reqs,
        });
        get().setModUpdates(updates);
      } catch (e) {
        console.error('Failed to check mod updates', e);
      }
    }
  },

  conflictWarningLevel:
    (safeGetString('conflictWarningLevel', 'light') as 'light' | 'heavy') || 'light',

  dbUrl: safeGetString(
    'db_url',
    'https://raw.githubusercontent.com/the-sea-man/ZZZ-Mod-Hub-DB/refs/heads/main/'
  ),

  enabledWarningRules: (() => {
    const defaults: Record<string, boolean> = {
      standalone_help: true,
      rogue_hud: true,
      multi_character: true,
      unconditional_key: true,
      missing_vertex_limit_override: true,
      missing_resource_definition: true,
      duplicate_section: true,
      missing_resource_ref: true,
      unconditional_texture_override: true,
      conflict: true,
    };
    return safeGetJSON<Record<string, boolean>>('enabledWarningRules', defaults);
  })(),

  fetchAppVersion: async () => {
    try {
      const ver = await getVersion();
      set({ appVersion: ver });
      return ver;
    } catch (e) {
      console.error('Failed to get app version:', e);
      return get().appVersion;
    }
  },

  fetchCachedDatabase: async () => {
    try {
      const res = await invoke<string>('get_cached_database');
      const data = JSON.parse(res);
      if (data) {
        // Fallback for old schema
        if (data.characters) {
          set({ entitiesDB: { playable_characters: data.characters } });
        } else {
          set({ entitiesDB: data });
        }

        // If user has not initialized randomizer whitelist in storage yet, persist current store state
        if (localStorage.getItem('randomizerWhitelist') === null) {
          const currentWhitelist = get().randomizerWhitelist || [];
          safeSetJSON('randomizerWhitelist', currentWhitelist);
        }
      }
    } catch (e) {
      console.error('No cached DB found or invalid JSON', e);
    }
  },

  // Mod Profiles Implementation,

  getFilteredWarnings: (modPath: string) => {
    const { modWarnings, enabledWarningRules } = get();
    const norm = modPath.replace(/\\/g, '/');
    const backslash = modPath.replace(/\//g, '\\');
    const list = modWarnings[norm] || modWarnings[modPath] || modWarnings[backslash] || [];
    return list.filter((w) => enabledWarningRules[w.rule_id] !== false);
  },

  ignoreModUpdate: (gbModId: number, timestamp: number) => {
    const updated = { ...get().ignoredModUpdates, [gbModId]: timestamp };
    safeSetJSON('ignoredModUpdates', updated);
    const filtered = get().availableUpdates.filter((u) => u.gb_mod_id !== gbModId);
    set({ ignoredModUpdates: updated, availableUpdates: filtered });
  },

  ignoredModUpdates: safeGetJSON<Record<number, number>>('ignoredModUpdates', {}),

  isCheckingAppUpdates: false,

  isCheckingUpdates: false,

  isSyncing: false,

  latestAppVersion: null,

  modConflicts: [],

  modUpdates: {},

  modWarnings: {},

  refreshHashAnalysis: async () => {
    const { modsPath, activeLibraryTab, conflictWarningLevel, entitiesDB } = get();
    if (!modsPath) return;

    try {
      const targetPath = getActiveModsPath(modsPath, activeLibraryTab);
      const result = await invoke<HashAnalysisResult>('analyze_mod_hashes', {
        modsDir: targetPath,
        warningLevel: conflictWarningLevel,
      });

      const conflicts = result?.conflicts || [];
      const modHashes = result?.mod_hashes || {};

      const staleMap: Record<string, string[]> = {};

      if (
        activeLibraryTab === 'playable_characters' ||
        targetPath.includes('Playable Characters')
      ) {
        const characters = (entitiesDB['playable_characters'] || []) as EntityDBInfo[];

        const charHashMap: Record<string, Set<string>> = {};

        for (const char of characters) {
          const hashSet = new Set<string>();

          (char.skins || []).forEach((skin) => {
            if (skin.components) {
              Object.values(skin.components).forEach((comp: any) => {
                if (comp.draw_vb) hashSet.add(comp.draw_vb.toLowerCase());
                if (comp.position_vb) hashSet.add(comp.position_vb.toLowerCase());
                if (comp.blend_vb) hashSet.add(comp.blend_vb.toLowerCase());
                if (comp.texcoord_vb) hashSet.add(comp.texcoord_vb.toLowerCase());
                if (comp.ib) hashSet.add(comp.ib.toLowerCase());
                if (comp.textures) {
                  Object.values(comp.textures).forEach((tex: any) => {
                    if (tex) hashSet.add(tex.toLowerCase());
                  });
                }
              });
            }
          });

          if (hashSet.size > 0) {
            const keys = [char.name, char.id, ...(char.aliases || [])].map((k) =>
              k.toLowerCase().replace(/[^a-z0-9]/g, '')
            );
            for (const k of keys) {
              charHashMap[k] = hashSet;
            }
          }
        }

        for (const [modFullPath, overrides] of Object.entries(modHashes)) {
          const normPath = modFullPath.replace(/\\/g, '/');
          const parts = normPath.split('/');
          const pcIdx = parts.findIndex((p) => p.toLowerCase() === 'playable characters');

          let charKey = '';
          if (pcIdx !== -1 && parts.length > pcIdx + 1) {
            charKey = parts[pcIdx + 1].toLowerCase().replace(/[^a-z0-9]/g, '');
          } else if (parts.length >= 2) {
            charKey = parts[parts.length - 2].toLowerCase().replace(/[^a-z0-9]/g, '');
          }

          const validSet = charHashMap[charKey];
          if (validSet) {
            const invalidHashes: string[] = [];
            for (const ov of overrides) {
              const cleanHash = ov.hash.toLowerCase().replace(/^0x/, '');
              if (!validSet.has(cleanHash)) {
                invalidHashes.push(ov.hash);
              }
            }

            if (invalidHashes.length > 0) {
              staleMap[normPath] = invalidHashes;
            }
          }
        }
      }

      set({ modConflicts: conflicts, staleHashes: staleMap });
    } catch (e) {
      console.error('Failed to analyze mod hashes:', e);
    }
  },

  setAutoCheckUpdates: (val) => {
    localStorage.setItem('autoCheckUpdates', val ? 'true' : 'false');
    localStorage.setItem('performanceProfile', 'custom');
    localStorage.setItem('lowPerformanceMode', 'false');
    set({ autoCheckUpdates: val, performanceProfile: 'custom', lowPerformanceMode: false });
  },

  setAvailableUpdates: (updates) => set({ availableUpdates: updates }),

  setConflictWarningLevel: (level: 'light' | 'heavy') => {
    localStorage.setItem('conflictWarningLevel', level);
    set({ conflictWarningLevel: level });
  },

  setDbUrl: (url: string) => {
    localStorage.setItem('db_url', url);
    set({ dbUrl: url });
  },

  setModUpdates: (updates) => {
    const map: Record<string, UpdateAvailable> = {};
    for (const u of updates) {
      map[u.mod_path] = u;
    }
    set({ modUpdates: map });
  },

  setModWarnings: (warnings: Record<string, ModWarning[]>) => {
    const normalized: Record<string, ModWarning[]> = {};
    for (const [k, v] of Object.entries(warnings)) {
      normalized[k.replace(/\\/g, '/')] = v;
    }
    set({ modWarnings: normalized });
  },

  removeModWarning: (modPath: string, ruleId?: string) => {
    const { modWarnings, staleHashes } = get();
    const norm = modPath.replace(/\\/g, '/');
    const backslash = modPath.replace(/\//g, '\\');
    let warningsChanged = false;
    const updatedWarnings = { ...modWarnings };

    for (const key of [modPath, norm, backslash]) {
      if (updatedWarnings[key]) {
        if (ruleId) {
          const filtered = updatedWarnings[key].filter(
            (w) => w.rule_id !== ruleId && w.level !== ruleId
          );
          if (filtered.length !== updatedWarnings[key].length) {
            warningsChanged = true;
            if (filtered.length > 0) {
              updatedWarnings[key] = filtered;
            } else {
              delete updatedWarnings[key];
            }
          }
        } else {
          warningsChanged = true;
          delete updatedWarnings[key];
        }
      }
    }

    let staleChanged = false;
    const updatedStale = { ...staleHashes };
    for (const key of [modPath, norm, backslash]) {
      if (updatedStale[key]) {
        staleChanged = true;
        delete updatedStale[key];
      }
    }

    set({
      ...(warningsChanged ? { modWarnings: updatedWarnings } : {}),
      ...(staleChanged ? { staleHashes: updatedStale } : {}),
    });
  },

  setWarningRule: (ruleId: string, enabled: boolean) => {
    const current = get().enabledWarningRules;
    const updated = { ...current, [ruleId]: enabled };
    safeSetJSON('enabledWarningRules', updated);
    set({ enabledWarningRules: updated });
  },

  staleHashes: {},

  syncDatabase: async () => {
    set({ isSyncing: true });
    try {
      const url = get().dbUrl;
      const downloadImages = get().downloadImages !== false; // default to true if null, but UI will prevent null
      await invoke('sync_database', { repoUrl: url, downloadImages });
      await get().fetchCachedDatabase();
      get().incrementStat('cloudSyncs');
      playSyncSound();
    } catch (e) {
      console.error(e);
      alert('Failed to sync database: ' + e);
    } finally {
      set({ isSyncing: false });
    }
  },

  toggleWarningRule: (ruleId: string) => {
    const current = get().enabledWarningRules;
    const updated = { ...current, [ruleId]: current[ruleId] === false ? true : false };
    safeSetJSON('enabledWarningRules', updated);
    set({ enabledWarningRules: updated });
  },
});
