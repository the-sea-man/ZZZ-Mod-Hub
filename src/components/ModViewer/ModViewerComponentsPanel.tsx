import { memo } from 'react';
import { Eye, EyeOff, Target, Tag, Check } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import type { BuiltMesh } from './types';

export interface ModViewerComponentsPanelProps {
  builtMeshes: BuiltMesh[];
  meshVisibility: Record<string, boolean>;
  toggleMeshVisibility: (name: string, index: number) => void;
  soloMeshName: string | null;
  handleToggleSolo: (name: string) => void;
  totalTriangles: number;
  totalVertices: number;
  formatCount: (n: number) => string;
  suggestedTags: string[];
  addedTags: Set<string>;
  handleAddTag: (tag: string) => void;
  isGbPreview: boolean;
}

export const ModViewerComponentsPanel = memo(function ModViewerComponentsPanel({
  builtMeshes,
  meshVisibility,
  toggleMeshVisibility,
  soloMeshName,
  handleToggleSolo,
  totalTriangles,
  totalVertices,
  formatCount,
  suggestedTags,
  addedTags,
  handleAddTag,
  isGbPreview,
}: ModViewerComponentsPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Detected Tags Section */}
      {suggestedTags.length > 0 && !isGbPreview && (
        <div className="border-b border-white/10 p-2.5 bg-white/[0.02]">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-purple-400 mb-1.5">
            <Tag className="h-3 w-3" />
            <span>{t('mod_viewer_suggested_tags', 'Detected Tags')}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {suggestedTags.map((tag) => {
              const isAdded = addedTags.has(tag);
              return (
                <button
                  key={tag}
                  onClick={() => handleAddTag(tag)}
                  disabled={isAdded}
                  className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium transition-all ${
                    isAdded
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 cursor-pointer'
                  }`}
                  title={t('mod_viewer_add_tag', { tag })}
                >
                  {isAdded ? <Check className="h-2.5 w-2.5" /> : <span>+</span>}
                  <span>#{tag}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Polycount Summary Bar */}
      <div className="border-b border-white/10 px-3 py-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-white/40">
          {t('mod_viewer_meshes', 'Meshes')}
        </span>
        <span
          className="text-[10px] font-mono text-white/40"
          title={t('mod_viewer_polycount_total', 'Total Polycount')}
        >
          {formatCount(totalTriangles)} Δ • {formatCount(totalVertices)} V
        </span>
      </div>

      {/* Meshes Scrollable Tree */}
      <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
        {builtMeshes.map((m, idx) => (
          <div
            key={m.name}
            className={`flex items-center gap-1.5 rounded px-2 py-1 transition-colors ${
              soloMeshName === m.name
                ? 'bg-amber-500/15 border border-amber-500/30'
                : 'hover:bg-white/5'
            }`}
          >
            <button
              onClick={() => toggleMeshVisibility(m.name, idx)}
              className="p-0.5 text-white/60 hover:text-white cursor-pointer"
              title={meshVisibility[m.name] ? 'Hide' : 'Show'}
            >
              {meshVisibility[m.name] ? (
                <Eye className="h-3.5 w-3.5 flex-shrink-0 text-purple-400" />
              ) : (
                <EyeOff className="h-3.5 w-3.5 flex-shrink-0 text-white/30" />
              )}
            </button>
            <button
              onClick={() => handleToggleSolo(m.name)}
              className={`rounded p-0.5 text-[10px] font-bold transition-colors cursor-pointer ${
                soloMeshName === m.name
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-white/30 hover:text-amber-300 hover:bg-white/10'
              }`}
              title={
                soloMeshName === m.name
                  ? t('mod_viewer_unsolo', 'Unsolo Submesh')
                  : t('mod_viewer_solo', 'Solo Submesh')
              }
            >
              <Target className="h-3 w-3" />
            </button>
            <div
              onClick={() => toggleMeshVisibility(m.name, idx)}
              className="flex flex-col min-w-0 flex-1 cursor-pointer"
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className={`truncate text-xs ${
                    meshVisibility[m.name] ? 'text-white/80' : 'text-white/30'
                  }`}
                >
                  {m.name}
                </span>
                <span className="text-[10px] font-mono text-white/35 flex-shrink-0">
                  {formatCount(m.triangleCount)} Δ
                </span>
              </div>
              {m.condition && (
                <span className="text-[10px] font-mono text-purple-400/60 truncate">
                  {m.condition}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
