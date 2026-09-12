import { useState, useMemo, useEffect } from 'react';
import {
  CategoryInfo,
  ModInfo,
  EntityDBInfo,
  CategorySummary,
  EntityCategory,
  UpdateAvailable,
  resolveCategoryEntity,
} from '../types';

export interface UseLibraryFiltersProps {
  categories: CategoryInfo[];
  activeLibraryTab: EntityCategory;
  entitiesDB: Record<string, EntityDBInfo[]>;
  availableUpdates: UpdateAvailable[];
  selectedCategory: string | null;
  setSelectedCategory: (cat: string | null) => void;
  favoriteCategories: string[];
  categoryFilterMode: 'all' | 'installed' | 'actives';
  highlightTargetId?: string | null;
  // Store filter states & visibility toggles
  selectedElement: string;
  selectedFaction: string;
  selectedGender: string;
  selectedHeight: string;
  selectedModel: string;
  selectedSpecies: string;
  selectedRole: string;
  showElementFilter: boolean;
  showFactionFilter: boolean;
  showGenderFilter: boolean;
  showHeightFilter: boolean;
  showModelFilter: boolean;
  showSpeciesFilter: boolean;
  showRoleFilter: boolean;
  onIncrementStat?: (stat: any) => void;
}

export function useLibraryFilters({
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
  onIncrementStat,
}: UseLibraryFiltersProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isGlobalSearch, setIsGlobalSearch] = useState(false);
  const [isFilteringUpdates, setIsFilteringUpdates] = useState(false);

  // Reset global search whenever user picks a specific category
  useEffect(() => {
    setIsGlobalSearch(false);
  }, [selectedCategory]);

  const currentDB = entitiesDB[activeLibraryTab] || [];

  const entityMap = useMemo(() => {
    const map = new Map<string, EntityDBInfo>();
    for (const c of currentDB) {
      if (c && c.id) {
        map.set(c.id, c);
      }
    }
    return map;
  }, [currentDB]);

  const updatedModPathsSet = useMemo(() => {
    const set = new Set<string>();
    availableUpdates.forEach((u) => {
      set.add(u.mod_path);
      set.add(u.mod_path.replace(/\\/g, '/'));
    });
    return set;
  }, [availableUpdates]);

  // Pre-Aggregated Category Index: Computed ONCE when categories, entityMap, or updates change.
  // Replaces O(N*M) scanning, nested filters, and string allocations on every search keystroke.
  const categorySummaries = useMemo(() => {
    const map = new Map<string, CategorySummary>();

    for (const cat of categories) {
      const charInfo = resolveCategoryEntity(cat.category_name, cat.character_id, currentDB);
      let activeCount = 0;
      let updateCount = 0;
      const haystackParts: string[] = [cat.category_name.toLowerCase()];

      if (charInfo) {
        haystackParts.push(charInfo.name.toLowerCase());
        if (charInfo.real_name) haystackParts.push(charInfo.real_name.toLowerCase());
        if (charInfo.aliases) {
          for (const a of charInfo.aliases) {
            haystackParts.push(a.toLowerCase());
          }
        }
      }

      const mods = cat.mods || [];
      for (const mod of mods) {
        if (mod.is_enabled) activeCount++;
        const norm = mod.full_path.replace(/\\/g, '/');
        if (updatedModPathsSet.has(mod.full_path) || updatedModPathsSet.has(norm)) {
          updateCount++;
        }
        haystackParts.push(mod.name.toLowerCase());
        if (mod.meta?.author) haystackParts.push(mod.meta.author.toLowerCase());
        if (mod.meta?.tags) {
          for (const t of mod.meta.tags) {
            haystackParts.push(t.toLowerCase());
          }
        }
      }

      map.set(cat.category_name, {
        categoryName: cat.category_name,
        category: cat,
        charInfo: charInfo ?? null,
        totalMods: mods.length,
        activeModsCount: activeCount,
        updateModsCount: updateCount,
        hasActiveMods: activeCount > 0,
        hasInstalledMods: mods.length > 0,
        hasUpdates: updateCount > 0,
        searchHaystack: haystackParts.join(' '),
      });
    }

    return map;
  }, [categories, entityMap, currentDB, updatedModPathsSet]);

  const activeCategory = categories.find((c) => c.category_name === selectedCategory);

  // Single-pass unique filter dimension extraction
  const uniqueFilters = useMemo(() => {
    const elements = new Set<string>();
    const factions = new Set<string>();
    const genders = new Set<string>();
    const heights = new Set<string>();
    const models = new Set<string>();
    const roles = new Set<string>();
    const species = new Set<string>();

    for (const c of currentDB) {
      if (c.element) elements.add(c.element);
      if (c.faction) factions.add(c.faction);
      if (c.gender) genders.add(c.gender);
      if (c.height) heights.add(c.height);
      if (c.model_type) models.add(c.model_type);
      if (c.role) roles.add(c.role);
      if (c.species) species.add(c.species);
    }

    return {
      elements: ['All', ...Array.from(elements).sort()],
      factions: ['All', ...Array.from(factions).sort()],
      genders: ['All', ...Array.from(genders).sort()],
      heights: ['All', ...Array.from(heights).sort()],
      models: ['All', ...Array.from(models).sort()],
      roles: ['All', ...Array.from(roles).sort()],
      species: ['All', ...Array.from(species).sort()],
    };
  }, [currentDB]);

  const globalMods = useMemo(() => {
    if (!isGlobalSearch) return [];
    const query = searchQuery.toLowerCase().trim();

    const matched: { mod: ModInfo; category: CategoryInfo }[] = [];
    for (const cat of categories) {
      const summary = categorySummaries.get(cat.category_name);
      if (!summary) continue;

      // Fast category skip: if category doesn't contain query, skip all its mods immediately!
      if (query && !summary.searchHaystack.includes(query)) continue;
      if (categoryFilterMode === 'actives' && !summary.hasActiveMods) continue;
      if (categoryFilterMode === 'installed' && !summary.hasInstalledMods) continue;
      if (isFilteringUpdates && !summary.hasUpdates) continue;

      const charInfo = summary.charInfo;
      if (showElementFilter && selectedElement !== 'All' && charInfo?.element !== selectedElement)
        continue;
      if (showFactionFilter && selectedFaction !== 'All' && charInfo?.faction !== selectedFaction)
        continue;
      if (showRoleFilter && selectedRole !== 'All' && charInfo?.role !== selectedRole) continue;
      if (showSpeciesFilter && selectedSpecies !== 'All' && charInfo?.species !== selectedSpecies)
        continue;
      if (showGenderFilter && selectedGender !== 'All' && charInfo?.gender !== selectedGender)
        continue;
      if (showHeightFilter && selectedHeight !== 'All' && charInfo?.height !== selectedHeight)
        continue;
      if (showModelFilter && selectedModel !== 'All' && charInfo?.model_type !== selectedModel)
        continue;

      for (const mod of cat.mods || []) {
        if (categoryFilterMode === 'actives' && !mod.is_enabled) continue;
        if (isFilteringUpdates) {
          const norm = mod.full_path.replace(/\\/g, '/');
          if (!updatedModPathsSet.has(mod.full_path) && !updatedModPathsSet.has(norm)) continue;
        }

        if (query) {
          const modMatches =
            mod.name.toLowerCase().includes(query) ||
            summary.categoryName.toLowerCase().includes(query) ||
            (charInfo &&
              (charInfo.name.toLowerCase().includes(query) ||
                charInfo.aliases?.some((a) => a.toLowerCase().includes(query)))) ||
            (mod.meta?.author && mod.meta.author.toLowerCase().includes(query)) ||
            (mod.meta?.tags && mod.meta.tags.some((t) => t.toLowerCase().includes(query)));
          if (!modMatches) continue;
        }

        matched.push({ mod, category: cat });
      }
    }
    return matched;
  }, [
    categories,
    categorySummaries,
    isGlobalSearch,
    searchQuery,
    showElementFilter,
    selectedElement,
    showFactionFilter,
    selectedFaction,
    showRoleFilter,
    selectedRole,
    showSpeciesFilter,
    selectedSpecies,
    showGenderFilter,
    selectedGender,
    showHeightFilter,
    selectedHeight,
    showModelFilter,
    selectedModel,
    categoryFilterMode,
    isFilteringUpdates,
    updatedModPathsSet,
  ]);

  // Apply search filtering leveraging pre-aggregated category index
  const filteredCategories = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    const result: CategoryInfo[] = [];

    for (const cat of categories) {
      const summary = categorySummaries.get(cat.category_name);
      if (!summary) continue;

      const charInfo = summary.charInfo;

      if (showElementFilter && selectedElement !== 'All' && charInfo?.element !== selectedElement)
        continue;
      if (showFactionFilter && selectedFaction !== 'All' && charInfo?.faction !== selectedFaction)
        continue;
      if (showRoleFilter && selectedRole !== 'All' && charInfo?.role !== selectedRole) continue;
      if (showSpeciesFilter && selectedSpecies !== 'All' && charInfo?.species !== selectedSpecies)
        continue;
      if (showGenderFilter && selectedGender !== 'All' && charInfo?.gender !== selectedGender)
        continue;
      if (showHeightFilter && selectedHeight !== 'All' && charInfo?.height !== selectedHeight)
        continue;
      if (showModelFilter && selectedModel !== 'All' && charInfo?.model_type !== selectedModel)
        continue;

      // O(1) Pre-Aggregated status filter checks
      if (categoryFilterMode === 'installed' && !summary.hasInstalledMods) continue;
      if (categoryFilterMode === 'actives' && !summary.hasActiveMods) continue;
      if (isFilteringUpdates && !summary.hasUpdates) continue;

      // O(1) Pre-Aggregated Haystack Search
      if (query && !summary.searchHaystack.includes(query)) continue;

      result.push(cat);
    }

    return result.sort((a: CategoryInfo, b: CategoryInfo) => {
      const aFav = favoriteCategories.includes(a.category_name);
      const bFav = favoriteCategories.includes(b.category_name);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;

      const sumA = categorySummaries.get(a.category_name);
      const sumB = categorySummaries.get(b.category_name);

      if (categoryFilterMode === 'installed') {
        return (sumB?.totalMods ?? 0) - (sumA?.totalMods ?? 0);
      } else if (categoryFilterMode === 'actives') {
        return (sumB?.activeModsCount ?? 0) - (sumA?.activeModsCount ?? 0);
      }

      return a.category_name.localeCompare(b.category_name);
    });
  }, [
    categories,
    categorySummaries,
    searchQuery,
    selectedElement,
    selectedFaction,
    selectedRole,
    selectedSpecies,
    selectedGender,
    selectedHeight,
    selectedModel,
    showElementFilter,
    showFactionFilter,
    showRoleFilter,
    showSpeciesFilter,
    showGenderFilter,
    showHeightFilter,
    showModelFilter,
    favoriteCategories,
    categoryFilterMode,
    isFilteringUpdates,
  ]);

  // Keep selected category valid
  useEffect(() => {
    if (highlightTargetId && highlightTargetId.startsWith('first_mod_')) {
      const currentCat = categories.find((c) => c.category_name === selectedCategory);
      if (!currentCat || (currentCat.mods || []).length === 0) {
        const catWithMods = categories.find((c) => (c.mods || []).length > 0);
        if (catWithMods) {
          setSelectedCategory(catWithMods.category_name);
          return;
        }
      }
    }

    if (
      categories.length > 0 &&
      (!selectedCategory || !categories.some((c) => c.category_name === selectedCategory))
    ) {
      setSelectedCategory(categories[0].category_name);
    } else if (categories.length === 0) {
      setSelectedCategory(null);
    }
  }, [categories, selectedCategory, setSelectedCategory, highlightTargetId]);

  const currentVisiblePaths = useMemo(() => {
    if (isGlobalSearch) {
      return globalMods.map((g) => g.mod.full_path);
    }
    if (activeCategory) {
      return (activeCategory.mods || []).map((m) => m.full_path);
    }
    return [];
  }, [isGlobalSearch, globalMods, activeCategory]);

  const toggleGlobalSearch = () => {
    setIsGlobalSearch((prev) => {
      const next = !prev;
      if (next && onIncrementStat) {
        onIncrementStat('globalSearchesUsed');
      }
      return next;
    });
  };

  return {
    searchQuery,
    setSearchQuery,
    isGlobalSearch,
    setIsGlobalSearch,
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
  };
}
