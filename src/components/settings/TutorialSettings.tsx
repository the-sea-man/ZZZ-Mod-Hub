import { useAppStore } from '../../store/useAppStore';
import { HelpCircle } from 'lucide-react';
import { ACHIEVEMENTS } from '../../constants/achievements';
import { useTranslation } from '../../hooks/useTranslation';

export function TutorialSettings() {
  const { t } = useTranslation();
  const { clearTutorials, tutorialsSeen, userStats, highlightTargetId } = useAppStore();

  const seenCount = Object.values(tutorialsSeen).filter(Boolean).length;
  const tutorialAchievement = ACHIEVEMENTS.find((a) => a.id === 'tutorial_scholar')!;
  const progress = tutorialAchievement.getProgress(userStats, seenCount);
  const target = tutorialAchievement.target;

  const handleReset = () => {
    if (confirm(t('settings_reset_tutorials_confirm'))) {
      clearTutorials();
      alert(t('settings_reset_tutorials_success'));
    }
  };

  return (
    <div
      data-highlight-id="tutorial_settings"
      className={`glass-panel p-6 rounded-2xl flex flex-col gap-4 border border-white/5 shadow-2xl relative overflow-hidden group transition-all duration-300 ${
        highlightTargetId === 'tutorial_settings' ? 'highlight-target' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-textMain mb-1 flex items-center gap-2">
            <HelpCircle size={20} className="text-primary" /> {t('settings_help_onboarding')}
          </h2>
          <p className="text-sm text-textMuted max-w-2xl">{t('settings_help_onboarding_desc')}</p>

          <div className="mt-3 flex items-center gap-2">
            <div className="h-2 w-48 bg-black/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${(progress / target) * 100}%` }}
              />
            </div>
            <span className="text-xs font-bold text-textMuted">
              {t('settings_tutorials_discovered', { progress, target })
                .replace('{{progress}}', progress.toString())
                .replace('{{target}}', target.toString())}
            </span>
          </div>
        </div>
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-surface hover:bg-white/10 text-textMain rounded-xl font-bold transition-all border border-white/10 mt-2"
        >
          {t('settings_reset_tutorials')}
        </button>
      </div>
    </div>
  );
}
