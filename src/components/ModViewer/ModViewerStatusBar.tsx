import { memo } from 'react';
import { Sparkles, Loader2, X } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import type { RetextureInfo } from './types';

export interface ModViewerStatusBarProps {
  retextureInfo: RetextureInfo;
  onOpenBaseModelDropdown: () => void;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

export const ModViewerStatusBar = memo(function ModViewerStatusBar({
  retextureInfo,
  onOpenBaseModelDropdown,
  loading,
  error,
  onClose,
}: ModViewerStatusBarProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* Retexture attribution banner (top-left of viewport) */}
      {retextureInfo.isRetexture && retextureInfo.baseModelSource && (
        <div className="absolute left-3 top-13 z-10 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-950/70 px-3 py-1.5 backdrop-blur-md shadow-lg">
          <Sparkles className="h-4 w-4 text-amber-400 flex-shrink-0" />
          <div className="text-xs text-amber-200">
            <span className="font-semibold">{t('mod_viewer_retexture_banner')}:</span>{' '}
            {t('mod_viewer_retexture_source', {
              source: retextureInfo.baseModelSource.replace(/^DISABLED_?/, ''),
            })}
          </div>
          <button
            onClick={onOpenBaseModelDropdown}
            className="ml-1 text-[11px] font-medium text-amber-400 underline hover:text-amber-300 transition-colors cursor-pointer"
          >
            {t('mod_viewer_change_base_model')}
          </button>
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#0d1117]/90 backdrop-blur-sm p-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
          <div className="space-y-1">
            <span className="text-sm font-semibold text-white/90">{t('mod_viewer_loading')}</span>
            <p className="text-xs text-white/50 max-w-xs">{t('mod_viewer_loading_hint')}</p>
          </div>
          <button
            onClick={onClose}
            className="mt-3 flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-white/20 bg-white/5 text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white transition-colors shadow-lg"
          >
            <X className="w-3.5 h-3.5" />
            {t('cancel', 'Cancel')}
          </button>
        </div>
      )}

      {/* Error overlay */}
      {!loading && error && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#0d1117]/90">
          <div className="max-w-md rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-center">
            <p className="text-sm font-medium text-red-400">{t('mod_viewer_error')}</p>
            <p className="mt-1 text-xs text-red-400/70">{error}</p>
          </div>
        </div>
      )}
    </>
  );
});
