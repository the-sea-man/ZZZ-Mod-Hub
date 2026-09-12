import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/useAppStore';
import { Image, HardDrive } from 'lucide-react';

interface Props {
  onClose: () => void;
  onProceed: () => void;
}

export default function ImageDownloadPromptModal({ onClose, onProceed }: Props) {
  const { t } = useTranslation();
  const { setDownloadImages, theme } = useAppStore();

  // Keyboard: Escape to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleChoice = (download: boolean) => {
    setDownloadImages(download);
    onProceed();
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 ${theme === 'glass' ? 'glass-panel' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-neutral-900 border border-neutral-700/50 rounded-xl shadow-2xl p-6 w-full max-w-md flex flex-col gap-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-teal-500/20 flex items-center justify-center">
            <Image className="text-teal-400 w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white">
            {t('settings.image_prompt_title', 'Download High-Quality Images?')}
          </h2>
          <p className="text-neutral-400 text-sm leading-relaxed">
            {t(
              'settings.image_prompt_desc',
              'ZZZ Mod Hub can download high-quality character portraits, mod icons, and UI assets from the cloud database to make your mod manager look amazing.'
            )}
          </p>
        </div>

        <div className="bg-neutral-800/50 rounded-lg p-4 flex flex-col gap-3">
          <div className="flex items-start gap-3 text-sm text-neutral-300">
            <HardDrive className="text-blue-400 w-5 h-5 mt-0.5 shrink-0" />
            <p>
              {t('settings.image_prompt_space', 'This will use approximately')}{' '}
              <strong className="text-white">~35 MB</strong>{' '}
              {t('settings.image_prompt_space2', 'of disk space.')}
            </p>
          </div>
          <div className="flex items-start gap-3 text-sm text-neutral-300">
            <div className="text-amber-400 text-lg font-bold shrink-0 mt-[-2px]">!</div>
            <p>
              {t(
                'settings.image_prompt_warning',
                'If you skip this, your generated mod folders and the UI will fallback to a generic, empty appearance.'
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => handleChoice(true)}
            className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-semibold transition-colors flex justify-center items-center gap-2"
          >
            {t('settings.image_prompt_yes', 'Yes, Download Images (Recommended)')}
          </button>
          <button
            onClick={() => handleChoice(false)}
            className="w-full py-3 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg font-semibold transition-colors"
          >
            {t('settings.image_prompt_no', 'No, Skip Images (Save Space)')}
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 text-neutral-500 hover:text-neutral-300 text-sm transition-colors mt-2"
          >
            {t('common.cancel', 'Cancel')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
