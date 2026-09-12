import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Scissors,
  Package,
  ShieldAlert,
  Loader2,
  Puzzle,
  Users,
  Sparkles,
  Eye,
  Layers,
} from 'lucide-react';
import { ModInfo } from '../../types';
import type { SplitGroupPreview } from '../../types/ipc';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';

export interface SplitModModalProps {
  mod: ModInfo;
  onClose: () => void;
  onSaved: () => void;
  /** When true, suppresses the fixed inset-0 overlay so the content fills a parent container */
  embedded?: boolean;
}

export function SplitModModal({ mod, onClose, onSaved, embedded = false }: SplitModModalProps) {
  const { t } = useTranslation();
  const [splitMode, setSplitMode] = useState<'bodypart' | 'submesh' | 'character'>('bodypart');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<SplitGroupPreview[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const isMonolithic = previews.some((p) => p.is_monolithic || p.warning);

  // Load preview whenever splitMode changes
  useEffect(() => {
    let active = true;
    setLoadingPreview(true);
    setError(null);
    invoke<SplitGroupPreview[]>('preview_split_mod', { modPath: mod.full_path, mode: splitMode })
      .then((res) => {
        if (active) {
          setPreviews(res);
          setLoadingPreview(false);
        }
      })
      .catch((err) => {
        if (active) {
          console.warn('Failed to preview split mod:', err);
          setPreviews([]);
          setLoadingPreview(false);
        }
      });
    return () => {
      active = false;
    };
  }, [mod.full_path, splitMode]);

  const handleSplit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const created = await invoke<string[]>('split_mod', {
        modPath: mod.full_path,
        mode: splitMode,
      });
      useAppStore.getState().incrementStat('modsSplit');
      useAppStore.getState().showToast(
        t('mod_split_success_toast', 'Created {{count}} isolated mod(s)', {
          count: created.length,
        })
      );
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.toString());
    } finally {
      setIsSubmitting(false);
    }
  };

  const inner = (
    <div className="glass-panel w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl border border-textMain/10 flex flex-col max-h-[90vh]">
      <div className="p-6 overflow-y-auto custom-scrollbar space-y-5">
        <div className="flex items-center gap-3 border-b border-textMain/5 pb-4">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              splitMode === 'bodypart'
                ? 'bg-blue-500/20 text-blue-400'
                : splitMode === 'submesh'
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'bg-primary/20 text-primary'
            }`}
          >
            {splitMode === 'bodypart' ? (
              <Layers size={20} />
            ) : splitMode === 'submesh' ? (
              <Puzzle size={20} />
            ) : (
              <Users size={20} />
            )}
          </div>
          <div>
            <h2 className="text-xl font-black text-textMain">
              {t('split_mod_title', 'Split Mod Pack')}
            </h2>
            <p className="text-xs text-textMuted truncate max-w-[340px]" title={mod.name}>
              {mod.name}
            </p>
          </div>
        </div>

        <p className="text-xs text-textMuted leading-relaxed">
          {t(
            'split_mod_desc',
            'Separate this mod pack into individual, fully playable isolated mods for each character or body part.'
          )}
        </p>

        {/* Mode Selector Cards */}
        <div className="space-y-2.5">
          <label className="text-xs font-bold text-textMain uppercase tracking-wider block">
            {t('split_mode_label', 'Split Mode')}
          </label>

          {/* 1. Body Part Mode */}
          <div
            onClick={() => setSplitMode('bodypart')}
            className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
              splitMode === 'bodypart'
                ? 'bg-primary/10 border-primary shadow-md'
                : 'bg-background/40 border-white/5 hover:bg-white/[0.03]'
            }`}
          >
            <input
              type="radio"
              checked={splitMode === 'bodypart'}
              onChange={() => setSplitMode('bodypart')}
              className="mt-0.5 accent-primary"
            />
            <div>
              <div className="text-sm font-bold text-textMain flex items-center gap-2">
                <Layers size={16} className="text-primary" />
                <span>
                  {t('split_by_bodypart', 'Split by Body Part (Upper Body, Lower Body, Hair)')}
                </span>
              </div>
              <p className="text-xs text-textMuted mt-0.5">
                {t(
                  'split_by_bodypart_desc',
                  'Extracts complete, playable anatomical sections along draw-call seams. Guaranteed no missing limbs; perfect for mixing bodies and outfits across mods.'
                )}
              </p>
            </div>
          </div>

          {/* 2. Accessory & Toggles Mode */}
          <div
            onClick={() => setSplitMode('submesh')}
            className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
              splitMode === 'submesh'
                ? 'bg-primary/10 border-primary shadow-md'
                : 'bg-background/40 border-white/5 hover:bg-white/[0.03]'
            }`}
          >
            <input
              type="radio"
              checked={splitMode === 'submesh'}
              onChange={() => setSplitMode('submesh')}
              className="mt-0.5 accent-primary"
            />
            <div>
              <div className="text-sm font-bold text-textMain flex items-center gap-2">
                <Puzzle size={16} className="text-primary" />
                <span>
                  {t('split_by_submesh', 'Split by Accessory & Toggles (Hats, Props, Pieces)')}
                </span>
              </div>
              <p className="text-xs text-textMuted mt-0.5">
                {t(
                  'split_by_submesh_desc',
                  'Extracts isolated accessories, hats, props, and toggled clothing layers into standalone pieces.'
                )}
              </p>
            </div>
          </div>

          {/* 3. Character Mode */}
          <div
            onClick={() => setSplitMode('character')}
            className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
              splitMode === 'character'
                ? 'bg-primary/10 border-primary shadow-md'
                : 'bg-background/40 border-white/5 hover:bg-white/[0.03]'
            }`}
          >
            <input
              type="radio"
              checked={splitMode === 'character'}
              onChange={() => setSplitMode('character')}
              className="mt-0.5 accent-primary"
            />
            <div>
              <div className="text-sm font-bold text-textMain flex items-center gap-2">
                <Users size={16} className="text-primary" />
                <span>{t('split_by_character', 'Split by Character (Multi-Character Pack)')}</span>
              </div>
              <p className="text-xs text-textMuted mt-0.5">
                {t(
                  'split_by_character_desc',
                  'Separates multi-character mod packs into standalone mods for each character.'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Monolithic Mesh Warning & Recommendation Banners */}
        {isMonolithic && splitMode === 'submesh' && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-amber-200">
              <AlertTriangle size={16} className="shrink-0 text-amber-400" />
              <span>{t('split_monolithic_warning_title', 'Monolithic Single-Mesh Mod')}</span>
            </div>
            <p className="leading-relaxed text-amber-300/90 pl-6">
              {t(
                'split_submesh_monolithic_warning',
                'This mod uses a unified single mesh (handling = skip). Slicing internal submesh toggles creates partial pieces with missing body parts or invisible limbs. Switch to "Split by Body Part" to extract complete playable sections instead.'
              )}
            </p>
          </div>
        )}

        {isMonolithic && splitMode === 'bodypart' && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5">
            <Sparkles size={16} className="shrink-0 mt-0.5 text-emerald-400" />
            <p className="leading-relaxed">
              {t(
                'split_bodypart_recommended',
                'Recommended for monolithic mods: extracts full Upper Body and Lower Body sections with zero missing meshes, ready for mix-and-matching.'
              )}
            </p>
          </div>
        )}

        {/* Live Preview of Groups */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package size={14} className="text-primary" />
              <span className="text-xs font-bold text-textMain">
                {t('split_preview_title', 'Preview: {{count}} mod(s) will be created', {
                  count: previews.length,
                })}
              </span>
            </div>
            {loadingPreview && (
              <span className="text-[10px] text-primary flex items-center gap-1">
                <Loader2 size={11} className="animate-spin" />
                {t('analyzing', 'Analyzing...')}
              </span>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <ShieldAlert size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loadingPreview && previews.length === 0 && (
            <p className="text-xs text-textMuted/60 text-center py-4">
              {t('split_no_groups', 'No splittable components detected.')}
            </p>
          )}

          <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
            {previews.map((grp, idx) => {
              const low = grp.group_name.toLowerCase();
              let icon = <Package size={14} className="text-textMuted shrink-0" />;
              if (low.includes('hair'))
                icon = <Sparkles size={14} className="text-amber-400 shrink-0" />;
              else if (low.includes('face') || low.includes('eye') || low.includes('makeup'))
                icon = <Eye size={14} className="text-emerald-400 shrink-0" />;
              else if (
                low.includes('top') ||
                low.includes('dress') ||
                low.includes('skirt') ||
                low.includes('outfit')
              )
                icon = <Layers size={14} className="text-blue-400 shrink-0" />;
              else if (
                low.includes('leg') ||
                low.includes('feet') ||
                low.includes('shoe') ||
                low.includes('arm')
              )
                icon = <Layers size={14} className="text-purple-400 shrink-0" />;
              else if (low.includes('character'))
                icon = <Users size={14} className="text-pink-400 shrink-0" />;

              return (
                <div
                  key={idx}
                  className="bg-black/30 border border-white/5 hover:border-white/10 rounded-xl p-3 flex flex-col gap-1 text-xs transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      {icon}
                      <span className="font-bold text-textMain truncate">{grp.group_name}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-textMuted font-mono shrink-0">
                      {grp.override_count} overrides
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-textMuted/70 pl-5">
                    <span className="truncate max-w-[240px]" title={grp.target_folder_name}>
                      {grp.target_folder_name}
                    </span>
                    <span>•</span>
                    <span>
                      {grp.asset_files.length} asset{grp.asset_files.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
          <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-400" />
          <p className="leading-relaxed">
            {t(
              'split_warning',
              'The original mod folder will be renamed to DISABLED to prevent conflicts with the new split mods.'
            )}
          </p>
        </div>
      </div>

      <div className="flex bg-surface/50 p-4 gap-3 border-t border-textMain/10 shrink-0">
        <button
          onClick={onClose}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-textMain hover:bg-background transition-colors cursor-pointer"
        >
          {t('cancel', 'Cancel')}
        </button>
        <button
          onClick={handleSplit}
          disabled={isSubmitting || previews.length <= 1}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer bg-primary hover:bg-primary/80 shadow-lg shadow-primary/30"
        >
          <Scissors size={16} />
          {isSubmitting
            ? t('splitting', 'Processing...')
            : t('split_button_count', 'Split into {{count}} Mods', {
                count: previews.length || 2,
              })}
        </button>
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 overflow-y-auto">{inner}</div>
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 app-blur backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        {inner}
      </motion.div>
    </div>,
    document.body
  );
}
