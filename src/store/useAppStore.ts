import { create } from 'zustand';
import { runStorageMigrations } from '../utils/storage';
import { createPreferencesSlice } from './slices/preferencesSlice';
import { createLibrarySlice } from './slices/librarySlice';
import { createDiagnosticsSlice } from './slices/diagnosticsSlice';
import { createStatsAchievementsSlice } from './slices/statsAchievementsSlice';
import { createProfilesSlice } from './slices/profilesSlice';
import type {
  AppState,
  AppStore,
  TutorialId,
  AppNotification,
  UserStats,
  PerformanceProfile,
} from './slices/types';

// Execute versioned storage migrations once on startup
runStorageMigrations();

// Re-export domain types for backward compatibility with existing components
export type { AppState, AppStore, TutorialId, AppNotification, UserStats, PerformanceProfile };
export { TUTORIALS_LIST } from './slices/types';

export const useAppStore = create<AppState>()((...a) => ({
  ...createPreferencesSlice(...a),
  ...createLibrarySlice(...a),
  ...createDiagnosticsSlice(...a),
  ...createStatsAchievementsSlice(...a),
  ...createProfilesSlice(...a),
}));
