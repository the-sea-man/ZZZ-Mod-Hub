import { useEffect } from 'react';
import { register, isRegistered, unregister } from '@tauri-apps/plugin-global-shortcut';
import { useAppStore } from '../store/useAppStore';

declare global {
  interface Window {
    triggerQuickSnapper?: () => Promise<void>;
  }
}

export function useQuickSnapperHotkey() {
  const quickSnapperEnabled = useAppStore((s) => s.quickSnapperEnabled);
  const quickSnapperHotkey = useAppStore((s) => s.quickSnapperHotkey);

  useEffect(() => {
    let isMounted = true;
    let registeredHotkey: string | null = null;

    const setupQuickSnapperHotkey = async () => {
      if (!quickSnapperEnabled || !quickSnapperHotkey) return;

      try {
        const isReg = await isRegistered(quickSnapperHotkey);
        if (isReg) {
          await unregister(quickSnapperHotkey).catch(() => {});
        }
        if (!isMounted) return;

        await register(quickSnapperHotkey, async (event) => {
          if (event.state === 'Pressed') {
            useAppStore.getState().executeQuickSnap();
          }
        });
        registeredHotkey = quickSnapperHotkey;
      } catch (err) {
        console.error(`Failed to register Quick Snapper hotkey (${quickSnapperHotkey}):`, err);
      }
    };

    setupQuickSnapperHotkey();

    // Expose to window for testing / programmatic trigger
    window.triggerQuickSnapper = async () => {
      await useAppStore.getState().executeQuickSnap();
    };

    return () => {
      isMounted = false;
      if (registeredHotkey) {
        unregister(registeredHotkey).catch(() => {});
      }
      delete window.triggerQuickSnapper;
    };
  }, [quickSnapperEnabled, quickSnapperHotkey]);
}
