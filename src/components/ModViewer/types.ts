import type { BaseModelCandidate, ViewerPayload, ViewerToggle } from '../../types/ipc';
import type { RenderMode, LightingPreset, CameraPreset } from './useThreeScene';
import type { BuiltMesh } from './meshFactory';

export interface RetextureInfo {
  isRetexture: boolean;
  baseModelSource: string | null;
  clues: string[];
  candidates: BaseModelCandidate[];
}

export interface ModViewerModalProps {
  modPath: string;
  modName: string;
  onClose: () => void;
  /** When true, suppresses the fixed inset-0 overlay wrapper so the viewer fills a parent container */
  embedded?: boolean;
  /** Callback to use the captured 3D view snapshot as the mod preview image */
  onUseAsPreview?: (imageSrc: string) => void;
  /** Optional pre-loaded payload (e.g. for GameBanana in-flight 3D preview) */
  initialPayload?: ViewerPayload;
  /** Whether this viewer session is an in-flight GameBanana mod preview */
  isGbPreview?: boolean;
  /** Callback invoked when the user clicks 'Install Mod to Library' in GameBanana preview mode */
  onInstallGbMod?: () => Promise<void> | void;
}

export type {
  RenderMode,
  LightingPreset,
  CameraPreset,
  BuiltMesh,
  ViewerToggle,
  BaseModelCandidate,
};
