import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsView } from '../SettingsView';
import { useAppStore } from '../../store/useAppStore';
import { SETTINGS_CATEGORIES, type SettingsCategory } from '../../store/slices/preferencesSlice';

// The real panels reach for Tauri IPC on mount. This suite is about the tab
// contract - which panel belongs to which tab - so each panel is stubbed with a
// marker element.
vi.mock('../../components/settings/GamePaths', () => ({
  GamePaths: () => <div data-testid="panel-game-paths" />,
}));
vi.mock('../../components/settings/RandomizerSettings', () => ({
  RandomizerSettings: () => <div data-testid="panel-randomizer" />,
}));
vi.mock('../../components/settings/CharacterFilterSettings', () => ({
  CharacterFilterSettings: () => <div data-testid="panel-character-filters" />,
}));
vi.mock('../../components/settings/DownloadSettings', () => ({
  DownloadSettings: () => <div data-testid="panel-downloads" />,
}));
vi.mock('../../components/settings/DiscoverSettings', () => ({
  DiscoverSettings: () => <div data-testid="panel-discover" />,
}));
vi.mock('../../components/settings/InGameOverlaySettings', () => ({
  InGameOverlaySettings: () => <div data-testid="panel-overlay" />,
}));
vi.mock('../../components/settings/QuickSnapperSettings', () => ({
  QuickSnapperSettings: () => <div data-testid="panel-quick-snapper" />,
}));
vi.mock('../../components/settings/HealthSettings', () => ({
  HealthSettings: () => <div data-testid="panel-health" />,
}));
vi.mock('../../components/settings/ConflictSettings', () => ({
  ConflictSettings: () => <div data-testid="panel-conflicts" />,
}));
vi.mock('../../components/settings/ThemeSettings', () => ({
  ThemeSettings: () => <div data-testid="panel-theme" />,
}));
vi.mock('../../components/settings/SoundSettings', () => ({
  SoundSettings: () => <div data-testid="panel-sound" />,
}));
vi.mock('../../components/settings/CardCustomizerSettings', () => ({
  CardCustomizerSettings: () => <div data-testid="panel-card-customizer" />,
}));
vi.mock('../../components/settings/PerformanceSettings', () => ({
  PerformanceSettings: () => <div data-testid="panel-performance" />,
}));
vi.mock('../../components/settings/ExperimentalSettings', () => ({
  ExperimentalSettings: () => <div data-testid="panel-experimental" />,
}));
vi.mock('../../components/settings/BackupSettings', () => ({
  BackupSettings: () => <div data-testid="panel-backup" />,
}));
vi.mock('../../components/settings/DangerZoneSettings', () => ({
  DangerZoneSettings: () => <div data-testid="panel-danger-zone" />,
}));
vi.mock('../../components/settings/TutorialSettings', () => ({
  TutorialSettings: () => <div data-testid="panel-tutorials" />,
}));
vi.mock('../../components/settings/AboutSettings', () => ({
  AboutSettings: () => <div data-testid="panel-about" />,
}));

/** Every tab must render its panels - a tab with no panel is an empty pane. */
const EXPECTED_PANELS: Record<SettingsCategory, string[]> = {
  game_folders: ['panel-game-paths'],
  library: ['panel-randomizer', 'panel-character-filters'],
  downloads: ['panel-downloads', 'panel-discover'],
  in_game: ['panel-overlay', 'panel-quick-snapper'],
  diagnostics: ['panel-health', 'panel-conflicts'],
  appearance: ['panel-theme', 'panel-sound'],
  mod_cards: ['panel-card-customizer'],
  performance: ['panel-performance'],
  advanced: ['panel-experimental', 'panel-backup', 'panel-danger-zone'],
  help_about: ['panel-tutorials', 'panel-about'],
};

function showTab(tab: SettingsCategory) {
  useAppStore.setState({ settingsActiveTab: tab });
}

describe('SettingsView tab contract', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('renders every tab in the sidebar', () => {
    showTab('game_folders');
    render(<SettingsView />);
    // 10 tabs, in four labelled groups
    for (const label of ['Setup', 'Tools', 'Look & Feel', 'System']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText('Game & Folders')).toBeTruthy();
    expect(screen.getByText('Performance')).toBeTruthy();
    expect(screen.getByText('Help & About')).toBeTruthy();
  });

  it.each(SETTINGS_CATEGORIES)('renders the expected panels for "%s"', (tab) => {
    showTab(tab);
    const { unmount } = render(<SettingsView />);

    for (const testId of EXPECTED_PANELS[tab]) {
      expect(screen.getByTestId(testId)).toBeTruthy();
    }

    // A panel must appear under exactly one tab, so nothing else may render.
    const foreign = Object.entries(EXPECTED_PANELS)
      .filter(([other]) => other !== tab)
      .flatMap(([, panels]) => panels)
      .filter((panel) => !EXPECTED_PANELS[tab].includes(panel));

    for (const testId of foreign) {
      expect(screen.queryByTestId(testId)).toBeNull();
    }

    unmount();
  });

  it('leaves no tab with an empty pane', () => {
    for (const tab of SETTINGS_CATEGORIES) {
      expect(EXPECTED_PANELS[tab].length).toBeGreaterThan(0);
    }
  });

  it('persists the active tab so it survives a view switch', () => {
    showTab('diagnostics');
    const { unmount } = render(<SettingsView />);
    expect(sessionStorage.getItem('settingsTab')).toBe('diagnostics');
    unmount();
  });
});
