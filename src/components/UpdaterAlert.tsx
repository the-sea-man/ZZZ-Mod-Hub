import { useState, useEffect } from 'react';
import { check, Update, DownloadEvent } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { motion, AnimatePresence } from 'framer-motion';
import { Rocket } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

export function UpdaterAlert() {
  const [updateAvailable, setUpdateAvailable] = useState<Update | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [progress, setProgress] = useState(0);
  const { t } = useTranslation();

  useEffect(() => {
    async function checkForUpdates() {
      try {
        const update = await check();
        if (update) {
          setUpdateAvailable(update);
        }
      } catch (e) {
        console.error('Failed to check for updates:', e);
      }
    }

    checkForUpdates();
  }, []);

  const installUpdate = async () => {
    if (!updateAvailable) return;
    setIsUpdating(true);
    let downloaded = 0;
    let contentLength = 0;
    try {
      await updateAvailable.downloadAndInstall((event: DownloadEvent) => {
        if (event.event === 'Started') {
          contentLength = event.data.contentLength || 0;
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          if (contentLength > 0) {
            setProgress(Math.round((downloaded / contentLength) * 100));
          }
        } else if (event.event === 'Finished') {
          setIsUpdating(false);
        }
      });
      await relaunch();
    } catch (e) {
      console.error('Failed to install update:', e);
      setIsUpdating(false);
    }
  };

  const [dismissed, setDismissed] = useState(false);

  return (
    <AnimatePresence>
      {updateAvailable && !dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -60 }}
          className="fixed top-0 left-0 right-0 bg-surface/90 backdrop-blur-xl border-b border-primary/40 text-textMain px-8 py-3 flex items-center justify-between z-50 shadow-2xl"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/20 text-primary border border-primary/30 shrink-0">
              <Rocket size={18} />
            </div>
            <div>
              <p className="font-bold text-sm">Update Available: v{updateAvailable.version}</p>
              <p className="text-xs text-textMuted max-w-xl truncate">
                {updateAvailable.body ||
                  t('updater_default_body', 'A new version of ZZZ Mod Hub is available.')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={installUpdate}
              disabled={isUpdating}
              className={`px-5 py-2 rounded-xl text-sm font-bold shadow-lg transition-all flex items-center gap-2 ${
                isUpdating
                  ? 'bg-surface text-textMuted cursor-not-allowed'
                  : 'bg-primary text-white hover:bg-primary/80 shadow-primary/20'
              }`}
            >
              {isUpdating ? `Downloading (${Math.round(progress)}%)...` : 'Update Now'}
            </button>
            {!isUpdating && (
              <button
                onClick={() => setDismissed(true)}
                className="px-3 py-2 text-xs text-textMuted hover:text-textMain hover:bg-white/5 rounded-lg transition-colors"
              >
                Later
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
