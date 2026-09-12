import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Box, Crop, Scissors } from 'lucide-react';
import { ModInfo } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { ModViewerModal } from '../ModViewer/ModViewerModal';
import { ImageCropperModal } from './ImageCropperModal';
import { SplitModModal } from './ModOptionsModals';

export type AdvancedTab = '3d' | 'crop' | 'split';

interface ModAdvancedPanelProps {
  mod: ModInfo;
  initialTab?: AdvancedTab;
  initialCropperSrc?: string | null;
  onClose: () => void;
  onRefresh: () => void;
}

interface TabDef {
  id: AdvancedTab;
  labelKey: string;
  labelDefault: string;
  icon: React.ReactNode;
  color: string;
}

const TABS: TabDef[] = [
  {
    id: '3d',
    labelKey: 'mod_advanced_tab_3d',
    labelDefault: '3D Preview',
    icon: <Box size={18} />,
    color: 'text-purple-400 group-hover:text-purple-300',
  },
  {
    id: 'crop',
    labelKey: 'mod_advanced_tab_crop',
    labelDefault: 'Preview Image',
    icon: <Crop size={18} />,
    color: 'text-sky-400 group-hover:text-sky-300',
  },
  {
    id: 'split',
    labelKey: 'mod_advanced_tab_split',
    labelDefault: 'Mod Splitter',
    icon: <Scissors size={18} />,
    color: 'text-amber-400 group-hover:text-amber-300',
  },
];

export function ModAdvancedPanel({
  mod,
  initialTab = '3d',
  initialCropperSrc,
  onClose,
  onRefresh,
}: ModAdvancedPanelProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<AdvancedTab>(initialTab);
  const [cropperSrc, setCropperSrc] = useState<string | null>(initialCropperSrc ?? null);

  const handleUse3DViewAsPreview = (snapshotDataUrl: string) => {
    setCropperSrc(snapshotDataUrl);
    setActiveTab('crop');
  };

  // Keyboard: Escape to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    if (initialTab === 'split') {
      if (
        !useAppStore
          .getState()
          .checkOrPromptExperimental(t('experimental_feat_splitter', 'Mod Splitter'))
      ) {
        onClose();
      }
    }
  }, [initialTab, onClose, t]);

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 12 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-[1400px] h-[90vh] bg-[#0d1117] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Top Bar ── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-white/[0.03] shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-white/80">
              {t('mod_advanced_panel_title', 'Advanced Tools')}
            </span>
            <span
              className="text-xs text-white/30 font-mono truncate max-w-[320px]"
              title={mod.name}
            >
              — {mod.name}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            title={t('close', 'Close')}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Body: Sidebar + Content ── */}
        <div className="flex flex-1 min-h-0">
          {/* Left Tab Sidebar */}
          <div className="w-52 flex-shrink-0 border-r border-white/10 flex flex-col py-4 gap-1 px-2 bg-white/[0.015]">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.id === 'split') {
                      if (
                        !useAppStore
                          .getState()
                          .checkOrPromptExperimental(
                            t('experimental_feat_splitter', 'Mod Splitter')
                          )
                      ) {
                        onClose();
                        return;
                      }
                    }
                    setActiveTab(tab.id);
                  }}
                  className={`group flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all text-left w-full ${
                    isActive
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                  }`}
                >
                  <span className={isActive ? tab.color.split(' ')[0] : tab.color}>{tab.icon}</span>
                  <span>{t(tab.labelKey, tab.labelDefault)}</span>
                  {isActive && (
                    <span className="ml-auto w-1.5 h-5 rounded-full bg-primary opacity-80" />
                  )}
                </button>
              );
            })}

            {/* Separator + info */}
            <div className="mt-auto pt-4 border-t border-white/5 px-2">
              <p className="text-[10px] text-white/20 leading-relaxed">
                {t('mod_advanced_panel_hint', 'Space-intensive operations for this mod.')}
              </p>
            </div>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="flex-1 flex flex-col min-h-0 h-full"
              >
                {activeTab === '3d' && (
                  <ModViewerModal
                    modPath={mod.full_path}
                    modName={mod.name}
                    onClose={onClose}
                    embedded
                    onUseAsPreview={handleUse3DViewAsPreview}
                  />
                )}

                {activeTab === 'crop' && (
                  <ImageCropperModal
                    mod={mod}
                    initialImageSrc={cropperSrc ?? initialCropperSrc ?? mod.preview_url ?? null}
                    onClose={onClose}
                    onSaved={() => {
                      onRefresh();
                    }}
                    embedded
                  />
                )}

                {activeTab === 'split' && (
                  <SplitModModal
                    mod={mod}
                    onClose={onClose}
                    onSaved={() => {
                      onRefresh();
                      onClose();
                    }}
                    embedded
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
