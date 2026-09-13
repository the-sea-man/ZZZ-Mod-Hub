import { Globe, AlertCircle, RefreshCw, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useTranslation } from '../../hooks/useTranslation';

interface TranslationProgressModalProps {
  isOpen: boolean;
  targetLanguageName: string;
  percentage: number;
  currentDone: number;
  totalCount: number;
  onCancel: () => void;
  error?: string | null;
  onRetry?: () => void;
}

export function TranslationProgressModal({
  isOpen,
  targetLanguageName,
  percentage,
  currentDone,
  totalCount,
  onCancel,
  error,
  onRetry,
}: TranslationProgressModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      maxWidth="md"
      showCloseButton={false}
      closeOnBackdropClick={false}
      closeOnEscape={!error}
      title={
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/20 text-primary border border-primary/30">
            <Globe size={22} className={error ? '' : 'animate-spin-slow'} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-textMain">
              {t('translating_progress_title', { language: targetLanguageName })}
            </h3>
            <p className="text-xs text-textMuted">{t('translating_progress_desc')}</p>
          </div>
        </div>
      }
    >
      <div className="p-6 space-y-6">
        {error ? (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} className="shrink-0" />
              <span className="text-sm font-semibold">{t('network_required_translation')}</span>
            </div>
            <p className="text-xs opacity-80 pl-6">{error}</p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-textMuted hover:bg-white/5 transition-colors"
              >
                {t('cancel')}
              </button>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-background font-bold rounded-xl text-xs hover:opacity-90 transition-opacity"
                >
                  <RefreshCw size={14} />
                  {t('retry', 'Retry')}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-textMain">
                  {t('translating_batch_status', {
                    percent: percentage,
                    current: currentDone,
                    total: totalCount,
                  })}
                </span>
                <span className="font-mono text-primary font-bold">{percentage}%</span>
              </div>
              <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/10">
                <div
                  className="h-full bg-gradient-to-r from-primary to-emerald-400 rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(var(--color-primary-rgb),0.5)]"
                  style={{ width: `${Math.max(3, percentage)}%` }}
                />
              </div>
            </div>

            {/* Explainer Note */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-textMuted leading-relaxed">
              {t(
                'offline_saved_notice',
                'Once downloaded, this language pack is saved locally to your device and will work 100% offline without requiring internet.'
              )}
            </div>

            {/* Cancel Button */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onCancel}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-textMuted hover:text-textMain hover:bg-white/5 border border-white/10 transition-colors"
              >
                <X size={14} />
                {t('translating_cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
