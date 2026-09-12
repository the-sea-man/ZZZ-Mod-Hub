import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  Crosshair,
  RefreshCw,
  Copy,
  Check,
  Power,
  AlertTriangle,
  ShieldCheck,
  Download,
  Sparkles,
  X,
} from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { tauriCommands } from '../../services/tauriCommands';
import type { CapturedHashEntry } from '../../types/ipc';

interface HuntingModeModalProps {
  onClose: () => void;
}

export function HuntingModeModal({ onClose }: HuntingModeModalProps) {
  const { modsPath } = useAppStore();
  const { t } = useTranslation();

  const [huntingEnabled, setHuntingEnabled] = useState<boolean>(false);
  const [capturedHashes, setCapturedHashes] = useState<CapturedHashEntry[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'unregistered' | 'ib' | 'vb'>('all');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isToggling, setIsToggling] = useState<boolean>(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Keyboard: Escape to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const fetchStatus = async () => {
    if (!modsPath) return;
    setIsLoading(true);
    try {
      const enabled = await tauriCommands.system.getHuntingModeStatus(modsPath);
      setHuntingEnabled(enabled);

      const hashes = await tauriCommands.system.readHuntingLog(modsPath);
      setCapturedHashes(hashes);
    } catch (e) {
      console.error('Failed to query hunting mode:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [modsPath]);

  const handleToggle = async () => {
    if (!modsPath) return;
    setIsToggling(true);
    try {
      const newStatus = !huntingEnabled;
      await tauriCommands.system.setHuntingMode(modsPath, newStatus);
      setHuntingEnabled(newStatus);
      if (newStatus) {
        fetchStatus();
      }
    } catch (e) {
      console.error('Failed to toggle hunting mode:', e);
    } finally {
      setIsToggling(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleExportJson = () => {
    const unregistered = capturedHashes.filter((h) => !h.is_known);
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(unregistered, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'unregistered_3dmigoto_hashes.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const filteredHashes = capturedHashes.filter((h) => {
    if (filterMode === 'unregistered') return !h.is_known;
    if (filterMode === 'ib') return h.hash_type.toUpperCase() === 'IB';
    if (filterMode === 'vb') return h.hash_type.toUpperCase().startsWith('VB');
    return true;
  });

  const unknownCount = capturedHashes.filter((h) => !h.is_known).length;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-surface border border-textMain/10 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-textMain/10 flex justify-between items-center bg-background/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/20 text-primary border border-primary/30">
              <Crosshair size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-textMain flex items-center gap-2">
                {t('hunting_mode_title', '3DMigoto Hash Hunting Mode')}
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    huntingEnabled
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse'
                      : 'bg-textMuted/20 text-textMuted border border-textMuted/30'
                  }`}
                >
                  {huntingEnabled ? t('active', 'Active') : t('inactive', 'Inactive')}
                </span>
              </h2>
              <p className="text-xs text-textMuted mt-0.5">
                {t(
                  'hunting_mode_desc',
                  'Capture and log raw mesh hashes directly from Zenless Zone Zero runtime.'
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={fetchStatus}
              disabled={isLoading}
              className="p-2 hover:bg-white/10 text-textMuted hover:text-textMain rounded-xl transition-colors font-bold text-sm"
              title="Refresh Captured Hashes"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 text-textMuted hover:text-textMain rounded-xl transition-colors font-bold text-sm flex items-center justify-center"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Status & Control Card */}
        <div className="p-6 border-b border-textMain/10 bg-background/20 flex flex-col gap-4">
          <div className="flex items-center justify-between p-4 bg-background/60 rounded-xl border border-textMain/5">
            <div className="flex flex-col gap-1">
              <span className="font-bold text-sm text-textMain">
                {t('hunting_toggle_label', 'Enable d3dx.ini Hunting Flags')}
              </span>
              <span className="text-xs text-textMuted">
                {t(
                  'hunting_toggle_sub',
                  'Sets marking_mode=skip, hunting=2, and dump_usage=all in d3dx.ini'
                )}
              </span>
            </div>
            <button
              onClick={handleToggle}
              disabled={isToggling}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                huntingEnabled
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                  : 'bg-primary text-white hover:bg-primary/80 shadow-lg shadow-primary/20'
              }`}
            >
              <Power size={14} />
              {isToggling
                ? t('updating', 'Updating...')
                : huntingEnabled
                  ? t('disable_hunting', 'Disable Hunting')
                  : t('enable_hunting', 'Enable Hunting')}
            </button>
          </div>

          <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
            <AlertTriangle size={16} className="shrink-0" />
            <span>
              {t(
                'hunting_perf_warning',
                'Hunting mode causes minor stuttering in-game while logging. Turn it off when you finish testing.'
              )}
            </span>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 border-b border-textMain/10 flex items-center justify-between gap-4 bg-background/40">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterMode === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-background/50 text-textMuted hover:text-textMain border border-textMain/5'
              }`}
            >
              {t('all', 'All')} ({capturedHashes.length})
            </button>
            <button
              onClick={() => setFilterMode('unregistered')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                filterMode === 'unregistered'
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'bg-background/50 text-amber-400 hover:text-amber-300 border border-amber-500/20'
              }`}
            >
              <Sparkles size={12} />
              <span>
                {t('new_unregistered', 'Unregistered')} ({unknownCount})
              </span>
            </button>
            <button
              onClick={() => setFilterMode('ib')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterMode === 'ib'
                  ? 'bg-primary text-white'
                  : 'bg-background/50 text-textMuted hover:text-textMain border border-textMain/5'
              }`}
            >
              IB (Mesh Index)
            </button>
            <button
              onClick={() => setFilterMode('vb')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterMode === 'vb'
                  ? 'bg-primary text-white'
                  : 'bg-background/50 text-textMuted hover:text-textMain border border-textMain/5'
              }`}
            >
              VB (Vertex Buffer)
            </button>
          </div>

          {unknownCount > 0 && (
            <button
              onClick={handleExportJson}
              className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
              title="Export unregistered hashes as JSON"
            >
              <Download size={13} /> {t('export_json', 'Export New Hashes JSON')}
            </button>
          )}
        </div>

        {/* Captured Hash List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1 min-h-[220px]">
          {filteredHashes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-textMuted bg-background/30 rounded-xl border border-textMain/5">
              <Crosshair size={36} className="mb-2 opacity-30" />
              <p className="text-sm font-bold">
                {t('no_captured_hashes', 'No captured hashes found in d3dx.log.')}
              </p>
              <p className="text-xs text-textMuted/70 mt-1 max-w-sm text-center">
                {t(
                  'hunting_instruction',
                  'Enable Hunting Mode above, play Zenless Zone Zero, and 3DMigoto will record elements into d3dx.log.'
                )}
              </p>
            </div>
          ) : (
            filteredHashes.map((entry, idx) => (
              <div
                key={idx}
                className="p-3 bg-background/60 hover:bg-background/90 rounded-xl border border-textMain/5 transition-all flex items-center justify-between gap-4"
              >
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-textMain selection:bg-primary selection:text-white">
                      {entry.hash}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-white/5 text-textMuted border border-white/5">
                      {entry.hash_type}
                    </span>
                    {entry.is_known ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <ShieldCheck size={11} /> {entry.matched_entity || 'Known'}
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-md font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse flex items-center gap-1">
                        <Sparkles size={11} />
                        <span>Unregistered Asset</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-mono text-textMuted/70 truncate">
                    {entry.line_snippet}
                  </p>
                </div>

                <button
                  onClick={() => handleCopy(entry.hash)}
                  className="px-3 py-1.5 bg-surface hover:bg-background border border-textMain/10 rounded-lg text-xs font-bold text-textMuted hover:text-textMain transition-all flex items-center gap-1.5"
                  title="Copy Hash"
                >
                  {copiedHash === entry.hash ? (
                    <>
                      <Check size={13} className="text-emerald-400" /> {t('copied', 'Copied')}
                    </>
                  ) : (
                    <>
                      <Copy size={13} /> {t('copy', 'Copy')}
                    </>
                  )}
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-textMain/10">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-surface hover:bg-background border border-textMain/10 rounded-xl text-sm font-bold text-textMain transition-all"
          >
            {t('close', 'Close')}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
