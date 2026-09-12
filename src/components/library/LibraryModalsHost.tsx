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
  } = modals;

  return (
    <AnimatePresence>
      {editingKeybinds && (
        <KeybindEditor mod={editingKeybinds} onClose={() => setEditingKeybinds(null)} />
      )}

      {mappingCategory && (
        <MappingModal
          mappingCategory={mappingCategory}
          entitiesDB={currentDB}
          onClose={() => setMappingCategory(null)}
          onSaved={() => {
            onScanModsFolder();
            setMappingCategory(null);
          }}
        />
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
    </AnimatePresence>
  );
});
