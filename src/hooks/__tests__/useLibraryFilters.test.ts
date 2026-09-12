import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLibraryFilters } from '../useLibraryFilters';
import type { CategoryInfo } from '../../types/ipc';

describe('useLibraryFilters', () => {
  const mockCategories: CategoryInfo[] = [
    {
      category_name: 'Anby Demara',
      character_id: 'anby',
      mods: [{ name: 'Sword Skin', full_path: 'C:/Anby/Sword', is_enabled: true }],
    },
    {
      category_name: 'Billy Kid',
      character_id: 'billy',
      mods: [{ name: 'Cowboy Hat', full_path: 'C:/Billy/Hat', is_enabled: false }],
    },
    {
      category_name: 'Nicole Demara',
      character_id: 'nicole',
      mods: [],
    },
  ];

  const defaultProps = {
    categories: mockCategories,
    activeLibraryTab: 'playable_characters' as const,
    entitiesDB: {},
    availableUpdates: [],
    selectedCategory: null,
    setSelectedCategory: () => {},
    favoriteCategories: [],
    categoryFilterMode: 'all' as const,
    selectedElement: 'All',
    selectedFaction: 'All',
    selectedGender: 'All',
    selectedHeight: 'All',
    selectedModel: 'All',
    selectedSpecies: 'All',
    selectedRole: 'All',
    showElementFilter: false,
    showFactionFilter: false,
    showGenderFilter: false,
    showHeightFilter: false,
    showModelFilter: false,
    showSpeciesFilter: false,
    showRoleFilter: false,
  };

  it('filters categories by search query', () => {
    const { result } = renderHook(() => useLibraryFilters(defaultProps));

    expect(result.current.filteredCategories.length).toBe(3);

    act(() => {
      result.current.setSearchQuery('Billy');
    });

    expect(result.current.filteredCategories.length).toBe(1);
    expect(result.current.filteredCategories[0].category_name).toBe('Billy Kid');
  });

  it('filters categories by active mods when categoryFilterMode is "actives"', () => {
    const { result } = renderHook(() =>
      useLibraryFilters({
        ...defaultProps,
        categoryFilterMode: 'actives',
      })
    );

    // Only Anby has an enabled mod
    expect(result.current.filteredCategories.length).toBe(1);
    expect(result.current.filteredCategories[0].category_name).toBe('Anby Demara');
  });

  it('filters categories by installed mods when categoryFilterMode is "installed"', () => {
    const { result } = renderHook(() =>
      useLibraryFilters({
        ...defaultProps,
        categoryFilterMode: 'installed',
      })
    );

    // Anby and Billy have mods; Nicole has 0
    expect(result.current.filteredCategories.length).toBe(2);
    const names = result.current.filteredCategories.map((c) => c.category_name);
    expect(names).toContain('Anby Demara');
    expect(names).toContain('Billy Kid');
    expect(names).not.toContain('Nicole Demara');
  });

  it('places favorite categories at the top of the sorted list', () => {
    const { result } = renderHook(() =>
      useLibraryFilters({
        ...defaultProps,
        favoriteCategories: ['Nicole Demara'],
      })
    );

    expect(result.current.filteredCategories[0].category_name).toBe('Nicole Demara');
  });
});
