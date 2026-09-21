import { motion, AnimatePresence } from 'framer-motion';
import { confirm } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useState, memo, useCallback } from 'react';
import { Package, FolderOpen, Image as ImageIcon, Trash2, Box } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { EntityDBInfo, CharacterSkin, ModInfo, ModWarning } from '../../types';
import { useAppStore, type AppStore } from '../../store/useAppStore';
import { ModUpdaterModal } from '../Modals/ModUpdaterModal';
import { TagEditorModal } from '../Modals/TagEditorModal';
import { ModAdvancedPanel, type AdvancedTab } from '../Modals/ModAdvancedPanel';
import { FixModModal } from '../Modals/FixModModal';
import { RestoreBackupModal } from '../Modals/RestoreBackupModal';
import { ModCardBadges } from './ModCardBadges';
import { ModCardActionsMenu } from './ModCardActionsMenu';
import { ModCardNotes } from './ModCardNotes';
import { tauriCommands } from '../../services/tauriCommands';
import { isModMatchingIdentifier } from '../../utils/modPath';
import {
  DEFAULT_MOD_CARD_CUSTOMIZATION,
  getBorderRadiusClass,
  getAspectRatioClass,
  getElementalTheme,
} from '../../types/cardCustomization';

const getImageUrl = (url?: string) => {
  if (!url) return undefined;
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('data:') ||
    url.startsWith('asset://')
  )
    return url;
  if (!url.includes(':') && !url.startsWith('/') && !url.startsWith('\\')) {
    return undefined;
  }
  return convertFileSrc(url);
};

export interface ModCardProps {
  mod: ModInfo;
  character: EntityDBInfo | null;
  skin?: CharacterSkin | null;
  categoryName?: string;
  isIgnored: boolean;
  isFavorite: boolean;
  isBatchMode?: boolean;
  isSelected?: boolean;
  onSelect?: (isShift: boolean) => void;
  toggleIgnoreMod: (modName: string) => void;
  toggleFavoriteMod: (modName: string) => void;
  toggleMod: (modPath: string, currentlyEnabled: boolean) => void;
  deleteMod: (modPath: string, displayName?: string) => void;
  openKeybindEditor: (mod: ModInfo) => void;
  openRenameModal: (mod: ModInfo) => void;
  openMoveModal: (mod: ModInfo) => void;
  openResolveConflictModal?: (mod: ModInfo) => void;
  openResolveModal?: (mod: ModInfo) => void;
  openSplitModal?: (mod: ModInfo) => void;
  openWarningsModal?: (mod: ModInfo, warnings: (ModWarning | string)[]) => void;
  openHashConflictsModal?: (mod: ModInfo) => void;
  onRefresh: () => void;
  isFirstCard?: boolean;
}

const selectHighlightTargetId = (s: AppStore) => s.highlightTargetId;
const selectSetModNote = (s: AppStore) => s.setModNote;
const selectGetFilteredWarnings = (s: AppStore) => s.getFilteredWarnings;
const selectToggleFilterTag = (s: AppStore) => s.toggleFilterTag;
const selectCheckOrPromptExperimental = (s: AppStore) => s.checkOrPromptExperimental;
const selectFallbackGbPreviews = (s: AppStore) => s.fallbackGbPreviews;
const selectGbPreviewCache = (s: AppStore) => s.gbPreviewCache;

const EMPTY_STR_ARRAY: string[] = [];

export const ModCard = memo(function ModCard({
  mod,
  character,
  skin,
  categoryName,
  isIgnored,
  isFavorite,
  isBatchMode = false,
  isSelected = false,
  onSelect,
  toggleIgnoreMod,
  toggleFavoriteMod,
  toggleMod,
  deleteMod,
  openKeybindEditor,
  openRenameModal,
  openMoveModal,
  openResolveConflictModal,
  openResolveModal,
  openWarningsModal,
  openHashConflictsModal,
  onRefresh,
  isFirstCard,
}: ModCardProps) {
  const { t } = useTranslation();
  const highlightTargetId = useAppStore(selectHighlightTargetId);
  const setModNote = useAppStore(selectSetModNote);
  const getFilteredWarnings = useAppStore(selectGetFilteredWarnings);
  const toggleFilterTag = useAppStore(selectToggleFilterTag);
  const checkOrPromptExperimental = useAppStore(selectCheckOrPromptExperimental);
  const fallbackGbPreviews = useAppStore(selectFallbackGbPreviews);
  const gbPreviewCache = useAppStore(selectGbPreviewCache);
  const cardCustomization =
    useAppStore((s) => s.cardCustomization) || DEFAULT_MOD_CARD_CUSTOMIZATION;

  const actionButtonBaseClass = `p-2.5 rounded-full border transition-all shadow-lg flex items-center justify-center cursor-pointer ${
    cardCustomization.actionButtons.buttonStyle === 'solid'
      ? 'bg-surface border-textMain/20'
      : cardCustomization.actionButtons.buttonStyle === 'transparent'
        ? 'bg-black/30 border-white/10 hover:bg-black/50'
        : 'bg-background/80 border-textMain/10 backdrop-blur-md hover:bg-surface'
  } ${
    cardCustomization.actionButtons.iconColor === 'primary'
      ? 'text-primary'
      : cardCustomization.actionButtons.iconColor === 'white'
        ? 'text-white'
        : 'text-textMuted hover:text-textMain'
  }`;

  const togglePaddingClass =
    cardCustomization.toggleButton.buttonPadding === 'compact'
      ? 'py-2 text-xs'
      : cardCustomization.toggleButton.buttonPadding === 'large'
        ? 'py-3.5 text-base'
        : 'py-3 text-sm';

  const toggleRadiusClass =
    cardCustomization.toggleButton.borderRadius === 'match'
      ? getBorderRadiusClass(cardCustomization.frame.borderRadius)
      : cardCustomization.toggleButton.borderRadius === 'md'
        ? 'rounded-md'
        : cardCustomization.toggleButton.borderRadius === 'lg'
          ? 'rounded-lg'
          : cardCustomization.toggleButton.borderRadius === 'full'
            ? 'rounded-full'
            : 'rounded-xl';

  const frameBorderWidthClass =
    cardCustomization.frame.borderWidth === 0
      ? 'border-0'
      : cardCustomization.frame.borderWidth === 2
        ? 'border-2'
        : cardCustomization.frame.borderWidth === 3
          ? 'border-[3px]'
          : 'border';

  const elementalTheme = getElementalTheme(character?.element);

  const frameBorderColorClass = isSelected
    ? 'border-primary ring-2 ring-primary/50'
    : cardCustomization.frame.borderColor === 'element'
      ? elementalTheme.borderClass
      : cardCustomization.frame.borderColor === 'primary'
        ? 'border-primary'
        : cardCustomization.frame.borderColor === 'white'
          ? 'border-white/30'
          : cardCustomization.frame.borderColor === 'none'
            ? 'border-transparent'
            : 'border-textMain/10';

  const frameShadowClass =
    cardCustomization.frame.shadowIntensity === 'none'
      ? 'shadow-none'
      : cardCustomization.frame.shadowIntensity === 'subtle'
        ? 'shadow-md'
        : cardCustomization.frame.shadowIntensity === 'intense'
          ? cardCustomization.frame.elementalGlow
            ? elementalTheme.glowShadowClass
            : 'shadow-2xl shadow-primary/20'
          : cardCustomization.frame.elementalGlow
            ? elementalTheme.glowShadowClass
            : 'shadow-xl';

  const sizeBytes: number | null = mod.total_size_bytes ?? null;
  const [showUpdaterModal, setShowUpdaterModal] = useState(false);
  const [showFixModModal, setShowFixModModal] = useState(false);
  const [showRestoreBackupModal, setShowRestoreBackupModal] = useState(false);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [advancedTab, setAdvancedTab] = useState<AdvancedTab>('3d');
  const [cropperSource, setCropperSource] = useState<string | null>(null);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [isDraggingCard, setIsDraggingCard] = useState(false);

  const normPath = mod.full_path.replace(/\\/g, '/');

  const isToggling = useAppStore(
    useCallback(
      (s: AppStore) => s.togglingMods.has(mod.full_path) || s.togglingMods.has(normPath),
      [mod.full_path, normPath]
    )
  );

  const invalidHashes = useAppStore(
    useCallback(
      (s: AppStore) => s.staleHashes[normPath] || s.staleHashes[mod.full_path] || EMPTY_STR_ARRAY,
      [mod.full_path, normPath]
    )
  );
  const isStale = invalidHashes.length > 0;

  const updateAvailable = useAppStore(
    useCallback(
      (s: AppStore) =>
        s.availableUpdates.find((u) => u.mod_path === mod.full_path || u.mod_path === normPath),
      [mod.full_path, normPath]
    )
  );

  const hasRuntimeConflict = useAppStore(
    useCallback(
      (s: AppStore) => {
        if (!mod.is_enabled) return false;
        return s.modConflicts.some((c) =>
          c.conflicting_mods.some((m: string) =>
            isModMatchingIdentifier(mod.full_path, m, s.modsPath)
          )
        );
      },
      [mod.full_path, mod.is_enabled]
    )
  );

  const filteredWarnings = getFilteredWarnings(mod.full_path);
  const outdatedWarnings = filteredWarnings.filter(
    (w: ModWarning) => w.rule_id === 'outdated_version' || w.level === 'outdated_version'
  );
  const conflictWarnings = mod.is_enabled
    ? filteredWarnings.filter(
        (w: ModWarning) =>
          w.rule_id === 'conflict' || w.level === 'conflict' || w.level === 'critical'
      )
    : [];
  const multiCharWarnings = filteredWarnings.filter(
    (w: ModWarning) => w.rule_id === 'multi_character' || w.level === 'warning'
  );
  const iniWarnings = filteredWarnings.filter(
    (w: ModWarning) =>
      w.rule_id === 'rogue_hud' ||
      w.rule_id === 'standalone_help' ||
      w.rule_id === 'unconditional_key' ||
      w.rule_id === 'missing_vertex_limit_override' ||
      w.rule_id === 'missing_resource_definition' ||
      w.level === 'ini_issue' ||
      w.level === 'crash_risk' ||
      w.level === 'info'
  );

  const hasInstallConflict = mod.full_path.includes('_Conflicts');
  const hasHashConflict =
    (mod.is_enabled && hasRuntimeConflict) || hasInstallConflict || conflictWarnings.length > 0;

  const handleSaveNote = async (newNote: string) => {
    try {
      await setModNote(mod.full_path, newNote);
      setIsEditingNote(false);
      onRefresh();
    } catch (err) {
      console.error('Failed to save note:', err);
    }
  };

  const handleCardDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingCard) setIsDraggingCard(true);
  };

  const handleCardDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingCard(false);
  };

  const handleCardDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingCard(false);

    const files = Array.from(e.dataTransfer.files) as (File & { path?: string })[];
    const image = files.find((f) => f.path && /\.(png|jpg|jpeg|webp)$/i.test(f.path));
    if (image?.path) {
      setCropperSource(image.path);
      setAdvancedTab('crop');
      setIsAdvancedOpen(true);
    }
  };

  return (
    <motion.div
      onDragOver={handleCardDragOver}
      onDragLeave={handleCardDragLeave}
      onDrop={handleCardDrop}
      onClick={(e) => {
        if (isBatchMode) {
          onSelect?.(e.shiftKey);
        }
      }}
      whileHover={{ scale: 1.03, y: -4 }}
      transition={{ duration: 0.05 }}
      data-highlight-id={isFirstCard ? 'first_mod_card' : undefined}
      style={{
        backgroundColor: `rgba(var(--bg-surface), ${cardCustomization.frame.bgOpacity / 100})`,
        backdropFilter: `blur(${cardCustomization.frame.blurAmount}px)`,
        WebkitBackdropFilter: `blur(${cardCustomization.frame.blurAmount}px)`,
      }}
      className={`mod-card-frame overflow-hidden transition-colors duration-75 group flex flex-col relative mod-card-containment ${getBorderRadiusClass(
        cardCustomization.frame.borderRadius
      )} ${frameBorderWidthClass} ${frameBorderColorClass} ${frameShadowClass} ${
        isBatchMode ? 'cursor-pointer' : ''
      } ${isFirstCard && highlightTargetId === 'first_mod_card' ? 'highlight-target' : ''}`}
    >
      <AnimatePresence>
        {isDraggingCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-primary/30 backdrop-blur-sm z-50 flex flex-col items-center justify-center border-2 border-dashed border-primary p-2 text-center pointer-events-none"
          >
            <ImageIcon size={32} className="text-primary animate-bounce mb-2" />
            <span className="text-xs font-bold text-white">{t('drop_to_set_preview')}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={`${getAspectRatioClass(
          cardCustomization.frame.aspectRatio
        )} bg-background flex items-center justify-center relative overflow-hidden`}
      >
        {(() => {
          const gbFallbackUrl =
            fallbackGbPreviews && !mod.preview_url && mod.meta?.gb_mod_id
              ? gbPreviewCache[mod.meta.gb_mod_id]
              : undefined;
          const displayImageSrc =
            mod.thumbnail_url ||
            mod.preview_url ||
            gbFallbackUrl ||
            skin?.image_url ||
            character?.image_url;

          return mod.preview_url || gbFallbackUrl || character ? (
            <>
              <img
                src={getImageUrl(displayImageSrc)}
                alt={skin?.name || character?.name || mod.name}
                loading="lazy"
                decoding="async"
                className={`absolute h-full w-auto max-w-none left-1/2 -translate-x-1/2 object-cover opacity-90 ${
                  cardCustomization.imageOverlay.imageHoverZoom ? 'group-hover:scale-105' : ''
                } transition-transform duration-75`}
              />
              <div
                className="absolute inset-0 pointer-events-none transition-all"
                style={{
                  background: `linear-gradient(to top, rgba(0,0,0,${
                    cardCustomization.imageOverlay.darkeningGradient / 100
                  }) 0%, rgba(0,0,0,${
                    (cardCustomization.imageOverlay.darkeningGradient * 0.4) / 100
                  }) 55%, transparent 100%)`,
                }}
              />
            </>
          ) : (
            <Package size={64} className="opacity-10 text-white" />
          );
        })()}

        {/* Badges & Warning Icons */}
        <ModCardBadges
          mod={mod}
          isFavorite={isFavorite}
          isIgnored={isIgnored}
          isBatchMode={isBatchMode}
          isSelected={isSelected}
          sizeBytes={sizeBytes}
          hasUpdateAvailable={!!updateAvailable}
          outdatedWarnings={outdatedWarnings}
          hasBackup={!!mod.has_backup}
          isStale={isStale}
          invalidHashes={invalidHashes}
          hasHashConflict={hasHashConflict}
          multiCharWarnings={multiCharWarnings}
          iniWarnings={iniWarnings}
          onToggleFavorite={(e) => {
            e.stopPropagation();
            toggleFavoriteMod(mod.name);
          }}
          onToggleIgnore={(e) => {
            e.stopPropagation();
            toggleIgnoreMod(mod.name);
          }}
          onToggleSelect={(e) => {
            e.stopPropagation();
            onSelect?.(e.shiftKey);
          }}
          onOpenUpdater={(e) => {
            e.stopPropagation();
            setShowUpdaterModal(true);
          }}
          onOpenFixMod={(e) => {
            e.stopPropagation();
            if (!checkOrPromptExperimental(t('experimental_feat_fixer', 'Mod Fixer'))) return;
            setShowFixModModal(true);
          }}
          onOpenRestoreBackup={(e) => {
            e.stopPropagation();
            setShowRestoreBackupModal(true);
          }}
          onOpenHashConflicts={(e) => {
            e.stopPropagation();
            if (openHashConflictsModal) openHashConflictsModal(mod);
            else
              openWarningsModal?.(
                mod,
                conflictWarnings.length > 0 ? conflictWarnings : filteredWarnings
              );
          }}
          onOpenMultiCharWarnings={(e) => {
            e.stopPropagation();
            openWarningsModal?.(mod, multiCharWarnings);
          }}
          onOpenIniWarnings={(e) => {
            e.stopPropagation();
            openWarningsModal?.(mod, iniWarnings);
          }}
        />

        {/* Bottom-Left Quick Open Folder & 3D Preview */}
        <div className="absolute bottom-3 left-3 flex gap-1.5 items-center z-20">
          {cardCustomization.actionButtons.showFolderButton && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                tauriCommands.system.openFolder(mod.full_path).catch(console.error);
              }}
              className={actionButtonBaseClass}
              title="Open Mod Folder"
            >
              <FolderOpen size={14} />
            </button>
          )}
          {cardCustomization.actionButtons.show3dPreviewButton && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setAdvancedTab('3d');
                setIsAdvancedOpen(true);
              }}
              className={`${actionButtonBaseClass} text-purple-400 hover:text-purple-300`}
              title={t('mod_advanced_btn', 'Advanced')}
            >
              <Box size={14} />
            </button>
          )}
        </div>

        {/* Bottom-Right Options Menu */}
        {cardCustomization.actionButtons.showOptionsMenuButton && (
          <ModCardActionsMenu
            mod={mod}
            isFirstCard={isFirstCard}
            highlightTargetId={highlightTargetId}
            hasHashConflict={hasHashConflict}
            hasInstallConflict={hasInstallConflict}
            multiCharWarnings={multiCharWarnings}
            outdatedWarnings={outdatedWarnings}
            iniWarnings={iniWarnings}
            conflictWarnings={conflictWarnings}
            filteredWarnings={filteredWarnings}
            onOpenMoveModal={() => openMoveModal(mod)}
            onOpenRenameModal={() => openRenameModal(mod)}
            onOpenResolveConflictModal={
              openResolveConflictModal || openResolveModal
                ? () => (openResolveConflictModal || openResolveModal)?.(mod)
                : undefined
            }
            onOpenHashConflictsModal={
              openHashConflictsModal ? () => openHashConflictsModal(mod) : undefined
            }
            onOpenWarningsModal={
              openWarningsModal ? (warnings) => openWarningsModal(mod, warnings) : undefined
            }
            onOpenFixMod={() => {
              if (!checkOrPromptExperimental(t('experimental_feat_fixer', 'Mod Fixer'))) return;
              setShowFixModModal(true);
            }}
            onOpenRestoreBackup={() => setShowRestoreBackupModal(true)}
            onOpenEditTags={() => setIsEditingTags(true)}
            onOpenEditNote={() => setIsEditingNote(true)}
            onOpenAdvanced={(tab) => {
              setAdvancedTab(tab);
              setIsAdvancedOpen(true);
            }}
            onDeleteMod={() => deleteMod(mod.full_path, mod.name)}
          />
        )}

        {!mod.is_enabled && (
          <div className="absolute inset-0 bg-black/75 flex items-center justify-center z-10 pointer-events-none">
            <span className="text-red-400 font-black tracking-widest uppercase rotate-[-15deg] border-4 border-red-400/50 px-6 py-2 rounded-xl text-xl shadow-[0_0_30px_rgba(255,0,0,0.2)]">
              Disabled
            </span>
          </div>
        )}
      </div>

      <div
        style={{
          backgroundColor: `rgba(var(--bg-surface), ${cardCustomization.infoPanel.bgOpacity / 100})`,
          backdropFilter: `blur(${cardCustomization.infoPanel.blurAmount}px)`,
          WebkitBackdropFilter: `blur(${cardCustomization.infoPanel.blurAmount}px)`,
        }}
        className="p-5 flex flex-col gap-4 relative z-20 border-t border-textMain/10 flex-1 justify-between"
      >
        <div>
          <h3
            className={`font-bold text-base leading-tight line-clamp-2 transition-colors min-w-0 ${
              cardCustomization.infoPanel.titleColor === 'primary'
                ? 'text-primary'
                : cardCustomization.infoPanel.titleColor === 'white'
                  ? 'text-white'
                  : 'text-textMain group-hover:text-primary'
            }`}
            title={mod.name.replace(/^(DISABLED_|DISABLED )/, '')}
          >
            {mod.name.replace(/^(DISABLED_|DISABLED )/, '')}
          </h3>
          {cardCustomization.infoPanel.showCategorySubtitle && categoryName && (
            <span
              className={`text-[11px] font-semibold block mt-1 truncate ${
                cardCustomization.frame.elementalGlow
                  ? elementalTheme.textColorClass
                  : 'text-primary/80'
              }`}
            >
              {categoryName}
            </span>
          )}
        </div>

        {/* Mod Tags */}
        {cardCustomization.infoPanel.showTags && mod.meta?.tags && mod.meta.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {mod.meta.tags.map((tag) => (
              <span
                key={tag}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFilterTag(tag);
                }}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-colors ${
                  cardCustomization.frame.elementalGlow
                    ? elementalTheme.badgeBgClass
                    : 'bg-primary/15 text-primary border border-primary/20 hover:bg-primary/25'
                }`}
                title={t('filter_by_tag', `Filter by tag: {{tag}}`, { tag })}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Mod Notes Section */}
        <ModCardNotes
          initialNotes={mod.meta?.notes ?? ''}
          isEditing={isEditingNote}
          onSave={handleSaveNote}
          onCancel={() => setIsEditingNote(false)}
        />

        {/* Footer Actions */}
        <div className="flex flex-col gap-2 mt-auto">
          <button
            onClick={() => toggleMod(mod.full_path, mod.is_enabled)}
            disabled={isToggling}
            data-highlight-id={isFirstCard ? 'first_mod_toggle' : undefined}
            className={`w-full ${togglePaddingClass} ${toggleRadiusClass} font-bold transition-all duration-300 disabled:opacity-50 cursor-pointer ${
              mod.is_enabled
                ? 'bg-white/5 hover:bg-red-500/20 text-textMuted hover:text-red-400 border border-white/5 hover:border-red-500/30'
                : `bg-primary text-white hover:bg-primary/80 ${
                    cardCustomization.toggleButton.glowEffect
                      ? cardCustomization.frame.elementalGlow
                        ? elementalTheme.glowShadowClass
                        : 'shadow-lg shadow-primary/30'
                      : ''
                  }`
            } ${
              isFirstCard && highlightTargetId === 'first_mod_toggle'
                ? 'highlight-target animate-pulse ring-4 ring-primary shadow-[0_0_20px_rgba(var(--color-primary-rgb),0.8)]'
                : ''
            }`}
          >
            {mod.is_enabled ? t('disable_mod') : t('enable_mod')}
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => openKeybindEditor(mod)}
              data-highlight-id={isFirstCard ? 'first_mod_keybinds' : undefined}
              className={`flex-1 py-2.5 bg-background/50 hover:bg-textMain/10 rounded-xl text-xs font-bold text-textMuted hover:text-textMain border border-textMain/10 transition-all cursor-pointer ${
                isFirstCard && highlightTargetId === 'first_mod_keybinds'
                  ? 'highlight-target animate-pulse ring-4 ring-primary shadow-[0_0_20px_rgba(var(--color-primary-rgb),0.8)]'
                  : ''
              }`}
            >
              {t('edit_keybinds')}
            </button>

            <button
              onClick={async (e) => {
                e.stopPropagation();
                const confirmed = await confirm(
                  'Are you sure you want to completely delete this mod? This action cannot be undone.',
                  { title: 'Delete Mod', kind: 'warning' }
                );
                if (confirmed) {
                  deleteMod(mod.full_path, mod.name);
                }
              }}
              data-highlight-id={isFirstCard ? 'first_mod_delete' : undefined}
              className={`px-3 py-2.5 bg-background/50 hover:bg-red-500/20 rounded-xl text-xs font-bold text-textMuted hover:text-red-400 border border-textMain/10 hover:border-red-500/30 transition-all flex items-center justify-center cursor-pointer ${
                isFirstCard && highlightTargetId === 'first_mod_delete'
                  ? 'highlight-target animate-pulse ring-4 ring-red-500 shadow-[0_0_20px_rgba(239,68,68,0.9)] bg-red-500/30 text-white scale-110'
                  : ''
              }`}
              title={t('delete_mod')}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {showUpdaterModal && updateAvailable && (
        <ModUpdaterModal update={updateAvailable} onClose={() => setShowUpdaterModal(false)} />
      )}

      {isEditingTags && (
        <TagEditorModal
          mod={mod}
          onClose={() => {
            setIsEditingTags(false);
            onRefresh();
          }}
        />
      )}

      {isAdvancedOpen && (
        <ModAdvancedPanel
          mod={mod}
          initialTab={advancedTab}
          initialCropperSrc={cropperSource}
          onClose={() => {
            setIsAdvancedOpen(false);
            setCropperSource(null);
          }}
          onRefresh={onRefresh}
        />
      )}

      {showFixModModal && (
        <FixModModal
          modPath={mod.full_path}
          modName={mod.name}
          onClose={() => setShowFixModModal(false)}
          onFixApplied={onRefresh}
        />
      )}

      {showRestoreBackupModal && (
        <RestoreBackupModal
          modPath={mod.full_path}
          modName={mod.name}
          onClose={() => setShowRestoreBackupModal(false)}
          onRestored={onRefresh}
        />
      )}
    </motion.div>
  );
});

ModCard.displayName = 'ModCard';
