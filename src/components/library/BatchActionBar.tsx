import { memo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckSquare, CheckCircle2, XCircle, Trash2, X } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { CategoryInfo } from '../../types';

export interface BatchActionBarProps {
  isBatchMode: boolean;
  selectedModPaths: string[];
  allVisibleSelected: boolean;
  isBatchProcessing: boolean;
  currentVisibleLength: number;
  categories: CategoryInfo[];
  onToggleSelectAll: () => void;
  onBatchEnable: () => void;
  onBatchDisable: () => void;
  onBatchMove: (targetCategory: string) => void;
  onBatchDelete: () => void;
  onClose: () => void;
}

export const BatchActionBar = memo(function BatchActionBar({
  isBatchMode,
  selectedModPaths,
  allVisibleSelected,
  isBatchProcessing,
  currentVisibleLength,
  categories,
  onToggleSelectAll,
  onBatchEnable,
  onBatchDisable,
  onBatchMove,
  onBatchDelete,
  onClose,
}: BatchActionBarProps) {
  const { t } = useTranslation();

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isBatchMode && (
        <motion.div
          initial={{ y: 80, scale: 0.95, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 80, scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-surface/90 app-blur border border-primary/40 p-2.5 px-5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] ring-1 ring-white/10 flex items-center gap-3 text-sm font-bold max-w-[95vw] flex-wrap justify-center pointer-events-auto"
        >
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl bg-primary/20 text-primary border border-primary/30 font-black text-xs">
              {selectedModPaths.length}
            </span>
            <span className="text-textMuted text-xs font-semibold">
              {t('items_selected', 'selected')}
            </span>
          </div>

          <div className="h-4 w-px bg-white/10 mx-1" />

          <button
            onClick={onToggleSelectAll}
            disabled={currentVisibleLength === 0 || isBatchProcessing}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-textMain border border-white/10 rounded-xl flex items-center gap-1.5 text-xs transition-all disabled:opacity-40 cursor-pointer"
          >
            <CheckSquare size={13} className="text-primary" />
            <span>
              {allVisibleSelected
                ? t('deselect_all', 'Deselect All')
                : t('select_all', 'Select All')}
            </span>
          </button>

          <button
            onClick={onBatchEnable}
            disabled={selectedModPaths.length === 0 || isBatchProcessing}
            className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-xl flex items-center gap-1.5 text-xs transition-all disabled:opacity-40 cursor-pointer shadow-sm"
          >
            <CheckCircle2 size={14} />
            <span>{t('enable_selected', 'Enable')}</span>
          </button>

          <button
            onClick={onBatchDisable}
            disabled={selectedModPaths.length === 0 || isBatchProcessing}
            className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 rounded-xl flex items-center gap-1.5 text-xs transition-all disabled:opacity-40 cursor-pointer shadow-sm"
          >
            <XCircle size={14} />
            <span>{t('disable_selected', 'Disable')}</span>
          </button>

          <div className="flex items-center gap-2">
            <select
              onChange={(e) => {
                if (e.target.value) {
                  onBatchMove(e.target.value);
                  e.target.value = '';
                }
              }}
              disabled={selectedModPaths.length === 0 || isBatchProcessing}
              className="px-3 py-1.5 bg-background border border-white/10 text-xs rounded-xl outline-none disabled:opacity-40 font-semibold cursor-pointer text-textMain hover:border-primary/40 transition-colors"
            >
              <option value="">{t('move_selected', 'Move to...')}...</option>
              {categories.map((c) => (
                <option key={c.category_name} value={c.category_name}>
                  {c.category_name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={onBatchDelete}
            disabled={selectedModPaths.length === 0 || isBatchProcessing}
            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-xl flex items-center gap-1.5 text-xs transition-all disabled:opacity-40 cursor-pointer shadow-sm"
          >
            <Trash2 size={14} />
            <span>{t('delete_selected', 'Delete')}</span>
          </button>

          <div className="h-4 w-px bg-white/10 mx-1" />

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 text-textMuted hover:text-textMain rounded-xl transition-colors cursor-pointer"
            title={t('close', 'Close')}
          >
            <X size={15} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
});
