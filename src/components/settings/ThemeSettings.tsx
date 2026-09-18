import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useAppStore } from '../../store/useAppStore';
import { Palette, Moon, Sun, Sparkles, Globe, Sliders } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { LanguageManagerModal } from '../Modals/LanguageManagerModal';

export function ThemeSettings() {
  const { t } = useTranslation();
  const [showLanguageManager, setShowLanguageManager] = useState(false);
  const {
    language,
    availableLanguages,
    theme,
    primaryColor,
    appOpacity,
    sidebarOpacity,
    bgOpacity,
    blurAmount,
    cardSize,
    uiScale,
    animationsEnabled,
    customBackground,
    setLanguage,
    setTheme,
    setPrimaryColor,
    setAppOpacity,
    setSidebarOpacity,
    setBgOpacity,
    setBlurAmount,
    bgImageBlur,
    bgImageSaturation,
    bgImageBrightness,
    bgImageFit,
    setCardSize,
    setUiScale,
    setAnimationsEnabled,
    setBgImageBlur,
    setBgImageSaturation,
    setBgImageBrightness,
    setBgImageFit,
    setCustomBackground,
    highlightTargetId,
    setSettingsActiveTab,
  } = useAppStore();

  const [openAccordion, setOpenAccordion] = useState<string | null>('theme');

  useEffect(() => {
    if (
      highlightTargetId === 'theme_color_picker_section' ||
      highlightTargetId === 'language_hub_btn'
    ) {
      setOpenAccordion('theme');
    } else if (highlightTargetId === 'background_wallpaper_section') {
      setOpenAccordion('background');
    }
  }, [highlightTargetId]);

  const handleSelectBackground = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Image', extensions: ['png', 'jpeg', 'jpg', 'webp'] }],
      });
      if (selected && typeof selected === 'string') {
        setCustomBackground(selected);
      }
    } catch (e) {
      console.error('Failed to select image:', e);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.3 }}
      className="glass-panel border border-textMain/5 rounded-3xl shadow-xl mb-8 transition-all hover:shadow-2xl hover:border-textMain/10 overflow-hidden"
    >
      <div className="p-8 pb-4 border-b border-textMain/5">
        <h2 className="text-xl font-bold text-textMain flex items-center gap-3">
          <Palette size={28} className="text-primary" /> {t('settings_customization_title')}
        </h2>
        <p className="text-sm text-textMuted mt-2">{t('settings_customization_desc')}</p>
      </div>

      <div className="flex flex-col">
        {/* Theme & Localization Accordion */}
        <div className="border-b border-textMain/5">
          <button
            onClick={() => setOpenAccordion(openAccordion === 'theme' ? null : 'theme')}
            className="w-full flex items-center justify-between p-6 hover:bg-surface/30 transition-colors text-left"
          >
            <span className="font-bold text-textMain">{t('settings_language_theme')}</span>
            <span className="text-textMuted text-lg font-bold">
              {openAccordion === 'theme' ? '−' : '+'}
            </span>
          </button>
          <AnimatePresence>
            {openAccordion === 'theme' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-6 pt-0 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-sm font-bold text-textMuted">
                        {t('settings_language')}
                      </label>
                      <button
                        onClick={() => setShowLanguageManager(true)}
                        className="text-xs font-bold text-primary hover:underline flex items-center gap-1.5"
                      >
                        <Globe size={13} />
                        {t('manage_languages_btn')}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      {availableLanguages.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => setLanguage(lang.code)}
                          className={`py-3 px-3 rounded-xl font-bold transition-all border text-left flex items-center justify-between ${
                            language === lang.code
                              ? 'bg-primary/20 border-primary/50 text-primary shadow-inner'
                              : 'bg-background/50 border-transparent text-textMuted hover:text-textMain hover:bg-surface'
                          }`}
                        >
                          <span className="truncate">{lang.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-textMuted uppercase font-mono">
                            {lang.code}
                          </span>
                        </button>
                      ))}
                    </div>

                    <button
                      data-highlight-id="language_hub_btn"
                      onClick={() => setShowLanguageManager(true)}
                      className={`w-full py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-textMain flex items-center justify-center gap-2 transition-colors ${
                        highlightTargetId === 'language_hub_btn' ? 'highlight-target' : ''
                      }`}
                    >
                      <Globe size={14} className="text-primary" />
                      <span>{t('language_hub_action_card')}</span>
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-textMuted mb-3">
                      {t('settings_theme_mode')}
                    </label>
                    <div className="grid grid-cols-1 gap-3">
                      {[
                        { id: 'dark', label: t('theme_dark'), icon: <Moon size={18} /> },
                        { id: 'light', label: t('theme_light'), icon: <Sun size={18} /> },
                        { id: 'glass', label: t('theme_glass'), icon: <Sparkles size={18} /> },
                      ].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setTheme(t.id as any)}
                          className={`py-3 rounded-xl font-bold transition-all border flex items-center justify-center gap-2 ${theme === t.id ? 'bg-primary/20 border-primary/50 text-primary shadow-inner' : 'bg-background/50 border-transparent text-textMuted hover:text-textMain hover:bg-surface'}`}
                        >
                          <span className="flex items-center justify-center opacity-80">
                            {t.icon}
                          </span>{' '}
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div
                    data-highlight-id="theme_color_picker_section"
                    className={`md:col-span-2 rounded-2xl transition-all ${
                      highlightTargetId === 'theme_color_picker_section'
                        ? 'highlight-target p-4 bg-primary/10'
                        : ''
                    }`}
                  >
                    <label className="block text-sm font-bold text-textMuted mb-3">
                      {t('settings_accent_color')}
                    </label>
                    <div className="flex flex-wrap gap-4">
                      {[
                        { name: 'Theme Default', rgb: '' },
                        { name: 'Azure', rgb: '56, 189, 248' },
                        { name: 'Emerald', rgb: '52, 211, 153' },
                        { name: 'Amber', rgb: '251, 191, 36' },
                        { name: 'Crimson', rgb: '244, 63, 94' },
                        { name: 'Violet', rgb: '167, 139, 250' },
                        { name: 'Fuchsia', rgb: '232, 121, 249' },
                        { name: 'Neon Pink', rgb: '255, 42, 149' },
                        { name: 'Cyber Cyan', rgb: '0, 255, 204' },
                        { name: 'Electric Purple', rgb: '180, 0, 255' },
                        { name: 'Pastel Lilac', rgb: '200, 162, 200' },
                        { name: 'Mint Green', rgb: '152, 255, 152' },
                        { name: 'Sakura Pink', rgb: '255, 183, 197' },
                        { name: 'Gold', rgb: '255, 215, 0' },
                      ].map((color) => (
                        <button
                          key={color.name}
                          onClick={() => setPrimaryColor(color.rgb)}
                          className={`w-12 h-12 rounded-full border-2 transition-all hover:scale-110 shadow-lg ${
                            primaryColor === color.rgb
                              ? 'border-textMain scale-110 ring-2 ring-textMain/20'
                              : 'border-transparent hover:border-textMain/30'
                          }`}
                          style={{
                            backgroundColor: color.rgb
                              ? `rgb(${color.rgb})`
                              : 'var(--color-primary)',
                          }}
                          title={color.name}
                        />
                      ))}

                      {/* Custom Color Picker */}
                      <div
                        className="relative group w-12 h-12 rounded-full border-2 border-dashed border-textMain/30 hover:border-textMain/60 transition-all hover:scale-110 shadow-lg overflow-hidden flex items-center justify-center bg-surface/50"
                        title={t('settings_custom_color', 'Custom Color')}
                      >
                        <div className="text-xl opacity-70">+</div>
                        <input
                          type="color"
                          className="absolute inset-0 w-[200%] h-[200%] -top-1/2 -left-1/2 cursor-pointer opacity-0"
                          onChange={(e) => {
                            const hex = e.target.value;
                            // Convert hex to rgb
                            const r = parseInt(hex.slice(1, 3), 16);
                            const g = parseInt(hex.slice(3, 5), 16);
                            const b = parseInt(hex.slice(5, 7), 16);
                            setPrimaryColor(`${r}, ${g}, ${b}`);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Layout Accordion */}
        <div className="border-b border-textMain/5">
          <button
            onClick={() => setOpenAccordion(openAccordion === 'layout' ? null : 'layout')}
            className="w-full flex items-center justify-between p-6 hover:bg-surface/30 transition-colors text-left"
          >
            <span className="font-bold text-textMain">{t('settings_layout_mod_cards')}</span>
            <span className="text-textMuted text-lg font-bold">
              {openAccordion === 'layout' ? '−' : '+'}
            </span>
          </button>
          <AnimatePresence>
            {openAccordion === 'layout' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-6 pt-0 space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-textMuted mb-2 flex justify-between">
                      <span>{t('settings_mod_card_size')}</span>
                      <span className="font-mono text-primary font-bold">{cardSize}px</span>
                    </label>
                    <input
                      type="range"
                      min="150"
                      max="400"
                      value={cardSize}
                      onChange={(e) => setCardSize(parseInt(e.target.value))}
                      className="w-full h-2 bg-background/50 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                      {[
                        { label: t('card_density_compact', 'Compact'), size: 170 },
                        { label: t('card_density_standard', 'Standard'), size: 220 },
                        { label: t('card_density_large', 'Large'), size: 280 },
                        { label: t('card_density_showcase', 'Showcase'), size: 340 },
                      ].map((preset) => (
                        <button
                          key={preset.size}
                          type="button"
                          onClick={() => setCardSize(preset.size)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            cardSize === preset.size
                              ? 'bg-primary text-white shadow-sm'
                              : 'bg-surface hover:bg-surface/80 text-textMuted hover:text-textMain border border-textMain/5'
                          }`}
                        >
                          {preset.label} ({preset.size}px)
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-textMain/5">
                      <p className="text-xs text-textMuted">{t('settings_mod_card_size_desc')}</p>
                      <button
                        type="button"
                        onClick={() => setSettingsActiveTab('card_appearance')}
                        className="text-xs text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer shrink-0 ml-2"
                      >
                        <Sliders size={13} />
                        <span>{t('open_card_designer', 'Open Card Designer')}</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-textMuted mb-2 flex justify-between">
                      <span>{t('ui_scale', 'UI Scaling')}</span>
                      <span>{uiScale}%</span>
                    </label>
                    <input
                      type="range"
                      min="80"
                      max="150"
                      step="5"
                      value={uiScale}
                      onChange={(e) => setUiScale(parseInt(e.target.value))}
                      className="w-full h-2 bg-background/50 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                      {[80, 90, 100, 110, 125, 150].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setUiScale(preset)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                            uiScale === preset
                              ? 'bg-primary text-black shadow-sm'
                              : 'bg-white/5 hover:bg-white/10 text-textMuted hover:text-textMain'
                          }`}
                        >
                          {preset}%{preset === 100 ? ` (${t('default', 'Default')})` : ''}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-textMuted mt-2">
                      {t('ui_scale_desc', 'Adjust global interface zoom level (80% - 150%).')}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div>
                      <span className="font-bold text-textMain block text-sm">
                        {t('enable_animations', 'Interface Animations')}
                      </span>
                      <span className="text-xs text-textMuted">
                        {t(
                          'enable_animations_desc',
                          'Toggle smooth UI motion & transitions for lower-end hardware.'
                        )}
                      </span>
                    </div>
                    <button
                      onClick={() => setAnimationsEnabled(!animationsEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${animationsEnabled ? 'bg-primary' : 'bg-white/10'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${animationsEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                      />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Glass Mode Settings Accordion */}
        <div>
          <button
            onClick={() => setOpenAccordion(openAccordion === 'glass' ? null : 'glass')}
            className="w-full flex items-center justify-between p-6 hover:bg-surface/30 transition-colors text-left"
          >
            <span className="font-bold text-textMain">{t('settings_glass_mode_engine')}</span>
            <span className="text-textMuted text-lg font-bold">
              {openAccordion === 'glass' ? '−' : '+'}
            </span>
          </button>
          <AnimatePresence>
            {openAccordion === 'glass' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-6 pt-0 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className="block text-sm font-bold text-textMuted mb-2 flex justify-between">
                        <span>{t('settings_app_panel_transparency')}</span>
                        <span>{appOpacity}%</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={appOpacity}
                        onChange={(e) => setAppOpacity(parseInt(e.target.value))}
                        className="w-full h-2 bg-background/50 rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                      <p className="text-xs text-textMuted mt-2">
                        {t('settings_app_panel_transparency_desc')}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-textMuted mb-2 flex justify-between">
                        <span>{t('settings_sidebar_transparency')}</span>
                        <span>{sidebarOpacity}%</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={sidebarOpacity}
                        onChange={(e) => setSidebarOpacity(parseInt(e.target.value))}
                        className="w-full h-2 bg-background/50 rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                      <p className="text-xs text-textMuted mt-2">
                        {t('settings_sidebar_transparency_desc')}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-textMuted mb-2 flex justify-between">
                        <span>{t('settings_background_dimming')}</span>
                        <span>{bgOpacity}%</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={bgOpacity}
                        onChange={(e) => setBgOpacity(parseInt(e.target.value))}
                        className="w-full h-2 bg-background/50 rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                      <p className="text-xs text-textMuted mt-2">
                        {t('settings_background_dimming_desc')}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-textMuted mb-2 flex justify-between">
                        <span>{t('settings_glass_blur_strength')}</span>
                        <span>{blurAmount}px</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="40"
                        value={blurAmount}
                        onChange={(e) => setBlurAmount(parseInt(e.target.value))}
                        className="w-full h-2 bg-background/50 rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                      <p className="text-xs text-textMuted mt-2">
                        {t('settings_glass_blur_strength_desc')}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-textMain/10 pt-8">
                    <h3 className="font-bold text-textMain mb-4">
                      {t('settings_background_image_filters')}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div>
                        <label className="block text-sm font-bold text-textMuted mb-2 flex justify-between">
                          <span>{t('settings_image_blur')}</span>
                          <span>{bgImageBlur}px</span>
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="20"
                          value={bgImageBlur}
                          onChange={(e) => setBgImageBlur(parseInt(e.target.value))}
                          className="w-full h-2 bg-background/50 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <p className="text-xs text-textMuted mt-2">
                          {t('settings_image_blur_desc')}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-textMuted mb-2 flex justify-between">
                          <span>{t('settings_saturation')}</span>
                          <span>{bgImageSaturation}%</span>
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="200"
                          value={bgImageSaturation}
                          onChange={(e) => setBgImageSaturation(parseInt(e.target.value))}
                          className="w-full h-2 bg-background/50 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <p className="text-xs text-textMuted mt-2">
                          {t('settings_saturation_desc')}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-textMuted mb-2 flex justify-between">
                          <span>{t('settings_brightness')}</span>
                          <span>{bgImageBrightness}%</span>
                        </label>
                        <input
                          type="range"
                          min="50"
                          max="150"
                          value={bgImageBrightness}
                          onChange={(e) => setBgImageBrightness(parseInt(e.target.value))}
                          className="w-full h-2 bg-background/50 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <p className="text-xs text-textMuted mt-2">
                          {t('settings_brightness_desc')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div
                    data-highlight-id="background_wallpaper_section"
                    className={`border-t border-textMain/10 pt-8 rounded-2xl transition-all ${
                      highlightTargetId === 'background_wallpaper_section'
                        ? 'highlight-target p-4 bg-primary/10'
                        : ''
                    }`}
                  >
                    <label className="block text-sm font-bold text-textMuted mb-1">
                      {t('settings_custom_background')}
                    </label>
                    <p className="text-xs text-textMuted mb-4">
                      {t('settings_custom_background_tip1')} <br />
                      {t('settings_custom_background_tip2')}{' '}
                      <span className="font-mono text-primary bg-background/50 px-1 py-0.5 rounded select-all">
                        %APPDATA%\com.zzzmodhub.app\images
                      </span>
                    </p>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={handleSelectBackground}
                        className="px-6 py-3 bg-surface border border-textMain/10 hover:border-primary/50 hover:bg-primary/10 rounded-xl font-bold text-sm transition-all shadow-sm"
                      >
                        {t('settings_choose_local_file')}
                      </button>
                      {customBackground && (
                        <div className="flex flex-col gap-4 bg-background/30 px-4 py-3 rounded-xl border border-textMain/5">
                          <div className="flex items-center gap-4">
                            <span className="text-sm font-mono text-textMain truncate max-w-xs">
                              {customBackground.split(/[\\/]/).pop()}
                            </span>
                            <button
                              onClick={() => setCustomBackground('')}
                              className="text-red-400 hover:text-red-300 text-sm font-bold"
                            >
                              {t('clear')}
                            </button>
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-textMuted">
                              {t('settings_image_fit')}
                            </label>
                            <div className="flex gap-2">
                              {['cover', 'contain', '100% 100%'].map((fitMode) => (
                                <button
                                  key={fitMode}
                                  onClick={() => setBgImageFit(fitMode as any)}
                                  className={`px-3 py-1 text-xs rounded-lg font-bold border transition-all ${bgImageFit === fitMode ? 'bg-primary border-primary text-white' : 'bg-surface border-textMain/10 text-textMuted hover:border-primary/50'}`}
                                >
                                  {fitMode === 'cover'
                                    ? t('settings_fit_cover')
                                    : fitMode === 'contain'
                                      ? t('settings_fit_contain')
                                      : t('settings_fit_stretch')}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {showLanguageManager && (
          <LanguageManagerModal onClose={() => setShowLanguageManager(false)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
