import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe,
  X,
  Plus,
  Check,
  Download,
  Upload,
  FolderOpen,
  Edit3,
  Trash2,
  Search,
  Save,
  ArrowLeft,
  Sparkles,
  Info,
} from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import {
  saveCustomLanguagePack,
  deleteCustomLanguagePack,
  loadCustomLanguagePacks,
  BUILTIN_LANGUAGES,
} from '../../i18n';
import en from '../../locales/en.json';
import i18n from '../../i18n';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile, exists, mkdir } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';
import {
  generateLanguagePack,
  autoFillMissingKeys,
  WORLD_LANGUAGES,
} from '../../services/translator';
import { TranslationProgressModal } from './TranslationProgressModal';
import { useRef } from 'react';

interface LanguageManagerModalProps {
  onClose: () => void;
}

export function LanguageManagerModal({ onClose }: LanguageManagerModalProps) {
  const { t } = useTranslation();
  const { language, setLanguage, availableLanguages, showToast } = useAppStore();

  const [activeTab, setActiveTab] = useState<'overview' | 'editor'>('overview');
  const [editingLangCode, setEditingLangCode] = useState<string>('');
  const [editingLangName, setEditingLangName] = useState<string>('');
  const [editingStrings, setEditingStrings] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'missing' | 'completed'>('all');
  const [isSaving, setIsSaving] = useState(false);

  // New Language Creation State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newLangName, setNewLangName] = useState('');
  const [newLangCode, setNewLangCode] = useState('');
  const [baseLangSource, setBaseLangSource] = useState('en');
  const [autoTranslateNewLang, setAutoTranslateNewLang] = useState(true);
  const [selectedWorldLang, setSelectedWorldLang] = useState('');

  // Translation Progress Modal State
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatingTarget, setTranslatingTarget] = useState<{ code: string; name: string } | null>(
    null
  );
  const [progressPct, setProgressPct] = useState(0);
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Keyboard: Escape to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // All master English keys
  const masterKeys = useMemo(() => Object.keys(en), []);

  // Compute completion stats for a language
  const getLanguageStats = (code: string) => {
    const bundle = i18n.getResourceBundle(code, 'translation') || {};
    let translatedCount = 0;
    const totalKeys = masterKeys.length;

    for (const key of masterKeys) {
      if (bundle[key] && bundle[key].trim().length > 0) {
        translatedCount++;
      }
    }

    const percentage = totalKeys > 0 ? Math.round((translatedCount / totalKeys) * 100) : 0;
    return { translatedCount, totalKeys, percentage };
  };

  // Open the in-app editor for a specific language
  const handleOpenEditor = (code: string, name: string) => {
    const bundle = i18n.getResourceBundle(code, 'translation') || {};
    const initialStrings: Record<string, string> = {};

    for (const key of masterKeys) {
      initialStrings[key] = bundle[key] || '';
    }

    setEditingLangCode(code);
    setEditingLangName(bundle.language_name || name);
    setEditingStrings(initialStrings);
    setActiveTab('editor');
    setSearchQuery('');
    setFilterMode('all');
  };

  // Handle Save in Editor
  const handleSaveEditor = async () => {
    if (!editingLangCode) return;
    setIsSaving(true);
    try {
      const success = await saveCustomLanguagePack(
        editingLangCode,
        editingLangName,
        editingStrings
      );
      if (success) {
        showToast(t('language_saved_success', { name: editingLangName }));
        await loadCustomLanguagePacks();
      } else {
        showToast(t('language_saved_error'));
      }
    } catch (e) {
      console.error(e);
      showToast(t('language_saved_error'));
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel current translation
  const handleCancelTranslation = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsTranslating(false);
    setTranslatingTarget(null);
    setTranslationError(null);
  };

  // Retry failed translation
  const handleRetryTranslation = () => {
    if (translatingTarget) {
      if (activeTab === 'editor') {
        handleAutoFillMissing();
      } else {
        startTranslatingPack(translatingTarget.code, translatingTarget.name);
      }
    }
  };

  // Start batch translating full pack
  const startTranslatingPack = async (code: string, name: string) => {
    setTranslatingTarget({ code, name });
    setProgressPct(0);
    setProgressCurrent(0);
    setProgressTotal(0);
    setTranslationError(null);
    setIsTranslating(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = await generateLanguagePack(
        code,
        name,
        (pct, current, total) => {
          setProgressPct(pct);
          setProgressCurrent(current);
          setProgressTotal(total);
        },
        controller.signal
      );

      if (result.success) {
        await loadCustomLanguagePacks();
        await i18n.changeLanguage(result.code);
        setLanguage(result.code);
        setIsTranslating(false);
        setTranslatingTarget(null);
        showToast(t('language_created_success', { name }));
        handleOpenEditor(code, name);
      } else {
        setTranslationError(t('language_created_error'));
      }
    } catch (err: any) {
      if (controller.signal.aborted) {
        showToast(t('translation_cancelled'));
        setIsTranslating(false);
        setTranslatingTarget(null);
      } else {
        console.error('Translation error:', err);
        setTranslationError(err?.message || t('network_required_translation'));
      }
    }
  };

  // Quick translate handler from World Languages dropdown
  const handleQuickTranslate = async (code: string) => {
    if (!code) return;
    const item = WORLD_LANGUAGES.find((l) => l.code === code);
    if (!item) return;

    // Check if already installed
    const alreadyInstalled = availableLanguages.some(
      (l) => l.code.toLowerCase() === code.toLowerCase()
    );
    if (alreadyInstalled) {
      await i18n.changeLanguage(code);
      setLanguage(code);
      showToast(t('language_installed_success', { name: item.nativeName }));
      return;
    }

    startTranslatingPack(item.code, item.nativeName);
  };

  // Auto-fill missing strings in current editor
  const handleAutoFillMissing = async () => {
    if (!editingLangCode) return;
    setTranslatingTarget({ code: editingLangCode, name: editingLangName });
    setProgressPct(0);
    setProgressCurrent(0);
    setProgressTotal(0);
    setTranslationError(null);
    setIsTranslating(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const updated = await autoFillMissingKeys(
        editingLangCode,
        editingStrings,
        (pct, current, total) => {
          setProgressPct(pct);
          setProgressCurrent(current);
          setProgressTotal(total);
        },
        controller.signal
      );

      setEditingStrings(updated);
      setIsTranslating(false);
      setTranslatingTarget(null);
      showToast(t('auto_fill_success', { count: Object.keys(updated).length }));
    } catch (err: any) {
      if (controller.signal.aborted) {
        showToast(t('translation_cancelled'));
        setIsTranslating(false);
        setTranslatingTarget(null);
      } else {
        console.error('Auto-fill error:', err);
        setTranslationError(err?.message || t('network_required_translation'));
      }
    }
  };

  // Handle Create Language
  const handleCreateLanguage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLangName.trim() || !newLangCode.trim()) return;

    const cleanCode = newLangCode
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]/g, '_');

    if (autoTranslateNewLang) {
      setShowCreateForm(false);
      const name = newLangName.trim();
      setNewLangName('');
      setNewLangCode('');
      setSelectedWorldLang('');
      startTranslatingPack(cleanCode, name);
      return;
    }

    const sourceBundle = i18n.getResourceBundle(baseLangSource, 'translation') || en;
    const initialTranslations: Record<string, string> = { ...sourceBundle };

    const success = await saveCustomLanguagePack(
      cleanCode,
      newLangName.trim(),
      initialTranslations
    );

    if (success) {
      showToast(t('language_created_success', { name: newLangName }));
      setShowCreateForm(false);
      setNewLangName('');
      setNewLangCode('');
      setSelectedWorldLang('');
      await loadCustomLanguagePacks();
      handleOpenEditor(cleanCode, newLangName.trim());
    } else {
      showToast(t('language_created_error'));
    }
  };

  // Handle Import JSON
  const handleImportLanguage = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'JSON Language Pack', extensions: ['json'] }],
      });

      if (!selected || typeof selected !== 'string') return;

      const fileContent = await readTextFile(selected);
      const json = JSON.parse(fileContent);

      const fileName = selected.split(/[\\/]/).pop()?.replace('.json', '') || 'custom';
      const langCode = json.language_code || fileName.toLowerCase();
      const langName = json.language_name || fileName.toUpperCase();

      const success = await saveCustomLanguagePack(langCode, langName, json);
      if (success) {
        showToast(t('language_import_success', { name: langName }));
        await loadCustomLanguagePacks();
        setLanguage(langCode);
      } else {
        showToast(t('language_import_error'));
      }
    } catch (e) {
      console.error('Import failed:', e);
      showToast(t('language_import_error'));
    }
  };

  // Handle Export JSON
  const handleExportLanguage = async (code: string, name: string) => {
    try {
      const bundle = i18n.getResourceBundle(code, 'translation') || en;
      const exportData = {
        language_name: name,
        language_code: code,
        ...bundle,
      };

      const savePath = await save({
        defaultPath: `${code}.json`,
        filters: [{ name: 'JSON Language Pack', extensions: ['json'] }],
      });

      if (!savePath) return;

      await writeTextFile(savePath, JSON.stringify(exportData, null, 2));
      showToast(t('language_export_success', { name }));
    } catch (e) {
      console.error('Export failed:', e);
      showToast(t('language_export_error'));
    }
  };

  // Handle Delete Language
  const handleDeleteLanguage = async (code: string, name: string) => {
    if (confirm(t('language_delete_confirm', { name }))) {
      const success = await deleteCustomLanguagePack(code);
      if (success) {
        showToast(t('language_delete_success', { name }));
      }
    }
  };

  // Open Locales Folder
  const handleOpenLocalesFolder = async () => {
    try {
      const baseDir = await appDataDir();
      const localesPath = await join(baseDir, 'locales');

      if (!(await exists(localesPath))) {
        await mkdir(localesPath, { recursive: true });
      }

      await invoke('open_folder', { path: localesPath });
    } catch (e) {
      console.error(e);
    }
  };

  // Filtered keys for editor
  const filteredEditorKeys = useMemo(() => {
    return masterKeys.filter((key) => {
      const enText = (en as Record<string, string>)[key] || '';
      const currentTranslation = editingStrings[key] || '';

      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesKey = key.toLowerCase().includes(q);
        const matchesEn = enText.toLowerCase().includes(q);
        const matchesVal = currentTranslation.toLowerCase().includes(q);
        if (!matchesKey && !matchesEn && !matchesVal) return false;
      }

      // Filter status
      if (filterMode === 'completed') {
        return currentTranslation.trim().length > 0;
      }
      if (filterMode === 'missing') {
        return (
          !currentTranslation || currentTranslation.trim() === '' || currentTranslation === enText
        );
      }

      return true;
    });
  }, [masterKeys, editingStrings, searchQuery, filterMode]);

  return (
    <>
      {createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-4xl max-h-[88vh] flex flex-col bg-surface/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden glass-panel"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/20 text-primary border border-primary/30">
                  <Globe size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-textMain flex items-center gap-2">
                    {t('language_hub_title')}
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-normal">
                      i18n
                    </span>
                  </h2>
                  <p className="text-xs text-textMuted">{t('language_hub_desc')}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-textMuted hover:text-textMain rounded-xl hover:bg-white/5 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'overview' ? (
                <div className="space-y-6">
                  {/* Action Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-background/50 border border-white/5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* World Languages (Google Translate) Quick Dropdown */}
                      <div className="relative flex items-center">
                        <Globe
                          size={14}
                          className="absolute left-3 text-primary pointer-events-none"
                        />
                        <select
                          value=""
                          onChange={(e) => {
                            const code = e.target.value;
                            if (code) {
                              handleQuickTranslate(code);
                            }
                          }}
                          className="pl-8 pr-4 py-2 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-xl text-xs font-bold text-primary focus:outline-none focus:border-primary cursor-pointer transition-colors shadow-sm"
                        >
                          <option value="" className="bg-surface text-textMain">
                            🌐 {t('choose_other_language')}
                          </option>
                          {WORLD_LANGUAGES.map((l) => (
                            <option
                              key={l.code}
                              value={l.code}
                              className="bg-surface text-textMain"
                            >
                              {l.flag} {l.nativeName} ({l.name}) [{l.code}]
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        onClick={() => setShowCreateForm(true)}
                        className="flex items-center gap-2 px-3.5 py-2 bg-white/5 hover:bg-white/10 text-textMain rounded-xl text-xs font-semibold border border-white/10 transition-colors"
                      >
                        <Plus size={14} />
                        {t('create_new_language')}
                      </button>
                      <button
                        onClick={handleImportLanguage}
                        className="flex items-center gap-2 px-3.5 py-2 bg-white/5 hover:bg-white/10 text-textMain rounded-xl text-xs font-semibold border border-white/10 transition-colors"
                      >
                        <Upload size={14} />
                        {t('import_language')}
                      </button>
                    </div>
                    <button
                      onClick={handleOpenLocalesFolder}
                      className="flex items-center gap-2 px-3.5 py-2 bg-white/5 hover:bg-white/10 text-primary rounded-xl text-xs font-semibold border border-primary/20 hover:border-primary/40 transition-colors ml-auto"
                    >
                      <FolderOpen size={14} />
                      {t('open_locales_folder')}
                    </button>
                  </div>

                  {/* Create Form Drawer */}
                  <AnimatePresence>
                    {showCreateForm && (
                      <motion.form
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        onSubmit={handleCreateLanguage}
                        className="p-4 rounded-xl bg-primary/10 border border-primary/30 space-y-4 overflow-hidden"
                      >
                        <div className="flex justify-between items-center">
                          <h4 className="text-sm font-bold text-textMain flex items-center gap-2">
                            <Sparkles size={16} className="text-primary" />
                            {t('create_language_title')}
                          </h4>
                          <button
                            type="button"
                            onClick={() => {
                              setShowCreateForm(false);
                              setSelectedWorldLang('');
                            }}
                            className="text-textMuted hover:text-textMain"
                          >
                            <X size={16} />
                          </button>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-textMuted mb-1">
                            {t('choose_other_language')}
                          </label>
                          <select
                            value={selectedWorldLang}
                            onChange={(e) => {
                              const code = e.target.value;
                              setSelectedWorldLang(code);
                              const item = WORLD_LANGUAGES.find((l) => l.code === code);
                              if (item) {
                                setNewLangName(item.nativeName);
                                setNewLangCode(item.code);
                              }
                            }}
                            className="w-full px-3 py-2 bg-background/80 border border-white/10 rounded-xl text-xs text-textMain focus:outline-none focus:border-primary"
                          >
                            <option value="">{t('select_world_language_placeholder')}</option>
                            {WORLD_LANGUAGES.map((l) => (
                              <option
                                key={l.code}
                                value={l.code}
                                className="bg-surface text-textMain"
                              >
                                {l.flag} {l.nativeName} ({l.name}) [{l.code}]
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-textMuted mb-1">
                              {t('language_name_label')}
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Español, 日本語"
                              value={newLangName}
                              onChange={(e) => setNewLangName(e.target.value)}
                              className="w-full px-3 py-2 bg-background/80 border border-white/10 rounded-xl text-xs text-textMain focus:outline-none focus:border-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-textMuted mb-1">
                              {t('language_code_label')}
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. es, ja, fr"
                              value={newLangCode}
                              onChange={(e) => setNewLangCode(e.target.value)}
                              className="w-full px-3 py-2 bg-background/80 border border-white/10 rounded-xl text-xs text-textMain focus:outline-none focus:border-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-textMuted mb-1">
                              {t('base_template_label')}
                            </label>
                            <select
                              value={baseLangSource}
                              onChange={(e) => setBaseLangSource(e.target.value)}
                              className="w-full px-3 py-2 bg-background/80 border border-white/10 rounded-xl text-xs text-textMain focus:outline-none focus:border-primary"
                            >
                              <option value="en">English (Master)</option>
                              <option value="pt_BR">Português (Brasil)</option>
                              <option value="zh">简体中文</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1 px-1">
                          <input
                            type="checkbox"
                            id="autoTranslateCheck"
                            checked={autoTranslateNewLang}
                            onChange={(e) => setAutoTranslateNewLang(e.target.checked)}
                            className="rounded border-white/20 bg-background/80 text-primary focus:ring-primary focus:ring-offset-0"
                          />
                          <label
                            htmlFor="autoTranslateCheck"
                            className="text-xs text-textMain cursor-pointer select-none flex items-center gap-1.5"
                          >
                            <Globe size={13} className="text-primary" />
                            {t('auto_translate_create_option')}
                          </label>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowCreateForm(false);
                              setSelectedWorldLang('');
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs text-textMuted hover:bg-white/5"
                          >
                            {t('cancel')}
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-1.5 bg-primary text-background font-bold rounded-lg text-xs hover:opacity-90"
                          >
                            {t('create_and_edit')}
                          </button>
                        </div>
                      </motion.form>
                    )}
                  </AnimatePresence>

                  {/* Languages List */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-textMuted">
                      {t('installed_languages_header')}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {availableLanguages.map((lang) => {
                        const isBuiltin = BUILTIN_LANGUAGES.some((b) => b.code === lang.code);
                        const isActive = language === lang.code;
                        const stats = getLanguageStats(lang.code);

                        return (
                          <div
                            key={lang.code}
                            className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                              isActive
                                ? 'bg-primary/10 border-primary/40 shadow-lg shadow-primary/5'
                                : 'bg-background/40 border-white/5 hover:border-white/10'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-textMain">
                                    {lang.name}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded uppercase font-mono bg-white/10 text-textMuted">
                                    {lang.code}
                                  </span>
                                  {isBuiltin ? (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-semibold">
                                      {t('builtin_badge')}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold">
                                      {t('custom_pack_badge')}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-primary"
                                      style={{ width: `${stats.percentage}%` }}
                                    />
                                  </div>
                                  <span className="text-[11px] text-textMuted">
                                    {stats.percentage}% ({stats.translatedCount}/{stats.totalKeys})
                                  </span>
                                </div>
                              </div>

                              {isActive && (
                                <span className="flex items-center gap-1 text-xs font-bold text-primary bg-primary/20 px-2 py-1 rounded-lg">
                                  <Check size={12} /> {t('active_language')}
                                </span>
                              )}
                            </div>

                            {/* Card Actions */}
                            <div className="flex items-center justify-between pt-3 border-t border-white/5 gap-2">
                              <div className="flex items-center gap-1.5">
                                {!isActive && (
                                  <button
                                    onClick={() => setLanguage(lang.code)}
                                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-textMain rounded-lg text-xs font-semibold transition-colors"
                                  >
                                    {t('select_language')}
                                  </button>
                                )}
                                <button
                                  onClick={() => handleOpenEditor(lang.code, lang.name)}
                                  className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-textMuted hover:text-textMain rounded-lg text-xs flex items-center gap-1 transition-colors"
                                  title="Edit in Visual Translator"
                                >
                                  <Edit3 size={12} />
                                  {t('edit_translations')}
                                </button>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleExportLanguage(lang.code, lang.name)}
                                  className="p-1.5 text-textMuted hover:text-textMain hover:bg-white/5 rounded-lg transition-colors"
                                  title="Export .json"
                                >
                                  <Download size={14} />
                                </button>
                                {!isBuiltin && (
                                  <button
                                    onClick={() => handleDeleteLanguage(lang.code, lang.name)}
                                    className="p-1.5 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                    title="Delete Custom Language"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                /* Visual Translation Editor Tab */
                <div className="space-y-4">
                  {/* Editor Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-background/50 border border-white/5">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setActiveTab('overview')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-textMain rounded-xl text-xs font-semibold transition-colors"
                      >
                        <ArrowLeft size={14} />
                        {t('back_to_languages')}
                      </button>
                      <div className="border-l border-white/10 pl-3">
                        <span className="text-xs text-textMuted block">
                          {t('editing_language_pack')}
                        </span>
                        <input
                          type="text"
                          value={editingLangName}
                          onChange={(e) => setEditingLangName(e.target.value)}
                          className="text-sm font-bold text-textMain bg-transparent border-b border-dashed border-white/20 focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleAutoFillMissing}
                        disabled={isSaving || isTranslating}
                        className="flex items-center gap-2 px-3.5 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 font-bold rounded-xl transition-all text-xs shadow-lg shadow-emerald-500/10 disabled:opacity-50"
                      >
                        <Sparkles size={14} />
                        {t('auto_fill_missing')}
                      </button>
                      <button
                        onClick={handleSaveEditor}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-background font-bold rounded-xl hover:opacity-90 transition-all text-xs shadow-lg shadow-primary/20 disabled:opacity-50"
                      >
                        <Save size={14} />
                        {isSaving ? t('saving') : t('save_changes')}
                      </button>
                    </div>
                  </div>

                  {/* Search & Filter Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="relative flex-1 min-w-[240px]">
                      <Search
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted"
                      />
                      <input
                        type="text"
                        placeholder={t('search_keys_or_text')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-background/60 border border-white/10 rounded-xl text-xs text-textMain focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div className="flex items-center gap-1 bg-background/60 p-1 rounded-xl border border-white/5">
                      <button
                        onClick={() => setFilterMode('all')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          filterMode === 'all'
                            ? 'bg-primary/20 text-primary'
                            : 'text-textMuted hover:text-textMain'
                        }`}
                      >
                        {t('filter_all')} ({masterKeys.length})
                      </button>
                      <button
                        onClick={() => setFilterMode('missing')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          filterMode === 'missing'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'text-textMuted hover:text-textMain'
                        }`}
                      >
                        {t('filter_needs_review')}
                      </button>
                      <button
                        onClick={() => setFilterMode('completed')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          filterMode === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'text-textMuted hover:text-textMain'
                        }`}
                      >
                        {t('filter_translated')}
                      </button>
                    </div>
                  </div>

                  {/* Translation Rows */}
                  <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                    {filteredEditorKeys.length === 0 ? (
                      <div className="p-8 text-center text-textMuted text-xs rounded-xl bg-background/30 border border-white/5">
                        {t('no_matching_keys')}
                      </div>
                    ) : (
                      filteredEditorKeys.map((key) => {
                        const enText = (en as Record<string, string>)[key] || '';
                        const currentVal = editingStrings[key] ?? '';

                        return (
                          <div
                            key={key}
                            className="p-3 rounded-xl bg-background/40 border border-white/5 hover:border-white/10 transition-colors grid grid-cols-1 md:grid-cols-2 gap-3"
                          >
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[11px] font-mono text-primary/80 select-all">
                                  {key}
                                </span>
                              </div>
                              <p className="text-xs text-textMuted bg-black/20 p-2 rounded-lg border border-white/5 font-sans select-all">
                                {enText}
                              </p>
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase tracking-wider text-textMuted mb-1 font-bold">
                                {t('your_translation')}
                              </label>
                              <textarea
                                rows={2}
                                value={currentVal}
                                placeholder={enText}
                                onChange={(e) =>
                                  setEditingStrings((prev) => ({
                                    ...prev,
                                    [key]: e.target.value,
                                  }))
                                }
                                className="w-full px-2.5 py-1.5 bg-background/80 border border-white/10 rounded-lg text-xs text-textMain focus:outline-none focus:border-primary resize-none"
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer info note */}
            <div className="px-6 py-3 border-t border-white/10 bg-white/5 flex items-center justify-between text-xs text-textMuted">
              <div className="flex items-center gap-1.5">
                <Info size={14} className="text-primary" />
                <span>{t('language_hub_footer_note')}</span>
              </div>
              <button
                onClick={onClose}
                className="px-4 py-1.5 bg-white/5 hover:bg-white/10 text-textMain rounded-lg text-xs font-semibold transition-colors"
              >
                {t('close')}
              </button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      <TranslationProgressModal
        isOpen={isTranslating}
        targetLanguageName={translatingTarget?.name || ''}
        percentage={progressPct}
        currentDone={progressCurrent}
        totalCount={progressTotal}
        onCancel={handleCancelTranslation}
        error={translationError}
        onRetry={handleRetryTranslation}
      />
    </>
  );
}
