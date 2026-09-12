import type { FC } from 'react';
import { type UserStats, type TutorialId, TUTORIALS_LIST } from '../../store/useAppStore';

export type { TutorialId };
export { TUTORIALS_LIST };

export type AchievementCategory =
  'all' | 'basics' | 'collection' | 'management' | 'tools' | 'customization' | 'system' | 'secret';

export interface AchievementTarget {
  tab: 'library' | 'settings' | 'gamebanana' | 'achievements';
  settingsTab?: 'general' | 'mod_management' | 'downloads' | 'appearance' | 'advanced' | 'about';
  highlightId?: string;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: FC<any>;
  target: number;
  category: AchievementCategory;
  isSecret?: boolean;
  getProgress: (stats: UserStats, tutorialsSeenCount: number) => number;
  navigationTarget?: AchievementTarget | ((stats: UserStats) => AchievementTarget);
  navigateTo?: 'library' | 'settings' | 'gamebanana' | 'achievements';
  steps?: string[];
}

export const TUTORIAL_TARGET_MAP: Record<TutorialId, AchievementTarget> = {
  post_setup: { tab: 'settings', settingsTab: 'general', highlightId: 'game_paths_settings' },
  hud: { tab: 'settings', settingsTab: 'advanced', highlightId: 'overlay_settings' },
  randomize: { tab: 'library', highlightId: 'randomize_button' },
  quick_snapper: {
    tab: 'settings',
    settingsTab: 'mod_management',
    highlightId: 'quick_snapper_settings',
  },
  sync: { tab: 'library', highlightId: 'sync_cloud_db_btn' },
  install_mod: { tab: 'library', highlightId: 'install_mod_btn' },
  launch_game: { tab: 'library', highlightId: 'launch_game_btn' },
  discover_page: { tab: 'gamebanana', highlightId: 'gamebanana_search' },
  achievements_page: { tab: 'achievements' },
  settings_page: {
    tab: 'settings',
    settingsTab: 'appearance',
    highlightId: 'theme_color_picker_section',
  },
  generate_folders: { tab: 'library', highlightId: 'generate_folders_btn' },
};
