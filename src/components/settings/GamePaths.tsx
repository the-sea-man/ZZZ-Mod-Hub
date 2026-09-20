import { useState } from 'react';
import { motion } from 'framer-motion';
import { open } from '@tauri-apps/plugin-dialog';
import { Folder, FolderDown, Sparkles } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { ImportModsModal } from '../Modals/ImportModsModal';

export function GamePaths() {
  const { t } = useTranslation();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const {
    modsPath,
    externalModsSourcePath,
    externalModsDefaultDepth,
    gameExePath,
    winrarPath,
    dbUrl,
    autoLaunchGame,
    watcherEnabled,
    hotreloadEnabled,
    performanceProfile,
    setModsPath,
    setExternalModsSourcePath,
    setExternalModsDefaultDepth,
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

  const handleBrowseExternalFolder = async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: t('import_browse_dialog_title', 'Select External Mod Directory'),
      });
      if (selectedPath && typeof selectedPath === 'string') {
        setExternalModsSourcePath(selectedPath);
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

        {/* External Mod Manager / Migration Card */}
        <div className="pt-2 border-t border-textMain/10">
          <div className="bg-surface-dark/60 border border-primary/20 rounded-2xl p-5 shadow-lg relative overflow-hidden space-y-4">
            {/* Ambient subtle glow */}
            <div className="absolute -top-12 -right-12 w-36 h-36 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/20 text-primary border border-primary/30 shadow-inner">
                  <FolderDown size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-textMain">
                      {t('settings_external_importer_title', 'External Mod Importer & Migration')}
                    </h3>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                      {t('settings_external_badge', 'Migration & Sync')}
                    </span>
                  </div>
                  <p className="text-xs text-textMuted mt-0.5 max-w-xl leading-relaxed">
                    {t(
                      'settings_external_importer_desc',
                      'Migrate or sync mods from another folder or mod manager. Imported mods are safely placed into Unassigned for one-click Auto-Sorting.'
                    )}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                disabled={!modsPath}
                className="px-5 py-2.5 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-white font-bold text-xs rounded-xl shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
              >
                <Sparkles size={15} className="text-amber-300" />
                <span>{t('settings_open_importer_btn', 'Launch Mod Importer')}</span>
              </button>
            </div>

            {/* Path status bar */}
            <div className="bg-black/40 border border-white/10 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-textMuted shrink-0 font-medium">
                  {externalModsSourcePath
                    ? t('settings_external_status_linked', 'Linked Source:')
                    : t('settings_external_status_unlinked', 'Source Directory:')}
                </span>
                <span className="font-mono text-textMain truncate text-[11px]">
                  {externalModsSourcePath || t('settings_external_not_set', 'Not configured')}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleBrowseExternalFolder}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-textMain font-semibold text-xs transition-all cursor-pointer"
                >
                  {externalModsSourcePath ? t('change', 'Change...') : t('browse', 'Browse...')}
                </button>
                {externalModsSourcePath && (
                  <button
                    type="button"
                    onClick={() => setExternalModsSourcePath('')}
                    className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg font-semibold text-xs transition-all cursor-pointer"
                  >
                    {t('clear', 'Clear')}
                  </button>
                )}
              </div>
            </div>

            {/* Folder Depth preferences */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
              <span className="text-textMuted">
                {t('settings_external_manager_depth', 'Default Scanning Depth:')}
              </span>
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setExternalModsDefaultDepth(d)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      (externalModsDefaultDepth ?? 0) === d
                        ? 'bg-primary/20 border-primary/50 text-primary'
                        : 'bg-white/5 border-white/10 text-textMuted hover:text-textMain'
                    }`}
                  >
                    {d === 0 ? (
                      <span className="flex items-center gap-1">
                        <Sparkles size={11} className="text-amber-400" />
                        {t('import_smart_depth_label', 'Smart (Auto)')}
                      </span>
                    ) : (
                      <>
                        {t('import_depth_label', 'Depth {{depth}}', { depth: d })}
                        {d === 1 && ' (Flat)'}
                        {d === 2 && ' (Nested)'}
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
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

      {isImportModalOpen && (
        <ImportModsModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImportComplete={scanModsFolder}
        />
      )}
    </motion.div>
  );
}
