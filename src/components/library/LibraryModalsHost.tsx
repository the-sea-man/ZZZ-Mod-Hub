import { memo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { KeybindEditor } from '../Modals/KeybindEditor';
import { MappingModal } from '../Modals/MappingModal';
import { InstallSummaryModal } from '../Modals/InstallSummaryModal';
import {
  RenameModModal,
  MoveModModal,
  ResolveConflictModal,
  SplitModModal,
} from '../Modals/ModOptionsModals';
import { WarningsModal } from '../Modals/WarningsModal';
import { HashConflictsModal } from '../Modals/HashConflictsModal';
import { BatchFixModal } from '../Modals/BatchFixModal';
import { ModUpdaterModal } from '../Modals/ModUpdaterModal';
import { FolderManagementModal } from '../Modals/FolderManagementModal';
import { ProfilesModal } from '../Modals/ProfilesModal';
import { ImportModsModal } from '../Modals/ImportModsModal';
import { CategoryInfo, EntityDBInfo } from '../../types';
import { LibraryModalsState } from '../../hooks/useLibraryModals';

export interface LibraryModalsHostProps {
  modals: LibraryModalsState;
  categories: CategoryInfo[];
  currentDB: EntityDBInfo[];
  rootPath: string;
  onScanModsFolder: () => void;
}

export const LibraryModalsHost = memo(function LibraryModalsHost({
  modals,
  categories,
  currentDB,
  rootPath,
  onScanModsFolder,
}: LibraryModalsHostProps) {
  const {
    editingKeybinds,
    setEditingKeybinds,
    mappingCategory,
    setMappingCategory,
    installResults,
    setInstallResults,
    renamingMod,
    setRenamingMod,
    movingMod,
    setMovingMod,
    resolvingMod,
    setResolvingMod,
    splittingMod,
    setSplittingMod,
    warningsModalData,
    setWarningsModalData,
    hashConflictsModalMod,
    setHashConflictsModalMod,
    showBatchFixModal,
    setShowBatchFixModal,
    activeUpdateModal,
    setActiveUpdateModal,
    showFolderManagement,
    setShowFolderManagement,
    showProfilesModal,
    setShowProfilesModal,
    showImportModsModal,
    setShowImportModsModal,
  } = modals;

  return (
    <AnimatePresence>
      {editingKeybinds && (
        <KeybindEditor mod={editingKeybinds} onClose={() => setEditingKeybinds(null)} />
      )}

      {installResults.length > 0 && (
        <InstallSummaryModal
          isOpen={true}
          results={installResults}
          onClose={() => setInstallResults([])}
        />
      )}

      {renamingMod && (
        <RenameModModal
          mod={renamingMod}
          onClose={() => setRenamingMod(null)}
          onSaved={() => {
            onScanModsFolder();
            setRenamingMod(null);
          }}
        />
      )}

      {movingMod && (
        <MoveModModal
          mod={movingMod}
          categories={categories}
          rootPath={rootPath}
          onClose={() => setMovingMod(null)}
          onSaved={() => {
            onScanModsFolder();
            setMovingMod(null);
          }}
        />
      )}

      {resolvingMod && (
        <ResolveConflictModal
          mod={resolvingMod}
          categories={categories}
          rootPath={rootPath}
          onClose={() => setResolvingMod(null)}
          onSaved={() => {
            onScanModsFolder();
            setResolvingMod(null);
          }}
        />
      )}

      {splittingMod && (
        <SplitModModal
          mod={splittingMod}
          onClose={() => setSplittingMod(null)}
          onSaved={() => {
            onScanModsFolder();
            setSplittingMod(null);
          }}
        />
      )}

      {warningsModalData && (
        <WarningsModal
          mod={warningsModalData.mod}
          warnings={warningsModalData.warnings}
          onClose={() => setWarningsModalData(null)}
        />
      )}

      {hashConflictsModalMod && (
        <HashConflictsModal
          mod={hashConflictsModalMod}
          onClose={() => setHashConflictsModalMod(null)}
        />
      )}

      {showBatchFixModal && (
        <BatchFixModal
          onClose={() => setShowBatchFixModal(false)}
          onFixesCompleted={() => {
            onScanModsFolder();
          }}
        />
      )}

      {activeUpdateModal && (
        <ModUpdaterModal update={activeUpdateModal} onClose={() => setActiveUpdateModal(null)} />
      )}

      {showFolderManagement && (
        <FolderManagementModal
          isOpen={true}
          onClose={() => setShowFolderManagement(false)}
          categories={categories}
          currentDB={currentDB}
          rootPath={rootPath}
          onRefresh={onScanModsFolder}
          onOpenMappingModal={(cat) => setMappingCategory(cat)}
          onOpenImportMods={() => {
            setShowFolderManagement(false);
            setShowImportModsModal(true);
          }}
        />
      )}

      {showProfilesModal && (
        <ProfilesModal isOpen={true} onClose={() => setShowProfilesModal(false)} />
      )}

      {showImportModsModal && (
        <ImportModsModal
          isOpen={true}
          onClose={() => setShowImportModsModal(false)}
          onImportComplete={onScanModsFolder}
        />
      )}

      {mappingCategory && (
        <MappingModal
          mappingCategory={mappingCategory}
          entitiesDB={currentDB}
          rootPath={rootPath}
          onClose={() => setMappingCategory(null)}
          onSaved={() => {
            onScanModsFolder();
            setMappingCategory(null);
          }}
        />
      )}
    </AnimatePresence>
  );
});
