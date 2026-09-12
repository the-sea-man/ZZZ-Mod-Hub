import { StateCreator } from 'zustand';
import type { AppState } from './types';
import { ModProfile } from '../../types/ipc';
import { invoke } from '@tauri-apps/api/core';
import { safeGetString, safeGetJSON, safeSetJSON } from '../../utils/storage';
import { getActiveModsPath } from '../../types';

export interface ProfilesSlice {
  activeProfileId: string | null;
  applyProfile: (profileId: string) => Promise<void>;
  deleteProfile: (profileId: string) => void;
  exportProfiles: () => string;
  importProfiles: (jsonString: string) => boolean;
  profiles: ModProfile[];
  saveCurrentProfile: (name: string, description?: string) => Promise<string>;
  setActiveProfileId: (id: string | null) => void;
  setProfiles: (profiles: ModProfile[]) => void;
}

export const createProfilesSlice: StateCreator<AppState, [], [], ProfilesSlice> = (set, get) => ({
  activeProfileId: safeGetString('active_profile_id', '') || null,

  applyProfile: async (profileId: string) => {
    const { profiles, categories, modsPath, activeLibraryTab, scanModsFolder } = get();
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile || !modsPath) return;

    const targetPath = getActiveModsPath(modsPath, activeLibraryTab).replace(/\\/g, '/');
    const targetEnabledSet = new Set(profile.enabledModRelativePaths.map((p) => p.toLowerCase()));

    const toggles: { modPath: string; enable: boolean }[] = [];

    for (const cat of categories) {
      for (const mod of cat.mods) {
        const norm = mod.full_path.replace(/\\/g, '/');
        const cleanFolder = norm.split('/').pop() || '';
        const cleanModName = cleanFolder.replace(/^DISABLED\s+/, '').toLowerCase();

        const shouldBeEnabled = Array.from(targetEnabledSet).some((rel) => {
          const relClean =
            rel
              .split('/')
              .pop()
              ?.replace(/^DISABLED\s+/, '')
              .toLowerCase() || '';
          return (
            relClean === cleanModName ||
            rel.toLowerCase() === norm.slice(targetPath.length).replace(/^\//, '').toLowerCase()
          );
        });

        if (shouldBeEnabled && !mod.is_enabled) {
          toggles.push({ modPath: mod.full_path, enable: true });
        } else if (!shouldBeEnabled && mod.is_enabled) {
          toggles.push({ modPath: mod.full_path, enable: false });
        }
      }
    }

    if (toggles.length > 0) {
      const toDisable = toggles.filter((t) => !t.enable).map((t) => t.modPath);
      const toEnable = toggles.filter((t) => t.enable).map((t) => t.modPath);

      if (toDisable.length > 0) {
        await invoke('bulk_toggle_mods', { modPaths: toDisable, enable: false }).catch(
          console.error
        );
      }
      if (toEnable.length > 0) {
        await invoke('bulk_toggle_mods', { modPaths: toEnable, enable: true }).catch(console.error);
      }
      await scanModsFolder();

      const updatedCats = get().categories;
      if (localStorage.getItem('hud_enabled') === 'true') {
        const activeModPaths = updatedCats.flatMap((cat) =>
          cat.mods.filter((mod) => mod.is_enabled).map((mod) => mod.full_path)
        );
        await invoke('generate_in_game_ui', {
          rootPath: modsPath,
          activeModPaths,
          hudKey: get().hudKey,
          menuMode: get().hudMenuMode,
        }).catch(console.error);
      }

      if (get().gameIsRunning && get().hotreloadEnabled) {
        await invoke('focus_and_send_f10').catch(console.error);
        get().incrementStat('hotReloadsTriggered');
      }
    }

    localStorage.setItem('active_profile_id', profileId);
    set({ activeProfileId: profileId });
  },

  deleteProfile: (profileId: string) => {
    const { profiles, activeProfileId } = get();
    const newProfiles = profiles.filter((p) => p.id !== profileId);
    safeSetJSON('mod_profiles', newProfiles);
    const newActive = activeProfileId === profileId ? null : activeProfileId;
    if (newActive) localStorage.setItem('active_profile_id', newActive);
    else localStorage.removeItem('active_profile_id');
    set({ profiles: newProfiles, activeProfileId: newActive });
  },

  exportProfiles: () => {
    const { profiles } = get();
    return JSON.stringify(profiles, null, 2);
  },

  importProfiles: (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString);
      if (!Array.isArray(parsed)) return false;

      const validProfiles: ModProfile[] = parsed.filter(
        (p: any) =>
          p &&
          typeof p.id === 'string' &&
          typeof p.name === 'string' &&
          Array.isArray(p.enabledModRelativePaths)
      );

      if (validProfiles.length === 0) return false;

      const { profiles } = get();
      const existingIds = new Set(profiles.map((p) => p.id));
      const merged = [...profiles];

      for (const vp of validProfiles) {
        if (existingIds.has(vp.id)) {
          const idx = merged.findIndex((p) => p.id === vp.id);
          merged[idx] = vp;
        } else {
          merged.push(vp);
        }
      }

      safeSetJSON('mod_profiles', merged);
      set({ profiles: merged });
      return true;
    } catch {
      return false;
    }
  },

  profiles: safeGetJSON<ModProfile[]>('mod_profiles', []),

  saveCurrentProfile: async (name: string, description?: string) => {
    const { categories, activeLibraryTab, modsPath, profiles } = get();
    if (!modsPath) return '';

    const targetPath = getActiveModsPath(modsPath, activeLibraryTab).replace(/\\/g, '/');

    // Collect all currently enabled mod relative paths
    const enabledModRelativePaths: string[] = [];
    for (const cat of categories) {
      for (const mod of cat.mods) {
        if (mod.is_enabled) {
          const norm = mod.full_path.replace(/\\/g, '/');
          const rel = norm.startsWith(targetPath)
            ? norm.slice(targetPath.length).replace(/^\//, '')
            : norm;
          enabledModRelativePaths.push(rel);
        }
      }
    }

    const existingIdx = profiles.findIndex(
      (p) => p.name.toLowerCase() === name.toLowerCase() && p.tab === activeLibraryTab
    );
    const newProfiles = [...profiles];
    const profileId = existingIdx !== -1 ? profiles[existingIdx].id : `profile_${Date.now()}`;

    const profile: ModProfile = {
      id: profileId,
      name,
      description,
      createdAt: existingIdx !== -1 ? profiles[existingIdx].createdAt : Date.now(),
      updatedAt: Date.now(),
      tab: activeLibraryTab,
      enabledModRelativePaths,
    };

    if (existingIdx !== -1) {
      newProfiles[existingIdx] = profile;
    } else {
      newProfiles.push(profile);
    }

    safeSetJSON('mod_profiles', newProfiles);
    localStorage.setItem('active_profile_id', profileId);
    set({ profiles: newProfiles, activeProfileId: profileId });
    return profileId;
  },

  setActiveProfileId: (id: string | null) => {
    if (id) localStorage.setItem('active_profile_id', id);
    else localStorage.removeItem('active_profile_id');
    set({ activeProfileId: id });
  },

  setProfiles: (profiles: ModProfile[]) => {
    safeSetJSON('mod_profiles', profiles);
    set({ profiles });
  },
});
