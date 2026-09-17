import { useState, useEffect, useMemo } from 'react';
import {
  RotateCcw,
  AlertTriangle,
  FileCode,
  CheckSquare,
  Square,
  Clock,
  HardDrive,
  ShieldCheck,
  FolderOpen,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { tauriCommands } from '../../services/tauriCommands';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { playSyncSound } from '../../utils/audio';
import type { ModBackupInfo } from '../../types/ipc';

interface RestoreBackupModalProps {
  modPath: string;
  modName: string;
  onClose: () => void;
  onRestored?: () => void;
}

export function RestoreBackupModal({
  modPath,
  modName,
  onClose,
  onRestored,
}: RestoreBackupModalProps) {
  const { t } = useTranslation();
  const { showToast, scanModsFolder } = useAppStore();

  const [backups, setBackups] = useState<ModBackupInfo[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [keepBackups, setKeepBackups] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBackups = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const items = await tauriCommands.diagnostics.listModBackups(modPath);
      setBackups(items);
      // Select all backups by default
      setSelectedPaths(new Set(items.map((b) => b.backup_path)));
    } catch (e: unknown) {
      console.error('Failed to list mod backups:', e);
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, [modPath]);

  const toggleSelect = (path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedPaths(new Set(backups.map((b) => b.backup_path)));
  };

  const deselectAll = () => {
    setSelectedPaths(new Set());
  };

  const formatSize = (bytes?: number | null) => {
    if (bytes == null || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp?: number | null) => {
    if (!timestamp) return null;
    return new Date(timestamp * 1000).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const selectedTargetFiles = useMemo(() => {
    const list: string[] = [];
    for (const b of backups) {
      if (selectedPaths.has(b.backup_path)) {
        list.push(b.target_file_name);
      }
    }
    return list;
  }, [backups, selectedPaths]);

  const handleRestore = async () => {
    if (selectedPaths.size === 0) return;
    setIsRestoring(true);
    setError(null);

    try {
      const res = await tauriCommands.diagnostics.restoreSelectedModBackups(
        modPath,
        Array.from(selectedPaths),
        keepBackups
      );

      if (res.success) {
        playSyncSound();
        showToast(
          t('restore_success', {
            defaultValue: 'Successfully restored {{count}} files from backup.',
            count: res.restored_files.length,
          })
        );
        await scanModsFolder();
        onRestored?.();
        onClose();
      } else {
        setError(res.error || t('restore_no_backups', 'Failed to restore selected files.'));
      }
    } catch (e: unknown) {
      console.error('Failed to restore mod backups:', e);
      setError(String(e));
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      maxWidth="2xl"
      title={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <RotateCcw size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-textMain">
              {t('restore_backup_title', 'Restore Mod from Backup')}
            </h2>
            <p className="text-xs text-textMuted truncate max-w-md">{modName}</p>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <button
            onClick={() => tauriCommands.system.openFolder(modPath).catch(console.error)}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-textMuted hover:text-textMain transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <FolderOpen size={14} />
            <span>{t('open_folder', 'Open Folder')}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isRestoring}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-textMain transition-colors cursor-pointer"
            >
              {t('cancel', 'Cancel')}
            </button>
            <button
              onClick={handleRestore}
              disabled={selectedPaths.size === 0 || isRestoring}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw size={14} className={isRestoring ? 'animate-spin' : ''} />
              <span>
                {isRestoring
                  ? t('restoring', 'Restoring...')
                  : `${t('restore_btn_confirm', 'Restore Selected Files')} (${selectedPaths.size})`}
              </span>
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-textMuted leading-relaxed">
          {t(
            'restore_backup_desc',
            'Select the backup files you want to restore. Active files will be replaced with their original versions.'
          )}
        </p>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Selection Bar */}
        {!isLoading && backups.length > 0 && (
          <div className="flex items-center justify-between text-xs pt-1 border-b border-white/5 pb-2">
            <span className="text-textMuted">
              {t('selected_count', {
                defaultValue: '{{selected}} of {{total}} files selected',
                selected: selectedPaths.size,
                total: backups.length,
              })}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={selectAll}
                className="text-primary hover:underline font-semibold cursor-pointer text-xs"
              >
                {t('select_all', 'Select All')}
              </button>
              <span className="text-textMuted opacity-40">|</span>
              <button
                onClick={deselectAll}
                className="text-textMuted hover:text-textMain font-semibold cursor-pointer text-xs"
              >
                {t('deselect_all', 'Deselect All')}
              </button>
            </div>
          </div>
        )}

        {/* Backup Items List */}
        <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
          {isLoading ? (
            <div className="h-32 flex flex-col items-center justify-center gap-2 text-textMuted">
              <RotateCcw size={24} className="animate-spin text-primary" />
              <span className="text-xs">{t('loading_backups', 'Scanning backup files...')}</span>
            </div>
          ) : backups.length === 0 ? (
            <div className="h-32 flex flex-col items-center justify-center gap-2 text-center p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <ShieldCheck size={28} className="text-textMuted opacity-40" />
              <p className="text-xs text-textMuted">
                {t('restore_no_backups', 'No backup files found for this mod.')}
              </p>
            </div>
          ) : (
            backups.map((b) => {
              const isSelected = selectedPaths.has(b.backup_path);
              const dateStr = formatDate(b.created_at);

              return (
                <div
                  key={b.backup_path}
                  onClick={() => toggleSelect(b.backup_path)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                    isSelected
                      ? 'bg-indigo-500/10 border-indigo-500/30'
                      : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(b.backup_path);
                    }}
                    className="mt-0.5 text-textMuted hover:text-textMain shrink-0 cursor-pointer"
                  >
                    {isSelected ? (
                      <CheckSquare size={16} className="text-indigo-400" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <FileCode size={14} className="text-indigo-400 shrink-0" />
                        <span className="font-bold text-xs text-textMain truncate">
                          {b.target_file_name}
                        </span>
                      </div>
                      {dateStr && (
                        <span className="text-[10px] text-textMuted flex items-center gap-1 shrink-0">
                          <Clock size={11} /> {dateStr}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] font-mono text-textMuted/60 truncate">
                      {b.backup_file_name}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[10px]">
                      <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-textMuted flex items-center gap-1">
                        <HardDrive size={10} />
                        <span>
                          {b.target_exists
                            ? `${formatSize(b.target_size_bytes)} ➔ ${formatSize(b.backup_size_bytes)}`
                            : formatSize(b.backup_size_bytes)}
                        </span>
                      </span>

                      {b.target_exists ? (
                        <span className="text-amber-400/80 font-medium">
                          {t('will_overwrite', 'Will overwrite active file')}
                        </span>
                      ) : (
                        <span className="text-emerald-400/80 font-medium">
                          {t('will_restore_missing', 'Will restore missing file')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Warning Banner: Files to be Replaced */}
        {selectedTargetFiles.length > 0 && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1.5">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs">
              <AlertTriangle size={14} />
              <span>{t('restore_files_to_replace', 'Files that will be replaced')}</span>
            </div>
            <p className="text-[11px] text-textMuted leading-relaxed">
              {t(
                'restore_files_to_replace_desc',
                'The following active files in your mod folder will be overwritten:'
              )}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {selectedTargetFiles.map((fn) => (
                <span
                  key={fn}
                  className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-500/30 text-[11px] font-mono font-medium"
                >
                  {fn}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Option: Keep Backups */}
        <label className="flex items-center gap-2 pt-1 text-xs text-textMuted cursor-pointer select-none">
          <input
            type="checkbox"
            checked={keepBackups}
            onChange={(e) => setKeepBackups(e.target.checked)}
            className="rounded border-white/20 bg-black/40 text-primary focus:ring-0 cursor-pointer"
          />
          <span>{t('restore_keep_backups', 'Keep backup files on disk after restoring')}</span>
        </label>
      </div>
    </Modal>
  );
}
