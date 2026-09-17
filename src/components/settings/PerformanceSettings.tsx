import { memo } from 'react';
import { motion } from 'framer-motion';
import {
  Cpu,
  Zap,
  Sparkles,
  Activity,
  Sliders,
  FolderSync,
  ShieldAlert,
  Layers,
  RefreshCw,
  Gamepad2,
  Palette,
  Eye,
} from 'lucide-react';
import { useAppStore, type PerformanceProfile } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

export const PerformanceSettings = memo(function PerformanceSettings() {
  const { t } = useTranslation();
  const {
    performanceProfile,
    setPerformanceProfile,
    startupScanEnabled,
    setStartupScanEnabled,
    watcherEnabled,
    setWatcherEnabled,
    autoScriptAnalysisEnabled,
    setAutoScriptAnalysisEnabled,
    autoConflictDetectionEnabled,
    setAutoConflictDetectionEnabled,
    autoCheckUpdates,
    setAutoCheckUpdates,
    fastGamePolling,
    setFastGamePolling,
    animationsEnabled,
    setAnimationsEnabled,
    blurAmount,
    setBlurAmount,
  } = useAppStore();

  const presets: {
    id: PerformanceProfile;
    title: string;
    badge: string;
    desc: string;
    icon: React.ReactNode;
    borderActive: string;
    badgeColor: string;
  }[] = [
    {
      id: 'low',
      title: t('profile_low_title', 'Efficiency Mode'),
      badge: t('profile_low_badge', 'Low Overhead'),
      desc: t(
        'profile_low_desc',
        'Maximizes game FPS and reduces CPU/GPU footprint. Instant cached startup (< 50ms), solid surface panels (0px blur), and on-demand manual checks.'
      ),
      icon: <Cpu size={18} className="text-emerald-400" />,
      borderActive:
        'border-emerald-500 bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/40',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    },
    {
      id: 'balanced',
      title: t('profile_balanced_title', 'Balanced'),
      badge: t('profile_balanced_badge', 'Recommended'),
      desc: t(
        'profile_balanced_desc',
        'Performs full library, conflict, and warning verification during startup, then maintains a lean runtime with debounced watching and smooth animations.'
      ),
      icon: <Zap size={18} className="text-primary" />,
      borderActive: 'border-primary bg-primary/10 text-primary ring-1 ring-primary/40',
      badgeColor: 'bg-primary/20 text-primary border-primary/30',
    },
    {
      id: 'high',
      title: t('profile_high_title', 'Full Fidelity'),
      badge: t('profile_high_badge', 'High Performance'),
      desc: t(
        'profile_high_desc',
        'Continuous real-time folder watching, automated script & conflict audits on all events, 2s hot-reload polling, and maximum blur shaders.'
      ),
      icon: <Sparkles size={18} className="text-purple-400" />,
      borderActive: 'border-purple-500 bg-purple-500/10 text-purple-300 ring-1 ring-purple-500/40',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    },
    {
      id: 'custom',
      title: t('profile_custom_title', 'Custom'),
      badge: t('profile_custom_badge', 'Tailored'),
      desc: t(
        'profile_custom_desc',
        'Individually tailored settings for background monitoring, diagnostics, and graphics.'
      ),
      icon: <Sliders size={18} className="text-amber-400" />,
      borderActive: 'border-amber-500 bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/40',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    },
  ];

  const toggles = [
    {
      category: 'Storage & Filesystem',
      items: [
        {
          key: 'startupScan',
          title: t('toggle_startup_scan_title', 'Auto-Scan on Startup'),
          desc: t(
            'toggle_startup_scan_desc',
            'Performs a full directory scan on boot. Disable to start instantly (< 50ms) using the saved catalog.'
          ),
          badge: 'Disk I/O',
          badgeColor: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
          icon: <FolderSync size={18} className="text-sky-400" />,
          enabled: startupScanEnabled,
          toggle: () => setStartupScanEnabled(!startupScanEnabled),
        },
        {
          key: 'watcher',
          title: t('toggle_watcher_title', 'Mods Folder File Watcher'),
          desc: t(
            'toggle_watcher_desc',
            'Monitors your Mods folder and immediately updates the library when files are changed in Windows Explorer.'
          ),
          badge: 'Disk / CPU',
          badgeColor: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
          icon: <RefreshCw size={18} className="text-cyan-400" />,
          enabled: watcherEnabled,
          toggle: () => setWatcherEnabled(!watcherEnabled),
        },
      ],
    },
    {
      category: 'Diagnostics & Script Audits',
      items: [
        {
          key: 'scriptAnalysis',
          title: t('toggle_script_analysis_title', 'Continuous INI Script Audits'),
          desc: t(
            'toggle_script_analysis_desc',
            'Background scanner that checks .ini files for rogue HUD elements, missing vertex limits, and script syntax.'
          ),
          badge: 'Background CPU',
          badgeColor: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
          icon: <ShieldAlert size={18} className="text-amber-400" />,
          enabled: autoScriptAnalysisEnabled,
          toggle: () => setAutoScriptAnalysisEnabled(!autoScriptAnalysisEnabled),
        },
        {
          key: 'conflictDetection',
          title: t('toggle_conflict_detection_title', 'Mesh & Buffer Conflict Detection'),
          desc: t(
            'toggle_conflict_detection_desc',
            'Detects 3D mesh collisions between enabled mods targeting the same character outfit.'
          ),
          badge: 'Background CPU',
          badgeColor: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
          icon: <Layers size={18} className="text-rose-400" />,
          enabled: autoConflictDetectionEnabled,
          toggle: () => setAutoConflictDetectionEnabled(!autoConflictDetectionEnabled),
        },
      ],
    },
    {
      category: 'Network & Process Integration',
      items: [
        {
          key: 'autoUpdates',
          title: t('toggle_auto_updates_title', 'Check GameBanana Mod Updates'),
          desc: t(
            'toggle_auto_updates_desc',
            'Periodically checks GameBanana in the background for new versions of your downloaded mods.'
          ),
          badge: 'Network',
          badgeColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
          icon: <RefreshCw size={18} className="text-emerald-400" />,
          enabled: autoCheckUpdates,
          toggle: () => setAutoCheckUpdates(!autoCheckUpdates),
        },
        {
          key: 'fastPolling',
          title: t('toggle_fast_polling_title', 'Frequent Game Process Check'),
          desc: t(
            'toggle_fast_polling_desc',
            'Polls every 2 seconds for ZenlessZoneZero.exe to enable rapid in-game Hot-Reload (vs. relaxed 12s).'
          ),
          badge: 'Polling',
          badgeColor: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20',
          icon: <Gamepad2 size={18} className="text-indigo-400" />,
          enabled: fastGamePolling,
          toggle: () => setFastGamePolling(!fastGamePolling),
        },
      ],
    },
    {
      category: 'Graphics & Visual Effects',
      items: [
        {
          key: 'animations',
          title: t('toggle_animations_title', 'UI Animations & Spring Physics'),
          desc: t(
            'toggle_animations_desc',
            'Smooth Framer Motion physics, layout transitions, and hover effects.'
          ),
          badge: 'GPU Render',
          badgeColor: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
          icon: <Palette size={18} className="text-purple-400" />,
          enabled: animationsEnabled,
          toggle: () => setAnimationsEnabled(!animationsEnabled),
        },
        {
          key: 'glassBlur',
          title: t('toggle_glass_blur_title', 'Frosted Glass Blur Shaders'),
          desc: t(
            'toggle_glass_blur_desc',
            'GPU-accelerated backdrop blur shaders on panels and dialogs.'
          ),
          badge: 'GPU Shaders',
          badgeColor: 'text-fuchsia-400 bg-fuchsia-400/10 border-fuchsia-400/20',
          icon: <Eye size={18} className="text-fuchsia-400" />,
          enabled: blurAmount > 0,
          toggle: () => setBlurAmount(blurAmount > 0 ? 0 : 12),
        },
      ],
    },
  ];

  return (
    <motion.div
      data-highlight-id="performance_settings"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="glass-panel p-6 rounded-3xl space-y-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary shadow-inner">
            <Activity size={22} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-textMain">
              {t('performance_profile_title', 'Resource & Performance Center')}
            </h3>
            <p className="text-xs text-textMuted">
              {t(
                'performance_profile_desc',
                'Choose a quick preset or customize individual background scanning, watcher, and rendering features.'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Presets Section */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-textMuted/80 flex items-center gap-2">
          <Zap size={14} className="text-primary" />
          <span>{t('profile_presets_title', 'Quick Optimization Presets')}</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {presets.map((prof) => {
            const isSelected = performanceProfile === prof.id;
            return (
              <button
                key={prof.id}
                type="button"
                onClick={() => setPerformanceProfile(prof.id)}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                  isSelected
                    ? `${prof.borderActive} shadow-lg`
                    : 'border-white/5 bg-surface/40 hover:bg-surface/70 hover:border-white/10'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 font-bold text-sm text-textMain">
                      {prof.icon}
                      <span>{prof.title}</span>
                    </div>
                  </div>
                  <span
                    className={`inline-block text-[10px] px-2 py-0.5 rounded-full border font-bold mb-2 ${prof.badgeColor}`}
                  >
                    {prof.badge}
                  </span>
                  <p className="text-[11px] text-textMuted leading-relaxed">{prof.desc}</p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-xs font-semibold">
                  <span className={isSelected ? 'text-current' : 'text-textMuted'}>
                    {isSelected ? t('active', 'Active') : t('select', 'Apply')}
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full ${isSelected ? 'bg-current animate-pulse' : 'bg-white/20'}`}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Granular Toggles Section */}
      <div className="space-y-6 pt-2 border-t border-white/5">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-textMuted/80 flex items-center gap-2">
            <Sliders size={14} className="text-primary" />
            <span>{t('profile_toggles_title', 'Granular Performance & Feature Switches')}</span>
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {toggles.map((group, gIdx) => (
            <div key={gIdx} className="space-y-3">
              <h5 className="text-xs font-semibold text-textMain/80 px-1">{group.category}</h5>
              <div className="space-y-2.5">
                {group.items.map((item) => (
                  <div
                    key={item.key}
                    onClick={item.toggle}
                    className="p-3.5 rounded-2xl border border-white/5 bg-surface/30 hover:bg-surface/50 hover:border-white/10 transition-all flex items-center justify-between gap-4 cursor-pointer group"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-0.5 p-2 rounded-xl bg-white/5 text-textMuted group-hover:text-textMain transition-colors shrink-0">
                        {item.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-bold text-xs text-textMain">{item.title}</span>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded border font-semibold ${item.badgeColor}`}
                          >
                            {item.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-textMuted leading-relaxed line-clamp-2">
                          {item.desc}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      aria-label={item.title}
                      onClick={(e) => {
                        e.stopPropagation();
                        item.toggle();
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                        item.enabled ? 'bg-primary' : 'bg-white/10'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          item.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
});
