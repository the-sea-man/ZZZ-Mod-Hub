import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';
import { ACHIEVEMENTS, AchievementDef } from '../constants/achievements';
import { useAppStore } from '../store/useAppStore';
import { useTranslation } from '../hooks/useTranslation';
import { safeGetJSON } from '../utils/storage';
import { playAchievementSound } from '../utils/audio';

interface ActiveToast {
  id: string;
  achievement: AchievementDef;
}

export function AchievementToastManager() {
  const { userStats, tutorialsSeen, setActiveTab } = useAppStore();
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<ActiveToast[]>([]);
  const knownUnlockedRef = useRef<Set<string>>(new Set());
  const isInitializedRef = useRef(false);

  useEffect(() => {
    const seenCount = Object.values(tutorialsSeen || {}).filter(Boolean).length;
    const currentUnlocked = new Set<string>();

    for (const ach of ACHIEVEMENTS) {
      if (ach.getProgress(userStats, seenCount) >= ach.target) {
        currentUnlocked.add(ach.id);
      }
    }

    if (!isInitializedRef.current) {
      // First render: populate initial unlocked state from storage without firing toasts
      const stored = safeGetJSON<string[]>('unlocked_achievement_ids', []);
      if (Array.isArray(stored)) {
        stored.forEach((id) => knownUnlockedRef.current.add(id));
      }
      // Also merge current unlocked
      currentUnlocked.forEach((id) => knownUnlockedRef.current.add(id));
      localStorage.setItem(
        'unlocked_achievement_ids',
        JSON.stringify(Array.from(knownUnlockedRef.current))
      );
      isInitializedRef.current = true;
      return;
    }

    // Check if any new achievement was reached
    for (const ach of ACHIEVEMENTS) {
      if (currentUnlocked.has(ach.id) && !knownUnlockedRef.current.has(ach.id)) {
        knownUnlockedRef.current.add(ach.id);
        localStorage.setItem(
          'unlocked_achievement_ids',
          JSON.stringify(Array.from(knownUnlockedRef.current))
        );

        // Play achievement chime sound!
        playAchievementSound();

        // Enqueue toast
        const newToast: ActiveToast = {
          id: `${ach.id}_${Date.now()}`,
          achievement: ach,
        };

        setToasts((prev) => [...prev, newToast]);

        // Auto remove after 5.5 seconds
        setTimeout(() => {
          setToasts((prev) => prev.filter((item) => item.id !== newToast.id));
        }, 5500);
      }
    }
  }, [userStats, tutorialsSeen]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="fixed top-20 right-6 z-[9999] flex flex-col gap-3 pointer-events-none max-w-sm w-full">
      <AnimatePresence>
        {toasts.map(({ id, achievement }) => {
          const Icon = achievement.icon;
          return (
            <motion.div
              key={id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              onClick={() => {
                setActiveTab('achievements');
                removeToast(id);
              }}
              className="pointer-events-auto cursor-pointer p-4 rounded-2xl bg-surface/95 backdrop-blur-2xl border-2 border-amber-400/80 shadow-[0_0_35px_rgba(251,191,36,0.35)] relative overflow-hidden group hover:scale-[1.02] transition-transform"
            >
              {/* Gold decorative gradient flare */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/15 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-start gap-3.5 relative z-10">
                <div className="p-3 rounded-xl bg-amber-400/20 text-amber-400 flex items-center justify-center shrink-0 shadow-inner">
                  <Icon size={24} className="animate-bounce" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="text-[11px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1">
                      <Sparkles size={12} />
                      {t('achievement_unlocked_toast_badge', 'Achievement Unlocked!')}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeToast(id);
                      }}
                      className="p-1 text-textMuted hover:text-textMain rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <h4 className="text-base font-bold text-textMain truncate">
                    {t(`achievement_${achievement.id}_title` as any, achievement.title)}
                  </h4>
                  <p className="text-xs text-textMuted line-clamp-2 mt-0.5">
                    {t(`achievement_${achievement.id}_desc` as any, {
                      target: achievement.target,
                      defaultValue: achievement.description,
                    })}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
