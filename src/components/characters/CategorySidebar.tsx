import { useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from '../../hooks/useTranslation';
import { convertFileSrc } from '@tauri-apps/api/core';
import { CategoryInfo, EntityDBInfo, CategorySummary } from '../../types';
import { Folder, Star, Filter, Sparkles, Loader2 } from 'lucide-react';
import { useAppStore, type AppStore } from '../../store/useAppStore';

const toAssetUrl = (url?: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('asset://')) {
    return url;
  }
  return convertFileSrc(url);
};

interface CategorySidebarProps {
  filteredCategories: CategoryInfo[];
  entitiesDB: EntityDBInfo[];
  selectedCategory: string | null;
  setSelectedCategory: (val: string) => void;
  favoriteCategories: string[];
  toggleFavoriteCategory: (val: string) => void;
  categorySummaries?: Map<string, CategorySummary>;
}

const selectCategoryIcons = (s: AppStore) => s.categoryIcons;
const selectCategoryFilterMode = (s: AppStore) => s.categoryFilterMode;
const selectSetCategoryFilterMode = (s: AppStore) => s.setCategoryFilterMode;
const selectAnimationsEnabled = (s: AppStore) => s.animationsEnabled;
const selectLowPerformanceMode = (s: AppStore) => s.lowPerformanceMode;
const selectAvailableUpdates = (s: AppStore) => s.availableUpdates;
const selectIsLoadingLibrary = (s: AppStore) => s.isLoadingLibrary;

export const CategorySidebar = memo(function CategorySidebar({
  filteredCategories,
  entitiesDB,
  selectedCategory,
  setSelectedCategory,
  favoriteCategories,
  toggleFavoriteCategory,
  categorySummaries,
}: CategorySidebarProps) {
  const { t } = useTranslation();
  const categoryIcons = useAppStore(selectCategoryIcons);
  const categoryFilterMode = useAppStore(selectCategoryFilterMode);
  const setCategoryFilterMode = useAppStore(selectSetCategoryFilterMode);
  const animationsEnabled = useAppStore(selectAnimationsEnabled);
  const lowPerformanceMode = useAppStore(selectLowPerformanceMode);
  const availableUpdates = useAppStore(selectAvailableUpdates);
  const isLoadingLibrary = useAppStore(selectIsLoadingLibrary);

  const enableMotion = animationsEnabled && !lowPerformanceMode;

  const updatedModPaths = useMemo(() => {
    const set = new Set<string>();
    availableUpdates.forEach((u) => {
      set.add(u.mod_path);
      set.add(u.mod_path.replace(/\\/g, '/'));
    });
    return set;
  }, [availableUpdates]);

  const entityMap = useMemo(() => {
    const map = new Map<string, EntityDBInfo>();
    if (Array.isArray(entitiesDB)) {
      for (const ent of entitiesDB) {
        if (ent && ent.id) {
          map.set(ent.id, ent);
        }
      }
    }
    return map;
  }, [entitiesDB]);

  const handleCycleFilter = () => {
    if (categoryFilterMode === 'all') setCategoryFilterMode('installed');
    else if (categoryFilterMode === 'installed') setCategoryFilterMode('actives');
    else setCategoryFilterMode('all');
  };

  const getFilterLabel = () => {
    if (categoryFilterMode === 'all') return t('filter_all_folders', 'All Folders');
    if (categoryFilterMode === 'installed') return t('filter_installed', 'Installed Mods');
    return t('filter_actives', 'Active Mods');
  };

  return (
    <div className="w-80 border-r border-textMain/5 flex flex-col glass-panel relative z-10">
      <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0 glass-panel rounded-none z-20">
        <span className="text-sm font-bold text-textMuted">{t('folders', 'Folders')}</span>
        <button
          onClick={handleCycleFilter}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface hover:bg-white/10 text-xs font-semibold text-textMuted hover:text-textMain transition-colors border border-white/5 cursor-pointer shadow-sm"
          title={t('filter_cycle_tooltip', 'Cycle category visibility')}
        >
          <Filter size={12} className="text-primary" />
          <span>{getFilterLabel()}</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
        {isLoadingLibrary && filteredCategories.length === 0 ? (
          <div className="space-y-2.5 p-1 animate-pulse">
            <div className="px-2 py-1 flex items-center justify-between text-xs text-textMuted">
              <span className="font-semibold text-primary flex items-center gap-1.5">
                <Loader2 size={13} className="animate-spin" />
                {t('library_loading_folders', 'Loading Folders...')}
              </span>
            </div>
            {[...Array(7)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-2xl border border-white/5 bg-white/[0.02]"
              >
                <div className="w-10 h-10 rounded-xl bg-white/10 shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div
                    className="h-3.5 bg-white/10 rounded-md"
                    style={{ width: `${55 + ((i * 17) % 35)}%` }}
                  />
                  <div className="h-2.5 bg-white/5 rounded-md w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="text-center p-8 text-textMuted text-sm font-medium">
            {t('no_categories_match_search', 'No categories match your search.')}
          </div>
        ) : (
          filteredCategories.map((cat: CategoryInfo) => {
            const summary = categorySummaries?.get(cat.category_name);
            const char =
              summary?.charInfo ?? (cat.character_id ? entityMap.get(cat.character_id) : null);
            const skin = char && cat.skin_id ? char.skins?.find((s) => s.id === cat.skin_id) : null;
            const iconUrl = skin?.icon_url || char?.icon_url || char?.image_url;
            const isSelected = selectedCategory === cat.category_name;
            const totalMods = summary ? summary.totalMods : (cat.mods || []).length;
            const activeCount = summary
              ? summary.activeModsCount
              : (cat.mods || []).filter((m) => m && m.is_enabled).length;
            const updateCount = summary
              ? summary.updateModsCount
              : updatedModPaths.size > 0
                ? (cat.mods || []).filter(
                    (m) =>
                      m &&
                      (updatedModPaths.has(m.full_path) ||
                        updatedModPaths.has(m.full_path.replace(/\\/g, '/')))
                  ).length
                : 0;

            return (
              <button
                key={cat.category_name}
                onClick={() => setSelectedCategory(cat.category_name)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 relative overflow-hidden group text-left
                  ${isSelected ? 'bg-primary/20 border border-primary/50 shadow-lg shadow-primary/10' : 'hover:bg-surface border border-transparent'}`}
              >
                {isSelected && enableMotion && (
                  <motion.div
                    layoutId="active-category"
                    className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}

                <div className="w-12 h-12 rounded-lg bg-background flex items-center justify-center overflow-hidden relative border border-textMain/10 shadow-inner shrink-0 group-hover:border-primary/50 transition-colors z-10">
                  {categoryIcons[cat.category_name] ? (
                    <span className="text-xl">{categoryIcons[cat.category_name]}</span>
                  ) : iconUrl ? (
                    <img
                      src={toAssetUrl(iconUrl)}
                      alt={char ? t(`db.${char.id}`, char.name) : cat.category_name}
                      className="w-full h-full object-contain"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <Folder size={24} className="text-textMuted/50" />
                  )}
                </div>

                <div className="flex-1 min-w-0 flex items-center justify-between z-10 relative">
                  <div className="flex flex-col text-left min-w-0 pr-2">
                    <div
                      className={`font-bold truncate ${isSelected ? 'text-primary' : 'text-textMain group-hover:text-primary transition-colors'}`}
                    >
                      {char ? t(`db.${char.id}`, char.name) : cat.category_name}
                    </div>
                    <div className="text-xs font-medium flex items-center flex-wrap gap-x-2 mt-0.5">
                      <span className="text-textMuted whitespace-nowrap">
                        {totalMods} mod{totalMods === 1 ? '' : 's'}
                      </span>
                      {activeCount > 0 && (
                        <>
                          <span className="text-textMuted/30">•</span>
                          <span className="text-primary font-bold whitespace-nowrap">
                            {activeCount} active
                          </span>
                        </>
                      )}
                      {updateCount > 0 && (
                        <>
                          <span className="text-textMuted/30">•</span>
                          <span
                            title={t(
                              'category_updates_tooltip',
                              '{{count}} mod update(s) available on GameBanana',
                              { count: updateCount }
                            )}
                            className="text-amber-400 font-bold whitespace-nowrap flex items-center gap-1 animate-pulse"
                          >
                            <Sparkles size={11} />
                            <span>{updateCount}</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      toggleFavoriteCategory(cat.category_name);
                    }}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      favoriteCategories.includes(cat.category_name)
                        ? 'text-yellow-400 hover:text-yellow-500 hover:bg-yellow-400/10'
                        : 'text-textMuted/50 hover:text-textMuted hover:bg-surface-light'
                    }`}
                    title="Toggle Favorite"
                  >
                    <Star
                      size={20}
                      fill={
                        favoriteCategories.includes(cat.category_name) ? 'currentColor' : 'none'
                      }
                      className="pointer-events-none"
                    />
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
});

CategorySidebar.displayName = 'CategorySidebar';
