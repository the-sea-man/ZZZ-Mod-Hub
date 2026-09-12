import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { useDownloadStore } from '../../store/useDownloadStore';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import {
  AlertTriangle,
  ChevronRight,
  Globe,
  FolderOpen,
  Search,
  Trash2,
  Download,
  RotateCw,
  X,
  Folder,
} from 'lucide-react';

export const SidebarDownloadPanel: React.FC = () => {
  const { t } = useTranslation();
  const { downloads, history, retryDownload, clearHistory } = useDownloadStore();
  const [expanded, setExpanded] = useState(false);

  const activeDownloads = Object.values(downloads);
  const totalCount = activeDownloads.length + history.length;

  if (totalCount === 0) return null;

  return (
    <div className="w-full px-4 mt-auto mb-4 flex flex-col gap-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full h-12 rounded-xl flex items-center justify-between px-4 font-bold text-sm bg-surface/50 border border-white/5 hover:bg-surface/80 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Download size={16} className="text-primary" />
          <span>{t('downloads')}</span>
        </span>
        <span className="bg-primary/20 text-primary px-2 py-0.5 rounded-full text-xs font-bold">
          {activeDownloads.length > 0
            ? t('active_downloads_count', { count: activeDownloads.length })
            : t('history_downloads_count', { count: history.length })}
        </span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-col gap-2 overflow-hidden"
          >
            <div className="max-h-72 overflow-y-auto custom-scrollbar flex flex-col gap-2 pb-2 pr-1">
              {activeDownloads.map((dl) => (
                <DownloadItem key={dl.download_id} dl={dl} />
              ))}

              {history.length > 0 && (
                <div className="flex items-center justify-between text-xs text-textMuted uppercase tracking-wider font-bold mt-2 mb-1 px-1">
                  <span>{t('history_count', { count: history.length })}</span>
                  <button
                    type="button"
                    onClick={clearHistory}
                    className="text-[10px] text-textMuted hover:text-red-400 font-semibold normal-case flex items-center gap-1 transition-colors"
                    title={t('clear_download_history_title')}
                  >
                    <Trash2 size={10} />
                    <span>{t('clear_history')}</span>
                  </button>
                </div>
              )}

              {history.map((dl) => (
                <DownloadItem
                  key={dl.download_id}
                  dl={dl}
                  isHistory
                  onRetry={() => retryDownload(dl.download_id)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const formatSpeed = (bytesPerSec: number) => {
  if (!bytesPerSec) return '';
  if (bytesPerSec > 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
};

const formatETA = (seconds: number) => {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return '';
  if (seconds < 60) return `${Math.ceil(seconds)}s left`;
  return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s left`;
};

const DownloadItem = ({
  dl,
  isHistory = false,
  onRetry,
}: {
  dl: any;
  isHistory?: boolean;
  onRetry?: () => void;
}) => {
  const { t } = useTranslation();
  const { setActiveModPreview, setActiveTab, setSelectedCategory } = useAppStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const progressPercent =
    dl.total > 0 ? Math.min(100, Math.round((dl.downloaded / dl.total) * 100)) : 0;

  const handleOpenGb = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (dl.payload?.modData) {
      setActiveModPreview(dl.payload.modData);
    } else if (dl.mod_url) {
      invoke('open_url', { url: dl.mod_url });
    }
  };

  const handleViewInLibrary = (e: React.MouseEvent, categoryName: string) => {
    e.stopPropagation();
    setActiveTab('library');
    setSelectedCategory(categoryName);
  };

  const handleOpenFolder = (e: React.MouseEvent, folderPath: string) => {
    e.stopPropagation();
    invoke('open_folder', { path: folderPath });
  };

  return (
    <div
      className={`bg-surface/60 border ${
        dl.is_error ? 'border-red-500/30' : dl.is_complete ? 'border-white/5' : 'border-primary/20'
      } rounded-xl p-2.5 relative overflow-hidden group shrink-0 transition-colors`}
    >
      {/* Clickable Header Row */}
      <div
        className="flex justify-between items-center gap-2 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
        title={t('download_click_details')}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <motion.span
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.15 }}
            className="text-textMuted/60 text-xs shrink-0 flex items-center justify-center"
          >
            <ChevronRight size={13} />
          </motion.span>
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-xs text-textMain truncate group-hover:text-primary transition-colors">
              {dl.mod_name}
            </h4>
            {dl.is_complete && !dl.is_error && (
              <div className="text-[9px] text-textMuted flex items-center gap-1 truncate mt-0.5">
                <span>📁</span>
                <span className="truncate font-semibold text-textMain/80">
                  {dl.install_results?.[0]?.category || dl.payload?.targetCategory || 'Unassigned'}
                </span>
                {dl.install_results?.[0]?.extracted_folder_name && (
                  <span className="text-textMuted/60 truncate">
                    • {dl.install_results[0].extracted_folder_name.replace(/^DISABLED\s+/, '')}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isHistory && dl.is_error ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRetry?.();
              }}
              className="text-[10px] bg-red-500/20 text-red-400 hover:bg-red-500/40 px-2 py-0.5 rounded transition-colors font-bold flex items-center gap-1"
            >
              <RotateCw size={10} />
              <span>{t('download_retry')}</span>
            </button>
          ) : (
            <span
              className={`text-[10px] font-bold ${
                dl.is_error
                  ? 'text-red-400'
                  : dl.is_complete
                    ? 'text-green-400'
                    : 'text-primary font-mono'
              }`}
            >
              {dl.is_error
                ? t('download_status_failed')
                : dl.is_complete
                  ? t('download_status_completed')
                  : `${progressPercent}%`}
            </span>
          )}

          {!dl.is_complete && dl.total > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                useDownloadStore.getState().cancelDownload(dl.download_id);
              }}
              className="text-red-400 hover:text-red-300 transition-colors p-0.5 rounded hover:bg-white/5 flex items-center justify-center"
              title="Cancel Download"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar for Active Downloads */}
      {!dl.is_complete && (
        <div className="flex flex-col gap-1 w-full mt-2">
          <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: `${progressPercent}%` }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ ease: 'linear', duration: 0.2 }}
            />
          </div>
          {dl.speed_bytes_per_sec > 0 && (
            <div className="flex justify-between text-[9px] text-textMuted/70 mt-0.5">
              <span>{formatSpeed(dl.speed_bytes_per_sec)}</span>
              <span>{formatETA(dl.eta_seconds)}</span>
            </div>
          )}
        </div>
      )}

      {/* Expandable Options Drawer */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="mt-2.5 pt-2 border-t border-white/5 flex flex-col gap-2">
              {/* GameBanana Page Button */}
              <button
                type="button"
                onClick={handleOpenGb}
                className="w-full px-2.5 py-1 bg-surface hover:bg-surface/80 border border-white/5 rounded-lg text-[10px] font-bold text-textMain flex items-center justify-between transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Globe size={12} className="text-primary" />
                  <span>{t('open_gamebanana_page')}</span>
                </span>
                <span className="text-[9px] text-textMuted">Modal / Web</span>
              </button>

              {/* Completed Installation Results */}
              {dl.is_complete && !dl.is_error && (
                <div className="space-y-1.5">
                  {dl.install_results && dl.install_results.length > 0 ? (
                    dl.install_results.map((res: any, i: number) => {
                      const folderName = res.extracted_folder_name.replace(/^DISABLED\s+/, '');
                      return (
                        <div
                          key={i}
                          className="bg-black/30 p-2 rounded-lg border border-white/5 flex flex-col gap-1.5"
                        >
                          <div className="flex flex-col">
                            <span
                              className="text-[10px] font-semibold text-textMain truncate flex items-center gap-1.5"
                              title={res.full_path}
                            >
                              <Folder size={11} className="text-primary shrink-0" />
                              <span className="truncate">{folderName}</span>
                            </span>
                            <span className="text-[9px] text-textMuted truncate">
                              {t('category_label', { category: res.category })}
                            </span>
                          </div>

                          <div className="flex gap-1.5 pt-0.5">
                            <button
                              type="button"
                              onClick={(e) => handleViewInLibrary(e, res.category)}
                              className="flex-1 px-2 py-1 bg-primary/20 hover:bg-primary/30 text-primary rounded text-[9px] font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Search size={10} />
                              <span>{t('view_in_library')}</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleOpenFolder(e, res.full_path)}
                              className="flex-1 px-2 py-1 bg-white/5 hover:bg-white/10 text-white/80 rounded text-[9px] font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                              title={t('open_folder_explorer_hint')}
                            >
                              <FolderOpen size={10} />
                              <span>{t('open_folder')}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : dl.install_paths && dl.install_paths.length > 0 ? (
                    dl.install_paths.map((p: string, i: number) => (
                      <div
                        key={i}
                        className="bg-black/30 p-2 rounded-lg border border-white/5 flex items-center justify-between"
                      >
                        <span
                          className="text-[10px] text-textMuted truncate flex items-center gap-1.5"
                          title={p}
                        >
                          <Folder size={11} className="text-primary shrink-0" />
                          <span className="truncate">{p.split(/[/\\]/).pop()}</span>
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleOpenFolder(e, p)}
                          className="px-2 py-0.5 bg-white/5 hover:bg-white/10 text-white/80 rounded text-[9px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <FolderOpen size={10} />
                          <span>{t('open_folder')}</span>
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="bg-black/30 p-2 rounded-lg border border-white/5 flex flex-col gap-1.5">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-semibold text-textMain truncate flex items-center gap-1.5">
                          <Folder size={11} className="text-primary shrink-0" />
                          <span className="truncate">{dl.payload?.fileName || dl.mod_name}</span>
                        </span>
                        <span className="text-[9px] text-textMuted truncate">
                          {t('category_label', {
                            category: dl.payload?.targetCategory || 'Unassigned',
                          })}
                        </span>
                      </div>
                      <div className="flex gap-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={(e) =>
                            handleViewInLibrary(e, dl.payload?.targetCategory || 'Unassigned')
                          }
                          className="flex-1 px-2 py-1 bg-primary/20 hover:bg-primary/30 text-primary rounded text-[9px] font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Search size={10} />
                          <span>{t('view_in_library')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) =>
                            handleOpenFolder(
                              e,
                              `${dl.payload?.rootPath || useAppStore.getState().modsPath}/${dl.payload?.targetCategory || 'Unassigned'}`
                            )
                          }
                          className="flex-1 px-2 py-1 bg-white/5 hover:bg-white/10 text-white/80 rounded text-[9px] font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          title={t('open_folder_explorer_hint')}
                        >
                          <FolderOpen size={10} />
                          <span>{t('open_folder')}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Error Message if Failed */}
              {dl.is_error && dl.error_msg && (
                <div className="bg-red-500/10 p-2 rounded-lg border border-red-500/20 flex items-start gap-1.5 text-[10px] text-red-300 leading-tight">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5 text-red-400" />
                  <span className="line-clamp-3">{dl.error_msg}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
