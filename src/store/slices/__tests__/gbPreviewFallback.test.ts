import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../useAppStore';
import { resetGbPreviewSession } from '../preferencesSlice';
import { setMockIpcHandler, resetMockIpc } from '../../../test/mockIpc';
import type { ModInfo } from '../../../types';

/**
 * The GameBanana preview fallback shows a mod's first GameBanana screenshot on
 * its library card when the mod folder has no preview of its own.
 *
 * `fetchMissingGbPreviews` runs every time the library's categories change,
 * which includes every mod toggle. These pin the properties that keep that from
 * turning into a stream of requests to GameBanana.
 */

function gbMod(id: number, overrides: Partial<ModInfo> = {}): ModInfo {
  return {
    name: `mod-${id}`,
    full_path: `C:/Mods/mod-${id}`,
    path: `C:/Mods/mod-${id}`,
    enabled: true,
    is_enabled: true,
    preview_url: undefined,
    meta: { gb_mod_id: id },
    ...overrides,
  } as unknown as ModInfo;
}

function screenshotItem(id: number) {
  return {
    _idRow: id,
    _aPreviewContent: {
      screenshots: [
        { _sBaseUrl: 'https://images.gamebanana.com/img/ss/mods', _sFile800: `${id}-800.jpg` },
      ],
    },
  };
}

describe('GameBanana preview fallback', () => {
  let calls: number[][];

  beforeEach(() => {
    localStorage.clear();
    resetMockIpc();
    resetGbPreviewSession();
    calls = [];
    useAppStore.setState({ fallbackGbPreviews: true, gbPreviewCache: {} } as never);
  });

  it('does nothing while the feature is switched off', async () => {
    useAppStore.setState({ fallbackGbPreviews: false } as never);
    setMockIpcHandler('fetch_gb_mods_multi', ({ ids }: { ids: number[] }) => {
      calls.push(ids);
      return [];
    });

    await useAppStore.getState().fetchMissingGbPreviews([gbMod(1)]);
    expect(calls).toHaveLength(0);
  });

  it('never asks GameBanana about a mod that already has its own preview', async () => {
    setMockIpcHandler('fetch_gb_mods_multi', ({ ids }: { ids: number[] }) => {
      calls.push(ids);
      return [];
    });

    await useAppStore
      .getState()
      .fetchMissingGbPreviews([gbMod(1, { preview_url: 'C:/Mods/mod-1/preview.png' } as never)]);
    expect(calls).toHaveLength(0);
  });

  it('caches the first screenshot and does not refetch it', async () => {
    setMockIpcHandler('fetch_gb_mods_multi', ({ ids }: { ids: number[] }) => {
      calls.push(ids);
      return ids.map(screenshotItem);
    });

    await useAppStore.getState().fetchMissingGbPreviews([gbMod(7)]);
    expect(useAppStore.getState().gbPreviewCache[7]).toBe(
      'https://images.gamebanana.com/img/ss/mods/7-800.jpg'
    );

    await useAppStore.getState().fetchMissingGbPreviews([gbMod(7)]);
    expect(calls).toHaveLength(1);
  });

  it('does not re-request a mod GameBanana has no screenshot for', async () => {
    // A mod page with no screenshot, or one that no longer exists. Without a
    // record of the miss, every library change (including every toggle) asks
    // GameBanana about it again.
    setMockIpcHandler('fetch_gb_mods_multi', ({ ids }: { ids: number[] }) => {
      calls.push(ids);
      return ids.map((id) => ({ _idRow: id }));
    });

    await useAppStore.getState().fetchMissingGbPreviews([gbMod(42)]);
    await useAppStore.getState().fetchMissingGbPreviews([gbMod(42)]);
    await useAppStore.getState().fetchMissingGbPreviews([gbMod(42)]);

    expect(calls).toHaveLength(1);
  });

  it('only accepts https image URLs', async () => {
    setMockIpcHandler('fetch_gb_mods_multi', () => [
      {
        _idRow: 9,
        _aPreviewContent: {
          screenshots: [{ _sBaseUrl: 'javascript:alert(1)//', _sFile800: 'x.jpg' }],
        },
      },
    ]);

    await useAppStore.getState().fetchMissingGbPreviews([gbMod(9)]);
    expect(useAppStore.getState().gbPreviewCache[9]).toBeUndefined();
  });

  it('downloads preview image directly to mod folder and updates category preview_url', async () => {
    let downloadedToPath = '';
    let downloadedImageUrl = '';

    setMockIpcHandler('fetch_gb_mods_multi', ({ ids }: { ids: number[] }) => {
      return ids.map(screenshotItem);
    });

    setMockIpcHandler(
      'download_mod_preview',
      ({ modPath, imageUrl }: { modPath: string; imageUrl: string }) => {
        downloadedToPath = modPath;
        downloadedImageUrl = imageUrl;
        return `${modPath}/preview.jpg`;
      }
    );

    const targetMod = gbMod(77);
    useAppStore.setState({
      categories: [
        {
          category_name: 'Ellen Joe',
          mods: [targetMod],
        },
      ],
    } as never);

    await useAppStore.getState().fetchMissingGbPreviews([targetMod]);

    expect(downloadedToPath).toBe('C:/Mods/mod-77');
    expect(downloadedImageUrl).toBe('https://images.gamebanana.com/img/ss/mods/77-800.jpg');

    const updatedCategory = useAppStore
      .getState()
      .categories.find((c) => c.category_name === 'Ellen Joe');
    const updatedMod = updatedCategory?.mods.find((m) => m.name === 'mod-77');
    expect(updatedMod?.preview_url).toBe('C:/Mods/mod-77/preview.jpg');
  });
});
