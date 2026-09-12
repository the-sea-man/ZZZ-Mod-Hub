import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Wrench,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Shield,
  Search,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  Layers,
  Binary,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import {
  ModFixAnalysis,
  ModFixResult,
  HashFixDetail,
  MultiResFixDetail,
  BufferFixDetail,
} from '../../types/ipc';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { useCancellableTask } from '../../hooks/useCancellableTask';
import { tauriCommands } from '../../services/tauriCommands';

interface BatchFixModalProps {
  onClose: () => void;
  onFixesCompleted?: () => void;
}

export function BatchFixModal({ onClose, onFixesCompleted }: BatchFixModalProps) {
  const { t } = useTranslation();
  const { modsPath } = useAppStore();

  const [fixableMods, setFixableMods] = useState<ModFixAnalysis[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isFixing, setIsFixing] = useState(false);
  const [expandedModPath, setExpandedModPath] = useState<string | null>(null);
  const [batchResults, setBatchResults] = useState<ModFixResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Keyboard: Escape to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    let isMounted = true;
    async function scanLibrary() {
      if (!modsPath) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const results = await invoke<ModFixAnalysis[]>('batch_scan_fixable_mods', {
          modsDir: modsPath,
        });
        if (isMounted) {
          setFixableMods(results);
          // By default, pre-select all outdated mods
          const allPaths = new Set(results.map((m) => m.mod_path));
          setSelectedPaths(allPaths);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(String(err));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    scanLibrary();
    return () => {
      isMounted = false;
    };
  }, [modsPath]);

  const toggleSelectAll = () => {
    if (selectedPaths.size === filteredMods.length) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(filteredMods.map((m) => m.mod_path)));
    }
  };

  const toggleSelectMod = (modPath: string) => {
    const next = new Set(selectedPaths);
    if (next.has(modPath)) {
      next.delete(modPath);
    } else {
      next.add(modPath);
    }
    setSelectedPaths(next);
  };

  const { runTask, cancelCurrentTask } = useCancellableTask('fix');

  const handleApplyBatchFix = async () => {
    if (selectedPaths.size === 0) return;
    setIsFixing(true);
    setError(null);
    try {
      const pathsToFix = Array.from(selectedPaths);
      const results = await runTask(async (taskId) => {
        return tauriCommands.diagnostics.batchFixMods(pathsToFix, taskId);
      });

      if (results) {
        setBatchResults(results);

        const successful = results.filter((r: ModFixResult) => r.success).length;
        useAppStore.getState().incrementStat('warningsFixed', successful);

        // Immediately clear outdated_version warnings and stale hashes for all successfully fixed mods
        for (const r of results) {
          if (r.success) {
            useAppStore.getState().removeModWarning(r.mod_path, 'outdated_version');
          }
        }

        useAppStore.getState().scanModsFolder();

        if (onFixesCompleted) {
          onFixesCompleted();
        }
      }
    } catch (err: unknown) {
      setError(String(err));
    } finally {
      setIsFixing(false);
    }
  };

  const filteredMods = fixableMods.filter((m) => {
    const q = searchQuery.toLowerCase();
    return (
      m.mod_name.toLowerCase().includes(q) ||
      (m.detected_character && m.detected_character.toLowerCase().includes(q))
    );
  });

  const totalHashesToUpgrade = fixableMods.reduce((acc, m) => acc + m.hash_fixes.length, 0);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-3xl bg-zinc-900 border border-zinc-700/60 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800/80 bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-zinc-100">
                  {t('batch_fix_title', 'Upgrade Outdated Mods')}
                </h2>
                {!isLoading && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {fixableMods.length} {t('mods_detected', 'mods')}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {t(
                  'batch_fix_subtitle',
                  'Review and upgrade legacy mod hashes across your entire library with safe backups.'
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-zinc-400">
                {t(
                  'batch_scanning_library',
                  'Scanning all mods in library for historical hashes...'
                )}
              </p>
              <button
                onClick={onClose}
                className="mt-2 px-4 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 text-xs font-semibold text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700 transition-colors"
              >
                {t('cancel', 'Cancel')}
              </button>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="text-sm text-red-300">
                <p className="font-semibold">{t('batch_fix_error', 'Scan or upgrade error')}</p>
                <p className="text-xs opacity-90 mt-1">{error}</p>
              </div>
            </div>
          ) : batchResults ? (
            /* Results View */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-sm text-emerald-300">
                  <p className="font-semibold">
                    {t('batch_upgrade_complete', 'Batch Upgrade Complete!')}
                  </p>
                  <p className="text-xs text-emerald-400/90 mt-1">
                    {t(
                      'batch_upgrade_summary_desc',
                      'Successfully processed {count} mods. Backups were created for all modified files.'
                    ).replace('{count}', String(batchResults.length))}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {batchResults.map((res, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-zinc-800/40 border border-zinc-700/40 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-zinc-200">
                        {res.mod_path.split('/').pop()}
                      </div>
                      <div className="text-zinc-400 text-[11px] mt-0.5">
                        {res.hashes_updated} {t('hashes_updated', 'hashes updated')},{' '}
                        {res.buffers_remapped} {t('buffers_remapped', 'buffers remapped')}
                      </div>
                    </div>
                    {res.success ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-medium">
                        {t('status_upgraded', 'Upgraded')}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30 text-[11px] font-medium">
                        {t('status_failed', 'Failed')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : fixableMods.length === 0 ? (
            /* No Outdated Mods View */
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="p-3 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100">
                  {t('all_mods_up_to_date', 'All Mods Are Up to Date!')}
                </h3>
                <p className="text-xs text-zinc-400 max-w-sm mt-1">
                  {t(
                    'no_legacy_hashes_found',
                    'Zero outdated hashes or legacy vertex formats were detected in your Mods folder.'
                  )}
                </p>
              </div>
            </div>
          ) : (
            /* Mods Checklist View */
            <div className="space-y-4">
              {/* Search & Select Toolbar */}
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('search_outdated_mods', 'Filter outdated mods...')}
                    className="w-full pl-9 pr-3 py-2 bg-zinc-800/60 border border-zinc-700/60 rounded-xl text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/60"
                  />
                </div>

                <button
                  onClick={toggleSelectAll}
                  className="px-3 py-2 rounded-xl bg-zinc-800/60 border border-zinc-700/60 text-xs font-semibold text-zinc-300 hover:text-zinc-100 transition-colors flex items-center gap-1.5 shrink-0"
                >
                  {selectedPaths.size === filteredMods.length && filteredMods.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Square className="w-4 h-4 text-zinc-400" />
                  )}
                  {t('select_all', 'Select All')} ({selectedPaths.size}/{filteredMods.length})
                </button>
              </div>

              {/* Mod Checklist List */}
              <div className="space-y-2 max-h-[42vh] overflow-y-auto pr-1 custom-scrollbar">
                {filteredMods.map((item) => {
                  const isSelected = selectedPaths.has(item.mod_path);
                  const isExpanded = expandedModPath === item.mod_path;

                  return (
                    <div
                      key={item.mod_path}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-zinc-800/70 border-amber-500/40'
                          : 'bg-zinc-800/30 border-zinc-700/40 opacity-75'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div
                          onClick={() => toggleSelectMod(item.mod_path)}
                          className="flex items-center gap-3 flex-1 cursor-pointer select-none"
                        >
                          <div className="text-zinc-400 hover:text-zinc-200 transition-colors">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-amber-400" />
                            ) : (
                              <Square className="w-4 h-4 text-zinc-500" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-zinc-200">
                                {item.mod_name}
                              </span>
                              {item.detected_character && (
                                <span className="px-2 py-0.2 text-[10px] font-medium rounded-full bg-zinc-700/60 text-zinc-300">
                                  {item.detected_character}
                                </span>
                              )}
                              <span className="px-1.5 py-0.2 text-[10px] font-semibold rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                                v{item.detected_version_from || '1.0'} → v
                                {item.detected_version_to || '3.1'}
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-3">
                              <span>
                                {item.hash_fixes.length} {t('hashes', 'hashes')}
                              </span>
                              {item.multi_res_fixes.length > 0 && (
                                <span>
                                  • {item.multi_res_fixes.length} {t('multires', 'multi-res')}
                                </span>
                              )}
                              {item.buffer_fixes.length > 0 && (
                                <span>
                                  • {item.buffer_fixes.length} {t('buffers', 'buffers')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => setExpandedModPath(isExpanded ? null : item.mod_path)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/40 transition-colors"
                          title={t('preview_changes', 'Preview Changes')}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      {/* Expanded Hash Breakdown */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="mt-3 pt-3 border-t border-zinc-700/50 space-y-1.5 text-[11px] overflow-hidden"
                          >
                            {item.hash_fixes.length > 0 && (
                              <div>
                                <div className="text-zinc-400 font-semibold mb-1">
                                  {t('planned_hash_upgrades', 'Planned Hash Upgrades:')}
                                </div>
                                <div className="space-y-1">
                                  {item.hash_fixes.map((h: HashFixDetail, hIdx: number) => (
                                    <div
                                      key={hIdx}
                                      className="flex items-center justify-between text-zinc-300 font-mono"
                                    >
                                      <span className="text-zinc-400 truncate max-w-[200px]">
                                        {h.description || h.character}
                                      </span>
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-red-400">{h.old_hash}</span>
                                        <ArrowRight className="w-3 h-3 text-zinc-500" />
                                        <span className="text-emerald-400">{h.new_hash}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {item.multi_res_fixes.length > 0 && (
                              <div
                                className={
                                  item.hash_fixes.length > 0
                                    ? 'mt-2 pt-2 border-t border-zinc-700/40'
                                    : ''
                                }
                              >
                                <div className="text-cyan-400 font-semibold mb-1 flex items-center gap-1.5">
                                  <Layers className="w-3 h-3" />
                                  {t(
                                    'planned_multires_overrides',
                                    'Multi-Res (1024p/2048p) Duplications:'
                                  )}
                                </div>
                                <div className="space-y-1">
                                  {item.multi_res_fixes.map(
                                    (m: MultiResFixDetail, mIdx: number) => (
                                      <div
                                        key={mIdx}
                                        className="flex items-center justify-between text-zinc-300 font-mono"
                                      >
                                        <span className="text-zinc-400 truncate max-w-[200px]">
                                          {m.section_title ||
                                            t(
                                              'missing_resolution_target',
                                              'Counterpart Resolution'
                                            )}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-zinc-400">{m.source_hash}</span>
                                          <ArrowRight className="w-3 h-3 text-zinc-500" />
                                          <span className="text-cyan-400">+{m.target_hash}</span>
                                        </div>
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            )}

                            {item.buffer_fixes.length > 0 && (
                              <div
                                className={
                                  item.hash_fixes.length > 0 || item.multi_res_fixes.length > 0
                                    ? 'mt-2 pt-2 border-t border-zinc-700/40'
                                    : ''
                                }
                              >
                                <div className="text-purple-400 font-semibold mb-1 flex items-center gap-1.5">
                                  <Binary className="w-3 h-3" />
                                  {t('planned_buffer_remaps', 'Buffer Remappings:')}
                                </div>
                                <div className="space-y-1">
                                  {item.buffer_fixes.map((b: BufferFixDetail, bIdx: number) => (
                                    <div
                                      key={bIdx}
                                      className="flex items-center justify-between text-zinc-300"
                                    >
                                      <span className="text-zinc-400 truncate max-w-[200px]">
                                        {b.buffer_filename}
                                      </span>
                                      <span className="text-purple-400 font-mono text-[10px]">
                                        {b.old_format} → {b.new_format}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>

              {/* Safety notice */}
              <div className="p-3.5 rounded-xl bg-zinc-800/40 border border-zinc-700/30 flex items-start gap-3">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-zinc-300 leading-relaxed">
                  <span className="font-semibold text-zinc-100">
                    {t('safe_backup_title', 'Safe & Non-Destructive:')}{' '}
                  </span>
                  {t(
                    'batch_safe_backup_desc',
                    'Every updated mod will have original files backed up with .disabled.bak. You can individually revert any mod.'
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-zinc-900/90 border-t border-zinc-800 flex items-center justify-between">
          <div className="text-xs text-zinc-400">
            {!batchResults && fixableMods.length > 0 && (
              <span>
                {selectedPaths.size} {t('mods_selected', 'selected')} ({totalHashesToUpgrade}{' '}
                {t('total_hashes', 'hashes')})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                if (isFixing) {
                  cancelCurrentTask();
                } else {
                  onClose();
                }
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              {isFixing
                ? t('cancel', 'Cancel')
                : batchResults
                  ? t('close', 'Done')
                  : t('cancel', 'Cancel')}
            </button>

            {!batchResults && fixableMods.length > 0 && (
              <button
                onClick={handleApplyBatchFix}
                disabled={isFixing || selectedPaths.size === 0}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-zinc-950 shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2"
              >
                {isFixing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                    <span>{t('upgrading_batch', 'Upgrading Selected...')}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {t('upgrade_selected_count', 'Upgrade Selected ({count})').replace(
                        '{count}',
                        String(selectedPaths.size)
                      )}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
