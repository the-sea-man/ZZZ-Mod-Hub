import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAppStore, TutorialId, TUTORIALS_LIST } from '../store/useAppStore';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Search,
  Lock,
  Trophy,
  Crown,
  Flame,
  Shield,
  Zap,
  X,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { ACHIEVEMENTS, AchievementCategory, TUTORIAL_TARGET_MAP } from '../constants/achievements';
import { useTranslation } from '../hooks/useTranslation';

const TUTORIAL_NAMES: Record<TutorialId, string> = {
  post_setup: 'Initial Setup & Warning Rules',
  install_mod: 'Installing Local Archive Mods (.zip/.rar)',
  launch_game: 'Launching Game via Manager',
  discover_page: 'Discover GameBanana Mods',
  achievements_page: 'Achievements & Modder Ranks',
  settings_page: 'Settings & Paths Configuration',
  generate_folders: 'Generate Clean Character Folders',
  sync: 'Sync Cloud Database & Hashes',
  randomize: 'Randomizer Loadout Shuffler',
  quick_snapper: 'Quick Snapper Screenshotting',
  hud: 'In-Game Overlay HUD & Menus',
};

interface ModderRank {
  nameKey: string;
  defaultName: string;
  icon: React.FC<any>;
  color: string;
  badgeClass: string;
  minUnlocked: number;
  nextTierAt: number | null;
}

const MODDER_RANKS: ModderRank[] = [
  {
    nameKey: 'rank_rookie_proxy',
    defaultName: 'Rookie Proxy',
    icon: Shield,
    color: 'text-amber-500',
    badgeClass: 'bg-amber-500/15 border-amber-500/40 text-amber-400',
    minUnlocked: 0,
    nextTierAt: 10,
  },
  {
    nameKey: 'rank_street_modder',
    defaultName: 'Street Modder',
    icon: Flame,
    color: 'text-cyan-400',
    badgeClass: 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300',
    minUnlocked: 10,
    nextTierAt: 20,
  },
  {
    nameKey: 'rank_hollow_engineer',
    defaultName: 'Hollow Engineer',
    icon: Zap,
    color: 'text-purple-400',
    badgeClass: 'bg-purple-500/15 border-purple-500/40 text-purple-300',
    minUnlocked: 20,
    nextTierAt: 30,
  },
  {
    nameKey: 'rank_hollow_legend',
    defaultName: 'Hollow Legend',
    icon: Crown,
    color: 'text-amber-400',
    badgeClass: 'bg-amber-400/20 border-amber-400/50 text-amber-300',
    minUnlocked: 30,
    nextTierAt: 39,
  },
  {
    nameKey: 'rank_master_completionist',
    defaultName: '100% Master Completionist',
    icon: Trophy,
    color: 'text-emerald-400',
    badgeClass:
      'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.3)]',
    minUnlocked: 39,
    nextTierAt: null,
  },
];

export function AchievementsView() {
  const { tutorialsSeen, userStats, navigateToAchievementTarget } = useAppStore();
  const { t } = useTranslation();
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AchievementCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'completed'>('all');

  const seenCount = Object.values(tutorialsSeen || {}).filter(Boolean).length;

  // Calculate unlocked achievements
  const unlockedAchievementIds = useMemo(() => {
    const ids = new Set<string>();
    const stats = userStats || ({} as any);
    for (const ach of ACHIEVEMENTS) {
      if (ach.getProgress(stats, seenCount) >= ach.target) {
        ids.add(ach.id);
      }
    }
    return ids;
  }, [userStats, seenCount]);

  const totalAchievements = ACHIEVEMENTS.length;
  const unlockedCount = unlockedAchievementIds.size;
  const inProgressCount = totalAchievements - unlockedCount;
  const completionPercent = Math.round((unlockedCount / totalAchievements) * 100);

  // Compute Current Rank
  const currentRank = useMemo(() => {
    let rank = MODDER_RANKS[0];
    for (const r of MODDER_RANKS) {
      if (unlockedCount >= r.minUnlocked) {
        rank = r;
      }
    }
    return rank;
  }, [unlockedCount]);

  const nextRank = useMemo(() => {
    const idx = MODDER_RANKS.indexOf(currentRank);
    if (idx < MODDER_RANKS.length - 1) {
      return MODDER_RANKS[idx + 1];
    }
    return null;
  }, [currentRank]);

  // Filter achievements
  const filteredAchievements = useMemo(() => {
    return ACHIEVEMENTS.filter((ach) => {
      const isUnlocked = unlockedAchievementIds.has(ach.id);

      // Status filter
      if (statusFilter === 'in_progress' && isUnlocked) return false;
      if (statusFilter === 'completed' && !isUnlocked) return false;

      // Category filter
      if (selectedCategory !== 'all' && ach.category !== selectedCategory) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = t(`achievement_${ach.id}_title` as any, ach.title)
          .toLowerCase()
          .includes(q);
        const descMatch = t(`achievement_${ach.id}_desc` as any, {
          target: ach.target,
          defaultValue: ach.description,
        })
          .toLowerCase()
          .includes(q);
        if (!titleMatch && !descMatch) return false;
      }

      return true;
    });
  }, [unlockedAchievementIds, statusFilter, selectedCategory, searchQuery, t]);

  const categories: { id: AchievementCategory; labelKey: string; defaultLabel: string }[] = [
    { id: 'all', labelKey: 'ach_category_all', defaultLabel: 'All' },
    { id: 'basics', labelKey: 'ach_category_basics', defaultLabel: 'Basics' },
    { id: 'collection', labelKey: 'ach_category_collection', defaultLabel: 'Collection' },
    { id: 'management', labelKey: 'ach_category_management', defaultLabel: 'Management' },
    { id: 'tools', labelKey: 'ach_category_tools', defaultLabel: 'Tools' },
    { id: 'customization', labelKey: 'ach_category_customization', defaultLabel: 'Customization' },
    { id: 'system', labelKey: 'ach_category_system', defaultLabel: 'System' },
    { id: 'secret', labelKey: 'ach_category_secret', defaultLabel: 'Secret' },
  ];

  const RankIcon = currentRank.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="p-4 md:p-8 w-full h-full overflow-y-auto custom-scrollbar space-y-6 text-left"
    >
      {/* ── Gamified Modder Rank Header Card ── */}
      <div className="glass-panel p-6 md:p-8 rounded-3xl border border-white/10 shadow-2xl bg-surface/70 backdrop-blur-2xl relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-primary/20 rounded-full blur-[90px] pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-amber-500/10 rounded-full blur-[90px] pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10 text-left">
          <div className="space-y-2 text-left">
            <div className="flex items-center gap-3 text-left">
              <div className="w-12 h-12 rounded-2xl bg-primary/20 text-primary flex items-center justify-center shadow-inner shrink-0">
                <Trophy size={26} />
              </div>
              <div className="text-left">
                <h1 className="text-3xl md:text-4xl font-black text-textMain tracking-tight text-left">
                  {t('achievements_title', 'Achievements')}
                </h1>
                <p className="text-textMuted text-sm text-left">
                  {t(
                    'achievements_desc',
                    'Unlock rewards by exploring the application and its features.'
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Rank Badge & Overall Progress */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 bg-background/50 border border-white/10 p-4 rounded-2xl">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-xl border ${currentRank.badgeClass} flex items-center justify-center shrink-0`}
              >
                <RankIcon size={24} />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-textMuted block">
                  {t('current_modder_rank', 'Current Rank')}
                </span>
                <span className="text-base font-black text-textMain">
                  {t(currentRank.nameKey as any, currentRank.defaultName)}
                </span>
              </div>
            </div>

            <div className="h-8 w-px bg-white/10 hidden sm:block" />

            <div className="w-full sm:w-56 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-textMuted">{t('overall_progress', 'Overall Progress')}</span>
                <span className="text-primary">
                  {unlockedCount} / {totalAchievements} ({completionPercent}%)
                </span>
              </div>
              <div className="h-2.5 w-full bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/5">
                <div
                  className="h-full bg-gradient-to-r from-primary via-primary/90 to-amber-400 rounded-full transition-all duration-1000"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
              {nextRank && nextRank.nextTierAt && (
                <span className="text-[10px] text-textMuted/80 block">
                  {t('next_rank_hint', {
                    count: nextRank.minUnlocked - unlockedCount,
                    rank: t(nextRank.nameKey as any, nextRank.defaultName),
                    defaultValue: `${nextRank.minUnlocked - unlockedCount} more to reach ${nextRank.defaultName}`,
                  })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Filters, Search & Category Navigation Bar ── */}
      <div className="glass-panel p-4 rounded-2xl border border-white/5 bg-surface/50 backdrop-blur-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Status Filters */}
        <div className="flex items-center gap-1.5 bg-background/50 p-1 rounded-xl border border-white/5 shrink-0 overflow-x-auto">
          {[
            { id: 'all', label: `${t('filter_all', 'All')} (${totalAchievements})` },
            {
              id: 'in_progress',
              label: `${t('filter_in_progress', 'In Progress')} (${inProgressCount})`,
            },
            { id: 'completed', label: `${t('filter_completed', 'Completed')} (${unlockedCount})` },
          ].map((status) => (
            <button
              key={status.id}
              onClick={() => setStatusFilter(status.id as any)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                statusFilter === status.id
                  ? 'bg-primary text-white shadow-md'
                  : 'text-textMuted hover:text-textMain hover:bg-white/5'
              }`}
            >
              {status.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative flex-1 max-w-md flex items-center">
          <Search size={16} className="absolute left-3 text-textMuted pointer-events-none" />
          <input
            type="text"
            placeholder={t('search_achievements_placeholder', 'Search achievements...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-background/50 border border-white/10 rounded-xl text-xs text-textMain placeholder-textMuted focus:outline-none focus:border-primary transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 p-1 rounded-lg text-textMuted hover:text-textMain hover:bg-white/10"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Category Chips Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 border ${
                isSelected
                  ? 'bg-primary/20 border-primary text-primary shadow-sm'
                  : 'bg-surface/40 border-white/5 text-textMuted hover:text-textMain hover:bg-surface/80'
              }`}
            >
              {cat.id === 'secret' && <Lock size={12} className="text-amber-400" />}
              <span>{t(cat.labelKey as any, cat.defaultLabel)}</span>
            </button>
          );
        })}
      </div>

      {/* ── Achievements Grid ── */}
      {filteredAchievements.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-3xl border border-white/5 bg-surface/30 space-y-3">
          <Layers size={36} className="mx-auto text-textMuted/50" />
          <h3 className="text-lg font-bold text-textMain">
            {t('no_achievements_found', 'No achievements match your filters')}
          </h3>
          <p className="text-sm text-textMuted">
            {t('no_achievements_hint', 'Try adjusting your search query or switching categories.')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6 relative z-10">
          {filteredAchievements.map((achievement) => {
            const progress = achievement.getProgress(userStats, seenCount);
            const isUnlocked = progress >= achievement.target;
            const Icon = achievement.icon;
            const isSecretLocked = achievement.isSecret && !isUnlocked;

            const navTarget =
              typeof achievement.navigationTarget === 'function'
                ? achievement.navigationTarget(userStats)
                : achievement.navigationTarget ||
                  (achievement.navigateTo ? { tab: achievement.navigateTo } : undefined);

            return (
              <div
                key={achievement.id}
                className={`p-6 rounded-3xl border transition-all duration-500 relative overflow-hidden flex flex-col justify-between ${
                  isUnlocked
                    ? 'border-primary/50 shadow-[0_0_30px_rgba(var(--color-primary-rgb),0.2)] bg-surface/90'
                    : isSecretLocked
                      ? 'border-amber-400/20 bg-black/50 border-dashed'
                      : 'border-white/5 bg-black/40'
                }`}
              >
                {isUnlocked && (
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-[50px] -mr-10 -mt-10 pointer-events-none" />
                )}

                <div>
                  <div className="flex items-start gap-4 relative z-10 mb-4">
                    <div
                      className={`p-4 rounded-2xl flex-shrink-0 ${
                        isUnlocked
                          ? 'bg-primary/20 text-primary'
                          : isSecretLocked
                            ? 'bg-amber-400/10 text-amber-400'
                            : 'bg-white/5 text-textMuted'
                      }`}
                    >
                      {isSecretLocked ? <Lock size={32} /> : <Icon size={32} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <h3
                          className={`text-lg font-bold truncate ${
                            isUnlocked
                              ? 'text-textMain'
                              : isSecretLocked
                                ? 'text-amber-300 font-mono'
                                : 'text-textMuted'
                          }`}
                        >
                          {isSecretLocked
                            ? t('secret_achievement_locked_title', '??? (Secret Achievement)')
                            : t(`achievement_${achievement.id}_title` as any, achievement.title)}
                        </h3>
                        {isUnlocked && (
                          <CheckCircle2 size={20} className="text-primary flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-textMuted leading-relaxed">
                        {isSecretLocked
                          ? t(
                              'secret_achievement_locked_desc',
                              'A hidden retro easter egg awaits. Input the legendary sequence somewhere in the app to discover it!'
                            )
                          : t(`achievement_${achievement.id}_desc` as any, {
                              target: achievement.target,
                              defaultValue: achievement.description,
                            })}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="relative z-10 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-black/30 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-1000 ${
                          isUnlocked
                            ? 'bg-primary'
                            : isSecretLocked
                              ? 'bg-amber-400/30'
                              : 'bg-white/20'
                        }`}
                        style={{
                          width: `${Math.min(100, (progress / achievement.target) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-bold text-textMuted whitespace-nowrap">
                      {Math.min(progress, achievement.target)} / {achievement.target}
                    </span>
                  </div>

                  {!isUnlocked && !isSecretLocked && (navTarget || achievement.steps) && (
                    <div className="pt-2 border-t border-white/5 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        {navTarget && (
                          <button
                            onClick={() => navigateToAchievementTarget(navTarget)}
                            className="px-3 py-1.5 rounded-xl bg-primary/20 hover:bg-primary/30 text-primary text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                          >
                            {t('achievement_go_there', 'Go There →')}
                          </button>
                        )}
                        {achievement.steps && (
                          <button
                            onClick={() =>
                              setExpandedSteps((prev) => ({
                                ...prev,
                                [achievement.id]: !prev[achievement.id],
                              }))
                            }
                            className="text-xs text-primary/80 hover:text-primary font-semibold flex items-center gap-1 transition-colors cursor-pointer ml-auto"
                          >
                            {t('achievement_how', 'How to unlock')}
                            {expandedSteps[achievement.id] ? (
                              <ChevronUp size={14} />
                            ) : (
                              <ChevronDown size={14} />
                            )}
                          </button>
                        )}
                      </div>

                      {achievement.steps &&
                        expandedSteps[achievement.id] &&
                        (achievement.id === 'tutorial_scholar' ? (
                          <div className="mt-1 p-3 rounded-2xl bg-black/50 border border-white/10 text-xs text-textMuted space-y-2 animate-fadeIn">
                            <div className="flex items-center justify-between border-b border-white/10 pb-2">
                              <span className="font-bold text-textMain text-[11px] uppercase tracking-wider">
                                {t('tutorial_checklist_title', 'Tutorial Discovery Checklist')}
                              </span>
                              <span className="text-primary font-bold text-[11px]">
                                {seenCount} / {TUTORIALS_LIST.length}
                              </span>
                            </div>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                              {TUTORIALS_LIST.map((tutId) => {
                                const isSeen = !!tutorialsSeen[tutId];
                                return (
                                  <div
                                    key={tutId}
                                    className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-white/5 border border-white/5 text-[11px]"
                                  >
                                    <div className="flex items-center gap-1.5 truncate">
                                      {isSeen ? (
                                        <CheckCircle2
                                          size={13}
                                          className="text-emerald-400 shrink-0"
                                        />
                                      ) : (
                                        <span className="w-3.5 h-3.5 rounded-full border border-textMuted/40 shrink-0" />
                                      )}
                                      <span
                                        className={`truncate ${isSeen ? 'text-textMain font-medium' : 'text-textMuted'}`}
                                      >
                                        {t(
                                          `tutorial_${tutId}_title` as any,
                                          TUTORIAL_NAMES[tutId] || tutId
                                        )}
                                      </span>
                                    </div>
                                    {!isSeen ? (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const target = TUTORIAL_TARGET_MAP[tutId];
                                          if (target) {
                                            navigateToAchievementTarget(target);
                                          }
                                        }}
                                        className="px-2 py-0.5 rounded bg-primary/20 hover:bg-primary/30 text-primary font-bold text-[10px] shrink-0 transition-colors flex items-center gap-1"
                                      >
                                        <span>{t('tutorial_locate_btn', 'Go to Button')}</span>
                                        <ArrowRight size={10} />
                                      </button>
                                    ) : (
                                      <span className="text-[10px] text-emerald-400/80 font-bold px-1.5 py-0.5">
                                        {t('tutorial_seen_badge', 'Seen')}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-1 p-3 rounded-2xl bg-black/50 border border-white/10 text-xs text-textMuted animate-fadeIn">
                            <p className="font-bold text-textMain text-[11px] uppercase tracking-wider mb-2">
                              {t('achievement_how_to_unlock', 'How to Unlock:')}
                            </p>
                            <ol className="list-decimal list-inside space-y-1.5 leading-relaxed text-zinc-300">
                              {achievement.steps.map((stepKey, idx) => (
                                <li key={idx} className="pl-1">
                                  {t(stepKey as any, `Step ${idx + 1}`)}
                                </li>
                              ))}
                            </ol>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
