import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../useAppStore';
import { setMockIpcHandler, resetMockIpc } from '../../../test/mockIpc';
import type { CategoryInfo } from '../../../types/ipc';

describe('librarySlice', () => {
  beforeEach(() => {
    resetMockIpc();
    localStorage.clear();
    // Reset store state
    useAppStore.setState({
      categories: [],
      favoriteMods: [],
      favoriteCategories: [],
      selectedTags: [],
      ignoredMods: [],
      togglingMods: new Set(),
      isLoadingLibrary: false,
    });
  });

  it('updates categories via setCategories', () => {
    const mockCategories: CategoryInfo[] = [
      {
        category_name: 'Ellen Joe',
        character_id: 'ellen',
        mods: [
          {
            name: 'Maid Dress',
            full_path: 'C:/ZZMI/Mods/Ellen/Maid',
            is_enabled: true,
          },
        ],
      },
    ];

    useAppStore.getState().setCategories(mockCategories);
    expect(useAppStore.getState().categories).toEqual(mockCategories);
    expect(useAppStore.getState().categories[0].mods[0].is_enabled).toBe(true);
  });

  it('toggles a mod from enabled to disabled via toggleMod and updates store state', async () => {
    const initialCategories: CategoryInfo[] = [
      {
        category_name: 'Anby Demara',
        character_id: 'anby',
        mods: [
          {
            name: 'Casual Outfit',
            full_path: 'C:/ZZMI/Mods/Anby/Casual',
            is_enabled: true,
          },
        ],
      },
    ];
    useAppStore.getState().setCategories(initialCategories);

    let calledWith: { modPath: string; enable: boolean } | null = null;
    setMockIpcHandler('toggle_mod', (args: { modPath: string; enable: boolean }) => {
      calledWith = args;
      return 'C:/ZZMI/Mods/Anby/DISABLED_Casual';
    });

    await useAppStore.getState().toggleMod('C:/ZZMI/Mods/Anby/Casual', true);

    expect(calledWith).toEqual({
      modPath: 'C:/ZZMI/Mods/Anby/Casual',
      enable: false,
    });

    const updatedMod = useAppStore.getState().categories[0].mods[0];
    expect(updatedMod.is_enabled).toBe(false);
    expect(updatedMod.full_path).toBe('C:/ZZMI/Mods/Anby/DISABLED_Casual');
    expect(useAppStore.getState().togglingMods.size).toBe(0);
  });

  it('toggles favorite mods in and out of favorites list with DISABLED prefix handling', () => {
    expect(useAppStore.getState().favoriteMods).toEqual([]);

    // Favoriting while mod is disabled in the folder ("DISABLED ModName")
    useAppStore.getState().toggleFavoriteMod('DISABLED Ellen_Swimsuit');
    expect(useAppStore.getState().favoriteMods).toEqual(['Ellen_Swimsuit']);

    // Favoriting again while enabled un-favorites it
    useAppStore.getState().toggleFavoriteMod('Ellen_Swimsuit');
    expect(useAppStore.getState().favoriteMods).toEqual([]);

    // Also handles legacy DISABLED_ prefix
    useAppStore.getState().toggleFavoriteMod('DISABLED_Rina_Dress');
    expect(useAppStore.getState().favoriteMods).toEqual(['Rina_Dress']);
    useAppStore.getState().toggleFavoriteMod('DISABLED Rina_Dress');
    expect(useAppStore.getState().favoriteMods).toEqual([]);
  });

  it('toggles ignored mods with DISABLED prefix handling', () => {
    expect(useAppStore.getState().ignoredMods).toEqual([]);

    useAppStore.getState().toggleIgnoreMod('DISABLED TestMod');
    expect(useAppStore.getState().ignoredMods).toEqual(['TestMod']);

    useAppStore.getState().toggleIgnoreMod('TestMod');
    expect(useAppStore.getState().ignoredMods).toEqual([]);
  });

  it('resolves category entities flexibly via resolveCategoryEntity', async () => {
    const { resolveCategoryEntity } = await import('../../../types');
    const mockEntities = [
      {
        id: 'alexandrina_sebastiane',
        name: 'Alexandrina Sebastiane',
        aliases: ['Alexandrina', 'Rina', 'Sebastiane'],
        faction: 'Victoria Housekeeping Co.',
        image_url: 'portrait.png',
      },
      {
        id: 'hoshimi_miyabi',
        name: 'Hoshimi Miyabi',
        aliases: ['Miyabi'],
        faction: 'Section 6',
        image_url: 'miyabi.png',
      },
      {
        id: 'ellen_joe',
        name: 'Ellen Joe',
        aliases: ['Ellen'],
        faction: 'Victoria Housekeeping Co.',
        image_url: 'ellen.png',
      },
    ];

    // 1. Direct character_id
    expect(resolveCategoryEntity('Custom Folder', 'alexandrina_sebastiane', mockEntities)?.id).toBe(
      'alexandrina_sebastiane'
    );

    // 2. Folder named by alias: "Rina"
    expect(resolveCategoryEntity('Rina', null, mockEntities)?.id).toBe('alexandrina_sebastiane');

    // 3. Folder named by alias: "Miyabi"
    expect(resolveCategoryEntity('Miyabi', null, mockEntities)?.id).toBe('hoshimi_miyabi');

    // 4. Folder named with token: "Ellen" matches "Ellen Joe"
    expect(resolveCategoryEntity('Ellen', null, mockEntities)?.id).toBe('ellen_joe');

    // 5. Folder named "Ellen_Joe"
    expect(resolveCategoryEntity('Ellen_Joe', null, mockEntities)?.id).toBe('ellen_joe');

    // 6. Unknown folder
    expect(resolveCategoryEntity('RandomCustomModFolder', null, mockEntities)).toBeNull();
  });

  it('coalesces rapid concurrent scanModsFolder requests into a single in-flight scan', async () => {
    useAppStore.setState({ modsPath: 'C:/ZZMI/Mods' });

    let scanCount = 0;
    setMockIpcHandler('scan_mods_folder', () => {
      scanCount++;
      return [];
    });

    // Fire 3 scans concurrently
    const p1 = useAppStore.getState().scanModsFolder();
    const p2 = useAppStore.getState().scanModsFolder();
    const p3 = useAppStore.getState().scanModsFolder();

    await Promise.all([p1, p2, p3]);

    // Initial scan + at most 1 coalesced follow-up scan
    expect(scanCount).toBeLessThanOrEqual(2);
  });

  it('manages filter tags with toggleFilterTag', () => {
    expect(useAppStore.getState().selectedTags).toEqual([]);

    useAppStore.getState().toggleFilterTag('Outfit');
    expect(useAppStore.getState().selectedTags).toEqual(['Outfit']);

    useAppStore.getState().toggleFilterTag('Hair');
    expect(useAppStore.getState().selectedTags).toEqual(['Outfit', 'Hair']);

    useAppStore.getState().toggleFilterTag('Outfit');
    expect(useAppStore.getState().selectedTags).toEqual(['Hair']);
  });

  it('persists categoryFilterMode cleanly to localStorage and updates store state', () => {
    useAppStore.getState().setCategoryFilterMode('installed');
    expect(useAppStore.getState().categoryFilterMode).toBe('installed');
    expect(localStorage.getItem('categoryFilterMode')).toBe('installed');

    useAppStore.getState().setCategoryFilterMode('actives');
    expect(useAppStore.getState().categoryFilterMode).toBe('actives');
    expect(localStorage.getItem('categoryFilterMode')).toBe('actives');

    useAppStore.getState().setCategoryFilterMode('all');
    expect(useAppStore.getState().categoryFilterMode).toBe('all');
    expect(localStorage.getItem('categoryFilterMode')).toBe('all');
  });

  it('recovers categoryFilterMode from legacy JSON-quoted string in localStorage', async () => {
    const { safeGetString } = await import('../../../utils/storage');
    // Simulate legacy storage corrupted with JSON quotes: "\"installed\""
    localStorage.setItem('categoryFilterMode', JSON.stringify('installed'));
    expect(localStorage.getItem('categoryFilterMode')).toBe('"installed"');

    const recovered = safeGetString('categoryFilterMode', 'all');
    expect(recovered).toBe('installed');

    const mode = recovered === 'installed' || recovered === 'actives' ? recovered : 'all';
    expect(mode).toBe('installed');
  });
});
