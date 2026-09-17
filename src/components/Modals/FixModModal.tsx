import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  X,
  Wrench,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Shield,
  Layers,
  FileCode,
  Binary,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { ModFixAnalysis, ModFixResult, HashFixDetail } from '../../types/ipc';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { RestoreBackupModal } from './RestoreBackupModal';

interface FixModModalProps {
  modPath: string;
  modName: string;
  onClose: () => void;
  onFixApplied?: () => void;
}

export function FixModModal({ modPath, modName, onClose, onFixApplied }: FixModModalProps) {
  const { t } = useTranslation();

  const [analysis, setAnalysis] = useState<ModFixAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFixing, setIsFixing] = useState(false);
  const [fixResult, setFixResult] = useState<ModFixResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllHashes, setShowAllHashes] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);

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
    async function loadAnalysis() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await invoke<ModFixAnalysis>('check_mod_fixable', { modPath });
        if (isMounted) {
          setAnalysis(res);
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
    loadAnalysis();
    return () => {
      isMounted = false;
    };
  }, [modPath]);

  const handleApplyFix = async () => {
    setIsFixing(true);
    setError(null);
    try {
      const res = await invoke<ModFixResult>('fix_mod', { modPath });
      setFixResult(res);
      useAppStore.getState().incrementStat('warningsFixed');

      // Immediately clear outdated_version warning and stale hashes so the Upgrade button disappears
      useAppStore.getState().removeModWarning(modPath, 'outdated_version');

      // Refresh mod state and warning badges
      useAppStore.getState().scanModsFolder();

      if (onFixApplied) {
        onFixApplied();
      }
    } catch (err: unknown) {
      setError(String(err));
    } finally {
      setIsFixing(false);
    }
  };

  const versionFrom = analysis?.detected_version_from || '1.0';
  const versionTo = analysis?.detected_version_to || '3.1';
  const character = analysis?.detected_character || t('character_generic', 'Character');

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
        className="w-full max-w-2xl bg-zinc-900 border border-zinc-700/60 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
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
                  {t('mod_fixer_title', 'Mod Version Upgrade & Fixer')}
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  v{versionFrom} → v{versionTo}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-md">
                {modName} {analysis?.detected_character ? `• ${character}` : ''}
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
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-zinc-400">
                {t('mod_fixer_analyzing', 'Scanning mod structure & historical hashes...')}
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
                <p className="font-semibold">
                  {t('mod_fixer_error', 'Failed to inspect or upgrade mod')}
                </p>
                <p className="text-xs opacity-90 mt-1">{error}</p>
              </div>
            </div>
          ) : fixResult ? (
            /* Success Summary View */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-sm text-emerald-300">
                  <p className="font-semibold">
                    {t('mod_fixer_success_title', 'Mod Successfully Upgraded!')}
                  </p>
                  <p className="text-xs text-emerald-400/90 mt-1">
                    {t(
                      'mod_fixer_success_desc',
                      'All outdated hashes have been upgraded to the latest version. Backups were preserved.'
                    )}
                  </p>
                </div>
              </div>

              {/* Actions details */}
              <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 space-y-2">
                <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  {t('mod_fixer_applied_changes', 'Applied Changes')}
                </h4>
                <ul className="space-y-1 text-xs text-zinc-300">
                  {fixResult.actions_summary.map((act: string, idx: number) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {fixResult.backup_created && (
                <p className="text-xs text-zinc-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-zinc-400" />
                  {t('backup_saved_as', 'Backup file:')}{' '}
                  <span className="font-mono text-zinc-300">{fixResult.backup_created}</span>
                </p>
              )}
            </div>
          ) : analysis && analysis.is_fixable ? (
            /* Pre-Fix Analysis & Approval View */
            <div className="space-y-5">
              {/* Target Skin / Outfit Selector */}
              {analysis.available_skins && analysis.available_skins.length > 0 && (
                <div className="p-3.5 rounded-xl bg-zinc-800/80 border border-amber-500/30 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      {t('target_skin_label', 'Target Outfit / Skin:')}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {t(
                        'target_skin_desc',
                        'Select which character outfit this mod is designed to replace.'
                      )}
                    </p>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 font-semibold text-xs text-amber-300">
                    {analysis.detected_skin || analysis.detected_character || character}
                  </div>
                </div>
              )}

              {/* Stat Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-zinc-800/60 border border-zinc-700/50 flex flex-col">
                  <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-amber-400" />
                    {t('hashes_to_update', 'Hash Upgrades')}
                  </span>
                  <span className="text-2xl font-bold text-zinc-100 mt-1">
                    {analysis.hash_fixes.length}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-800/60 border border-zinc-700/50 flex flex-col">
                  <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    {t('multires_overrides', 'Multi-Res (1024/2048)')}
                  </span>
                  <span className="text-2xl font-bold text-zinc-100 mt-1">
                    {analysis.multi_res_fixes.length}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-800/60 border border-zinc-700/50 flex flex-col">
                  <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                    <Binary className="w-3.5 h-3.5 text-purple-400" />
                    {t('buffer_remappings', 'Buffer Remaps')}
                  </span>
                  <span className="text-2xl font-bold text-zinc-100 mt-1">
                    {analysis.buffer_fixes.length}
                  </span>
                </div>
              </div>

              {/* Hash Transformations Table */}
              {analysis.hash_fixes.length > 0 && (
                <div className="bg-zinc-800/40 border border-zinc-700/40 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-zinc-800/60 border-b border-zinc-700/40">
                    <span className="text-xs font-semibold text-zinc-200">
                      {t('hash_transformation_table', 'Hash Transformation Table')} (
                      {analysis.hash_fixes.length})
                    </span>
                    {analysis.hash_fixes.length > 3 && (
                      <button
                        onClick={() => setShowAllHashes(!showAllHashes)}
                        className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                      >
                        {showAllHashes ? t('show_less', 'Show Less') : t('show_all', 'Show All')}
                        {showAllHashes ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>

                  <div className="divide-y divide-zinc-800/60 text-xs">
                    {(showAllHashes ? analysis.hash_fixes : analysis.hash_fixes.slice(0, 3)).map(
                      (item: HashFixDetail, idx: number) => (
                        <div key={idx} className="p-3 flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-zinc-200">
                              {item.description || item.character}
                            </div>
                            <div className="text-[11px] text-zinc-500">
                              v{item.version_from} → v{item.version_to}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 font-mono">
                            <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                              {item.old_hash}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {item.new_hash}
                            </span>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Multi-Res (1024p / 2048p) Duplication Table */}
              {analysis.multi_res_fixes.length > 0 && (
                <div className="bg-zinc-800/40 border border-cyan-500/30 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-cyan-950/20 border-b border-cyan-500/20">
                    <span className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-cyan-400" />
                      {t(
                        'multires_table_title',
                        'Multi-Resolution (1024p / 2048p) Duplication Table'
                      )}{' '}
                      ({analysis.multi_res_fixes.length})
                    </span>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {t(
                        'multires_table_desc',
                        'Duplicates texture override sections for counterpart resolutions so the mod renders across all graphics settings.'
                      )}
                    </p>
                  </div>
                  <div className="divide-y divide-zinc-800/60 text-xs">
                    {analysis.multi_res_fixes.map((item, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between">
                        <div className="font-semibold text-zinc-200">
                          {item.section_title ||
                            t('missing_resolution_target', 'Counterpart Resolution')}
                        </div>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="px-2 py-0.5 rounded bg-zinc-700/60 text-zinc-300 border border-zinc-600/40">
                            {item.source_hash}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-cyan-500" />
                          <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                            +{item.target_hash}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Buffer Remappings Table */}
              {analysis.buffer_fixes.length > 0 && (
                <div className="bg-zinc-800/40 border border-purple-500/30 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-purple-950/20 border-b border-purple-500/20">
                    <span className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
                      <Binary className="w-3.5 h-3.5 text-purple-400" />
                      {t('buffer_remappings', 'Buffer Remaps')} ({analysis.buffer_fixes.length})
                    </span>
                  </div>
                  <div className="divide-y divide-zinc-800/60 text-xs">
                    {analysis.buffer_fixes.map((item, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between">
                        <div className="font-semibold text-zinc-200">{item.buffer_filename}</div>
                        <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono text-[11px]">
                          {item.old_format} → {item.new_format}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Safety notice */}
              <div className="p-3.5 rounded-xl bg-zinc-800/40 border border-zinc-700/30 flex items-start gap-3">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-zinc-300 leading-relaxed">
                  <span className="font-semibold text-zinc-100">
                    {t('safe_backup_title', 'Safe & Non-Destructive:')}{' '}
                  </span>
                  {t(
                    'safe_backup_desc',
                    'Original .ini and .buf files will be automatically backed up with a .disabled.bak extension. You can restore the original mod state anytime.'
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Already up to date view */
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
              <div className="p-3 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100">
                  {t('mod_already_up_to_date', 'Mod Is Up to Date')}
                </h3>
                <p className="text-xs text-zinc-400 max-w-sm mt-1">
                  {t(
                    'mod_no_outdated_hashes',
                    'No outdated hashes or vertex format issues were found in this mod.'
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-zinc-900/90 border-t border-zinc-800 flex items-center justify-between">
          <div>
            {analysis?.has_backup && !fixResult && (
              <button
                onClick={() => setShowRestoreModal(true)}
                disabled={isFixing}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-700/60 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {t('restore_backup', 'Restore Original')}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              {fixResult ? t('close', 'Done') : t('cancel', 'Cancel')}
            </button>

            {analysis?.is_fixable && !fixResult && (
              <button
                onClick={handleApplyFix}
                disabled={isFixing}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                {isFixing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                    <span>{t('upgrading_mod', 'Upgrading...')}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>{t('upgrade_mod_now', 'Upgrade Mod (Apply Fix)')}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {showRestoreModal && (
        <RestoreBackupModal
          modPath={modPath}
          modName={modName}
          onClose={() => setShowRestoreModal(false)}
          onRestored={async () => {
            setShowRestoreModal(false);
            try {
              const res = await invoke<ModFixAnalysis>('check_mod_fixable', { modPath });
              setAnalysis(res);
              setFixResult(null);
            } catch (e) {
              console.error(e);
            }
            onFixApplied?.();
          }}
        />
      )}
    </div>,
    document.body
  );
}
