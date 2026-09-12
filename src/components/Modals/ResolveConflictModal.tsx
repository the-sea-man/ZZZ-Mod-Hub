import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import { motion } from 'framer-motion';
import { ShieldAlert, Folder, Package, Sparkles } from 'lucide-react';
import { ModInfo, CategoryInfo } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';

export interface ResolveConflictModalProps {
  mod: ModInfo;
  categories: CategoryInfo[];
  rootPath: string;
  onClose: () => void;
  onSaved: () => void;
}

export function ResolveConflictModal({
  mod,
  categories,
  rootPath,
  onClose,
  onSaved,
}: ResolveConflictModalProps) {
  const { t } = useTranslation();
  const [action, setAction] = useState<'replace' | 'rename' | 'delete'>('replace');
  const [newName, setNewName] = useState(
    mod.name.replace(/^(DISABLED_|DISABLED )/, '').split('_conflict_')[0] + '_v2'
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [originalMeta, setOriginalMeta] = useState<any>(null);
  const [newMeta, setNewMeta] = useState<any>(null);

  const rawBaseName = useMemo(() => {
    return mod.name.replace(/^(DISABLED_|DISABLED )/, '').split('_conflict_')[0];
  }, [mod.name]);

  const originalInfo = useMemo(() => {
    for (const cat of categories) {
      if (cat.category_name === '_Conflicts') continue;
      const original = cat.mods.find(
        (m) => m.name.replace(/^(DISABLED_|DISABLED )/, '') === rawBaseName
      );
      if (original) {
        return { mod: original, categoryName: cat.category_name };
      }
    }
    return null;
  }, [rawBaseName, categories]);

  useEffect(() => {
    invoke('get_mod_metadata', { modPath: mod.full_path }).then(setNewMeta).catch(console.error);

    if (originalInfo) {
      invoke('get_mod_metadata', { modPath: originalInfo.mod.full_path })
        .then(setOriginalMeta)
        .catch(console.error);
    }
  }, [mod.full_path, originalInfo]);

  const handleSave = async () => {
    if (!originalInfo) {
      setError('Could not locate original mod category to resolve conflict.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await invoke('resolve_conflict', {
        modPath: mod.full_path,
        action,
        newName: action === 'rename' ? newName.trim() : null,
        targetCategory: originalInfo.categoryName,
        rootPath,
      });
      onSaved();
    } catch (e: any) {
      setError(e.toString());
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp * 1000).toLocaleString();
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
        className="glass-panel w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl border border-yellow-500/30 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 bg-yellow-500/10 border-b border-yellow-500/20 shrink-0">
          <h2 className="text-2xl font-black text-yellow-400 mb-1 flex items-center gap-2">
            <ShieldAlert size={28} /> {t('resolve_conflict_title')}
          </h2>
          <p className="text-textMuted text-sm">
            {t('resolve_conflict_subtitle', { name: rawBaseName })}
          </p>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          <div className="flex gap-4">
            <div className="flex-1 bg-background/50 border border-textMain/10 rounded-xl p-5 flex flex-col">
              <div className="text-xs font-bold text-textMuted uppercase tracking-wider mb-3 flex items-center gap-2">
                <Folder size={16} /> {t('existing_mod')}
              </div>
              {originalInfo ? (
                <>
                  <div className="font-bold text-textMain break-all text-lg leading-tight mb-3">
                    {originalInfo.mod.name.replace(/^(DISABLED_|DISABLED )/, '')}
                  </div>
                  <div className="text-xs mb-4 flex gap-2">
                    <span className="bg-surface px-2 py-1 rounded text-textMuted border border-textMain/5">
                      {originalInfo.categoryName}
                    </span>
                    <span
                      className={`px-2 py-1 rounded border font-bold ${
                        originalInfo.mod.is_enabled
                          ? 'bg-primary/20 text-primary border-primary/30'
                          : 'bg-red-500/20 text-red-400 border-red-500/30'
                      }`}
                    >
                      {originalInfo.mod.is_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>

                  <div className="mt-auto space-y-2 text-sm bg-surface p-3 rounded-lg border border-textMain/5">
                    {originalMeta?.version_string && (
                      <div className="flex justify-between pb-1 border-b border-textMain/5 mb-1">
                        <span className="text-textMuted font-bold">Version:</span>
                        <span className="font-bold text-primary text-right">
                          {originalMeta.version_string}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-textMuted">Size:</span>
                      <span className="font-medium text-textMain">
                        {originalMeta ? formatSize(originalMeta.total_size_bytes) : 'Loading...'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-textMuted">Files:</span>
                      <span className="font-medium text-textMain">
                        {originalMeta ? originalMeta.file_count : 'Loading...'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span
                        className="text-textMuted"
                        title="Date the mod author last updated any file in this mod"
                      >
                        Last Edit:
                      </span>
                      <span className="font-medium text-textMain text-right">
                        {originalMeta ? formatDate(originalMeta.last_modified) : 'Loading...'}
                      </span>
                    </div>
                    {originalMeta?.ini_last_modified && (
                      <div className="flex justify-between pt-1 border-t border-textMain/5 mt-1">
                        <span
                          className="text-textMuted"
                          title="Date the main .ini file was last updated"
                        >
                          INI Edit:
                        </span>
                        <span className="font-medium text-textMain text-right">
                          {formatDate(originalMeta.ini_last_modified)}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-red-400 text-sm">{t('original_mod_not_found')}</div>
              )}
            </div>

            <div className="flex items-center justify-center text-textMuted/30 text-3xl font-black px-2 relative">
              VS
              {originalMeta?.fingerprint &&
                newMeta?.fingerprint &&
                originalMeta.fingerprint === newMeta.fingerprint && (
                  <div className="absolute top-12 left-1/2 -translate-x-1/2 whitespace-nowrap bg-primary/20 text-primary px-3 py-1 rounded-full text-xs font-bold border border-primary/30 shadow-lg shadow-primary/20 z-10 flex items-center gap-1.5">
                    <Sparkles size={14} /> {t('identical_files')}
                  </div>
                )}
            </div>

            <div className="flex-1 bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-5 relative overflow-hidden flex flex-col">
              <div className="absolute top-0 right-0 w-20 h-20 bg-yellow-500/10 rounded-bl-full pointer-events-none" />
              <div className="text-xs font-bold text-yellow-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Package size={16} /> {t('new_mod')}
              </div>
              <div className="font-bold text-textMain break-all text-lg leading-tight mb-3">
                {rawBaseName}
              </div>
              <div className="text-xs mb-4 flex gap-2">
                <span className="bg-surface px-2 py-1 rounded text-textMuted border border-textMain/5">
                  _Conflicts
                </span>
                <span className="bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded border border-yellow-500/30 font-bold">
                  Quarantined
                </span>
              </div>

              <div className="mt-auto space-y-2 text-sm bg-background/50 p-3 rounded-lg border border-yellow-500/10">
                {newMeta?.version_string && (
                  <div className="flex justify-between pb-1 border-b border-yellow-500/10 mb-1">
                    <span className="text-textMuted font-bold">Version:</span>
                    <span className="font-bold text-yellow-500 text-right">
                      {newMeta.version_string}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-textMuted">Size:</span>
                  <span className="font-medium text-textMain">
                    {newMeta ? formatSize(newMeta.total_size_bytes) : 'Loading...'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-textMuted">Files:</span>
                  <span className="font-medium text-textMain">
                    {newMeta ? newMeta.file_count : 'Loading...'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span
                    className="text-textMuted"
                    title="Date the mod author last updated any file in this mod"
                  >
                    Last Edit:
                  </span>
                  <span className="font-medium text-textMain text-right">
                    {newMeta ? formatDate(newMeta.last_modified) : 'Loading...'}
                  </span>
                </div>
                {newMeta?.ini_last_modified && (
                  <div className="flex justify-between pt-1 border-t border-yellow-500/10 mt-1">
                    <span
                      className="text-textMuted"
                      title="Date the main .ini file was last updated"
                    >
                      INI Edit:
                    </span>
                    <span className="font-medium text-textMain text-right">
                      {formatDate(newMeta.ini_last_modified)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <h3 className="font-black text-textMain">{t('resolve_conflict_prompt')}</h3>

            <label
              className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                action === 'replace'
                  ? 'bg-primary/10 border-primary shadow-lg shadow-primary/10'
                  : 'bg-background/50 border-textMain/10 hover:bg-surface'
              }`}
            >
              <input
                type="radio"
                checked={action === 'replace'}
                onChange={() => setAction('replace')}
                className="mt-1"
              />
              <div>
                <div className="font-bold text-textMain">{t('replace_existing_mod')}</div>
                <div className="text-sm text-textMuted mt-1">
                  {t('replace_existing_mod_desc', { category: originalInfo?.categoryName || '' })}
                </div>
              </div>
            </label>

            <label
              className={`flex flex-col gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                action === 'rename'
                  ? 'bg-primary/10 border-primary shadow-lg shadow-primary/10'
                  : 'bg-background/50 border-textMain/10 hover:bg-surface'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  checked={action === 'rename'}
                  onChange={() => setAction('rename')}
                  className="mt-1"
                />
                <div>
                  <div className="font-bold text-textMain">{t('keep_both_rename')}</div>
                  <div className="text-sm text-textMuted mt-1">{t('keep_both_rename_desc')}</div>
                </div>
              </div>
              {action === 'rename' && (
                <div className="ml-7 flex items-center gap-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="bg-background border border-textMain/10 rounded-lg px-3 py-2 text-sm text-textMain focus:outline-none focus:border-primary/50 flex-1 max-w-[200px]"
                    onClick={(e) => e.stopPropagation()}
                    placeholder={t('new_folder_name_placeholder')}
                  />
                  <span className="text-xs text-textMuted">
                    {t('will_be_moved_to', { category: originalInfo?.categoryName || '' })}
                  </span>
                </div>
              )}
            </label>

            <label
              className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                action === 'delete'
                  ? 'bg-red-500/10 border-red-500 shadow-lg shadow-red-500/10'
                  : 'bg-background/50 border-textMain/10 hover:bg-surface'
              }`}
            >
              <input
                type="radio"
                checked={action === 'delete'}
                onChange={() => setAction('delete')}
                className="mt-1"
              />
              <div>
                <div className="font-bold text-red-400">{t('discard_new_mod')}</div>
                <div className="text-sm text-textMuted mt-1">{t('discard_new_mod_desc')}</div>
              </div>
            </label>
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-400/10 p-3 rounded-xl border border-red-400/20">
              {error}
            </p>
          )}
        </div>

        <div className="flex bg-surface/50 p-4 gap-3 border-t border-textMain/10 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-bold text-textMain hover:bg-background transition-colors border border-transparent cursor-pointer"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={isSubmitting || !originalInfo || (action === 'rename' && !newName.trim())}
            className={`flex-1 py-3 rounded-xl font-bold text-white transition-colors disabled:opacity-50 cursor-pointer ${
              action === 'delete' ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary/80'
            }`}
          >
            {isSubmitting ? t('applying') : t('apply_resolution')}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
