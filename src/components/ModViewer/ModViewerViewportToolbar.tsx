import { memo } from 'react';
import { Grid3x3, RotateCcw, RotateCw, Zap } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import type { RenderMode, LightingPreset } from './types';

export interface ModViewerViewportToolbarProps {
  meshCount: number;
  loading: boolean;
  error: string | null;
  renderMode: RenderMode;
  handleSetRenderMode: (m: RenderMode) => void;
  lightingPreset: LightingPreset;
  handleSetLighting: (p: LightingPreset) => void;
  turntableActive: boolean;
  toggleTurntable: () => void;
  wireframe: boolean;
  toggleWireframe: () => void;
  rotateModelY: (rad: number) => void;
  fitCamera: () => void;
  potatoMode: boolean;
  togglePotatoMode: () => void;
}

export const ModViewerViewportToolbar = memo(function ModViewerViewportToolbar({
  meshCount,
  loading,
  error,
  renderMode,
  handleSetRenderMode,
  lightingPreset,
  handleSetLighting,
  turntableActive,
  toggleTurntable,
  wireframe,
  toggleWireframe,
  rotateModelY,
  fitCamera,
  potatoMode,
  togglePotatoMode,
}: ModViewerViewportToolbarProps) {
  const { t } = useTranslation();

  if (meshCount === 0 || loading || error) return null;

  return (
    <div className="absolute top-3 right-3 z-20 flex flex-wrap items-center justify-end rounded-xl border border-white/15 bg-[#161b22]/95 p-1 backdrop-blur-md shadow-2xl gap-1 max-w-[calc(100%-24px)]">
      {/* Render Mode Segmented Control */}
      <div className="flex items-center rounded-lg border border-white/10 bg-white/5 p-0.5">
        {(['pbr', 'diffuse', 'clay', 'normal'] as RenderMode[]).map((m) => (
          <button
            key={m}
            onClick={() => handleSetRenderMode(m)}
            className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-all cursor-pointer ${
              renderMode === m
                ? 'bg-purple-600 text-white shadow-sm font-semibold'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            }`}
            title={t(`mod_viewer_mode_${m}`, m)}
          >
            {m === 'normal' ? 'Normals' : m === 'diffuse' ? 'Anime' : m.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Lighting Preset Control */}
      <div className="flex items-center rounded-lg border border-white/10 bg-white/5 p-0.5">
        {(['studio', 'anime', 'dramatic'] as LightingPreset[]).map((p) => (
          <button
            key={p}
            onClick={() => handleSetLighting(p)}
            className={`rounded px-1.5 py-0.5 text-xs font-medium capitalize transition-all cursor-pointer ${
              lightingPreset === p
                ? 'bg-white/15 text-white font-semibold'
                : 'text-white/50 hover:bg-white/10 hover:text-white/80'
            }`}
            title={t(`mod_viewer_lighting_${p}`, p)}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="h-4 w-[1px] bg-white/15 mx-0.5 hidden sm:block" />

      {/* Turntable Auto-Spin */}
      <button
        onClick={toggleTurntable}
        className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-all cursor-pointer ${
          turntableActive
            ? 'bg-purple-600 text-white shadow-sm'
            : 'text-white/60 hover:bg-white/10 hover:text-white'
        }`}
        title={t('mod_viewer_turntable', 'Turntable (Auto-Spin) [T]')}
      >
        <RotateCw className={`h-3.5 w-3.5 ${turntableActive ? 'animate-spin' : ''}`} />
        <span className="hidden sm:inline">{t('mod_viewer_turntable', 'Turntable')}</span>
      </button>

      {/* Wireframe */}
      <button
        onClick={toggleWireframe}
        className={`rounded-lg p-1.5 transition-colors cursor-pointer ${
          wireframe
            ? 'bg-purple-500/20 text-purple-400'
            : 'text-white/60 hover:bg-white/10 hover:text-white'
        }`}
        title={t('mod_viewer_wireframe')}
      >
        <Grid3x3 className="h-4 w-4" />
      </button>

      {/* Rotate 90° */}
      <button
        onClick={() => rotateModelY(Math.PI / 2)}
        className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
        title={t('mod_viewer_rotate')}
      >
        <RotateCw className="h-4 w-4" />
      </button>

      {/* Reset Camera */}
      <button
        onClick={fitCamera}
        className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
        title={t('mod_viewer_reset_camera')}
      >
        <RotateCcw className="h-4 w-4" />
      </button>

      <div className="h-4 w-[1px] bg-white/15 mx-0.5" />

      {/* Potato Mode (Fast Preview Toggle) */}
      <button
        onClick={togglePotatoMode}
        className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-all cursor-pointer ${
          potatoMode
            ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40 shadow-sm'
            : 'text-white/60 hover:bg-white/10 hover:text-white'
        }`}
        title={
          potatoMode
            ? t('mod_viewer_potato_on', 'Potato Mode ON (Fast Preview, 512px diffuse only)')
            : t('mod_viewer_potato_off', 'Switch to Potato Mode (Fast Preview)')
        }
      >
        <Zap className={`h-3.5 w-3.5 ${potatoMode ? 'text-amber-400 fill-amber-400/30' : ''}`} />
        <span className="hidden sm:inline">
          {potatoMode
            ? t('mod_viewer_potato_active', 'Potato')
            : t('mod_viewer_quality_full', 'Full Quality')}
        </span>
      </button>
    </div>
  );
});
