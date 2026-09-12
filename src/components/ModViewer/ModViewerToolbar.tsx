import { memo } from 'react';
import { X, Sparkles, Camera, FolderOpen, ChevronDown, Check, Loader2 } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import type { RetextureInfo } from './types';

export interface ModViewerToolbarProps {
  displayName: string;
  modPath?: string;
  isGbPreview: boolean;
  embedded?: boolean;
  retextureInfo: RetextureInfo;
  showBaseModelDropdown: boolean;
  setShowBaseModelDropdown: (show: boolean) => void;
  loadMod: (folderName: string) => void;
  handleBrowseBaseModel: () => void;
  handleInstantSaveThumbnail: () => void;
  savingThumbnail: boolean;
  savedThumbnailSuccess: boolean;
  onUseAsPreview?: (imageSrc: string) => void;
  captureSnapshot: () => string | null;
  onInstallGbMod?: () => Promise<void> | void;
  installingGb: boolean;
  setInstallingGb: (val: boolean) => void;
  gbInstallSuccess: boolean;
  setGbInstallSuccess: (val: boolean) => void;
  onClose: () => void;
}

export const ModViewerToolbar = memo(function ModViewerToolbar({
  displayName,
  modPath,
  isGbPreview,
  embedded = false,
  retextureInfo,
  showBaseModelDropdown,
  setShowBaseModelDropdown,
  loadMod,
  handleBrowseBaseModel,
  handleInstantSaveThumbnail,
  savingThumbnail,
  savedThumbnailSuccess,
  onUseAsPreview,
  captureSnapshot,
  onInstallGbMod,
  installingGb,
  setInstallingGb,
  gbInstallSuccess,
  setGbInstallSuccess,
  onClose,
}: ModViewerToolbarProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* Top Header Bar */}
      <div className="absolute top-0 left-0 right-0 z-30 flex h-10 items-center justify-between border-b border-white/10 bg-[#0d1117]/90 px-3 backdrop-blur-md">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wider text-purple-400 shrink-0">
            {t('mod_viewer_title')}
          </span>
          <span className="text-white/40">•</span>
          <span className="text-xs text-white/80 font-medium truncate" title={displayName}>
            {displayName}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Base Model Candidate Dropdown (for retexture mods) */}
          {retextureInfo.isRetexture && (
            <div className="relative">
              <button
                onClick={() => setShowBaseModelDropdown(!showBaseModelDropdown)}
                className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors border ${
                  retextureInfo.baseModelSource
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                    : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                }`}
                title={t('mod_viewer_base_model_label', 'Base Model')}
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span className="max-w-[140px] truncate">
                  {retextureInfo.baseModelSource
                    ? retextureInfo.baseModelSource.replace(/^DISABLED_?/, '')
                    : t('mod_viewer_select_base_model')}
                </span>
                <ChevronDown className="h-3 w-3 text-white/40" />
              </button>

              {showBaseModelDropdown && (
                <div className="absolute right-0 top-full mt-1 w-72 rounded-xl border border-white/15 bg-[#161b22] p-1.5 shadow-2xl backdrop-blur-xl z-50">
                  <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    {t('mod_viewer_candidates_available', 'Compatible models found:')}
                  </div>

                  {/* Option: No Base Model (textures only) */}
                  <button
                    onClick={() => {
                      setShowBaseModelDropdown(false);
                      loadMod('');
                    }}
                    className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                      !retextureInfo.baseModelSource
                        ? 'bg-purple-600/20 text-purple-300 font-medium'
                        : 'text-white/70 hover:bg-white/5'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full mt-1 shrink-0 bg-white/30" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span>{t('mod_viewer_base_model_none')}</span>
                        {!retextureInfo.baseModelSource && (
                          <Check className="h-3.5 w-3.5 text-purple-400" />
                        )}
                      </div>
                      <div className="text-[10px] text-white/40">Texture details & clues only</div>
                    </div>
                  </button>

                  {/* Candidate List */}
                  {retextureInfo.candidates.map((c) => {
                    const isSelected = retextureInfo.baseModelSource === c.folder_name;
                    return (
                      <button
                        key={c.folder_name}
                        onClick={() => {
                          setShowBaseModelDropdown(false);
                          loadMod(c.folder_name);
                        }}
                        className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors mt-1 ${
                          isSelected
                            ? 'bg-amber-500/20 text-amber-200 font-medium'
                            : 'text-white/80 hover:bg-white/5'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                            c.confidence === 'exact'
                              ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                              : c.confidence === 'partial'
                                ? 'bg-amber-400'
                                : 'bg-white/30'
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate">{c.display_name}</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-medium ${
                                c.confidence === 'exact'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : c.confidence === 'partial'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-white/10 text-white/50 border border-white/10'
                              }`}
                            >
                              {c.confidence === 'exact'
                                ? t('mod_viewer_confidence_exact', {
                                    matched: c.matched_buffers_count,
                                    total: c.total_required_buffers,
                                  })
                                : c.confidence === 'partial'
                                  ? t('mod_viewer_confidence_partial', {
                                      matched: c.matched_buffers_count,
                                      total: c.total_required_buffers,
                                    })
                                  : t('mod_viewer_confidence_low', {
                                      count: c.matched_buffers_count,
                                    })}
                            </span>
                          </div>
                          <div className="text-[10px] text-white/40 truncate">
                            {c.match_details}
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  {/* Browse custom base model folder */}
                  <div className="border-t border-white/10 mt-1 pt-1">
                    <button
                      onClick={() => {
                        setShowBaseModelDropdown(false);
                        handleBrowseBaseModel();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors text-purple-300 hover:bg-purple-500/15"
                    >
                      <FolderOpen className="h-3.5 w-3.5 text-purple-400 flex-shrink-0" />
                      <span className="truncate">
                        {t('mod_viewer_browse_base_model', 'Browse custom folder...')}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Header Actions */}
          {!isGbPreview && modPath && (
            <button
              onClick={handleInstantSaveThumbnail}
              disabled={savingThumbnail}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all border ${
                savedThumbnailSuccess
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-white/5 text-white/70 hover:bg-white/10 border-white/10'
              }`}
              title={t('mod_viewer_instant_save', 'Instant Save Thumbnail to Mod Folder')}
            >
              {savedThumbnailSuccess ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">
                    {t('mod_viewer_saved_thumbnail', 'Saved!')}
                  </span>
                </>
              ) : savingThumbnail ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-white/70" />
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                  <span className="hidden sm:inline">
                    {t('mod_viewer_instant_save', 'Quick Snap')}
                  </span>
                </>
              )}
            </button>
          )}

          {onUseAsPreview && (
            <button
              onClick={() => {
                const snapshot = captureSnapshot();
                if (snapshot) {
                  onUseAsPreview(snapshot);
                }
              }}
              className="flex items-center gap-1.5 rounded-md bg-sky-500/20 px-2.5 py-1 text-xs font-medium text-sky-300 hover:bg-sky-500/30 transition-colors border border-sky-500/30"
              title={t('mod_viewer_use_as_preview', 'Use as Preview Image')}
            >
              <Camera className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {t('mod_viewer_use_as_preview', 'Use as Preview')}
              </span>
            </button>
          )}

          {onInstallGbMod && (
            <button
              onClick={async () => {
                if (installingGb || gbInstallSuccess) return;
                try {
                  setInstallingGb(true);
                  await onInstallGbMod();
                  setGbInstallSuccess(true);
                } catch (e) {
                  console.error('Failed to install from preview:', e);
                } finally {
                  setInstallingGb(false);
                }
              }}
              disabled={installingGb || gbInstallSuccess}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-bold transition-all shadow-lg ${
                gbInstallSuccess
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : installingGb
                    ? 'bg-emerald-600/50 text-white cursor-wait'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40 hover:scale-105 active:scale-95'
              }`}
            >
              {gbInstallSuccess ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  {t('mod_viewer_gb_install_success', 'Installed!')}
                </>
              ) : installingGb ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t('mod_viewer_gb_installing', 'Installing...')}
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  {t('mod_viewer_gb_install', 'Install Mod to Library')}
                </>
              )}
            </button>
          )}

          {!embedded && (
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </>
  );
});
