import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { InstallResult } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  results: InstallResult[];
}

export function InstallSummaryModal({ isOpen, onClose, results }: Props) {
  const { t } = useTranslation();
  const { scanModsFolder, modsPath } = useAppStore();
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [isMoving, setIsMoving] = useState(false);

  // Keyboard: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const toggleSelection = (path: string) => {
    const next = new Set(selectedPaths);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    setSelectedPaths(next);
  };

  const handleMoveToUnassigned = async () => {
    if (selectedPaths.size === 0) return;
    setIsMoving(true);
    try {
      const pathsToMove = Array.from(selectedPaths);
      await invoke('move_to_unassigned', {
        modPaths: pathsToMove,
        rootPath: modsPath,
      });
      alert(t('moved_mods_to_unassigned_success', { count: pathsToMove.length }));
      await scanModsFolder();
      onClose();
    } catch (e) {
      alert(t('failed_to_move_mods', { error: String(e) }));
    } finally {
      setIsMoving(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="glass-panel relative w-full max-w-2xl rounded-3xl border border-textMain/10 shadow-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: '80vh' }}
          >
            <div className="p-6 border-b border-textMain/10">
              <h2 className="text-2xl font-black text-textMain tracking-tight">
                {t('install_complete_title')}
              </h2>
              <p className="text-sm text-textMuted mt-1">{t('install_complete_desc')}</p>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="space-y-3">
                {results.map((res, i) => {
                  const isSelected = selectedPaths.has(res.full_path);

                  // Determine styling based on conflict status and selection
                  let containerStyle = 'bg-surface/50 border-textMain/10 hover:border-primary/50';
                  let textStyle = 'text-textMain';
                  let badgeStyle = 'bg-background/50 text-primary';

                  if (res.is_conflict) {
                    containerStyle = isSelected
                      ? 'bg-yellow-500/20 border-yellow-500 shadow-inner'
                      : 'bg-yellow-500/10 border-yellow-500/50 hover:border-yellow-500';
                    textStyle = 'text-yellow-500';
                    badgeStyle = 'bg-yellow-500/20 text-yellow-500';
                  } else if (isSelected) {
                    containerStyle = 'bg-primary/20 border-primary shadow-inner';
                  }

                  return (
                    <div
                      key={i}
                      onClick={() => toggleSelection(res.full_path)}
                      className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${containerStyle}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-5 h-5 rounded border-textMain/20 text-primary focus:ring-primary bg-background cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-bold truncate ${textStyle}`}>{res.original_zip}</p>
                          {res.is_conflict && (
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-500 text-black">
                              {t('collision_quarantined')}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-sm">
                          <span className="text-textMuted">{t('extracted_to')}</span>
                          <span className={`px-2 py-0.5 rounded font-mono truncate ${badgeStyle}`}>
                            {res.category}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-6 border-t border-textMain/10 bg-surface/50 flex justify-between items-center">
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl font-bold text-textMain hover:bg-background/50 transition-colors"
              >
                {t('close')}
              </button>
              <button
                onClick={handleMoveToUnassigned}
                disabled={selectedPaths.size === 0 || isMoving}
                className={`px-6 py-2.5 rounded-xl font-bold transition-all ${
                  selectedPaths.size > 0 && !isMoving
                    ? 'bg-primary text-white hover:bg-primary/80 shadow-lg shadow-primary/20'
                    : 'bg-background/50 text-textMuted cursor-not-allowed'
                }`}
              >
                {isMoving
                  ? t('moving')
                  : t('move_selected_to_unassigned', { count: selectedPaths.size })}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
