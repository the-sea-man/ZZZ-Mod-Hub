import { memo } from 'react';
import { Sparkles, CheckSquare } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { CategoryInfo, EntityDBInfo, CharacterSkin, ModSortMode } from '../../types';

export interface CategoryHeaderBannerProps {
  category: CategoryInfo;
  entityMap: Map<string, EntityDBInfo>;
  isInstalling: boolean;
  onAutoAssign: () => void;
  isBatchMode: boolean;
  onToggleBatchMode: () => void;
  onOpenMappingModal: () => void;
  modSortMode: ModSortMode;
  onSetModSortMode: (mode: ModSortMode) => void;
  highlightTargetId?: string | null;
}

export const CategoryHeaderBanner = memo(function CategoryHeaderBanner({
  category,
  entityMap,
  isInstalling,
  onAutoAssign,
  isBatchMode,
  onToggleBatchMode,
  onOpenMappingModal,
  modSortMode,
  onSetModSortMode,
  highlightTargetId,
}: CategoryHeaderBannerProps) {
  const { t } = useTranslation();

  const char = category.character_id ? entityMap.get(category.character_id) : null;

  let displayName = category.category_name;
  let assignedName = 'Unassigned';

  if (char) {
    displayName = char.real_name
      ? t(`db.${char.id}_full`, char.real_name)
      : t(`db.${char.id}`, char.name);
    assignedName = displayName;
    if (category.skin_id) {
      const skin = char.skins?.find((s: CharacterSkin) => s.id === category.skin_id);
      if (skin) {
        const skinName = t(`db.${skin.id}`, skin.name);
        displayName += ` - ${skinName}`;
        assignedName += ` - ${skinName}`;
      }
    }
  }

  return (
    <div className="flex flex-wrap justify-between items-center gap-4 mb-8 glass-panel p-6 rounded-2xl border border-textMain/5 shadow-xl min-w-0">
      <div className="min-w-0 flex-1">
        <h2 className="text-3xl font-black text-textMain tracking-tight truncate">{displayName}</h2>
        <p className="text-textMuted mt-1 truncate">
          {t('assigned_to')}
          <span className="font-bold text-primary ml-1">{assignedName}</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {category.category_name === 'Unassigned' && (category.mods || []).length > 0 && (
          <button
            data-highlight-id="auto_assign_btn"
            onClick={onAutoAssign}
            disabled={isInstalling}
            className={`px-6 py-3 bg-primary/20 hover:bg-primary/40 border border-primary/30 rounded-xl text-sm font-bold text-primary transition-all hover:shadow-[0_0_20px_rgba(var(--color-primary),0.3)] disabled:opacity-50 ${
              highlightTargetId === 'auto_assign_btn' ? 'highlight-target' : ''
            }`}
          >
            {isInstalling ? (
              t('library_sorting', 'Sorting...')
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles size={16} /> {t('library_auto_sort', 'Auto-Sort')}
              </span>
            )}
          </button>
        )}

        <button
          data-highlight-id="batch_mode_toggle"
          onClick={onToggleBatchMode}
          className={`px-4 py-3 rounded-xl text-sm font-bold border transition-all flex items-center gap-2 ${
            highlightTargetId === 'batch_mode_toggle' ? 'highlight-target' : ''
          } ${
            isBatchMode
              ? 'bg-primary text-white border-primary shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.3)]'
              : 'bg-surface hover:bg-background border-textMain/10 text-textMain hover:border-primary/50'
          }`}
        >
          <CheckSquare size={16} /> {t('batch_mode')}
        </button>

        {category.category_name !== 'Unassigned' && (
          <button
            data-highlight-id="map_category_btn"
            onClick={onOpenMappingModal}
            className={`px-6 py-3 bg-surface hover:bg-background border border-textMain/10 rounded-xl text-sm font-bold text-textMain transition-all hover:border-primary/50 hover:shadow-[0_0_20px_rgba(var(--color-primary),0.2)] ${
              highlightTargetId === 'map_category_btn' ? 'highlight-target' : ''
            }`}
          >
            {t('change_assignment')}
          </button>
        )}

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
