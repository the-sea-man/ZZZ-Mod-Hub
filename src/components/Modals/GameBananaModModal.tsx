import { motion } from 'framer-motion';
import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../../store/useAppStore';
import { useDownloadStore } from '../../store/useDownloadStore';
import { getActiveModsPath } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import {
  Eye,
  Heart,
  Download,
  Globe,
  Package,
  Tag,
  Calendar,
  ShieldCheck,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Box,
} from 'lucide-react';
import { ModViewerModal } from '../ModViewer/ModViewerModal';
import type { ViewerPayload } from '../../types/ipc';

const PLACEHOLDER_NO_IMAGE = 'https://via.placeholder.com/600x400?text=No+Image';
const PLACEHOLDER_AVATAR = 'https://via.placeholder.com/30';
const ENABLE_GB_3D_PREVIEW = false;

interface GameBananaModModalProps {
  mod: any;
  onClose: () => void;
}

export function GameBananaModModal({ mod, onClose }: GameBananaModModalProps) {
  const { modsPath, winrarPath, categories } = useAppStore();
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [pendingFile, setPendingFile] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('auto');
  const [previewFileId, setPreviewFileId] = useState<number | null>(null);
  const [gbPreviewPayload, setGbPreviewPayload] = useState<ViewerPayload | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [activePreviewFile, setActivePreviewFile] = useState<any | null>(null);
  const { t } = useTranslation();

  const installedModTags = useMemo(() => {
    if (!mod) return [];
    for (const cat of categories) {
      for (const m of cat.mods) {
        if (m.meta?.gb_mod_id === mod._idRow && m.meta?.tags && m.meta.tags.length > 0) {
          return m.meta.tags;
        }
      }
    }
    return [];
  }, [categories, mod?._idRow]);

  useEffect(() => {
    if (!mod?._idRow) return;
    const fetchDetails = async () => {
      try {
        const response: any = await invoke('fetch_gb_mod_details', {
          modId: mod._idRow,
          modelName: mod._sModelName,
        });
        setDetails(response);
      } catch (e) {
        console.error('Failed to fetch mod details:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [mod?._idRow, mod?._sModelName]);

  const handleInstallClick = (file: any) => {
    if (useAppStore.getState().alwaysAutoAssign !== false) {
      confirmInstall(file, 'auto');
    } else {
      setSelectedCategory('auto');
      setPendingFile(file);
    }
  };

  const confirmInstall = async (file: any, chosenCategory: string) => {
    if (installing) return;
    setInstalling(true);
    setInstallSuccess(false);

    try {
      const targetCategory = chosenCategory === 'auto' ? null : chosenCategory;

      useDownloadStore.getState().startDownload({
        downloadUrl: file._sDownloadUrl,
        fileName: file._sFile,
        modName: mod._sName,
        modUrl: mod._sProfileUrl || `https://gamebanana.com/mods/${mod._idRow}`,
        modData: mod,
        gbModId: mod._idRow,
        rootPath: getActiveModsPath(modsPath, useAppStore.getState().activeLibraryTab),
        winrarPath,
        targetCategory,
      });

      useAppStore.getState().incrementStat('smartDownloadsUsed');
      console.log('Download dispatched to store with targetCategory:', targetCategory);
      onClose();
    } catch (e) {
      console.error('Failed to start download:', e);
      alert(`Failed to start download: ${e}`);
    } finally {
      setInstalling(false);
    }
  };

  const handlePreview3D = async (file: any) => {
    if (previewFileId !== null || installing) return;
    setPreviewFileId(file._idRow);
    setPreviewError(null);
    try {
      const payload = await invoke<ViewerPayload>('preview_gamebanana_mod', {
        downloadUrl: file._sDownloadUrl,
        fileName: file._sFile,
        winrarPath,
      });
      setActivePreviewFile(file);
      setGbPreviewPayload(payload);
    } catch (err) {
      console.error('Failed to preview GameBanana mod in 3D:', err);
      setPreviewError(err instanceof Error ? err.message : String(err));
    } finally {
      setPreviewFileId(null);
    }
  };

  const handleDescriptionClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor && anchor.href) {
      e.preventDefault();
      invoke('open_url', { url: anchor.href });
    }
  };

  const images =
    details?._aPreviewContent?.screenshots ||
    details?._aPreviewMedia?._aImages ||
    mod?._aPreviewContent?.screenshots ||
    mod?._aPreviewMedia?._aImages ||
    (mod?._aPreviewContent?.screenshot ? [mod._aPreviewContent.screenshot] : []);

  const currentImgObj = images[currentImageIndex];
  let currentImage = '';

  if (currentImgObj) {
    currentImage = `${currentImgObj._sBaseUrl}/${currentImgObj._sFile800 || currentImgObj._sFile530 || currentImgObj._sFile}`;
  } else {
    currentImage = mod?._sImageUrl || mod?._sThumbnailUrl || PLACEHOLDER_NO_IMAGE;
  }

  const handleNextImage = () => {
    setImageLoading(true);
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const handlePrevImage = () => {
    setImageLoading(true);
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // Keyboard: Escape to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!mod) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-4xl max-h-full glass-panel border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl z-10 bg-surface/80"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/80 text-white z-20 transition-all border border-white/10"
        >
          <X size={18} />
        </button>

        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col md:flex-row">
          {/* Left Side: Image and info */}
          <div className="md:w-1/2 flex flex-col">
            <div className="w-full aspect-video bg-black/50 relative group">
              {currentImage ? (
                <>
                  {imageLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  <img
                    src={currentImage}
                    alt={mod._sName}
                    className={`w-full h-full object-contain transition-opacity duration-300 ${imageLoading ? 'opacity-50 blur-sm' : 'opacity-100'}`}
                    onLoad={() => setImageLoading(false)}
                    onError={() => setImageLoading(false)} // avoid infinite loading if broken
                  />
                  {images.length > 1 && (
                    <>
                      <button
                        onClick={handlePrevImage}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        onClick={handleNextImage}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ChevronRight size={16} />
                      </button>
                      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                        {images.map((_: any, idx: number) => (
                          <div
                            key={idx}
                            className={`w-2 h-2 rounded-full transition-all ${idx === currentImageIndex ? 'bg-white scale-125' : 'bg-white/50'}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-textMuted">
                  No Image
                </div>
              )}
            </div>
            <div className="p-6 flex-1 flex flex-col gap-4 bg-black/20">
              <h2 className="text-3xl font-black tracking-tight text-white">{mod._sName}</h2>
              <div className="flex items-center gap-3">
                <img
                  src={mod._aSubmitter?._sAvatarUrl || PLACEHOLDER_AVATAR}
                  alt={mod._aSubmitter?._sName}
                  className="w-8 h-8 rounded-full border border-white/20"
                />
                <span className="font-bold text-textMain">{mod._aSubmitter?._sName}</span>
              </div>

              <div className="flex gap-4 text-sm text-textMuted font-semibold mt-2 border-t border-white/5 pt-4">
                <span className="flex items-center gap-1.5">
                  <Eye size={16} className="text-textMuted/70" /> {mod._nViewCount}
                </span>
                <span className="flex items-center gap-1.5">
                  <Heart size={16} className="text-red-400" /> {mod._nLikeCount}
                </span>
                <span className="flex items-center gap-1.5">
                  <Download size={16} className="text-primary/80" />{' '}
                  {details
                    ? details._aFiles?.reduce(
                        (acc: number, f: any) => acc + f._nDownloadCount,
                        0
                      ) || 0
                    : '...'}
                </span>
              </div>

              {installedModTags.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold text-textMuted/70 uppercase tracking-wider">
                    {t('active_tags', 'Active Tags')}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {installedModTags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-primary/20 text-primary border border-primary/30"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-auto pt-4">
                <button
                  onClick={() => invoke('open_url', { url: mod._sProfileUrl })}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-white/10 hover:bg-white/5 rounded-xl font-bold text-textMain transition-all shadow-md"
                >
                  <Globe size={18} className="text-primary" /> View on GameBanana
                </button>
              </div>
            </div>
          </div>

          {/* Right Side: Files and Details */}
          <div className="md:w-1/2 p-6 flex flex-col gap-6">
            {(!mod._sModelName || mod._sModelName === 'Mod') && (
              <>
                <h3 className="text-xl font-bold border-b border-white/10 pb-2">Downloads</h3>

                {loading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : details?._aFiles?.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {details._aFiles.map((file: any) => (
                      <div
                        key={file._idRow}
                        className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col gap-2"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col">
                            <span className="font-bold text-white break-all">{file._sFile}</span>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-xs text-textMuted font-medium">
                              <span className="flex items-center gap-1.5">
                                <Package size={14} className="text-textMuted/70" />{' '}
                                {(file._nFilesize / 1024 / 1024).toFixed(2)} MB
                              </span>
                              <span className="flex items-center gap-1.5">
                                <Tag size={14} className="text-textMuted/70" />{' '}
                                {file._sVersion || t('version_default')}
                              </span>
                              {file._tsDateAdded && (
                                <span className="flex items-center gap-1.5">
                                  <Calendar size={14} className="text-textMuted/70" />{' '}
                                  {new Date(file._tsDateAdded * 1000).toLocaleDateString()}
                                </span>
                              )}
                              <span className="flex items-center gap-1.5">
                                <Download size={14} className="text-primary/70" />{' '}
                                {file._nDownloadCount?.toLocaleString() || 0}
                              </span>
                              {file._sAvResult === 'clean' && (
                                <span className="flex items-center gap-1.5 text-green-400">
                                  <ShieldCheck size={14} /> {t('av_clean', 'Clean')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {file._sDescription && (
                          <p className="text-sm text-textMuted mt-2 mb-2 p-3 bg-black/20 rounded-lg border border-white/5">
                            {file._sDescription}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          {ENABLE_GB_3D_PREVIEW && (
                            <button
                              onClick={() => handlePreview3D(file)}
                              disabled={previewFileId !== null || installing || installSuccess}
                              className="flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all bg-purple-600/20 text-purple-300 border border-purple-500/30 hover:bg-purple-600/30 hover:text-white cursor-pointer"
                              title={t('mod_viewer_gb_preview_btn', 'Preview 3D')}
                            >
                              {previewFileId === file._idRow ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-300" />
                                  <span className="text-xs">
                                    {t('mod_viewer_gb_previewing', 'Preparing 3D...')}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Box size={18} className="text-purple-400" />
                                  <span>{t('mod_viewer_gb_preview_btn', 'Preview 3D')}</span>
                                </>
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => handleInstallClick(file)}
                            disabled={previewFileId !== null || installing || installSuccess}
                            className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                              installSuccess
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : installing
                                  ? 'bg-primary/50 text-white cursor-wait'
                                  : 'bg-primary hover:bg-primary/90 text-white shadow-lg hover:shadow-primary/20'
                            }`}
                          >
                            {installSuccess ? (
                              <>
                                <Check size={18} /> Installed Successfully
                              </>
                            ) : installing ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Downloading & Extracting...
                              </>
                            ) : (
                              <>
                                <Download size={18} /> Install
                              </>
                            )}
                          </button>
                        </div>
                        {previewError &&
                          previewFileId === null &&
                          activePreviewFile?._idRow === file._idRow && (
                            <div className="mt-1 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md p-2">
                              {previewError}
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-center text-textMuted">
                    No files available for this mod.
                  </div>
                )}
              </>
            )}

            {(details?._sText || details?._sDescription) && (
              <div className="mt-4">
                <h3 className="text-xl font-bold border-b border-white/10 pb-2 mb-3">
                  Description
                </h3>
                <div
                  className="prose prose-invert max-w-none text-sm text-textMuted"
                  dangerouslySetInnerHTML={{ __html: details._sText || details._sDescription }}
                  onClick={handleDescriptionClick}
                />
              </div>
            )}
          </div>
        </div>

        {pendingFile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-white/10 rounded-2xl p-6 max-w-md w-full flex flex-col gap-4 shadow-2xl"
            >
              <h3 className="text-lg font-bold text-white">{t('download_preflight_title')}</h3>
              <p className="text-sm text-textMuted">{t('download_preflight_desc')}</p>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
              >
                <option value="auto" className="bg-slate-900 text-white">
                  {t('auto_detect')}
                </option>
                {categories.map((c) => (
                  <option
                    key={c.category_name}
                    value={c.category_name}
                    className="bg-slate-900 text-white"
                  >
                    {c.category_name}
                  </option>
                ))}
              </select>

              <div className="flex justify-end gap-3 mt-2">
                <button
                  onClick={() => setPendingFile(null)}
                  className="px-4 py-2 rounded-xl border border-white/10 text-textMuted hover:bg-white/5 font-semibold text-sm transition-all"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={() => {
                    const file = pendingFile;
                    setPendingFile(null);
                    confirmInstall(file, selectedCategory);
                  }}
                  className="px-4 py-2 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all shadow-md"
                >
                  {t('confirm_download')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </motion.div>

      {/* GameBanana In-Flight 3D Preview Modal */}
      {gbPreviewPayload && (
        <ModViewerModal
          modPath=""
          modName={mod._sName}
          initialPayload={gbPreviewPayload}
          isGbPreview
          onClose={() => {
            setGbPreviewPayload(null);
            setActivePreviewFile(null);
          }}
          onInstallGbMod={async () => {
            if (activePreviewFile) {
              await confirmInstall(activePreviewFile, 'auto');
              setGbPreviewPayload(null);
              setActivePreviewFile(null);
            }
          }}
        />
      )}
    </div>,
    document.body
  );
}
