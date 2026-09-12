import { useAppStore } from '../../store/useAppStore';
import { Compass } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

export function DiscoverSettings() {
  const { t } = useTranslation();
  const {
    simpleModeDiscover,
    setSimpleModeDiscover,
    nsfwFilterEnabled,
    setNsfwFilterEnabled,
    blurNsfw,
    setBlurNsfw,
    showApiDebugUrl,
    setShowApiDebugUrl,
  } = useAppStore();

  return (
    <div className="glass-panel p-6 rounded-2xl border border-textMain/5 shadow-xl space-y-6">
      <div className="flex items-center gap-3 border-b border-textMain/5 pb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
          <Compass size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-textMain">{t('settings_discover_tab')}</h2>
          <p className="text-sm text-textMuted">{t('settings_discover_tab_desc')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-bold text-textMain flex justify-between items-center">
            {t('settings_simple_mode')}
            <div
              className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${
                simpleModeDiscover ? 'bg-primary' : 'bg-white/10'
              }`}
              onClick={() => setSimpleModeDiscover(!simpleModeDiscover)}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  simpleModeDiscover ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </div>
          </label>
          <p className="text-xs text-textMuted leading-relaxed">{t('settings_simple_mode_desc')}</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-textMain flex justify-between items-center">
            {t('settings_nsfw_filter')}
            <div
              className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${
                nsfwFilterEnabled ? 'bg-primary' : 'bg-white/10'
              }`}
              onClick={() => setNsfwFilterEnabled(!nsfwFilterEnabled)}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  nsfwFilterEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </div>
          </label>
          <p className="text-xs text-textMuted leading-relaxed">{t('settings_nsfw_filter_desc')}</p>
        </div>

        <div
          className={`space-y-2 transition-opacity ${nsfwFilterEnabled ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}
        >
          <label className="text-sm font-bold text-textMain flex justify-between items-center">
            {t('settings_blur_nsfw')}
            <div
              className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${
                blurNsfw ? 'bg-primary' : 'bg-white/10'
              }`}
              onClick={() => setBlurNsfw(!blurNsfw)}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  blurNsfw ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </div>
          </label>
          <p className="text-xs text-textMuted leading-relaxed">{t('settings_blur_nsfw_desc')}</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-textMain flex justify-between items-center">
            {t('settings_show_api_debug_url', 'Show API Debug URL')}
            <div
              className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${
                showApiDebugUrl ? 'bg-primary' : 'bg-white/10'
              }`}
              onClick={() => setShowApiDebugUrl(!showApiDebugUrl)}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  showApiDebugUrl ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </div>
          </label>
          <p className="text-xs text-textMuted leading-relaxed">
            {t(
              'settings_show_api_debug_url_desc',
              'Display the raw GameBanana API query URLs on the Discover page for diagnostics.'
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
