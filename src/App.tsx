import { useEffect, useState, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './components/navigation';
import { LibraryView } from './views/LibraryView';
import { UpdaterAlert } from './components/UpdaterAlert';
import { SetupView } from './views/SetupView';
import { LanguageSelectView } from './views/LanguageSelectView';
import { TutorialOverlay } from './components/TutorialOverlay';
import { ConfettiManager } from './components/ConfettiManager';
import { AchievementToastManager } from './components/AchievementToastManager';
import { useKonamiCode } from './hooks/useKonamiCode';
import { useQuickSnapperHotkey } from './hooks/useQuickSnapperHotkey';
import { useExternalLinkGuard } from './hooks/useExternalLinkGuard';
import { useAppKeyboardShortcuts } from './hooks/useAppKeyboardShortcuts';
import { useOneClickInstaller } from './hooks/useOneClickInstaller';
import { useAppStore } from './store/useAppStore';
import { useDownloadStore } from './store/useDownloadStore';
import { useTranslation } from './hooks/useTranslation';
import { useTauriListener } from './hooks/useTauriListener';
import { playInstallSuccessSound } from './utils/audio';
import type { DownloadProgressEvent, DownloadCompleteEvent, ModWarning } from './types/ipc';
import { message } from '@tauri-apps/plugin-dialog';
import { getActiveModsPath } from './types';
import { ThemeProvider } from './components/layout/ThemeProvider';
import { BackgroundEngine } from './components/layout/BackgroundEngine';
import { GamePoller } from './components/layout/GamePoller';
import { AppHeaderToolbar } from './components/layout/AppHeaderToolbar';
import { AppModalsHost } from './components/layout/AppModalsHost';
import { GlobalDropOverlay } from './components/layout/GlobalDropOverlay';
import { tauriCommands } from './services/tauriCommands';
import './App.css';

// Dynamically lazy-loaded secondary views
const SettingsView = lazy(() =>
  import('./views/SettingsView').then((m) => ({ default: m.SettingsView }))
);
const GameBananaView = lazy(() =>
  import('./views/GameBananaView').then((m) => ({ default: m.GameBananaView }))
);
const AchievementsView = lazy(() =>
  import('./views/AchievementsView').then((m) => ({ default: m.AchievementsView }))
);

function App() {
  const {
    activeTab,
    modsPath,
    setupComplete,
    performanceProfile,
    watcherEnabled,
    hotreloadEnabled,
    gameIsRunning,
    toastMessage,
    winrarPath,
    activeLibraryTab,
    loadCachedLibrary,
    scanModsFolder,
    fetchCachedDatabase,
    fetchNotifications,
    fetchAppVersion,
    checkAppUpdates,
    isSyncing,
    syncDatabase,
    randomizeMods,
    launchGame,
    disableAllMods,
    previouslyEnabledMods,
    revertDisableAll,
    tutorialsSeen,
    setActiveTutorial,
    notifications,
    readNotifications,
    lastReadNotificationTimestamp,
    hasSelectedLanguage,
    isOnline,
    setIsOnline,
    checkNetworkStatus,
    downloadImages,
    highlightTargetId,
    autoCheckUpdates,
    checkForUpdates,
  } = useAppStore();
  const { t } = useTranslation();

  const [showImagePrompt, setShowImagePrompt] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showFeatureGuide, setShowFeatureGuide] = useState(false);
  const [showTroubleshootModal, setShowTroubleshootModal] = useState(false);
  const [isDraggingGlobal, setIsDraggingGlobal] = useState(false);

  // Folder Watcher Integration — Paused in Eco/Low profile to save RAM/CPU
  useEffect(() => {
    if (modsPath && watcherEnabled && performanceProfile !== 'low') {
      tauriCommands.system.startFolderWatch(modsPath).catch((err) => {
        console.error('Failed to start folder watch:', err);
      });
    }
  }, [modsPath, watcherEnabled, performanceProfile]);

  useTauriListener('mods-folder-changed', () => {
    const { watcherEnabled, performanceProfile } = useAppStore.getState();
    if (watcherEnabled && performanceProfile !== 'low') {
      scanModsFolder();
    }
  });

  // Network Status Monitoring
  useEffect(() => {
    checkNetworkStatus();
    const handleOnline = () => {
      setIsOnline(true);
      checkNetworkStatus();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkNetworkStatus, setIsOnline]);

  // Download event listeners
  useTauriListener<DownloadProgressEvent>('download-progress', (payload) => {
    useDownloadStore.getState().addOrUpdateProgress(payload);
  });
  useTauriListener<DownloadCompleteEvent>('download-complete', (payload) => {
    useDownloadStore.getState().setComplete(payload);
    if (!payload.error) {
      useAppStore.getState().scanModsFolder();
    }
  });

  useTauriListener<Record<string, ModWarning[]>>('warnings_updated', (payload) => {
    useAppStore.getState().setModWarnings(payload);
  });

  useKonamiCode();
  useQuickSnapperHotkey();
  // Keeps a link in remote HTML (GameBanana changelogs, shared language packs)
  // from navigating the application window away from the app.
  useExternalLinkGuard();
  useOneClickInstaller();
  useAppKeyboardShortcuts({
    onToggleFeatureGuide: () => setShowFeatureGuide((prev) => !prev),
  });

  // Initial load
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener('contextmenu', handleContextMenu);

    if (setupComplete && modsPath && !tutorialsSeen.post_setup) {
      setActiveTutorial('post_setup');
    }
    loadCachedLibrary();
    fetchAppVersion();
    checkAppUpdates();
    fetchCachedDatabase();
    fetchNotifications();
    if (setupComplete && modsPath) {
      const { startupScanEnabled, autoCheckUpdates, performanceProfile } = useAppStore.getState();
      const hasCategories = useAppStore.getState().categories.length > 0;
      // In lowest mode ('low'), skip startup scan for instant cached boot (< 50ms).
      // Unless in lowest mode, always do initial verification during startup!
      const shouldScanOnStartup =
        (startupScanEnabled && performanceProfile !== 'low') || !hasCategories;
      if (shouldScanOnStartup) {
        scanModsFolder()
          .then(() => {
            if (autoCheckUpdates && performanceProfile !== 'low') {
              useAppStore.getState().checkForUpdates().catch(console.error);
            }
          })
          .catch(console.error);
      }
    } else {
      useAppStore.getState().setIsLoadingLibrary(false);
    }

    const { autoLaunchGame, gameExePath, launchGame } = useAppStore.getState();
    let autoLaunchTimer: ReturnType<typeof setTimeout> | null = null;
    if (setupComplete && autoLaunchGame && gameExePath) {
      autoLaunchTimer = setTimeout(() => {
        launchGame().catch(console.error);
      }, 3000);
    }

    return () => {
      if (autoLaunchTimer) clearTimeout(autoLaunchTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modsPath, setupComplete]);

  // Periodic Mod Updates Checker (GameBanana) — Every 60 minutes when enabled and not in low profile
  useEffect(() => {
    if (!modsPath || !autoCheckUpdates || performanceProfile === 'low') return;

    const periodicInterval = setInterval(
      () => {
        const { autoCheckUpdates: currentSetting, performanceProfile: currentPerf } =
          useAppStore.getState();
        if (currentSetting && currentPerf !== 'low') {
          checkForUpdates().catch(console.error);
        }
      },
      60 * 60 * 1000
    );

    return () => clearInterval(periodicInterval);
  }, [modsPath, autoCheckUpdates, performanceProfile, checkForUpdates]);

  useEffect(() => {
    if (activeTab === 'gamebanana' && !tutorialsSeen.discover_page)
      setActiveTutorial('discover_page');
    if (activeTab === 'achievements' && !tutorialsSeen.achievements_page)
      setActiveTutorial('achievements_page');
    if (activeTab === 'settings' && !tutorialsSeen.settings_page)
      setActiveTutorial('settings_page');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, tutorialsSeen]);

  const unreadCount = (notifications || []).filter((n) => {
    const idStr = String(n.id || '').trim();
    if (idStr && readNotifications.some((r) => String(r).trim() === idStr)) {
      return false;
    }
    if (n.date && lastReadNotificationTimestamp > 0) {
      const notifTime = new Date(n.date).getTime();
      if (!isNaN(notifTime) && notifTime <= lastReadNotificationTimestamp) {
        return false;
      }
    }
    return true;
  }).length;

  const handleSyncDatabase = async () => {
    if (!isOnline) {
      message('You are currently offline. Cloud DB sync is unavailable.', {
        title: 'Offline Mode',
      });
      return;
    }
    if (!tutorialsSeen.sync) {
      setActiveTutorial('sync');
      return;
    }

    if (downloadImages === null) {
      setShowImagePrompt(true);
      return;
    }

    await syncDatabase();
    if (!useAppStore.getState().tutorialsSeen.generate_folders) {
      setActiveTutorial('generate_folders');
    }
  };

  const handleRandomizeMods = async () => {
    if (!tutorialsSeen.randomize) {
      setActiveTutorial('randomize');
      return;
    }

    const { randomizerWhitelist } = useAppStore.getState();

    if (randomizerWhitelist.length === 0) {
      await message(
        t(
          'randomizer_empty_desc',
          'Your Randomizer list is empty! Please add characters in Settings > Mod Management.'
        ),
        {
          title: t('randomizer_empty_title', 'Randomizer Empty'),
          kind: 'info',
        }
      );
      return;
    }

    await randomizeMods();
    message('Randomization complete! Your character mods have been shuffled.', {
      title: 'Success',
    });
  };

  const handleLaunchGame = () => {
    if (!tutorialsSeen.launch_game) {
      setActiveTutorial('launch_game');
      return;
    }
    launchGame();
  };

  const handleGlobalDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingGlobal) setIsDraggingGlobal(true);
  };

  const handleGlobalDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingGlobal(false);
  };

  const handleGlobalDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingGlobal(false);

    if (!modsPath) return;

    const files = Array.from(e.dataTransfer.files);
    const archivePaths = files
      .map((f: File & { path?: string }) => f.path as string)
      .filter((p) => p && /\.(zip|rar|7z)$/i.test(p));

    if (archivePaths.length > 0) {
      try {
        await tauriCommands.install.installArchives(
          archivePaths,
          getActiveModsPath(modsPath, activeLibraryTab),
          winrarPath,
          null
        );

        useAppStore.getState().incrementStat('modsInstalledDragDrop', archivePaths.length);
        playInstallSuccessSound();
        await scanModsFolder();
      } catch (err) {
        console.error('Failed to install dropped mods:', err);
      }
    }
  };

  if (!hasSelectedLanguage) {
    return (
      <div className="h-screen w-screen overflow-hidden flex bg-transparent text-text-primary selection:bg-primary selection:text-black relative">
        <ThemeProvider />
        <BackgroundEngine />
        <LanguageSelectView />
      </div>
    );
  }

  if (!setupComplete) {
    return (
      <div className="h-screen w-screen overflow-hidden flex bg-transparent text-text-primary selection:bg-primary selection:text-black relative">
        <ThemeProvider />
        <BackgroundEngine />
        <SetupView />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-transparent text-text-primary selection:bg-primary selection:text-black relative">
      <ThemeProvider />
      <BackgroundEngine />
      <GamePoller />
      <UpdaterAlert />

      <Sidebar />

      <main
        onDragOver={handleGlobalDragOver}
        onDragLeave={handleGlobalDragLeave}
        onDrop={handleGlobalDrop}
        className="flex-1 flex flex-col min-w-0 bg-transparent relative overflow-hidden"
      >
        <GlobalDropOverlay isDragging={isDraggingGlobal} />

        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-secondary/5 rounded-full blur-[100px] pointer-events-none" />

        <AppHeaderToolbar
          isOnline={isOnline}
          unreadCount={unreadCount}
          isSyncing={isSyncing}
          previouslyEnabledMods={previouslyEnabledMods}
          gameIsRunning={gameIsRunning}
          hotreloadEnabled={hotreloadEnabled}
          highlightTargetId={highlightTargetId}
          tutorialsSeen={tutorialsSeen}
          onOpenFeatureGuide={() => setShowFeatureGuide(true)}
          onOpenNotifications={() => setShowNotifications(true)}
          onOpenTroubleshoot={() => setShowTroubleshootModal(true)}
          onSyncDatabase={handleSyncDatabase}
          onRevertDisableAll={revertDisableAll}
          onDisableAllMods={disableAllMods}
          onRandomizeMods={handleRandomizeMods}
          onLaunchGame={handleLaunchGame}
        />

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 z-10 custom-scrollbar relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="h-full flex flex-col"
            >
              <Suspense
                fallback={
                  <div className="flex-1 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                }
              >
                {activeTab === 'library' && <LibraryView />}
                {activeTab === 'gamebanana' && <GameBananaView />}
                {activeTab === 'achievements' && <AchievementsView />}
                {activeTab === 'settings' && <SettingsView />}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Global Footer Status Bar */}
        <div className="h-8 glass-panel border-t border-white/5 flex items-center justify-between px-6 shrink-0 z-20 text-xs text-textMuted select-none">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`}
              />
              <span>{isOnline ? t('online', 'Connected') : t('offline', 'Offline')}</span>
            </span>
            <span className="text-white/20">|</span>
            <span>
              {t('mods_count_status', '{{count}} categories', {
                count: useAppStore.getState().categories.length,
              })}
            </span>
          </div>
          {hotreloadEnabled && gameIsRunning && (
            <span className="text-primary text-[11px] font-bold px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
              {t('hotreload_active')}
            </span>
          )}
        </div>
      </main>

      <AppModalsHost
        showNotifications={showNotifications}
        onCloseNotifications={() => setShowNotifications(false)}
        showFeatureGuide={showFeatureGuide}
        onCloseFeatureGuide={() => setShowFeatureGuide(false)}
        showTroubleshootModal={showTroubleshootModal}
        onCloseTroubleshootModal={() => setShowTroubleshootModal(false)}
        showImagePrompt={showImagePrompt}
        onCloseImagePrompt={() => setShowImagePrompt(false)}
        onProceedImagePrompt={async () => {
          setShowImagePrompt(false);
          await syncDatabase();
          if (!useAppStore.getState().tutorialsSeen.generate_folders) {
            setActiveTutorial('generate_folders');
          }
        }}
      />

      <TutorialOverlay />
      <ConfettiManager />
      <AchievementToastManager />

      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-14 right-6 z-50 bg-surface/95 app-blur border border-primary/40 text-textMain px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold text-sm"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
