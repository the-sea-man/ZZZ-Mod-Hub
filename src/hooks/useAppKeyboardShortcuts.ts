import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

export interface UseAppKeyboardShortcutsOptions {
  onToggleFeatureGuide?: () => void;
}

/**
 * Global keyboard shortcuts for the app window.
 *
 * `Ctrl+R` rescans the mods folder. It used to randomize the enabled mods,
 * which collided with what every other desktop app does with that key: users
 * pressing it to refresh had their whole loadout shuffled instead, and the
 * guides told them to press it for exactly that. Randomize moved to
 * `Ctrl+Shift+R`.
 *
 * Every shortcut here must also appear in the desktop shortcuts table in
 * README.md - `npm run check:docs` fails the build otherwise.
 */
export function useAppKeyboardShortcuts({
  onToggleFeatureGuide,
}: UseAppKeyboardShortcutsOptions = {}) {
  const randomizeMods = useAppStore((s) => s.randomizeMods);
  const launchGame = useAppStore((s) => s.launchGame);
  const syncDatabase = useAppStore((s) => s.syncDatabase);
  const scanModsFolder = useAppStore((s) => s.scanModsFolder);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      const key = e.key.toLowerCase();

      // Shift is checked first so Ctrl+Shift+R does not also match Ctrl+R.
      if (e.ctrlKey && e.shiftKey && key === 'r') {
        e.preventDefault();
        randomizeMods();
      } else if (e.ctrlKey && !e.shiftKey && key === 'r') {
        e.preventDefault();
        scanModsFolder();
      } else if (e.ctrlKey && key === 'g') {
        e.preventDefault();
        launchGame();
      } else if ((e.ctrlKey && key === 'k') || e.key === '/') {
        e.preventDefault();
        useAppStore.getState().setActiveTab('library');
        setTimeout(() => {
          const input = document.getElementById(
            'character-search-input'
          ) as HTMLInputElement | null;
          input?.focus();
          input?.select();
        }, 50);
      } else if (e.key === 'F5') {
        e.preventDefault();
        syncDatabase();
      } else if (e.key === 'F1' && import.meta.env.DEV && onToggleFeatureGuide) {
        e.preventDefault();
        onToggleFeatureGuide();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [randomizeMods, launchGame, syncDatabase, scanModsFolder, onToggleFeatureGuide]);
}
