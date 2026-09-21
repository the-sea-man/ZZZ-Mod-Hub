import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import { confirm } from '@tauri-apps/plugin-dialog';
import { sanitizeHtml } from '../../utils/safeHtml';
import { useTranslation } from '../../hooks/useTranslation';
import {
  X,
  Clock,
  FileArchive,
  Loader2,
  Globe,
  CheckCircle2,
  PlusCircle,
  RefreshCw,
  Sparkles,
  User,
  AlertCircle,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useDownloadStore } from '../../store/useDownloadStore';
import { UpdateAvailable } from '../../types';

interface ModUpdaterModalProps {
  update: UpdateAvailable;
  onClose: () => void;
}

export const ModUpdaterModal: React.FC<ModUpdaterModalProps> = ({ update, onClose }) => {
  const { t } = useTranslation();
  const { modsPath, winrarPath, ignoreModUpdate, showToast, setActiveModPreview } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modDetails, setModDetails] = useState<any | null>(null);
  const [updateLogs, setUpdateLogs] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, [update.gb_mod_id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Concurrently fetch profile details (for all available files) and update changelogs
      const [profileRes, updatesRes] = await Promise.allSettled([
        invoke<any>('fetch_gb_mod_details', { modId: update.gb_mod_id, modelName: 'Mod' }),
        invoke<any>('fetch_mod_updates_v13', { modId: update.gb_mod_id }),
      ]);

      let hasData = false;

      if (profileRes.status === 'fulfilled' && profileRes.value) {
        setModDetails(profileRes.value);
        hasData = true;
      }

      if (updatesRes.status === 'fulfilled' && Array.isArray(updatesRes.value)) {
        setUpdateLogs(updatesRes.value);
        hasData = true;
      }

      if (!hasData) {
        setError(t('no_updates_found', 'No updates found.'));
      }
    } catch (e: any) {
      setError(e.toString());
    } finally {
      setLoading(false);
    }
  };

  const allFiles: any[] =
    modDetails?._aFiles ||
    (updateLogs.length > 0 && updateLogs[0]?._aFiles ? updateLogs[0]._aFiles : []) ||
    [];

  const latestUpdate = updateLogs.length > 0 ? updateLogs[0] : null;

  const handleInstallAsNew = (file: any) => {
    useDownloadStore.getState().startDownload({
      downloadUrl: file._sDownloadUrl,
      fileName: file._sFile,
      modName: update.mod_name,
      modUrl: `https://gamebanana.com/mods/${update.gb_mod_id}`,
      modData: modDetails || latestUpdate,
      rootPath: modsPath,
      winrarPath,
      targetCategory: null,
      gbModId: update.gb_mod_id,
    });

    showToast(`Downloading "${file._sFile}" as new mod...`);
    onClose();
  };

  const handleReplaceCurrent = async (file: any) => {
    const confirmed = await confirm(
      t(
        'replace_confirm_msg',
        'Replace current mod with this file? The existing folder will be safely backed up and disabled.'
      ),
      { title: t('replace_current_mod', 'Replace Current Mod'), kind: 'warning' }
    );
    if (!confirmed) return;

    // Safely back up the existing mod folder by renaming it
    const currentFolderName = update.mod_path.split(/[/\\]/).pop() || update.mod_name;
    const cleanName = currentFolderName.replace(/^DISABLED\s+/, '');
    const dateStr = new Date().toISOString().slice(0, 10);
    const backupName = `DISABLED [Backup ${dateStr}] ${cleanName}`;

    try {
      await invoke('rename_mod', { modPath: update.mod_path, newName: backupName });
    } catch (err) {
      console.warn('Could not auto-backup prior folder:', err);
    }

    useDownloadStore.getState().startDownload({
      downloadUrl: file._sDownloadUrl,
      fileName: file._sFile,
      modName: update.mod_name,
      modUrl: `https://gamebanana.com/mods/${update.gb_mod_id}`,
      modData: modDetails || latestUpdate,
      rootPath: modsPath,
      winrarPath,
      targetCategory: null,
      gbModId: update.gb_mod_id,
    });

    useAppStore.getState().incrementStat('modsUpdated');
    showToast(`Downloading replacement for "${update.mod_name}"...`);
    onClose();
  };

  const handleIgnore = () => {
    ignoreModUpdate(update.gb_mod_id, update.new_timestamp);
    showToast(t('update_marked_seen', 'Update marked as seen.'));
    onClose();
  };

  const handleOpenGb = () => {
    if (modDetails) {
      setActiveModPreview(modDetails);
      onClose();
    } else {
      invoke('open_url', { url: `https://gamebanana.com/mods/${update.gb_mod_id}` });
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '';
    return new Date(timestamp * 1000).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md transition-all duration-300"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-3xl bg-zinc-900/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col relative animate-in fade-in zoom-in-95 duration-200"
        style={{ maxHeight: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-textMain flex items-center gap-2">
                <span>{t('page_activity_title', 'Mod Page Activity')}</span>
              </h2>
              <div className="flex items-center gap-2 text-xs text-textMuted mt-0.5">
                <span className="font-semibold text-textMain/90 truncate max-w-md">
                  {update.mod_name}
                </span>
                {modDetails?._aSubmitter?._sName && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <User size={11} />
                      {modDetails._aSubmitter._sName}
                    </span>
                  </>
                )}
                {update.new_timestamp > 0 && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {formatDate(update.new_timestamp)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-lg text-textMuted hover:text-white transition-colors cursor-pointer"
            title={t('close', 'Close')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-textMuted">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
              <p className="text-sm font-medium">
                {t('fetching_update_details', 'Fetching update details...')}
              </p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          ) : (
            <>
              {/* Patch Notes / Changelog */}
              {latestUpdate ? (
                <div className="bg-surface/60 rounded-xl border border-white/5 overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-textMain">
                        {t('patch_notes', 'Patch Notes & Changelog')}
                      </span>
                      {latestUpdate._sVersion && (
                        <span className="px-2 py-0.5 bg-primary/20 text-primary font-bold text-[10px] rounded">
                          v{latestUpdate._sVersion}
                        </span>
                      )}
                    </div>
                    {latestUpdate._tsDateAdded && (
                      <span className="text-[10px] text-textMuted flex items-center gap-1">
                        <Clock size={11} />
                        {formatDate(latestUpdate._tsDateAdded)}
                      </span>
                    )}
                  </div>

                  <div className="p-4 text-xs text-textMain/90 leading-relaxed">
                    {latestUpdate._sText ? (
                      <div
                        className="prose prose-invert prose-xs max-w-none prose-a:text-primary hover:prose-a:underline"
                        dangerouslySetInnerHTML={{
                          __html: sanitizeHtml(latestUpdate._sText),
                        }}
                      />
                    ) : (
                      <p className="italic text-textMuted">
                        {t('no_changelog_provided', 'No changelog provided.')}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-surface/30 p-3 rounded-xl border border-white/5 text-xs text-textMuted italic flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0 text-textMuted/60" />
                  <span>
                    {t(
                      'no_changelog_provided',
                      'No changelog notes published. Check the files list below or view the GameBanana page.'
                    )}
                  </span>
                </div>
              )}

              {/* Files Available on GameBanana */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold text-textMain uppercase tracking-wider flex items-center gap-1.5">
                    <span>{t('files_on_page', 'Available Files on GameBanana')}</span>
                    <span className="text-textMuted font-normal normal-case">
                      ({allFiles.length})
                    </span>
                  </h3>
                  <span className="text-[10px] text-textMuted">
                    Choose whether to install as a new mod or replace current
                  </span>
                </div>

                {allFiles.length === 0 ? (
                  <div className="bg-surface/40 p-4 rounded-xl border border-white/5 text-center text-xs text-textMuted">
                    {t('no_files_found_update', 'No downloadable files found on this page.')}
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {allFiles.map((file: any) => (
                      <div
                        key={file._idRow}
                        className="bg-surface/60 border border-white/5 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-white/10 transition-colors"
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                            <FileArchive size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-xs text-textMain truncate">
                              {file._sFile}
                            </div>
                            {file._sDescription && (
                              <div className="text-[11px] text-textMuted mt-0.5 line-clamp-2">
                                {file._sDescription}
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-[10px] text-textMuted mt-1.5">
                              <span className="font-mono bg-black/40 px-1.5 py-0.5 rounded text-textMain/80">
                                {formatSize(file._nFilesize)}
                              </span>
                              {file._tsDateAdded && (
                                <span>Uploaded {formatDate(file._tsDateAdded)}</span>
                              )}
                              {file._sVersion && (
                                <span className="bg-white/5 px-1 rounded">v{file._sVersion}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action buttons per file */}
                        <div className="flex items-center gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                          <button
                            type="button"
                            onClick={() => handleInstallAsNew(file)}
                            className="px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer hover:scale-[1.02]"
                            title="Download and install in a separate folder without altering current mod"
                          >
                            <PlusCircle size={13} />
                            <span>{t('install_as_new', 'Install as New Mod')}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleReplaceCurrent(file)}
                            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-textMain/90 border border-white/10 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer hover:scale-[1.02]"
                            title="Safely backs up old mod folder and replaces with this file"
                          >
                            <RefreshCw size={13} />
                            <span>{t('replace_current_mod', 'Replace Current Mod')}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleOpenGb}
            className="px-3 py-1.5 bg-surface hover:bg-surface/80 border border-white/10 text-textMain text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Globe size={13} className="text-primary" />
            <span>{t('open_gamebanana_page', 'Open on GameBanana')}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleIgnore}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-textMuted hover:text-textMain border border-white/5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Dismisses the update badge for this version"
            >
              <CheckCircle2 size={13} />
              <span>{t('mark_as_seen', 'Mark as Seen')}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-textMain text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              {t('close', 'Close')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
