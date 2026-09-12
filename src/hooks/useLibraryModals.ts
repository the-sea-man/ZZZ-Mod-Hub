import { useState } from 'react';
import { ModInfo, CategoryInfo, InstallResult, ModWarning, UpdateAvailable } from '../types';

export function useLibraryModals() {
  const [editingKeybinds, setEditingKeybinds] = useState<ModInfo | null>(null);
  const [mappingCategory, setMappingCategory] = useState<CategoryInfo | null>(null);
  const [installResults, setInstallResults] = useState<InstallResult[]>([]);
  const [renamingMod, setRenamingMod] = useState<ModInfo | null>(null);
  const [movingMod, setMovingMod] = useState<ModInfo | null>(null);
  const [resolvingMod, setResolvingMod] = useState<ModInfo | null>(null);
  const [splittingMod, setSplittingMod] = useState<ModInfo | null>(null);
  const [warningsModalData, setWarningsModalData] = useState<{
    mod: ModInfo;
    warnings: (ModWarning | string)[];
  } | null>(null);
  const [hashConflictsModalMod, setHashConflictsModalMod] = useState<ModInfo | null>(null);
  const [showBatchFixModal, setShowBatchFixModal] = useState(false);
  const [activeUpdateModal, setActiveUpdateModal] = useState<UpdateAvailable | null>(null);

  return {
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
  };
}

export type LibraryModalsState = ReturnType<typeof useLibraryModals>;
