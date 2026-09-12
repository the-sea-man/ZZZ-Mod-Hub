import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

export interface GlobalDropOverlayProps {
  isDragging: boolean;
}

export const GlobalDropOverlay = memo(function GlobalDropOverlay({
  isDragging,
}: GlobalDropOverlayProps) {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {isDragging && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-primary/20 backdrop-blur-md z-50 flex flex-col items-center justify-center border-4 border-dashed border-primary m-4 rounded-3xl pointer-events-none"
        >
          <Upload size={64} className="text-primary animate-bounce mb-4" />
          <span className="text-2xl font-black text-white tracking-wide">
            {t('drop_to_install')}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
