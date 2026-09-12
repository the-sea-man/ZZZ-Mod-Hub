import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { confirm } from '@tauri-apps/plugin-dialog';
import { EntityCategory, getActiveModsPath } from '../types';

export interface UseBatchSelectionProps {
  modsPath: string;
  activeLibraryTab: EntityCategory;
  bulkToggleMods: (modPaths: string[], enable: boolean) => Promise<void>;
  scanModsFolder: () => Promise<void>;
  incrementStat: (stat: any) => void;
  currentVisiblePaths: string[];
}

export function useBatchSelection({
  modsPath,
  activeLibraryTab,
  bulkToggleMods,
  scanModsFolder,
  incrementStat,
  currentVisiblePaths,
}: UseBatchSelectionProps) {
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedModPaths, setSelectedModPaths] = useState<string[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  const toggleBatchMode = () => {
    setIsBatchMode((prev) => {
      if (prev) {
        setSelectedModPaths([]);
        return false;
      }
      return true;
    });
  };

  const handleToggleSelectMod = (modPath: string, index: number, isShift: boolean) => {
    if (
      isShift &&
      lastSelectedIndex !== null &&
      lastSelectedIndex !== index &&
      currentVisiblePaths.length > 0
    ) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const rangePaths = currentVisiblePaths.slice(start, end + 1);

      setSelectedModPaths((prev) => {
        const next = new Set([...prev, ...rangePaths]);
        return Array.from(next);
      });
    } else {
      setSelectedModPaths((prev) =>
        prev.includes(modPath) ? prev.filter((p) => p !== modPath) : [...prev, modPath]
      );
      setLastSelectedIndex(index);
    }
  };

  const allVisibleSelected =
    currentVisiblePaths.length > 0 &&
    currentVisiblePaths.every((p) => selectedModPaths.includes(p));

  const handleToggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedModPaths((prev) => prev.filter((p) => !currentVisiblePaths.includes(p)));
    } else {
      setSelectedModPaths((prev) => Array.from(new Set([...prev, ...currentVisiblePaths])));
    }
  };

  const handleBatchEnable = async () => {
    if (selectedModPaths.length === 0) return;
    setIsBatchProcessing(true);
    if (selectedModPaths.length >= 5) {
      incrementStat('batchOpsPerformed');
    }
    try {
      await bulkToggleMods(selectedModPaths, true);
      setSelectedModPaths([]);
    } catch (err) {
      console.error('Batch enable failed:', err);
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBatchDisable = async () => {
    if (selectedModPaths.length === 0) return;
    setIsBatchProcessing(true);
    if (selectedModPaths.length >= 5) {
      incrementStat('batchOpsPerformed');
    }
    try {
      await bulkToggleMods(selectedModPaths, false);
      setSelectedModPaths([]);
    } catch (err) {
      console.error('Batch disable failed:', err);
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBatchMove = async (targetCategory: string) => {
    if (selectedModPaths.length === 0 || !targetCategory) return;
    if (selectedModPaths.length >= 5) {
      incrementStat('batchOpsPerformed');
    }
    setIsBatchProcessing(true);
    try {
      const targetPath = getActiveModsPath(modsPath, activeLibraryTab);
      let failedCount = 0;
      for (const modPath of selectedModPaths) {
        try {
          await invoke('move_mod_to_category', { modPath, targetCategory, rootPath: targetPath });
        } catch (e) {
          failedCount++;
          console.warn(`Failed to move mod ${modPath}:`, e);
        }
      }
      if (failedCount > 0) {
        console.warn(
          `Batch move: ${failedCount} of ${selectedModPaths.length} mods failed to move.`
        );
      }
      await scanModsFolder();
      setSelectedModPaths([]);
    } catch (err) {
      console.error('Batch move failed:', err);
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedModPaths.length === 0) return;
    const confirmed = await confirm(
      `Are you sure you want to delete ${selectedModPaths.length} selected mods? This action cannot be undone.`,
      { title: 'Delete Selected Mods', kind: 'warning' }
    );
    if (!confirmed) return;

    setIsBatchProcessing(true);
    if (selectedModPaths.length >= 5) {
      incrementStat('batchOpsPerformed');
    }
    try {
      let failedCount = 0;
      for (const modPath of selectedModPaths) {
        try {
          await invoke('delete_mod', { modPath });
        } catch (e) {
          failedCount++;
          console.warn(`Failed to delete mod ${modPath}:`, e);
        }
      }
      if (failedCount > 0) {
        console.warn(
          `Batch delete: ${failedCount} of ${selectedModPaths.length} mods failed to delete.`
        );
      }
      await scanModsFolder();
      setSelectedModPaths([]);
    } catch (err) {
      console.error('Batch delete failed:', err);
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const clearSelection = () => {
    setSelectedModPaths([]);
    setIsBatchMode(false);
  };

  return {
    isBatchMode,
    setIsBatchMode,
    toggleBatchMode,
    selectedModPaths,
    setSelectedModPaths,
    isBatchProcessing,
    allVisibleSelected,
    handleToggleSelectMod,
    handleToggleSelectAll,
    handleBatchEnable,
    handleBatchDisable,
    handleBatchMove,
    handleBatchDelete,
    clearSelection,
  };
}
