import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

export interface UseAppKeyboardShortcutsOptions {
  onToggleFeatureGuide?: () => void;
}

export function useAppKeyboardShortcuts({
  onToggleFeatureGuide,
}: UseAppKeyboardShortcutsOptions = {}) {
  const randomizeMods = useAppStore((s) => s.randomizeMods);
  const launchGame = useAppStore((s) => s.launchGame);
  const syncDatabase = useAppStore((s) => s.syncDatabase);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      if (e.ctrlKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        randomizeMods();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        launchGame();
      } else if ((e.ctrlKey && e.key.toLowerCase() === 'k') || e.key === '/') {
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
  }, [randomizeMods, launchGame, syncDatabase, onToggleFeatureGuide]);
}
