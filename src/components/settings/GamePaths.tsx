import { motion } from 'framer-motion';
import { open } from '@tauri-apps/plugin-dialog';
import { Folder } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

export function GamePaths() {
  const { t } = useTranslation();
  const {
    modsPath,
    gameExePath,
    winrarPath,
    dbUrl,
    autoLaunchGame,
    watcherEnabled,
    hotreloadEnabled,
    performanceProfile,
    setModsPath,
    setGameExePath,
    setWinrarPath,
    setDbUrl,
    setAutoLaunchGame,
    setWatcherEnabled,
    setHotreloadEnabled,
    scanModsFolder,
    highlightTargetId,
  } = useAppStore();

  const handleBrowseFolder = async () => {
    try {
      const selectedPath = await open({ directory: true, multiple: false });
      if (selectedPath && typeof selectedPath === 'string') {
        setModsPath(selectedPath);
        scanModsFolder();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleBrowseExe = async () => {
    try {
      const selectedPath = await open({
        directory: false,
        multiple: false,
        filters: [{ name: 'Executable', extensions: ['exe'] }],
      });
      if (selectedPath && typeof selectedPath === 'string') {
        setGameExePath(selectedPath);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <motion.div
      data-highlight-id="game_paths_settings"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.3 }}
      className={`glass-panel border border-textMain/5 rounded-3xl p-8 shadow-xl transition-all hover:shadow-2xl hover:border-textMain/10 ${
        highlightTargetId === 'game_paths_settings' ? 'highlight-target' : ''
      }`}
    >
      <h2 className="text-xl font-bold text-textMain mb-6 flex items-center gap-3">
        <Folder size={28} className="text-primary" /> {t('settings_game_paths')}
      </h2>
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-textMuted mb-2">
            {t('settings_mods_folder_path')}
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={modsPath}
              onChange={(e) => setModsPath(e.target.value)}
              onBlur={() => {
                if (modsPath.trim()) scanModsFolder();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && modsPath.trim()) scanModsFolder();
              }}
              className="flex-1 bg-background/50 border border-textMain/10 rounded-xl px-4 py-3 font-mono text-sm text-textMain focus:outline-none focus:border-primary/50 transition-all"
              placeholder="%appdata%\XXMI Launcher\ZZMI\Mods"
            />
            <button
              onClick={handleBrowseFolder}
              className="px-6 bg-primary text-white rounded-xl font-bold hover:bg-primary/80 transition-all shadow-lg shadow-primary/20 shrink-0"
            >
              {t('browse')}
            </button>
            <button
              onClick={() => {
                setModsPath('');
                localStorage.removeItem('mods_path');
              }}
              className="px-4 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl font-bold hover:bg-red-500/20 transition-all shrink-0"
            >
              {t('clear')}
            </button>
          </div>
          <p className="text-xs text-textMuted mt-2">{t('settings_mods_folder_desc')}</p>

          <div className="flex items-center justify-between pt-3">
            <div>
              <span className="font-bold text-textMain block text-sm">
                {t('settings_watcher_title')}
              </span>
              <span className="text-xs text-textMuted">{t('settings_watcher_desc')}</span>
            </div>
            <button
              onClick={() => setWatcherEnabled(!watcherEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${watcherEnabled ? 'bg-primary' : 'bg-white/10'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${watcherEnabled ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
          </div>
          {performanceProfile === 'low' && (
            <p className="text-[11px] text-emerald-400 mt-1">
              {t(
                'watcher_profile_managed_note',
                'Folder watching is paused in Eco profile to preserve system resources.'
              )}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-bold text-textMuted mb-2">
            {t('settings_game_exe_path')}
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={gameExePath}
              onChange={(e) => setGameExePath(e.target.value)}
              className="flex-1 bg-background/50 border border-textMain/10 rounded-xl px-4 py-3 font-mono text-sm text-textMain focus:outline-none focus:border-primary/50 transition-all"
              placeholder='"C:\Path\To\Game.exe" --args'
            />
            <button
              onClick={handleBrowseExe}
              className="px-6 bg-surface border border-textMain/10 text-textMain rounded-xl font-bold hover:bg-background transition-all shrink-0"
            >
              {t('browse')}
            </button>
          </div>
          <p className="text-xs text-textMuted mt-2">{t('settings_game_exe_desc')}</p>

          <div className="flex items-center justify-between pt-3">
            <div>
              <span className="font-bold text-textMain block text-sm">
                {t('auto_launch_game', 'Auto-Launch Game on Startup')}
              </span>
              <span className="text-xs text-textMuted">
                {t(
                  'auto_launch_game_desc',
                  'Automatically launch game executable after a 3-second delay on app launch.'
                )}
              </span>
            </div>
            <button
              onClick={() => setAutoLaunchGame(!autoLaunchGame)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoLaunchGame ? 'bg-primary' : 'bg-white/10'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoLaunchGame ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between pt-3">
            <div>
              <span className="font-bold text-textMain block text-sm">
                {t('settings_hotreload_title')}
              </span>
              <span className="text-xs text-textMuted">{t('settings_hotreload_desc')}</span>
            </div>
            <button
              onClick={() => setHotreloadEnabled(!hotreloadEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${hotreloadEnabled ? 'bg-primary' : 'bg-white/10'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${hotreloadEnabled ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-textMuted mb-2">
            {t('settings_winrar_path')}
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={winrarPath}
              onChange={(e) => setWinrarPath(e.target.value)}
              className="flex-1 bg-background/50 border border-textMain/10 rounded-xl px-4 py-3 font-mono text-sm text-textMain focus:outline-none focus:border-primary/50 transition-all"
              placeholder="C:\Program Files\WinRAR\WinRAR.exe"
            />
          </div>
          <p className="text-xs text-textMuted mt-2">{t('settings_winrar_desc')}</p>
        </div>

        <div>
          <label className="block text-sm font-bold text-textMuted mb-2">
            {t('settings_db_url')}
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={dbUrl}
              onChange={(e) => setDbUrl(e.target.value)}
              className="flex-1 bg-background/50 border border-textMain/10 rounded-xl px-4 py-3 font-mono text-sm text-textMain focus:outline-none focus:border-primary/50 transition-all"
              placeholder="https://raw.githubusercontent.com/..."
            />
          </div>
          <p className="text-xs text-textMuted mt-2">{t('settings_db_url_desc')}</p>
        </div>
      </div>
    </motion.div>
  );
}
