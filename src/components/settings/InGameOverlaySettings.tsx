import { motion } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { MonitorPlay, AlertTriangle, Sparkles, MousePointerClick } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

export function InGameOverlaySettings() {
  const { t } = useTranslation();
  const {
    modsPath,
    categories,
    tutorialsSeen,
    setActiveTutorial,
    hudKey,
    setHudKey,
    hudMenuMode,
    setHudMenuMode,
    highlightTargetId,
  } = useAppStore();
  const [isGeneratingUI, setIsGeneratingUI] = useState(false);

  const handleGenerateUI = async () => {
    if (!tutorialsSeen.hud) {
      setActiveTutorial('hud');
      return;
    }

    if (!modsPath) {
      alert('Please select your Mods folder first!');
      return;
    }
    setIsGeneratingUI(true);
    try {
      localStorage.setItem('hud_enabled', 'true');
      const activeModPaths = categories.flatMap((cat) =>
        cat.mods.filter((mod) => mod.is_enabled).map((mod) => mod.full_path)
      );
      await invoke('generate_in_game_ui', {
        rootPath: modsPath,
        activeModPaths,
        hudKey,
        menuMode: hudMenuMode,
      });
      alert('Successfully enabled and updated the in-game HUD for all mods!');
    } catch (e) {
      alert(`Failed to update UI: ${e}`);
    } finally {
      setIsGeneratingUI(false);
    }
  };

  const handleDisableUI = async () => {
    if (!modsPath) {
      alert('Please select your Mods folder first!');
      return;
    }
    try {
      localStorage.setItem('hud_enabled', 'false');
      const res = await invoke('disable_in_game_ui', { rootPath: modsPath });
      alert(res);
    } catch (e) {
      alert('Failed to disable UI: ' + e);
    }
  };

  return (
    <motion.div
      data-highlight-id="overlay_settings"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.3 }}
      className={`glass-panel border border-textMain/5 rounded-3xl p-8 shadow-xl transition-all hover:shadow-2xl hover:border-textMain/10 ${
        highlightTargetId === 'overlay_settings' ? 'highlight-target' : ''
      }`}
    >
      <h2 className="text-xl font-bold text-textMain mb-6 flex items-center gap-3">
        <MonitorPlay size={28} className="text-primary" /> {t('settings_in_game_overlay')}
      </h2>
      <div className="space-y-6">
        <p className="text-sm text-textMuted leading-relaxed">
          {t('settings_overlay_desc1')}
          <br />
          <br />
          <span
            dangerouslySetInnerHTML={{
              __html: t('settings_overlay_desc2', { hudKey }).replace('{{hudKey}}', hudKey),
            }}
          />
        </p>

        <div>
          <label className="block text-sm font-bold text-textMuted mb-2">
            {t('settings_hud_toggle_keybind')}
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={hudKey}
              onChange={(e) => setHudKey(e.target.value.toUpperCase())}
              className="w-32 bg-background/50 border border-textMain/10 rounded-xl px-4 py-3 font-mono text-center font-bold text-lg text-textMain focus:outline-none focus:border-primary/50 transition-all"
              placeholder="H"
              maxLength={1}
            />
            <div className="flex-1 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 flex items-start gap-3">
              <AlertTriangle className="text-yellow-500 shrink-0 mt-0.5" size={18} />
              <p className="text-xs text-yellow-500/80 leading-relaxed">
                {t('settings_hud_keybind_warning')}
              </p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-textMuted mb-2">
            {t('settings_hud_mode')}
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setHudMenuMode('interactive')}
              className={`p-4 rounded-2xl border text-left transition-all ${
                hudMenuMode === 'interactive'
                  ? 'bg-primary/10 border-primary shadow-lg shadow-primary/10'
                  : 'bg-background/40 border-textMain/10 hover:border-textMain/20'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-textMain text-sm mb-1">
                <Sparkles
                  size={16}
                  className={hudMenuMode === 'interactive' ? 'text-primary' : 'text-textMuted'}
                />
                {t('settings_hud_mode_interactive')}
              </div>
              <p className="text-xs text-textMuted leading-relaxed">
                {t('settings_hud_mode_interactive_desc')}
              </p>
            </button>
            <button
              type="button"
              onClick={() => setHudMenuMode('classic')}
              className={`p-4 rounded-2xl border text-left transition-all ${
                hudMenuMode === 'classic'
                  ? 'bg-primary/10 border-primary shadow-lg shadow-primary/10'
                  : 'bg-background/40 border-textMain/10 hover:border-textMain/20'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-textMain text-sm mb-1">
                <MonitorPlay
                  size={16}
                  className={hudMenuMode === 'classic' ? 'text-primary' : 'text-textMuted'}
                />
                {t('settings_hud_mode_classic')}
              </div>
              <p className="text-xs text-textMuted leading-relaxed">
                {t('settings_hud_mode_classic_desc')}
              </p>
            </button>
          </div>
        </div>

        {hudMenuMode === 'interactive' && (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 text-xs text-textMuted space-y-1">
            <div className="font-bold text-primary flex items-center gap-2 mb-1">
              <MousePointerClick size={15} />
              {t('settings_hud_controls_title')}
            </div>
            <p className="leading-relaxed">{t('settings_hud_controls_desc')}</p>
          </div>
        )}

        <div className="flex gap-4 pt-2">
          <button
            onClick={handleGenerateUI}
            disabled={isGeneratingUI || !hudKey.trim()}
            className={`px-6 py-3 rounded-xl font-bold transition-all shadow-lg flex-1 ${isGeneratingUI || !hudKey.trim() ? 'bg-primary/50 text-white/50 cursor-not-allowed' : !tutorialsSeen.hud ? 'bg-primary/20 text-primary border-2 border-primary/60 animate-pulse shadow-primary/20' : 'bg-primary text-white hover:bg-primary/80 shadow-primary/20'}`}
          >
            {isGeneratingUI ? t('settings_enabling') : t('settings_enable_refresh_hud')}
          </button>
          <button
            onClick={handleDisableUI}
            className="px-6 py-3 rounded-xl font-bold transition-all border border-red-500/20 text-red-400 bg-red-500/5 hover:bg-red-500/20 flex-1"
          >
            {t('settings_disable_hud')}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
