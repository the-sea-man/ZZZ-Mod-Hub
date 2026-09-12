import { memo } from 'react';
import { CheckSquare } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { ModSortMode } from '../../types';

export interface GlobalSearchHeaderProps {
  searchQuery: string;
  foundCount: number;
  isBatchMode: boolean;
  onToggleBatchMode: () => void;
  modSortMode: ModSortMode;
  onSetModSortMode: (mode: ModSortMode) => void;
  selectedElement: string;
  selectedFaction: string;
  selectedRole: string;
  selectedSpecies: string;
  selectedGender: string;
  selectedHeight: string;
  selectedModel: string;
  categoryFilterMode: string;
  isFilteringUpdates: boolean;
  onClearFilters: () => void;
}

export const GlobalSearchHeader = memo(function GlobalSearchHeader({
  searchQuery,
  foundCount,
  isBatchMode,
  onToggleBatchMode,
  modSortMode,
  onSetModSortMode,
  selectedElement,
  selectedFaction,
  selectedRole,
  selectedSpecies,
  selectedGender,
  selectedHeight,
  selectedModel,
  categoryFilterMode,
  isFilteringUpdates,
  onClearFilters,
}: GlobalSearchHeaderProps) {
  const { t } = useTranslation();

  const hasActiveFilters =
    selectedElement !== 'All' ||
    selectedFaction !== 'All' ||
    selectedRole !== 'All' ||
    selectedSpecies !== 'All' ||
    selectedGender !== 'All' ||
    selectedHeight !== 'All' ||
    selectedModel !== 'All' ||
    categoryFilterMode !== 'all' ||
    isFilteringUpdates;

  return (
    <div className="flex flex-wrap justify-between items-center gap-4 mb-8 glass-panel p-6 rounded-2xl border border-textMain/5 shadow-xl min-w-0">
      <div className="min-w-0 flex-1">
        <h2 className="text-3xl font-black text-textMain tracking-tight truncate">
          {searchQuery.trim()
            ? t('global_search_title', 'Search: "{{query}}"', { query: searchQuery.trim() })
            : t('global_search_all', 'All Installed Mods')}
        </h2>
        <p className="text-textMuted mt-1">
          {t('global_search_count', '{{count}} matching mods across all categories', {
            count: foundCount,
          })}
        </p>

        {hasActiveFilters && (
          <div className="flex flex-wrap gap-1.5 mt-3 items-center">
            {selectedElement !== 'All' && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/20 text-primary border border-primary/30">
                {selectedElement}
              </span>
            )}
            {selectedFaction !== 'All' && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/20 text-primary border border-primary/30">
                {selectedFaction}
              </span>
            )}
            {selectedRole !== 'All' && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/20 text-primary border border-primary/30">
                {selectedRole}
              </span>
            )}
            {selectedSpecies !== 'All' && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/20 text-primary border border-primary/30">
                {selectedSpecies}
              </span>
            )}
            {selectedGender !== 'All' && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/20 text-primary border border-primary/30">
                {selectedGender}
              </span>
            )}
            {selectedHeight !== 'All' && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/20 text-primary border border-primary/30">
                {selectedHeight}
              </span>
            )}
            {selectedModel !== 'All' && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/20 text-primary border border-primary/30">
                {selectedModel}
              </span>
            )}
            {categoryFilterMode !== 'all' && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent/20 text-accent border border-accent/30 capitalize">
                {categoryFilterMode}
              </span>
            )}
            {isFilteringUpdates && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {t('filter_updates_badge', 'Updates')}
              </span>
            )}
            <button
              onClick={onClearFilters}
              className="px-2 py-0.5 text-xs text-textMuted hover:text-textMain hover:underline cursor-pointer transition-colors"
            >
              {t('clear_filters', 'Clear All')}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onToggleBatchMode}
          className={`px-4 py-3 rounded-xl text-sm font-bold border transition-all flex items-center gap-2 ${
            isBatchMode
              ? 'bg-primary text-white border-primary shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.3)]'
              : 'bg-surface hover:bg-background border-textMain/10 text-textMain hover:border-primary/50'
          }`}
        >
          <CheckSquare size={16} /> {t('batch_mode')}
        </button>

        <select
          value={modSortMode}
          onChange={(e) => onSetModSortMode(e.target.value as ModSortMode)}
          className="px-4 py-3 bg-surface hover:bg-background border border-textMain/10 rounded-xl text-sm font-bold text-textMain outline-none cursor-pointer transition-all hover:border-primary/50"
          title={t('mod_sort_mode', 'Mod Sort Mode')}
        >
          <option value="alpha_asc">{t('sort_alpha_asc', 'A → Z')}</option>
          <option value="alpha_desc">{t('sort_alpha_desc', 'Z → A')}</option>
          <option value="enabled_first">{t('sort_enabled_first', 'Enabled First')}</option>
          <option value="disabled_first">{t('sort_disabled_first', 'Disabled First')}</option>
        </select>
      </div>
    </div>
  );
});
