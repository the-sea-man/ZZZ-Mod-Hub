import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../useAppStore';

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
});
