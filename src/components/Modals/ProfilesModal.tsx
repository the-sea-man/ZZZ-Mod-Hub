import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bookmark,
  X,
  Plus,
  Check,
  Play,
  RotateCw,
  Trash2,
  Download,
  Upload,
  Calendar,
  Layers,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { ModProfile } from '../../types/ipc';

interface ProfilesModalProps {
  onClose: () => void;
}

export function ProfilesModal({ onClose }: ProfilesModalProps) {
  const { t } = useTranslation();
  const {
    profiles,
    activeProfileId,
    activeLibraryTab,
    saveCurrentProfile,
    applyProfile,
    deleteProfile,
    exportProfiles,
    importProfiles,
    showToast,
  } = useAppStore();

  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileDesc, setNewProfileDesc] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [showImportBox, setShowImportBox] = useState(false);

  // Filter profiles for current library tab or show all
  const filteredProfiles = profiles.filter((p) => !p.tab || p.tab === activeLibraryTab);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) return;

    setIsSaving(true);
    try {
      await saveCurrentProfile(newProfileName.trim(), newProfileDesc.trim() || undefined);
      showToast(t('profile_saved_toast', { name: newProfileName }));
      setNewProfileName('');
      setNewProfileDesc('');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApply = async (profile: ModProfile) => {
    setApplyingId(profile.id);
    try {
      await applyProfile(profile.id);
      showToast(t('profile_applied_toast', { name: profile.name }));
    } finally {
      setApplyingId(null);
    }
  };

  const handleOverwrite = async (profile: ModProfile) => {
    await saveCurrentProfile(profile.name, profile.description);
    showToast(t('profile_saved_toast', { name: profile.name }));
  };

  const handleDelete = (profileId: string) => {
    deleteProfile(profileId);
    showToast(t('profile_deleted_toast'));
  };

  const handleExport = async () => {
    const json = exportProfiles();
    await navigator.clipboard.writeText(json);
    showToast(t('profile_export_toast'));
  };

  const handleImportSubmit = () => {
    if (!importText.trim()) return;
    const ok = importProfiles(importText.trim());
    if (ok) {
      showToast(t('profile_import_success', { count: 1 }));
      setImportText('');
      setShowImportBox(false);
    } else {
      showToast(t('profile_import_error'));
    }
  };

  // Keyboard: Escape to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

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
        className="glass-panel w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-primary/20 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-textMain/10 flex items-center justify-between shrink-0 bg-surface/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center shadow-inner">
              <Bookmark size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-textMain">{t('profiles')}</h2>
              <p className="text-xs text-textMuted">{t('profiles_desc')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface/50 text-textMuted hover:text-textMain flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 flex-1">
          {/* Create New Profile Form */}
          <form
            onSubmit={handleSave}
            className="p-5 rounded-2xl bg-surface/40 border border-white/5 space-y-3 shadow-inner"
          >
            <div className="flex items-center gap-2 text-sm font-bold text-textMain">
              <Sparkles size={16} className="text-primary" />
              {t('profile_save_current')}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                placeholder={t('profile_name_placeholder')}
                className="w-full px-4 py-2.5 rounded-xl bg-background/60 border border-white/10 text-textMain placeholder:text-textMuted text-sm font-medium focus:outline-none focus:border-primary/50"
              />
              <input
                type="text"
                value={newProfileDesc}
                onChange={(e) => setNewProfileDesc(e.target.value)}
                placeholder={t('profile_desc_placeholder')}
                className="w-full px-4 py-2.5 rounded-xl bg-background/60 border border-white/10 text-textMain placeholder:text-textMuted text-sm font-medium focus:outline-none focus:border-primary/50"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!newProfileName.trim() || isSaving}
                className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/80 transition-all flex items-center gap-2 shadow-md shadow-primary/20 disabled:opacity-50"
              >
                {isSaving ? <RefreshCw className="animate-spin" size={14} /> : <Plus size={14} />}
                {t('profile_save_btn')}
              </button>
            </div>
          </form>

          {/* Import JSON Expandable Box */}
          <AnimatePresence>
            {showImportBox && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 rounded-2xl bg-surface/50 border border-primary/30 space-y-3"
              >
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Paste profiles JSON here..."
                  rows={4}
                  className="w-full p-3 rounded-xl bg-background/80 border border-white/10 text-textMain font-mono text-xs focus:outline-none focus:border-primary/50 custom-scrollbar"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowImportBox(false)}
                    className="px-3 py-1.5 rounded-lg text-textMuted hover:text-textMain text-xs font-bold"
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleImportSubmit}
                    className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/80"
                  >
                    {t('profile_import')}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Profiles List */}
          <div className="space-y-3">
            {filteredProfiles.length === 0 ? (
              <div className="text-center py-10 text-textMuted space-y-2">
                <Layers size={36} className="mx-auto opacity-40" />
                <p className="text-sm font-bold">{t('profile_none')}</p>
                <p className="text-xs opacity-70">
                  Save your current enabled mods as a preset using the form above.
                </p>
              </div>
            ) : (
              filteredProfiles.map((prof) => {
                const isActive = activeProfileId === prof.id;
                const isCurrentlyApplying = applyingId === prof.id;

                return (
                  <div
                    key={prof.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                      isActive
                        ? 'bg-primary/10 border-primary/40 shadow-lg shadow-primary/5'
                        : 'bg-surface/30 border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-textMain text-sm truncate">
                          {prof.name}
                        </span>
                        {isActive && (
                          <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                            <Check size={10} />
                            {t('profile_active')}
                          </span>
                        )}
                      </div>
                      {prof.description && (
                        <p className="text-xs text-textMuted truncate">{prof.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-[11px] text-textMuted opacity-80 pt-0.5">
                        <span className="flex items-center gap-1">
                          <Layers size={12} />
                          {prof.enabledModRelativePaths.length} mods
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {new Date(prof.updatedAt || prof.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        onClick={() => handleApply(prof)}
                        disabled={isCurrentlyApplying}
                        className="px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/80 transition-all flex items-center gap-1.5 shadow-sm shadow-primary/20 disabled:opacity-50"
                        title={t('profile_apply')}
                      >
                        {isCurrentlyApplying ? (
                          <RefreshCw className="animate-spin" size={13} />
                        ) : (
                          <Play size={13} />
                        )}
                        {t('profile_apply')}
                      </button>

                      <button
                        onClick={() => handleOverwrite(prof)}
                        className="p-2 rounded-xl bg-surface/60 hover:bg-surface text-textMuted hover:text-textMain border border-white/5 text-xs transition-colors"
                        title={t('profile_overwrite')}
                      >
                        <RotateCw size={14} />
                      </button>

                      <button
                        onClick={() => handleDelete(prof.id)}
                        className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs transition-colors"
                        title={t('profile_delete')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-textMain/10 flex items-center justify-between bg-surface/50 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="px-3 py-1.5 rounded-xl bg-surface/60 hover:bg-surface text-textMuted hover:text-textMain border border-white/5 text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <Download size={13} />
              {t('profile_export')}
            </button>
            <button
              onClick={() => setShowImportBox(!showImportBox)}
              className="px-3 py-1.5 rounded-xl bg-surface/60 hover:bg-surface text-textMuted hover:text-textMain border border-white/5 text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <Upload size={13} />
              {t('profile_import')}
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-surface/80 hover:bg-surface text-textMain text-xs font-bold transition-colors border border-white/10"
          >
            {t('close')}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
