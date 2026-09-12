import { memo } from 'react';
import { motion } from 'framer-motion';
import { Layers, Loader2, Sparkles } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore, type AppStore } from '../../store/useAppStore';

const selectCardSize = (s: AppStore) => s.cardSize;

export const LibraryLoadingState = memo(function LibraryLoadingState() {
  const { t } = useTranslation();
  const cardSize = useAppStore(selectCardSize);

  const getGridCols = () => {
    if (cardSize < 180) {
      return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';
    }
    if (cardSize > 260) {
      return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
    }
    return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
  };

  return (
    <div className="h-full flex flex-col items-center justify-start py-8 px-4 w-full max-w-7xl mx-auto overflow-y-auto custom-scrollbar">
      {/* Top Animated Loading Badge */}
      <div className="flex flex-col items-center text-center mb-8 relative">
        <div className="relative mb-5 flex items-center justify-center">
          {/* Ambient Glow */}
          <div className="absolute w-24 h-24 rounded-full bg-primary/20 blur-2xl animate-pulse" />

          {/* Spinning Accent Ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            className="w-20 h-20 rounded-3xl border-2 border-dashed border-primary/40 flex items-center justify-center shadow-lg"
          />

          {/* Central Glass Orb */}
          <div className="absolute w-14 h-14 rounded-2xl bg-surface/90 border border-primary/50 flex items-center justify-center text-primary shadow-xl backdrop-blur-md">
            <Layers size={26} className="animate-bounce" />
          </div>

          <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-primary text-black shadow-md">
            <Sparkles size={12} />
          </div>
        </div>

        <h3 className="text-xl font-black text-textMain tracking-tight flex items-center gap-2.5">
          <span>{t('library_loading_title', 'Scanning Mod Library...')}</span>
          <Loader2 size={18} className="animate-spin text-primary" />
        </h3>

        <p className="text-xs text-textMuted max-w-md mt-1.5 leading-relaxed">
          {t(
            'library_loading_subtitle',
            'Reading installed mods, verifying character entities, and indexing assets...'
          )}
        </p>
      </div>

      {/* Grid of Shimmering Card Skeletons */}
      <div className={`grid ${getGridCols()} gap-5 w-full`}>
        {[...Array(10)].map((_, idx) => (
          <div
            key={idx}
            className="rounded-2xl border border-white/5 bg-surface/40 p-3 space-y-3 overflow-hidden animate-pulse shadow-md relative"
          >
            {/* Card Preview Image Skeleton */}
            <div className="w-full aspect-[4/3] rounded-xl bg-white/5 relative overflow-hidden flex items-center justify-center">
              <div className="w-8 h-8 rounded-lg bg-white/5" />
            </div>

            {/* Card Content Skeleton */}
            <div className="space-y-2 px-1">
              <div
                className="h-3.5 bg-white/10 rounded-md"
                style={{ width: `${60 + ((idx * 13) % 35)}%` }}
              />
              <div className="flex items-center justify-between pt-1">
                <div className="h-2.5 bg-white/5 rounded-md w-14" />
                <div className="h-2.5 bg-white/5 rounded-md w-10" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Subtle Bottom Safety Hint */}
      <div className="mt-10 py-2 px-4 rounded-xl border border-white/5 bg-black/20 text-[11px] text-textMuted/70 text-center">
        {t(
          'library_loading_hint',
          'Taking longer than usual? Verify your Mods folder path in Settings.'
        )}
      </div>
    </div>
  );
});
