import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { motion } from 'framer-motion';
import { CategoryInfo, EntityDBInfo } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

interface MappingModalProps {
  mappingCategory: CategoryInfo | null;
  entitiesDB: EntityDBInfo[];
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

export function MappingModal({ mappingCategory, entitiesDB, onClose, onSaved }: MappingModalProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');

  const saveMapping = async (characterId: string, skinId?: string) => {
    if (!mappingCategory) return;
    try {
      const rootPath = localStorage.getItem('mods_path') || '';
      const catPath = `${rootPath}\\${mappingCategory.category_name}`;
      await invoke('set_category_mapping', {
        categoryPath: catPath,
        characterId: characterId,
        skinId: skinId || null,
      });
      useAppStore.getState().incrementStat('categoryMapped');
      onSaved();
    } catch (e) {
      console.error(e);
      alert(t('failed_to_save_mapping', { error: String(e) }));
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

  // Keyboard: Escape to close
  useEffect(() => {
    if (!mappingCategory) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mappingCategory, onClose]);

  if (!mappingCategory) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 app-blur z-[100] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border border-textMain/10 rounded-2xl p-6 w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-textMain">
            {t('map_category_title', { category: mappingCategory.category_name })}
          </h2>
          <button
            onClick={onClose}
            className="text-textMuted hover:text-textMain text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <input
          type="text"
          placeholder={t('map_category_search_placeholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-background border border-textMain/10 rounded-xl px-4 py-3 text-textMain focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 mb-6 transition-all"
        />

        <div className="overflow-y-auto flex-1 pr-2 custom-scrollbar">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
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
                  mappingCategory.skin_id === item.skin_id;

                return (
                  <div
                    key={item.key}
                    onClick={() => saveMapping(item.character_id, item.skin_id)}
                    className={`relative group rounded-xl overflow-hidden cursor-pointer border-2 transition-all aspect-square ${isSelected ? 'border-primary shadow-[0_0_20px_rgba(var(--color-primary),0.3)]' : 'border-transparent hover:border-primary/50'}`}
                  >
                    <img
                      src={getImageUrl(item.icon_url)}
                      alt={item.name}
                      className="absolute inset-0 w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/30 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <h3 className="font-bold text-textMain text-sm truncate drop-shadow-md">
                        {item.name}
                      </h3>
                    </div>
                    {isSelected && (
                      <div className="absolute top-2 right-2 bg-primary text-white text-xs px-2 py-1 rounded shadow-lg font-bold">
                        {t('assigned_badge')}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
