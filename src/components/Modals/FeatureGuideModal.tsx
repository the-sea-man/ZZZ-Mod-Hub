import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  X,
  Search,
  MousePointerClick,
  CheckCheck,
  StickyNote,
  ShoppingCart,
  ArrowUpDown,
  Image as ImageIcon,
  Camera,
  Zap,
  Monitor,
  Shield,
  Palette,
  Sparkles,
  LayoutGrid,
  Scissors,
  Eye,
  Lock,
  HelpCircle,
  ArrowRight,
  Sparkle,
  Wrench,
  Sliders,
  Trophy,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { WHATS_NEW } from '../../constants/whatsNew';

interface FeatureGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FeatureItem {
  id: string;
  category: 'mod_management' | 'in_game' | 'advanced' | 'customization';
  titleKey: string;
  descKey: string;
  icon: React.ElementType;
  badge?: 'automated' | 'in_game' | 'configurable';
}

const FEATURES: FeatureItem[] = [
  // Mod Management
  {
    id: 'drag_drop',
    category: 'mod_management',
    titleKey: 'feature_drag_drop_title',
    descKey: 'feature_drag_drop_desc',
    icon: MousePointerClick,
    badge: 'automated',
  },
  {
    id: 'batch_ops',
    category: 'mod_management',
    titleKey: 'feature_batch_ops_title',
    descKey: 'feature_batch_ops_desc',
    icon: CheckCheck,
  },
  {
    id: 'smart_download',
    category: 'mod_management',
    titleKey: 'feature_smart_download_title',
    descKey: 'feature_smart_download_desc',
    icon: ShoppingCart,
    badge: 'automated',
  },
  {
    id: 'global_search',
    category: 'mod_management',
    titleKey: 'feature_global_search_title',
    descKey: 'feature_global_search_desc',
    icon: Search,
  },
  {
    id: 'mod_sorting',
    category: 'mod_management',
    titleKey: 'feature_mod_sorting_title',
    descKey: 'feature_mod_sorting_desc',
    icon: ArrowUpDown,
  },
  {
    id: 'mod_notes',
    category: 'mod_management',
    titleKey: 'feature_mod_notes_title',
    descKey: 'feature_mod_notes_desc',
    icon: StickyNote,
  },
  {
    id: 'mod_image_override',
    category: 'mod_management',
    titleKey: 'feature_mod_image_override_title',
    descKey: 'feature_mod_image_override_desc',
    icon: ImageIcon,
  },

  // In-Game Features
  {
    id: 'hot_reload',
    category: 'in_game',
    titleKey: 'feature_hot_reload_title',
    descKey: 'feature_hot_reload_desc',
    icon: Zap,
    badge: 'automated',
  },
  {
    id: 'quick_snapper',
    category: 'in_game',
    titleKey: 'feature_quick_snapper_title',
    descKey: 'feature_quick_snapper_desc',
    icon: Camera,
    badge: 'in_game',
  },
  {
    id: 'keybind_conflicts',
    category: 'in_game',
    titleKey: 'feature_keybind_conflicts_title',
    descKey: 'feature_keybind_conflicts_desc',
    icon: Shield,
    badge: 'automated',
  },
  {
    id: 'ingame_hud',
    category: 'in_game',
    titleKey: 'feature_ingame_hud_title',
    descKey: 'feature_ingame_hud_desc',
    icon: Monitor,
    badge: 'in_game',
  },

  // Advanced Tools & Fixers
  {
    id: 'mod_fixer',
    category: 'advanced',
    titleKey: 'feature_mod_fixer_title',
    descKey: 'feature_mod_fixer_desc',
    icon: Wrench,
    badge: 'automated',
  },
  {
    id: 'mod_splitting',
    category: 'advanced',
    titleKey: 'feature_mod_splitting_title',
    descKey: 'feature_mod_splitting_desc',
    icon: Scissors,
  },
  {
    id: 'password_archive',
    category: 'advanced',
    titleKey: 'feature_password_archive_title',
    descKey: 'feature_password_archive_desc',
    icon: Lock,
    badge: 'automated',
  },
  {
    id: 'file_watcher',
    category: 'advanced',
    titleKey: 'feature_file_watcher_title',
    descKey: 'feature_file_watcher_desc',
    icon: Eye,
    badge: 'automated',
  },

  // Customization & Performance
  {
    id: 'themes',
    category: 'customization',
    titleKey: 'feature_themes_title',
    descKey: 'feature_themes_desc',
    icon: Palette,
    badge: 'configurable',
  },
  {
    id: 'performance_profiles',
    category: 'customization',
    titleKey: 'feature_performance_profiles_title',
    descKey: 'feature_performance_profiles_desc',
    icon: Sliders,
    badge: 'configurable',
  },
  {
    id: 'glass_settings',
    category: 'customization',
    titleKey: 'feature_glass_settings_title',
    descKey: 'feature_glass_settings_desc',
    icon: Sparkles,
    badge: 'configurable',
  },
  {
    id: 'card_size',
    category: 'customization',
    titleKey: 'feature_card_size_title',
    descKey: 'feature_card_size_desc',
    icon: LayoutGrid,
    badge: 'configurable',
  },
];

const CATEGORIES: ('mod_management' | 'in_game' | 'advanced' | 'customization')[] = [
  'mod_management',
  'in_game',
  'advanced',
  'customization',
];

export const FeatureGuideModal = ({ isOpen, onClose }: FeatureGuideModalProps) => {
  const { t } = useTranslation();
  const { setActiveTab: setAppActiveTab, appVersion } = useAppStore();
  const [activeTab, setActiveTab] = useState<'whats_new' | 'all_features'>('whats_new');
  const [searchQuery, setSearchQuery] = useState('');

  // Keyboard: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const latestRelease = WHATS_NEW[0];

  const filteredFeatures = useMemo(() => {
    if (!isOpen) return [];
    const query = searchQuery.toLowerCase().trim();
    return FEATURES.filter((feature) => {
      const title = t(feature.titleKey as any).toLowerCase();
      const desc = t(feature.descKey as any).toLowerCase();
      return title.includes(query) || desc.includes(query);
    });
  }, [isOpen, searchQuery, t]);

  const handleNavigate = (tab: 'library' | 'settings' | 'gamebanana' | 'achievements') => {
    setAppActiveTab(tab);
    onClose();
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel w-full max-w-4xl max-h-[85vh] rounded-3xl border border-white/10 shadow-2xl bg-surface/90 backdrop-blur-xl flex flex-col overflow-hidden relative"
          >
            {/* Top Decorative Flare */}
            <div className="absolute -top-32 -right-32 w-80 h-80 bg-primary/15 rounded-full blur-[90px] pointer-events-none" />

            {/* Header */}
            <div className="p-6 md:p-8 border-b border-white/5 flex items-center justify-between relative z-10 shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-2xl bg-primary/20 text-primary">
                  <HelpCircle size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-textMain tracking-tight">
                    {t('feature_guide_title')}
                  </h2>
                  <p className="text-sm text-textMuted mt-0.5">{t('feature_guide_desc')}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-textMuted hover:text-textMain transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Tab Switcher */}
            <div className="flex border-b border-white/5 px-6 md:px-8 bg-black/30 gap-6 shrink-0">
              <button
                onClick={() => setActiveTab('whats_new')}
                className={`py-3.5 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === 'whats_new'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-textMuted hover:text-textMain'
                }`}
              >
                <span>{t('whats_new_title')}</span>
                <span className="px-1.5 py-0.5 text-[10px] uppercase font-black tracking-wider bg-primary/20 text-primary rounded-md">
                  {t('badge_new')}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('all_features')}
                className={`py-3.5 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                  activeTab === 'all_features'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-textMuted hover:text-textMain'
                }`}
              >
                {t('all_features_title')}
              </button>
            </div>

            {/* Tab 1: What's New */}
            {activeTab === 'whats_new' && (
              <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6 relative z-10">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-primary/10 border border-primary/20">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/20 text-primary">
                      <Sparkle size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-textMain">
                        {t('version_prefix')} {appVersion || latestRelease.version}
                      </h3>
                      {latestRelease.date && (
                        <p className="text-xs text-textMuted">{latestRelease.date}</p>
                      )}
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-primary text-black uppercase tracking-wider">
                    {t('badge_new')}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {latestRelease.features.map((feature) => {
                    const Icon = feature.icon;

                    return (
                      <div
                        key={feature.id}
                        className="p-4 rounded-2xl border border-white/10 bg-black/40 hover:bg-white/5 transition-all duration-300 flex items-start gap-4 group relative overflow-hidden"
                      >
                        <div className="p-3 rounded-xl bg-primary/20 text-primary shrink-0">
                          <Icon size={22} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-base font-bold text-textMain group-hover:text-primary transition-colors truncate">
                              {t(feature.titleKey as any)}
                            </h4>
                            <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-primary/20 text-primary rounded-md shrink-0">
                              {t('badge_new')}
                            </span>
                          </div>
                          <p className="text-xs text-textMuted leading-relaxed line-clamp-2">
                            {t(feature.descKey as any)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Hands-on Challenges Callout Banner */}
                <div className="mt-6 p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-primary/10 to-surface/80 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
                  <div className="flex items-center gap-3.5">
                    <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                      <Trophy size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-textMain">
                        {t(
                          'feature_guide_achievements_banner_title',
                          'Looking for Hands-On Challenges?'
                        )}
                      </h4>
                      <p className="text-xs text-textMuted mt-0.5 max-w-xl">
                        {t(
                          'feature_guide_achievements_banner_desc',
                          'Explore the Achievements tab to try out features step-by-step, complete tasks, and track your progress!'
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleNavigate('achievements')}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-all shadow-md flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <span>
                      {t('feature_guide_achievements_banner_btn', 'Explore Achievements')}
                    </span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Tab 2: All Features */}
            {activeTab === 'all_features' && (
              <>
                {/* Search Bar */}
                <div className="p-4 md:px-8 border-b border-white/5 bg-black/20 shrink-0">
                  <div className="relative">
                    <Search
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-textMuted"
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t('feature_guide_search')}
                      className="w-full pl-11 pr-4 py-3 rounded-2xl bg-black/40 border border-white/10 text-textMain placeholder-textMuted text-sm focus:outline-none focus:border-primary/50 transition-all"
                    />
                  </div>
                </div>

                {/* Feature List Content */}
                <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-8 relative z-10">
                  {filteredFeatures.length === 0 ? (
                    <div className="text-center py-12 text-textMuted">
                      <Search size={40} className="mx-auto mb-3 opacity-30" />
                      <p className="text-base font-semibold">
                        {t('no_results_found', 'No matching features found')}
                      </p>
                    </div>
                  ) : (
                    CATEGORIES.map((catKey) => {
                      const catFeatures = filteredFeatures.filter((f) => f.category === catKey);
                      if (catFeatures.length === 0) return null;

                      return (
                        <div key={catKey} className="space-y-4">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-primary/90 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                            {t(`feature_category_${catKey}` as any)}
                          </h3>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {catFeatures.map((feature) => {
                              const Icon = feature.icon;

                              return (
                                <div
                                  key={feature.id}
                                  className="p-4 rounded-2xl border border-white/5 bg-black/30 hover:bg-white/5 transition-all duration-300 flex items-start gap-4 group"
                                >
                                  <div className="p-3 rounded-xl bg-white/5 group-hover:bg-primary/20 text-textMuted group-hover:text-primary transition-all shrink-0">
                                    <Icon size={22} />
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                      <h4 className="text-base font-bold text-textMain group-hover:text-primary transition-colors truncate">
                                        {t(feature.titleKey as any)}
                                      </h4>
                                      {feature.badge && (
                                        <span
                                          className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md shrink-0 border ${
                                            feature.badge === 'automated'
                                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                                              : feature.badge === 'in_game'
                                                ? 'bg-purple-500/15 text-purple-300 border-purple-500/20'
                                                : 'bg-blue-500/15 text-blue-300 border-blue-500/20'
                                          }`}
                                        >
                                          {t(`feature_badge_${feature.badge}`, feature.badge)}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-textMuted leading-relaxed mt-1 line-clamp-2">
                                      {t(feature.descKey as any)}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Hands-on Challenges Callout Banner */}
                  <div className="mt-8 p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-primary/10 to-surface/80 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
                    <div className="flex items-center gap-3.5">
                      <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                        <Trophy size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-textMain">
                          {t(
                            'feature_guide_achievements_banner_title',
                            'Looking for Hands-On Challenges?'
                          )}
                        </h4>
                        <p className="text-xs text-textMuted mt-0.5 max-w-xl">
                          {t(
                            'feature_guide_achievements_banner_desc',
                            'Explore the Achievements tab to try out features step-by-step, complete tasks, and track your progress!'
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleNavigate('achievements')}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-all shadow-md flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <span>
                        {t('feature_guide_achievements_banner_btn', 'Explore Achievements')}
                      </span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
