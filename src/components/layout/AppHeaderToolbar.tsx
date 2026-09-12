import { memo } from 'react';
import { Ban, Dices, Rocket, Bell, WifiOff, Undo2, HelpCircle, LifeBuoy } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

export interface AppHeaderToolbarProps {
  isOnline: boolean;
  unreadCount: number;
  isSyncing: boolean;
  previouslyEnabledMods: string[];
  gameIsRunning: boolean;
  hotreloadEnabled: boolean;
  highlightTargetId?: string | null;
  tutorialsSeen: Record<string, boolean>;
  onOpenFeatureGuide: () => void;
  onOpenNotifications: () => void;
  onOpenTroubleshoot: () => void;
  onSyncDatabase: () => void;
  onRevertDisableAll: () => void;
  onDisableAllMods: () => void;
  onRandomizeMods: () => void;
  onLaunchGame: () => void;
}

export const AppHeaderToolbar = memo(function AppHeaderToolbar({
  isOnline,
  unreadCount,
  isSyncing,
  previouslyEnabledMods,
  gameIsRunning,
  hotreloadEnabled,
  highlightTargetId,
  tutorialsSeen,
  onOpenFeatureGuide,
  onOpenNotifications,
  onOpenTroubleshoot,
  onSyncDatabase,
  onRevertDisableAll,
  onDisableAllMods,
  onRandomizeMods,
  onLaunchGame,
}: AppHeaderToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="h-20 glass-panel border-b border-white/5 flex items-center justify-between px-8 shrink-0 z-20 gap-4">
      <div className="flex items-center gap-4">
        {!isOnline && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl text-xs font-bold shadow-lg">
            <WifiOff size={16} />
            <span>{t('offline_mode', 'Offline Mode')}</span>
          </div>
        )}
        {import.meta.env.DEV && (
          <button
            onClick={onOpenFeatureGuide}
            title={t('feature_guide_title')}
            className="relative w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group hover:bg-white/10 cursor-pointer"
          >
            <HelpCircle
              size={24}
              className="text-textMuted group-hover:text-primary transition-colors"
            />
          </button>
        )}
        <button
          onClick={onOpenNotifications}
          className="relative w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group hover:bg-white/10 cursor-pointer"
        >
          <Bell size={24} className="text-textMuted group-hover:text-textMain transition-colors" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-surface animate-pulse" />
          )}
        </button>
        <button
          onClick={onOpenTroubleshoot}
          title={t('troubleshoot_title', "I'm having issues / Quick Fixes")}
          className="flex items-center gap-2 px-3.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/25 rounded-xl text-xs font-bold transition-all shadow-sm group cursor-pointer"
        >
          <LifeBuoy
            size={16}
            className="text-amber-400 group-hover:rotate-45 transition-transform duration-300"
          />
          <span>{t('having_issues_btn', "I'm having issues")}</span>
        </button>
        <button
          data-highlight-id="sync_cloud_db_btn"
          onClick={onSyncDatabase}
          disabled={isSyncing || !isOnline}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
            highlightTargetId === 'sync_cloud_db_btn' ? 'highlight-target' : ''
          } ${isSyncing || !isOnline ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/5'} ${
            !tutorialsSeen.sync
              ? 'border-2 border-primary/60 animate-pulse shadow-[0_0_15px_rgba(0,0,0,0)] shadow-primary/20 text-primary'
              : 'border border-white/10'
          }`}
        >
          {isSyncing ? t('syncing_db') : t('sync_cloud_db')}
        </button>
      </div>

      <div className="flex gap-4 ml-4">
        {previouslyEnabledMods.length > 0 ? (
          <button
            onClick={onRevertDisableAll}
            className="px-6 py-2 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 border border-yellow-500/20 rounded-xl font-bold transition-all flex items-center gap-2 cursor-pointer"
          >
            <Undo2 size={18} /> {t('undo_disable_all')}
          </button>
        ) : (
          <button
            onClick={onDisableAllMods}
            className="px-6 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-xl font-bold transition-all flex items-center gap-2 cursor-pointer"
          >
            <Ban size={18} /> {t('disable_all')}
          </button>
        )}
        <button
          data-highlight-id="randomize_button"
          onClick={onRandomizeMods}
          className={`flex-1 font-bold py-3 px-4 rounded-xl transition-all group shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
            highlightTargetId === 'randomize_button' ? 'highlight-target' : ''
          } ${
            !tutorialsSeen.randomize
              ? 'bg-primary/20 border-2 border-primary/60 animate-pulse shadow-primary/20 text-primary'
              : 'bg-surface hover:bg-primary/20 text-primary border border-primary/20 hover:border-primary/50'
          }`}
        >
          <Dices size={18} className="group-hover:scale-110 transition-transform" />
          {t('randomize_btn')}
        </button>
        {gameIsRunning ? (
          <div
            className="px-5 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl font-bold text-xs flex items-center gap-2.5 shadow-[0_0_20px_rgba(52,211,153,0.2)] transition-all cursor-default select-none shrink-0"
            title={t(
              'game_running_tooltip',
              'Zenless Zone Zero is running. Mods hot-reload automatically on change.'
            )}
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
            </span>
            <div className="flex flex-col text-left">
              <span className="leading-tight tracking-wide font-black uppercase text-[11px]">
                {t('zzz_running', 'ZZZ Running')}
              </span>
              {hotreloadEnabled && (
                <span className="text-[10px] text-emerald-400/80 font-mono font-medium">
                  {t('hotreload_active', 'Hot-Reload Active')}
                </span>
              )}
            </div>
          </div>
        ) : (
          <button
            data-highlight-id="launch_game_btn"
            onClick={onLaunchGame}
            className={`px-6 py-2 rounded-xl font-bold transition-all flex items-center gap-2 cursor-pointer ${
              highlightTargetId === 'launch_game_btn' ? 'highlight-target' : ''
            } ${
              !tutorialsSeen.launch_game
                ? 'bg-primary/20 border-2 border-primary/60 animate-pulse text-primary shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.4)]'
                : 'bg-surface-light border border-white/10 hover:bg-white/5 text-textMain'
            }`}
          >
            <Rocket size={18} /> {t('launch_game')}
          </button>
        )}
      </div>
    </div>
  );
});
