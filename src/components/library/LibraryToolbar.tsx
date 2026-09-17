import { memo } from 'react';
import {
  FolderPlus,
  RefreshCw,
  Wrench,
  ShieldAlert,
  Globe,
  FolderCog,
  Bookmark,
} from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { CharacterFilters } from '../characters/CharacterFilters';
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
    <div className="glass-panel rounded-none p-4 border-b border-textMain/10 shrink-0 flex items-center justify-between gap-4 z-10">
      <div className="flex flex-col gap-2 shrink-0">
        <p className="text-textMuted mt-2 font-medium">
          {t('manage_your_mods', { tab: t(activeLibraryTab) })}
        </p>
        <div className="flex gap-2">
          <button
            data-highlight-id="generate_folders_btn"
            onClick={onGenerateMissingFolders}
            disabled={isGeneratingFolders || !modsPath}
            className={`flex items-center gap-2 px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg text-xs font-bold transition-colors w-fit disabled:opacity-50 ${
              highlightTargetId === 'generate_folders_btn' ? 'highlight-target' : ''
            }`}
          >
            {isGeneratingFolders ? (
              <RefreshCw className="animate-spin" size={14} />
            ) : (
              <FolderPlus size={14} />
            )}
            {t('generate_folders')}
          </button>

          <button
            data-highlight-id="check_updates_btn"
            onClick={onCheckUpdates}
            disabled={!modsPath || isCheckingUpdates}
            className={`flex items-center gap-2 px-3 py-1.5 ${
              availableUpdatesCount > 0
                ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30'
                : 'bg-green-500/20 hover:bg-green-500/30 text-green-400'
            } rounded-lg text-xs font-bold transition-colors w-fit disabled:opacity-50 ${
              highlightTargetId === 'check_updates_btn' ? 'highlight-target' : ''
            }`}
            title={
              availableUpdatesCount > 0
                ? t('updates_count_badge', '{{count}} Updates Available', {
                    count: availableUpdatesCount,
                  })
                : t('check_for_updates', 'Check for Updates')
            }
          >
            <RefreshCw size={14} className={isCheckingUpdates ? 'animate-spin' : ''} />
            {isCheckingUpdates
              ? t('checking', 'Checking...')
              : availableUpdatesCount > 0
                ? t('updates_count_badge', '{{count}} Updates Available', {
                    count: availableUpdatesCount,
                  })
                : t('check_for_updates', 'Check for Updates')}
          </button>

          <button
            onClick={onOpenBatchFix}
            className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-xs font-bold transition-colors w-fit shadow-sm border border-amber-500/20"
            title={t('upgrade_outdated_mods', 'Scan & Upgrade Outdated Mods')}
          >
            <Wrench size={14} className="text-amber-400" />
            {t('upgrade_outdated_mods', 'Upgrade Outdated Mods')}
          </button>
        </div>
      </div>

      {activeLibraryTab === 'playable_characters' ? (
        <div
          data-highlight-id="character_filter_bar"
          className={
            highlightTargetId === 'character_filter_bar' ||
            highlightTargetId === 'global_search_input'
              ? 'highlight-target rounded-2xl'
              : ''
          }
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
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onSearchAll={onToggleGlobalSearch}
            isGlobalSearch={isGlobalSearch}
          />
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-md">
          <input
            type="text"
            placeholder={t('search_mods_placeholder', 'Search mods...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isGlobalSearch) {
                onToggleGlobalSearch();
              }
            }}
            className="flex-1 glass-panel border border-textMain/10 rounded-xl px-4 py-3 text-sm text-textMain focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all shadow-lg shadow-black/5"
          />
          <button
            type="button"
            onClick={onToggleGlobalSearch}
            className={`px-3.5 py-3 rounded-xl font-bold text-xs shrink-0 transition-all border flex items-center gap-1.5 cursor-pointer ${
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
              {isGlobalSearch ? t('global_search_active', 'Global') : t('search_all', 'Search All')}
            </span>
          </button>
        </div>
      )}

      {/* Performance Profile Cycle Pill */}
      <button
        type="button"
        onClick={onCyclePerformanceProfile}
        className={`ml-2 px-3 py-2.5 rounded-xl font-bold text-xs shrink-0 transition-all border flex items-center gap-1.5 cursor-pointer shadow-sm ${
          performanceProfile === 'low'
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
            : performanceProfile === 'balanced'
              ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20'
              : performanceProfile === 'high'
                ? 'border-purple-500/40 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
        }`}
        title={t(
          'performance_profile_desc',
          'Select how ZZZ Mod Hub balances background scanning, file monitoring, and visual fidelity.'
        )}
      >
        <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
        <span>
          {performanceProfile === 'low'
            ? t('profile_low_badge', 'Low Overhead')
            : performanceProfile === 'balanced'
              ? t('profile_balanced_badge', 'Recommended')
              : performanceProfile === 'high'
                ? t('profile_high_badge', 'High Performance')
                : t('profile_custom_badge', 'Tailored')}
        </span>
      </button>

      {/* Manual Scan Disk Button */}
      <button
        type="button"
        onClick={onManualScan}
        disabled={isScanningDisk}
        className="ml-2 px-3 py-2.5 rounded-xl font-bold text-xs shrink-0 transition-all border border-white/10 bg-surface-light hover:bg-white/10 text-textMain shadow-sm flex items-center gap-1.5 cursor-pointer"
        title={t(
          'scan_folders_tooltip',
          'Scan physical disk for newly added or changed mod folders.'
        )}
      >
        <RefreshCw
          size={14}
          className={isScanningDisk ? 'animate-spin text-primary' : 'text-textMuted'}
        />
        <span>
          {isScanningDisk ? t('scanning', 'Scanning...') : t('scan_folders_btn', 'Scan Disk')}
        </span>
      </button>

      {onOpenFolderManagement && (
        <button
          type="button"
          onClick={onOpenFolderManagement}
          className="ml-2 px-3 py-2.5 rounded-xl font-bold text-xs shrink-0 transition-all border border-white/10 bg-surface-light hover:bg-white/10 text-textMain shadow-sm flex items-center gap-1.5 cursor-pointer"
          title={t('manage_folders', 'Manage Folders')}
        >
          <FolderCog size={14} className="text-primary" />
          <span>{t('manage_folders', 'Manage Folders')}</span>
        </button>
      )}

      {onOpenProfiles && (
        <button
          type="button"
          onClick={onOpenProfiles}
          className={`ml-2 px-3 py-2.5 rounded-xl font-bold text-xs shrink-0 transition-all border flex items-center gap-1.5 cursor-pointer ${
            hasActiveProfile
              ? 'border-primary/40 bg-primary/15 text-primary hover:bg-primary/25 shadow-sm'
              : 'border-white/10 bg-surface-light hover:bg-white/10 text-textMain shadow-sm'
          }`}
          title={
            activeProfileName
              ? `${t('presets_tooltip')}: ${activeProfileName}`
              : t('presets_tooltip')
          }
        >
          <Bookmark
            size={14}
            className={hasActiveProfile ? 'text-primary fill-primary/30' : 'text-primary'}
          />
          <span>{t('presets_btn')}</span>
        </button>
      )}

      <button
        type="button"
        onClick={onRunManualAnalysis}
        disabled={isAnalyzingMods}
        className={`ml-2 px-3.5 py-2.5 rounded-xl font-bold text-xs shrink-0 transition-all border flex items-center gap-1.5 cursor-pointer ${
          isAnalyzingMods
            ? 'bg-primary/30 text-white/70 border-primary/50 cursor-not-allowed'
            : 'bg-surface-light border-white/10 hover:bg-primary/20 hover:border-primary/50 text-textMain shadow-lg shadow-black/5'
        }`}
        title={t(
          'manual_analysis_tooltip',
          'Run deep script integrity, outdated game version, and mesh conflict verification.'
        )}
      >
        <ShieldAlert
          size={14}
          className={isAnalyzingMods ? 'animate-spin text-primary' : 'text-primary'}
        />
        <span>
          {isAnalyzingMods
            ? t('analyzing_mods', 'Analyzing...')
            : t('analyze_mods_btn', 'Analyze Mods')}
        </span>
      </button>

      <button
        data-highlight-id="install_mod_btn"
        onClick={onInstallZip}
        disabled={isInstalling}
        className={`ml-2 px-6 py-3 rounded-xl font-bold shadow-lg transition-all ${
          highlightTargetId === 'install_mod_btn' ? 'highlight-target' : ''
        } ${
          isInstalling
            ? 'bg-primary/50 text-white/50 cursor-not-allowed'
            : !hasSeenInstallTutorial
              ? 'bg-primary/20 border-2 border-primary/60 animate-pulse text-primary shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.4)]'
              : 'bg-primary text-white hover:bg-primary/80 shadow-primary/20'
        }`}
      >
        {isInstalling ? t('installing') : t('install_mod_archive')}
      </button>
    </div>
  );
});
