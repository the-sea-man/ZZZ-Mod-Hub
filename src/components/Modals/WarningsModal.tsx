import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ShieldAlert,
  Wrench,
  CheckCircle,
  RefreshCw,
  SlidersHorizontal,
  Users,
  FileCode,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { ModInfo, ModWarning } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { FixModModal } from './FixModModal';

interface WarningsModalProps {
  mod: ModInfo;
  warnings: (ModWarning | string)[];
  onClose: () => void;
}

export function WarningsModal({ mod, warnings, onClose }: WarningsModalProps) {
  const { t } = useTranslation();
  const { enabledWarningRules, toggleWarningRule, checkOrPromptExperimental } = useAppStore();
  const [isFixing, setIsFixing] = useState(false);
  const [fixResults, setFixResults] = useState<string[] | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showFixModModal, setShowFixModModal] = useState(false);
  const [expandedDetails, setExpandedDetails] = useState<Record<number, boolean>>({});

  // Keyboard: Escape to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showFixModModal) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, showFixModModal]);

  const normalizedWarnings: ModWarning[] = warnings.map((w) => {
    if (typeof w === 'string') {
      const isConflict = w.includes('Conflict detected');
      const isMultiChar = w.includes('Multi-character mod');
      const isOutdated = w.includes('Outdated Game Version');
      return {
        rule_id: isConflict
          ? 'conflict'
          : isMultiChar
            ? 'multi_character'
            : isOutdated
              ? 'outdated_version'
              : 'general',
        level: isConflict
          ? 'conflict'
          : isMultiChar
            ? 'warning'
            : isOutdated
              ? 'outdated_version'
              : 'ini_issue',
        message: w,
      };
    }
    return w;
  });

  const visibleWarnings = normalizedWarnings.filter(
    (w) => enabledWarningRules[w.rule_id] !== false
  );

  const hasFixableIssues = visibleWarnings.some(
    (w) =>
      w.rule_id === 'standalone_help' ||
      w.rule_id === 'rogue_hud' ||
      w.rule_id === 'unconditional_key' ||
      w.rule_id === 'missing_vertex_limit_override' ||
      w.rule_id === 'missing_resource_definition' ||
      w.level === 'ini_issue' ||
      w.level === 'crash_risk' ||
      w.message.includes('help.ini') ||
      w.message.includes('Rogue HUD') ||
      w.message.includes('Global hotkey') ||
      w.message.includes('Auto-Fix')
  );

  const hasOutdatedVersion = visibleWarnings.some(
    (w) => w.level === 'outdated_version' || w.rule_id === 'outdated_version'
  );

  const hasConflict = visibleWarnings.some(
    (w) => w.level === 'conflict' || w.level === 'critical' || w.rule_id === 'conflict'
  );
  const hasMultiChar = visibleWarnings.some(
    (w) => w.level === 'warning' || w.rule_id === 'multi_character'
  );

  const ruleLabels: Record<string, { label: string; level: string }> = {
    outdated_version: {
      label: t('rule_outdated_version', 'Outdated Game Version (1.0 -> 3.1)'),
      level: 'outdated_version',
    },
    conflict: { label: t('rule_conflict', 'Hash Conflicts'), level: 'conflict' },
    multi_character: {
      label: t('rule_multi_character', 'Multi-Character Hashes'),
      level: 'warning',
    },
    rogue_hud: { label: t('rule_rogue_hud', 'Rogue HUD Manipulations'), level: 'ini_issue' },
    standalone_help: {
      label: t('rule_standalone_help', 'Standalone help.ini'),
      level: 'ini_issue',
    },
    unconditional_key: {
      label: t('rule_unconditional_key', 'Unconditional Keybinds'),
      level: 'ini_issue',
    },
    missing_vertex_limit_override: {
      label: t('rule_missing_vertex_limit_override', 'Missing Vertex Limit Override'),
      level: 'ini_issue',
    },
    missing_resource_definition: {
      label: t('rule_missing_resource_definition', 'Missing Resource Definitions'),
      level: 'crash_risk',
    },
    duplicate_section: {
      label: t('rule_duplicate_section', 'Duplicate Section Headers'),
      level: 'ini_issue',
    },
    missing_resource_ref: {
      label: t('rule_missing_resource_ref', "Missing Resource 'ref' Syntax"),
      level: 'ini_issue',
    },
    unconditional_texture_override: {
      label: t('rule_unconditional_texture_override', 'Unconditional Texture Overrides'),
      level: 'ini_issue',
    },
  };

  const handleAutoFix = async () => {
    if (!checkOrPromptExperimental(t('experimental_feat_fixer', 'INI Script Auto-Fixer'))) return;
    setIsFixing(true);
    try {
      const results = await invoke<string[]>('auto_fix_mod_script', {
        modPath: mod.full_path,
      });
      setFixResults(results);
      useAppStore.getState().incrementStat('warningsFixed');

      // Clear fixed warnings for this mod immediately
      useAppStore.getState().removeModWarning(mod.full_path);

      // Refresh mod state and warning badges
      useAppStore.getState().scanModsFolder();
    } catch (e: unknown) {
      setFixResults([`Fix failed: ${String(e)}`]);
    } finally {
      setIsFixing(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 app-blur backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className={`glass-panel w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border flex flex-col max-h-[90vh] ${
          hasConflict
            ? 'border-red-500/30'
            : hasMultiChar
              ? 'border-yellow-500/30'
              : 'border-sky-500/30'
        }`}
      >
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
          <div className="flex items-center justify-between border-b border-textMain/5 pb-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  hasConflict
                    ? 'bg-red-500/20 text-red-400'
                    : hasMultiChar
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-sky-500/20 text-sky-400'
                }`}
              >
                {hasConflict ? (
                  <ShieldAlert size={22} />
                ) : hasMultiChar ? (
                  <Users size={22} />
                ) : (
                  <FileCode size={22} />
                )}
              </div>
              <div>
                <h2 className="text-2xl font-black text-textMain">{t('warnings_modal_title')}</h2>
                <p className="text-xs text-textMuted">{mod.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-full transition-colors flex items-center gap-1 text-xs font-semibold ${
                  showFilters
                    ? 'bg-primary text-white'
                    : 'bg-surface/50 text-textMuted hover:text-textMain'
                }`}
                title={t('filter_warnings', 'Filter Warning Rules')}
              >
                <SlidersHorizontal size={15} />
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-surface/50 text-textMuted hover:text-textMain flex items-center justify-center transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <p className="text-sm text-textMuted leading-relaxed">{t('warnings_modal_desc')}</p>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-black/30 p-4 rounded-2xl border border-white/10 space-y-3"
              >
                <div className="flex items-center justify-between text-xs font-bold text-textMain">
                  <span>{t('active_warning_rules', 'Active Warning Rules')}</span>
                  <span className="text-[10px] text-textMuted">
                    {t('toggle_to_hide', 'Uncheck to ignore rule')}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {Object.entries(ruleLabels).map(([ruleKey, config]) => {
                    const isEnabled = enabledWarningRules[ruleKey] !== false;
                    const isConf = config.level === 'conflict';
                    const isMC = config.level === 'warning';
                    const isCrash = config.level === 'crash_risk';
                    const isOutdated = config.level === 'outdated_version';
                    return (
                      <label
                        key={ruleKey}
                        className="flex items-center justify-between p-2 rounded-xl bg-surface/40 hover:bg-surface/70 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => toggleWarningRule(ruleKey)}
                            className="rounded border-textMain/20 bg-background text-primary focus:ring-primary h-4 w-4"
                          />
                          <span
                            className={`truncate ${isEnabled ? 'text-textMain' : 'text-textMuted line-through opacity-60'}`}
                          >
                            {config.label}
                          </span>
                        </div>
                        <span
                          className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded shrink-0 ml-1 ${
                            isCrash
                              ? 'bg-rose-500/20 text-rose-400'
                              : isConf
                                ? 'bg-red-500/20 text-red-400'
                                : isMC
                                  ? 'bg-yellow-500/20 text-yellow-400'
                                  : isOutdated
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : 'bg-sky-500/20 text-sky-400'
                          }`}
                        >
                          {isCrash
                            ? t('severity_crash_risk', 'Crash')
                            : isConf
                              ? t('severity_conflict', 'Conflict')
                              : isMC
                                ? t('severity_multi_character', 'Multi')
                                : isOutdated
                                  ? t('severity_outdated_version', 'Version')
                                  : t('severity_ini_issue', 'INI')}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {fixResults && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl bg-green-500/10 border border-green-500/30 text-green-300 text-xs space-y-1.5"
            >
              <div className="flex items-center gap-2 font-bold text-sm text-green-400 mb-1">
                <CheckCircle size={16} />
                {t('autofix_complete', 'Auto-Fix Applied!')}
              </div>
              {fixResults.map((msg, i) => (
                <div key={i} className="leading-relaxed opacity-90">
                  • {msg}
                </div>
              ))}
            </motion.div>
          )}

          <div className="space-y-3">
            {visibleWarnings.length === 0 ? (
              <div className="p-6 rounded-2xl bg-surface/30 border border-textMain/5 text-center text-textMuted text-sm">
                {t(
                  'no_matching_warnings',
                  'No active warnings match your current filter settings.'
                )}
              </div>
            ) : (
              visibleWarnings.map((warn, idx) => {
                const isOutdated =
                  warn.level === 'outdated_version' || warn.rule_id === 'outdated_version';
                const isCrash =
                  !isOutdated &&
                  (warn.level === 'crash_risk' || warn.rule_id === 'missing_resource_definition');
                const isConf =
                  !isOutdated &&
                  !isCrash &&
                  (warn.level === 'conflict' ||
                    warn.level === 'critical' ||
                    warn.rule_id === 'conflict');
                const isMC =
                  !isOutdated &&
                  !isCrash &&
                  (warn.level === 'warning' || warn.rule_id === 'multi_character');

                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border text-sm flex items-start gap-3 ${
                      isOutdated
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                        : isCrash
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                          : isConf
                            ? 'bg-red-500/10 border-red-500/30 text-red-300'
                            : isMC
                              ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300'
                              : 'bg-sky-500/10 border-sky-500/30 text-sky-300'
                    }`}
                  >
                    {isOutdated ? (
                      <Sparkles size={18} className="shrink-0 mt-0.5 text-amber-400" />
                    ) : isCrash ? (
                      <ShieldAlert size={18} className="shrink-0 mt-0.5 text-rose-400" />
                    ) : isConf ? (
                      <ShieldAlert size={18} className="shrink-0 mt-0.5 text-red-400" />
                    ) : isMC ? (
                      <Users size={18} className="shrink-0 mt-0.5 text-yellow-400" />
                    ) : (
                      <FileCode size={18} className="shrink-0 mt-0.5 text-sky-400" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                            isOutdated
                              ? 'bg-amber-500/20 text-amber-300'
                              : isCrash
                                ? 'bg-rose-500/20 text-rose-400'
                                : isConf
                                  ? 'bg-red-500/20 text-red-400'
                                  : isMC
                                    ? 'bg-yellow-500/20 text-yellow-400'
                                    : 'bg-sky-500/20 text-sky-400'
                          }`}
                        >
                          {isOutdated
                            ? t('severity_outdated_version', 'Outdated Version')
                            : isCrash
                              ? t('severity_crash_risk', 'Crash Risk')
                              : isConf
                                ? t('severity_conflict', 'Hash Conflict')
                                : isMC
                                  ? t('severity_multi_character', 'Multi-Character')
                                  : t('severity_ini_issue', 'INI Script Issue')}
                        </span>

                        {isOutdated ? (
                          <button
                            onClick={() => {
                              if (
                                !checkOrPromptExperimental(
                                  t('experimental_feat_fixer', 'Mod Fixer')
                                )
                              )
                                return;
                              setShowFixModModal(true);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-all shadow-sm flex items-center gap-1 shrink-0"
                          >
                            <Sparkles size={12} />
                            {t('upgrade_version_btn', 'Review & Upgrade')}
                          </button>
                        ) : warn.rule_id === 'unconditional_key' ||
                          warn.rule_id === 'standalone_help' ||
                          warn.rule_id === 'rogue_hud' ||
                          warn.level === 'ini_issue' ||
                          warn.message.includes('Auto-Fix') ? (
                          <button
                            onClick={handleAutoFix}
                            disabled={isFixing}
                            className="px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-zinc-950 text-xs font-bold transition-all shadow-sm flex items-center gap-1 shrink-0 disabled:opacity-50"
                          >
                            {isFixing ? (
                              <RefreshCw className="animate-spin" size={12} />
                            ) : (
                              <Wrench size={12} />
                            )}
                            {isFixing
                              ? t('autofixing', 'Fixing...')
                              : t('autofix_btn_short', 'Auto-Fix')}
                          </button>
                        ) : null}
                      </div>
                      <div className="leading-relaxed break-words font-medium">{warn.message}</div>
                      {warn.details && (
                        <div className="mt-2.5 pt-2 border-t border-current/10">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedDetails((prev) => ({ ...prev, [idx]: !prev[idx] }))
                            }
                            className="text-xs opacity-80 hover:opacity-100 flex items-center gap-1 font-semibold transition-opacity cursor-pointer py-0.5"
                          >
                            {expandedDetails[idx] ? (
                              <>
                                <ChevronUp size={13} />
                                {t('hide_details', 'Hide details')}
                              </>
                            ) : (
                              <>
                                <ChevronDown size={13} />
                                {t('show_details', 'Show details & hashes')}
                              </>
                            )}
                          </button>
                          <AnimatePresence>
                            {expandedDetails[idx] && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-2 p-3 bg-black/40 rounded-xl border border-white/5 font-mono text-[11px] opacity-90 whitespace-pre-line leading-relaxed overflow-x-auto select-text"
                              >
                                {warn.details}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 bg-surface/50 p-4 border-t border-textMain/10 shrink-0">
          {hasOutdatedVersion && (
            <button
              onClick={() => {
                if (!checkOrPromptExperimental(t('experimental_feat_fixer', 'Mod Fixer'))) return;
                setShowFixModModal(true);
              }}
              className="flex-1 py-3 px-4 rounded-xl font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles size={16} />
              {t('upgrade_mod_action', 'Upgrade Outdated Mod')}
            </button>
          )}
          {hasFixableIssues && (
            <button
              onClick={handleAutoFix}
              disabled={isFixing}
              className="flex-1 py-3 px-4 rounded-xl font-bold bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isFixing ? <RefreshCw className="animate-spin" size={16} /> : <Wrench size={16} />}
              {isFixing
                ? t('autofixing', 'Fixing...')
                : t('autofix_button', 'Auto-Fix Script Issues')}
            </button>
          )}
          <button
            onClick={onClose}
            className={`${hasFixableIssues || hasOutdatedVersion ? 'w-32' : 'w-full'} py-3 rounded-xl font-bold bg-primary text-white hover:bg-primary/80 transition-colors`}
          >
            {t('close')}
          </button>
        </div>
      </motion.div>

      {/* Fix Mod Modal */}
      {showFixModModal && (
        <FixModModal
          modPath={mod.full_path}
          modName={mod.name}
          onClose={() => setShowFixModModal(false)}
          onFixApplied={() => {
            setShowFixModModal(false);
            useAppStore.getState().scanModsFolder();
          }}
        />
      )}
    </div>,
    document.body
  );
}
