import { useState, useMemo } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { CategoryInfo, EntityDBInfo, getActiveModsPath } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { Modal } from '../ui/Modal';
import { Search, Check, UserMinus } from 'lucide-react';

interface MappingModalProps {
  mappingCategory: CategoryInfo | null;
  entitiesDB: EntityDBInfo[];
  rootPath?: string;
  onClose: () => void;
  onSaved: () => void;
}

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

export function MappingModal({
  mappingCategory,
  entitiesDB,
  rootPath,
  onClose,
  onSaved,
}: MappingModalProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const saveMapping = async (characterId: string, skinId?: string) => {
    if (!mappingCategory || isSaving) return;
    setIsSaving(true);
    try {
      const activeRoot =
        rootPath ||
        getActiveModsPath(useAppStore.getState().modsPath, useAppStore.getState().activeLibraryTab);
      const cleanRoot = activeRoot.replace(/[/\\]+$/, '');
      const catPath = `${cleanRoot}\\${mappingCategory.category_name}`;

      await invoke('set_category_mapping', {
        categoryPath: catPath,
        characterId: characterId,
        skinId: skinId || null,
      });

      if (characterId.trim()) {
        useAppStore.getState().incrementStat('categoryMapped');
      }
      onSaved();
    } catch (e) {
      console.error('Failed to save category mapping:', e);
      alert(t('failed_to_save_mapping', 'Failed to save mapping: {{error}}', { error: String(e) }));
    } finally {
      setIsSaving(false);
    }
  };

  const flattenedItems = useMemo(() => {
    const items: Array<{
      key: string;
      character_id: string;
      skin_id?: string;
      name: string;
      icon_url?: string;
      element: string;
      faction: string;
      aliases: string[];
    }> = [];

    entitiesDB.forEach((char) => {
      if (!char.skins || char.skins.length === 0) {
        items.push({
          key: char.id,
          character_id: char.id,
          name: char.name,
          icon_url: char.icon_url || char.image_url,
          element: char.element || '',
          faction: char.faction || '',
          aliases: char.aliases || [],
        });
      } else {
        char.skins.forEach((skin) => {
          items.push({
            key: `${char.id}-${skin.id}`,
            character_id: char.id,
            skin_id: skin.id,
            name: `${char.name} - ${skin.name}`,
            icon_url: skin.icon_url || char.icon_url || char.image_url,
            element: char.element || '',
            faction: char.faction || '',
            aliases: skin.aliases || [],
          });
        });
      }
    });

    return items;
  }, [entitiesDB]);

  if (!mappingCategory) return null;

  return (
    <Modal
      isOpen={!!mappingCategory}
      onClose={onClose}
      zIndex="z-[150]"
      maxWidth="4xl"
      maxHeight="max-h-[85vh]"
      title={t('map_category_title', 'Map Category: {{category}}', {
        category: mappingCategory.category_name,
      })}
      description={t(
        'map_category_desc',
        'Assign a character or skin entity to this folder to auto-populate metadata and portraits.'
      )}
    >
      <div className="flex flex-col h-full space-y-4">
        {/* Search Bar & Clear Action */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textMuted pointer-events-none"
            />
            <input
              type="text"
              placeholder={t(
                'map_category_search_placeholder',
                'Search playable characters and skins...'
              )}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-textMain placeholder:text-textMuted/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
              autoFocus
            />
          </div>

          {mappingCategory.character_id && (
            <button
              type="button"
              onClick={() => saveMapping('', '')}
              disabled={isSaving}
              className="px-3 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
              title={t(
                'clear_mapping_tooltip',
                'Remove character mapping and restore folder to custom status'
              )}
            >
              <UserMinus size={13} />
              <span>{t('clear_mapping_btn', 'Clear Mapping')}</span>
            </button>
          )}
        </div>

        {/* Characters Grid */}
        <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar max-h-[55vh]">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {flattenedItems
              .filter(
                (item) =>
                  item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  item.element.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  item.faction.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  item.aliases.some((a) => a.toLowerCase().includes(searchQuery.toLowerCase()))
              )
              .map((item) => {
                const isSelected =
                  mappingCategory.character_id === item.character_id &&
                  (mappingCategory.skin_id || null) === (item.skin_id || null);

                return (
                  <div
                    key={item.key}
                    onClick={() => saveMapping(item.character_id, item.skin_id)}
                    className={`relative group rounded-xl overflow-hidden cursor-pointer border-2 transition-all aspect-square bg-surface/60 ${
                      isSelected
                        ? 'border-primary shadow-[0_0_20px_rgba(var(--color-primary),0.3)] ring-2 ring-primary/40'
                        : 'border-white/5 hover:border-primary/50'
                    }`}
                  >
                    <img
                      src={getImageUrl(item.icon_url)}
                      alt={item.name}
                      className="absolute inset-0 w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute bottom-2.5 left-2.5 right-2.5">
                      <h3 className="font-bold text-textMain text-xs truncate drop-shadow-md">
                        {item.name}
                      </h3>
                      {item.element && (
                        <p className="text-[10px] text-textMuted capitalize truncate">
                          {item.element}
                        </p>
                      )}
                    </div>
                    {isSelected && (
                      <div className="absolute top-2 right-2 bg-primary text-background text-[10px] px-2 py-0.5 rounded-md shadow-lg font-bold flex items-center gap-1">
                        <Check size={10} />
                        <span>{t('assigned_badge', 'Assigned')}</span>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
