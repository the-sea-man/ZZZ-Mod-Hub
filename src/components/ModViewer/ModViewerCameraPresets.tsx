import { memo } from 'react';
import { Compass, User, RotateCcw } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import type { CameraPreset } from './types';

export interface ModViewerCameraPresetsProps {
  meshCount: number;
  loading: boolean;
  error: string | null;
  activeCameraPreset: CameraPreset | null;
  handleSelectCameraPreset: (preset: CameraPreset) => void;
}

export const ModViewerCameraPresets = memo(function ModViewerCameraPresets({
  meshCount,
  loading,
  error,
  activeCameraPreset,
  handleSelectCameraPreset,
}: ModViewerCameraPresetsProps) {
  const { t } = useTranslation();

  if (meshCount === 0 || loading || error) return null;

  return (
    <div className="absolute bottom-3 left-3 z-10 flex items-center rounded-xl border border-white/15 bg-[#161b22]/90 p-1 backdrop-blur-md shadow-2xl gap-1">
      <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-white/40 flex items-center gap-1">
        <Compass className="h-3 w-3 text-purple-400" />
        <span className="hidden sm:inline">{t('mod_viewer_camera_preset', 'Angle')}</span>
      </span>
      {(['front', 'back', 'left', 'right', 'face', 'reset'] as CameraPreset[]).map((preset) => (
        <button
          key={preset}
          onClick={() => handleSelectCameraPreset(preset)}
          className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-all cursor-pointer ${
            activeCameraPreset === preset && preset !== 'reset'
              ? 'bg-purple-600 text-white font-semibold shadow-sm'
              : 'text-white/60 hover:bg-white/10 hover:text-white'
          }`}
          title={t(`mod_viewer_cam_${preset}`, preset)}
        >
          {preset === 'face' ? (
            <span className="flex items-center gap-1">
              <User className="h-2.5 w-2.5" />
              {t('mod_viewer_cam_face', 'Face')}
            </span>
          ) : preset === 'reset' ? (
            <span className="flex items-center gap-1">
              <RotateCcw className="h-2.5 w-2.5" />
              {t('mod_viewer_cam_reset', 'Reset')}
            </span>
          ) : (
            t(`mod_viewer_cam_${preset}`, preset)
          )}
        </button>
      ))}
    </div>
  );
});
