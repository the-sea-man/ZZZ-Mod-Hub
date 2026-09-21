import { useState, useEffect } from 'react';
import { getGbPreviewUrl } from '../../utils/gbPreviewUrl';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Eye, Heart, Trophy } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { isNsfwMod } from '../../utils';

interface GBCarouselProps {
  mods: any[];
}

export function GBCarousel({ mods }: GBCarouselProps) {
  const { setActiveModPreview, blurNsfw } = useAppStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const validMods = Array.isArray(mods) ? mods.filter(Boolean) : [];

  useEffect(() => {
    if (currentIndex >= validMods.length) {
      setCurrentIndex(0);
    }
  }, [validMods.length, currentIndex]);

  useEffect(() => {
    if (validMods.length <= 1 || isPaused) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % validMods.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [validMods.length, isPaused]);

  if (validMods.length === 0) return null;

  const safeIndex = currentIndex < validMods.length ? currentIndex : 0;
  const currentMod = validMods[safeIndex];
  if (!currentMod) return null;

  // Resolve high quality image
  const imageUrl =
    getGbPreviewUrl(currentMod) || 'https://via.placeholder.com/800x400?text=No+Image';

  const isNsfw = isNsfwMod(currentMod) && blurNsfw;

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % validMods.length);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + validMods.length) % validMods.length);
  };

  return (
    <div
      className="w-full relative rounded-2xl overflow-hidden mb-8 shadow-2xl border border-white/10 group bg-black shrink-0"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={{ aspectRatio: '736/304' }}
      onClick={() => setActiveModPreview(currentMod)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentMod._idRow}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 cursor-pointer"
        >
          <img
            src={imageUrl}
            alt={currentMod._sName}
            className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${isNsfw ? 'blur-3xl scale-110' : ''}`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/20 to-transparent pointer-events-none" />

          <div className="absolute bottom-0 left-0 p-8 w-full md:w-2/3 flex flex-col gap-3">
            <div className="flex gap-2 flex-wrap">
              {currentMod._sModelName && currentMod._sModelName !== 'Mod' && (
                <span className="w-fit px-3 py-1 bg-primary/80 backdrop-blur-md rounded-lg text-xs font-bold text-white uppercase tracking-wider">
                  {currentMod._sModelName}
                </span>
              )}
              {currentMod._sPeriod && (
                <span className="w-fit px-3 py-1 bg-accent/80 backdrop-blur-md rounded-lg text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-accent/20 border border-white/10">
                  <Trophy size={14} className="text-yellow-300" />
                  {currentMod._sPeriod === 'today'
                    ? 'Best of Today'
                    : currentMod._sPeriod === 'week'
                      ? 'Best of the Week'
                      : currentMod._sPeriod === 'month'
                        ? 'Best of the Month'
                        : currentMod._sPeriod === '3month'
                          ? 'Best of 3 Months'
                          : currentMod._sPeriod === '6month'
                            ? 'Best of 6 Months'
                            : currentMod._sPeriod === 'year'
                              ? 'Best of the Year'
                              : currentMod._sPeriod === 'alltime'
                                ? 'Best of All Time'
                                : 'Top Submission'}
                </span>
              )}
            </div>

            <h2 className="text-3xl md:text-5xl font-black text-white leading-tight drop-shadow-lg line-clamp-2">
              {currentMod._sName}
            </h2>

            <div className="flex items-center gap-4 text-white/80">
              <div className="flex items-center gap-2">
                <img
                  src={currentMod._aSubmitter?._sAvatarUrl || 'https://via.placeholder.com/30'}
                  className="w-6 h-6 rounded-full border border-white/20"
                  alt="Avatar"
                />
                <span className="font-bold">{currentMod._aSubmitter?._sName}</span>
              </div>

              <div className="flex items-center gap-4 text-sm font-semibold ml-4">
                {currentMod._nViewCount !== undefined && (
                  <span className="flex items-center gap-1.5">
                    <Eye size={16} className="text-white/60" /> {currentMod._nViewCount}
                  </span>
                )}
                {currentMod._nLikeCount !== undefined && (
                  <span className="flex items-center gap-1.5">
                    <Heart size={16} className="text-red-400" /> {currentMod._nLikeCount}
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <button
        onClick={handlePrev}
        className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/80 text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all border border-white/10"
      >
        <ChevronLeft size={24} />
      </button>

      <button
        onClick={handleNext}
        className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/80 text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all border border-white/10"
      >
        <ChevronRight size={24} />
      </button>

      <div className="absolute bottom-6 right-8 flex gap-2 z-20">
        {validMods.map((_, idx) => (
          <div
            key={idx}
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${idx === safeIndex ? 'bg-primary scale-125 w-6' : 'bg-white/40'}`}
          />
        ))}
      </div>
    </div>
  );
}
