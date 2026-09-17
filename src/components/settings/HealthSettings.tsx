import { useState } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import {
  Activity,
  ShieldCheck,
  AlertCircle,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  Tag,
  Sparkles,
  Check,
  Crosshair,
  History,
} from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { BrokenModEntry } from '../../types/ipc';
import { HuntingModeModal } from '../Modals/HuntingModeModal';
import { OperationHistoryModal } from '../Modals/OperationHistoryModal';

export function HealthSettings() {
  const { t } = useTranslation();
  const { modsPath, scanModsFolder, highlightTargetId, checkOrPromptExperimental } = useAppStore();
  const [isScanning, setIsScanning] = useState(false);
  const [results, setResults] = useState<BrokenModEntry[] | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showHuntingModal, setShowHuntingModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [expandedMods, setExpandedMods] = useState<Record<string, boolean>>({});
  const [isAutoTagging, setIsAutoTagging] = useState(false);
  const [autoTagCount, setAutoTagCount] = useState<number | null>(null);

  const handleAutoTagAll = async () => {
    if (!modsPath) return;
    setIsAutoTagging(true);
    setAutoTagCount(null);
    try {
      const count = await invoke<number>('auto_tag_all_library_mods', { rootPath: modsPath });
      setAutoTagCount(count);
      await scanModsFolder();
    } catch (e) {
      console.error('Auto-tag all failed:', e);
    } finally {
      setIsAutoTagging(false);
    }
  };

  const toggleExpand = (modPath: string) => {
    setExpandedMods((prev) => ({
      ...prev,
      [modPath]: !prev[modPath],
    }));
  };

  const handleScan = async () => {
    if (!modsPath) return;
    setIsScanning(true);
    setExpandedMods({});
    try {
      const res = await invoke<BrokenModEntry[]>('scan_broken_mods', { modsPath });
      setResults(res);
      setShowModal(true);
    } catch (e) {
      console.error(e);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div
      data-highlight-id="health_settings"
      className={`glass-panel p-6 rounded-2xl border border-textMain/5 shadow-xl space-y-6 transition-all ${
        highlightTargetId === 'health_settings' ? 'highlight-target' : ''
      }`}
    >
      <div className="flex items-center justify-between border-b border-textMain/5 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Activity size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-textMain">{t('mod_health_title')}</h2>
            <p className="text-sm text-textMuted">{t('mod_health_desc')}</p>
          </div>
        </div>

        <button
          onClick={handleScan}
          disabled={isScanning || !modsPath}
          className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/80 text-white font-bold transition-all flex items-center gap-2 shadow-lg disabled:opacity-50"
        >
          {isScanning ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>{t('scanning_health')}</span>
            </>
          ) : (
            <>
              <Activity size={18} />
              <span>{t('scan_mods_health')}</span>
            </>
          )}
        </button>
      </div>

      {/* Auto-Tag All Library Mods Card */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
            <Tag size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-textMain">
              {t('auto_tag_all_title', 'Auto-Tag Library Mods')}
            </h2>
            <p className="text-sm text-textMuted">
              {t(
                'auto_tag_all_desc',
                'Analyze mesh, texture, audio, and animation assets across all mods to automatically assign tags.'
              )}
            </p>
            {autoTagCount !== null && (
              <p className="text-xs font-bold text-emerald-400 mt-1 flex items-center gap-1">
                <Check size={14} />{' '}
                {t('auto_tag_success', 'Successfully analyzed and tagged {{count}} mods!', {
                  count: autoTagCount,
                })}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleAutoTagAll}
          disabled={isAutoTagging || !modsPath}
          className="px-5 py-2.5 rounded-xl bg-surface hover:bg-background border border-textMain/10 hover:border-primary/50 text-textMain hover:text-primary font-bold transition-all flex items-center gap-2 shadow-lg disabled:opacity-50"
        >
          {isAutoTagging ? (
            <>
              <Loader2 size={18} className="animate-spin text-primary" />
              <span>{t('auto_tagging_mods', 'Analyzing...')}</span>
            </>
          ) : (
            <>
              <Sparkles size={18} className="text-primary" />
              <span>{t('auto_tag_all_button', 'Auto-Tag All Mods')}</span>
            </>
          )}
        </button>
      </div>

      {/* 3DMigoto Hunting Mode & Hash Sniffer Card */}
      <div
        data-highlight-id="hunting_sniffer_btn"
        className={`flex items-center justify-between pt-4 border-t border-textMain/5 rounded-xl transition-all ${
          highlightTargetId === 'hunting_sniffer_btn' ? 'highlight-target p-3 bg-amber-500/10' : ''
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <Crosshair size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-textMain">
                {t('hunting_mode_card_title', '3DMigoto Hunting Mode & Hash Sniffer')}
              </h2>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {t('experimental_tag', 'Experimental')}
              </span>
            </div>
            <p className="text-sm text-textMuted">
              {t(
                'hunting_mode_card_desc',
                'Toggle runtime hunting mode and sniff newly rendered vertex and index buffer hashes directly from d3dx.log.'
              )}
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            if (
              !checkOrPromptExperimental(t('experimental_feat_sniffer', '3DMigoto Hunting Sniffer'))
            )
              return;
            setShowHuntingModal(true);
          }}
          disabled={!modsPath}
          className="px-5 py-2.5 rounded-xl bg-surface hover:bg-background border border-textMain/10 hover:border-amber-500/50 text-textMain hover:text-amber-400 font-bold transition-all flex items-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
        >
          <Crosshair size={18} className="text-amber-400" />
          <span>{t('open_hunting_sniffer', 'Open Hash Sniffer')}</span>
        </button>
      </div>

      {/* Operation History & Rollbacks Card */}
      <div className="flex items-center justify-between pt-4 border-t border-textMain/5 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
            <History size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-textMain">
              {t('operation_history_card_title', 'Operation History & Rollbacks')}
            </h2>
            <p className="text-sm text-textMuted">
              {t(
                'operation_history_card_desc',
                'Review past mod fixes, splits, and edits with one-click restoration of original files from backup.'
              )}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowHistoryModal(true)}
          className="px-5 py-2.5 rounded-xl bg-surface hover:bg-background border border-textMain/10 hover:border-purple-500/50 text-textMain hover:text-purple-400 font-bold transition-all flex items-center gap-2 shadow-lg cursor-pointer"
        >
          <History size={18} className="text-purple-400" />
          <span>{t('view_history_backups_btn', 'View History & Backups')}</span>
        </button>
      </div>

      {showHuntingModal && <HuntingModeModal onClose={() => setShowHuntingModal(false)} />}
      {showHistoryModal && <OperationHistoryModal onClose={() => setShowHistoryModal(false)} />}

      {showModal &&
        results &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowModal(false);
            }}
          >
            <div
              className="glass-panel w-full max-w-2xl p-6 rounded-2xl border border-textMain/10 shadow-2xl space-y-6 max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-textMain/10 pb-4">
                <div className="flex items-center gap-3">
                  {results.length === 0 ? (
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <ShieldCheck size={24} />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                      <AlertCircle size={24} />
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl font-bold text-textMain">{t('health_modal_title')}</h3>
                    <p className="text-sm text-textMuted">
                      {results.length === 0
                        ? t('health_all_healthy')
                        : t('health_issues_found', { count: results.length })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 rounded-lg hover:bg-textMain/10 text-textMuted hover:text-textMain transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                {results.length === 0 ? (
                  <div className="p-8 text-center text-textMuted bg-textMain/5 rounded-xl border border-textMain/5">
                    <ShieldCheck size={48} className="mx-auto mb-3 text-emerald-400 opacity-80" />
                    <p className="font-semibold text-textMain">{t('health_all_healthy')}</p>
                  </div>
                ) : (
                  Object.entries(
                    results.reduce(
                      (acc, curr) => {
                        if (!acc[curr.category]) acc[curr.category] = {};
                        if (!acc[curr.category][curr.mod_path])
                          acc[curr.category][curr.mod_path] = [];
                        acc[curr.category][curr.mod_path].push(curr);
                        return acc;
                      },
                      {} as Record<string, Record<string, BrokenModEntry[]>>
                    )
                  ).map(([category, mods]) => (
                    <div key={category} className="space-y-3 pb-2">
                      <h4 className="font-bold text-textMain/80 text-sm px-2 uppercase tracking-wider">
                        {category}
                      </h4>
                      {Object.entries(mods).map(([modPath, entries], idx) => {
                        const outdatedCount = entries.filter((e) =>
                          e.reason.startsWith('Outdated')
                        ).length;
                        const unrecognizedCount = entries.filter(
                          (e) => e.reason === 'Unrecognized hash'
                        ).length;
                        const isExpanded = !!expandedMods[modPath];
                        const displayedEntries = isExpanded ? entries : entries.slice(0, 3);

                        return (
                          <div
                            key={idx}
                            className="p-4 rounded-xl bg-textMain/5 border border-textMain/10 space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-textMain break-all">{modPath}</span>
                              <div className="flex gap-2">
                                {outdatedCount > 0 && (
                                  <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                    {outdatedCount} Outdated
                                  </span>
                                )}
                                {unrecognizedCount > 0 && (
                                  <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                    {unrecognizedCount} Unrecognized
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="space-y-2">
                              {displayedEntries.map((entry, i) => (
                                <div
                                  key={i}
                                  className="grid grid-cols-2 gap-2 text-xs font-mono bg-black/20 p-2.5 rounded-lg border border-textMain/5"
                                >
                                  {entry.file && (
                                    <div className="col-span-2 pb-1 border-b border-textMain/5 mb-1">
                                      <span className="text-textMuted">File: </span>
                                      <span className="text-textMain/90 break-all">
                                        {entry.file}
                                      </span>
                                    </div>
                                  )}
                                  <div>
                                    <span className="text-textMuted">Hash: </span>
                                    <span className="text-amber-300 font-bold">{entry.hash}</span>
                                  </div>
                                  {entry.component && (
                                    <div>
                                      <span className="text-textMuted">Component: </span>
                                      <span className="text-textMain">{entry.component}</span>
                                    </div>
                                  )}
                                  {entry.current_hash && (
                                    <div>
                                      <span className="text-textMuted">New Hash: </span>
                                      <span className="text-emerald-400 font-bold">
                                        {entry.current_hash}
                                      </span>
                                    </div>
                                  )}
                                  {entry.version_gap && (
                                    <div>
                                      <span className="text-textMuted">Version: </span>
                                      <span className="text-textMain">{entry.version_gap}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                              {entries.length > 3 && (
                                <button
                                  onClick={() => toggleExpand(modPath)}
                                  className="w-full flex items-center justify-center gap-2 text-xs text-textMuted hover:text-textMain hover:bg-black/20 transition-all bg-black/10 py-1.5 rounded-lg border border-textMain/5"
                                >
                                  {isExpanded ? (
                                    <>
                                      <ChevronUp size={14} />
                                      Show Less
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown size={14} />+ {entries.length - 3} more{' '}
                                      {entries.length - 3 === 1 ? 'hash' : 'hashes'}
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              <div className="flex justify-end pt-2 border-t border-textMain/10">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2 rounded-xl bg-textMain/10 hover:bg-textMain/20 text-textMain font-bold transition-all"
                >
                  {t('close')}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
