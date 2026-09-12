import {
  Palette,
  Monitor,
  ListFilter,
  Zap,
  Cpu,
  Save,
  Pipette,
  Languages,
  Gamepad2,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import type { AchievementDef } from './types';

export const CUSTOMIZATION_AND_SECRETS_ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'interior_designer',
    title: 'Interior Designer',
    description: 'Set a custom background image in Settings.',
    icon: Palette,
    target: 1,
    category: 'customization',
    getProgress: () => (useAppStore.getState().customBackground ? 1 : 0),
    navigationTarget: {
      tab: 'settings',
      settingsTab: 'appearance',
      highlightId: 'background_wallpaper_section',
    },
    steps: [
      'achievement_interior_designer_step_1',
      'achievement_interior_designer_step_2',
      'achievement_interior_designer_step_3',
    ],
  },
  {
    id: 'chroma_master',
    title: 'Chroma Master',
    description: 'Pick a custom Hex accent color with the Native Color Picker.',
    icon: Pipette,
    target: 1,
    category: 'customization',
    getProgress: () =>
      useAppStore.getState().primaryColor && useAppStore.getState().primaryColor !== '56, 189, 248'
        ? 1
        : 0,
    navigationTarget: {
      tab: 'settings',
      settingsTab: 'appearance',
      highlightId: 'theme_color_picker_section',
    },
    steps: [
      'achievement_chroma_master_step_1',
      'achievement_chroma_master_step_2',
      'achievement_chroma_master_step_3',
    ],
  },
  {
    id: 'polyglot',
    title: 'Polyglot',
    description: 'Explore the Language Hub or switch application languages.',
    icon: Languages,
    target: 1,
    category: 'customization',
    getProgress: () => (useAppStore.getState().language !== 'en' ? 1 : 0),
    navigationTarget: {
      tab: 'settings',
      settingsTab: 'appearance',
      highlightId: 'language_hub_btn',
    },
    steps: [
      'achievement_polyglot_step_1',
      'achievement_polyglot_step_2',
      'achievement_polyglot_step_3',
    ],
  },
  {
    id: 'filter_tailor',
    title: 'Filter Tailor',
    description: 'Customize your active character filter dropdowns in Settings.',
    icon: ListFilter,
    target: 1,
    category: 'customization',
    getProgress: (s) =>
      s.filterConfigChanged > 0 ||
      !useAppStore.getState().showElementFilter ||
      !useAppStore.getState().showFactionFilter ||
      !useAppStore.getState().showRoleFilter ||
      !useAppStore.getState().showSpeciesFilter ||
      !useAppStore.getState().showGenderFilter ||
      !useAppStore.getState().showHeightFilter ||
      !useAppStore.getState().showModelFilter
        ? 1
        : 0,
    navigationTarget: {
      tab: 'settings',
      settingsTab: 'appearance',
      highlightId: 'character_filter_settings',
    },
    steps: [
      'achievement_filter_tailor_step_1',
      'achievement_filter_tailor_step_2',
      'achievement_filter_tailor_step_3',
    ],
  },

  // 6. System & Integration,
  {
    id: 'immersive_mode',
    title: 'Immersive Mode',
    description: 'Enable the In-Game Overlay HUD in settings.',
    icon: Monitor,
    target: 1,
    category: 'system',
    getProgress: () => (localStorage.getItem('hud_enabled') === 'true' ? 1 : 0),
    navigationTarget: {
      tab: 'settings',
      settingsTab: 'advanced',
      highlightId: 'overlay_settings',
    },
    steps: [
      'achievement_immersive_mode_step_1',
      'achievement_immersive_mode_step_2',
      'achievement_immersive_mode_step_3',
    ],
  },
  {
    id: 'hot_swapper',
    title: 'Hot Swapper',
    description: 'Trigger a Hot-Reload while the game is running.',
    icon: Zap,
    target: 1,
    category: 'system',
    getProgress: (s) => s.hotReloadsTriggered,
    navigationTarget: {
      tab: 'settings',
      settingsTab: 'general',
      highlightId: 'game_paths_settings',
    },
    steps: [
      'achievement_hot_swapper_step_1',
      'achievement_hot_swapper_step_2',
      'achievement_hot_swapper_step_3',
      'achievement_hot_swapper_step_4',
      'achievement_hot_swapper_step_5',
    ],
  },
  {
    id: 'safety_first',
    title: 'Safety First',
    description: 'Export a full settings & profile JSON backup.',
    icon: Save,
    target: 1,
    category: 'system',
    getProgress: (s) => s.backupsExported,
    navigationTarget: {
      tab: 'settings',
      settingsTab: 'advanced',
      highlightId: 'backup_settings',
    },
    steps: [
      'achievement_safety_first_step_1',
      'achievement_safety_first_step_2',
      'achievement_safety_first_step_3',
    ],
  },
  {
    id: 'full_automation',
    title: 'Full Automation',
    description: 'Enable both Auto-Launch Game on Startup and Auto Hot-Reload Mods in Settings.',
    icon: Cpu,
    target: 2,
    category: 'system',
    getProgress: () => {
      const { autoLaunchGame, hotreloadEnabled } = useAppStore.getState();
      return (autoLaunchGame ? 1 : 0) + (hotreloadEnabled ? 1 : 0);
    },
    navigationTarget: {
      tab: 'settings',
      settingsTab: 'general',
      highlightId: 'game_paths_settings',
    },
    steps: [
      'achievement_full_automation_step_1',
      'achievement_full_automation_step_2',
      'achievement_full_automation_step_3',
    ],
  },
  {
    id: 'konami_code',
    title: 'Retro Gamer',
    description:
      'Enter the legendary Konami Code (↑ ↑ ↓ ↓ ← → ← → B A) anywhere in the application.',
    icon: Gamepad2,
    target: 1,
    category: 'secret',
    isSecret: true,
    getProgress: (s) => s.konamiCodeEntered,
    steps: [
      'achievement_konami_code_step_1',
      'achievement_konami_code_step_2',
      'achievement_konami_code_step_3',
    ],
  },
];
