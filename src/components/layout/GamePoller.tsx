import { useEffect } from 'react';
import { useAppStore, type AppStore } from '../../store/useAppStore';
import { tauriCommands } from '../../services/tauriCommands';

const selectGameExePath = (s: AppStore) => s.gameExePath;
const selectSetGameIsRunning = (s: AppStore) => s.setGameIsRunning;
const selectFastGamePolling = (s: AppStore) => s.fastGamePolling;

export function GamePoller() {
  const gameExePath = useAppStore(selectGameExePath);
  const setGameIsRunning = useAppStore(selectSetGameIsRunning);
  const fastGamePolling = useAppStore(selectFastGamePolling);

  useEffect(() => {
    const checkGame = () => {
      tauriCommands.game
        .isRunning(gameExePath || '')
        .then((res: boolean) => setGameIsRunning(!!res))
        .catch((err) => console.error('Failed to check game status:', err));
    };
    checkGame();
    // 2s when fast polling enabled, 12s relaxed when disabled
    const intervalMs = fastGamePolling ? 2000 : 12000;
    const interval = setInterval(checkGame, intervalMs);
    return () => clearInterval(interval);
  }, [setGameIsRunning, gameExePath, fastGamePolling]);

  return null;
}
