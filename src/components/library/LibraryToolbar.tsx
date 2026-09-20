import { memo } from 'react';
import { FolderPlus, RefreshCw, Globe, Bookmark, Sparkles, Search, X } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { CharacterFilters } from '../characters/CharacterFilters';
import { LibraryToolsMenu } from './LibraryToolsMenu';
import { EntityCategory } from '../../types';
import { PerformanceProfile } from '../../store/useAppStore';

export interface LibraryToolbarProps {
  activeLibraryTab: EntityCategory;
  modsPath: string;
  highlightTargetId?: string | null;
  // Folder generation
  isGeneratingFolders: boolean;
  onGenerateMissingFolders: () => void;
  onOpenFolderManagement?: () => void;
  onOpenImportMods?: () => void;
  onOpenProfiles?: () => void;
  hasActiveProfile?: boolean;
  activeProfileName?: string | null;
  // Update checker
  isCheckingUpdates: boolean;
  availableUpdatesCount: number;
  onCheckUpdates: () => void;
  // Mod fixer
  onOpenBatchFix: () => void;
  // Filters & Search
  uniqueFilters: {
    elements: string[];
    factions: string[];
    genders: string[];
    heights: string[];
    models: string[];
    roles: string[];
    species: string[];
  };
  selectedElement: string;
  setSelectedElement: (val: string) => void;
  selectedFaction: string;
  setSelectedFaction: (val: string) => void;
  selectedRole: string;
  setSelectedRole: (val: string) => void;
  selectedSpecies: string;
  setSelectedSpecies: (val: string) => void;
  selectedGender: string;
  setSelectedGender: (val: string) => void;
  selectedHeight: string;
  setSelectedHeight: (val: string) => void;
  selectedModel: string;
  setSelectedModel: (val: string) => void;
  onClearFilters?: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  isGlobalSearch: boolean;
  onToggleGlobalSearch: () => void;
  // Performance Profile
  performanceProfile: PerformanceProfile;
  onCyclePerformanceProfile: () => void;
  // Actions
  isScanningDisk: boolean;
  onManualScan: () => void;
  isAnalyzingMods: boolean;
  onRunManualAnalysis: () => void;
  isInstalling: boolean;
  onInstallZip: () => void;
  hasSeenInstallTutorial: boolean;
}

export const LibraryToolbar = memo(function LibraryToolbar({
  activeLibraryTab,
  modsPath,
  highlightTargetId,
  isGeneratingFolders,
  onGenerateMissingFolders,
  onOpenFolderManagement,
  onOpenImportMods,
  onOpenProfiles,
  hasActiveProfile,
  activeProfileName,
  isCheckingUpdates,
  availableUpdatesCount,
  onCheckUpdates,
  onOpenBatchFix,
  uniqueFilters,
  selectedElement,
  setSelectedElement,
  selectedFaction,
  setSelectedFaction,
  selectedRole,
  setSelectedRole,
  selectedSpecies,
  setSelectedSpecies,
  selectedGender,
  setSelectedGender,
  selectedHeight,
  setSelectedHeight,
  selectedModel,
  setSelectedModel,
  onClearFilters,
  searchQuery,
  setSearchQuery,
  isGlobalSearch,
  onToggleGlobalSearch,
  performanceProfile,
  onCyclePerformanceProfile,
  isScanningDisk,
  onManualScan,
  isAnalyzingMods,
  onRunManualAnalysis,
  isInstalling,
  onInstallZip,
  hasSeenInstallTutorial,
}: LibraryToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="glass-panel rounded-none px-6 py-3 border-b border-textMain/10 shrink-0 flex flex-col gap-2.5 z-10">
      {/* Tier 1: Header Context, Loadouts & Primary Action Controls */}
      <div className="flex items-center justify-between gap-4">
        {/* Left: Category Subtitle + Presets Pill + Updates Badge */}
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <p className="text-xs md:text-sm font-semibold text-textMuted truncate">
            {t('manage_your_mods', { tab: t(activeLibraryTab) })}
          </p>

          {/* Presets Button */}
          {onOpenProfiles && (
            <button
              type="button"
              onClick={onOpenProfiles}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all border flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm ${
                hasActiveProfile
                  ? 'border-primary/40 bg-primary/15 text-primary hover:bg-primary/25 ring-1 ring-primary/30'
                  : 'border-white/10 bg-surface-light hover:bg-white/10 text-textMain'
              }`}
              title={
                activeProfileName
                  ? `${t('presets_tooltip')}: ${activeProfileName}`
                  : t('presets_tooltip')
              }
            >
              <Bookmark
                size={13}
                className={hasActiveProfile ? 'text-primary fill-primary/30' : 'text-primary'}
              />
              <span className="text-textMuted font-normal text-[11px] hidden sm:inline">
                {t('presets_btn')}:
              </span>
              <span className="max-w-[130px] truncate font-bold">
                {hasActiveProfile && activeProfileName ? activeProfileName : t('presets_btn')}
              </span>
            </button>
          )}

          {/* Available Updates Alert Pill */}
          {availableUpdatesCount > 0 && (
            <button
              data-highlight-id="check_updates_btn"
              onClick={onCheckUpdates}
              disabled={!modsPath || isCheckingUpdates}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all border flex items-center gap-1.5 cursor-pointer shrink-0 animate-pulse ${
                highlightTargetId === 'check_updates_btn' ? 'highlight-target' : ''
              } bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/40 shadow-sm`}
              title={t('updates_count_badge', '{{count}} Updates Available', {
                count: availableUpdatesCount,
              })}
            >
              <Sparkles size={13} className="text-amber-400 shrink-0" />
              <span className="font-extrabold text-[11px]">
                {t('updates_count_badge', '{{count}} Updates Available', {
                  count: availableUpdatesCount,
                })}
              </span>
            </button>
          )}
        </div>

        {/* Right: Scan Disk + Tools Dropdown + Install Mod Button */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Quick Scan Disk Button */}
          <button
            type="button"
            onClick={onManualScan}
            disabled={isScanningDisk}
            className="px-3 py-2 rounded-xl font-bold text-xs shrink-0 transition-all border border-white/10 bg-surface-light hover:bg-white/10 text-textMain shadow-sm flex items-center gap-1.5 cursor-pointer"
            title={t(
              'scan_folders_tooltip',
              'Scan physical disk for newly added or changed mod folders.'
            )}
          >
            <RefreshCw
              size={13}
              className={isScanningDisk ? 'animate-spin text-primary' : 'text-textMuted'}
            />
            <span className="hidden sm:inline">
              {isScanningDisk ? t('scanning', 'Scanning...') : t('scan_folders_btn', 'Scan Disk')}
            </span>
          </button>

          {/* Quick Generate Folders Button */}
          <button
            type="button"
            data-highlight-id="generate_folders_btn"
            onClick={onGenerateMissingFolders}
            disabled={isGeneratingFolders || !modsPath}
            className={`px-3 py-2 rounded-xl font-bold text-xs shrink-0 transition-all border border-white/10 bg-surface-light hover:bg-white/10 text-textMain shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
              highlightTargetId === 'generate_folders_btn' ? 'highlight-target' : ''
            }`}
            title={t(
              'generate_folders_tooltip',
              'Automatically create default character folders for all playable characters.'
            )}
          >
            {isGeneratingFolders ? (
              <RefreshCw size={13} className="animate-spin text-primary shrink-0" />
            ) : (
              <FolderPlus size={13} className="text-primary shrink-0" />
            )}
            <span className="hidden sm:inline">
              {isGeneratingFolders
                ? t('generating_folders', 'Generating...')
                : t('generate_folders', 'Generate Folders')}
            </span>
          </button>

          {/* Tools & Maintenance Dropdown Menu */}
          <LibraryToolsMenu
            modsPath={modsPath}
            highlightTargetId={highlightTargetId}
            isCheckingUpdates={isCheckingUpdates}
            availableUpdatesCount={availableUpdatesCount}
            onCheckUpdates={onCheckUpdates}
            onOpenBatchFix={onOpenBatchFix}
            isAnalyzingMods={isAnalyzingMods}
            onRunManualAnalysis={onRunManualAnalysis}
            onOpenFolderManagement={onOpenFolderManagement}
            onOpenImportMods={onOpenImportMods}
            performanceProfile={performanceProfile}
            onCyclePerformanceProfile={onCyclePerformanceProfile}
          />

          {/* Primary Hero Install Mod Button */}
          <button
            data-highlight-id="install_mod_btn"
            onClick={onInstallZip}
            disabled={isInstalling}
            className={`px-4 md:px-5 py-2 rounded-xl font-bold text-xs md:text-sm shadow-lg transition-all flex items-center gap-2 cursor-pointer ${
              highlightTargetId === 'install_mod_btn' ? 'highlight-target' : ''
            } ${
              isInstalling
                ? 'bg-primary/50 text-white/50 cursor-not-allowed'
                : !hasSeenInstallTutorial
                  ? 'bg-primary/20 border-2 border-primary/60 animate-pulse text-primary shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.4)]'
                  : 'bg-primary text-white hover:bg-primary/80 shadow-primary/20'
            }`}
            title={t('install_mod_archive')}
          >
            <FolderPlus size={15} className="shrink-0" />
            <span className="whitespace-nowrap">
              {isInstalling ? t('installing') : t('install_mod_archive')}
            </span>
          </button>
        </div>
      </div>

      {/* Tier 2: Search & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-white/5">
        {/* Left: Unified Search Bar */}
        <div
          data-highlight-id="global_search_input"
          className={`flex items-center gap-2 flex-1 min-w-[240px] max-w-md ${
            highlightTargetId === 'global_search_input' ? 'highlight-target rounded-xl' : ''
          }`}
        >
          <div className="relative flex-1 flex items-center">
            <Search size={14} className="absolute left-3 text-textMuted pointer-events-none" />
            <input
              type="text"
              placeholder={
                activeLibraryTab === 'playable_characters'
                  ? t('search_characters_placeholder', 'Search characters...')
                  : t('search_mods_placeholder', 'Search mods...')
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isGlobalSearch) {
                  onToggleGlobalSearch();
                }
              }}
              className="w-full glass-panel border border-textMain/10 rounded-xl pl-9 pr-8 py-2 text-xs text-textMain placeholder:text-textMuted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all shadow-sm"
            />
            {searchQuery.length > 0 && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 p-0.5 rounded-full hover:bg-white/10 text-textMuted hover:text-textMain transition-colors"
                title={t('clear_search', 'Clear search')}
              >
                <X size={12} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleGlobalSearch}
            className={`px-3 py-2 rounded-xl font-bold text-xs shrink-0 transition-all border flex items-center gap-1.5 cursor-pointer ${
              isGlobalSearch
                ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                : 'bg-surface-light border-white/10 hover:bg-primary/20 hover:border-primary/50 text-textMain'
            }`}
            title={t('search_all', 'Search across all categories')}
          >
            <Globe
              size={13}
              className={isGlobalSearch ? 'animate-pulse text-white' : 'text-primary'}
            />
            <span>
              {isGlobalSearch ? t('global_search_active', 'Global') : t('search_all', 'Search All')}
            </span>
          </button>
        </div>

        {/* Right: Character Filters (Only for playable characters) */}
        {activeLibraryTab === 'playable_characters' && (
          <div
            data-highlight-id="character_filter_bar"
            className={`flex items-center gap-2 flex-wrap ${
              highlightTargetId === 'character_filter_bar' ? 'highlight-target rounded-xl' : ''
            }`}
          >
            <CharacterFilters
              uniqueElements={uniqueFilters.elements}
              uniqueFactions={uniqueFilters.factions}
              uniqueRoles={uniqueFilters.roles}
              uniqueSpecies={uniqueFilters.species}
              uniqueGenders={uniqueFilters.genders}
              uniqueHeights={uniqueFilters.heights}
              uniqueModels={uniqueFilters.models}
              selectedElement={selectedElement}
              setSelectedElement={setSelectedElement}
              selectedFaction={selectedFaction}
              setSelectedFaction={setSelectedFaction}
              selectedRole={selectedRole}
              setSelectedRole={setSelectedRole}
              selectedSpecies={selectedSpecies}
              setSelectedSpecies={setSelectedSpecies}
              selectedGender={selectedGender}
              setSelectedGender={setSelectedGender}
              selectedHeight={selectedHeight}
              setSelectedHeight={setSelectedHeight}
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              onClearFilters={onClearFilters}
            />
          </div>
        )}
      </div>
    </div>
  );
});
