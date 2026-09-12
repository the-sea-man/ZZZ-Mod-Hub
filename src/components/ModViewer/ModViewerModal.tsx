import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Layers, Sliders } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import type { ViewerToggle } from '../../types/ipc';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { useCancellableTask } from '../../hooks/useCancellableTask';
import { tauriCommands } from '../../services/tauriCommands';
import {
  useThreeScene,
  type RenderMode,
  type LightingPreset,
  type CameraPreset,
} from './useThreeScene';
import { buildAllMeshes, type BuiltMesh } from './meshFactory';
import { ModViewerToolbar } from './ModViewerToolbar';
import { ModViewerViewportToolbar } from './ModViewerViewportToolbar';
import { ModViewerCameraPresets } from './ModViewerCameraPresets';
import { ModViewerStatusBar } from './ModViewerStatusBar';
import { ModViewerComponentsPanel } from './ModViewerComponentsPanel';
import { ModViewerTogglesPanel } from './ModViewerTogglesPanel';
import { safeSetJSON, safeGetBool } from '../../utils/storage';
import type { ModViewerModalProps, RetextureInfo } from './types';

export function ModViewerModal({
  modPath,
  modName,
  onClose,
  embedded = false,
  onUseAsPreview,
  initialPayload,
  isGbPreview = false,
  onInstallGbMod,
}: ModViewerModalProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scene = useThreeScene(containerRef);

  const [loading, setLoading] = useState(!initialPayload);
  const [error, setError] = useState<string | null>(null);
  const [meshCount, setMeshCount] = useState(0);
  const [builtMeshes, setBuiltMeshes] = useState<BuiltMesh[]>([]);
  const [wireframe, setWireframe] = useState(false);
  const [turntableActive, setTurntableActive] = useState(false);
  const [soloMeshName, setSoloMeshName] = useState<string | null>(null);
  const [activeCameraPreset, setActiveCameraPreset] = useState<CameraPreset | null>('front');
  const [savingThumbnail, setSavingThumbnail] = useState(false);
  const [savedThumbnailSuccess, setSavedThumbnailSuccess] = useState(false);
  const [renderMode, setRenderModeState] = useState<RenderMode>('diffuse');
  const [lightingPreset, setLightingPresetState] = useState<LightingPreset>('studio');
  const [toggles, setToggles] = useState<ViewerToggle[]>([]);
  const [sidebarTab, setSidebarTab] = useState<'meshes' | 'toggles'>('meshes');
  const [showTogglesPanel, setShowTogglesPanel] = useState(false);
  const [potatoMode, setPotatoMode] = useState<boolean>(() =>
    safeGetBool('mod_viewer_potato_mode', true)
  );
  const [toggleValues, setToggleValues] = useState<Record<string, number>>({});
  const [suggestedTags, setSuggestedTags] = useState<string[]>(
    initialPayload?.suggested_tags || []
  );
  const [tempInstallPath, setTempInstallPath] = useState<string | null>(
    initialPayload?.temp_install_path || null
  );
  const [installingGb, setInstallingGb] = useState(false);
  const [gbInstallSuccess, setGbInstallSuccess] = useState(false);
  const [addedTags, setAddedTags] = useState<Set<string>>(new Set());
  const [meshVisibility, setMeshVisibility] = useState<Record<string, boolean>>({});
  const [showBaseModelDropdown, setShowBaseModelDropdown] = useState(false);
  const preSoloVisibilityRef = useRef<Record<string, boolean>>({});
  const [retextureInfo, setRetextureInfo] = useState<RetextureInfo>({
    isRetexture: !!initialPayload?.is_retexture,
    baseModelSource: initialPayload?.base_model_source || null,
    clues: initialPayload?.clues || [],
    candidates: initialPayload?.base_model_candidates || [],
  });

  const { runTask, cancelCurrentTask } = useCancellableTask('viewer');
  const isMountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const tempPathRef = useRef<string | null>(initialPayload?.temp_install_path || null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      requestIdRef.current += 1;
      cancelCurrentTask();
      // If closing a temporary GameBanana preview without installing, discard files
      if (tempPathRef.current && !gbInstallSuccess) {
        tauriCommands.viewer.discardPreview(tempPathRef.current).catch(console.error);
      }
    };
  }, [gbInstallSuccess, cancelCurrentTask]);

  // Load mod data with optional base model folder override and quality
  const loadMod = useCallback(
    async (baseModelOverride?: string, qualityOverride?: boolean) => {
      const reqId = ++requestIdRef.current;
      try {
        setLoading(true);
        setError(null);

        const activePotato = qualityOverride !== undefined ? qualityOverride : potatoMode;
        const qualityStr = activePotato ? 'potato' : 'balanced';

        const payload =
          initialPayload && !baseModelOverride && qualityOverride === undefined
            ? initialPayload
            : await runTask(async (taskId) => {
                return tauriCommands.viewer.parseMod(
                  modPath,
                  baseModelOverride !== undefined ? baseModelOverride : null,
                  qualityStr,
                  taskId
                );
              });

        if (!isMountedRef.current || reqId !== requestIdRef.current || !payload) return;

        setRetextureInfo({
          isRetexture: !!payload.is_retexture,
          baseModelSource: payload.base_model_source || null,
          clues: payload.clues || [],
          candidates: payload.base_model_candidates || [],
        });

        if (payload.suggested_tags) {
          setSuggestedTags(payload.suggested_tags);
        }
        if (payload.temp_install_path) {
          setTempInstallPath(payload.temp_install_path);
          tempPathRef.current = payload.temp_install_path;
        }

        const incomingToggles = payload.toggles || [];
        setToggles(incomingToggles);
        const initialVals: Record<string, number> = {};
        for (const tg of incomingToggles) {
          initialVals[tg.variable.toLowerCase()] = tg.current_value;
        }
        setToggleValues(initialVals);

        const meshes = buildAllMeshes(payload.meshes, payload.textures, scene.requestRender);
        if (!isMountedRef.current || reqId !== requestIdRef.current) return;

        setBuiltMeshes(meshes);
        setMeshCount(meshes.length);
        useAppStore.getState().incrementStat('previews3d');

        // Initialize visibility (all visible)
        const vis: Record<string, boolean> = {};
        meshes.forEach((m) => {
          vis[m.name] = true;
        });
        setMeshVisibility(vis);

        scene.setMeshes(meshes);
        scene.applyToggles(initialVals);

        // Fit camera after geometry loads
        requestAnimationFrame(() => {
          if (isMountedRef.current && reqId === requestIdRef.current) {
            scene.fitCamera();
          }
        });
      } catch (err) {
        if (!isMountedRef.current || reqId !== requestIdRef.current) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (isMountedRef.current && reqId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [modPath, scene, initialPayload, potatoMode]
  );

  const togglePotatoMode = useCallback(() => {
    setPotatoMode((prev) => {
      const next = !prev;
      safeSetJSON('mod_viewer_potato_mode', next);
      loadMod(retextureInfo.baseModelSource || undefined, next);
      return next;
    });
  }, [loadMod, retextureInfo.baseModelSource]);

  useEffect(() => {
    loadMod();
  }, [loadMod]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = () => {
      if (showBaseModelDropdown) {
        setShowBaseModelDropdown(false);
      }
    };
    if (showBaseModelDropdown) {
      window.addEventListener('click', handleClickOutside);
      return () => window.removeEventListener('click', handleClickOutside);
    }
  }, [showBaseModelDropdown]);

  // Browse custom base model folder using native OS picker
  const handleBrowseBaseModel = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t('mod_viewer_select_base_model', 'Select Base Model Folder'),
      });
      if (selected && typeof selected === 'string') {
        setShowBaseModelDropdown(false);
        loadMod(selected);
      }
    } catch (err) {
      console.error('Failed to browse base model:', err);
    }
  }, [loadMod, t]);

  const handleSetRenderMode = useCallback(
    (mode: RenderMode) => {
      setRenderModeState(mode);
      scene.setRenderMode(mode);
    },
    [scene]
  );

  const handleSetLighting = useCallback(
    (preset: LightingPreset) => {
      setLightingPresetState(preset);
      scene.setLightingPreset(preset);
    },
    [scene]
  );

  const handleSetToggleValue = useCallback(
    (variable: string, value: number) => {
      setToggleValues((prev) => {
        const next = { ...prev, [variable.toLowerCase()]: value };
        scene.applyToggles(next);
        return next;
      });
    },
    [scene]
  );

  const handleCycleToggle = useCallback(
    (toggle: ViewerToggle) => {
      setToggleValues((prev) => {
        const cur = prev[toggle.variable.toLowerCase()] ?? toggle.current_value;
        const idx = toggle.values.indexOf(cur);
        const nextIdx = idx >= 0 ? (idx + 1) % toggle.values.length : 0;
        const nextVal = toggle.values[nextIdx];
        const next = { ...prev, [toggle.variable.toLowerCase()]: nextVal };
        scene.applyToggles(next);
        return next;
      });
    },
    [scene]
  );

  const toggleWireframe = useCallback(() => {
    setWireframe((prev) => {
      const next = !prev;
      scene.setWireframe(next);
      return next;
    });
  }, [scene]);

  const toggleMeshVisibility = useCallback(
    (meshName: string, index: number) => {
      setMeshVisibility((prev) => {
        const next = !prev[meshName];
        scene.setMeshVisibility(index, next);
        return { ...prev, [meshName]: next };
      });
    },
    [scene]
  );

  const handleAddTag = useCallback(
    async (tag: string) => {
      try {
        const categories = useAppStore.getState().categories;
        let existing: string[] = [];
        for (const cat of categories) {
          const found = cat.mods.find((m) => m.full_path === modPath);
          if (found) {
            existing = found.meta?.tags || [];
            break;
          }
        }
        if (!existing.includes(tag)) {
          const nextTags = [...existing, tag];
          await useAppStore.getState().setModTags(modPath, nextTags);
          setAddedTags((prev) => new Set([...prev, tag]));
        }
      } catch (err) {
        console.error('Failed to add tag:', err);
      }
    },
    [modPath]
  );

  const totalVertices = useMemo(
    () => builtMeshes.reduce((acc, m) => acc + (m.vertexCount || 0), 0),
    [builtMeshes]
  );
  const totalTriangles = useMemo(
    () => builtMeshes.reduce((acc, m) => acc + (m.triangleCount || 0), 0),
    [builtMeshes]
  );

  const formatCount = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
  };

  const toggleTurntable = useCallback(() => {
    setTurntableActive((prev) => {
      const next = !prev;
      scene.setTurntable(next);
      return next;
    });
  }, [scene]);

  const handleSelectCameraPreset = useCallback(
    (preset: CameraPreset) => {
      setActiveCameraPreset(preset);
      scene.setCameraPreset(preset);
    },
    [scene]
  );

  const handleToggleSolo = useCallback(
    (targetMeshName: string) => {
      if (soloMeshName === targetMeshName) {
        const restored = preSoloVisibilityRef.current;
        builtMeshes.forEach((m, idx) => {
          scene.setMeshVisibility(idx, restored[m.name] ?? true);
        });
        setMeshVisibility(restored);
        setSoloMeshName(null);
      } else {
        if (!soloMeshName) {
          preSoloVisibilityRef.current = { ...meshVisibility };
        }
        const nextVis: Record<string, boolean> = {};
        builtMeshes.forEach((m, idx) => {
          const isSolo = m.name === targetMeshName;
          nextVis[m.name] = isSolo;
          scene.setMeshVisibility(idx, isSolo);
        });
        setMeshVisibility(nextVis);
        setSoloMeshName(targetMeshName);
      }
    },
    [soloMeshName, meshVisibility, builtMeshes, scene]
  );

  const handleInstantSaveThumbnail = useCallback(async () => {
    if (savingThumbnail || !modPath || isGbPreview) return;
    try {
      setSavingThumbnail(true);
      const snapshot = scene.captureSnapshot();
      if (!snapshot) return;

      await invoke('save_mod_preview_base64', {
        modPath,
        base64Data: snapshot,
      });
      useAppStore.getState().incrementStat('imagesCropped');
      setSavedThumbnailSuccess(true);
      setTimeout(() => setSavedThumbnailSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to instant-save thumbnail:', err);
    } finally {
      setSavingThumbnail(false);
    }
  }, [savingThumbnail, modPath, isGbPreview, scene]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (
        e.key.toLowerCase() === 't' &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        toggleTurntable();
        return;
      }

      for (const tog of toggles) {
        if (tog.key && e.key.toLowerCase() === tog.key.trim().toLowerCase()) {
          e.preventDefault();
          handleCycleToggle(tog);
          break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, toggles, handleCycleToggle, toggleTurntable]);

  const content = (
    <div className="relative flex h-full w-full overflow-hidden bg-[#0d1117]">
      <ModViewerToolbar
        displayName={modName}
        modPath={modPath}
        isGbPreview={isGbPreview || !!tempInstallPath}
        embedded={embedded}
        retextureInfo={retextureInfo}
        showBaseModelDropdown={showBaseModelDropdown}
        setShowBaseModelDropdown={setShowBaseModelDropdown}
        loadMod={loadMod}
        handleBrowseBaseModel={handleBrowseBaseModel}
        handleInstantSaveThumbnail={handleInstantSaveThumbnail}
        savingThumbnail={savingThumbnail}
        savedThumbnailSuccess={savedThumbnailSuccess}
        onUseAsPreview={onUseAsPreview}
        captureSnapshot={scene.captureSnapshot}
        onInstallGbMod={onInstallGbMod}
        installingGb={installingGb}
        setInstallingGb={setInstallingGb}
        gbInstallSuccess={gbInstallSuccess}
        setGbInstallSuccess={setGbInstallSuccess}
        onClose={onClose}
      />

      {/* Main content area */}
      <div className="flex h-full w-full pt-10">
        {/* 3D Viewport */}
        <div ref={containerRef} className="relative flex-1" style={{ minHeight: 0 }}>
          <ModViewerStatusBar
            retextureInfo={retextureInfo}
            onOpenBaseModelDropdown={() => setShowBaseModelDropdown(true)}
            loading={loading}
            error={error}
            onClose={onClose}
          />

          {/* Floating Viewport Toolbar (always visible at top-right of 3D canvas, never occluded by sidebar) */}
          <ModViewerViewportToolbar
            meshCount={meshCount}
            loading={loading}
            error={error}
            renderMode={renderMode}
            handleSetRenderMode={handleSetRenderMode}
            lightingPreset={lightingPreset}
            handleSetLighting={handleSetLighting}
            turntableActive={turntableActive}
            toggleTurntable={toggleTurntable}
            wireframe={wireframe}
            toggleWireframe={toggleWireframe}
            rotateModelY={scene.rotateModelY}
            fitCamera={scene.fitCamera}
            potatoMode={potatoMode}
            togglePotatoMode={togglePotatoMode}
          />

          <ModViewerCameraPresets
            meshCount={meshCount}
            loading={loading}
            error={error}
            activeCameraPreset={activeCameraPreset}
            handleSelectCameraPreset={handleSelectCameraPreset}
          />

          {/* Floating Toggles Drawer (bottom-right) */}
          {toggles.length > 0 && !loading && !error && (
            <div className="absolute bottom-3 right-3 z-20 flex flex-col items-end gap-2">
              {showTogglesPanel && (
                <ModViewerTogglesPanel
                  variant="floating"
                  toggles={toggles}
                  toggleValues={toggleValues}
                  handleSetToggleValue={handleSetToggleValue}
                  handleCycleToggle={handleCycleToggle}
                  onCloseFloating={() => setShowTogglesPanel(false)}
                />
              )}

              <button
                onClick={() => {
                  setShowTogglesPanel(!showTogglesPanel);
                  if (!showTogglesPanel) {
                    setSidebarTab('toggles');
                  }
                }}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 shadow-2xl backdrop-blur-md text-xs font-semibold transition-all cursor-pointer ${
                  showTogglesPanel
                    ? 'bg-purple-600 text-white border-purple-400 shadow-purple-900/50'
                    : 'bg-[#161b22]/90 text-purple-300 border-purple-500/35 hover:bg-purple-600/30 hover:text-white'
                }`}
              >
                <Sliders className="h-3.5 w-3.5" />
                <span>
                  {toggles.length} {t('mod_viewer_tab_toggles', 'Toggles')}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        {builtMeshes.length > 0 && (
          <div className="flex w-72 sm:w-80 flex-col border-l border-white/10 bg-[#0d1117]">
            {/* Sidebar Tabs Header */}
            <div className="flex border-b border-white/10 bg-[#161b22]/70 p-1.5 gap-1.5">
              <button
                onClick={() => setSidebarTab('meshes')}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  sidebarTab === 'meshes'
                    ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40 shadow-sm'
                    : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>
                  {t('mod_viewer_tab_meshes', 'Meshes')} ({builtMeshes.length})
                </span>
              </button>
              {toggles.length > 0 && (
                <button
                  onClick={() => setSidebarTab('toggles')}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                    sidebarTab === 'toggles'
                      ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40 shadow-sm'
                      : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                  }`}
                >
                  <Sliders className="h-3.5 w-3.5" />
                  <span>
                    {t('mod_viewer_tab_toggles', 'Toggles')} ({toggles.length})
                  </span>
                </button>
              )}
            </div>

            {sidebarTab === 'meshes' ? (
              <ModViewerComponentsPanel
                builtMeshes={builtMeshes}
                meshVisibility={meshVisibility}
                toggleMeshVisibility={toggleMeshVisibility}
                soloMeshName={soloMeshName}
                handleToggleSolo={handleToggleSolo}
                totalTriangles={totalTriangles}
                totalVertices={totalVertices}
                formatCount={formatCount}
                suggestedTags={suggestedTags}
                addedTags={addedTags}
                handleAddTag={handleAddTag}
                isGbPreview={isGbPreview}
              />
            ) : (
              <ModViewerTogglesPanel
                variant="sidebar"
                toggles={toggles}
                toggleValues={toggleValues}
                handleSetToggleValue={handleSetToggleValue}
                handleCycleToggle={handleCycleToggle}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (embedded) {
    return content;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="relative flex h-full max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
        {content}
      </div>
    </div>,
    document.body
  );
}

export default ModViewerModal;
