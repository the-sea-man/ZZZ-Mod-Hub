import { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { Globe, Check, Plus, ShieldCheck, Search, X, ArrowRight } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import {
  detectSystemLanguage,
  generateLanguagePack,
  WORLD_LANGUAGES,
  type WorldLanguage,
  type DetectedLanguageInfo,
} from '../services/translator';
import i18n, { BUILTIN_LANGUAGES, loadCustomLanguagePacks, isBuiltinLanguage } from '../i18n';
import { TranslationProgressModal } from '../components/Modals/TranslationProgressModal';
import { Modal } from '../components/ui/Modal';

export function LanguageSelectView() {
  const { availableLanguages, setLanguage, setHasSelectedLanguage, language, showToast } =
    useAppStore();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<'official' | 'community'>('official');
  const [detectedLang, setDetectedLang] = useState<DetectedLanguageInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Translation Progress State
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatingTarget, setTranslatingTarget] = useState<{ code: string; name: string } | null>(
    null
  );
  const [progressPct, setProgressPct] = useState(0);
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Custom / Full Language Dialog State
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customCode, setCustomCode] = useState('');
  const [customName, setCustomName] = useState('');

  // Detect system language on mount
  useEffect(() => {
    try {
      const detected = detectSystemLanguage();
      setDetectedLang(detected);

      // If user hasn't explicitly picked a language and system is built-in (e.g. pt_BR), pre-select it
      if (detected.isBuiltin && language === 'en' && detected.matchedCode !== 'en') {
        i18n.changeLanguage(detected.matchedCode);
        setLanguage(detected.matchedCode);
      } else if (!detected.isBuiltin) {
        // If detected language is not built-in, default tab to auto-translate for immediate discovery
        setActiveTab('community');
      }
    } catch (e) {
      console.warn('Could not detect system language:', e);
    }
  }, []);

  const handleSelectLanguage = async (code: string) => {
    await i18n.changeLanguage(code);
    setLanguage(code);
  };

  const handleContinue = () => {
    setHasSelectedLanguage(true);
  };

  // Start auto-translating a language
  const startTranslation = async (code: string, name: string) => {
    // Check if already installed
    const alreadyInstalled = availableLanguages.some((l) => l.code === code);
    if (alreadyInstalled) {
      await i18n.changeLanguage(code);
      setLanguage(code);
      return;
    }

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
        showToast(t('language_installed_success', { name }));
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

  const handleCancelTranslation = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsTranslating(false);
    setTranslatingTarget(null);
    setTranslationError(null);
  };

  const handleRetryTranslation = () => {
    if (translatingTarget) {
      startTranslation(translatingTarget.code, translatingTarget.name);
    }
  };

  const handleCreateCustomLanguage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCode.trim()) return;
    const cleanCode = customCode
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]/g, '_');
    const cleanName = customName.trim() || cleanCode.toUpperCase();
    setShowCustomModal(false);
    setCustomCode('');
    setCustomName('');
    startTranslation(cleanCode, cleanName);
  };

  // Combine world languages with any already installed custom languages
  const communityLanguages = useMemo(() => {
    const list: Array<WorldLanguage & { isInstalled: boolean }> = [];
    const seenCodes = new Set<string>();

    // Add catalog
    for (const item of WORLD_LANGUAGES) {
      seenCodes.add(item.code.toLowerCase());
      const isInstalled = availableLanguages.some(
        (l) => l.code.toLowerCase() === item.code.toLowerCase()
      );
      list.push({ ...item, isInstalled });
    }

    // Add any other installed custom languages that aren't in the default catalog
    for (const custom of availableLanguages) {
      const lower = custom.code.toLowerCase();
      if (!isBuiltinLanguage(lower) && !seenCodes.has(lower)) {
        seenCodes.add(lower);
        list.push({
          code: custom.code,
          name: custom.name,
          nativeName: custom.name,
          flag: '🌐',
          isInstalled: true,
        });
      }
    }

    return list;
  }, [availableLanguages]);

  // Filtered list based on search query
  const filteredLanguages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return communityLanguages;
    return communityLanguages.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.nativeName.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q)
    );
  }, [communityLanguages, searchQuery]);

  return (
    <div className="fixed inset-0 w-full h-full flex flex-col items-center justify-center p-4 md:p-8 bg-background relative overflow-y-auto z-[100]">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/30 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel w-full max-w-4xl rounded-[2rem] border border-textMain/10 p-6 md:p-10 flex flex-col items-center relative z-10 shadow-2xl my-auto"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="mb-4"
        >
          <img
            src="/app-icon.png"
            alt="ZZZ Mod Manager Logo"
            className="w-20 h-20 md:w-24 md:h-24 rounded-3xl shadow-xl shadow-primary/20"
          />
        </motion.div>

        {/* Global title with universal translation glyph */}
        <h1 className="text-2xl md:text-3xl font-black text-textMain tracking-tight mb-1 text-center flex items-center justify-center gap-2">
          <span>🌐</span>
          <span>{t('select_your_language')}</span>
        </h1>

        {/* Multilingual ticker so users instantly see their own script */}
        <p className="text-xs font-medium text-textMuted mb-5 text-center flex flex-wrap items-center justify-center gap-2 max-w-2xl">
          <span>English</span>
          <span className="opacity-40">•</span>
          <span>简体中文</span>
          <span className="opacity-40">•</span>
          <span>日本語</span>
          <span className="opacity-40">•</span>
          <span>한국어</span>
          <span className="opacity-40">•</span>
          <span>Español</span>
          <span className="opacity-40">•</span>
          <span>Русский</span>
          <span className="opacity-40">•</span>
          <span>Português</span>
          <span className="opacity-40">•</span>
          <span>Français</span>
          <span className="opacity-40">•</span>
          <span>Deutsch</span>
          <span className="opacity-40">•</span>
          <span>Polski</span>
          <span className="opacity-40">•</span>
          <span className="text-primary font-bold">ไทย</span>
          <span className="opacity-40">•</span>
          <span>Tiếng Việt</span>
          <span className="opacity-40">•</span>
          <span>Türkçe</span>
        </p>

        {/* System Language Detection Banner (if non-builtin detected and not already installed) */}
        {detectedLang &&
          !detectedLang.isBuiltin &&
          !availableLanguages.some((l) => l.code === detectedLang.matchedCode) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full mb-6 p-4 md:p-5 rounded-2xl bg-gradient-to-r from-primary/25 via-primary/10 to-transparent border-2 border-primary/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl shadow-primary/10"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-primary text-background font-black flex items-center justify-center text-2xl shrink-0 shadow-md">
                  {detectedLang.flag || '🌐'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm md:text-base font-black text-textMain">
                      {detectedLang.greeting?.greeting ||
                        `${detectedLang.nativeName} (${detectedLang.displayName})`}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-mono uppercase font-bold">
                      {detectedLang.rawCode}
                    </span>
                  </div>
                  <p className="text-xs text-textMuted mt-0.5 flex items-center gap-1.5">
                    <span>🌐 文 / A</span>
                    <span>•</span>
                    <span>
                      {t('detected_system_language_desc', { language: detectedLang.displayName })}
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => startTranslation(detectedLang.matchedCode, detectedLang.displayName)}
                className="shrink-0 w-full sm:w-auto px-5 py-2.5 bg-primary hover:bg-primary/90 text-background font-black text-xs md:text-sm rounded-xl shadow-lg shadow-primary/25 transition-all hover:scale-105 flex items-center justify-center gap-2"
              >
                <span>🌐 文/A</span>
                <span>
                  {detectedLang.greeting?.action ||
                    t('auto_translate_banner_action', {
                      language: detectedLang.nativeName || detectedLang.displayName,
                    })}
                </span>
              </button>
            </motion.div>
          )}

        {/* Global Tabs with Universal Symbols & Script Previews */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-background/70 border border-white/10 mb-6 w-full max-w-xl">
          <button
            type="button"
            onClick={() => setActiveTab('official')}
            className={`flex-1 flex flex-col items-center py-2.5 px-3 rounded-xl transition-all ${
              activeTab === 'official'
                ? 'bg-primary text-background shadow-lg shadow-primary/25 font-bold'
                : 'text-textMuted hover:text-textMain'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs md:text-sm font-black">
              <ShieldCheck size={16} />
              <span>{t('tab_official_languages')}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20">8</span>
            </div>
            <span
              className={`text-[10px] mt-0.5 font-medium ${
                activeTab === 'official' ? 'text-background/80' : 'text-textMuted'
              }`}
            >
              EN • 中文 • 日本語 • 한국어 • ES • RU • PT
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('community')}
            className={`flex-1 flex flex-col items-center py-2.5 px-3 rounded-xl transition-all relative ${
              activeTab === 'community'
                ? 'bg-primary text-background shadow-lg shadow-primary/25 font-bold'
                : 'text-textMuted hover:text-textMain border border-primary/30 bg-primary/5'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs md:text-sm font-black">
              <span className="text-sm">🌐 文/A</span>
              <span>{t('tab_auto_translate')}</span>
              <span className="text-sm">➔</span>
            </div>
            <span
              className={`text-[10px] mt-0.5 font-medium ${
                activeTab === 'community' ? 'text-background/80' : 'text-primary'
              }`}
            >
              Français • Deutsch • Polski • ไทย • Tiếng Việt • Türkçe...
            </span>
          </button>
        </div>

        {/* Tab 1: Official Languages Grid */}
        {activeTab === 'official' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full mb-8">
            {BUILTIN_LANGUAGES.map((lang, index) => {
              const isSelected = language === lang.code;
              const isDetected = detectedLang?.matchedCode === lang.code;

              return (
                <motion.button
                  key={lang.code}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + index * 0.03 }}
                  onClick={() => handleSelectLanguage(lang.code)}
                  className={`p-4 md:p-5 rounded-2xl border transition-all flex flex-col items-center justify-between gap-2 shadow-lg group relative ${
                    isSelected
                      ? 'bg-primary/20 border-primary text-primary shadow-primary/20 scale-105'
                      : 'glass-panel border-textMain/10 text-textMain hover:bg-white/5 hover:border-primary/50'
                  }`}
                >
                  {isDetected && (
                    <span className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded-full bg-primary text-background font-black uppercase tracking-wider">
                      OS
                    </span>
                  )}
                  {isSelected && (
                    <span className="absolute top-2 left-2 text-[9px] px-1.5 py-0.5 rounded-full bg-primary text-background font-bold flex items-center gap-0.5">
                      <Check size={10} />
                    </span>
                  )}
                  <Globe
                    className={`w-7 h-7 ${
                      isSelected
                        ? 'text-primary'
                        : 'text-textMuted group-hover:text-primary transition-colors'
                    }`}
                  />
                  <div className="text-center">
                    <span className="font-bold text-sm md:text-base block">{lang.name}</span>
                    <span className="text-[10px] font-mono text-textMuted uppercase opacity-60">
                      {lang.code}
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}

        {/* Tab 2: Auto-Translate 50+ World Languages */}
        {activeTab === 'community' && (
          <div className="w-full mb-6">
            {/* Search and Filter Header */}
            <div className="flex items-center gap-3 mb-3">
              <div className="relative flex-1">
                <Search
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textMuted pointer-events-none"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('search_world_languages')}
                  className="w-full pl-9 pr-8 py-2 bg-background/80 border border-white/10 rounded-xl text-xs text-textMain placeholder:text-textMuted/60 focus:outline-none focus:border-primary"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-textMuted hover:text-textMain"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <span className="text-[11px] text-textMuted font-mono shrink-0">
                {filteredLanguages.length} / {communityLanguages.length}
              </span>
            </div>

            {/* Scrollable Language Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-[42vh] overflow-y-auto pr-1">
              {filteredLanguages.map((lang) => {
                const isSelected = language === lang.code;

                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() =>
                      lang.isInstalled
                        ? handleSelectLanguage(lang.code)
                        : startTranslation(lang.code, lang.nativeName)
                    }
                    className={`p-3.5 rounded-2xl border transition-all flex flex-col items-center justify-between gap-1.5 shadow-lg group relative text-center ${
                      isSelected
                        ? 'bg-primary/20 border-primary text-primary shadow-primary/20 scale-105'
                        : lang.isInstalled
                          ? 'glass-panel border-emerald-500/40 text-textMain hover:border-emerald-400'
                          : 'glass-panel border-textMain/10 text-textMain hover:bg-white/5 hover:border-primary/50'
                    }`}
                  >
                    {/* Status Badge */}
                    {lang.isInstalled ? (
                      <span className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center gap-0.5">
                        <Check size={10} />
                      </span>
                    ) : (
                      <span className="absolute top-2 right-2 text-[10px] text-primary/70 group-hover:text-primary group-hover:scale-110 transition-transform">
                        ➔
                      </span>
                    )}

                    {/* Flag & Icon */}
                    <div className="text-2xl mt-1 select-none">{lang.flag || '🌐'}</div>

                    {/* Language Names */}
                    <div>
                      <span className="font-black text-sm md:text-base block tracking-tight">
                        {lang.nativeName}
                      </span>
                      <span className="text-[11px] text-textMuted block">{lang.name}</span>
                    </div>

                    {/* Action Indicator */}
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded-full uppercase font-mono tracking-wider ${
                        isSelected
                          ? 'bg-primary text-background font-black'
                          : lang.isInstalled
                            ? 'bg-emerald-500/20 text-emerald-400 font-bold'
                            : 'bg-white/5 text-textMuted group-hover:bg-primary/20 group-hover:text-primary font-bold transition-colors'
                      }`}
                    >
                      {isSelected
                        ? t('installed_language_status')
                        : lang.isInstalled
                          ? t('installed_language_status')
                          : '🌐 文/A ➔'}
                    </span>
                  </button>
                );
              })}

              {filteredLanguages.length === 0 && (
                <div className="col-span-2 sm:col-span-4 py-8 text-center text-xs text-textMuted">
                  {t('language_search_no_results')}
                </div>
              )}
            </div>

            {/* Custom / Dropdown Language Picker Trigger */}
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={() => setShowCustomModal(true)}
                className="px-4 py-2 rounded-xl border border-dashed border-white/20 hover:border-primary text-xs font-semibold text-textMuted hover:text-primary transition-all flex items-center gap-2 group"
              >
                <Plus size={14} className="group-hover:rotate-90 transition-transform" />
                <span>{t('custom_language_btn')}</span>
              </button>
            </div>
          </div>
        )}

        {/* Continue Button */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <button
            onClick={handleContinue}
            className="px-14 py-3.5 bg-primary text-background rounded-xl font-bold text-lg hover:opacity-90 transition-all shadow-[0_0_25px_rgba(var(--color-primary-rgb),0.3)] hover:scale-105 flex items-center gap-2"
          >
            <span>{t('setup_continue', 'Continue')}</span>
            <ArrowRight size={18} />
          </button>
        </motion.div>
      </motion.div>

      {/* Portaled Translation Progress Modal */}
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

      {/* Portaled Custom Language Input / Dropdown Modal */}
      <Modal
        isOpen={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        maxWidth="sm"
        title={t('custom_language_prompt_title')}
        icon={<Globe size={20} />}
      >
        <form onSubmit={handleCreateCustomLanguage} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-textMuted mb-1.5">
              {t('choose_other_language')}
            </label>
            <select
              value={customCode}
              onChange={(e) => {
                const code = e.target.value;
                const item = WORLD_LANGUAGES.find((l) => l.code === code);
                setCustomCode(code);
                if (item) setCustomName(item.nativeName);
              }}
              className="w-full px-3 py-2.5 bg-background/80 border border-white/10 rounded-xl text-xs text-textMain focus:outline-none focus:border-primary"
            >
              <option value="">{t('select_world_language_placeholder')}</option>
              {WORLD_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.nativeName} ({l.name}) [{l.code}]
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-textMuted mb-1">
              {t('custom_language_code_label')}
            </label>
            <input
              type="text"
              required
              placeholder="e.g. ro, fi, nl, el, th, vi"
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value)}
              className="w-full px-3 py-2 bg-background/80 border border-white/10 rounded-xl text-xs text-textMain focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-textMuted mb-1">
              {t('custom_language_name_label')}
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Română, Suomi, Nederlands, ไทย"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="w-full px-3 py-2 bg-background/80 border border-white/10 rounded-xl text-xs text-textMain focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowCustomModal(false)}
              className="px-4 py-2 rounded-xl text-xs text-textMuted hover:bg-white/5 transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-primary text-background font-bold rounded-xl text-xs hover:opacity-90 transition-opacity flex items-center gap-1.5"
            >
              <span>🌐 文/A</span>
              <span>
                {t('auto_translate_banner_action', { language: customName || 'Language' })}
              </span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
