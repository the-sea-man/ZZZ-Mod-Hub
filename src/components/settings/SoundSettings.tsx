import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { Volume2, VolumeX, Volume1, Play } from 'lucide-react';
import { playAchievementSound } from '../../utils/audio';

export function SoundSettings() {
  const { t } = useTranslation();
  const {
    soundEffectsEnabled,
    setSoundEffectsEnabled,
    soundEffectsVolume,
    setSoundEffectsVolume,
    highlightTargetId,
  } = useAppStore();

  const handleTestSound = () => {
    playAchievementSound(soundEffectsVolume);
  };

  const getVolumeIcon = () => {
    if (!soundEffectsEnabled || soundEffectsVolume === 0)
      return <VolumeX size={20} className="text-red-400" />;
    if (soundEffectsVolume < 50) return <Volume1 size={20} className="text-primary" />;
    return <Volume2 size={20} className="text-primary" />;
  };

  return (
    <div
      data-highlight-id="sound_settings"
      className={`glass-panel p-6 rounded-2xl flex flex-col gap-6 border border-white/5 shadow-2xl relative overflow-hidden transition-all duration-300 ${
        highlightTargetId === 'sound_settings' ? 'highlight-target' : ''
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-textMain mb-1 flex items-center gap-2">
            {getVolumeIcon()}
            {t('sound_settings_title', 'Sound Effects & Audio')}
          </h2>
          <p className="text-sm text-textMuted max-w-2xl">
            {t(
              'sound_settings_desc',
              'Enable audio feedback for achievement unlocks and notification alerts.'
            )}
          </p>
        </div>

        {/* Toggle Switch */}
        <label className="relative inline-flex items-center cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={soundEffectsEnabled}
            onChange={(e) => setSoundEffectsEnabled(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
        </label>
      </div>

      {soundEffectsEnabled && (
        <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex-1 max-w-md space-y-2">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-textMuted uppercase tracking-wider">
                {t('sound_volume_label', 'Effects Volume')}
              </span>
              <span className="text-primary">{soundEffectsVolume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={soundEffectsVolume}
              onChange={(e) => setSoundEffectsVolume(Number(e.target.value))}
              className="w-full accent-primary bg-black/40 h-2 rounded-lg cursor-pointer"
            />
          </div>

          <button
            type="button"
            onClick={handleTestSound}
            className="px-4 py-2.5 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95 shrink-0"
          >
            <Play size={14} className="fill-current" />
            {t('play_test_sound', 'Play Test Chime')}
          </button>
        </div>
      )}
    </div>
  );
}
