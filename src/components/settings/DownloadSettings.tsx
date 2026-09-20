import { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  Download,
  CheckCircle2,
  Radio,
  RefreshCw,
  Unlink,
  KeyRound,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { tauriCommands } from '../../services/tauriCommands';

// Set to true once GameBanana approves the tool and enables the 1-Click / Remote Install integration
const IS_GB_ONE_CLICK_ACTIVATED = false;

export function DownloadSettings() {
  const { t } = useTranslation();
  const {
    maxDownloadAttempts,
    downloadRetryInterval,
    setMaxDownloadAttempts,
    setDownloadRetryInterval,
    autoCheckUpdates,
    setAutoCheckUpdates,
    alwaysAutoAssign,
    setAlwaysAutoAssign,
    downloadImages,
    setDownloadImages,
    oneClickInstallerEnabled,
    oneClickAutoInstall,
    setOneClickInstallerEnabled,
    setOneClickAutoInstall,
    remoteInstallEnabled,
    remoteInstallMemberId,
    remoteInstallSecretKey,
    remoteInstallPollOnStartup,
    remoteInstallAlias,
    setRemoteInstallEnabled,
    setRemoteInstallPollOnStartup,
    setRemoteInstallCredentials,
    unpairRemoteInstall,
    showToast,
  } = useAppStore();

  const [isRegistered, setIsRegistered] = useState(false);
  const [isCheckingRemoteQueue, setIsCheckingRemoteQueue] = useState(false);
  const [isManualPairOpen, setIsManualPairOpen] = useState(false);
  const [manualMemberId, setManualMemberId] = useState('');
  const [manualSecretKey, setManualSecretKey] = useState('');

  const handleCheckRemoteQueue = async () => {
    if (!remoteInstallMemberId || !remoteInstallSecretKey) {
      showToast(t('remote_install_not_paired'));
      return;
    }
    setIsCheckingRemoteQueue(true);
    try {
      const items = await tauriCommands.oneClick.pollRemoteQueue(
        remoteInstallMemberId,
        remoteInstallSecretKey,
        remoteInstallAlias
      );
      if (items && items.length > 0) {
        showToast(t('remote_install_queue_items_found', { count: items.length }));
      } else {
        showToast(t('remote_install_queue_empty'));
      }
    } catch (err: any) {
      showToast(t('remote_install_poll_error', { error: err?.toString() || 'Unknown error' }));
    } finally {
      setIsCheckingRemoteQueue(false);
    }
  };

  const handleManualPairSubmit = () => {
    const idNum = parseInt(manualMemberId.trim(), 10);
    const key = manualSecretKey.trim();
    if (!idNum || idNum <= 0 || !key) {
      showToast(t('settings_remote_install_invalid_manual_fields'));
      return;
    }
    setRemoteInstallCredentials(idNum, key);
    showToast(t('remote_install_paired_success', { memberId: idNum }));
    setIsManualPairOpen(false);
    setManualMemberId('');
    setManualSecretKey('');
  };

  useEffect(() => {
    tauriCommands.oneClick
      .isRegistered()
      .then(setIsRegistered)
      .catch((err) => console.warn('Failed to check protocol registration:', err));
  }, [oneClickInstallerEnabled]);

  return (
    <div className="glass-panel p-6 rounded-2xl border border-textMain/5 shadow-xl space-y-6">
      <div className="flex items-center gap-3 border-b border-textMain/5 pb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
          <Download size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-textMain">{t('settings_download_network')}</h2>
          <p className="text-sm text-textMuted">{t('settings_download_network_desc')}</p>
        </div>
      </div>

      {/* GameBanana 1-Click Mod Installer */}
      <div
        className={`p-4 rounded-xl border space-y-4 relative overflow-hidden transition-all ${
          IS_GB_ONE_CLICK_ACTIVATED
            ? 'bg-white/5 border-white/5'
            : 'bg-white/[0.02] border-white/5 opacity-60'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-textMain">{t('settings_one_click_installer')}</h3>
              {!IS_GB_ONE_CLICK_ACTIVATED ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/25">
                  <Clock size={12} />
                  {t('settings_one_click_pending_badge')}
                </span>
              ) : isRegistered ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 size={12} />
                  {t('settings_one_click_status_registered')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/10 text-textMuted border border-white/10">
                  {t('settings_one_click_status_unregistered')}
                </span>
              )}
            </div>
            <p className="text-xs text-textMuted">{t('settings_one_click_installer_desc')}</p>
          </div>
          {IS_GB_ONE_CLICK_ACTIVATED ? (
            <div
              onClick={() => setOneClickInstallerEnabled(!oneClickInstallerEnabled)}
              className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${
                oneClickInstallerEnabled ? 'bg-primary' : 'bg-white/20'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  oneClickInstallerEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </div>
          ) : (
            <div
              title={t('settings_one_click_pending_desc')}
              className="w-12 h-6 rounded-full p-1 bg-white/10 cursor-not-allowed opacity-40 select-none"
            >
              <div className="w-4 h-4 rounded-full bg-white/40 translate-x-0" />
            </div>
          )}
        </div>

        {/* Warning Callout when pending GameBanana approval */}
        {!IS_GB_ONE_CLICK_ACTIVATED && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200/90 leading-relaxed">
              <span className="font-semibold text-amber-300 block mb-0.5">
                {t('settings_one_click_pending_title')}
              </span>
              {t('settings_one_click_pending_desc')}
            </div>
          </div>
        )}

        {IS_GB_ONE_CLICK_ACTIVATED && oneClickInstallerEnabled && (
          <div className="pt-3 border-t border-white/5 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-textMain">
                {t('settings_one_click_auto_download')}
              </h4>
              <p className="text-xs text-textMuted">{t('settings_one_click_auto_download_desc')}</p>
            </div>
            <div
              onClick={() => setOneClickAutoInstall(!oneClickAutoInstall)}
              className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${
                oneClickAutoInstall ? 'bg-primary' : 'bg-white/20'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  oneClickAutoInstall ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </div>
          </div>
        )}
      </div>

      {/* GameBanana Remote Install */}
      <div
        className={`p-4 rounded-xl border space-y-4 relative overflow-hidden transition-all ${
          IS_GB_ONE_CLICK_ACTIVATED
            ? 'bg-white/5 border-white/5'
            : 'bg-white/[0.02] border-white/5 opacity-60'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                  IS_GB_ONE_CLICK_ACTIVATED
                    ? 'bg-primary/20 text-primary'
                    : 'bg-white/5 text-textMuted'
                }`}
              >
                <Radio size={14} />
              </div>
              <h3 className="font-bold text-textMain">{t('settings_remote_install_title')}</h3>
              {!IS_GB_ONE_CLICK_ACTIVATED ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/25">
                  <Clock size={12} />
                  {t('settings_remote_install_pending_badge')}
                </span>
              ) : remoteInstallMemberId && remoteInstallSecretKey ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 size={12} />
                  {t('settings_remote_install_status_paired', { memberId: remoteInstallMemberId })}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/10 text-textMuted border border-white/10">
                  {t('settings_remote_install_status_unpaired')}
                </span>
              )}
            </div>
            <p className="text-xs text-textMuted">{t('settings_remote_install_desc')}</p>
          </div>
          {IS_GB_ONE_CLICK_ACTIVATED ? (
            remoteInstallMemberId &&
            remoteInstallSecretKey && (
              <div
                onClick={() => setRemoteInstallEnabled(!remoteInstallEnabled)}
                className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${
                  remoteInstallEnabled ? 'bg-primary' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    remoteInstallEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </div>
            )
          ) : (
            <div
              title={t('settings_remote_install_pending_desc')}
              className="w-12 h-6 rounded-full p-1 bg-white/10 cursor-not-allowed opacity-40 select-none"
            >
              <div className="w-4 h-4 rounded-full bg-white/40 translate-x-0" />
            </div>
          )}
        </div>

        {/* Warning Callout when pending GameBanana approval */}
        {!IS_GB_ONE_CLICK_ACTIVATED && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200/90 leading-relaxed">
              <span className="font-semibold text-amber-300 block mb-0.5">
                {t('settings_remote_install_pending_title')}
              </span>
              {t('settings_remote_install_pending_desc')}
            </div>
          </div>
        )}

        {IS_GB_ONE_CLICK_ACTIVATED && (
          <>
            {remoteInstallMemberId && remoteInstallSecretKey ? (
              <div className="space-y-3 pt-3 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-textMain">
                      {t('settings_remote_install_poll_startup')}
                    </h4>
                    <p className="text-xs text-textMuted">
                      {t('settings_remote_install_poll_startup_desc')}
                    </p>
                  </div>
                  <div
                    onClick={() => setRemoteInstallPollOnStartup(!remoteInstallPollOnStartup)}
                    className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${
                      remoteInstallPollOnStartup ? 'bg-primary' : 'bg-white/20'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        remoteInstallPollOnStartup ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={handleCheckRemoteQueue}
                    disabled={isCheckingRemoteQueue}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-black hover:bg-primary/90 flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw size={13} className={isCheckingRemoteQueue ? 'animate-spin' : ''} />
                    {t('settings_remote_install_check_now')}
                  </button>

                  <button
                    onClick={unpairRemoteInstall}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Unlink size={13} />
                    {t('settings_remote_install_unpair')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-2">
                <p className="text-xs text-textMuted leading-relaxed">
                  {t('settings_remote_install_how_to_pair')}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsManualPairOpen(!isManualPairOpen)}
                    className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <KeyRound size={12} />
                    {t('settings_remote_install_manual_pair_link')}
                  </button>
                </div>
                {isManualPairOpen && (
                  <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
                    <input
                      type="number"
                      placeholder={t('settings_remote_install_member_id_placeholder')}
                      value={manualMemberId}
                      onChange={(e) => setManualMemberId(e.target.value)}
                      className="w-full sm:w-36 px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-textMain placeholder-textMuted/40 focus:outline-none focus:border-primary"
                    />
                    <input
                      type="text"
                      placeholder={t('settings_remote_install_secret_key_placeholder')}
                      value={manualSecretKey}
                      onChange={(e) => setManualSecretKey(e.target.value)}
                      className="w-full sm:flex-1 px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-textMain placeholder-textMuted/40 focus:outline-none focus:border-primary"
                    />
                    <button
                      onClick={handleManualPairSubmit}
                      className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-primary text-black font-semibold text-xs hover:bg-primary/90 cursor-pointer shrink-0"
                    >
                      {t('settings_remote_install_pair_button')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
        <div>
          <h3 className="font-bold text-textMain">{t('settings_always_auto_assign')}</h3>
          <p className="text-xs text-textMuted mt-0.5">{t('settings_always_auto_assign_desc')}</p>
        </div>
        <div
          onClick={() => setAlwaysAutoAssign(!alwaysAutoAssign)}
          className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${
            alwaysAutoAssign ? 'bg-primary' : 'bg-white/20'
          }`}
        >
          <div
            className={`w-4 h-4 rounded-full bg-white transition-transform ${
              alwaysAutoAssign ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </div>
      </div>

      <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
        <div>
          <h3 className="font-bold text-textMain">{t('settings_download_images')}</h3>
          <p className="text-xs text-textMuted mt-0.5">{t('settings_download_images_desc')}</p>
        </div>
        <div
          onClick={() => setDownloadImages(downloadImages === false ? true : false)}
          className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${
            downloadImages !== false ? 'bg-primary' : 'bg-white/20'
          }`}
        >
          <div
            className={`w-4 h-4 rounded-full bg-white transition-transform ${
              downloadImages !== false ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </div>
      </div>

      <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
        <div>
          <h3 className="font-bold text-textMain">{t('settings_auto_check_updates')}</h3>
          <p className="text-xs text-textMuted mt-0.5">{t('settings_auto_check_updates_desc')}</p>
        </div>
        <div
          onClick={() => setAutoCheckUpdates(!autoCheckUpdates)}
          className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${
            autoCheckUpdates ? 'bg-primary' : 'bg-white/20'
          }`}
        >
          <div
            className={`w-4 h-4 rounded-full bg-white transition-transform ${
              autoCheckUpdates ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-bold text-textMain flex justify-between">
            {t('settings_max_download_attempts')}
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
            {t('settings_max_download_attempts_desc')}
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-textMain flex justify-between">
            {t('settings_retry_interval')}
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
            {t('settings_retry_interval_desc')}
          </p>
        </div>
      </div>
    </div>
  );
}
