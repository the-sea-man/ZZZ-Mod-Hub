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
});
