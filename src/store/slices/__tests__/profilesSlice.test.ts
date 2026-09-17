import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../useAppStore';
import { normalizeCanonicalRelativePath, getCleanRelativePath } from '../profilesSlice';
import { setMockIpcHandler, resetMockIpc } from '../../../test/mockIpc';
import type { CategoryInfo } from '../../../types/ipc';

describe('profilesSlice', () => {
  beforeEach(() => {
    resetMockIpc();
    localStorage.clear();
    useAppStore.setState({
      modsPath: 'C:/ZZMI/Mods',
      activeLibraryTab: 'playable_characters',
      categories: [],
      profiles: [],
      activeProfileId: null,
    });
  });

  describe('normalizeCanonicalRelativePath', () => {
    it('normalizes basic relative paths to lowercase and forward slashes', () => {
      expect(normalizeCanonicalRelativePath('Ellen Joe/SharkMod')).toBe('ellen joe/sharkmod');
      expect(normalizeCanonicalRelativePath('Ellen Joe\\SharkMod')).toBe('ellen joe/sharkmod');
    });

    it('strips DISABLED prefixes from mod folders and categories', () => {
      expect(normalizeCanonicalRelativePath('Ellen Joe/DISABLED SharkMod')).toBe(
        'ellen joe/sharkmod'
      );
      expect(normalizeCanonicalRelativePath('DISABLED Ellen Joe/SharkMod')).toBe(
        'ellen joe/sharkmod'
      );
      expect(normalizeCanonicalRelativePath('DISABLED Ellen Joe/DISABLED SharkMod')).toBe(
        'ellen joe/sharkmod'
      );
    });

    it('strips targetPath prefix when provided', () => {
      const targetPath = 'C:/ZZMI/Mods/Playable Characters';
      const fullPath = 'C:/ZZMI/Mods/Playable Characters/Ellen Joe/DISABLED SharkMod';
      expect(normalizeCanonicalRelativePath(fullPath, targetPath)).toBe('ellen joe/sharkmod');
    });

    it('differentiates distinct characters that share identical mod folder names', () => {
      const targetPath = 'C:/ZZMI/Mods/Playable Characters';
      const ellenMod = 'C:/ZZMI/Mods/Playable Characters/Ellen Joe/DISABLED Default';
      const janeMod = 'C:/ZZMI/Mods/Playable Characters/Jane Doe/DISABLED Default';

      const normEllen = normalizeCanonicalRelativePath(ellenMod, targetPath);
      const normJane = normalizeCanonicalRelativePath(janeMod, targetPath);

      expect(normEllen).toBe('ellen joe/default');
      expect(normJane).toBe('jane doe/default');
      expect(normEllen).not.toBe(normJane);
    });
  });

  describe('getCleanRelativePath', () => {
    it('preserves casing while stripping targetPath and DISABLED prefixes', () => {
      const targetPath = 'C:/ZZMI/Mods/Playable Characters';
      const fullPath = 'C:/ZZMI/Mods/Playable Characters/Ellen Joe/DISABLED SummerBikini';
      expect(getCleanRelativePath(fullPath, targetPath)).toBe('Ellen Joe/SummerBikini');
    });
  });

  describe('saveCurrentProfile', () => {
    it('saves enabled mods into a profile with canonical relative paths', async () => {
      const mockCategories: CategoryInfo[] = [
        {
          category_name: 'Ellen Joe',
          mods: [
            {
              name: 'Shark Suit',
              full_path: 'C:/ZZMI/Mods/Playable Characters/Ellen Joe/SharkSuit',
              is_enabled: true,
            },
            {
              name: 'Casual',
              full_path: 'C:/ZZMI/Mods/Playable Characters/Ellen Joe/DISABLED Casual',
              is_enabled: false,
            },
          ],
        },
      ];
      useAppStore.setState({ categories: mockCategories });

      const profileId = await useAppStore
        .getState()
        .saveCurrentProfile('Combat Loadout', 'My combat mods');

      const profiles = useAppStore.getState().profiles;
      expect(profiles).toHaveLength(1);
      expect(profiles[0].id).toBe(profileId);
      expect(profiles[0].name).toBe('Combat Loadout');
      expect(profiles[0].description).toBe('My combat mods');
      expect(profiles[0].tab).toBe('playable_characters');
      expect(profiles[0].enabledModRelativePaths).toEqual(['Ellen Joe/SharkSuit']);
      expect(useAppStore.getState().activeProfileId).toBe(profileId);
      expect(localStorage.getItem('active_profile_id')).toBe(profileId);
    });

    it('supports saving an empty/vanilla preset when all mods are disabled', async () => {
      const mockCategories: CategoryInfo[] = [
        {
          category_name: 'Ellen Joe',
          mods: [
            {
              name: 'Shark Suit',
              full_path: 'C:/ZZMI/Mods/Playable Characters/Ellen Joe/DISABLED SharkSuit',
              is_enabled: false,
            },
          ],
        },
      ];
      useAppStore.setState({ categories: mockCategories });

      const profileId = await useAppStore.getState().saveCurrentProfile('Vanilla Clean');

      const profile = useAppStore.getState().profiles.find((p) => p.id === profileId);
      expect(profile).toBeDefined();
      expect(profile?.enabledModRelativePaths).toEqual([]);
    });

    it('overwrites an existing profile when targetProfileId is provided', async () => {
      const initialProfileId = await useAppStore
        .getState()
        .saveCurrentProfile('Preset A', 'Initial description');

      // Now add an enabled mod and overwrite
      const mockCategories: CategoryInfo[] = [
        {
          category_name: 'Ellen Joe',
          mods: [
            {
              name: 'New Skin',
              full_path: 'C:/ZZMI/Mods/Playable Characters/Ellen Joe/NewSkin',
              is_enabled: true,
            },
          ],
        },
      ];
      useAppStore.setState({ categories: mockCategories });

      const updatedId = await useAppStore
        .getState()
        .saveCurrentProfile('Preset A (Renamed)', 'New description', initialProfileId);

      expect(updatedId).toBe(initialProfileId);
      const profiles = useAppStore.getState().profiles;
      expect(profiles).toHaveLength(1);
      expect(profiles[0].name).toBe('Preset A (Renamed)');
      expect(profiles[0].description).toBe('New description');
      expect(profiles[0].enabledModRelativePaths).toEqual(['Ellen Joe/NewSkin']);
    });
  });

  describe('applyProfile', () => {
    it('applies profile and toggles mods without cross-character folder name collisions', async () => {
      const ellenMod = 'C:/ZZMI/Mods/Playable Characters/Ellen Joe/DISABLED Default';
      const janeMod = 'C:/ZZMI/Mods/Playable Characters/Jane Doe/DISABLED Default';
      const nicoleMod = 'C:/ZZMI/Mods/Playable Characters/Nicole/ActiveSuit';

      const mockCategories: CategoryInfo[] = [
        {
          category_name: 'Ellen Joe',
          mods: [{ name: 'Default', full_path: ellenMod, is_enabled: false }],
        },
        {
          category_name: 'Jane Doe',
          mods: [{ name: 'Default', full_path: janeMod, is_enabled: false }],
        },
        {
          category_name: 'Nicole',
          mods: [{ name: 'ActiveSuit', full_path: nicoleMod, is_enabled: true }],
        },
      ];
      useAppStore.setState({ categories: mockCategories });

      // Create a profile that ONLY enables Ellen Joe's "Default" mod
      const profileId = 'test_ellen_only';
      useAppStore.setState({
        profiles: [
          {
            id: profileId,
            name: 'Ellen Only',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            tab: 'playable_characters',
            enabledModRelativePaths: ['Ellen Joe/Default'],
          },
        ],
      });

      const bulkToggleCalls: { modPaths: string[]; enable: boolean }[] = [];
      setMockIpcHandler('bulk_toggle_mods', (args: { modPaths: string[]; enable: boolean }) => {
        bulkToggleCalls.push(args);
        return [];
      });

      await useAppStore.getState().applyProfile(profileId);

      // Verify toggles:
      // 1. Nicole's ActiveSuit should be DISABLED (was enabled, but not in profile)
      const disableCall = bulkToggleCalls.find((c) => !c.enable);
      expect(disableCall).toBeDefined();
      expect(disableCall?.modPaths).toContain(nicoleMod);

      // 2. Ellen's Default should be ENABLED (was disabled, in profile)
      const enableCall = bulkToggleCalls.find((c) => c.enable);
      expect(enableCall).toBeDefined();
      expect(enableCall?.modPaths).toContain(ellenMod);

      // 3. CRITICAL: Jane Doe's Default must NOT be enabled!
      expect(enableCall?.modPaths).not.toContain(janeMod);

      expect(useAppStore.getState().activeProfileId).toBe(profileId);
      expect(localStorage.getItem('active_profile_id')).toBe(profileId);
    });
  });

  describe('deleteProfile', () => {
    it('deletes a profile and cleans up activeProfileId if active was deleted', () => {
      useAppStore.setState({
        profiles: [
          {
            id: 'prof_1',
            name: 'Profile 1',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            tab: 'playable_characters',
            enabledModRelativePaths: [],
          },
          {
            id: 'prof_2',
            name: 'Profile 2',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            tab: 'playable_characters',
            enabledModRelativePaths: [],
          },
        ],
        activeProfileId: 'prof_1',
      });
      localStorage.setItem('active_profile_id', 'prof_1');

      useAppStore.getState().deleteProfile('prof_1');

      expect(useAppStore.getState().profiles).toHaveLength(1);
      expect(useAppStore.getState().profiles[0].id).toBe('prof_2');
      expect(useAppStore.getState().activeProfileId).toBeNull();
      expect(localStorage.getItem('active_profile_id')).toBeNull();
    });
  });

  describe('exportProfiles & importProfiles', () => {
    it('exports profiles as valid JSON', () => {
      useAppStore.setState({
        profiles: [
          {
            id: 'p1',
            name: 'Test Preset',
            createdAt: 1000,
            updatedAt: 2000,
            tab: 'playable_characters',
            enabledModRelativePaths: ['Ellen Joe/Shark'],
          },
        ],
      });

      const json = useAppStore.getState().exportProfiles();
      const parsed = JSON.parse(json);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe('Test Preset');
    });

    it('imports and merges valid profiles', () => {
      useAppStore.setState({
        profiles: [
          {
            id: 'existing_p',
            name: 'Old Name',
            createdAt: 1000,
            updatedAt: 1000,
            tab: 'playable_characters',
            enabledModRelativePaths: [],
          },
        ],
      });

      const importPayload = JSON.stringify([
        {
          id: 'existing_p',
          name: 'Updated Name',
          tab: 'playable_characters',
          enabledModRelativePaths: ['Ellen Joe/Shark'],
        },
        {
          id: 'new_p',
          name: 'Brand New',
          tab: 'playable_characters',
          enabledModRelativePaths: ['Jane Doe/Casual'],
        },
      ]);

      const success = useAppStore.getState().importProfiles(importPayload);
      expect(success).toBe(true);

      const profiles = useAppStore.getState().profiles;
      expect(profiles).toHaveLength(2);
      expect(profiles.find((p) => p.id === 'existing_p')?.name).toBe('Updated Name');
      expect(profiles.find((p) => p.id === 'new_p')?.name).toBe('Brand New');
    });

    it('rejects invalid or corrupted JSON gracefully', () => {
      const result = useAppStore.getState().importProfiles('{ not an array }');
      expect(result).toBe(false);

      const result2 = useAppStore.getState().importProfiles(JSON.stringify([{}]));
      expect(result2).toBe(false);
    });
  });
});
