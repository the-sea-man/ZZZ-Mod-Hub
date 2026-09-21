import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAppKeyboardShortcuts } from '../useAppKeyboardShortcuts';
import { useAppStore } from '../../store/useAppStore';

/**
 * `Ctrl+R` used to randomize the enabled mods while every guide told users to
 * press it to refresh, so following the docs shuffled their loadout. These pin
 * the corrected mapping, including the part that is easy to get wrong: with
 * Shift held, `e.key` is still "R", so a naive `key === 'r'` check matches both
 * combinations and the rescan fires alongside the randomize.
 */
describe('useAppKeyboardShortcuts', () => {
  let randomizeMods: ReturnType<typeof vi.fn>;
  let scanModsFolder: ReturnType<typeof vi.fn>;
  let launchGame: ReturnType<typeof vi.fn>;
  let syncDatabase: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    randomizeMods = vi.fn();
    scanModsFolder = vi.fn();
    launchGame = vi.fn();
    syncDatabase = vi.fn();
    useAppStore.setState({
      randomizeMods,
      scanModsFolder,
      launchGame,
      syncDatabase,
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function press(init: KeyboardEventInit) {
    window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
  }

  it('rescans the mods folder on Ctrl+R', () => {
    renderHook(() => useAppKeyboardShortcuts());
    press({ key: 'r', ctrlKey: true });

    expect(scanModsFolder).toHaveBeenCalledTimes(1);
    expect(randomizeMods).not.toHaveBeenCalled();
  });

  it('randomizes on Ctrl+Shift+R without also rescanning', () => {
    renderHook(() => useAppKeyboardShortcuts());
    press({ key: 'R', ctrlKey: true, shiftKey: true });

    expect(randomizeMods).toHaveBeenCalledTimes(1);
    expect(scanModsFolder).not.toHaveBeenCalled();
  });

  it('launches the game on Ctrl+G and syncs on F5', () => {
    renderHook(() => useAppKeyboardShortcuts());
    press({ key: 'g', ctrlKey: true });
    press({ key: 'F5' });

    expect(launchGame).toHaveBeenCalledTimes(1);
    expect(syncDatabase).toHaveBeenCalledTimes(1);
  });

  it('ignores shortcuts while the user is typing', () => {
    renderHook(() => useAppKeyboardShortcuts());

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', ctrlKey: true, bubbles: true }));

    expect(scanModsFolder).not.toHaveBeenCalled();
    expect(randomizeMods).not.toHaveBeenCalled();
    input.remove();
  });

  it('does not fire on a bare R', () => {
    renderHook(() => useAppKeyboardShortcuts());
    press({ key: 'r' });

    expect(scanModsFolder).not.toHaveBeenCalled();
    expect(randomizeMods).not.toHaveBeenCalled();
  });
});
