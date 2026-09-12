import { useAppStore } from '../../store/useAppStore';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

export function QuickSnapperSettings() {
  const { t } = useTranslation();
  const {
    quickSnapperEnabled,
    quickSnapperHotkey,
    quickSnapperCropX,
    quickSnapperCropY,
    quickSnapperCropW,
    quickSnapperCropH,
    quickSnapperAutoReload,
    setQuickSnapperEnabled,
    setQuickSnapperHotkey,
    setQuickSnapperCrop,
    setQuickSnapperAutoReload,
    highlightTargetId,
  } = useAppStore();

  return (
    <div
      data-highlight-id="quick_snapper_settings"
      className={`glass-panel p-6 rounded-2xl flex flex-col gap-4 border border-white/5 shadow-2xl relative overflow-hidden group transition-all duration-300 ${
        highlightTargetId === 'quick_snapper_settings' ? 'highlight-target' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-textMain mb-1">{t('settings_quick_snapper')}</h2>
          <p className="text-sm text-textMuted max-w-2xl mb-2">
            {t('settings_quick_snapper_desc', { hotkey: quickSnapperHotkey }).replace(
              '{{hotkey}}',
              quickSnapperHotkey
            )}
          </p>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 inline-block">
            <p className="text-xs text-yellow-500/90">
              <span className="font-bold text-yellow-500">{t('note')}:</span>{' '}
              {t('settings_quick_snapper_note')}
            </p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={quickSnapperEnabled}
            onChange={(e) => {
              const state = useAppStore.getState();
              if (e.target.checked && !state.tutorialsSeen.quick_snapper) {
                state.setActiveTutorial('quick_snapper');
                return;
              }
              setQuickSnapperEnabled(e.target.checked);
            }}
          />
          <div
            className={`w-11 h-6 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-textMain after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary ${!useAppStore.getState().tutorialsSeen.quick_snapper ? 'bg-primary/30 border-2 border-primary/60 animate-pulse shadow-[0_0_15px_rgba(0,0,0,0)] shadow-primary/30' : 'bg-surface'}`}
          ></div>
        </label>
      </div>

      {quickSnapperEnabled && (
        <div className="flex flex-col gap-4 mt-2">
          <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
            <h3 className="text-orange-400 font-bold mb-1 flex items-center gap-2">
              <AlertTriangle size={16} /> {t('settings_qs_windowed_required')}
            </h3>
            <p
              className="text-sm text-orange-200/80"
              dangerouslySetInnerHTML={{ __html: t('settings_qs_windowed_desc') }}
            />
          </div>

          <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl">
            <h3 className="text-primary font-bold mb-1">{t('settings_qs_how_it_works')}</h3>
            <p
              className="text-sm text-textMuted mb-2"
              dangerouslySetInnerHTML={{
                __html: t('settings_qs_steps', { hotkey: quickSnapperHotkey }).replace(
                  '{{hotkey}}',
                  quickSnapperHotkey
                ),
              }}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
            <div>
              <h3 className="text-sm font-bold text-textMain">
                {t('settings_qs_auto_reload_title')}
              </h3>
              <p className="text-xs text-textMuted mt-0.5">{t('settings_qs_auto_reload_desc')}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={quickSnapperAutoReload}
                onChange={(e) => setQuickSnapperAutoReload(e.target.checked)}
              />
              <div className="w-11 h-6 bg-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-textMain after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          <div>
            <div className="flex gap-4">
              <div className="flex-1">
                <h3 className="text-sm font-bold text-textMain mb-3">
                  {t('settings_qs_global_hotkey')}
                </h3>
                <input
                  type="text"
                  value={quickSnapperHotkey}
                  onChange={(e) => setQuickSnapperHotkey(e.target.value)}
                  className="w-full bg-background/50 border border-textMain/10 rounded-xl px-4 py-2 font-mono text-sm text-textMain focus:outline-none focus:border-primary/50 transition-all"
                  placeholder="Alt+Shift+S"
                />
                <p className="text-xs text-textMuted mt-1">{t('settings_qs_global_hotkey_desc')}</p>
              </div>

              <div className="flex-[3]">
                <h3 className="text-sm font-bold text-textMain mb-3">
                  {t('settings_qs_crop_preset')}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-textMuted uppercase tracking-wider font-bold">
                      {t('settings_qs_x_offset')}
                    </label>
                    <input
                      type="number"
                      value={quickSnapperCropX}
                      onChange={(e) =>
                        setQuickSnapperCrop(
                          parseInt(e.target.value) || 0,
                          quickSnapperCropY,
                          quickSnapperCropW,
                          quickSnapperCropH
                        )
                      }
                      className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-textMain focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-textMuted uppercase tracking-wider font-bold">
                      {t('settings_qs_y_offset')}
                    </label>
                    <input
                      type="number"
                      value={quickSnapperCropY}
                      onChange={(e) =>
                        setQuickSnapperCrop(
                          quickSnapperCropX,
                          parseInt(e.target.value) || 0,
                          quickSnapperCropW,
                          quickSnapperCropH
                        )
                      }
                      className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-textMain focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-textMuted uppercase tracking-wider font-bold">
                      {t('settings_qs_width')}
                    </label>
                    <input
                      type="number"
                      value={quickSnapperCropW}
                      onChange={(e) =>
                        setQuickSnapperCrop(
                          quickSnapperCropX,
                          quickSnapperCropY,
                          parseInt(e.target.value) || 0,
                          quickSnapperCropH
                        )
                      }
                      className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-textMain focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-textMuted uppercase tracking-wider font-bold">
                      {t('settings_qs_height')}
                    </label>
                    <input
                      type="number"
                      value={quickSnapperCropH}
                      onChange={(e) =>
                        setQuickSnapperCrop(
                          quickSnapperCropX,
                          quickSnapperCropY,
                          quickSnapperCropW,
                          parseInt(e.target.value) || 0
                        )
                      }
                      className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-textMain focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              onClick={() => (window as any).triggerQuickSnapper?.()}
              className="px-4 py-2 bg-primary/20 text-primary hover:bg-primary hover:text-white rounded-xl font-bold transition-all border border-primary/30"
            >
              {t('settings_qs_simulate')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
