import { useState, useMemo } from 'react';
import {
  Folder,
  FolderPlus,
  FolderTree,
  FolderCog,
  FolderOpen,
  FolderDown,
  Sparkles,
  Trash2,
  Edit2,
  Check,
  X,
  Search,
  Shield,
  User,
  AlertTriangle,
  Loader2,
  Users,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { CategoryInfo, EntityDBInfo, resolveCategoryEntity } from '../../types';
import { tauriCommands } from '../../services/tauriCommands';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';

export interface FolderManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryInfo[];
  currentDB: EntityDBInfo[];
  rootPath: string;
  onRefresh: () => void | Promise<void>;
  onOpenMappingModal?: (category: CategoryInfo) => void;
  onOpenImportMods?: () => void;
}

type FolderFilterTab = 'all' | 'canonical' | 'custom' | 'essential';

export function FolderManagementModal({
  isOpen,
  onClose,
  categories,
  currentDB,
  rootPath,
  onRefresh,
  onOpenMappingModal,
  onOpenImportMods,
}: FolderManagementModalProps) {
  const { t } = useTranslation();
  const selectedCategory = useAppStore((s) => s.selectedCategory);
  const setSelectedCategory = useAppStore((s) => s.setSelectedCategory);

  const [activeTab, setActiveTab] = useState<FolderFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Creation State
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedCharId, setSelectedCharId] = useState('');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Rename State
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isSubmittingRename, setIsSubmittingRename] = useState(false);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<{
    category: CategoryInfo;
    hasMods: boolean;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Batch actions
  const [isGeneratingEssentials, setIsGeneratingEssentials] = useState(false);
  const [isGeneratingCharacterFolders, setIsGeneratingCharacterFolders] = useState(false);

  // Feedback Messages
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clearFeedback = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  // Classify each category
  const classifiedFolders = useMemo(() => {
    return categories.map((cat) => {
      const lower = cat.category_name.toLowerCase();
      const isEssential = ['unassigned', '_conflicts', '.staging', 'ui'].includes(lower);
      const entity = resolveCategoryEntity(cat.category_name, cat.character_id, currentDB);
      const isCanonical = !isEssential && entity !== null;
      const isCustom = !isEssential && !isCanonical;

      return {
        category: cat,
        isEssential,
        isCanonical,
        isCustom,
        entity,
        modsCount: (cat.mods || []).length,
      };
    });
  }, [categories, currentDB]);

  // Counts for tabs
  const tabCounts = useMemo(() => {
    let canonical = 0;
    let custom = 0;
    let essential = 0;
    for (const f of classifiedFolders) {
      if (f.isEssential) essential++;
      else if (f.isCanonical) canonical++;
      else custom++;
    }
    return {
      all: classifiedFolders.length,
      canonical,
      custom,
      essential,
    };
  }, [classifiedFolders]);

  // Filtered list
  const filteredFolders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return classifiedFolders.filter((f) => {
      if (activeTab === 'canonical' && !f.isCanonical) return false;
      if (activeTab === 'custom' && !f.isCustom) return false;
      if (activeTab === 'essential' && !f.isEssential) return false;

      if (!q) return true;
      const matchName = f.category.category_name.toLowerCase().includes(q);
      const matchChar = f.entity?.name.toLowerCase().includes(q);
      return matchName || matchChar;
    });
  }, [classifiedFolders, activeTab, searchQuery]);

  // Handler: Create Folder
  const handleCreateFolder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      setErrorMessage(t('folder_name_label', 'Folder Name') + ' is required.');
      return;
    }

    clearFeedback();
    setIsSubmittingCreate(true);
    try {
      const created = await tauriCommands.folders.create(
        rootPath,
        trimmed,
        selectedCharId || null,
        null
      );
      setSuccessMessage(t('folder_created_success', { name: created }));
      setNewFolderName('');
      setSelectedCharId('');
      setIsCreating(false);
      await Promise.resolve(onRefresh());
    } catch (err) {
      setErrorMessage(String(err));
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Handler: Start Rename
  const handleStartRename = (categoryName: string) => {
    clearFeedback();
    setRenamingFolder(categoryName);
    setRenameValue(categoryName);
  };

  // Handler: Commit Rename
  const handleCommitRename = async (oldName: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === oldName) {
      setRenamingFolder(null);
      return;
    }

    clearFeedback();
    setIsSubmittingRename(true);
    try {
      const renamed = await tauriCommands.folders.rename(rootPath, oldName, trimmed);
      setSuccessMessage(t('folder_renamed_success', { name: renamed }));
      if (selectedCategory === oldName) {
        setSelectedCategory(renamed);
      }
      setRenamingFolder(null);
      await Promise.resolve(onRefresh());
    } catch (err) {
      setErrorMessage(String(err));
    } finally {
      setIsSubmittingRename(false);
    }
  };

  // Handler: Delete Folder
  const handleExecuteDelete = async (categoryName: string, force: boolean, moveMods: boolean) => {
    clearFeedback();
    setIsDeleting(true);
    try {
      if (moveMods && deleteTarget) {
        const modPaths = deleteTarget.category.mods.map((m) => m.full_path);
        if (modPaths.length > 0) {
          await tauriCommands.mods.moveToUnassigned(modPaths, rootPath);
        }
      }

      await tauriCommands.folders.delete(rootPath, categoryName, force);
      setSuccessMessage(t('folder_deleted_success', { name: categoryName }));

      if (selectedCategory === categoryName) {
        setSelectedCategory(null);
      }
      setDeleteTarget(null);
      await Promise.resolve(onRefresh());
    } catch (err) {
      setErrorMessage(String(err));
    } finally {
      setIsDeleting(false);
    }
  };

  // Handler: Generate Essential Folders
  const handleGenerateEssentials = async () => {
    clearFeedback();
    setIsGeneratingEssentials(true);
    try {
      await tauriCommands.folders.generateEssential(rootPath);
      setSuccessMessage(
        t('essential_folders_generated_success', 'Essential system folders verified and generated.')
      );
      await Promise.resolve(onRefresh());
    } catch (err) {
      setErrorMessage(String(err));
    } finally {
      setIsGeneratingEssentials(false);
    }
  };

  // Handler: Generate Character Folders
  const handleGenerateCharacterFolders = async () => {
    clearFeedback();
    setIsGeneratingCharacterFolders(true);
    try {
      const missingFolders: { folder_name: string; character_id: string; skin_id?: string }[] = [];
      const existingNames = new Set(categories.map((c) => c.category_name.toLowerCase()));

      currentDB.forEach((char) => {
        if (!char.skins || char.skins.length === 0) {
          const folderName = `${char.name} - Default Outfit`;
          if (!existingNames.has(folderName.toLowerCase())) {
            missingFolders.push({ folder_name: folderName, character_id: char.id });
          }
        } else {
          char.skins.forEach((skin) => {
            const folderName = `${char.name} - ${skin.name}`;
            if (!existingNames.has(folderName.toLowerCase())) {
              missingFolders.push({
                folder_name: folderName,
                character_id: char.id,
                skin_id: skin.id,
              });
            }
          });
        }
      });

      if (missingFolders.length === 0) {
        setSuccessMessage('All character folders are already created.');
        return;
      }

      const created = await tauriCommands.install.generateFolders(rootPath, missingFolders);
      setSuccessMessage(`Successfully created ${created.length} character folders.`);
      await Promise.resolve(onRefresh());
    } catch (err) {
      setErrorMessage(String(err));
    } finally {
      setIsGeneratingCharacterFolders(false);
    }
  };

  // Handler: Open in Explorer
  const handleOpenFolder = (catName?: string) => {
    const target = catName ? `${rootPath}\\${catName}` : rootPath;
    tauriCommands.system.openFolder(target).catch(console.error);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('folder_management_title', 'Folder Management')}
      description={t(
        'folder_management_desc',
        'Create, rename, delete, and organize your mod categories and essential system directories.'
      )}
      icon={<FolderTree className="text-primary" size={24} />}
      maxWidth="4xl"
      maxHeight="max-h-[90vh]"
    >
      <div className="space-y-4">
        {/* Feedback Banners */}
        {successMessage && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold animate-in fade-in">
            <span className="flex items-center gap-2">
              <Check size={14} className="shrink-0" />
              {successMessage}
            </span>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-400/60 hover:text-emerald-300 p-0.5"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold animate-in fade-in">
            <span className="flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              {errorMessage}
            </span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400/60 hover:text-rose-300 p-0.5"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Global Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-surface/60 border border-white/5 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreating((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                isCreating
                  ? 'bg-primary text-background shadow-md shadow-primary/20'
                  : 'bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30'
              }`}
            >
              <FolderPlus size={14} />
              <span>{t('create_new_folder', 'New Folder')}</span>
            </button>

            <button
              onClick={handleGenerateEssentials}
              disabled={isGeneratingEssentials}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface hover:bg-white/10 text-xs font-semibold text-textMuted hover:text-textMain border border-white/5 transition-colors cursor-pointer disabled:opacity-50"
              title={t(
                'generate_essential_desc',
                'Pre-creates essential directories: Unassigned, _Conflicts, and .staging.'
              )}
            >
              {isGeneratingEssentials ? (
                <Loader2 size={14} className="animate-spin text-primary" />
              ) : (
                <Sparkles size={14} className="text-amber-400" />
              )}
              <span>{t('generate_essential_folders', 'Generate Essential Folders')}</span>
            </button>

            <button
              onClick={handleGenerateCharacterFolders}
              disabled={isGeneratingCharacterFolders}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface hover:bg-white/10 text-xs font-semibold text-textMuted hover:text-textMain border border-white/5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isGeneratingCharacterFolders ? (
                <Loader2 size={14} className="animate-spin text-primary" />
              ) : (
                <Users size={14} className="text-emerald-400" />
              )}
              <span>{t('generate_character_folders_btn', 'Generate Character Folders')}</span>
            </button>

            {onOpenImportMods && (
              <button
                type="button"
                onClick={onOpenImportMods}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface hover:bg-white/10 text-xs font-semibold text-textMuted hover:text-textMain border border-white/5 transition-colors cursor-pointer"
                title={t('import_mods_external_btn', 'Import External Mods')}
              >
                <FolderDown size={14} className="text-primary" />
                <span>{t('import_mods_external_btn', 'Import External Mods')}</span>
              </button>
            )}
          </div>

          <button
            onClick={() => handleOpenFolder()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface hover:bg-white/10 text-xs font-semibold text-textMuted hover:text-textMain border border-white/5 transition-colors cursor-pointer"
            title={rootPath}
          >
            <FolderOpen size={14} className="text-primary" />
            <span>{t('open_in_explorer', 'Open in Explorer')}</span>
          </button>
        </div>

        {/* Inline Create Folder Form */}
        {isCreating && (
          <form
            onSubmit={handleCreateFolder}
            className="p-4 rounded-2xl bg-surface/80 border border-primary/30 space-y-3 animate-in fade-in"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                <FolderPlus size={14} />
                {t('create_folder_title', 'Create New Folder')}
              </span>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-textMuted hover:text-textMain p-1"
              >
                <X size={14} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-textMuted mb-1">
                  {t('folder_name_label', 'Folder Name')} *
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder={t(
                    'folder_name_placeholder',
                    'e.g. My Custom Mods, Testing, Outfits'
                  )}
                  className="w-full px-3 py-2 rounded-xl bg-background/80 border border-white/10 text-xs text-textMain placeholder:text-textMuted/50 focus:outline-none focus:border-primary transition-colors"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-textMuted mb-1">
                  {t('map_to_character_label', 'Character Mapping (Optional)')}
                </label>
                <select
                  value={selectedCharId}
                  onChange={(e) => setSelectedCharId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-background/80 border border-white/10 text-xs text-textMain focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="">
                    {t('map_to_character_placeholder', 'None (Custom / Unmapped)')}
                  </option>
                  {currentDB.map((char) => (
                    <option key={char.id} value={char.id}>
                      {char.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-3 py-1.5 rounded-xl bg-surface hover:bg-white/10 text-xs font-semibold text-textMuted hover:text-textMain transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingCreate || !newFolderName.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary text-background text-xs font-bold hover:bg-primary/90 transition-colors shadow-md shadow-primary/20 disabled:opacity-50"
              >
                {isSubmittingCreate ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Check size={13} />
                )}
                <span>{t('btn_create_folder', 'Create Folder')}</span>
              </button>
            </div>
          </form>
        )}

        {/* Filter Tabs & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-surface border border-white/5">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'all'
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'text-textMuted hover:text-textMain'
              }`}
            >
              {t('folder_type_all', 'All Folders')} ({tabCounts.all})
            </button>
            <button
              onClick={() => setActiveTab('canonical')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'canonical'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-textMuted hover:text-textMain'
              }`}
            >
              {t('folder_type_canonical', 'Manager Generated')} ({tabCounts.canonical})
            </button>
            <button
              onClick={() => setActiveTab('custom')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'custom'
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  : 'text-textMuted hover:text-textMain'
              }`}
            >
              {t('folder_type_custom', 'Custom / Manual')} ({tabCounts.custom})
            </button>
            <button
              onClick={() => setActiveTab('essential')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'essential'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'text-textMuted hover:text-textMain'
              }`}
            >
              {t('folder_type_essential', 'Essential System')} ({tabCounts.essential})
            </button>
          </div>

          <div className="relative min-w-[220px]">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search_folders_placeholder', 'Search folders...')}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-surface border border-white/5 text-xs text-textMain placeholder:text-textMuted/50 focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>

        {/* Folders List */}
        <div className="space-y-2 max-h-[46vh] overflow-y-auto custom-scrollbar pr-1">
          {filteredFolders.length === 0 ? (
            <div className="p-8 text-center text-textMuted text-xs font-medium bg-surface/30 rounded-2xl border border-white/5">
              {t('no_folders_found', 'No folders found matching your search.')}
            </div>
          ) : (
            filteredFolders.map(
              ({ category, isEssential, isCanonical, isCustom, entity, modsCount }) => {
                const isRenamingThis = renamingFolder === category.category_name;

                return (
                  <div
                    key={category.category_name}
                    className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-surface/40 hover:bg-surface/70 border border-white/5 hover:border-white/10 transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                          isEssential
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            : isCanonical
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                        }`}
                      >
                        {isEssential ? (
                          <Shield size={16} />
                        ) : isCanonical ? (
                          <User size={16} />
                        ) : (
                          <Folder size={16} />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        {isRenamingThis ? (
                          <div className="flex items-center gap-2 max-w-sm">
                            <input
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCommitRename(category.category_name);
                                if (e.key === 'Escape') setRenamingFolder(null);
                              }}
                              className="px-2 py-1 rounded-lg bg-background border border-primary text-xs text-textMain focus:outline-none w-full"
                              autoFocus
                            />
                            <button
                              onClick={() => handleCommitRename(category.category_name)}
                              disabled={isSubmittingRename}
                              className="p-1 rounded-lg bg-primary text-background hover:bg-primary/90 transition-colors"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              onClick={() => setRenamingFolder(null)}
                              className="p-1 rounded-lg bg-surface text-textMuted hover:text-textMain transition-colors"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-bold text-textMain truncate">
                              {category.category_name}
                            </span>
                            {entity && (
                              <span className="text-[10px] text-textMuted truncate">
                                ({entity.name})
                              </span>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-2 mt-0.5">
                          {isEssential && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              {t('folder_type_essential', 'Essential System')}
                            </span>
                          )}
                          {isCanonical && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {t('folder_type_canonical', 'Manager Generated')}
                            </span>
                          )}
                          {isCustom && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                              {t('folder_type_custom', 'Custom / Manual')}
                            </span>
                          )}

                          <span className="text-[11px] text-textMuted">
                            {modsCount === 0
                              ? t('empty_folder', 'Empty')
                              : modsCount === 1
                                ? t('folder_mods_count', { count: 1 })
                                : t('folder_mods_count_plural', { count: modsCount })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenFolder(category.category_name)}
                        className="p-1.5 rounded-lg bg-surface hover:bg-white/10 text-textMuted hover:text-textMain transition-colors"
                        title={t('open_in_explorer', 'Open in Explorer')}
                      >
                        <FolderOpen size={13} />
                      </button>

                      {onOpenMappingModal && !isEssential && (
                        <button
                          onClick={() => onOpenMappingModal(category)}
                          className="p-1.5 rounded-lg bg-surface hover:bg-white/10 text-textMuted hover:text-textMain transition-colors"
                          title={t('link_character', 'Map Character')}
                        >
                          <FolderCog size={13} />
                        </button>
                      )}

                      {!isEssential && (
                        <button
                          onClick={() => handleStartRename(category.category_name)}
                          className="p-1.5 rounded-lg bg-surface hover:bg-white/10 text-textMuted hover:text-textMain transition-colors"
                          title={t('rename_folder', 'Rename Folder')}
                        >
                          <Edit2 size={13} />
                        </button>
                      )}

                      <button
                        onClick={() =>
                          setDeleteTarget({
                            category,
                            hasMods: modsCount > 0,
                          })
                        }
                        disabled={isEssential}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isEssential
                            ? 'opacity-20 cursor-not-allowed text-textMuted'
                            : 'bg-surface hover:bg-rose-500/20 text-textMuted hover:text-rose-400'
                        }`}
                        title={
                          isEssential
                            ? t(
                                'cannot_delete_essential_folder',
                                'Essential system folders cannot be deleted.'
                              )
                            : t('delete_folder', 'Delete Folder')
                        }
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              }
            )
          )}
        </div>

        {/* Delete Confirmation Sub-Dialog */}
        {deleteTarget && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-3 animate-in fade-in">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-rose-400 shrink-0 mt-0.5" size={18} />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-rose-300">
                  {t('delete_folder_title', 'Delete Folder')}: "
                  {deleteTarget.category.category_name}"
                </h4>
                <p className="text-xs text-textMuted">
                  {deleteTarget.hasMods
                    ? t('delete_folder_has_mods_warning', {
                        name: deleteTarget.category.category_name,
                        count: deleteTarget.category.mods.length,
                      })
                    : t('delete_folder_confirm_empty', {
                        name: deleteTarget.category.category_name,
                      })}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 rounded-xl bg-surface hover:bg-white/10 text-xs font-semibold text-textMuted hover:text-textMain transition-colors"
              >
                Cancel
              </button>

              {deleteTarget.hasMods && (
                <button
                  onClick={() =>
                    handleExecuteDelete(deleteTarget.category.category_name, true, true)
                  }
                  disabled={isDeleting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/40 transition-colors"
                >
                  {isDeleting ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Sparkles size={13} />
                  )}
                  <span>
                    {t(
                      'move_mods_to_unassigned_and_delete',
                      'Move Mods to Unassigned & Delete Folder'
                    )}
                  </span>
                </button>
              )}

              <button
                onClick={() =>
                  handleExecuteDelete(
                    deleteTarget.category.category_name,
                    deleteTarget.hasMods,
                    false
                  )
                }
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors shadow-md shadow-rose-900/30"
              >
                {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>{t('delete_folder_permanently', 'Delete Permanently')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
