import { motion } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { Globe } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

export function LanguageSelectView() {
  const { availableLanguages, setLanguage, setHasSelectedLanguage, language } = useAppStore();
  const { t } = useTranslation();

  const handleSelectLanguage = (code: string) => {
    setLanguage(code);
  };

  const handleContinue = () => {
    setHasSelectedLanguage(true);
  };

  return (
    <div className="fixed inset-0 w-full h-full flex flex-col items-center justify-center p-8 bg-background relative overflow-hidden z-[100]">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/30 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel w-full max-w-3xl rounded-[2rem] border border-textMain/10 p-12 flex flex-col items-center relative z-10 shadow-2xl"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <img
            src="/app-icon.png"
            alt="ZZZ Mod Manager Logo"
            className="w-32 h-32 rounded-3xl shadow-xl shadow-primary/20"
          />
        </motion.div>

        <h1 className="text-4xl font-black text-textMain tracking-tight mb-2 text-center">
          Select Your Language
        </h1>
        <p className="text-sm font-medium text-textMuted mb-8 text-center flex flex-wrap items-center justify-center gap-2">
          <span>Selecione Seu Idioma</span>
          <span className="opacity-40">•</span>
          <span>选择您的语言</span>
          <span className="opacity-40">•</span>
          <span>言語を選択</span>
          <span className="opacity-40">•</span>
          <span>언어 선택</span>
          <span className="opacity-40">•</span>
          <span>Seleccionar idioma</span>
          <span className="opacity-40">•</span>
          <span>Выберите язык</span>
          <span className="opacity-40">•</span>
          <span>選擇語言</span>
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full mb-8">
          {availableLanguages.map((lang, index) => (
            <motion.button
              key={lang.code}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              onClick={() => handleSelectLanguage(lang.code)}
              className={`p-6 rounded-2xl border transition-all flex flex-col items-center gap-3 shadow-lg group ${
                language === lang.code
                  ? 'bg-primary/20 border-primary text-primary shadow-primary/20 scale-105'
                  : 'glass-panel border-textMain/10 text-textMain hover:bg-white/5 hover:border-primary/50'
              }`}
            >
              <Globe
                className={`w-8 h-8 ${language === lang.code ? 'text-primary' : 'text-textMuted group-hover:text-primary transition-colors'}`}
              />
              <span className="font-bold text-lg">{lang.name}</span>
            </motion.button>
          ))}
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
          <button
            onClick={handleContinue}
            className="px-16 py-4 bg-primary text-white rounded-xl font-bold text-xl hover:bg-primary/80 transition-all shadow-[0_0_30px_rgba(var(--color-primary-rgb),0.3)] hover:scale-105"
          >
            {t('setup_continue', 'Continue')}
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
