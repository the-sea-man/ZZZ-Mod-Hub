import { memo } from 'react';
import { Sliders, X } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import type { ViewerToggle } from './types';

export interface ModViewerTogglesPanelProps {
  toggles: ViewerToggle[];
  toggleValues: Record<string, number>;
  handleSetToggleValue: (variable: string, val: number) => void;
  handleCycleToggle: (tog: ViewerToggle) => void;
  variant?: 'sidebar' | 'floating';
  onCloseFloating?: () => void;
}

export const ModViewerTogglesPanel = memo(function ModViewerTogglesPanel({
  toggles,
  toggleValues,
  handleSetToggleValue,
  handleCycleToggle,
  variant = 'sidebar',
  onCloseFloating,
}: ModViewerTogglesPanelProps) {
  const { t } = useTranslation();

  if (variant === 'floating') {
    return (
      <div className="w-80 sm:w-96 max-h-80 flex flex-col rounded-2xl border border-purple-500/30 bg-[#161b22]/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 bg-white/[0.03]">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-300">
            <Sliders className="h-3.5 w-3.5" />
            <span>
              {t('mod_viewer_toggles_title', 'Outfit Variations & Toggles')} ({toggles.length})
            </span>
          </div>
          {onCloseFloating && (
            <button
              onClick={onCloseFloating}
              className="rounded p-1 text-white/50 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Scrollable list of toggle cards */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-2 max-h-64">
          {toggles.map((tog) => {
            const curVal = toggleValues[tog.variable.toLowerCase()] ?? tog.current_value;
            return (
              <div key={tog.id} className="rounded-lg border border-white/10 bg-white/5 p-2">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-medium text-white truncate">{tog.name}</span>
                  {tog.key && (
                    <span className="rounded bg-purple-500/20 px-1.5 py-0.2 text-[10px] font-mono font-bold text-purple-300 border border-purple-500/30">
                      [{tog.key.toUpperCase()}]
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {tog.values.map((v, idx) => {
                    const isActive = curVal === v;
                    const label = tog.labels?.[idx] ?? `Style ${idx + 1}`;
                    return (
                      <button
                        key={v}
                        onClick={() => handleSetToggleValue(tog.variable, v)}
                        className={`rounded px-2 py-0.5 text-[11px] font-medium transition-all cursor-pointer ${
                          isActive
                            ? 'bg-purple-600 text-white font-semibold shadow-sm'
                            : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => handleCycleToggle(tog)}
                    className="rounded bg-white/10 px-2 py-0.5 text-[11px] font-medium text-purple-300 hover:bg-purple-500/25 hover:text-white transition-colors cursor-pointer"
                    title={t('mod_viewer_cycle_btn', 'Cycle')}
                  >
                    ↻
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-white/10 px-3 py-2 bg-white/[0.02]">
        <span className="text-xs font-semibold text-white/80">
          {t('mod_viewer_toggles_title', 'Outfit Variations & Toggles')}
        </span>
        <p className="text-[10px] text-white/40 mt-0.5">
          {t('mod_viewer_toggle_hotkey_hint', 'Press hotkey or click buttons to cycle')}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {toggles.map((tog) => {
          const curVal = toggleValues[tog.variable.toLowerCase()] ?? tog.current_value;
          return (
            <div key={tog.id} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-medium text-white truncate">{tog.name}</span>
                {tog.key && (
                  <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-mono font-bold text-purple-300 border border-purple-500/30">
                    [{tog.key.toUpperCase()}]
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {tog.values.map((v, idx) => {
                  const isActive = curVal === v;
                  const label = tog.labels?.[idx] ?? `Style ${idx + 1}`;
                  return (
                    <button
                      key={v}
                      onClick={() => handleSetToggleValue(tog.variable, v)}
                      className={`rounded px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                        isActive
                          ? 'bg-purple-600 text-white font-semibold shadow-sm'
                          : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
                <button
                  onClick={() => handleCycleToggle(tog)}
                  className="rounded bg-white/10 px-2 py-1 text-xs font-medium text-purple-300 hover:bg-purple-500/25 hover:text-white transition-colors cursor-pointer"
                  title={t('mod_viewer_cycle_btn', 'Cycle')}
                >
                  ↻
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
