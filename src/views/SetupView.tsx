import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { dataDir, join } from '@tauri-apps/api/path';
import {
  Sparkles,
  Folder,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useTranslation } from '../hooks/useTranslation';

export function SetupView() {
  const [step, setStep] = useState(1);

  const { modsPath, setModsPath, scanModsFolder, setSetupComplete } = useAppStore();
  const { t } = useTranslation();

  useEffect(() => {
    if (!modsPath) {
      dataDir().then(async (appData) => {
        const defaultPath = await join(appData, 'XXMI Launcher', 'ZZMI', 'Mods');
        setModsPath(defaultPath);
      });
    }
  }, [modsPath, setModsPath]);

  const handleBrowseFolder = async () => {
    try {
      const selectedPath = await open({ directory: true, multiple: false });
      if (selectedPath && typeof selectedPath === 'string') {
        setModsPath(selectedPath);
        scanModsFolder();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openXxmiLink = () => {
    invoke('open_url', {
      url: 'https://github.com/SpectrumQT/XXMI-Launcher/releases/tag/v2.2.1',
    }).catch(() => {
      window.open('https://github.com/SpectrumQT/XXMI-Launcher/releases/tag/v2.2.1', '_blank');
    });
  };

  const handleFinish = () => {
    setSetupComplete(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background">
      <div className="absolute inset-0 w-full h-full">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[100px] pointer-events-none" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="glass-panel w-full max-w-2xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden relative z-10 flex flex-col min-h-[520px]"
      >
        <div className="absolute top-0 left-0 w-full h-1.5 bg-white/5">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-primary/80"
            initial={{ width: '33%' }}
            animate={{ width: `${(step / 3) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <div className="p-8 md:p-10 flex-1 flex flex-col">
          {/* Header Progress */}
          <div className="flex items-center justify-between mb-6">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              {t('setup_step_indicator', { step })}
            </span>
            <div className="flex gap-1.5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                    i === step
                      ? 'bg-primary scale-125 shadow-[0_0_8px_rgba(var(--color-primary-rgb),0.5)]'
                      : i < step
                        ? 'bg-primary/50'
                        : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-center mb-2">
                    <div className="p-4 rounded-2xl bg-primary/20 text-primary border border-primary/20 shadow-[0_0_30px_rgba(var(--color-primary-rgb),0.2)]">
                      <Sparkles size={40} />
                    </div>
                  </div>

                  <div className="text-center">
                    <h1 className="text-3xl font-black text-textMain tracking-tight mb-3">
                      {t('setup_welcome_title')}
                    </h1>
                    <p className="text-base text-textMuted max-w-lg mx-auto leading-relaxed">
                      {t('setup_welcome_desc')}
                    </p>
                  </div>

                  <div className="bg-surface/50 border border-white/5 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center gap-2.5 text-primary font-bold text-sm">
                      <AlertCircle size={18} />
                      <span>{t('setup_prereq_title')}</span>
                    </div>
                    <p className="text-xs text-textMuted leading-relaxed">
                      {t('setup_prereq_desc')}
                    </p>
                    <button
                      onClick={openXxmiLink}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-textMain transition-all"
                    >
                      <ExternalLink size={14} />
                      {t('setup_get_xxmi')}
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-center mb-2">
                    <div className="p-4 rounded-2xl bg-primary/20 text-primary border border-primary/20 shadow-[0_0_30px_rgba(var(--color-primary-rgb),0.2)]">
                      <Folder size={40} />
                    </div>
                  </div>

                  <div className="text-center">
                    <h1 className="text-3xl font-black text-textMain tracking-tight mb-3">
                      {t('setup_folder_title')}
                    </h1>
                    <p className="text-base text-textMuted max-w-lg mx-auto leading-relaxed">
                      {t('setup_folder_desc')}
                    </p>
                  </div>

                  <div className="bg-surface/50 border border-white/5 rounded-2xl p-5 space-y-4">
                    <div className="flex items-start gap-2.5 text-primary text-xs font-semibold">
                      <AlertCircle size={16} className="shrink-0 mt-0.5" />
                      <span>{t('setup_tip')}</span>
                    </div>
                    <div className="bg-black/40 border border-white/10 rounded-xl p-3.5 flex items-center justify-between">
                      <code className="text-xs font-mono text-textMain select-all">
                        {'%appdata%\\XXMI Launcher\\ZZMI\\Mods'}
                      </code>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-textMuted">
                      {t('setup_select_folder')}
                    </label>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={modsPath}
                        onChange={(e) => setModsPath(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && modsPath.trim()) {
                            scanModsFolder();
                            setStep(3);
                          }
                        }}
                        className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 font-mono text-xs text-textMain focus:outline-none focus:border-primary/50 transition-all placeholder:text-textMuted/40"
                        placeholder="%appdata%\XXMI Launcher\ZZMI\Mods"
                      />
                      <button
                        onClick={handleBrowseFolder}
                        className="px-6 bg-surface border border-white/10 text-textMain rounded-xl font-bold text-sm hover:bg-white/5 transition-all flex items-center gap-2 shrink-0"
                      >
                        <Folder size={16} />
                        {t('setup_browse')}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6 text-center"
                >
                  <div className="flex items-center justify-center mb-2">
                    <div className="p-4 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                      <CheckCircle2 size={48} />
                    </div>
                  </div>

                  <div>
                    <h1 className="text-3xl font-black text-textMain tracking-tight mb-3">
                      {t('setup_complete_title')}
                    </h1>
                    <p className="text-base text-textMuted max-w-lg mx-auto leading-relaxed">
                      {t('setup_complete_desc')}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer Navigation */}
          <div className="flex items-center justify-between pt-6 border-t border-white/5 mt-auto">
            {step > 1 ? (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="px-5 py-2.5 rounded-xl border border-white/10 font-bold text-sm text-textMuted hover:text-textMain hover:bg-white/5 transition-all flex items-center gap-1.5"
              >
                <ChevronLeft size={16} />
                {t('setup_back')}
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (step === 2 && modsPath.trim()) {
                      scanModsFolder();
                    }
                    setStep((s) => s + 1);
                  }}
                  disabled={step === 2 && !modsPath.trim()}
                  className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-1.5 shadow-lg ${
                    step === 2 && !modsPath.trim()
                      ? 'bg-surface text-textMuted cursor-not-allowed opacity-50'
                      : 'bg-primary text-white hover:bg-primary/80 shadow-primary/20 hover:scale-105'
                  }`}
                >
                  {t('setup_next')}
                  <ChevronRight size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={handleFinish}
                className="px-8 py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/80 transition-all shadow-lg shadow-primary/20 hover:scale-105"
              >
                {t('setup_enter_app')}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
