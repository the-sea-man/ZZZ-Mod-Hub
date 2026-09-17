import { memo } from 'react';
import {
  Heart,
  Lock,
  Unlock,
  Sparkles,
  AlertTriangle,
  ShieldAlert,
  Users,
  FileCode,
  Check,
  RotateCcw,
} from 'lucide-react';
import { ModInfo, ModWarning } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { DEFAULT_MOD_CARD_CUSTOMIZATION } from '../../types/cardCustomization';

export interface ModCardBadgesProps {
  mod: ModInfo;
  isFavorite: boolean;
  isIgnored: boolean;
  isBatchMode: boolean;
  isSelected: boolean;
  sizeBytes: number | null;
  hasUpdateAvailable: boolean;
  outdatedWarnings: ModWarning[];
  hasBackup?: boolean;
  isStale: boolean;
  invalidHashes: string[];
  hasHashConflict: boolean;
  multiCharWarnings: ModWarning[];
  iniWarnings: ModWarning[];
  onToggleFavorite: (e: React.MouseEvent) => void;
  onToggleIgnore: (e: React.MouseEvent) => void;
  onToggleSelect: (e: React.MouseEvent) => void;
  onOpenUpdater: (e: React.MouseEvent) => void;
  onOpenFixMod: (e: React.MouseEvent) => void;
  onOpenRestoreBackup?: (e: React.MouseEvent) => void;
  onOpenHashConflicts: (e: React.MouseEvent) => void;
  onOpenMultiCharWarnings: (e: React.MouseEvent) => void;
  onOpenIniWarnings: (e: React.MouseEvent) => void;
}

export const ModCardBadges = memo(function ModCardBadges({
  isFavorite,
  isIgnored,
  isBatchMode,
  isSelected,
  sizeBytes,
  hasUpdateAvailable,
  outdatedWarnings,
  hasBackup,
  isStale,
  invalidHashes,
  hasHashConflict,
  multiCharWarnings,
  iniWarnings,
  onToggleFavorite,
  onToggleIgnore,
  onToggleSelect,
  onOpenUpdater,
  onOpenFixMod,
  onOpenRestoreBackup,
  onOpenHashConflicts,
  onOpenMultiCharWarnings,
  onOpenIniWarnings,
}: ModCardBadgesProps) {
  const { t } = useTranslation();
  const badgesConfig =
    useAppStore((s) => s.cardCustomization?.badges) || DEFAULT_MOD_CARD_CUSTOMIZATION.badges;

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const badgeStyleClass =
    badgesConfig.badgeStyle === 'solid'
      ? 'bg-zinc-900 border border-zinc-700'
      : 'bg-black/70 backdrop-blur-md border border-white/10';

  const actionIconBaseClass = `p-2.5 rounded-full border transition-all shadow-lg flex items-center justify-center cursor-pointer ${
    badgesConfig.badgeStyle === 'solid' ? '' : 'backdrop-blur-md'
  }`;

  return (
    <>
      {/* Top-Left Action Icons (Favorite, Lock/Unlock, or Batch Checkbox) */}
      <div className="absolute top-3 left-3 flex gap-2 z-20">
        {badgesConfig.showFavoriteHeart && (
          <button
            onClick={onToggleFavorite}
            className={`${actionIconBaseClass} ${
              isFavorite
                ? 'bg-rose-500/80 border-rose-500 shadow-rose-500/30 text-white'
                : badgesConfig.badgeStyle === 'solid'
                  ? 'bg-surface border-textMain/20 text-textMuted hover:text-textMain'
                  : 'bg-background/80 border-textMain/10 text-textMuted hover:bg-surface hover:text-textMain'
            }`}
            title={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
          >
            <Heart size={14} className={isFavorite ? 'fill-current' : ''} />
          </button>
        )}

        {isBatchMode ? (
          <button
            onClick={onToggleSelect}
            className={`w-9 h-9 rounded-full border backdrop-blur-md transition-all shadow-lg flex items-center justify-center cursor-pointer ${
              isSelected
                ? 'bg-primary border-primary shadow-primary/30 text-white scale-110'
                : 'bg-background/80 border-textMain/20 text-transparent hover:border-primary/50'
            }`}
            title={isSelected ? 'Deselect Mod' : 'Select Mod'}
          >
            <Check size={16} strokeWidth={3} className={isSelected ? 'text-white' : 'hidden'} />
          </button>
        ) : (
          badgesConfig.showLockBadge !== false && (
            <button
              onClick={onToggleIgnore}
              className={`${actionIconBaseClass} ${
                isIgnored
                  ? 'bg-primary/80 border-primary shadow-primary/30 text-white'
                  : badgesConfig.badgeStyle === 'solid'
                    ? 'bg-surface border-textMain/20 text-textMuted hover:text-textMain'
                    : 'bg-background/80 border-textMain/10 text-textMuted hover:bg-surface hover:text-textMain'
              }`}
              title={
                isIgnored
                  ? 'Locked: Mod will NOT be changed by Randomizer'
                  : 'Unlocked: Mod will be included in Randomizer'
              }
            >
              {isIgnored ? <Lock size={14} /> : <Unlock size={14} />}
            </button>
          )
        )}
      </div>

      {/* Top-Right Badges & Warning Icons */}
      <div className="absolute top-3 right-3 flex gap-2 z-20 flex-col items-end pointer-events-auto">
        {hasUpdateAvailable && badgesConfig.showUpdateBadge && (
          <button
            onClick={onOpenUpdater}
            className="bg-amber-500/90 hover:bg-amber-500 text-black text-xs px-2.5 py-1 rounded-full border border-amber-300 font-bold flex items-center gap-1 shadow-[0_0_15px_rgba(245,158,11,0.5)] cursor-pointer hover:scale-105 transition-all animate-pulse"
            title={t(
              'page_activity_desc',
              'GameBanana recorded new files or updates for this mod.'
            )}
          >
            <Sparkles size={12} /> {t('page_updated', 'Page Updated')}
          </button>
        )}

        {badgesConfig.showWarningBadges !== false && outdatedWarnings.length > 0 && (
          <button
            onClick={onOpenFixMod}
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs px-2.5 py-1 rounded-full border border-amber-300 font-bold flex items-center gap-1 shadow-[0_0_15px_rgba(245,158,11,0.4)] cursor-pointer hover:scale-105 transition-all"
            title={
              outdatedWarnings[0]?.message ||
              t('upgrade_available', 'Outdated Version: Click to Upgrade Mod')
            }
          >
            <Sparkles size={12} /> {t('upgrade_badge', 'Upgrade')}
          </button>
        )}

        {badgesConfig.showWarningBadges !== false && hasBackup && onOpenRestoreBackup && (
          <button
            onClick={onOpenRestoreBackup}
            className="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white text-xs px-2.5 py-1 rounded-full border border-indigo-300 font-bold flex items-center gap-1 shadow-[0_0_15px_rgba(99,102,241,0.4)] cursor-pointer hover:scale-105 transition-all"
            title={t(
              'backup_available_tooltip',
              'Backup available: Click to review and restore previous files'
            )}
          >
            <RotateCcw size={12} /> {t('backup_badge', 'Rollback')}
          </button>
        )}

        {sizeBytes !== null && badgesConfig.showSizeBadge && (
          <span
            className={`${badgeStyleClass} text-white text-xs px-3 py-1 rounded-full font-bold tracking-wide shadow-lg`}
          >
            {formatSize(sizeBytes)}
          </span>
        )}

        {badgesConfig.showWarningBadges !== false && isStale && (
          <span
            className="bg-yellow-500/90 text-black text-xs px-2.5 py-1 rounded-full border border-yellow-300 font-bold flex items-center gap-1 shadow-lg cursor-help"
            title={`Unrecognized Hash (${invalidHashes.length}): ${invalidHashes.join(', ')}. This mod may be outdated.`}
          >
            <AlertTriangle size={12} /> Stale Hash
          </span>
        )}

        {badgesConfig.showWarningBadges !== false && hasHashConflict && (
          <button
            onClick={onOpenHashConflicts}
            className="p-2 bg-red-500/90 hover:bg-red-500 text-white rounded-full border border-red-300 shadow-lg cursor-pointer hover:scale-105 transition-all flex items-center justify-center"
            title={t('conflict_title', 'Hash Conflict Detected with another mod')}
          >
            <ShieldAlert size={14} />
          </button>
        )}

        {badgesConfig.showWarningBadges !== false && multiCharWarnings.length > 0 && (
          <button
            onClick={onOpenMultiCharWarnings}
            className="p-2 bg-yellow-500/90 hover:bg-yellow-400 text-black rounded-full border border-yellow-300 shadow-lg cursor-pointer hover:scale-105 transition-all flex items-center justify-center"
            title={
              multiCharWarnings[0]?.message ||
              t(
                'multi_character_title',
                'Multi-Character Mod: Contains hashes for multiple characters'
              )
            }
          >
            <Users size={14} />
          </button>
        )}

        {badgesConfig.showWarningBadges !== false && iniWarnings.length > 0 && (
          <button
            onClick={onOpenIniWarnings}
            className="p-2 bg-sky-500/90 hover:bg-sky-400 text-white rounded-full border border-sky-300 shadow-lg shadow-sky-500/20 cursor-pointer hover:scale-105 transition-all flex items-center justify-center"
            title={t('ini_warnings_title', 'INI Script Issue: Click to view/fix script issues')}
          >
            <FileCode size={14} />
          </button>
        )}
      </div>
    </>
  );
});
