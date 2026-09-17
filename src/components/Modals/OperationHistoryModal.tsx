import { useState, useEffect, useMemo } from 'react';
import {
  History,
  ShieldCheck,
  RotateCcw,
  FileText,
  AlertTriangle,
  Trash2,
  FolderOpen,
  Search,
  Copy,
  Check,
  RefreshCw,
  Clock,
  Filter,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { tauriCommands } from '../../services/tauriCommands';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { playSyncSound } from '../../utils/audio';
import { confirm } from '@tauri-apps/plugin-dialog';
import type { AlterationEntry, ErrorLogEntry } from '../../types/ipc';

interface OperationHistoryModalProps {
  onClose: () => void;
}

export function OperationHistoryModal({ onClose }: OperationHistoryModalProps) {
  const { t } = useTranslation();
  const { showToast, scanModsFolder } = useAppStore();

  const [activeTab, setActiveTab] = useState<'alterations' | 'errors'>('alterations');
  const [alterations, setAlterations] = useState<AlterationEntry[]>([]);
  const [errors, setErrors] = useState<ErrorLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const [alts, errs] = await Promise.all([
        tauriCommands.logs.getAlterationHistory(200),
        tauriCommands.logs.getErrorLogs(200),
      ]);
      setAlterations(alts);
      setErrors(errs);
    } catch (e) {
      console.error('Failed to load logs:', e);
      showToast(t('logs_load_failed', { defaultValue: 'Failed to load activity logs.' }));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleRollback = async (entry: AlterationEntry) => {
    const confirmed = await confirm(
      t('rollback_confirm_msg', {
        defaultValue:
          "Are you sure you want to reverse this operation? This will restore the original files from backup for '{{target}}'.",
        target: entry.target_name,
      }),
      {
        title: t('rollback_confirm_title', { defaultValue: 'Restore from Backup' }),
        kind: 'warning',
      }
    );

    if (!confirmed) return;

    setRollingBackId(entry.id);
    try {
      const res = await tauriCommands.logs.rollbackAlteration(entry.id);
      if (res.success) {
        playSyncSound();
        showToast(res.message);
        await scanModsFolder();
        await fetchLogs();
      } else {
        showToast(res.message);
      }
    } catch (e: any) {
      console.error('Rollback failed:', e);
      showToast(
        t('rollback_failed', {
          defaultValue: 'Failed to reverse operation: {{error}}',
          error: e?.toString() || 'Unknown error',
        })
      );
    } finally {
      setRollingBackId(null);
    }
  };

  const handleClearLogs = async () => {
    const confirmed = await confirm(
      t('clear_logs_confirm_msg', {
        defaultValue: 'Are you sure you want to clear the logs? This action cannot be undone.',
      }),
      {
        title: t('clear_logs_confirm_title', { defaultValue: 'Clear Logs' }),
        kind: 'warning',
      }
    );

    if (!confirmed) return;

    try {
      await tauriCommands.logs.clearLogs(activeTab);
      showToast(t('logs_cleared', { defaultValue: 'Logs cleared successfully.' }));
      await fetchLogs();
    } catch (e) {
      console.error('Clear logs failed:', e);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredAlterations = useMemo(() => {
    return alterations.filter((entry) => {
      const matchesSearch =
        entry.target_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.target_path.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType =
        selectedType === 'all' || entry.action_type.toLowerCase() === selectedType.toLowerCase();

      return matchesSearch && matchesType;
    });
  }, [alterations, searchQuery, selectedType]);

  const filteredErrors = useMemo(() => {
    return errors.filter((entry) => {
      return (
        entry.subsystem.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.error_message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (entry.context && entry.context.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    });
  }, [errors, searchQuery]);

  const actionTypeBadge = (type: string) => {
    switch (type.toLowerCase()) {
      case 'mod_fix':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            {t('action_mod_fix', { defaultValue: 'MOD FIX' })}
          </span>
        );
      case 'mod_split':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
            {t('action_mod_split', { defaultValue: 'SPLIT' })}
          </span>
        );
      case 'keybind_change':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            {t('action_keybind', { defaultValue: 'KEYBIND' })}
          </span>
        );
      case 'script_fix':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
            {t('action_script_fix', { defaultValue: 'SCRIPT' })}
          </span>
        );
      case 'restore':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            {t('action_restore', { defaultValue: 'RESTORE' })}
          </span>
        );
      case 'rename':
      case 'move':
      case 'delete':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-white/10 text-textMuted border border-white/10">
            {type.toUpperCase()}
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-primary/20 text-primary border border-primary/30">
            {type.toUpperCase()}
          </span>
        );
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      maxWidth="4xl"
      title={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
            <History size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-textMain">
              {t('operation_history_title', { defaultValue: 'Operation History & Diagnostics' })}
            </h2>
            <p className="text-xs text-textMuted">
              {t('operation_history_desc', {
                defaultValue:
                  'Review modifications, inspect backup snapshots, and restore original mod files.',
              })}
            </p>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <button
              onClick={() => tauriCommands.logs.openLogsFolder()}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-textMain hover:text-primary transition-colors flex items-center gap-1.5"
            >
              <FolderOpen size={14} />
              <span>{t('open_logs_folder_btn', { defaultValue: 'Open Logs Folder' })}</span>
            </button>
            <button
              onClick={() => tauriCommands.logs.openLogFile(activeTab)}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-textMain hover:text-primary transition-colors flex items-center gap-1.5"
            >
              <FileText size={14} />
              <span>
                {activeTab === 'alterations'
                  ? t('open_alterations_log_btn', { defaultValue: 'Open alterations.log' })
                  : t('open_errors_log_btn', { defaultValue: 'Open errors.log' })}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleClearLogs}
              className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-xs font-semibold text-rose-400 transition-colors flex items-center gap-1.5"
            >
              <Trash2 size={14} />
              <span>{t('clear_logs_btn', { defaultValue: 'Clear Log' })}</span>
            </button>
            <button
              onClick={onClose}
              className="px-5 py-1.5 rounded-lg bg-primary hover:bg-primary/80 text-xs font-bold text-white transition-all shadow-md"
            >
              {t('close', { defaultValue: 'Close' })}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('alterations')}
              className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
                activeTab === 'alterations'
                  ? 'bg-primary text-white shadow-lg'
                  : 'bg-white/5 text-textMuted hover:text-textMain hover:bg-white/10'
              }`}
            >
              <History size={16} />
              <span>{t('tab_alterations', { defaultValue: 'Alterations & Backups' })}</span>
              <span className="px-1.5 py-0.2 rounded-full text-xs bg-black/30">
                {alterations.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('errors')}
              className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
                activeTab === 'errors'
                  ? 'bg-rose-500 text-white shadow-lg'
                  : 'bg-white/5 text-textMuted hover:text-textMain hover:bg-white/10'
              }`}
            >
              <AlertTriangle size={16} />
              <span>{t('tab_errors', { defaultValue: 'Error Logs' })}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-xs ${
                  errors.length > 0 ? 'bg-rose-900/60 text-rose-200' : 'bg-black/30'
                }`}
              >
                {errors.length}
              </span>
            </button>
          </div>

          <button
            onClick={fetchLogs}
            disabled={isLoading}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-textMuted hover:text-textMain transition-colors disabled:opacity-50"
            title={t('refresh', { defaultValue: 'Refresh' })}
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'alterations'
                  ? t('search_operations_placeholder', {
                      defaultValue: 'Search by mod name or action...',
                    })
                  : t('search_errors_placeholder', {
                      defaultValue: 'Search error message or subsystem...',
                    })
              }
              className="w-full pl-9 pr-3 py-1.5 bg-black/20 border border-white/10 rounded-xl text-xs text-textMain placeholder:text-textMuted focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {activeTab === 'alterations' && (
            <div className="flex items-center gap-1.5 text-xs">
              <Filter size={14} className="text-textMuted" />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="bg-black/20 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-textMain focus:outline-none focus:border-primary"
              >
                <option value="all">
                  {t('filter_all_types', { defaultValue: 'All Actions' })}
                </option>
                <option value="mod_fix">
                  {t('filter_mod_fixes', { defaultValue: 'Mod Fixes' })}
                </option>
                <option value="mod_split">
                  {t('filter_mod_splits', { defaultValue: 'Mod Splits' })}
                </option>
                <option value="keybind_change">
                  {t('filter_keybinds', { defaultValue: 'Keybinds' })}
                </option>
                <option value="script_fix">
                  {t('filter_scripts', { defaultValue: 'Script Fixes' })}
                </option>
                <option value="restore">
                  {t('filter_restores', { defaultValue: 'Restorations' })}
                </option>
              </select>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="min-h-[350px] max-h-[480px] overflow-y-auto space-y-2.5 pr-1">
          {activeTab === 'alterations' ? (
            filteredAlterations.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                <Clock size={36} className="text-textMuted/40 mb-3" />
                <h3 className="font-bold text-textMain text-sm mb-1">
                  {t('no_operations_found', { defaultValue: 'No operations found' })}
                </h3>
                <p className="text-xs text-textMuted max-w-sm">
                  {searchQuery || selectedType !== 'all'
                    ? t('no_operations_match', {
                        defaultValue: 'No alterations match your current filter.',
                      })
                    : t('no_operations_recorded', {
                        defaultValue:
                          'Operations like mod fixes, splits, and keybind changes will automatically appear here.',
                      })}
                </p>
              </div>
            ) : (
              filteredAlterations.map((entry) => (
                <div
                  key={entry.id}
                  className="p-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {actionTypeBadge(entry.action_type)}
                      <span className="font-bold text-sm text-textMain truncate">
                        {entry.target_name}
                      </span>
                      <span className="text-[11px] text-textMuted opacity-70">
                        {entry.timestamp}
                      </span>
                      {entry.can_undo && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 flex items-center gap-1 border border-emerald-500/20">
                          <ShieldCheck size={11} />
                          <span>{t('backup_available', { defaultValue: 'Backup Available' })}</span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-textMuted leading-relaxed">{entry.details}</p>

                    <div className="flex items-center gap-2 text-[11px] text-textMuted/60 truncate font-mono">
                      <span className="truncate">{entry.target_path}</span>
                    </div>
                  </div>

                  {entry.can_undo && (
                    <button
                      onClick={() => handleRollback(entry)}
                      disabled={rollingBackId === entry.id}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm whitespace-nowrap self-start sm:self-center disabled:opacity-50 cursor-pointer"
                    >
                      <RotateCcw
                        size={13}
                        className={rollingBackId === entry.id ? 'animate-spin' : ''}
                      />
                      <span>
                        {rollingBackId === entry.id
                          ? t('restoring', { defaultValue: 'Restoring...' })
                          : t('reverse_restore_btn', { defaultValue: 'Reverse / Restore' })}
                      </span>
                    </button>
                  )}
                </div>
              ))
            )
          ) : filteredErrors.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 rounded-2xl bg-white/[0.02] border border-white/5">
              <ShieldCheck size={36} className="text-emerald-400/40 mb-3" />
              <h3 className="font-bold text-textMain text-sm mb-1">
                {t('clean_health_title', { defaultValue: 'Clean Health Check' })}
              </h3>
              <p className="text-xs text-textMuted max-w-sm">
                {t('no_errors_recorded', {
                  defaultValue:
                    'No application errors or runtime exceptions recorded. Everything is operating smoothly!',
                })}
              </p>
            </div>
          ) : (
            filteredErrors.map((entry) => (
              <div
                key={entry.id}
                className="p-3.5 rounded-xl bg-rose-500/[0.04] hover:bg-rose-500/[0.08] border border-rose-500/15 transition-all space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 uppercase">
                      {entry.subsystem}
                    </span>
                    <span className="text-[11px] text-textMuted opacity-70">{entry.timestamp}</span>
                  </div>

                  <button
                    onClick={() =>
                      handleCopy(
                        `[${entry.timestamp}] [${entry.subsystem}] ${entry.error_message}${
                          entry.context ? ` | Context: ${entry.context}` : ''
                        }`,
                        entry.id
                      )
                    }
                    className="p-1 rounded bg-white/5 hover:bg-white/10 text-textMuted hover:text-textMain transition-colors"
                    title={t('copy_error', { defaultValue: 'Copy error trace' })}
                  >
                    {copiedId === entry.id ? (
                      <Check size={13} className="text-emerald-400" />
                    ) : (
                      <Copy size={13} />
                    )}
                  </button>
                </div>

                <p className="text-xs font-mono text-rose-300 break-words leading-relaxed">
                  {entry.error_message}
                </p>

                {entry.context && (
                  <p className="text-[11px] font-mono text-textMuted/70 break-all">
                    Context: {entry.context}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
