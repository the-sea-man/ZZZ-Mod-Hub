import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { ShieldAlert, X } from 'lucide-react';
import { ModInfo } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { isModMatchingIdentifier } from '../../utils/modPath';

const COMPONENT_DISPLAY_NAMES: Record<string, string> = {
  Diffuse: 'Color Texture',
  NormalMap: 'Surface Detail',
  LightMap: 'Lighting Map',
  MaterialMap: 'Material Properties',
  IB: 'Mesh (Index Buffer)',
  Position: 'Vertex Positions',
  Blend: 'Blend Weights / Bones',
  Texcoord: 'UV Coordinates',
  Map: 'Texture Map',
  Draw: 'Draw Call',
  Shadow: 'Shadow Mesh',
};

interface HashConflictsModalProps {
  mod: ModInfo;
  onClose: () => void;
}

interface ResolvedHashDetail {
  characterName: string;
  skinName: string;
  componentName: string;
  assetType: string;
}

function resolveHashDetail(hash: string, entitiesDB: any): ResolvedHashDetail | null {
  if (!entitiesDB || !hash) return null;
  const cleanHash = hash.trim().toLowerCase();

  const characterLists = [
    entitiesDB.playable_characters,
    entitiesDB.characters,
    entitiesDB.npcs,
    entitiesDB.entities,
  ];

  for (const list of characterLists) {
    if (!Array.isArray(list)) continue;
    for (const char of list) {
      if (!char || !Array.isArray(char.skins)) continue;
      for (const skin of char.skins) {
        if (!skin || !skin.components) continue;
        for (const [compName, compData] of Object.entries(skin.components as Record<string, any>)) {
          if (!compData) continue;

          if (typeof compData.ib === 'string' && compData.ib.toLowerCase() === cleanHash) {
            return {
              characterName: char.name,
              skinName: skin.name,
              componentName: compName,
              assetType: 'Mesh (Index Buffer / IB)',
            };
          }
          if (
            typeof compData.draw_vb === 'string' &&
            compData.draw_vb.toLowerCase() === cleanHash
          ) {
            return {
              characterName: char.name,
              skinName: skin.name,
              componentName: compName,
              assetType: 'Draw Call (Draw VB)',
            };
          }
          if (
            typeof compData.position_vb === 'string' &&
            compData.position_vb.toLowerCase() === cleanHash
          ) {
            return {
              characterName: char.name,
              skinName: skin.name,
              componentName: compName,
              assetType: 'Vertex Position (Position VB)',
            };
          }
          if (
            typeof compData.blend_vb === 'string' &&
            compData.blend_vb.toLowerCase() === cleanHash
          ) {
            return {
              characterName: char.name,
              skinName: skin.name,
              componentName: compName,
              assetType: 'Blend Weights / Bones (Blend VB)',
            };
          }
          if (
            typeof compData.texcoord_vb === 'string' &&
            compData.texcoord_vb.toLowerCase() === cleanHash
          ) {
            return {
              characterName: char.name,
              skinName: skin.name,
              componentName: compName,
              assetType: 'UV Coordinates (Texcoord VB)',
            };
          }

          if (compData.textures && typeof compData.textures === 'object') {
            for (const [texType, texHash] of Object.entries(
              compData.textures as Record<string, any>
            )) {
              if (typeof texHash === 'string' && texHash.toLowerCase() === cleanHash) {
                const readableTexType = COMPONENT_DISPLAY_NAMES[texType] || `${texType} Texture`;
                return {
                  characterName: char.name,
                  skinName: skin.name,
                  componentName: compName,
                  assetType: readableTexType,
                };
              }
            }
          }
        }
      }
    }
  }

  return null;
}

export function HashConflictsModal({ mod, onClose }: HashConflictsModalProps) {
  const { t } = useTranslation();
  const { modConflicts, entitiesDB, modsPath } = useAppStore();

  // Keyboard: Escape to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Find all conflicts involving this mod
  const relevantConflicts = modConflicts.filter((c) =>
    c.conflicting_mods.some((m) => isModMatchingIdentifier(mod.full_path, m, modsPath))
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 app-blur backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-panel w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-red-500/20 flex flex-col max-h-[90vh]"
      >
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
          <div className="flex items-center justify-between border-b border-textMain/5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center">
                <ShieldAlert size={22} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-textMain">Hash Conflicts</h2>
                <p className="text-xs text-textMuted">
                  {mod.name.replace(/^(DISABLED_|DISABLED )/, '')}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-surface/50 text-textMuted hover:text-textMain flex items-center justify-center transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <p className="text-sm text-textMuted leading-relaxed">
            This mod modifies the same game assets as other active mods. You must disable the
            conflicting mods to use this one.
          </p>

          <div className="space-y-4">
            {relevantConflicts.map((conflict, idx) => {
              const otherMods = conflict.conflicting_mods.filter(
                (m) => !isModMatchingIdentifier(mod.full_path, m, modsPath)
              );
              const detail = resolveHashDetail(conflict.hash, entitiesDB);
              const fallbackComponent =
                (COMPONENT_DISPLAY_NAMES[conflict.affected_component] ??
                  conflict.affected_component) ||
                'General Asset';

              return (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex flex-col gap-2.5"
                >
                  <div className="font-bold flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldAlert size={15} className="text-red-400 shrink-0" />
                      <span>
                        Hash:{' '}
                        <span className="text-white font-mono bg-red-950/60 px-1.5 py-0.5 rounded border border-red-500/30">
                          {conflict.hash}
                        </span>
                      </span>
                    </div>
                  </div>

                  {detail ? (
                    <div className="text-xs bg-red-950/40 border border-red-500/20 rounded-xl px-3 py-2 flex flex-col gap-1 text-red-200">
                      <div className="flex items-center gap-1.5 font-medium flex-wrap">
                        <span className="text-white font-bold">{detail.characterName}</span>
                        <span className="text-red-400">•</span>
                        <span className="text-red-300 font-semibold">{detail.componentName}</span>
                        {detail.skinName && detail.skinName !== 'Default' && (
                          <span className="text-red-400/70 text-[11px]">({detail.skinName})</span>
                        )}
                      </div>
                      <div className="text-red-300/90 text-[11px]">
                        Asset Type: <span className="font-mono text-white">{detail.assetType}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-red-300/90 bg-red-950/30 border border-red-500/15 rounded-xl px-3 py-1.5">
                      Component:{' '}
                      <span className="font-semibold text-white">{fallbackComponent}</span>
                    </div>
                  )}

                  <div>
                    <div className="text-xs text-textMuted font-medium mb-1">
                      Conflicting Active Mod(s):
                    </div>
                    <ul className="list-disc pl-5 space-y-1">
                      {otherMods.map((m, i) => {
                        const name = m.split('/').pop()?.split('\\').pop() || m;
                        return (
                          <li key={i} className="text-red-200 font-medium">
                            {name.replace(/^(DISABLED_|DISABLED )/, '')}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex bg-surface/50 p-4 border-t border-textMain/10 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl font-bold bg-primary text-white hover:bg-primary/80 transition-colors"
          >
            {t('close')}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
