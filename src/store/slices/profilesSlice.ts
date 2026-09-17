import { StateCreator } from 'zustand';
import type { AppState } from './types';
import { ModProfile } from '../../types/ipc';
import { safeGetString, safeGetJSON, safeSetJSON } from '../../utils/storage';
import { getActiveModsPath } from '../../types';
import { tauriCommands } from '../../services/tauriCommands';

/**
 * Normalizes a mod path relative to the active target folder into a canonical
 * cross-platform relative path, removing any "DISABLED " prefixes from all path segments.
 *
 * Example:
 *  "C:/Mods/Playable Characters/Ellen Joe/DISABLED SharkMod"
 *  with targetPath "C:/Mods/Playable Characters"
 *  -> "ellen joe/sharkmod"
 */
export const normalizeCanonicalRelativePath = (
  fullOrRelPath: string,
  targetPath?: string
): string => {
  let norm = fullOrRelPath.replace(/\\/g, '/').trim();
  if (targetPath) {
    const cleanTarget = targetPath.replace(/\\/g, '/').replace(/\/+$/, '');
    if (norm.toLowerCase().startsWith(cleanTarget.toLowerCase())) {
      norm = norm.slice(cleanTarget.length);
    }
  }
  return norm
    .split('/')
    .map((seg) => seg.replace(/^DISABLED\s+/i, '').trim())
    .filter(Boolean)
    .join('/')
    .toLowerCase();
};

/**
 * Produces a human-readable, case-preserved relative path without "DISABLED " prefixes.
 */
export const getCleanRelativePath = (fullPath: string, targetPath: string): string => {
  let norm = fullPath.replace(/\\/g, '/').trim();
  const cleanTarget = targetPath.replace(/\\/g, '/').replace(/\/+$/, '');
  if (norm.toLowerCase().startsWith(cleanTarget.toLowerCase())) {
    norm = norm.slice(cleanTarget.length);
  }
  return norm
    .split('/')
    .map((seg) => seg.replace(/^DISABLED\s+/i, '').trim())
    .filter(Boolean)
    .join('/');
};

export interface ProfilesSlice {
  activeProfileId: string | null;
  applyProfile: (profileId: string) => Promise<void>;
  deleteProfile: (profileId: string) => void;
  exportProfiles: () => string;
  importProfiles: (jsonString: string) => boolean;
  profiles: ModProfile[];
  saveCurrentProfile: (
    name: string,
    description?: string,
    targetProfileId?: string
  ) => Promise<string>;
  setActiveProfileId: (id: string | null) => void;
  setProfiles: (profiles: ModProfile[]) => void;
}

export const createProfilesSlice: StateCreator<AppState, [], [], ProfilesSlice> = (set, get) => ({
  activeProfileId: safeGetString('active_profile_id', '') || null,

  applyProfile: async (profileId: string) => {
    const { profiles, modsPath, activeLibraryTab } = get();
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile || !modsPath) return;

    // If profile belongs to another tab, switch tab and scan first
    if (profile.tab && profile.tab !== activeLibraryTab) {
      get().setActiveLibraryTab(profile.tab as any);
      await get().scanModsFolder();
    }

    const currentTab = get().activeLibraryTab;
    const targetPath = getActiveModsPath(modsPath, currentTab).replace(/\\/g, '/');
    const targetEnabledSet = new Set(
      profile.enabledModRelativePaths.map((p) => normalizeCanonicalRelativePath(p))
    );

    const toggles: { modPath: string; enable: boolean }[] = [];
    const currentCategories = get().categories;

    for (const cat of currentCategories) {
      for (const mod of cat.mods) {
        const canonicalRel = normalizeCanonicalRelativePath(mod.full_path, targetPath);
        const shouldBeEnabled = targetEnabledSet.has(canonicalRel);

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
        await tauriCommands.game.bulkToggle(toDisable, false).catch(console.error);
      }
      if (toEnable.length > 0) {
        await tauriCommands.game.bulkToggle(toEnable, true).catch(console.error);
      }
      await get().scanModsFolder();

      const updatedCats = get().categories;
      if (localStorage.getItem('hud_enabled') === 'true') {
        const activeModPaths = updatedCats.flatMap((cat) =>
          cat.mods.filter((mod) => mod.is_enabled).map((mod) => mod.full_path)
        );
        await tauriCommands.game
          .generateInGameUi(modsPath, get().hudKey, get().hudMenuMode, activeModPaths)
          .catch(console.error);
      }

      if (get().gameIsRunning && get().hotreloadEnabled) {
        await tauriCommands.system.focusAndSendF10().catch(console.error);
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

      const validProfiles: ModProfile[] = parsed
        .filter(
          (p: any) =>
            p &&
            typeof p.id === 'string' &&
            typeof p.name === 'string' &&
            Array.isArray(p.enabledModRelativePaths)
        )
        .map((p: any) => ({
          id: p.id,
          name: String(p.name).trim(),
          description: p.description ? String(p.description).trim() : undefined,
          createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
          updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : Date.now(),
          tab: p.tab || get().activeLibraryTab,
          enabledModRelativePaths: (p.enabledModRelativePaths as any[])
            .map((rel) =>
              String(rel || '')
                .replace(/\\/g, '/')
                .trim()
            )
            .filter(Boolean),
        }));

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

  saveCurrentProfile: async (name: string, description?: string, targetProfileId?: string) => {
    const { categories, activeLibraryTab, modsPath, profiles } = get();
    if (!modsPath) return '';

    const targetPath = getActiveModsPath(modsPath, activeLibraryTab).replace(/\\/g, '/');

    // Collect all currently enabled mod relative paths
    const enabledModRelativePaths: string[] = [];
    for (const cat of categories) {
      for (const mod of cat.mods) {
        if (mod.is_enabled) {
          const cleanRel = getCleanRelativePath(mod.full_path, targetPath);
          if (cleanRel) {
            enabledModRelativePaths.push(cleanRel);
          }
        }
      }
    }

    // Determine whether to overwrite existing profile
    let existingIdx = -1;
    if (targetProfileId) {
      existingIdx = profiles.findIndex((p) => p.id === targetProfileId);
    }
    if (existingIdx === -1) {
      existingIdx = profiles.findIndex(
        (p) => p.name.toLowerCase() === name.toLowerCase() && p.tab === activeLibraryTab
      );
    }

    const newProfiles = [...profiles];
    const profileId =
      targetProfileId || (existingIdx !== -1 ? profiles[existingIdx].id : `profile_${Date.now()}`);

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
