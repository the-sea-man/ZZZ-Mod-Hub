import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Tag, Plus, X, Check, Sparkles } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { ModInfo } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

interface TagEditorModalProps {
  mod: ModInfo | null;
  onClose: () => void;
}

const PRESET_TAGS = [
  'Outfit',
  'Recolor',
  'In-Game Menu',
  'Animation',
  'UI Animation',
  'UI',
  'Weapon',
  'Audio',
  'NSFW',
  'SFW',
  'Hair',
  'Face',
  'Accessory',
];

export function TagEditorModal({ mod, onClose }: TagEditorModalProps) {
  const { t } = useTranslation();
  const categories = useAppStore((state) => state.categories);
  const setModTags = useAppStore((state) => state.setModTags);
  const [tags, setTags] = useState<string[]>(mod?.meta?.tags || []);
  const [newTagInput, setNewTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (mod?.meta?.tags) {
      setTags(mod.meta.tags);
    }
  }, [mod]);

  // Collect all unique tags across the entire library for suggestions
  const allLibraryTags = useMemo(() => {
    const set = new Set<string>(PRESET_TAGS);
    categories.forEach((cat) => {
      cat.mods.forEach((m) => {
        m.meta?.tags?.forEach((tag) => set.add(tag));
      });
    });
    return Array.from(set).sort();
  }, [categories]);

  // Fuzzy filter: tag contains the input substring (case-insensitive), and isn't already added
  const suggestions = useMemo(() => {
    const q = newTagInput.trim().toLowerCase();
    if (!q) return [];
    return allLibraryTags.filter(
      (tag) =>
        tag.toLowerCase().includes(q) &&
        !tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())
    );
  }, [newTagInput, allLibraryTags, tags]);

  if (!mod) return null;

  const handleAddTag = (tagToAdd: string) => {
    const clean = tagToAdd.trim();
    if (!clean) return;
    if (!tags.some((existing) => existing.toLowerCase() === clean.toLowerCase())) {
      setTags([...tags, clean]);
    }
    setNewTagInput('');
    setShowSuggestions(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((existing) => existing !== tagToRemove));
  };

  const handleAutoDetect = async () => {
    setIsAutoDetecting(true);
    try {
      const detected = await invoke<string[]>('auto_tag_mod', { modPath: mod.full_path });
      if (detected && detected.length > 0) {
        setTags(detected);
      }
    } catch (err) {
      console.error('Failed to auto-detect tags:', err);
    } finally {
      setIsAutoDetecting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setModTags(mod.full_path, tags);
      useAppStore.getState().incrementStat('tagsEdited');
      onClose();
    } catch (err) {
      console.error('Failed to save tags:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 app-blur z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-surface border border-textMain/10 rounded-2xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Tag size={20} className="text-primary" />
            <h2 className="text-xl font-bold text-textMain">{t('edit_tags', 'Edit Tags')}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-textMuted hover:text-textMain text-2xl leading-none"
            aria-label={t('common.cancel', 'Cancel')}
          >
            &times;
          </button>
        </div>

        <p className="text-xs text-textMuted font-mono truncate">{mod.name}</p>

        {/* Current Active Tags */}
        <div>
          <label className="text-xs font-bold text-textMuted uppercase tracking-wider block mb-2">
            {t('active_tags', 'Active Tags')}
          </label>
          <div className="flex flex-wrap gap-2 min-h-[40px] p-2 bg-background/50 border border-textMain/5 rounded-xl">
            {tags.length === 0 ? (
              <span className="text-xs text-textMuted/60 italic self-center">
                {t('no_tags_assigned', 'No tags assigned yet')}
              </span>
            ) : (
              tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-primary/20 text-primary border border-primary/30"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-white transition-colors"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Add Custom Tag Input with fuzzy suggestions */}
        <div>
          <label className="text-xs font-bold text-textMuted uppercase tracking-wider block mb-2">
            {t('add_custom_tag', 'Add Custom Tag')}
          </label>
          <div className="relative">
            <div className="flex gap-2">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => {
                  setNewTagInput(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (suggestions.length > 0 && newTagInput.trim()) {
                      const exact = suggestions.find(
                        (s) => s.toLowerCase() === newTagInput.trim().toLowerCase()
                      );
                      handleAddTag(exact ?? newTagInput);
                    } else {
                      handleAddTag(newTagInput);
                    }
                  } else if (e.key === 'Escape') {
                    setShowSuggestions(false);
                  }
                }}
                placeholder={t('tag_placeholder', 'e.g. Outfit, NSFW, Audio...')}
                className="flex-1 px-3 py-2 bg-background border border-textMain/10 rounded-xl text-sm text-textMain outline-none focus:border-primary/50 transition-all"
              />
              <button
                onClick={() => handleAddTag(newTagInput)}
                disabled={!newTagInput.trim()}
                className="px-3 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-xl font-bold text-xs flex items-center gap-1 transition-colors disabled:opacity-40"
              >
                <Plus size={14} /> {t('add', 'Add')}
              </button>
            </div>

            {/* Fuzzy suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-10 mt-1 bg-surface border border-textMain/10 rounded-xl shadow-xl overflow-hidden max-h-40 overflow-y-auto custom-scrollbar">
                <div className="px-3 py-1.5 border-b border-textMain/5">
                  <span className="text-[10px] font-bold text-textMuted uppercase tracking-wider">
                    {t('similar_tags', 'Similar existing tags')}
                  </span>
                </div>
                {suggestions.map((sug) => {
                  const q = newTagInput.trim().toLowerCase();
                  const idx = sug.toLowerCase().indexOf(q);
                  return (
                    <button
                      key={sug}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleAddTag(sug);
                      }}
                      className="w-full text-left px-3 py-2 text-sm font-semibold text-textMain hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-2"
                    >
                      <Tag size={12} className="text-primary/60 shrink-0" />
                      <span>
                        {idx === -1 ? (
                          sug
                        ) : (
                          <>
                            {sug.slice(0, idx)}
                            <mark className="bg-primary/30 text-primary rounded px-0.5 not-italic">
                              {sug.slice(idx, idx + q.length)}
                            </mark>
                            {sug.slice(idx + q.length)}
                          </>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Quick Presets & Auto Detect */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-bold text-textMuted uppercase tracking-wider">
              {t('quick_presets', 'Quick Presets')}
            </label>
            <button
              onClick={handleAutoDetect}
              disabled={isAutoDetecting}
              className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors disabled:opacity-50"
              title={t('auto_detect_tooltip', 'Scan mod files & INIs to auto-assign tags')}
            >
              <Sparkles size={13} className={isAutoDetecting ? 'animate-spin' : ''} />
              {isAutoDetecting
                ? t('detecting', 'Scanning...')
                : t('auto_detect_tags', 'Auto-Detect')}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_TAGS.map((preset) => {
              const isSelected = tags.some(
                (existing) => existing.toLowerCase() === preset.toLowerCase()
              );
              return (
                <button
                  key={preset}
                  onClick={() => (isSelected ? handleRemoveTag(preset) : handleAddTag(preset))}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
                    isSelected
                      ? 'bg-primary text-white border-primary shadow-sm'
                      : 'bg-surface hover:bg-background border-textMain/10 text-textMuted hover:text-textMain'
                  }`}
                >
                  {preset}
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-textMain/10">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface hover:bg-background border border-textMain/10 rounded-xl text-sm font-bold text-textMuted hover:text-textMain transition-all"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 bg-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              t('saving', 'Saving...')
            ) : (
              <>
                <Check size={16} /> {t('save_changes', 'Save Changes')}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
