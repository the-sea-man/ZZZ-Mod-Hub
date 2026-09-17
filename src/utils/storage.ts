/**
 * Safe local storage utilities and versioned configuration migrations.
 * Ensures user preferences, paths, and settings are never lost or corrupted across app updates.
 */

export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Safely parses JSON from localStorage with fallback on error or malformed data.
 */
export function safeGetJSON<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined || raw === '') {
      return defaultValue;
    }
    const parsed = JSON.parse(raw);
    if (parsed === null || parsed === undefined) {
      return defaultValue;
    }
    // Type guards for arrays/objects
    if (Array.isArray(defaultValue)) {
      return (Array.isArray(parsed) ? parsed : defaultValue) as T;
    }
    if (typeof defaultValue === 'object' && defaultValue !== null) {
      return (
        typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
          ? parsed
          : defaultValue
      ) as T;
    }
    return parsed as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Safely writes JSON to localStorage with error catching.
 */
export function safeSetJSON<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to save key '${key}' to localStorage:`, e);
  }
}

/**
 * Safely retrieves an integer from localStorage with bounds checking.
 */
export function safeGetInt(key: string, defaultValue: number, min?: number, max?: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined || raw.trim() === '') {
      return defaultValue;
    }
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed)) {
      return defaultValue;
    }
    if (min !== undefined && parsed < min) return min;
    if (max !== undefined && parsed > max) return max;
    return parsed;
  } catch {
    return defaultValue;
  }
}

/**
 * Safely retrieves a boolean from localStorage.
 */
export function safeGetBool(key: string, defaultValue: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) {
      return defaultValue;
    }
    const lower = raw.trim().toLowerCase();
    if (lower === 'true' || lower === '1') return true;
    if (lower === 'false' || lower === '0') return false;
    return defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Safely retrieves a string from localStorage.
 */
export function safeGetString(key: string, defaultValue: string): string {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) {
      return defaultValue;
    }
    const trimmed = raw.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === 'string') return parsed;
      } catch {
        return trimmed.slice(1, -1);
      }
    }
    return trimmed;
  } catch {
    return defaultValue;
  }
}

/**
 * Runs versioned migrations on localStorage to ensure backward compatibility across releases.
 */
export function runStorageMigrations(): void {
  // Always clean up heavy cache keys from localStorage to prevent quota exhaustion and white screen crashes
  try {
    localStorage.removeItem('cached_categories');
    localStorage.removeItem('cached_entities_db');
  } catch {
    // Ignore storage cleanup errors
  }

  const currentVersion = safeGetInt('app_schema_version', 0);

  if (currentVersion < 1) {
    // Migration v1:
    // 1. Backfill setupComplete from existing mods_path (Principle 14)
    const hasModsPath = !!localStorage.getItem('mods_path');
    const setupVal = localStorage.getItem('setupComplete');
    if (setupVal === null && hasModsPath) {
      localStorage.setItem('setupComplete', 'true');
    }

    // 2. Normalize and backfill enabledWarningRules
    const defaultWarningRules: Record<string, boolean> = {
      standalone_help: true,
      rogue_hud: true,
      multi_character: true,
      unconditional_key: true,
      missing_vertex_limit_override: true,
      missing_resource_definition: true,
      duplicate_section: true,
      missing_resource_ref: true,
      unconditional_texture_override: true,
      conflict: true,
    };
    const existingRules = safeGetJSON<Record<string, boolean>>(
      'enabledWarningRules',
      defaultWarningRules
    );
    // Remove obsolete rules like global_present
    delete (existingRules as any).global_present;
    // Merge missing rules while preserving user-disabled settings
    const mergedRules = { ...defaultWarningRules, ...existingRules };
    safeSetJSON('enabledWarningRules', mergedRules);

    // 3. Normalize theme
    const theme = safeGetString('theme', 'glass');
    if (!['dark', 'light', 'glass'].includes(theme)) {
      localStorage.setItem('theme', 'glass');
    }

    // 4. Normalize language
    const lang = safeGetString('language', 'en');
    const validLanguages = [
      'en',
      'zh',
      'zh_TW',
      'ja',
      'ko',
      'es',
      'ru',
      'pt_BR',
      'th',
      'th_custom',
    ];
    if (!validLanguages.includes(lang)) {
      localStorage.setItem('language', 'en');
    }

    // 5. Mark schema version
    localStorage.setItem('app_schema_version', '1');
  }
}

export interface FullAppBackup {
  schemaVersion: number;
  exportedAt: string;
  keys: Record<string, string>;
}

/**
 * Exports all relevant configuration, paths, profiles, and stats into a portable JSON backup.
 */
export function exportFullBackup(): string {
  const keysToBackup = [
    'mods_path',
    'game_exe_path',
    'winrar_path',
    'language',
    'hasSelectedLanguage',
    'theme',
    'primaryColor',
    'appOpacity',
    'sidebarOpacity',
    'bgOpacity',
    'blurAmount',
    'bgImageBlur',
    'bgImageSaturation',
    'bgImageBrightness',
    'bgImageFit',
    'cardSize',
    'uiScale',
    'animationsEnabled',
    'autoLaunchGame',
    'modSortMode',
    'categoryFilterMode',
    'customBackground',
    'hasVisitedSettings',
    'hasDismissedSettingsNudge',
    'setupComplete',
    'watcherEnabled',
    'hotreloadEnabled',
    'alwaysAutoAssign',
    'downloadImages',
    'ignoredMods',
    'favoriteCategories',
    'categoryIcons',
    'favoriteMods',
    'favoriteRandomizerWeight',
    'randomizerWhitelist',
    'maxDownloadAttempts',
    'downloadRetryInterval',
    'defaultDiscoverCharacter',
    'simpleModeDiscover',
    'showApiDebugUrl',
    'nsfwFilterEnabled',
    'blurNsfw',
    'conflictWarningLevel',
    'enabledWarningRules',
    'quickSnapperEnabled',
    'quickSnapperHotkey',
    'quickSnapperCropX',
    'quickSnapperCropY',
    'quickSnapperCropW',
    'quickSnapperCropH',
    'hudKey',
    'hudMenuMode',
    'selectedElement',
    'selectedFaction',
    'selectedGender',
    'selectedHeight',
    'selectedModel',
    'selectedSpecies',
    'selectedRole',
    'showElementFilter',
    'showFactionFilter',
    'showGenderFilter',
    'showHeightFilter',
    'showModelFilter',
    'showSpeciesFilter',
    'showRoleFilter',
    'tutorialsSeen',
    'hasSeenAllAchievementsConfetti',
    'userStats',
    'mod_profiles',
    'active_profile_id',
    'zmm_features_tested_status',
    'readNotifications',
    'lastReadNotificationTimestamp',
    'experimental_features_enabled',
  ];

  const backupData: Record<string, string> = {};
  for (const k of keysToBackup) {
    const val = localStorage.getItem(k);
    if (val !== null) {
      backupData[k] = val;
    }
  }

  const payload: FullAppBackup = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    keys: backupData,
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Imports a full app backup, validates, runs migrations, and restores settings.
 */
export function importFullBackup(jsonString: string): boolean {
  try {
    const parsed: FullAppBackup = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object' || !parsed.keys || typeof parsed.keys !== 'object') {
      return false;
    }

    for (const [k, v] of Object.entries(parsed.keys)) {
      if (typeof v === 'string') {
        localStorage.setItem(k, v);
      }
    }

    // Run migrations to normalize anything restored from older schemas
    runStorageMigrations();
    return true;
  } catch (e) {
    console.error('Failed to import full backup:', e);
    return false;
  }
}
