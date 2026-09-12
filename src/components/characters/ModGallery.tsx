import { useMemo } from 'react';
import { Tag, FolderOpen, Compass } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { ModCard } from '../modCard';
import { CategoryInfo, ModInfo, EntityDBInfo, CharacterSkin, getCleanModName } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';

const getImageUrl = (url?: string) => {
  if (!url) return undefined;
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('data:') ||
    url.startsWith('asset://')
  )
    return url;
  if (!url.includes(':') && !url.startsWith('/') && !url.startsWith('\\')) {
    return undefined;
  }
  return convertFileSrc(url);
};

interface ModGalleryProps {
  activeCategory?: CategoryInfo;
  globalMods?: { mod: ModInfo; category: CategoryInfo }[];
  entitiesDB: EntityDBInfo[];
  cardSize: number;
  favoriteMods: string[];
  ignoredMods: string[];
  isBatchMode?: boolean;
  filterOnlyUpdates?: boolean;
  selectedModPaths?: string[];
  onToggleSelectMod?: (modPath: string, index: number, isShift: boolean) => void;
  toggleIgnoreMod: (modName: string) => void;
  toggleFavoriteMod: (modName: string) => void;
  toggleMod: (modPath: string, currentlyEnabled: boolean) => Promise<void>;
  deleteMod: (modPath: string) => Promise<void>;
  setEditingKeybinds: (mod: ModInfo) => void;
  setRenamingMod: (mod: ModInfo) => void;
  setMovingMod: (mod: ModInfo) => void;
  setResolvingMod: (mod: ModInfo) => void;
  setSplittingMod?: (mod: ModInfo) => void;
  openWarningsModal?: (
    mod: ModInfo,
    warnings: (import('../../types').ModWarning | string)[]
  ) => void;
  openHashConflictsModal?: (mod: ModInfo) => void;
  scanModsFolder: () => Promise<void>;
}

export function ModGallery({
  activeCategory,
  globalMods,
  entitiesDB,
  cardSize,
  favoriteMods,
  ignoredMods,
  isBatchMode,
  filterOnlyUpdates,
  selectedModPaths = [],
  onToggleSelectMod,
  toggleIgnoreMod,
  toggleFavoriteMod,
  toggleMod,
  deleteMod,
  setEditingKeybinds,
  setRenamingMod,
  setMovingMod,
  setResolvingMod,
  setSplittingMod,
  openWarningsModal,
  openHashConflictsModal,
  scanModsFolder,
}: ModGalleryProps) {
  const { t } = useTranslation();
  const {
    modSortMode,
    selectedTags,
    toggleFilterTag,
    setSelectedTags,
    setActiveTab,
    setDefaultDiscoverCharacter,
    availableUpdates,
  } = useAppStore();

  const rawItemList = useMemo(() => {
    let list = globalMods
      ? globalMods
      : activeCategory
        ? activeCategory.mods.map((mod) => ({ mod, category: activeCategory }))
        : [];
    if (filterOnlyUpdates && availableUpdates.length > 0) {
      list = list.filter((item) => {
        const norm = item.mod.full_path.replace(/\\/g, '/');
        return availableUpdates.some(
          (u) => u.mod_path === item.mod.full_path || u.mod_path === norm
        );
      });
    }
    return list;
  }, [globalMods, activeCategory, filterOnlyUpdates, availableUpdates]);

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    rawItemList.forEach((item) => {
      item.mod.meta?.tags?.forEach((t) => set.add(t));
    });
    return Array.from(set).sort();
  }, [rawItemList]);

  const filteredItemList = useMemo(() => {
    if (selectedTags.length === 0) return rawItemList;
    return rawItemList.filter((item) => {
      const modTags = item.mod.meta?.tags || [];
      return selectedTags.every((st) =>
        modTags.some((mt) => mt.toLowerCase() === st.toLowerCase())
      );
    });
  }, [rawItemList, selectedTags]);

  // Build an O(1) lookup map from character id → entity. Rebuilds only when entitiesDB changes,
  // not on every mod card render.
  const entityMap = useMemo(() => {
    const m = new Map<string, EntityDBInfo>();
    if (Array.isArray(entitiesDB)) {
      entitiesDB.forEach((c) => {
        if (c && c.id) m.set(c.id, c);
      });
    }
    return m;
  }, [entitiesDB]);

  // Sorted, enriched mod list — only recomputed when data or sort mode changes.
  const sortedItems = useMemo(() => {
    const favoriteSet = new Set(favoriteMods);
    return [...filteredItemList]
      .sort((itemA, itemB) => {
        const a = itemA.mod;
        const b = itemB.mod;
        const stableNameA = getCleanModName(a.name);
        const stableNameB = getCleanModName(b.name);

        const aFav = favoriteSet.has(a.name) || favoriteSet.has(stableNameA);
        const bFav = favoriteSet.has(b.name) || favoriteSet.has(stableNameB);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;

        if (modSortMode === 'enabled_first') {
          if (a.is_enabled && !b.is_enabled) return -1;
          if (!a.is_enabled && b.is_enabled) return 1;
        } else if (modSortMode === 'disabled_first') {
          if (!a.is_enabled && b.is_enabled) return -1;
          if (a.is_enabled && !b.is_enabled) return 1;
        }

        const lowerA = stableNameA.toLowerCase();
        const lowerB = stableNameB.toLowerCase();

        if (modSortMode === 'alpha_desc') {
          return lowerB.localeCompare(lowerA);
        }
        return lowerA.localeCompare(lowerB);
      })
      .map((item) => {
        const { mod, category } = item;
        const character = category.character_id
          ? (entityMap.get(category.character_id) ?? null)
          : null;
        const skin =
          character && category.skin_id
            ? (character.skins?.find((s: CharacterSkin) => s.id === category.skin_id) ?? null)
            : null;
        return { mod, category, character, skin };
      });
  }, [filteredItemList, favoriteMods, modSortMode, entityMap]);

  if (rawItemList.length === 0) {
    const char = activeCategory?.character_id
      ? (entityMap.get(activeCategory.character_id) ?? null)
      : null;
    const skin =
      char && activeCategory?.skin_id
        ? char.skins?.find((s) => s.id === activeCategory.skin_id)
        : null;
    const charName = char
      ? char.real_name
        ? t(`db.${char.id}_full`, char.real_name)
        : t(`db.${char.id}`, char.name)
      : activeCategory?.category_name;
    const avatarUrl = skin?.icon_url || char?.icon_url || char?.image_url;

    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center glass-panel rounded-3xl border border-white/10 relative overflow-hidden shadow-xl max-w-xl mx-auto my-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary/5 rounded-full blur-3xl pointer-events-none" />

        {getImageUrl(avatarUrl) ? (
          <div className="w-24 h-24 rounded-2xl bg-surface/80 border-2 border-primary/40 p-1.5 mb-5 shadow-[0_0_30px_rgba(var(--color-primary-rgb),0.25)] relative overflow-hidden group">
            <img
              src={getImageUrl(avatarUrl)}
              alt={charName || 'Character'}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-contain rounded-xl group-hover:scale-110 transition-transform duration-300"
            />
          </div>
        ) : (
          <div className="w-20 h-20 rounded-2xl bg-surface/80 border border-white/10 flex items-center justify-center mb-5 text-textMuted/40">
            <FolderOpen size={40} className="stroke-1" />
          </div>
        )}

        <h3 className="text-2xl font-black text-textMain tracking-tight mb-2">
          {charName
            ? t('no_mods_for_char', {
                name: charName,
                defaultValue: `No mods installed for ${charName}`,
              })
            : t('no_mods_found', 'No mods found')}
        </h3>

        <p className="text-sm text-textMuted max-w-md mb-8 leading-relaxed">
          {char
            ? t(
                'no_mods_character_desc',
                'No mods installed for this character yet. Discover community mods on GameBanana or install a downloaded archive.'
              )
            : t(
                'no_mods_generic_desc',
                'This folder is currently empty. Download mods from Discover or drag and drop archive files here.'
              )}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {char && (
            <button
              onClick={() => {
                setDefaultDiscoverCharacter(char.name);
                setActiveTab('gamebanana');
              }}
              className="px-5 py-2.5 bg-primary text-white hover:bg-primary/80 rounded-xl text-xs font-bold transition-all shadow-lg shadow-primary/20 flex items-center gap-2 cursor-pointer hover:scale-105"
            >
              <Compass size={16} />
              <span>{t('browse_character_gamebanana', { name: charName })}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-20">
      {availableTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="text-xs font-bold text-textMuted flex items-center gap-1.5 mr-1">
            <Tag size={13} className="text-primary" /> {t('filter_tags', 'Tags:')}
          </span>
          {availableTags.map((tag) => {
            const isSelected = selectedTags.some((st) => st.toLowerCase() === tag.toLowerCase());
            return (
              <button
                key={tag}
                onClick={() => toggleFilterTag(tag)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all border ${
                  isSelected
                    ? 'bg-primary text-white border-primary shadow-[0_0_12px_rgba(var(--color-primary-rgb),0.3)]'
                    : 'bg-surface/80 hover:bg-surface border-textMain/10 text-textMuted hover:text-textMain hover:border-primary/30'
                }`}
              >
                #{tag}
              </button>
            );
          })}
          {selectedTags.length > 0 && (
            <button
              onClick={() => setSelectedTags([])}
              className="text-xs text-textMuted hover:text-red-400 underline ml-2 transition-colors font-semibold"
            >
              {t('clear_filters', 'Clear')}
            </button>
          )}
        </div>
      )}

      {filteredItemList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-textMuted glass-panel rounded-3xl border border-textMain/5">
          <Tag size={40} className="mb-3 opacity-40 text-primary" />
          <p className="text-base font-bold">
            {t('no_mods_match_tags', 'No mods match the selected tags.')}
          </p>
          <button
            onClick={() => setSelectedTags([])}
            className="mt-3 px-4 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary rounded-xl text-xs font-bold transition-colors"
          >
            {t('clear_filters', 'Clear Filters')}
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${cardSize}px, 1fr))`,
            justifyContent: 'center',
            gap: '1.5rem',
          }}
        >
          {sortedItems.map(({ mod, category, character, skin }, index) => {
            const stableName = getCleanModName(mod.name);
            return (
              <div
                key={mod.full_path}
                style={{
                  contentVisibility: 'auto',
                  containIntrinsicSize: `${cardSize * 1.35}px`,
                }}
              >
                <ModCard
                  mod={mod}
                  categoryName={globalMods ? category.category_name : undefined}
                  isBatchMode={isBatchMode}
                  isSelected={selectedModPaths.includes(mod.full_path)}
                  onSelect={(isShift) => onToggleSelectMod?.(mod.full_path, index, isShift)}
                  character={character}
                  skin={skin}
                  isIgnored={ignoredMods.includes(mod.name) || ignoredMods.includes(stableName)}
                  isFavorite={favoriteMods.includes(mod.name) || favoriteMods.includes(stableName)}
                  toggleIgnoreMod={toggleIgnoreMod}
                  toggleFavoriteMod={toggleFavoriteMod}
                  toggleMod={toggleMod}
                  deleteMod={deleteMod}
                  openKeybindEditor={setEditingKeybinds}
                  openRenameModal={setRenamingMod}
                  onRefresh={scanModsFolder}
                  openMoveModal={setMovingMod}
                  openResolveModal={setResolvingMod}
                  openSplitModal={setSplittingMod}
                  openWarningsModal={openWarningsModal}
                  openHashConflictsModal={openHashConflictsModal}
                  isFirstCard={index === 0}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
