import { useEffect, useState } from 'react';
import {
  Info,
  Code2,
  ExternalLink,
  FileText,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  History,
} from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../../store/useAppStore';
import { OperationHistoryModal } from '../Modals/OperationHistoryModal';

export function AboutSettings() {
  const { t } = useTranslation();
  const {
    appVersion,
    latestAppVersion,
    appUpdateAvailable,
    isCheckingAppUpdates,
    checkAppUpdates,
    fetchAppVersion,
  } = useAppStore();

  const [showHistoryModal, setShowHistoryModal] = useState(false);

  useEffect(() => {
    fetchAppVersion();
  }, [fetchAppVersion]);

  return (
    <div className="glass-panel border border-white/5 rounded-2xl p-6 md:p-8 space-y-8 shadow-xl">
      <div className="flex items-center gap-3">
        <Info className="text-primary" size={24} />
        <h2 className="text-2xl font-bold text-textMain">{t('about', 'About')}</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel-bg border border-white/5 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-4 mb-4">
            <img
              src="/app-icon.png"
              alt="ZZZ Mod Manager Logo"
              className="w-16 h-16 rounded-xl shadow-md"
            />
            <div>
              <h3 className="text-xl font-black text-textMain">ZZZ Mod Hub</h3>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-textMuted text-sm font-semibold">
                  {t('version_label', 'Version')} {appVersion}
                </p>
                {latestAppVersion && !appUpdateAvailable && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    <CheckCircle2 size={12} />
                    {t('app_up_to_date', 'Up to Date')}
                  </span>
                )}
                {appUpdateAvailable && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full animate-pulse">
                    <Sparkles size={12} />v{latestAppVersion}
                  </span>
                )}
              </div>
            </div>
          </div>
          <p className="text-sm text-textMuted leading-relaxed mb-6">
            {t(
              'about_desc',
              'A beautiful, open-source mod manager for Zenless Zone Zero. Enjoy smart categorization, easy mod toggling, and GameBanana integration.'
            )}
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => checkAppUpdates()}
              disabled={isCheckingAppUpdates}
              className="flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors group text-left w-full cursor-pointer disabled:opacity-60"
            >
              <div className="flex items-center gap-3">
                <RefreshCw
                  size={18}
                  className={`text-textMuted group-hover:text-primary transition-colors ${isCheckingAppUpdates ? 'animate-spin text-primary' : ''}`}
                />
                <span className="font-semibold text-textMain">
                  {isCheckingAppUpdates
                    ? t('checking_app_updates', 'Checking GitHub Releases...')
                    : t('check_app_updates', 'Check for App Updates')}
                </span>
              </div>
              <span className="text-xs text-textMuted group-hover:text-textMain transition-colors">
                {latestAppVersion ? `v${latestAppVersion}` : ''}
              </span>
            </button>
            <a
              href="https://github.com/the-sea-man/ZZZ-Mod-Hub/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Code2
                  size={18}
                  className="text-textMuted group-hover:text-textMain transition-colors"
                />
                <span className="font-semibold text-textMain">
                  {t('github_repository', 'GitHub Releases')}
                </span>
              </div>
              <ExternalLink
                size={16}
                className="text-textMuted group-hover:text-primary transition-colors"
              />
            </a>
            <a
              href="https://gamebanana.com/wips/102148"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-4 py-3 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-xl transition-colors group"
            >
              <div className="flex items-center gap-3">
                <img
                  src="https://images.gamebanana.com/static/img/favicon/favicon.ico"
                  alt="GameBanana"
                  className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity"
                />
                <span className="font-semibold text-primary">
                  {t('gamebanana_page', 'GameBanana Page')}
                </span>
              </div>
              <ExternalLink
                size={16}
                className="text-primary/70 group-hover:text-primary transition-colors"
              />
            </a>
            <button
              onClick={() => setShowHistoryModal(true)}
              className="flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors group text-left w-full cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <History
                  size={18}
                  className="text-textMuted group-hover:text-primary transition-colors"
                />
                <span className="font-semibold text-textMain">
                  {t('view_history_backups_btn', 'Operation History & Backups')}
                </span>
              </div>
              <ExternalLink
                size={16}
                className="text-textMuted group-hover:text-primary transition-colors"
              />
            </button>
            <button
              onClick={async () => {
                await invoke('open_logs_folder');
              }}
              className="flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors group text-left w-full cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <FileText
                  size={18}
                  className="text-textMuted group-hover:text-textMain transition-colors"
                />
                <span className="font-semibold text-textMain">
                  {t('open_logs_folder_btn', 'Open Logs Folder')}
                </span>
              </div>
              <ExternalLink
                size={16}
                className="text-textMuted group-hover:text-primary transition-colors"
              />
            </button>
          </div>
        </div>

        <div className="glass-panel-bg border border-white/5 rounded-2xl p-6 shadow-lg flex flex-col justify-center">
          <h3 className="text-lg font-bold text-textMain mb-2">
            {t('created_by', 'Created by the-sea-man')}
          </h3>
          <p className="text-sm text-textMuted leading-relaxed mb-4">
            {t(
              'about_thanks',
              'Thank you for using ZZZ Mod Hub! This project aims to make ZZZ modding as seamless and enjoyable as possible.'
            )}
          </p>
          <p className="text-xs text-textMuted opacity-50">
            {t(
              'about_disclaimer',
              '* This software is not affiliated with, maintained, authorized, endorsed, or sponsored by HoYoverse or any of its affiliates.'
            )}
          </p>
        </div>
      </div>

      {showHistoryModal && <OperationHistoryModal onClose={() => setShowHistoryModal(false)} />}
    </div>
  );
}
