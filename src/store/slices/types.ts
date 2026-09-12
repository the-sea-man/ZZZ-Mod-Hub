import { PreferencesSlice } from './preferencesSlice';
import { LibrarySlice } from './librarySlice';
import { DiagnosticsSlice } from './diagnosticsSlice';
import { StatsAchievementsSlice } from './statsAchievementsSlice';
import { ProfilesSlice } from './profilesSlice';

export type TutorialId =
  | 'post_setup'
  | 'hud'
  | 'randomize'
  | 'quick_snapper'
  | 'sync'
  | 'install_mod'
  | 'launch_game'
  | 'discover_page'
  | 'achievements_page'
  | 'settings_page'
  | 'generate_folders';

export const TUTORIALS_LIST: TutorialId[] = [
  'post_setup',
  'hud',
  'randomize',
  'quick_snapper',
  'sync',
  'install_mod',
  'launch_game',
  'discover_page',
  'achievements_page',
  'settings_page',
  'generate_folders',
];

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  date: string;
}

export interface UserStats {
  modsInstalledLocal: number;
  modsInstalledGB: number;
  keybindsChanged: number;
  modsDeleted: number;
  quickSnapsTaken: number;
  gameLaunches: number;
  randomizeCount: number;
  modsToggled: number;
  filtersUsed: number;
  cloudSyncs: number;
  notesWritten: number;
  modsInstalledDragDrop: number;
  batchOpsPerformed: number;
  globalSearchesUsed: number;
  smartDownloadsUsed: number;
  hotReloadsTriggered: number;
  modsUpdated: number;
  conflictsViewed: number;
  previews3d: number;
  modsSplit: number;
  imagesCropped: number;
  backupsExported: number;
  warningsFixed: number;
  autoSortsUsed: number;
  tagsEdited: number;
  huntingModeUsed: number;
  categoryMapped: number;
  languagePacksUsed: number;
  customColorPicked: number;
  konamiCodeEntered: number;
  filterConfigChanged: number;
}

export type PerformanceProfile = 'low' | 'balanced' | 'high' | 'custom';

export type AppState = PreferencesSlice &
  LibrarySlice &
  DiagnosticsSlice &
  StatsAchievementsSlice &
  ProfilesSlice;

export type AppStore = AppState;
