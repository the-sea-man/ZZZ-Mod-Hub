import { useState, useMemo, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import {
  FolderDown,
  Folder,
  FolderOpen,
  FolderTree,
  AlertTriangle,
  Info,
  CheckSquare,
  Square,
  RefreshCw,
  Copy,
  Move,
  Search,
  Sparkles,
  ArrowRight,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { tauriCommands } from '../../services/tauriCommands';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { playInstallSuccessSound } from '../../utils/audio';
import { getActiveModsPath } from '../../types';
import type { ExternalFolderScanResult, ImportExecutionResult } from '../../types/ipc';

export interface ImportModsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
  initialSourcePath?: string;
  initialDepth?: number;
}

export function ImportModsModal({
  isOpen,
  onClose,
  onImportComplete,
  initialSourcePath,
  initialDepth,
}: ImportModsModalProps) {
  const { t } = useTranslation();
  const modsPath = useAppStore((s) => s.modsPath);
  const activeLibraryTab = useAppStore((s) => s.activeLibraryTab);
  const scanModsFolder = useAppStore((s) => s.scanModsFolder);
  const categories = useAppStore((s) => s.categories);
  const externalModsSourcePath = useAppStore((s) => s.externalModsSourcePath);
  const externalModsDefaultDepth = useAppStore((s) => s.externalModsDefaultDepth);
  const setExternalModsSourcePath = useAppStore((s) => s.setExternalModsSourcePath);
  const setExternalModsDefaultDepth = useAppStore((s) => s.setExternalModsDefaultDepth);

  // Source selection & scanning
  const [sourcePath, setSourcePath] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ExternalFolderScanResult | null>(null);
  const [selectedDepth, setSelectedDepth] = useState<number>(externalModsDefaultDepth ?? 0);
  const [scanError, setScanError] = useState<string | null>(null);
  const [rememberPath, setRememberPath] = useState(true);

  // Existing mod names for smart diff (case-insensitive)
  const existingModNames = useMemo(() => {
    const names = new Set<string>();
    for (const cat of categories) {
      for (const mod of cat.mods) {
        const clean = mod.name
          .replace(/^DISABLED\s+/, '')
          .trim()
          .toLowerCase();
        names.add(clean);
      }
    }
    return names;
  }, [categories]);

  // Candidate selection & filtering
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilter] = useState('');

  // Import configuration & execution
  const [copyMode, setCopyMode] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgressText, setImportProgressText] = useState('');
  const [importResult, setImportResult] = useState<ImportExecutionResult | null>(null);

  // Trigger scan when source path or selected depth changes
  const runScan = async (path: string, depth?: number) => {
    if (!path.trim()) return;
    setIsScanning(true);
    setScanError(null);
    try {
      const result = await tauriCommands.install.scanExternalFolder(path, depth);
      setScanResult(result);
      if (depth === undefined) {
        setSelectedDepth(result.recommended_depth);
      }
      // Smart diff: pre-select only candidates that are NOT already in library and NOT subcomponents or category containers
      const defaultSelected = new Set(
        result.candidates
          .filter((c) => {
            if (c.is_likely_subcomponent || c.has_subdirs_with_mods) return false;
            const clean = c.folder_name
              .replace(/^DISABLED\s+/, '')
              .trim()
              .toLowerCase();
            return !existingModNames.has(clean);
          })
          .map((c) => c.source_path)
      );
      setSelectedPaths(defaultSelected);
    } catch (e: any) {
      setScanError(typeof e === 'string' ? e : e?.message || String(e));
      setScanResult(null);
    } finally {
      setIsScanning(false);
    }
  };

  // Auto-populate when opening
  useEffect(() => {
    if (isOpen) {
      const targetPath = initialSourcePath || externalModsSourcePath;
      const targetDepth = initialDepth ?? externalModsDefaultDepth ?? 0;
      if (targetPath && !sourcePath) {
        setSourcePath(targetPath);
        setSelectedDepth(targetDepth);
        runScan(targetPath, targetDepth);
      }
    }
  }, [isOpen, initialSourcePath, externalModsSourcePath, externalModsDefaultDepth]);

  const handleBrowseSource = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t('import_browse_dialog_title', 'Select External Mod Directory'),
      });
      if (selected && typeof selected === 'string') {
        setSourcePath(selected);
        setImportResult(null);
        runScan(selected);
      }
    } catch (e) {
      console.error('Failed to open directory dialog:', e);
    }
  };

  const handleDepthChange = (depth: number) => {
    setSelectedDepth(depth);
    if (sourcePath) {
      runScan(sourcePath, depth);
    }
  };

  // Filter candidates based on search
  const filteredCandidates = useMemo(() => {
    if (!scanResult) return [];
    if (!searchFilter.trim()) return scanResult.candidates;
    const q = searchFilter.toLowerCase();
    return scanResult.candidates.filter(
      (c) => c.folder_name.toLowerCase().includes(q) || c.relative_path.toLowerCase().includes(q)
    );
  }, [scanResult, searchFilter]);

  const toggleSelectAll = () => {
    if (selectedPaths.size === filteredCandidates.length) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(filteredCandidates.map((c) => c.source_path)));
    }
  };

  const toggleCandidate = (path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const activeDepthAnalysis = useMemo(() => {
    if (!scanResult) return null;
    return scanResult.depth_analyses.find((d) => d.depth === selectedDepth) || null;
  }, [scanResult, selectedDepth]);

  const handleExecuteImport = async () => {
    if (!modsPath) {
      alert(t('alert_no_mods_path', 'Please configure your Mods directory in Settings first.'));
      return;
    }
    if (selectedPaths.size === 0) return;

    setIsImporting(true);
    setImportProgressText(
      t('import_progress_starting', 'Importing {{count}} mods into Unassigned...', {
        count: selectedPaths.size,
      })
    );

    try {
      if (rememberPath && sourcePath.trim()) {
        setExternalModsSourcePath(sourcePath.trim());
        setExternalModsDefaultDepth(selectedDepth);
      }

      const targetDestinationRoot =
        getActiveModsPath(modsPath, activeLibraryTab || 'playable_characters') || modsPath;

      const result = await tauriCommands.install.executeExternalImport({
        candidate_paths: Array.from(selectedPaths),
        destination_root: targetDestinationRoot,
        copy_mode: copyMode,
      });

      setImportResult(result);
      playInstallSuccessSound();
      await scanModsFolder();
      onImportComplete?.();
    } catch (e: any) {
      alert(t('import_failed_msg', `Import failed: ${e}`));
    } finally {
      setIsImporting(false);
      setImportProgressText('');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <FolderDown className="text-primary shrink-0" size={24} />
          <div>
            <h2 className="text-lg font-bold text-textMain">
              {t('import_modal_title', 'Import Mods from External Folder')}
            </h2>
            <p className="text-xs text-textMuted font-normal">
              {t(
                'import_modal_subtitle',
                'Migrate mods from an external folder into your active library.'
              )}
            </p>
          </div>
        </div>
      }
      maxWidth="5xl"
      maxHeight="max-h-[90vh]"
    >
      <div className="flex flex-col gap-5 py-1">
        {/* Step 1: Directory Selection */}
        <div className="glass-panel p-4 rounded-2xl flex flex-col gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-textMuted flex items-center gap-2">
            <FolderOpen size={14} className="text-primary" />
            {t('import_source_folder_label', 'Source Mods Directory')}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={sourcePath}
              readOnly
              placeholder={t(
                'import_source_placeholder',
                'Select the folder containing your external mods...'
              )}
              className="flex-1 bg-surface-dark border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-textMain placeholder:text-textMuted/50 focus:outline-none focus:border-primary/50"
            />
            <button
              type="button"
              onClick={handleBrowseSource}
              disabled={isScanning || isImporting}
              className="px-4 py-2.5 rounded-xl font-bold text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 transition-all flex items-center gap-2 shrink-0 cursor-pointer shadow-sm disabled:opacity-50"
            >
              <Folder size={14} />
              {t('browse_btn', 'Browse...')}
            </button>
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-xs text-textMuted hover:text-textMain transition-all mt-1 w-fit">
            <input
              type="checkbox"
              checked={rememberPath}
              onChange={(e) => setRememberPath(e.target.checked)}
              className="rounded border-white/20 bg-surface-dark text-primary focus:ring-0 cursor-pointer"
            />
            <span>{t('import_remember_path', 'Remember this folder for quick syncing')}</span>
          </label>

          {scanError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{scanError}</span>
            </div>
          )}
        </div>

        {/* Loading Spinner during scan */}
        {isScanning && (
          <div className="flex flex-col items-center justify-center p-8 gap-3 text-textMuted">
            <RefreshCw className="animate-spin text-primary" size={28} />
            <p className="text-xs font-medium">
              {t('import_scanning_depths', 'Analyzing folder structure and mod depths...')}
            </p>
          </div>
        )}

        {/* Step 2: Depth Configuration & Visual Guidance */}
        {scanResult && !isScanning && (
          <div className="flex flex-col gap-4">
            {/* Depth Selector & Recommendation Pill */}
            <div className="glass-panel p-4 rounded-2xl flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sliders size={14} className="text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-textMuted">
                    {t('import_depth_selector_title', 'Folder Depth Level')}
                  </span>
                </div>
                {scanResult.recommended_depth >= 0 && scanResult.candidates.length > 0 && (
                  <div className="text-[11px] text-textMuted flex items-center gap-1.5">
                    <Sparkles size={12} className="text-amber-400" />
                    <span>
                      {scanResult.recommended_depth === 0
                        ? t(
                            'import_recommended_smart_label',
                            'Recommended: Smart Auto-Detect based on folder structure'
                          )
                        : t(
                            'import_recommended_depth_label',
                            'Recommended: Depth {{depth}} based on mod files',
                            { depth: scanResult.recommended_depth }
                          )}
                    </span>
                  </div>
                )}
              </div>

              {/* Segmented Depth Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {scanResult.depth_analyses.map((da) => {
                  const isSelected = selectedDepth === da.depth;
                  const isRecommended =
                    scanResult.recommended_depth === da.depth && da.valid_mod_count > 0;

                  return (
                    <button
                      key={da.depth}
                      type="button"
                      onClick={() => handleDepthChange(da.depth)}
                      className={`p-3 rounded-xl text-left border transition-all cursor-pointer flex flex-col gap-1 relative ${
                        isSelected
                          ? 'bg-primary/20 border-primary/50 text-white shadow-md ring-1 ring-primary/40'
                          : 'bg-surface-light border-white/10 text-textMuted hover:bg-white/5 hover:text-textMain'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold flex items-center gap-1">
                          {da.depth === 0 ? (
                            <>
                              <Sparkles size={12} className="text-amber-400 shrink-0" />
                              {t('import_smart_depth_label', 'Smart (Auto)')}
                            </>
                          ) : (
                            <>
                              {t('import_depth_label', 'Depth {{depth}}', { depth: da.depth })}
                              {da.depth === 1 && (
                                <span className="text-[10px] font-normal text-textMuted/70">
                                  {' '}
                                  (Flat)
                                </span>
                              )}
                              {da.depth === 2 && (
                                <span className="text-[10px] font-normal text-textMuted/70">
                                  {' '}
                                  (Nested)
                                </span>
                              )}
                            </>
                          )}
                        </span>
                        {isRecommended && (
                          <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-amber-500/25 text-amber-300 border border-amber-500/40">
                            {t('recommended_pill', 'Best')}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-textMuted font-medium">
                        {t('import_candidates_count', '{{count}} folders', {
                          count: da.candidate_count,
                        })}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Visual Breadcrumb Diagram */}
              {selectedDepth === 0 ? (
                <div className="p-3 rounded-xl bg-surface-dark/70 border border-white/5 flex items-center gap-2.5 text-xs text-textMuted">
                  <Sparkles size={15} className="text-amber-400 shrink-0" />
                  <span className="leading-relaxed">
                    {t(
                      'import_smart_breadcrumb_desc',
                      'Smart Auto-Detect: Standalone mods are imported directly, while character collection folders are automatically unpacked into individual mods.'
                    )}
                  </span>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-surface-dark/70 border border-white/5 flex flex-wrap items-center gap-2 text-xs text-textMuted overflow-x-auto">
                  <span className="font-bold text-textMain flex items-center gap-1">
                    <Folder size={13} className="text-primary" />
                    {t('import_breadcrumb_root', 'Selected Folder')}
                  </span>
                  <ArrowRight size={12} className="text-white/30" />

                  {Array.from({ length: selectedDepth }, (_, i) => i + 1).map((d) => {
                    const isTarget = d === selectedDepth;
                    return (
                      <div key={d} className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                            isTarget
                              ? 'bg-primary/20 border border-primary/50 text-primary shadow-sm'
                              : 'bg-white/5 text-textMuted border border-white/5'
                          }`}
                        >
                          <FolderTree size={12} />
                          {isTarget
                            ? t(
                                'import_breadcrumb_target_mod',
                                'Depth {{depth}}: Mod Folder (Imported)',
                                {
                                  depth: d,
                                }
                              )
                            : t(
                                'import_breadcrumb_category',
                                'Depth {{depth}}: Category / Subfolder',
                                {
                                  depth: d,
                                }
                              )}
                        </span>
                        {d < selectedDepth && <ArrowRight size={12} className="text-white/30" />}
                      </div>
                    );
                  })}

                  <ArrowRight size={12} className="text-white/30" />
                  <span className="text-[11px] text-textMuted/70 italic">
                    {t('import_breadcrumb_files', 'Inside: .ini, textures, buffers')}
                  </span>
                </div>
              )}

              {/* Dynamic Diagnostic Warnings */}
              {activeDepthAnalysis && activeDepthAnalysis.shallow_warning_count > 0 && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
                  <AlertTriangle size={16} className="shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <span className="font-bold">
                      {t('import_warning_shallow_title', 'Depth might be too shallow:')}{' '}
                    </span>
                    <span>
                      {t(
                        'import_warning_shallow_desc',
                        '{{count}} detected folders contain other mods inside them. If you keep this depth, entire categories will be imported as single large mods. Consider increasing depth to {{nextDepth}}.',
                        {
                          count: activeDepthAnalysis.shallow_warning_count,
                          nextDepth: Math.min(selectedDepth + 1, 4),
                        }
                      )}
                    </span>
                  </div>
                </div>
              )}

              {activeDepthAnalysis && activeDepthAnalysis.deep_warning_count > 0 && (
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs flex items-start gap-2.5">
                  <Info size={16} className="shrink-0 text-blue-400 mt-0.5" />
                  <div>
                    <span className="font-bold">
                      {t('import_warning_deep_title', 'Depth might be too deep:')}{' '}
                    </span>
                    <span>
                      {t(
                        'import_warning_deep_desc',
                        '{{count}} folders have no .ini files and appear to be textures or subcomponents. If you import them at this depth, sub-assets will be imported as separate broken mods. Consider decreasing depth to {{prevDepth}}.',
                        {
                          count: activeDepthAnalysis.deep_warning_count,
                          prevDepth: Math.max(selectedDepth - 1, 1),
                        }
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Candidate Inspection Table */}
            <div className="glass-panel p-4 rounded-2xl flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="flex items-center gap-1.5 text-xs font-bold text-textMain hover:text-primary transition-all cursor-pointer"
                  >
                    {selectedPaths.size === filteredCandidates.length &&
                    filteredCandidates.length > 0 ? (
                      <CheckSquare size={16} className="text-primary" />
                    ) : (
                      <Square size={16} className="text-textMuted" />
                    )}
                    <span>
                      {t('import_select_all', 'Select All ({{selected}}/{{total}})', {
                        selected: selectedPaths.size,
                        total: filteredCandidates.length,
                      })}
                    </span>
                  </button>

                  {existingModNames.size > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newCandidatePaths = filteredCandidates
                          .filter((c) => {
                            if (c.is_likely_subcomponent || c.has_subdirs_with_mods) return false;
                            const clean = c.folder_name
                              .replace(/^DISABLED\s+/, '')
                              .trim()
                              .toLowerCase();
                            return !existingModNames.has(clean);
                          })
                          .map((c) => c.source_path);
                        setSelectedPaths(new Set(newCandidatePaths));
                      }}
                      className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                    >
                      {t('import_select_only_new', 'Select Only New')}
                    </button>
                  )}
                </div>

                {/* Search Filter */}
                <div className="relative min-w-[200px]">
                  <Search
                    size={13}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted"
                  />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder={t('import_search_placeholder', 'Filter mods...')}
                    className="w-full bg-surface-dark border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-textMain placeholder:text-textMuted/50 focus:outline-none focus:border-primary/50"
                  />
                </div>
              </div>

              {/* Table / List */}
              <div className="max-h-[280px] overflow-y-auto custom-scrollbar border border-white/5 rounded-xl bg-surface-dark/50 divide-y divide-white/5">
                {filteredCandidates.length === 0 ? (
                  <div className="p-8 text-center text-xs text-textMuted">
                    {t('import_no_candidates', 'No candidate mods found at Depth {{depth}}.', {
                      depth: selectedDepth,
                    })}
                  </div>
                ) : (
                  filteredCandidates.map((c) => {
                    const isChecked = selectedPaths.has(c.source_path);
                    const sizeMB = (c.total_size_bytes / (1024 * 1024)).toFixed(1);
                    const cleanName = c.folder_name
                      .replace(/^DISABLED\s+/, '')
                      .trim()
                      .toLowerCase();
                    const isAlreadyInLibrary = existingModNames.has(cleanName);

                    return (
                      <div
                        key={c.source_path}
                        onClick={() => toggleCandidate(c.source_path)}
                        className={`p-3 flex items-center justify-between gap-3 text-xs transition-all cursor-pointer hover:bg-white/5 ${
                          isChecked ? 'bg-primary/5' : 'opacity-70'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {isChecked ? (
                            <CheckSquare size={15} className="text-primary shrink-0" />
                          ) : (
                            <Square size={15} className="text-textMuted shrink-0" />
                          )}
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-textMain truncate">
                              {c.folder_name}
                            </span>
                            <span className="text-[11px] text-textMuted truncate">
                              {c.relative_path}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Smart Diff Status Pill */}
                          {isAlreadyInLibrary && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-textMuted border border-white/10">
                              {t('import_badge_in_library', 'In Library')}
                            </span>
                          )}

                          {/* Diagnostic Pill */}
                          {c.has_subdirs_with_mods ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              {t('import_status_has_submods', 'Category Folder')}
                            </span>
                          ) : c.is_likely_subcomponent ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              {t('import_status_subcomponent', 'Subcomponent')}
                            </span>
                          ) : null}

                          <span className="text-[11px] text-textMuted">
                            {c.ini_count > 0 && `${c.ini_count} .ini • `}
                            {sizeMB} MB
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Step 4: Mode Selector & Execution */}
            <div className="glass-panel p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Copy vs Move Toggle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCopyMode(true)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                    copyMode
                      ? 'bg-primary/20 border-primary/40 text-primary shadow-sm'
                      : 'bg-surface-light border-white/10 text-textMuted hover:text-textMain'
                  }`}
                >
                  <Copy size={13} />
                  <span>{t('import_mode_copy', 'Copy (Safe & Recommended)')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCopyMode(false)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                    !copyMode
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-sm'
                      : 'bg-surface-light border-white/10 text-textMuted hover:text-textMain'
                  }`}
                >
                  <Move size={13} />
                  <span>{t('import_mode_move', 'Move (Frees Disk Space)')}</span>
                </button>
              </div>

              {/* Import Primary Button */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={selectedPaths.size === 0 || isImporting}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-primary to-primary/80 hover:brightness-110 text-white shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isImporting ? (
                    <RefreshCw className="animate-spin" size={14} />
                  ) : (
                    <FolderDown size={14} />
                  )}
                  <span>
                    {isImporting
                      ? t('importing_active', 'Importing...')
                      : t('import_action_btn', 'Import {{count}} Mods to Unassigned', {
                          count: selectedPaths.size,
                        })}
                  </span>
                </button>
              </div>
            </div>

            {/* Progress Text */}
            {isImporting && (
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/30 text-primary text-xs flex items-center gap-2 animate-pulse">
                <RefreshCw size={14} className="animate-spin shrink-0" />
                <span>{importProgressText}</span>
              </div>
            )}

            {/* Post-Import Success */}
            {importResult && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-emerald-200">
                      {t('import_success_title', 'Import Complete')}
                    </h3>
                    <p className="text-[11px] text-emerald-300/80 truncate">
                      {t(
                        'import_success_desc',
                        'Successfully imported {{count}} mods directly into your Unassigned folder.',
                        { count: importResult.success_count }
                      )}
                      {importResult.conflict_count > 0 &&
                        ` (${importResult.conflict_count} renamed to avoid conflicts)`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 rounded-xl font-bold text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-all cursor-pointer shrink-0"
                >
                  {t('close', 'Close')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
