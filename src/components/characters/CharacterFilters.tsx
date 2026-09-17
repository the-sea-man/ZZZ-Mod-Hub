import { Globe, RotateCcw } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

export interface CharacterFiltersProps {
  uniqueElements: string[];
  uniqueFactions: string[];
  uniqueGenders: string[];
  uniqueHeights: string[];
  uniqueModels: string[];
  uniqueSpecies: string[];
  uniqueRoles: string[];
  selectedElement: string;
  setSelectedElement: (val: string) => void;
  selectedFaction: string;
  setSelectedFaction: (val: string) => void;
  selectedGender: string;
  setSelectedGender: (val: string) => void;
  selectedHeight: string;
  setSelectedHeight: (val: string) => void;
  selectedModel: string;
  setSelectedModel: (val: string) => void;
  selectedSpecies: string;
  setSelectedSpecies: (val: string) => void;
  selectedRole: string;
  setSelectedRole: (val: string) => void;
  onClearFilters?: () => void;
  searchQuery?: string;
  setSearchQuery?: (val: string) => void;
  onSearchAll?: () => void;
  isGlobalSearch?: boolean;
  showSearch?: boolean;
}

export function CharacterFilters({
  uniqueElements,
  uniqueFactions,
  uniqueGenders,
  uniqueHeights,
  uniqueModels,
  uniqueSpecies,
  uniqueRoles,
  selectedElement,
  setSelectedElement,
  selectedFaction,
  setSelectedFaction,
  selectedGender,
  setSelectedGender,
  selectedHeight,
  setSelectedHeight,
  selectedModel,
  setSelectedModel,
  selectedSpecies,
  setSelectedSpecies,
  selectedRole,
  setSelectedRole,
  onClearFilters,
  searchQuery,
  setSearchQuery,
  onSearchAll,
  isGlobalSearch,
  showSearch = false,
}: CharacterFiltersProps) {
  const {
    showElementFilter,
    showFactionFilter,
    showGenderFilter,
    showHeightFilter,
    showModelFilter,
    showSpeciesFilter,
    showRoleFilter,
  } = useAppStore();
  const { t } = useTranslation();

  const toDbKey = (val: string) => `db.${val.toLowerCase().replace(/ /g, '_')}`;

  const hasActiveFilter =
    selectedElement !== 'All' ||
    selectedFaction !== 'All' ||
    selectedRole !== 'All' ||
    selectedSpecies !== 'All' ||
    selectedGender !== 'All' ||
    selectedHeight !== 'All' ||
    selectedModel !== 'All';

  const selectClass =
    'flex-1 min-w-[110px] max-w-[170px] truncate glass-panel border border-textMain/10 rounded-xl px-3 py-2 text-xs font-medium text-textMain focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all shadow-sm';

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {showElementFilter && (
        <select
          value={selectedElement}
          onChange={(e) => setSelectedElement(e.target.value)}
          className={selectClass}
        >
          {uniqueElements.map((el) => (
            <option key={el as string} value={el as string} className="bg-background text-textMain">
              {el === 'All' ? t('all_elements') : t(toDbKey(el as string), el as string)}
            </option>
          ))}
        </select>
      )}

      {showFactionFilter && (
        <select
          value={selectedFaction}
          onChange={(e) => setSelectedFaction(e.target.value)}
          className={selectClass}
        >
          {uniqueFactions.map((fac) => (
            <option
              key={fac as string}
              value={fac as string}
              className="bg-background text-textMain"
            >
              {fac === 'All' ? t('all_factions') : t(toDbKey(fac as string), fac as string)}
            </option>
          ))}
        </select>
      )}

      {showRoleFilter && (
        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          className={selectClass}
        >
          {uniqueRoles.map((role) => (
            <option
              key={role as string}
              value={role as string}
              className="bg-background text-textMain"
            >
              {role === 'All' ? t('all_roles') : t(toDbKey(role as string), role as string)}
            </option>
          ))}
        </select>
      )}

      {showSpeciesFilter && (
        <select
          value={selectedSpecies}
          onChange={(e) => setSelectedSpecies(e.target.value)}
          className={selectClass}
        >
          {uniqueSpecies.map((sp) => (
            <option key={sp as string} value={sp as string} className="bg-background text-textMain">
              {sp === 'All' ? t('all_species') : t(toDbKey(sp as string), sp as string)}
            </option>
          ))}
        </select>
      )}

      {showGenderFilter && (
        <select
          value={selectedGender}
          onChange={(e) => setSelectedGender(e.target.value)}
          className={selectClass}
        >
          {uniqueGenders.map((g) => (
            <option key={g as string} value={g as string} className="bg-background text-textMain">
              {g === 'All' ? t('all_genders') : t(toDbKey(g as string), g as string)}
            </option>
          ))}
        </select>
      )}

      {showHeightFilter && (
        <select
          value={selectedHeight}
          onChange={(e) => setSelectedHeight(e.target.value)}
          className={selectClass}
        >
          {uniqueHeights.map((h) => (
            <option key={h as string} value={h as string} className="bg-background text-textMain">
              {h === 'All' ? t('all_heights') : t(toDbKey(h as string), h as string)}
            </option>
          ))}
        </select>
      )}

      {showModelFilter && (
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className={selectClass}
        >
          {uniqueModels.map((m) => (
            <option key={m as string} value={m as string} className="bg-background text-textMain">
              {m === 'All' ? t('all_models') : t(toDbKey(m as string), m as string)}
            </option>
          ))}
        </select>
      )}

      {hasActiveFilter && onClearFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="px-2.5 py-2 rounded-xl text-xs font-semibold text-textMuted hover:text-textMain hover:bg-white/10 border border-white/10 transition-all flex items-center gap-1 cursor-pointer shrink-0 shadow-sm"
          title={t('reset_filters')}
        >
          <RotateCcw size={12} className="text-primary" />
          <span>{t('reset_filters')}</span>
        </button>
      )}

      {showSearch && setSearchQuery && searchQuery !== undefined && (
        <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-md">
          <input
            id="character-search-input"
            type="text"
            placeholder={t('search_characters_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && onSearchAll && !isGlobalSearch) {
                onSearchAll();
              }
            }}
            className="flex-1 glass-panel border border-textMain/10 rounded-xl px-4 py-2 text-xs text-textMain focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all shadow-sm"
          />
          {onSearchAll && (
            <button
              type="button"
              onClick={onSearchAll}
              className={`px-3 py-2 rounded-xl font-bold text-xs shrink-0 transition-all border flex items-center gap-1.5 cursor-pointer ${
                isGlobalSearch
                  ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                  : 'bg-surface-light border-white/10 hover:bg-primary/20 hover:border-primary/50 text-textMain'
              }`}
              title={t('search_all', 'Search across all categories')}
            >
              <Globe
                size={14}
                className={isGlobalSearch ? 'animate-pulse text-white' : 'text-primary'}
              />
              <span>
                {isGlobalSearch
                  ? t('global_search_active', 'Global')
                  : t('search_all', 'Search All')}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
