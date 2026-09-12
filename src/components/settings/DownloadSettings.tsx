import { useAppStore } from "../../store/useAppStore";
import { Download } from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";

export function DownloadSettings() {
  const { t } = useTranslation();
  const { maxDownloadAttempts, downloadRetryInterval, setMaxDownloadAttempts, setDownloadRetryInterval, autoCheckUpdates, setAutoCheckUpdates, alwaysAutoAssign, setAlwaysAutoAssign, downloadImages, setDownloadImages } = useAppStore();

  return (
    <div className="glass-panel p-6 rounded-2xl border border-textMain/5 shadow-xl space-y-6">
      <div className="flex items-center gap-3 border-b border-textMain/5 pb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
          <Download size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-textMain">{t("settings_download_network")}</h2>
          <p className="text-sm text-textMuted">{t("settings_download_network_desc")}</p>
        </div>
      </div>

      <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
        <div>
          <h3 className="font-bold text-textMain">{t("settings_always_auto_assign", "Always Auto-Assign Mods")}</h3>
          <p className="text-xs text-textMuted mt-0.5">{t("settings_always_auto_assign_desc", "Skip the category picker modal if the mod can be automatically identified.")}</p>
        </div>
        <div
          onClick={() => setAlwaysAutoAssign(!alwaysAutoAssign)}
          className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${
            alwaysAutoAssign ? "bg-primary" : "bg-white/20"
          }`}
        >
          <div
            className={`w-4 h-4 rounded-full bg-white transition-transform ${
              alwaysAutoAssign ? "translate-x-6" : "translate-x-0"
            }`}
          />
        </div>
      </div>

      <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
        <div>
          <h3 className="font-bold text-textMain">{t("settings_download_images", "Download High-Quality Images")}</h3>
          <p className="text-xs text-textMuted mt-0.5">{t("settings_download_images_desc", "Automatically download rich character portraits and UI assets during database sync.")}</p>
        </div>
        <div
          onClick={() => setDownloadImages(downloadImages === false ? true : false)}
          className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${
            downloadImages !== false ? "bg-primary" : "bg-white/20"
          }`}
        >
          <div
            className={`w-4 h-4 rounded-full bg-white transition-transform ${
              downloadImages !== false ? "translate-x-6" : "translate-x-0"
            }`}
          />
        </div>
      </div>

      <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
        <div>
          <h3 className="font-bold text-textMain">{t("settings_auto_check_updates")}</h3>
          <p className="text-xs text-textMuted mt-0.5">{t("settings_auto_check_updates_desc")}</p>
        </div>
        <div
          onClick={() => setAutoCheckUpdates(!autoCheckUpdates)}
          className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${
            autoCheckUpdates ? "bg-primary" : "bg-white/20"
          }`}
        >
          <div
            className={`w-4 h-4 rounded-full bg-white transition-transform ${
              autoCheckUpdates ? "translate-x-6" : "translate-x-0"
            }`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-bold text-textMain flex justify-between">
            {t("settings_max_download_attempts")}
            <span className="text-primary">{maxDownloadAttempts}</span>
          </label>
          <input
            type="range"
            min="1"
            max="10"
            step="1"
            value={maxDownloadAttempts}
            onChange={(e) => setMaxDownloadAttempts(parseInt(e.target.value))}
            className="w-full accent-primary"
          />
          <p className="text-xs text-textMuted leading-relaxed">
            {t("settings_max_download_attempts_desc")}
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-textMain flex justify-between">
            {t("settings_retry_interval")}
            <span className="text-primary">{downloadRetryInterval}s</span>
          </label>
          <input
            type="range"
            min="1"
            max="60"
            step="1"
            value={downloadRetryInterval}
            onChange={(e) => setDownloadRetryInterval(parseInt(e.target.value))}
            className="w-full accent-primary"
          />
          <p className="text-xs text-textMuted leading-relaxed">
            {t("settings_retry_interval_desc")}
          </p>
        </div>
      </div>
    </div>
  );
}
