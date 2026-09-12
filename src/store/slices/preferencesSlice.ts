import { StateCreator } from 'zustand';
import type { AppState, PerformanceProfile } from './types';
import { invoke } from '@tauri-apps/api/core';
import { safeGetInt, safeGetBool, safeGetString } from '../../utils/storage';

export interface PreferencesSlice {
  activeTab: 'library' | 'settings' | 'gamebanana' | 'achievements';
  addAvailableLanguage: (lang: { code: string; name: string }) => void;
  alwaysAutoAssign: boolean;
  animationsEnabled: boolean;
  appOpacity: number;
  autoLaunchGame: boolean;
  availableLanguages: { code: string; name: string }[];
  bgImageBlur: number;
  bgImageBrightness: number;
  bgImageFit: 'cover' | 'contain' | '100% 100%';
  bgImageSaturation: number;
  bgOpacity: number;
  blurAmount: number;
  blurNsfw: boolean;
  cardSize: number;
  checkNetworkStatus: () => Promise<void>;
  checkOrPromptExperimental: (featureName?: string) => boolean;
  customBackground: string;
  defaultDiscoverCharacter: string;
  downloadImages: boolean | null;
  downloadRetryInterval: number;
  experimentalFeaturesEnabled: boolean;
  gameExePath: string;
  gameIsRunning: boolean;
  hasDismissedSettingsNudge: boolean;
  hasSelectedLanguage: boolean;
  hasVisitedSettings: boolean;
  highlightTargetId: string | null;
  hotreloadEnabled: boolean;
  isOnline: boolean;
  language: string;
  lowPerformanceMode: boolean;
  maxDownloadAttempts: number;
  modsPath: string;
  navigateToAchievementTarget: (target: {
    tab: 'library' | 'settings' | 'gamebanana' | 'achievements';
    settingsTab?: 'general' | 'mod_management' | 'downloads' | 'appearance' | 'advanced' | 'about';
    highlightId?: string;
  }) => void;
  nsfwFilterEnabled: boolean;
  primaryColor: string;
  selectedElement: string;
  selectedFaction: string;
  selectedGender: string;
  selectedHeight: string;
  selectedModel: string;
  selectedRole: string;
  selectedSpecies: string;
  setActiveTab: (tab: 'library' | 'settings' | 'gamebanana' | 'achievements') => void;
  setAlwaysAutoAssign: (enabled: boolean) => void;
  setAnimationsEnabled: (enabled: boolean) => void;
  setAppOpacity: (opacity: number) => void;
  setAutoLaunchGame: (enabled: boolean) => void;
  setBgImageBlur: (amount: number) => void;
  setBgImageBrightness: (amount: number) => void;
  setBgImageFit: (fit: 'cover' | 'contain' | '100% 100%') => void;
  setBgImageSaturation: (amount: number) => void;
  setBgOpacity: (opacity: number) => void;
  setBlurAmount: (amount: number) => void;
  setBlurNsfw: (enabled: boolean) => void;
  setCardSize: (size: number) => void;
  setCustomBackground: (bg: string) => void;
  setDefaultDiscoverCharacter: (id: string) => void;
  setDownloadImages: (val: boolean) => void;
  setDownloadRetryInterval: (seconds: number) => void;
  setExperimentalFeaturesEnabled: (val: boolean) => void;
  setGameExePath: (path: string) => void;
  setGameIsRunning: (running: boolean) => void;
  setHasDismissedSettingsNudge: (val: boolean) => void;
  setHasSelectedLanguage: (val: boolean) => void;
  setHasVisitedSettings: (val: boolean) => void;
  setHighlightTargetId: (id: string | null) => void;
  setHotreloadEnabled: (val: boolean) => void;
  setIsOnline: (val: boolean) => void;
  setLanguage: (lang: string) => void;
  setLowPerformanceMode: (val: boolean) => void;
  setMaxDownloadAttempts: (attempts: number) => void;
  setModsPath: (path: string) => void;
  setNsfwFilterEnabled: (enabled: boolean) => void;
  setPrimaryColor: (color: string) => void;
  setSelectedElement: (val: string) => void;
  setSelectedFaction: (val: string) => void;
  setSelectedGender: (val: string) => void;
  setSelectedHeight: (val: string) => void;
  setSelectedModel: (val: string) => void;
  setSelectedRole: (val: string) => void;
  setSelectedSpecies: (val: string) => void;
  setSettingsActiveTab: (
    tab: 'general' | 'mod_management' | 'downloads' | 'appearance' | 'advanced' | 'about'
  ) => void;
  setSetupComplete: (val: boolean) => void;
  setShowApiDebugUrl: (val: boolean) => void;
  setShowElementFilter: (val: boolean) => void;
  setShowFactionFilter: (val: boolean) => void;
  setShowGenderFilter: (val: boolean) => void;
  setShowHeightFilter: (val: boolean) => void;
  setShowModelFilter: (val: boolean) => void;
  setShowRoleFilter: (val: boolean) => void;
  setShowSpeciesFilter: (val: boolean) => void;
  setSidebarOpacity: (opacity: number) => void;
  setSimpleModeDiscover: (enabled: boolean) => void;
  setSoundEffectsEnabled: (enabled: boolean) => void;
  setSoundEffectsVolume: (volume: number) => void;
  setTheme: (theme: 'dark' | 'light' | 'glass') => void;
  setUiScale: (scale: number) => void;
  setWatcherEnabled: (val: boolean) => void;
  setWinrarPath: (path: string) => void;
  settingsActiveTab:
    'general' | 'mod_management' | 'downloads' | 'appearance' | 'advanced' | 'about';
  setupComplete: boolean;
  showApiDebugUrl: boolean;
  showElementFilter: boolean;
  showFactionFilter: boolean;
  showGenderFilter: boolean;
  showHeightFilter: boolean;
  showModelFilter: boolean;
  showRoleFilter: boolean;
  showSpeciesFilter: boolean;
  showToast: (msg: string) => void;
  sidebarOpacity: number;
  simpleModeDiscover: boolean;
  soundEffectsEnabled: boolean;
  soundEffectsVolume: number;
  theme: 'dark' | 'light' | 'glass';
  toastMessage: string | null;
  uiScale: number;
  watcherEnabled: boolean;
  winrarPath: string;
  performanceProfile: PerformanceProfile;
  setPerformanceProfile: (profile: PerformanceProfile) => void;
  startupScanEnabled: boolean;
  setStartupScanEnabled: (val: boolean) => void;
  autoScriptAnalysisEnabled: boolean;
  setAutoScriptAnalysisEnabled: (val: boolean) => void;
  autoConflictDetectionEnabled: boolean;
  setAutoConflictDetectionEnabled: (val: boolean) => void;
  fastGamePolling: boolean;
  setFastGamePolling: (val: boolean) => void;
  isAnalyzingMods: boolean;
  runManualAnalysis: () => Promise<void>;
}

export const createPreferencesSlice: StateCreator<AppState, [], [], PreferencesSlice> = (
  set,
  get
) => ({
  activeTab: 'library',

  addAvailableLanguage: (lang: { code: string; name: string }) => {
    set((state: AppState) => {
      if (
        state.availableLanguages.find((l: { code: string; name: string }) => l.code === lang.code)
      )
        return state;
      return { availableLanguages: [...state.availableLanguages, lang] };
    });
  },

  alwaysAutoAssign: safeGetBool('alwaysAutoAssign', true),

  animationsEnabled: safeGetBool('animationsEnabled', true),

  appOpacity: safeGetInt('appOpacity', 50, 10, 100),

  autoLaunchGame: safeGetBool('autoLaunchGame', false),

  availableLanguages: [
    { code: 'en', name: 'English' },
    { code: 'zh', name: '简体中文' },
    { code: 'zh_TW', name: '繁體中文' },
    { code: 'ja', name: '日本語' },
    { code: 'ko', name: '한국어' },
    { code: 'es', name: 'Español' },
    { code: 'ru', name: 'Русский' },
    { code: 'pt_BR', name: 'Português (Brasil)' },
  ],

  bgImageBlur: safeGetInt('bgImageBlur', 10, 0, 40),

  bgImageBrightness: safeGetInt('bgImageBrightness', 100, 0, 200),

  bgImageFit: (safeGetString('bgImageFit', 'cover') as any) || 'cover',

  bgImageSaturation: safeGetInt('bgImageSaturation', 100, 0, 200),

  bgOpacity: safeGetInt('bgOpacity', 40, 0, 100),

  blurAmount: safeGetInt('blurAmount', 12, 0, 40),

  blurNsfw: safeGetBool('blurNsfw', true),

  cardSize: safeGetInt('cardSize', 220, 140, 360),

  checkNetworkStatus: async () => {
    if (!navigator.onLine) {
      set({ isOnline: false });
      return;
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      await fetch('https://gamebanana.com', {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      set({ isOnline: true });
    } catch {
      // Fallback to navigator.onLine
      set({ isOnline: navigator.onLine });
    }
  },

  checkOrPromptExperimental: (featureName?: string) => {
    const { experimentalFeaturesEnabled, showToast, navigateToAchievementTarget } = get();
    if (experimentalFeaturesEnabled) {
      return true;
    }
    const msg = featureName
      ? `${featureName} is experimental. Enable Experimental Features in Settings to use it.`
      : 'This is an experimental feature. Enable Experimental Features in Settings to use it.';
    showToast(msg);
    navigateToAchievementTarget({
      tab: 'settings',
      settingsTab: 'advanced',
      highlightId: 'experimental_settings',
    });
    return false;
  },

  customBackground: safeGetString(
    'customBackground',
    '%appdata%\\com.zzzmodhub.app\\images\\Mindscape Burnice White Full.png'
  ),

  defaultDiscoverCharacter: safeGetString('defaultDiscoverCharacter', ''),

  downloadImages:
    localStorage.getItem('downloadImages') === null ? null : safeGetBool('downloadImages', true),

  downloadRetryInterval: safeGetInt('downloadRetryInterval', 2, 1, 60),

  experimentalFeaturesEnabled: safeGetBool('experimental_features_enabled', false),

  gameExePath: safeGetString(
    'game_exe_path',
    `"%appdata%\\XXMI Launcher\\Resources\\Bin\\XXMI Launcher.exe" --nogui --xxmi ZZMI`
  ),

  gameIsRunning: false,

  hasDismissedSettingsNudge: safeGetBool('hasDismissedSettingsNudge', false),

  hasSelectedLanguage: safeGetBool('hasSelectedLanguage', false),

  hasVisitedSettings: safeGetBool('hasVisitedSettings', false),

  highlightTargetId: null,

  hotreloadEnabled: safeGetBool('hotreloadEnabled', false),

  isOnline: true,

  language: safeGetString('language', 'en'),

  lowPerformanceMode: safeGetBool('lowPerformanceMode', false),

  maxDownloadAttempts: safeGetInt('maxDownloadAttempts', 3, 1, 10),

  modsPath: safeGetString('mods_path', ''),

  navigateToAchievementTarget: ({ tab, settingsTab, highlightId }) => {
    if (tab === 'settings') {
      get().setHasVisitedSettings(true);
      if (settingsTab) {
        sessionStorage.setItem('settingsTab', settingsTab);
        set({ settingsActiveTab: settingsTab });
      }
    }
    if (tab === 'library') {
      get().scanModsFolder();
    }
    set({ activeTab: tab });

    if (highlightId) {
      set({ highlightTargetId: highlightId });
      setTimeout(() => {
        const el = document.querySelector(`[data-highlight-id="${highlightId}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 250);
      setTimeout(() => {
        if (get().highlightTargetId === highlightId) {
          set({ highlightTargetId: null });
        }
      }, 6000);
    }
  },

  nsfwFilterEnabled: safeGetBool('nsfwFilterEnabled', true),

  primaryColor: safeGetString('primaryColor', '56, 189, 248'),

  selectedElement: safeGetString('selectedElement', 'All'),

  selectedFaction: safeGetString('selectedFaction', 'All'),

  selectedGender: safeGetString('selectedGender', 'All'),

  selectedHeight: safeGetString('selectedHeight', 'All'),

  selectedModel: safeGetString('selectedModel', 'All'),

  selectedRole: safeGetString('selectedRole', 'All'),

  selectedSpecies: safeGetString('selectedSpecies', 'All'),

  setActiveTab: (tab: 'library' | 'settings' | 'gamebanana' | 'achievements') => {
    if (tab === 'settings') {
      get().setHasVisitedSettings(true);
    }
    if (tab === 'library') {
      get().scanModsFolder();
    }
    set({ activeTab: tab });
  },

  setAlwaysAutoAssign: (enabled: boolean) => {
    localStorage.setItem('alwaysAutoAssign', enabled.toString());
    set({ alwaysAutoAssign: enabled });
  },

  setAnimationsEnabled: (enabled: boolean) => {
    localStorage.setItem('animationsEnabled', enabled.toString());
    set({ animationsEnabled: enabled });
  },

  setAppOpacity: (opacity: number) => {
    localStorage.setItem('appOpacity', opacity.toString());
    set({ appOpacity: opacity });
  },

  setAutoLaunchGame: (enabled: boolean) => {
    localStorage.setItem('autoLaunchGame', enabled.toString());
    set({ autoLaunchGame: enabled });
  },

  setBgImageBlur: (amount: number) => {
    localStorage.setItem('bgImageBlur', amount.toString());
    set({ bgImageBlur: amount });
  },

  setBgImageBrightness: (amount: number) => {
    localStorage.setItem('bgImageBrightness', amount.toString());
    set({ bgImageBrightness: amount });
  },

  setBgImageFit: (fit: any) => {
    localStorage.setItem('bgImageFit', fit);
    set({ bgImageFit: fit });
  },

  setBgImageSaturation: (amount: number) => {
    localStorage.setItem('bgImageSaturation', amount.toString());
    set({ bgImageSaturation: amount });
  },

  setBgOpacity: (opacity: number) => {
    localStorage.setItem('bgOpacity', opacity.toString());
    set({ bgOpacity: opacity });
  },

  setBlurAmount: (amount: number) => {
    localStorage.setItem('blurAmount', amount.toString());
    set({ blurAmount: amount });
  },

  setBlurNsfw: (enabled: boolean) => {
    localStorage.setItem('blurNsfw', enabled ? 'true' : 'false');
    set({ blurNsfw: enabled });
  },

  setCardSize: (size: number) => {
    localStorage.setItem('cardSize', size.toString());
    set({ cardSize: size });
  },

  setCustomBackground: (bg: string) => {
    localStorage.setItem('customBackground', bg);
    set({ customBackground: bg });
  },

  setDefaultDiscoverCharacter: (id: string) => {
    localStorage.setItem('defaultDiscoverCharacter', id);
    set({ defaultDiscoverCharacter: id });
  },

  setDownloadImages: (val: boolean) => {
    localStorage.setItem('downloadImages', val.toString());
    set({ downloadImages: val });
  },

  setDownloadRetryInterval: (seconds: number) => {
    localStorage.setItem('downloadRetryInterval', seconds.toString());
    set({ downloadRetryInterval: seconds });
  },

  setExperimentalFeaturesEnabled: (val: boolean) => {
    localStorage.setItem('experimental_features_enabled', val ? 'true' : 'false');
    set({ experimentalFeaturesEnabled: val });
  },

  setGameExePath: (path: string) => {
    localStorage.setItem('game_exe_path', path);
    set({ gameExePath: path });
  },

  setGameIsRunning: (val: boolean) => {
    set({ gameIsRunning: val });
  },

  setHasDismissedSettingsNudge: (val: boolean) => {
    localStorage.setItem('hasDismissedSettingsNudge', val ? 'true' : 'false');
    set({ hasDismissedSettingsNudge: val });
  },

  setHasSelectedLanguage: (val: boolean) => {
    localStorage.setItem('hasSelectedLanguage', val ? 'true' : 'false');
    set({ hasSelectedLanguage: val });
  },

  setHasVisitedSettings: (val: boolean) => {
    localStorage.setItem('hasVisitedSettings', val ? 'true' : 'false');
    set({ hasVisitedSettings: val });
  },

  setHighlightTargetId: (id) => set({ highlightTargetId: id }),

  setHotreloadEnabled: (val: boolean) => {
    localStorage.setItem('hotreloadEnabled', val ? 'true' : 'false');
    set({ hotreloadEnabled: val });
    invoke('set_hotreload', { enabled: val }).catch(console.error);
  },

  setIsOnline: (val: boolean) => set({ isOnline: val }),

  setLanguage: (lang: string) => {
    localStorage.setItem('language', lang);
    set({ language: lang });
  },

  setLowPerformanceMode: (enabled: boolean) => {
    localStorage.setItem('lowPerformanceMode', enabled.toString());
    const profile: PerformanceProfile = enabled ? 'low' : 'balanced';
    localStorage.setItem('performanceProfile', profile);
    if (enabled) {
      localStorage.setItem('animationsEnabled', 'false');
      localStorage.setItem('blurAmount', '0');
    }
    set({
      lowPerformanceMode: enabled,
      performanceProfile: profile,
      ...(enabled ? { animationsEnabled: false, blurAmount: 0 } : {}),
    });
  },

  setMaxDownloadAttempts: (attempts: number) => {
    localStorage.setItem('maxDownloadAttempts', attempts.toString());
    set({ maxDownloadAttempts: attempts });
  },

  setModsPath: (path: string) => {
    localStorage.setItem('mods_path', path);
    set({ modsPath: path });
  },

  setNsfwFilterEnabled: (enabled: boolean) => {
    localStorage.setItem('nsfwFilterEnabled', enabled ? 'true' : 'false');
    set({ nsfwFilterEnabled: enabled });
  },

  setPrimaryColor: (primaryColor) => {
    localStorage.setItem('primaryColor', primaryColor);
    set({ primaryColor });
  },

  setSelectedElement: (val: string) => {
    localStorage.setItem('selectedElement', val);
    set({ selectedElement: val });
    get().incrementStat('filtersUsed');
  },

  setSelectedFaction: (val: string) => {
    localStorage.setItem('selectedFaction', val);
    set({ selectedFaction: val });
    get().incrementStat('filtersUsed');
  },

  setSelectedGender: (val: string) => {
    localStorage.setItem('selectedGender', val);
    set({ selectedGender: val });
    get().incrementStat('filtersUsed');
  },

  setSelectedHeight: (val: string) => {
    localStorage.setItem('selectedHeight', val);
    set({ selectedHeight: val });
    get().incrementStat('filtersUsed');
  },

  setSelectedModel: (val: string) => {
    localStorage.setItem('selectedModel', val);
    set({ selectedModel: val });
    get().incrementStat('filtersUsed');
  },

  setSelectedRole: (val: string) => {
    localStorage.setItem('selectedRole', val);
    set({ selectedRole: val });
    get().incrementStat('filtersUsed');
  },

  setSelectedSpecies: (val: string) => {
    localStorage.setItem('selectedSpecies', val);
    set({ selectedSpecies: val });
    get().incrementStat('filtersUsed');
  },

  setSettingsActiveTab: (tab) => {
    sessionStorage.setItem('settingsTab', tab);
    set({ settingsActiveTab: tab });
  },

  setSetupComplete: (val: boolean) => {
    localStorage.setItem('setupComplete', val ? 'true' : 'false');
    set({ setupComplete: val });
  },

  setShowApiDebugUrl: (val: boolean) => {
    localStorage.setItem('showApiDebugUrl', String(val));
    set({ showApiDebugUrl: val });
  },

  setShowElementFilter: (val: boolean) => {
    localStorage.setItem('showElementFilter', val.toString());
    set({ showElementFilter: val });
  },

  setShowFactionFilter: (val: boolean) => {
    localStorage.setItem('showFactionFilter', val.toString());
    set({ showFactionFilter: val });
  },

  setShowGenderFilter: (val: boolean) => {
    localStorage.setItem('showGenderFilter', val.toString());
    set({ showGenderFilter: val });
  },

  setShowHeightFilter: (val: boolean) => {
    localStorage.setItem('showHeightFilter', val.toString());
    set({ showHeightFilter: val });
  },

  setShowModelFilter: (val: boolean) => {
    localStorage.setItem('showModelFilter', val.toString());
    set({ showModelFilter: val });
  },

  setShowRoleFilter: (val: boolean) => {
    localStorage.setItem('showRoleFilter', val.toString());
    set({ showRoleFilter: val });
  },

  setShowSpeciesFilter: (val: boolean) => {
    localStorage.setItem('showSpeciesFilter', val.toString());
    set({ showSpeciesFilter: val });
  },

  setSidebarOpacity: (opacity: number) => {
    localStorage.setItem('sidebarOpacity', opacity.toString());
    set({ sidebarOpacity: opacity });
  },

  setSimpleModeDiscover: (enabled: boolean) => {
    localStorage.setItem('simpleModeDiscover', enabled.toString());
    set({ simpleModeDiscover: enabled });
  },

  setSoundEffectsEnabled: (enabled: boolean) => {
    localStorage.setItem('soundEffectsEnabled', String(enabled));
    set({ soundEffectsEnabled: enabled });
  },

  setSoundEffectsVolume: (volume: number) => {
    localStorage.setItem('soundEffectsVolume', String(volume));
    set({ soundEffectsVolume: volume });
  },

  setTheme: (theme: 'dark' | 'light' | 'glass') => {
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },

  setUiScale: (scale: number) => {
    localStorage.setItem('uiScale', scale.toString());
    set({ uiScale: scale });
  },

  setWatcherEnabled: (val: boolean) => {
    localStorage.setItem('watcherEnabled', val ? 'true' : 'false');
    set({ watcherEnabled: val });
  },

  setWinrarPath: (path: string) => {
    localStorage.setItem('winrar_path', path);
    set({ winrarPath: path });
  },

  settingsActiveTab: (sessionStorage.getItem('settingsTab') as any) || 'general',

  setupComplete: safeGetBool('setupComplete', false) || !!safeGetString('mods_path', ''),

  showApiDebugUrl: safeGetBool('showApiDebugUrl', false),

  showElementFilter: safeGetBool('showElementFilter', true),

  showFactionFilter: safeGetBool('showFactionFilter', true),

  showGenderFilter: safeGetBool('showGenderFilter', true),

  showHeightFilter: safeGetBool('showHeightFilter', true),

  showModelFilter: safeGetBool('showModelFilter', true),

  showRoleFilter: safeGetBool('showRoleFilter', true),

  showSpeciesFilter: safeGetBool('showSpeciesFilter', true),

  showToast: (msg: string) => {
    set({ toastMessage: msg });
    setTimeout(() => {
      set((state) => (state.toastMessage === msg ? { toastMessage: null } : {}));
    }, 4000);
  },

  sidebarOpacity: safeGetInt('sidebarOpacity', 80, 10, 100),

  simpleModeDiscover: safeGetBool('simpleModeDiscover', false),

  soundEffectsEnabled: safeGetBool('soundEffectsEnabled', true),

  soundEffectsVolume: safeGetInt('soundEffectsVolume', 80),

  theme: (safeGetString('theme', 'glass') as 'dark' | 'light' | 'glass') || 'glass',

  toastMessage: null,

  uiScale: safeGetInt('uiScale', 100, 50, 150),

  watcherEnabled: safeGetBool('watcherEnabled', true),

  winrarPath: safeGetString('winrar_path', 'C:\\Program Files\\WinRAR\\WinRAR.exe'),

  performanceProfile:
    (safeGetString('performanceProfile', 'balanced') as PerformanceProfile) || 'balanced',
  setPerformanceProfile: (profile: PerformanceProfile) => {
    localStorage.setItem('performanceProfile', profile);
    set({ performanceProfile: profile });
    if (profile === 'low') {
      localStorage.setItem('lowPerformanceMode', 'true');
      localStorage.setItem('startupScanEnabled', 'false');
      localStorage.setItem('watcherEnabled', 'false');
      localStorage.setItem('autoScriptAnalysisEnabled', 'false');
      localStorage.setItem('autoConflictDetectionEnabled', 'false');
      localStorage.setItem('autoCheckUpdates', 'false');
      localStorage.setItem('fastGamePolling', 'false');
      localStorage.setItem('animationsEnabled', 'false');
      localStorage.setItem('blurAmount', '0');
      set({
        lowPerformanceMode: true,
        startupScanEnabled: false,
        watcherEnabled: false,
        autoScriptAnalysisEnabled: false,
        autoConflictDetectionEnabled: false,
        autoCheckUpdates: false,
        fastGamePolling: false,
        animationsEnabled: false,
        blurAmount: 0,
      });
    } else if (profile === 'balanced') {
      localStorage.setItem('lowPerformanceMode', 'false');
      localStorage.setItem('startupScanEnabled', 'true');
      localStorage.setItem('watcherEnabled', 'true');
      localStorage.setItem('autoScriptAnalysisEnabled', 'true');
      localStorage.setItem('autoConflictDetectionEnabled', 'true');
      localStorage.setItem('autoCheckUpdates', 'true');
      localStorage.setItem('fastGamePolling', 'false');
      localStorage.setItem('animationsEnabled', 'true');
      localStorage.setItem('blurAmount', '10');
      set({
        lowPerformanceMode: false,
        startupScanEnabled: true,
        watcherEnabled: true,
        autoScriptAnalysisEnabled: true,
        autoConflictDetectionEnabled: true,
        autoCheckUpdates: true,
        fastGamePolling: false,
        animationsEnabled: true,
        blurAmount: 10,
      });
    } else if (profile === 'high') {
      localStorage.setItem('lowPerformanceMode', 'false');
      localStorage.setItem('startupScanEnabled', 'true');
      localStorage.setItem('watcherEnabled', 'true');
      localStorage.setItem('autoScriptAnalysisEnabled', 'true');
      localStorage.setItem('autoConflictDetectionEnabled', 'true');
      localStorage.setItem('autoCheckUpdates', 'true');
      localStorage.setItem('fastGamePolling', 'true');
      localStorage.setItem('animationsEnabled', 'true');
      localStorage.setItem('blurAmount', '16');
      set({
        lowPerformanceMode: false,
        startupScanEnabled: true,
        watcherEnabled: true,
        autoScriptAnalysisEnabled: true,
        autoConflictDetectionEnabled: true,
        autoCheckUpdates: true,
        fastGamePolling: true,
        animationsEnabled: true,
        blurAmount: 16,
      });
    }
  },
  startupScanEnabled: safeGetBool('startupScanEnabled', true),
  setStartupScanEnabled: (val: boolean) => {
    localStorage.setItem('startupScanEnabled', val.toString());
    localStorage.setItem('performanceProfile', 'custom');
    set({ startupScanEnabled: val, performanceProfile: 'custom' });
  },
  autoScriptAnalysisEnabled: safeGetBool('autoScriptAnalysisEnabled', true),
  setAutoScriptAnalysisEnabled: (val: boolean) => {
    localStorage.setItem('autoScriptAnalysisEnabled', val.toString());
    localStorage.setItem('performanceProfile', 'custom');
    set({ autoScriptAnalysisEnabled: val, performanceProfile: 'custom' });
  },
  autoConflictDetectionEnabled: safeGetBool('autoConflictDetectionEnabled', true),
  setAutoConflictDetectionEnabled: (val: boolean) => {
    localStorage.setItem('autoConflictDetectionEnabled', val.toString());
    localStorage.setItem('performanceProfile', 'custom');
    set({ autoConflictDetectionEnabled: val, performanceProfile: 'custom' });
  },
  fastGamePolling: safeGetBool('fastGamePolling', false),
  setFastGamePolling: (val: boolean) => {
    localStorage.setItem('fastGamePolling', val.toString());
    localStorage.setItem('performanceProfile', 'custom');
    set({ fastGamePolling: val, performanceProfile: 'custom' });
  },
  isAnalyzingMods: false,
  runManualAnalysis: async () => {
    const { modsPath, refreshHashAnalysis } = get();
    if (!modsPath) return;
    set({ isAnalyzingMods: true });
    try {
      await refreshHashAnalysis();
      await invoke('start_warnings_scan', { modsDir: modsPath });
    } finally {
      set({ isAnalyzingMods: false });
    }
  },
});
