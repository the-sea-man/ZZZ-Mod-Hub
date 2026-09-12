import { FlaskConical, AlertTriangle, Wrench, Scissors, Crosshair } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';

export function ExperimentalSettings() {
  const { t } = useTranslation();
  const {
    experimentalFeaturesEnabled,
    setExperimentalFeaturesEnabled,
    highlightTargetId,
    showToast,
  } = useAppStore();

  const handleToggle = (enabled: boolean) => {
    setExperimentalFeaturesEnabled(enabled);
    if (enabled) {
      showToast(t('experimental_enabled_toast', 'Experimental features unlocked.'));
    } else {
      showToast(t('experimental_disabled_toast', 'Experimental features locked.'));
    }
  };

  const isHighlighted = highlightTargetId === 'experimental_settings';

  return (
    <div
      data-highlight-id="experimental_settings"
      className={`glass-panel border rounded-2xl p-6 relative overflow-hidden transition-all duration-500 shadow-xl ${
        isHighlighted
          ? 'border-amber-500/80 ring-4 ring-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.25)] scale-[1.01]'
          : 'border-white/10 hover:border-white/20'
      }`}
    >
      {/* Background glow when enabled or highlighted */}
      <div
        className={`absolute -right-20 -top-20 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none transition-opacity duration-500 ${
          experimentalFeaturesEnabled || isHighlighted ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div className="relative flex flex-col gap-6">
        {/* Header with Title and Main Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <FlaskConical size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-textMain tracking-tight">
                  {t('experimental_settings_title', 'Experimental Features')}
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  {t('experimental_tag', 'Experimental')}
                </span>
              </div>
              <p className="text-sm text-textMuted mt-0.5">
                {t(
                  'experimental_settings_desc',
                  'Unlock advanced and experimental tools including automated INI script fixing, vertex buffer migration, mod splitting, and live in-game hash sniffing.'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            <button
              role="switch"
              aria-checked={experimentalFeaturesEnabled}
              onClick={() => handleToggle(!experimentalFeaturesEnabled)}
              className={`w-14 h-8 rounded-full p-1 transition-all duration-300 relative shrink-0 cursor-pointer ${
                experimentalFeaturesEnabled
                  ? 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]'
                  : 'bg-surface-light/40 border border-white/10 hover:bg-surface-light/60'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-all duration-300 ${
                  experimentalFeaturesEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Warning Callout */}
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-300/90 leading-relaxed">
            <p className="font-semibold text-amber-300 mb-0.5">
              {t('experimental_warning_title', 'Developer & Advanced Features')}
            </p>
            <p>
              {t(
                'experimental_warning_callout',
                'These features directly alter mod scripts or hook into game runtime logs. Make sure you back up your mods before using.'
              )}
            </p>
          </div>
        </div>

        {/* Features list under this gate */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-white/5">
          <div className="p-3.5 rounded-xl glass-panel-bg border border-white/5 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-textMain font-semibold text-xs">
              <Wrench size={15} className="text-amber-400" />
              <span>{t('experimental_feat_fixer', 'INI Script & Buffer Auto-Fixer')}</span>
            </div>
            <p className="text-[11px] text-textMuted leading-snug">
              {t(
                'experimental_feat_fixer_desc',
                'Automatically analyzes and patches outdated game hashes and re-indexes vertex buffers.'
              )}
            </p>
          </div>

          <div className="p-3.5 rounded-xl glass-panel-bg border border-white/5 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-textMain font-semibold text-xs">
              <Scissors size={15} className="text-amber-400" />
              <span>{t('experimental_feat_splitter', 'Mod Decomposition (Splitter)')}</span>
            </div>
            <p className="text-[11px] text-textMuted leading-snug">
              {t(
                'experimental_feat_splitter_desc',
                'Splits bundled multi-character or anatomical component mods into standalone folders.'
              )}
            </p>
          </div>

          <div className="p-3.5 rounded-xl glass-panel-bg border border-white/5 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-textMain font-semibold text-xs">
              <Crosshair size={15} className="text-amber-400" />
              <span>{t('experimental_feat_sniffer', '3DMigoto Hunting Sniffer')}</span>
            </div>
            <p className="text-[11px] text-textMuted leading-snug">
              {t(
                'experimental_feat_sniffer_desc',
                'Live logger that tracks rendered vertex and index buffers directly from the game runtime.'
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
