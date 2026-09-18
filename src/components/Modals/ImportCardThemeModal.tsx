import { useState, useMemo } from 'react';
import {
  Upload,
  Copy,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  LayoutTemplate,
  Sliders,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import {
  DEFAULT_MOD_CARD_CUSTOMIZATION,
  validateAndNormalizeCardTheme,
  ModCardCustomization,
} from '../../types/cardCustomization';

export interface ImportCardThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ImportCardThemeModal({ isOpen, onClose }: ImportCardThemeModalProps) {
  const { t } = useTranslation();
  const {
    cardCustomization = DEFAULT_MOD_CARD_CUSTOMIZATION,
    setCardCustomization,
    showToast,
  } = useAppStore();

  const [inputString, setInputString] = useState('');

  // Validate parsed theme in real time
  const parsedTheme: ModCardCustomization | null = useMemo(() => {
    if (!inputString.trim()) return null;
    return validateAndNormalizeCardTheme(inputString.trim());
  }, [inputString]);

  const handleApply = () => {
    if (!parsedTheme) return;
    setCardCustomization(parsedTheme);
    showToast(t('card_theme_imported_toast', 'Card theme imported and applied successfully!'));
    setInputString('');
    onClose();
  };

  const handleCopyCurrent = async () => {
    try {
      const json = JSON.stringify(cardCustomization, null, 2);
      await navigator.clipboard.writeText(json);
      showToast(t('card_theme_copied_toast', 'Current card theme copied to clipboard!'));
    } catch {
      showToast(t('failed_copy_clipboard', 'Failed to copy to clipboard'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('card_import_modal_title', 'Share & Import Card Theme')}
      maxWidth="lg"
    >
      <div className="space-y-6">
        <p className="text-sm text-textMuted">
          {t(
            'card_import_modal_desc',
            'Paste a theme code or JSON configuration from a friend or the community to instantly apply their card visual styling.'
          )}
        </p>

        {/* Input Textarea */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-textMuted flex justify-between items-center">
            <span>{t('card_import_code_label', 'Theme Code / JSON')}</span>
            <button
              type="button"
              onClick={handleCopyCurrent}
              className="text-primary hover:text-primary/80 transition-colors flex items-center gap-1 normal-case font-semibold cursor-pointer"
            >
              <Copy size={13} />
              <span>{t('card_copy_current_btn', 'Copy Current Theme')}</span>
            </button>
          </label>
          <textarea
            value={inputString}
            onChange={(e) => setInputString(e.target.value)}
            placeholder={t(
              'card_import_placeholder',
              'Paste valid Card Theme JSON here (e.g. { "version": 1, "frame": { ... } })...'
            )}
            rows={7}
            className="w-full rounded-2xl bg-black/40 border border-textMain/10 focus:border-primary p-3.5 text-xs font-mono text-textMain placeholder:text-textMuted/40 resize-none outline-none transition-colors"
          />
        </div>

        {/* Live Validation Status & Summary */}
        {inputString.trim().length > 0 && (
          <div
            className={`p-4 rounded-2xl border transition-all ${
              parsedTheme
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs">
              {parsedTheme ? (
                <>
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>{t('card_import_valid', 'Valid Card Theme Code Detected')}</span>
                </>
              ) : (
                <>
                  <AlertCircle size={16} className="text-red-400 shrink-0" />
                  <span>
                    {t(
                      'card_import_invalid',
                      'Invalid or unrecognized format. Please paste valid theme JSON.'
                    )}
                  </span>
                </>
              )}
            </div>

            {parsedTheme && (
              <div className="mt-3 pt-3 border-t border-emerald-500/20 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-textMain font-medium">
                <div className="flex items-center gap-1.5 bg-black/30 p-2 rounded-xl border border-white/5">
                  <LayoutTemplate size={13} className="text-primary" />
                  <span>
                    Ratio:{' '}
                    <strong className="text-white capitalize">
                      {parsedTheme.frame.aspectRatio}
                    </strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-black/30 p-2 rounded-xl border border-white/5">
                  <Sliders size={13} className="text-primary" />
                  <span>
                    Blur: <strong className="text-white">{parsedTheme.frame.blurAmount}px</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-black/30 p-2 rounded-xl border border-white/5">
                  <Sparkles size={13} className="text-primary" />
                  <span>
                    Glow:{' '}
                    <strong className="text-white">
                      {parsedTheme.frame.elementalGlow ? 'Active' : 'Off'}
                    </strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-black/30 p-2 rounded-xl border border-white/5">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" />
                  <span>
                    Border:{' '}
                    <strong className="text-white capitalize">
                      {parsedTheme.frame.borderColor}
                    </strong>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-textMain/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-textMuted hover:text-textMain hover:bg-white/5 transition-all cursor-pointer"
          >
            {t('cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!parsedTheme}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              parsedTheme
                ? 'bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90'
                : 'bg-white/5 text-textMuted/40 cursor-not-allowed'
            }`}
          >
            <Upload size={14} />
            <span>{t('card_import_apply', 'Apply Theme')}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
