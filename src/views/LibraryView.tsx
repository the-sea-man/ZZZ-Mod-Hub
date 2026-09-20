import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ModInfo,
  InstallResult,
  getActiveModsPath,
  EntityDBInfo,
  CharacterSkin,
  ModWarning,
} from '../types';
import { useAppStore, type AppStore } from '../store/useAppStore';
import { playInstallSuccessSound } from '../utils/audio';
import { CategorySidebar } from '../components/characters/CategorySidebar';
import { ModGallery } from '../components/characters/ModGallery';
import { Sparkles, Gamepad2, X, Filter } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { useLibraryFilters } from '../hooks/useLibraryFilters';
import { useBatchSelection } from '../hooks/useBatchSelection';
import { useLibraryModals } from '../hooks/useLibraryModals';
import { LibraryToolbar } from '../components/library/LibraryToolbar';
import { BatchActionBar } from '../components/library/BatchActionBar';
import { LibraryModalsHost } from '../components/library/LibraryModalsHost';
import { CategoryHeaderBanner } from '../components/library/CategoryHeaderBanner';
import { GlobalSearchHeader } from '../components/library/GlobalSearchHeader';
import { LibraryEmptyState } from '../components/library/LibraryEmptyState';
import { LibraryLoadingState } from '../components/library/LibraryLoadingState';

const ALL_LIBRARY_TABS = [
  { id: 'playable_characters' as const, label: 'Playable Characters', enabled: true },
  { id: 'npcs' as const, label: 'NPCs', enabled: false },
  { id: 'bangboos' as const, label: 'Bangboos', enabled: false },
  { id: 'weapons' as const, label: 'Weapons', enabled: false },
  { id: 'ui' as const, label: 'UI', enabled: false },
  { id: 'enemies' as const, label: 'Enemies', enabled: false },
] as const;

const AVAILABLE_LIBRARY_TABS = ALL_LIBRARY_TABS.filter((tab) => tab.enabled);

// Module-level atomic selectors for LibraryView
const selectCategories = (s: AppStore) => s.categories;
const selectEntitiesDB = (s: AppStore) => s.entitiesDB;
const selectSetActiveTab = (s: AppStore) => s.setActiveTab;
const selectActiveLibraryTab = (s: AppStore) => s.activeLibraryTab;
const selectSetActiveLibraryTab = (s: AppStore) => s.setActiveLibraryTab;
const selectFavoriteCategories = (s: AppStore) => s.favoriteCategories;
const selectFavoriteMods = (s: AppStore) => s.favoriteMods;
const selectIgnoredMods = (s: AppStore) => s.ignoredMods;
const selectCardSize = (s: AppStore) => s.cardSize;
const selectModsPath = (s: AppStore) => s.modsPath;
const selectWinrarPath = (s: AppStore) => s.winrarPath;
const selectToggleFavoriteCategory = (s: AppStore) => s.toggleFavoriteCategory;
const selectToggleFavoriteMod = (s: AppStore) => s.toggleFavoriteMod;
const selectToggleIgnoreMod = (s: AppStore) => s.toggleIgnoreMod;
const selectToggleMod = (s: AppStore) => s.toggleMod;
const selectBulkToggleMods = (s: AppStore) => s.bulkToggleMods;
const selectDeleteMod = (s: AppStore) => s.deleteMod;
const selectScanModsFolder = (s: AppStore) => s.scanModsFolder;
const selectIsAnalyzingMods = (s: AppStore) => s.isAnalyzingMods;
const selectRunManualAnalysis = (s: AppStore) => s.runManualAnalysis;
const selectSelectedElement = (s: AppStore) => s.selectedElement;
const selectSetSelectedElement = (s: AppStore) => s.setSelectedElement;
const selectSelectedFaction = (s: AppStore) => s.selectedFaction;
const selectSetSelectedFaction = (s: AppStore) => s.setSelectedFaction;
const selectSelectedGender = (s: AppStore) => s.selectedGender;
const selectSetSelectedGender = (s: AppStore) => s.setSelectedGender;
const selectSelectedHeight = (s: AppStore) => s.selectedHeight;
const selectSetSelectedHeight = (s: AppStore) => s.setSelectedHeight;
const selectSelectedModel = (s: AppStore) => s.selectedModel;
const selectSetSelectedModel = (s: AppStore) => s.setSelectedModel;
const selectSelectedSpecies = (s: AppStore) => s.selectedSpecies;
const selectSetSelectedSpecies = (s: AppStore) => s.setSelectedSpecies;
const selectSelectedRole = (s: AppStore) => s.selectedRole;
const selectSetSelectedRole = (s: AppStore) => s.setSelectedRole;
const selectShowElementFilter = (s: AppStore) => s.showElementFilter;
const selectShowFactionFilter = (s: AppStore) => s.showFactionFilter;
const selectShowGenderFilter = (s: AppStore) => s.showGenderFilter;
const selectShowHeightFilter = (s: AppStore) => s.showHeightFilter;
const selectShowModelFilter = (s: AppStore) => s.showModelFilter;
const selectShowSpeciesFilter = (s: AppStore) => s.showSpeciesFilter;
const selectShowRoleFilter = (s: AppStore) => s.showRoleFilter;
const selectSelectedCategory = (s: AppStore) => s.selectedCategory;
const selectSetSelectedCategory = (s: AppStore) => s.setSelectedCategory;
const selectCategoryFilterMode = (s: AppStore) => s.categoryFilterMode;
const selectSetCategoryFilterMode = (s: AppStore) => s.setCategoryFilterMode;
const selectModSortMode = (s: AppStore) => s.modSortMode;
const selectSetModSortMode = (s: AppStore) => s.setModSortMode;
const selectIncrementStat = (s: AppStore) => s.incrementStat;
const selectHighlightTargetId = (s: AppStore) => s.highlightTargetId;
const selectCheckOrPromptExperimental = (s: AppStore) => s.checkOrPromptExperimental;
const selectPerformanceProfile = (s: AppStore) => s.performanceProfile;
const selectSetPerformanceProfile = (s: AppStore) => s.setPerformanceProfile;
const selectAvailableUpdates = (s: AppStore) => s.availableUpdates;
const selectIsLoadingLibrary = (s: AppStore) => s.isLoadingLibrary;
const selectProfiles = (s: AppStore) => s.profiles;
const selectActiveProfileId = (s: AppStore) => s.activeProfileId;

export function LibraryView() {
  const { t } = useTranslation();

  // Store bindings
  const categories = useAppStore(selectCategories);
  const isLoadingLibrary = useAppStore(selectIsLoadingLibrary);
  const entitiesDB = useAppStore(selectEntitiesDB);
  const availableUpdates = useAppStore(selectAvailableUpdates);
  const performanceProfile = useAppStore(selectPerformanceProfile);
  const setPerformanceProfile = useAppStore(selectSetPerformanceProfile);
  const setActiveTab = useAppStore(selectSetActiveTab);
  const activeLibraryTab = useAppStore(selectActiveLibraryTab);
  const setActiveLibraryTab = useAppStore(selectSetActiveLibraryTab);
  const favoriteCategories = useAppStore(selectFavoriteCategories);
  const favoriteMods = useAppStore(selectFavoriteMods);
  const ignoredMods = useAppStore(selectIgnoredMods);
  const cardSize = useAppStore(selectCardSize);
  const modsPath = useAppStore(selectModsPath);
  const winrarPath = useAppStore(selectWinrarPath);
  const toggleFavoriteCategory = useAppStore(selectToggleFavoriteCategory);
  const toggleFavoriteMod = useAppStore(selectToggleFavoriteMod);
  const toggleIgnoreMod = useAppStore(selectToggleIgnoreMod);
  const toggleMod = useAppStore(selectToggleMod);
  const bulkToggleMods = useAppStore(selectBulkToggleMods);
  const deleteMod = useAppStore(selectDeleteMod);
  const scanModsFolder = useAppStore(selectScanModsFolder);
  const isAnalyzingMods = useAppStore(selectIsAnalyzingMods);
  const runManualAnalysis = useAppStore(selectRunManualAnalysis);
  const selectedElement = useAppStore(selectSelectedElement);
  const setSelectedElement = useAppStore(selectSetSelectedElement);
  const selectedFaction = useAppStore(selectSelectedFaction);
  const setSelectedFaction = useAppStore(selectSetSelectedFaction);
  const selectedGender = useAppStore(selectSelectedGender);
  const setSelectedGender = useAppStore(selectSetSelectedGender);
  const selectedHeight = useAppStore(selectSelectedHeight);
  const setSelectedHeight = useAppStore(selectSetSelectedHeight);
  const selectedModel = useAppStore(selectSelectedModel);
  const setSelectedModel = useAppStore(selectSetSelectedModel);
  const selectedSpecies = useAppStore(selectSelectedSpecies);
  const setSelectedSpecies = useAppStore(selectSetSelectedSpecies);
  const selectedRole = useAppStore(selectSelectedRole);
  const setSelectedRole = useAppStore(selectSetSelectedRole);
  const showElementFilter = useAppStore(selectShowElementFilter);
  const showFactionFilter = useAppStore(selectShowFactionFilter);
  const showGenderFilter = useAppStore(selectShowGenderFilter);
  const showHeightFilter = useAppStore(selectShowHeightFilter);
  const showModelFilter = useAppStore(selectShowModelFilter);
  const showSpeciesFilter = useAppStore(selectShowSpeciesFilter);
  const showRoleFilter = useAppStore(selectShowRoleFilter);
  const selectedCategory = useAppStore(selectSelectedCategory);
  const setSelectedCategory = useAppStore(selectSetSelectedCategory);
  const categoryFilterMode = useAppStore(selectCategoryFilterMode);
  const setCategoryFilterMode = useAppStore(selectSetCategoryFilterMode);
  const modSortMode = useAppStore(selectModSortMode);
  const setModSortMode = useAppStore(selectSetModSortMode);
  const incrementStat = useAppStore(selectIncrementStat);
  const highlightTargetId = useAppStore(selectHighlightTargetId);
  const checkOrPromptExperimental = useAppStore(selectCheckOrPromptExperimental);
  const profiles = useAppStore(selectProfiles);
  const activeProfileId = useAppStore(selectActiveProfileId);
  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  // Local action state
  const [isScanningDisk, setIsScanningDisk] = useState(false);
  const [isGeneratingFolders, setIsGeneratingFolders] = useState(false);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [hasDismissedUpdatesBanner, setHasDismissedUpdatesBanner] = useState(false);

  // Tab safety check
  useEffect(() => {
    if (!AVAILABLE_LIBRARY_TABS.some((t) => t.id === activeLibraryTab)) {
      setActiveLibraryTab('playable_characters');
    }
  }, [activeLibraryTab, setActiveLibraryTab]);

  // Modals state manager
  const modals = useLibraryModals();

  // Filters and search logic
  const {
    searchQuery,
    setSearchQuery,
    isGlobalSearch,
    toggleGlobalSearch,
    isFilteringUpdates,
    setIsFilteringUpdates,
    currentDB,
    entityMap,
    uniqueFilters,
    categorySummaries,
    activeCategory,
    globalMods,
    filteredCategories,
    currentVisiblePaths,
  } = useLibraryFilters({
    categories,
    activeLibraryTab,
    entitiesDB,
    availableUpdates,
    selectedCategory,
    setSelectedCategory,
    favoriteCategories,
    categoryFilterMode,
    highlightTargetId,
    selectedElement,
    selectedFaction,
    selectedGender,
    selectedHeight,
    selectedModel,
    selectedSpecies,
    selectedRole,
    showElementFilter,
    showFactionFilter,
    showGenderFilter,
    showHeightFilter,
    showModelFilter,
    showSpeciesFilter,
    showRoleFilter,
    onIncrementStat: incrementStat,
  });

  // Batch selection and batch operations
  const {
    isBatchMode,
    toggleBatchMode,
    selectedModPaths,
    isBatchProcessing,
    allVisibleSelected,
    handleToggleSelectMod,
    handleToggleSelectAll,
    handleBatchEnable,
    handleBatchDisable,
    handleBatchMove,
    handleBatchDelete,
    clearSelection,
  } = useBatchSelection({
    modsPath,
    activeLibraryTab,
    bulkToggleMods,
    scanModsFolder,
    incrementStat,
    currentVisiblePaths,
  });

  // Action handlers
  const handleManualScan = async () => {
    setIsScanningDisk(true);
    try {
      await scanModsFolder();
    } catch (err) {
      console.error('Manual disk scan failed:', err);
    } finally {
      setIsScanningDisk(false);
    }
  };

  const handleCheckUpdates = async () => {
    setIsCheckingUpdates(true);
    try {
      await useAppStore.getState().checkForUpdates();
      const updates = useAppStore.getState().availableUpdates;
      const count = updates.length;
      if (count > 0) {
        alert(
          t(
            'updates_found_alert',
            `Found ${count} updates! Check your mod cards for the update badge.`
          )
        );
      } else {
        alert(t('no_updates_alert', 'All mods are up to date.'));
      }
    } catch (e) {
      alert(`Failed to check for updates: ${e}`);
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  const handleGenerateMissingFolders = async () => {
    if (!modsPath) {
      alert('Please select your Mods folder in Settings first!');
      return;
    }

    const mappedSet = new Set(
      categories.filter((c) => c.character_id).map((c) => `${c.character_id}:${c.skin_id || ''}`)
    );

    const missingFolders: { folder_name: string; character_id: string; skin_id?: string }[] = [];

    const currentTabEntities = entitiesDB[activeLibraryTab] || [];
    Object.values(currentTabEntities).forEach((char: EntityDBInfo) => {
      if (char.skins && char.skins.length > 0) {
        char.skins.forEach((skin: CharacterSkin) => {
          const folderName = `${char.name} - ${skin.name}`;

          if (!mappedSet.has(`${char.id}:${skin.id}`)) {
            missingFolders.push({
              folder_name: folderName,
              character_id: char.id,
              skin_id: skin.id,
            });
          }
        });
      }
    });

    if (missingFolders.length === 0) {
      alert(
        `All entities in ${activeLibraryTab.replace('_', ' ')} are already mapped or have folders!`
      );
      return;
    }

    setIsGeneratingFolders(true);
    try {
      const created: string[] = await invoke('generate_character_folders', {
        rootPath: getActiveModsPath(modsPath, activeLibraryTab),
        folders: missingFolders,
      });

      alert(`Successfully created and automatically mapped ${created.length} new folders!`);
      scanModsFolder();
    } catch (e) {
      alert(`Failed to create folders: ${e}`);
    } finally {
      setIsGeneratingFolders(false);
    }
  };

  const handleInstallZip = async () => {
    if (!useAppStore.getState().tutorialsSeen.install_mod) {
      useAppStore.getState().setActiveTutorial('install_mod');
      return;
    }

    if (!modsPath) {
      alert('Please select a Mods folder in Settings first!');
      return;
    }

    try {
      const selected = await open({
        multiple: true,
        filters: [{ name: 'Archives', extensions: ['zip', 'rar', '7z'] }],
      });

      if (!selected || selected.length === 0) return;

      const archivePaths = Array.isArray(selected) ? selected : [selected];
      setIsInstalling(true);

      const results: InstallResult[] = await invoke('install_mods', {
        archivePaths,
        rootPath: getActiveModsPath(modsPath, activeLibraryTab),
        winrarPath,
        gbModId: null,
      });

      modals.setInstallResults(results);
      if (results.length > 0) {
        incrementStat('modsInstalledLocal', results.length);
        playInstallSuccessSound();
      }
      await scanModsFolder();
    } catch (e) {
      alert(`Installation failed: ${e}`);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleAutoAssign = async () => {
    if (!modsPath) return;
    setIsInstalling(true);
    try {
      const results: string[] = await invoke('auto_assign_mods', {
        rootPath: getActiveModsPath(modsPath, activeLibraryTab),
      });
      if (results.length > 0) {
        incrementStat('autoSortsUsed');
        alert(`Auto-Sort Results:\n${results.join('\n')}`);
      } else {
        alert('No mods were moved.');
      }
      await scanModsFolder();
    } catch (e) {
      alert(`Auto-Sort failed: ${e}`);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleClearFilters = () => {
    setSelectedElement('All');
    setSelectedFaction('All');
    setSelectedRole('All');
    setSelectedSpecies('All');
    setSelectedGender('All');
    setSelectedHeight('All');
    setSelectedModel('All');
    setCategoryFilterMode('all');
    setIsFilteringUpdates(false);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 glass-panel-bg h-full rounded-2xl border border-white/5 shadow-2xl overflow-hidden relative">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[80px] pointer-events-none" />

      {/* Library Category Tabs */}
      {AVAILABLE_LIBRARY_TABS.length > 1 && (
        <div className="flex glass-panel rounded-none border-b border-textMain/10 px-6 pt-4 gap-2 overflow-x-auto custom-scrollbar shrink-0">
          {AVAILABLE_LIBRARY_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveLibraryTab(tab.id)}
              className={`px-4 py-2 font-bold transition-all border-b-2 whitespace-nowrap ${
                activeLibraryTab === tab.id
                  ? 'text-primary border-primary'
                  : 'text-textMuted border-transparent hover:text-textMain hover:border-textMain/30'
              }`}
            >
              {t(tab.id, tab.label)}
            </button>
          ))}
        </div>
      )}

      {/* Main Library Toolbar */}
      <LibraryToolbar
        activeLibraryTab={activeLibraryTab}
        modsPath={modsPath}
        highlightTargetId={highlightTargetId}
        isGeneratingFolders={isGeneratingFolders}
        onGenerateMissingFolders={handleGenerateMissingFolders}
        onOpenFolderManagement={() => modals.setShowFolderManagement(true)}
        onOpenImportMods={() => modals.setShowImportModsModal(true)}
        onOpenProfiles={() => modals.setShowProfilesModal(true)}
        hasActiveProfile={!!activeProfile}
        activeProfileName={activeProfile?.name ?? null}
        isCheckingUpdates={isCheckingUpdates}
        availableUpdatesCount={availableUpdates.length}
        onCheckUpdates={handleCheckUpdates}
        onOpenBatchFix={() => {
          if (!checkOrPromptExperimental(t('experimental_feat_fixer', 'Mod Fixer'))) return;
          modals.setShowBatchFixModal(true);
        }}
        uniqueFilters={uniqueFilters}
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
        onClearFilters={handleClearFilters}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isGlobalSearch={isGlobalSearch}
        onToggleGlobalSearch={toggleGlobalSearch}
        performanceProfile={performanceProfile}
        onCyclePerformanceProfile={() => {
          const next =
            performanceProfile === 'low'
              ? 'balanced'
              : performanceProfile === 'balanced'
                ? 'high'
                : 'low';
          setPerformanceProfile(next);
        }}
        isScanningDisk={isScanningDisk || isLoadingLibrary}
        onManualScan={handleManualScan}
        isAnalyzingMods={isAnalyzingMods}
        onRunManualAnalysis={runManualAnalysis}
        isInstalling={isInstalling}
        onInstallZip={handleInstallZip}
        hasSeenInstallTutorial={!!useAppStore.getState().tutorialsSeen.install_mod}
      />

      {/* Content Layout: Sidebar + Main Mod Grid */}
      <div className="flex flex-1 min-h-0 relative">
        <CategorySidebar
          filteredCategories={filteredCategories}
          entitiesDB={currentDB}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          favoriteCategories={favoriteCategories}
          toggleFavoriteCategory={toggleFavoriteCategory}
          categorySummaries={categorySummaries}
        />

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 relative z-0">
          <AnimatePresence>
            {availableUpdates.length > 0 && !hasDismissedUpdatesBanner && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 20 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-surface/80 border border-amber-500/40 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl backdrop-blur-md relative overflow-hidden"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-sm shrink-0 animate-pulse mt-0.5">
                    <Sparkles size={20} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-amber-300 flex items-center gap-2">
                      {t('library_updates_banner_title', '{{count}} Mod Updates Available', {
                        count: availableUpdates.length,
                      })}
                    </h4>
                    <p className="text-xs text-textMuted mt-0.5">
                      {t(
                        'library_updates_banner_desc',
                        'GameBanana has newer files or revisions for some of your installed mods.'
                      )}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <button
                        onClick={() => setIsFilteringUpdates((prev) => !prev)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-bold border transition-colors flex items-center gap-1.5 ${
                          isFilteringUpdates
                            ? 'bg-amber-500 text-black border-amber-400'
                            : 'bg-white/10 text-amber-200 border-white/10 hover:bg-white/20'
                        }`}
                      >
                        <Filter size={12} />
                        {isFilteringUpdates
                          ? t('show_all_mods', 'Show All Mods')
                          : t('filter_updated_mods', 'Filter Updated Mods Only')}
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setHasDismissedUpdatesBanner(true)}
                  className="p-1.5 text-textMuted hover:text-textMain hover:bg-white/10 rounded-lg transition-colors shrink-0 self-end md:self-center"
                  title={t('dismiss_banner', 'Dismiss Banner')}
                >
                  <X size={16} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div
              key={isGlobalSearch ? 'global-search' : selectedCategory || 'empty'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full flex flex-col"
            >
              {isGlobalSearch ? (
                <>
                  <GlobalSearchHeader
                    searchQuery={searchQuery}
                    foundCount={globalMods.length}
                    isBatchMode={isBatchMode}
                    onToggleBatchMode={toggleBatchMode}
                    modSortMode={modSortMode}
                    onSetModSortMode={setModSortMode}
                    selectedElement={selectedElement}
                    selectedFaction={selectedFaction}
                    selectedRole={selectedRole}
                    selectedSpecies={selectedSpecies}
                    selectedGender={selectedGender}
                    selectedHeight={selectedHeight}
                    selectedModel={selectedModel}
                    categoryFilterMode={categoryFilterMode}
                    isFilteringUpdates={isFilteringUpdates}
                    onClearFilters={handleClearFilters}
                  />
                  <ModGallery
                    globalMods={globalMods}
                    entitiesDB={currentDB}
                    cardSize={cardSize}
                    favoriteMods={favoriteMods}
                    ignoredMods={ignoredMods}
                    isBatchMode={isBatchMode}
                    filterOnlyUpdates={isFilteringUpdates}
                    selectedModPaths={selectedModPaths}
                    onToggleSelectMod={handleToggleSelectMod}
                    toggleIgnoreMod={toggleIgnoreMod}
                    toggleFavoriteMod={toggleFavoriteMod}
                    toggleMod={toggleMod}
                    deleteMod={deleteMod}
                    setEditingKeybinds={(mod: ModInfo) => modals.setEditingKeybinds(mod)}
                    setRenamingMod={(mod: ModInfo) => modals.setRenamingMod(mod)}
                    setMovingMod={(mod: ModInfo) => modals.setMovingMod(mod)}
                    setResolvingMod={(mod: ModInfo) => modals.setResolvingMod(mod)}
                    setSplittingMod={(mod: ModInfo) => modals.setSplittingMod(mod)}
                    openWarningsModal={(mod: ModInfo, warnings: (ModWarning | string)[]) =>
                      modals.setWarningsModalData({ mod, warnings })
                    }
                    openHashConflictsModal={(mod: ModInfo) => {
                      modals.setHashConflictsModalMod(mod);
                      incrementStat('conflictsViewed');
                    }}
                    scanModsFolder={scanModsFolder}
                  />
                </>
              ) : activeCategory ? (
                <>
                  <CategoryHeaderBanner
                    category={activeCategory}
                    entityMap={entityMap}
                    isInstalling={isInstalling}
                    onAutoAssign={handleAutoAssign}
                    isBatchMode={isBatchMode}
                    onToggleBatchMode={toggleBatchMode}
                    onOpenMappingModal={() => modals.setMappingCategory(activeCategory)}
                    modSortMode={modSortMode}
                    onSetModSortMode={setModSortMode}
                    highlightTargetId={highlightTargetId}
                  />
                  <ModGallery
                    activeCategory={activeCategory}
                    entitiesDB={currentDB}
                    cardSize={cardSize}
                    favoriteMods={favoriteMods}
                    ignoredMods={ignoredMods}
                    isBatchMode={isBatchMode}
                    filterOnlyUpdates={isFilteringUpdates}
                    selectedModPaths={selectedModPaths}
                    onToggleSelectMod={handleToggleSelectMod}
                    toggleIgnoreMod={toggleIgnoreMod}
                    toggleFavoriteMod={toggleFavoriteMod}
                    toggleMod={toggleMod}
                    deleteMod={deleteMod}
                    setEditingKeybinds={(mod: ModInfo) => modals.setEditingKeybinds(mod)}
                    setRenamingMod={(mod: ModInfo) => modals.setRenamingMod(mod)}
                    setMovingMod={(mod: ModInfo) => modals.setMovingMod(mod)}
                    setResolvingMod={(mod: ModInfo) => modals.setResolvingMod(mod)}
                    setSplittingMod={(mod: ModInfo) => modals.setSplittingMod(mod)}
                    openWarningsModal={(mod: ModInfo, warnings: (ModWarning | string)[]) =>
                      modals.setWarningsModalData({ mod, warnings })
                    }
                    openHashConflictsModal={(mod: ModInfo) => {
                      modals.setHashConflictsModalMod(mod);
                      incrementStat('conflictsViewed');
                    }}
                    scanModsFolder={scanModsFolder}
                  />
                </>
              ) : categories.length === 0 ? (
                isLoadingLibrary ? (
                  <LibraryLoadingState />
                ) : (
                  <LibraryEmptyState
                    onGenerateFolders={handleGenerateMissingFolders}
                    onOpenModsFolder={() => {
                      if (modsPath) {
                        invoke('open_folder', { path: modsPath }).catch(console.error);
                      }
                    }}
                    onNavigateToDiscover={() => setActiveTab('gamebanana')}
                    isGeneratingFolders={isGeneratingFolders}
                  />
                )
              ) : (
                <div className="flex flex-col items-center justify-center py-32 text-textMuted">
                  <Gamepad2 size={64} className="mb-4 opacity-50" />
                  <p className="text-lg font-bold">
                    {t('library_select_category', 'Select a character category from the sidebar')}
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Floating Batch Operations Bar */}
      <BatchActionBar
        isBatchMode={isBatchMode}
        selectedModPaths={selectedModPaths}
        allVisibleSelected={allVisibleSelected}
        isBatchProcessing={isBatchProcessing}
        currentVisibleLength={currentVisiblePaths.length}
        categories={categories}
        onToggleSelectAll={handleToggleSelectAll}
        onBatchEnable={handleBatchEnable}
        onBatchDisable={handleBatchDisable}
        onBatchMove={handleBatchMove}
        onBatchDelete={handleBatchDelete}
        onClose={clearSelection}
      />

      {/* Portaled Modal Dialogs Host */}
      <LibraryModalsHost
        modals={modals}
        categories={categories}
        currentDB={currentDB}
        rootPath={getActiveModsPath(modsPath, activeLibraryTab)}
        onScanModsFolder={scanModsFolder}
      />
    </div>
  );
}
