import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wrench,
  ChevronDown,
  RefreshCw,
  ShieldAlert,
  FolderCog,
  FolderDown,
  Zap,
} from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore, PerformanceProfile } from '../../store/useAppStore';

export interface LibraryToolsMenuProps {
  modsPath: string;
  highlightTargetId?: string | null;
  isCheckingUpdates: boolean;
  availableUpdatesCount: number;
  onCheckUpdates: () => void;
  onOpenBatchFix: () => void;
  isAnalyzingMods: boolean;
  onRunManualAnalysis: () => void;
  onOpenFolderManagement?: () => void;
  onOpenImportMods?: () => void;
  performanceProfile: PerformanceProfile;
  onCyclePerformanceProfile: () => void;
}

export function LibraryToolsMenu({
  modsPath,
  highlightTargetId,
  isCheckingUpdates,
  availableUpdatesCount,
  onCheckUpdates,
  onOpenBatchFix,
  isAnalyzingMods,
  onRunManualAnalysis,
  onOpenFolderManagement,
  onOpenImportMods,
  performanceProfile,
  onCyclePerformanceProfile,
}: LibraryToolsMenuProps) {
  const { t } = useTranslation();
  const externalModsSourcePath = useAppStore((s) => s.externalModsSourcePath);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const portalMenuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, bottom: 0, right: 0 });

  const isHighlighted = !isMenuOpen && highlightTargetId === 'check_updates_btn';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        portalMenuRef.current &&
        !portalMenuRef.current.contains(target)
      ) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    const handleClose = () => setIsMenuOpen(false);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    if (isMenuOpen) {
      window.addEventListener('scroll', handleClose, { passive: true, capture: true });
      window.addEventListener('resize', handleClose, { passive: true });
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const handleToggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isMenuOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
        right: rect.right,
      });
    }
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggleMenu}
        className={`px-3 py-2 rounded-xl font-bold text-xs transition-all border flex items-center gap-1.5 cursor-pointer shadow-sm ${
          isMenuOpen
            ? 'bg-primary/20 text-primary border-primary/50 ring-1 ring-primary/40'
            : availableUpdatesCount > 0
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
              : 'border-white/10 bg-surface-light hover:bg-white/10 text-textMain'
        } ${isHighlighted ? 'highlight-target animate-pulse' : ''}`}
        title={t('library_tools_desc')}
      >
        <Wrench
          size={14}
          className={availableUpdatesCount > 0 ? 'text-amber-400' : 'text-primary'}
        />
        <span>{t('library_tools_btn')}</span>
        {availableUpdatesCount > 0 && (
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/30 text-amber-300 border border-amber-500/40 leading-none">
            {availableUpdatesCount}
          </span>
        )}
        <ChevronDown
          size={13}
          className={`text-textMuted transition-transform duration-150 ${
            isMenuOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {createPortal(
        <AnimatePresence>
          {isMenuOpen &&
            (() => {
              const spaceBelow = window.innerHeight - menuPos.bottom;
              const spaceAbove = menuPos.top;
              const openUpwards = spaceBelow < 380 && spaceAbove > spaceBelow;
              const maxMenuHeight = Math.max(
                200,
                Math.min(openUpwards ? spaceAbove - 24 : spaceBelow - 24, 480)
              );
              const menuWidth = 260;
              const menuLeft = Math.max(
                12,
                Math.min(menuPos.right - menuWidth, window.innerWidth - menuWidth - 12)
              );

              return (
                <motion.div
                  key="library-tools-menu"
                  ref={portalMenuRef}
                  initial={{
                    opacity: 0,
                    scale: 0.96,
                    y: openUpwards ? 8 : -8,
                  }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{
                    opacity: 0,
                    scale: 0.96,
                    y: openUpwards ? 8 : -8,
                  }}
                  transition={{ duration: 0.15 }}
                  style={{
                    position: 'fixed',
                    top: openUpwards ? undefined : `${menuPos.bottom + 8}px`,
                    bottom: openUpwards ? `${window.innerHeight - menuPos.top + 8}px` : undefined,
                    left: `${menuLeft}px`,
                    width: `${menuWidth}px`,
                    maxHeight: `${maxMenuHeight}px`,
                    zIndex: 9999,
                  }}
                  className="bg-surface/95 app-blur border border-textMain/10 rounded-2xl shadow-2xl overflow-y-auto custom-scrollbar flex flex-col p-1.5"
                >
                  {/* Group 1: Maintenance & Diagnostics */}
                  <div className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-textMuted">
                    {t('library_tools_maintenance')}
                  </div>

                  <button
                    data-highlight-id="check_updates_btn"
                    onClick={() => {
                      onCheckUpdates();
                      setIsMenuOpen(false);
                    }}
                    disabled={!modsPath || isCheckingUpdates}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all text-left ${
                      availableUpdatesCount > 0
                        ? 'text-amber-300 hover:bg-amber-500/15'
                        : 'text-textMain hover:bg-white/5'
                    } disabled:opacity-50 ${
                      highlightTargetId === 'check_updates_btn' ? 'highlight-target' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <RefreshCw
                        size={14}
                        className={`shrink-0 ${
                          isCheckingUpdates
                            ? 'animate-spin text-primary'
                            : availableUpdatesCount > 0
                              ? 'text-amber-400'
                              : 'text-green-400'
                        }`}
                      />
                      <span className="truncate">
                        {isCheckingUpdates ? t('checking') : t('check_for_updates')}
                      </span>
                    </div>
                    {availableUpdatesCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/30 text-amber-300 border border-amber-500/40 shrink-0">
                        {availableUpdatesCount}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      onRunManualAnalysis();
                      setIsMenuOpen(false);
                    }}
                    disabled={isAnalyzingMods}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-textMain hover:bg-white/5 transition-all text-left disabled:opacity-50"
                  >
                    <ShieldAlert
                      size={14}
                      className={`shrink-0 text-primary ${isAnalyzingMods ? 'animate-spin' : ''}`}
                    />
                    <span className="truncate">
                      {isAnalyzingMods ? t('analyzing_mods') : t('analyze_mods_btn')}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      onOpenBatchFix();
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-amber-300 hover:bg-amber-500/10 transition-all text-left"
                  >
                    <Wrench size={14} className="shrink-0 text-amber-400" />
                    <span className="truncate">{t('upgrade_outdated_mods')}</span>
                  </button>

                  {/* Divider */}
                  <div className="my-1.5 border-t border-textMain/10" />

                  {/* Group 2: Folder Setup */}
                  <div className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-textMuted">
                    {t('library_tools_folders')}
                  </div>

                  {onOpenFolderManagement && (
                    <button
                      onClick={() => {
                        onOpenFolderManagement();
                        setIsMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-textMain hover:bg-white/5 transition-all text-left"
                    >
                      <FolderCog size={14} className="text-primary shrink-0" />
                      <span className="truncate">{t('manage_folders')}</span>
                    </button>
                  )}

                  {onOpenImportMods && (
                    <button
                      onClick={() => {
                        onOpenImportMods();
                        setIsMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-textMain hover:bg-white/5 transition-all text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FolderDown size={14} className="text-primary shrink-0" />
                        <span className="truncate">
                          {externalModsSourcePath
                            ? t('import_mods_sync_external_btn', 'Sync External Mods')
                            : t('import_mods_external_btn', 'Import External Mods')}
                        </span>
                      </div>
                      {externalModsSourcePath && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-primary/20 text-primary border border-primary/30 shrink-0">
                          {t('import_status_linked', 'Linked')}
                        </span>
                      )}
                    </button>
                  )}

                  {/* Divider */}
                  <div className="my-1.5 border-t border-textMain/10" />

                  {/* Group 3: Engine Performance */}
                  <div className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-textMuted flex items-center justify-between">
                    <span>{t('library_tools_engine')}</span>
                  </div>

                  <button
                    onClick={onCyclePerformanceProfile}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold hover:bg-white/5 transition-all text-left cursor-pointer"
                    title={t('performance_profile_desc')}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Zap size={14} className="text-primary shrink-0" />
                      <span className="text-textMuted">{t('library_tools_engine')}:</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          performanceProfile === 'low'
                            ? 'bg-emerald-400 animate-pulse'
                            : performanceProfile === 'balanced'
                              ? 'bg-primary animate-pulse'
                              : performanceProfile === 'high'
                                ? 'bg-purple-400 animate-pulse'
                                : 'bg-amber-400 animate-pulse'
                        }`}
                      />
                      <span
                        className={`font-bold text-[11px] ${
                          performanceProfile === 'low'
                            ? 'text-emerald-300'
                            : performanceProfile === 'balanced'
                              ? 'text-primary'
                              : performanceProfile === 'high'
                                ? 'text-purple-300'
                                : 'text-amber-300'
                        }`}
                      >
                        {performanceProfile === 'low'
                          ? t('profile_low_badge')
                          : performanceProfile === 'balanced'
                            ? t('profile_balanced_badge')
                            : performanceProfile === 'high'
                              ? t('profile_high_badge')
                              : t('profile_custom_badge')}
                      </span>
                    </div>
                  </button>
                </motion.div>
              );
            })()}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
