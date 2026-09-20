import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../useAppStore';
import { normalizeSettingsCategory, SETTINGS_CATEGORIES } from '../preferencesSlice';

describe('preferencesSlice', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('updates activeTab and updates navigation state', () => {
    expect(useAppStore.getState().activeTab).toBeDefined();

    useAppStore.getState().setActiveTab('settings');
    expect(useAppStore.getState().activeTab).toBe('settings');

    useAppStore.getState().setActiveTab('gamebanana');
    expect(useAppStore.getState().activeTab).toBe('gamebanana');
  });

  it('updates modsPath and stores it', () => {
    const testPath = 'D:/Games/ZenlessZoneZero/Mods';
    useAppStore.getState().setModsPath(testPath);
    expect(useAppStore.getState().modsPath).toBe(testPath);
  });

  it('updates UI preference flags', () => {
    useAppStore.getState().setAnimationsEnabled(false);
    expect(useAppStore.getState().animationsEnabled).toBe(false);

    useAppStore.getState().setAnimationsEnabled(true);
    expect(useAppStore.getState().animationsEnabled).toBe(true);
  });

  it('transitions away from efficiency mode to custom profile when granular switches are toggled', () => {
    // 1. User selects efficiency mode
    useAppStore.getState().setPerformanceProfile('low');
    expect(useAppStore.getState().performanceProfile).toBe('low');
    expect(useAppStore.getState().lowPerformanceMode).toBe(true);
    expect(useAppStore.getState().blurAmount).toBe(0);

    // 2. User toggles Frosted Glass Blur Shaders
    useAppStore.getState().setBlurAmount(12);

    // 3. State should transition to 'custom' and lowPerformanceMode must be false
    expect(useAppStore.getState().performanceProfile).toBe('custom');
    expect(useAppStore.getState().lowPerformanceMode).toBe(false);
    expect(useAppStore.getState().blurAmount).toBe(12);

    // 4. User selects low profile again, then toggles watcher
    useAppStore.getState().setPerformanceProfile('low');
    expect(useAppStore.getState().performanceProfile).toBe('low');
    expect(useAppStore.getState().lowPerformanceMode).toBe(true);

    useAppStore.getState().setWatcherEnabled(true);
    expect(useAppStore.getState().performanceProfile).toBe('custom');
    expect(useAppStore.getState().lowPerformanceMode).toBe(false);
    expect(useAppStore.getState().watcherEnabled).toBe(true);

    // 5. User selects low profile again, then toggles autoCheckUpdates
    useAppStore.getState().setPerformanceProfile('low');
    expect(useAppStore.getState().performanceProfile).toBe('low');
    expect(useAppStore.getState().lowPerformanceMode).toBe(true);

    useAppStore.getState().setAutoCheckUpdates(true);
    expect(useAppStore.getState().performanceProfile).toBe('custom');
    expect(useAppStore.getState().lowPerformanceMode).toBe(false);
    expect(useAppStore.getState().autoCheckUpdates).toBe(true);

    // 6. User selects low profile again, then toggles animations
    useAppStore.getState().setPerformanceProfile('low');
    expect(useAppStore.getState().performanceProfile).toBe('low');
    expect(useAppStore.getState().lowPerformanceMode).toBe(true);

    useAppStore.getState().setAnimationsEnabled(true);
    expect(useAppStore.getState().performanceProfile).toBe('custom');
    expect(useAppStore.getState().lowPerformanceMode).toBe(false);
    expect(useAppStore.getState().animationsEnabled).toBe(true);

    // 7. User selects low profile again, then toggles startup scan
    useAppStore.getState().setPerformanceProfile('low');
    expect(useAppStore.getState().performanceProfile).toBe('low');
    expect(useAppStore.getState().lowPerformanceMode).toBe(true);

    useAppStore.getState().setStartupScanEnabled(true);
    expect(useAppStore.getState().performanceProfile).toBe('custom');
    expect(useAppStore.getState().lowPerformanceMode).toBe(false);
    expect(useAppStore.getState().startupScanEnabled).toBe(true);
  });

  it('manages 1-Click GameBanana installer preferences and localStorage', async () => {
    // Default should be true
    expect(useAppStore.getState().oneClickInstallerEnabled).toBe(true);
    expect(useAppStore.getState().oneClickAutoInstall).toBe(true);

    // Toggle auto-install
    useAppStore.getState().setOneClickAutoInstall(false);
    expect(useAppStore.getState().oneClickAutoInstall).toBe(false);
    expect(localStorage.getItem('oneClickAutoInstall')).toBe('false');

    useAppStore.getState().setOneClickAutoInstall(true);
    expect(useAppStore.getState().oneClickAutoInstall).toBe(true);
    expect(localStorage.getItem('oneClickAutoInstall')).toBe('true');

    // Toggle 1-Click installer enabled
    await useAppStore.getState().setOneClickInstallerEnabled(false);
    expect(useAppStore.getState().oneClickInstallerEnabled).toBe(false);
    expect(localStorage.getItem('oneClickInstallerEnabled')).toBe('false');

    await useAppStore.getState().setOneClickInstallerEnabled(true);
    expect(useAppStore.getState().oneClickInstallerEnabled).toBe(true);
    expect(localStorage.getItem('oneClickInstallerEnabled')).toBe('true');
  });

  it('manages GameBanana Remote Install pairing and credentials', () => {
    // Pair account
    useAppStore.getState().setRemoteInstallCredentials(123456, 'super_secret_key');
    expect(useAppStore.getState().remoteInstallMemberId).toBe(123456);
    expect(useAppStore.getState().remoteInstallSecretKey).toBe('super_secret_key');
    expect(localStorage.getItem('remoteInstallMemberId')).toBe('123456');
    expect(localStorage.getItem('remoteInstallSecretKey')).toBe('super_secret_key');

    // Toggle settings
    useAppStore.getState().setRemoteInstallEnabled(false);
    expect(useAppStore.getState().remoteInstallEnabled).toBe(false);
    expect(localStorage.getItem('remoteInstallEnabled')).toBe('false');

    useAppStore.getState().setRemoteInstallPollOnStartup(false);
    expect(useAppStore.getState().remoteInstallPollOnStartup).toBe(false);
    expect(localStorage.getItem('remoteInstallPollOnStartup')).toBe('false');

    // Unpair
    useAppStore.getState().unpairRemoteInstall();
    expect(useAppStore.getState().remoteInstallMemberId).toBeNull();
    expect(useAppStore.getState().remoteInstallSecretKey).toBeNull();
    expect(localStorage.getItem('remoteInstallMemberId')).toBeNull();
    expect(localStorage.getItem('remoteInstallSecretKey')).toBeNull();
  });

  it('correctly persists setupComplete and does not prematurely complete setup', () => {
    // 1. Initial or explicit false
    useAppStore.getState().setSetupComplete(false);
    expect(useAppStore.getState().setupComplete).toBe(false);
    expect(localStorage.getItem('setupComplete')).toBe('false');

    // Setting mods_path must not silently override an explicit false
    useAppStore.getState().setModsPath('D:/Games/ZenlessZoneZero/Mods');
    expect(useAppStore.getState().setupComplete).toBe(false);

    // 2. Completing setup
    useAppStore.getState().setSetupComplete(true);
    expect(useAppStore.getState().setupComplete).toBe(true);
    expect(localStorage.getItem('setupComplete')).toBe('true');
  });

  it('persists and clears activeTutorial in localStorage', () => {
    useAppStore.getState().setActiveTutorial('post_setup');
    expect(useAppStore.getState().activeTutorial).toBe('post_setup');
    expect(localStorage.getItem('activeTutorial')).toBe('post_setup');

    useAppStore.getState().setActiveTutorial(null);
    expect(useAppStore.getState().activeTutorial).toBeNull();
    expect(localStorage.getItem('activeTutorial')).toBeNull();

    // Resetting tutorials clears activeTutorial
    useAppStore.getState().setActiveTutorial('sync');
    expect(localStorage.getItem('activeTutorial')).toBe('sync');
    useAppStore.getState().clearTutorials();
    expect(useAppStore.getState().activeTutorial).toBeNull();
    expect(localStorage.getItem('activeTutorial')).toBeNull();
  });
});

describe('normalizeSettingsCategory', () => {
  it('keeps every current settings tab id unchanged', () => {
    for (const category of SETTINGS_CATEGORIES) {
      expect(normalizeSettingsCategory(category)).toBe(category);
    }
  });

  it('maps tab ids from before the settings reorganisation to their new home', () => {
    // A session persisted under the old layout must land somewhere real,
    // not fall through the render switch and show an empty pane.
    expect(normalizeSettingsCategory('general')).toBe('game_folders');
    expect(normalizeSettingsCategory('mod_management')).toBe('diagnostics');
    expect(normalizeSettingsCategory('card_appearance')).toBe('mod_cards');
    expect(normalizeSettingsCategory('about')).toBe('help_about');
  });

  it('falls back to the first tab for unknown or malformed values', () => {
    expect(normalizeSettingsCategory('a_tab_that_never_existed')).toBe('game_folders');
    expect(normalizeSettingsCategory(null)).toBe('game_folders');
    expect(normalizeSettingsCategory(undefined)).toBe('game_folders');
    expect(normalizeSettingsCategory(42)).toBe('game_folders');
    expect(normalizeSettingsCategory({})).toBe('game_folders');
  });

  it('always resolves to a renderable tab', () => {
    const inputs = ['general', 'mod_management', 'card_appearance', 'about', 'nonsense', '', null];
    for (const input of inputs) {
      expect(SETTINGS_CATEGORIES).toContain(normalizeSettingsCategory(input));
    }
  });
});
