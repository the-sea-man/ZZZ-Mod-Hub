import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  Globe,
  FolderInput,
  ShieldAlert,
  Users,
  Sparkles,
  FileCode,
  Pencil,
  Tag,
  Box,
  Trash2,
} from 'lucide-react';
import { confirm } from '@tauri-apps/plugin-dialog';
import { ModInfo, ModWarning } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { tauriCommands } from '../../services/tauriCommands';

export interface ModCardActionsMenuProps {
  mod: ModInfo;
  isFirstCard?: boolean;
  highlightTargetId?: string | null;
  hasHashConflict: boolean;
  hasInstallConflict: boolean;
  multiCharWarnings: ModWarning[];
  outdatedWarnings: ModWarning[];
  iniWarnings: ModWarning[];
  conflictWarnings: ModWarning[];
  filteredWarnings: ModWarning[];
  onOpenMoveModal: () => void;
  onOpenRenameModal: () => void;
  onOpenResolveConflictModal?: () => void;
  onOpenHashConflictsModal?: () => void;
  onOpenWarningsModal?: (warnings: ModWarning[]) => void;
  onOpenFixMod: () => void;
  onOpenEditTags: () => void;
  onOpenEditNote: () => void;
  onOpenAdvanced: (tab: '3d' | 'crop' | 'split') => void;
  onDeleteMod: () => void;
}

export function ModCardActionsMenu({
  mod,
  isFirstCard,
  highlightTargetId,
  hasHashConflict,
  hasInstallConflict,
  multiCharWarnings,
  outdatedWarnings,
  iniWarnings,
  conflictWarnings,
  filteredWarnings,
  onOpenMoveModal,
  onOpenRenameModal,
  onOpenResolveConflictModal,
  onOpenHashConflictsModal,
  onOpenWarningsModal,
  onOpenFixMod,
  onOpenEditTags,
  onOpenEditNote,
  onOpenAdvanced,
  onDeleteMod,
}: ModCardActionsMenuProps) {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const portalMenuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, bottom: 0, right: 0 });

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
    <div className="absolute bottom-3 right-3 flex gap-2 items-center z-30">
      <button
        ref={buttonRef}
        data-highlight-id={isFirstCard ? 'first_mod_options' : undefined}
        onClick={handleToggleMenu}
        className={`p-2.5 rounded-full border app-blur transition-all shadow-lg flex items-center justify-center cursor-pointer ${
          isMenuOpen
            ? 'bg-primary text-white border-primary'
            : 'bg-background/80 border-textMain/10 text-textMuted hover:bg-surface hover:text-textMain'
        } ${
          isFirstCard && highlightTargetId === 'first_mod_options'
            ? 'highlight-target animate-pulse ring-4 ring-primary shadow-[0_0_20px_rgba(var(--color-primary-rgb),0.8)] scale-110'
            : ''
        }`}
        title="Mod Options"
      >
        <Settings size={14} />
      </button>

      {createPortal(
        <AnimatePresence>
          {isMenuOpen &&
            (() => {
              const spaceBelow = window.innerHeight - menuPos.bottom;
              const spaceAbove = menuPos.top;
              const openUpwards = spaceBelow < 420 && spaceAbove > spaceBelow;
              const maxMenuHeight = Math.max(
                180,
                Math.min(openUpwards ? spaceAbove - 24 : spaceBelow - 24, 520)
              );
              const menuLeft = Math.max(12, Math.min(menuPos.right - 208, window.innerWidth - 220));

              return (
                <motion.div
                  key="mod-menu"
                  ref={portalMenuRef}
                  initial={{
                    opacity: 0,
                    scale: 0.95,
                    y: openUpwards ? 8 : -8,
                  }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{
                    opacity: 0,
                    scale: 0.95,
                    y: openUpwards ? 8 : -8,
                  }}
                  transition={{ duration: 0.15 }}
                  style={{
                    position: 'fixed',
                    top: openUpwards ? undefined : `${menuPos.bottom + 8}px`,
                    bottom: openUpwards ? `${window.innerHeight - menuPos.top + 8}px` : undefined,
                    left: `${menuLeft}px`,
                    maxHeight: `${maxMenuHeight}px`,
                    zIndex: 9999,
                  }}
                  className="w-52 bg-surface/95 app-blur border border-textMain/10 rounded-2xl shadow-2xl overflow-y-auto custom-scrollbar flex flex-col"
                >
                  {mod.meta &&
                    (mod.meta.source_url ||
                      mod.meta.author ||
                      mod.meta.original_file_name ||
                      mod.meta.downloaded_at) && (
                      <div
                        className="px-4 py-3 text-xs text-textMuted border-b border-textMain/5 bg-black/20 flex flex-col gap-1.5 cursor-default"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {(mod.meta.source_url || mod.meta.gb_mod_id) && (
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              const url =
                                mod.meta!.source_url ||
                                `https://gamebanana.com/mods/${mod.meta!.gb_mod_id}`;
                              tauriCommands.system.openUrl(url);
                            }}
                            className="text-primary hover:underline truncate flex items-center gap-1.5 font-semibold text-xs"
                            title="Open GameBanana Page"
                          >
                            <Globe size={12} />
                            <span>GameBanana Page</span>
                          </a>
                        )}
                        {mod.meta.author && (
                          <div className="truncate" title={mod.meta.author}>
                            <span className="font-bold text-textMain/70">Author:</span>{' '}
                            {mod.meta.author}
                          </div>
                        )}
                        {mod.meta.original_file_name && (
                          <div className="truncate" title={mod.meta.original_file_name}>
                            <span className="font-bold text-textMain/70">File:</span>{' '}
                            {mod.meta.original_file_name}
                          </div>
                        )}
                        {mod.meta.downloaded_at && (
                          <div className="truncate">
                            <span className="font-bold text-textMain/70">Date:</span>{' '}
                            {new Date(parseInt(mod.meta.downloaded_at) * 1000).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      onOpenMoveModal();
                    }}
                    className="w-full text-left px-4 py-3 text-sm font-bold text-textMain hover:bg-white/5 hover:text-primary transition-colors flex items-center gap-2 border-b border-textMain/5 cursor-pointer"
                  >
                    <FolderInput size={16} /> {t('move_to_category')}
                  </button>

                  {hasHashConflict && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsMenuOpen(false);
                        if (onOpenHashConflictsModal) onOpenHashConflictsModal();
                        else
                          onOpenWarningsModal?.(
                            conflictWarnings.length > 0 ? conflictWarnings : filteredWarnings
                          );
                      }}
                      className="w-full text-left px-4 py-3 text-sm font-bold text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2 border-b border-textMain/5 cursor-pointer"
                    >
                      <ShieldAlert size={16} /> {t('view_conflicts', 'View Hash Conflicts')}
                    </button>
                  )}

                  {multiCharWarnings.length > 0 && onOpenWarningsModal && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsMenuOpen(false);
                        onOpenWarningsModal(multiCharWarnings);
                      }}
                      className="w-full text-left px-4 py-3 text-sm font-bold text-yellow-400 hover:bg-yellow-500/10 transition-colors flex items-center gap-2 border-b border-textMain/5 cursor-pointer"
                    >
                      <Users size={16} />{' '}
                      {t('view_multi_char_warnings', 'Multi-Character Warnings')} (
                      {multiCharWarnings.length})
                    </button>
                  )}

                  {outdatedWarnings.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsMenuOpen(false);
                        onOpenFixMod();
                      }}
                      className="w-full text-left px-4 py-3 text-sm font-bold text-amber-400 hover:bg-amber-500/10 transition-colors flex items-center gap-2 border-b border-textMain/5 cursor-pointer"
                    >
                      <Sparkles size={16} /> {t('upgrade_mod_option', 'Upgrade Mod (Version Fix)')}
                    </button>
                  )}

                  {iniWarnings.length > 0 && onOpenWarningsModal && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsMenuOpen(false);
                        onOpenWarningsModal(iniWarnings);
                      }}
                      className="w-full text-left px-4 py-3 text-sm font-bold text-sky-400 hover:bg-sky-500/10 transition-colors flex items-center gap-2 border-b border-textMain/5 cursor-pointer"
                    >
                      <FileCode size={16} /> {t('view_ini_warnings', 'INI Script Issues')} (
                      {iniWarnings.length})
                    </button>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      onOpenEditNote();
                    }}
                    className="w-full text-left px-4 py-3 text-sm font-bold text-textMain hover:bg-white/5 hover:text-primary transition-colors flex items-center gap-2 border-b border-textMain/5 cursor-pointer"
                  >
                    <Pencil size={16} /> {t('edit_notes')}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      onOpenEditTags();
                    }}
                    className="w-full text-left px-4 py-3 text-sm font-bold text-textMain hover:bg-white/5 hover:text-primary transition-colors flex items-center gap-2 border-b border-textMain/5 cursor-pointer"
                  >
                    <Tag size={16} /> {t('edit_tags', 'Edit Tags')}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      onOpenRenameModal();
                    }}
                    className="w-full text-left px-4 py-3 text-sm font-bold text-textMain hover:bg-white/5 hover:text-primary transition-colors flex items-center gap-2 border-b border-textMain/5 cursor-pointer"
                  >
                    <Pencil size={16} /> {t('rename_mod')}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      onOpenAdvanced('3d');
                    }}
                    className="w-full text-left px-4 py-3 text-sm font-bold text-purple-400 hover:bg-purple-500/10 transition-colors flex items-center gap-2 border-b border-textMain/5 cursor-pointer"
                  >
                    <Box size={16} /> {t('mod_viewer_open', 'Preview 3D')}
                  </button>

                  {hasInstallConflict && onOpenResolveConflictModal && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsMenuOpen(false);
                        onOpenResolveConflictModal();
                      }}
                      className="w-full text-left px-4 py-3 text-sm font-bold text-amber-400 hover:bg-white/5 transition-colors flex items-center gap-2 border-b border-textMain/5 cursor-pointer"
                    >
                      <ShieldAlert size={16} /> {t('resolve_conflict')}
                    </button>
                  )}

                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      const confirmed = await confirm(
                        'Are you sure you want to completely delete this mod? This action cannot be undone.',
                        { title: 'Delete Mod', kind: 'warning' }
                      );
                      if (confirmed) {
                        onDeleteMod();
                      }
                    }}
                    className="w-full text-left px-4 py-3 text-sm font-bold text-red-400 hover:bg-white/5 hover:text-red-300 transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <Trash2 size={16} /> {t('delete_mod')}
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
