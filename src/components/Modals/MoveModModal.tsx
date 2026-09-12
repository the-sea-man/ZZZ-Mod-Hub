import { useState } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import { motion } from 'framer-motion';
import { ModInfo, CategoryInfo } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';

export interface MoveModModalProps {
  mod: ModInfo;
  categories: CategoryInfo[];
  rootPath: string;
  onClose: () => void;
  onSaved: () => void;
}

export function MoveModModal({ mod, categories, rootPath, onClose, onSaved }: MoveModModalProps) {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<string>(
    categories[0]?.category_name || 'Unassigned'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await invoke('move_mod_to_category', {
        modPath: mod.full_path,
        targetCategory: selectedCategory,
        rootPath,
      });
      onSaved();
    } catch (e: any) {
      setError(e.toString());
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 app-blur backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="glass-panel w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-textMain/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h2 className="text-2xl font-black text-textMain mb-4">{t('move_to_category')}</h2>
          <p className="text-textMuted text-sm mb-4">{t('select_destination_category')}</p>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full bg-background border border-textMain/10 rounded-xl px-4 py-3 text-textMain focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
          >
            {categories.map((cat) => (
              <option key={cat.category_name} value={cat.category_name} className="bg-background">
                {cat.category_name}
              </option>
            ))}
          </select>
          {error && <p className="text-red-400 mt-2 text-sm">{error}</p>}
        </div>
        <div className="flex bg-surface/50 p-4 gap-3 border-t border-textMain/10">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-bold text-textMain hover:bg-background transition-colors cursor-pointer"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={isSubmitting}
            className="flex-1 py-3 rounded-xl font-bold bg-primary text-white hover:bg-primary/80 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? t('moving', 'Moving...') : t('move', 'Move')}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
