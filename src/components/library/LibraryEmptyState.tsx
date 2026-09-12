import { memo } from 'react';
import { FolderPlus, FolderOpen, Compass } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

export interface LibraryEmptyStateProps {
  onGenerateFolders: () => void;
  onOpenModsFolder: () => void;
  onNavigateToDiscover: () => void;
  isGeneratingFolders: boolean;
}

export const LibraryEmptyState = memo(function LibraryEmptyState({
  onGenerateFolders,
  onOpenModsFolder,
  onNavigateToDiscover,
  isGeneratingFolders,
}: LibraryEmptyStateProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center max-w-4xl mx-auto">
      <div className="p-6 rounded-full bg-primary/10 text-primary mb-6 shadow-[0_0_40px_rgba(var(--color-primary-rgb),0.3)] animate-pulse">
        <FolderPlus size={56} />
      </div>
      <h2 className="text-4xl font-black text-textMain mb-3 tracking-tight">
        {t('library_empty_title', 'Welcome to Your Mod Hub!')}
      </h2>
      <p className="text-textMuted max-w-lg mb-8 text-base leading-relaxed">
        {t(
          'library_empty_desc',
          'Your mods folder is currently empty. Generate standard character folders to organize your collection, or download fresh community mods directly from GameBanana.'
        )}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <button
          onClick={onGenerateFolders}
          disabled={isGeneratingFolders}
          className="px-6 py-3.5 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all flex items-center gap-2 cursor-pointer"
        >
          <FolderPlus size={18} />
          <span>
            {isGeneratingFolders
              ? t('generating_folders', 'Generating Folders...')
              : t('generate_folders', 'Create Default Folders')}
          </span>
        </button>
        <button
          onClick={onNavigateToDiscover}
          className="px-6 py-3.5 bg-white/10 hover:bg-white/20 text-textMain font-bold rounded-xl border border-white/10 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
        >
          <Compass size={18} className="text-primary" />
          <span>{t('browse_discover', 'Browse Discover')}</span>
        </button>
        <button
          onClick={onOpenModsFolder}
          className="px-6 py-3.5 bg-white/5 hover:bg-white/10 text-textMuted hover:text-textMain font-bold rounded-xl border border-white/5 transition-all flex items-center gap-2 cursor-pointer"
        >
          <FolderOpen size={18} />
          <span>{t('open_mods_folder', 'Open Mods Folder')}</span>
        </button>
      </div>
    </div>
  );
});
