import { useAppStore } from '../../store/useAppStore';
import { ListFilter } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

export function CharacterFilterSettings() {
  const { t } = useTranslation();
  const {
    showElementFilter,
    showFactionFilter,
    showGenderFilter,
    showHeightFilter,
    showModelFilter,
    showSpeciesFilter,
    showRoleFilter,
    setShowElementFilter,
    setShowFactionFilter,
    setShowGenderFilter,
    setShowHeightFilter,
    setShowModelFilter,
    setShowSpeciesFilter,
    setShowRoleFilter,
    incrementStat,
    highlightTargetId,
  } = useAppStore();

  const filters = [
    { label: t('settings_filter_element'), state: showElementFilter, setter: setShowElementFilter },
    { label: t('settings_filter_faction'), state: showFactionFilter, setter: setShowFactionFilter },
    { label: t('settings_filter_role'), state: showRoleFilter, setter: setShowRoleFilter },
    { label: t('settings_filter_species'), state: showSpeciesFilter, setter: setShowSpeciesFilter },
    { label: t('settings_filter_gender'), state: showGenderFilter, setter: setShowGenderFilter },
    { label: t('settings_filter_height'), state: showHeightFilter, setter: setShowHeightFilter },
    { label: t('settings_filter_model'), state: showModelFilter, setter: setShowModelFilter },
  ];

  return (
    <div
      id="character_filter_settings"
      data-highlight-id="character_filter_settings"
      className={`glass-panel p-6 rounded-2xl border border-textMain/5 shadow-xl space-y-6 transition-all ${
        highlightTargetId === 'character_filter_settings' ? 'highlight-target' : ''
      }`}
    >
      <div className="flex items-center gap-3 border-b border-textMain/5 pb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
          <ListFilter size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-textMain">{t('settings_character_filters')}</h2>
          <p className="text-sm text-textMuted">{t('settings_character_filters_desc')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filters.map((filter, idx) => (
          <div
            key={idx}
            className="flex justify-between items-center bg-surface/30 p-3 rounded-xl border border-white/5"
          >
            <span className="text-sm font-bold text-textMain">{filter.label}</span>
            <div
              className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${
                filter.state ? 'bg-primary' : 'bg-white/10'
              }`}
              onClick={() => {
                filter.setter(!filter.state);
                incrementStat('filterConfigChanged');
              }}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  filter.state ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
