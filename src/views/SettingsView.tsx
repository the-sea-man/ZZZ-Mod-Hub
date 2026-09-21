import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '../hooks/useTranslation';
import { PerformanceSettings } from '../components/settings/PerformanceSettings';
import { GamePaths } from '../components/settings/GamePaths';
import { ThemeSettings } from '../components/settings/ThemeSettings';
import { InGameOverlaySettings } from '../components/settings/InGameOverlaySettings';
import { TutorialSettings } from '../components/settings/TutorialSettings';
import { SoundSettings } from '../components/settings/SoundSettings';
import { RandomizerSettings } from '../components/settings/RandomizerSettings';
import { DownloadSettings } from '../components/settings/DownloadSettings';
import { DiscoverSettings } from '../components/settings/DiscoverSettings';
import { CharacterFilterSettings } from '../components/settings/CharacterFilterSettings';
import { QuickSnapperSettings } from '../components/settings/QuickSnapperSettings';
import { AboutSettings } from '../components/settings/AboutSettings';
import { ConflictSettings } from '../components/settings/ConflictSettings';
import { HealthSettings } from '../components/settings/HealthSettings';
import { BackupSettings } from '../components/settings/BackupSettings';
import { DangerZoneSettings } from '../components/settings/DangerZoneSettings';
import { ExperimentalSettings } from '../components/settings/ExperimentalSettings';
import { CardCustomizerSettings } from '../components/settings/CardCustomizerSettings';
import type { SettingsCategory } from '../store/slices/preferencesSlice';
import {
  FolderCog,
  Library,
  Download,
  Gamepad2,
  Stethoscope,
  Palette,
  Globe,
  LayoutTemplate,
  Gauge,
  Beaker,
  Info,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export function SettingsView() {
  const { t } = useTranslation();
  const { settingsActiveTab: activeTab, setSettingsActiveTab: setActiveTab } = useAppStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sessionStorage.setItem('settingsTab', activeTab);

    // Restore scroll position when tab changes or on initial load
    const savedScroll = sessionStorage.getItem(`settingsScroll_${activeTab}`);
    if (scrollRef.current && savedScroll) {
      scrollRef.current.scrollTop = parseInt(savedScroll, 10);
    }
  }, [activeTab]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    sessionStorage.setItem(`settingsScroll_${activeTab}`, e.currentTarget.scrollTop.toString());
  };

  // Grouped so each tab has one job: where things are, what the tools do,
  // how it looks, and what affects the machine.
  const tabGroups: {
    id: string;
    label: string;
    tabs: { id: SettingsCategory; label: string; icon: React.ReactNode }[];
  }[] = [
    {
      id: 'setup',
      label: t('settings_group_setup', 'Setup'),
      tabs: [
        {
          id: 'game_folders',
          label: t('settings_tab_game_folders', 'Game & Folders'),
          icon: <FolderCog size={20} />,
        },
        {
          id: 'library',
          label: t('settings_tab_library', 'Library'),
          icon: <Library size={20} />,
        },
        {
          id: 'downloads',
          label: t('settings_downloads', 'Downloads'),
          icon: <Download size={20} />,
        },
      ],
    },
    {
      id: 'tools',
      label: t('settings_group_tools', 'Tools'),
      tabs: [
        {
          id: 'in_game',
          label: t('settings_tab_in_game', 'In-Game'),
          icon: <Gamepad2 size={20} />,
        },
        {
          id: 'diagnostics',
          label: t('settings_tab_diagnostics', 'Diagnostics'),
          icon: <Stethoscope size={20} />,
        },
      ],
    },
    {
      id: 'look_feel',
      label: t('settings_group_look_feel', 'Look & Feel'),
      tabs: [
        {
          id: 'appearance',
          label: t('settings_appearance', 'Appearance'),
          icon: (
            <span className="relative inline-flex items-center justify-center w-5 h-5">
              <Palette size={20} />
              <Globe
                size={11}
                className="absolute -bottom-1 -right-1 text-primary bg-background/90 rounded-full p-[0.5px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
              />
            </span>
          ),
        },
        {
          id: 'mod_cards',
          label: t('settings_tab_mod_cards', 'Mod Cards'),
          icon: <LayoutTemplate size={20} />,
        },
      ],
    },
    {
      id: 'system',
      label: t('settings_group_system', 'System'),
      tabs: [
        {
          id: 'performance',
          label: t('settings_tab_performance', 'Performance'),
          icon: <Gauge size={20} />,
        },
        {
          id: 'advanced',
          label: t('settings_advanced', 'Advanced'),
          icon: <Beaker size={20} />,
        },
        {
          id: 'help_about',
          label: t('settings_tab_help_about', 'Help & About'),
          icon: <Info size={20} />,
        },
      ],
    },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'game_folders':
        return (
          <motion.div
            key="game_folders"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8 pb-20"
          >
            <GamePaths />
          </motion.div>
        );
      case 'library':
        return (
          <motion.div
            key="library"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8 pb-20"
          >
            <RandomizerSettings />
            <CharacterFilterSettings />
          </motion.div>
        );
      case 'downloads':
        return (
          <motion.div
            key="downloads"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8 pb-20"
          >
            <DownloadSettings />
            <DiscoverSettings />
          </motion.div>
        );
      case 'in_game':
        return (
          <motion.div
            key="in_game"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8 pb-20"
          >
            <InGameOverlaySettings />
            <QuickSnapperSettings />
          </motion.div>
        );
      case 'diagnostics':
        return (
          <motion.div
            key="diagnostics"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8 pb-20"
          >
            <HealthSettings />
            <ConflictSettings />
          </motion.div>
        );
      case 'appearance':
        return (
          <motion.div
            key="appearance"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8 pb-20"
          >
            <ThemeSettings />
            <SoundSettings />
          </motion.div>
        );
      case 'mod_cards':
        return (
          <motion.div
            key="mod_cards"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8 pb-20"
          >
            <CardCustomizerSettings />
          </motion.div>
        );
      case 'performance':
        return (
          <motion.div
            key="performance"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8 pb-20"
          >
            <PerformanceSettings />
          </motion.div>
        );
      case 'advanced':
        return (
          <motion.div
            key="advanced"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8 pb-20"
          >
            <ExperimentalSettings />
            <BackupSettings />
            <DangerZoneSettings />
          </motion.div>
        );
      case 'help_about':
        return (
          <motion.div
            key="help_about"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8 pb-20"
          >
            <TutorialSettings />
            <AboutSettings />
          </motion.div>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full h-full flex flex-col md:flex-row overflow-hidden"
    >
      {/* Sidebar / Topbar */}
      <div className="md:w-72 md:flex-shrink-0 border-b md:border-b-0 md:border-r border-white/5 glass-sidebar z-10 flex flex-col">
        <div className="p-6 md:p-8 pb-4 md:pb-8">
          <h1 className="text-3xl md:text-4xl font-black text-textMain tracking-tight">
            {t('settings')}
          </h1>
        </div>

        {/* Navigation Tabs */}
        {/* md:min-h-0 lets this flex child shrink so the tab list can scroll
            inside the sidebar — without it the last tabs are unreachable on
            short windows. */}
        <div className="flex md:flex-col md:flex-1 md:min-h-0 overflow-x-auto md:overflow-x-visible md:overflow-y-auto custom-scrollbar px-4 md:px-6 pb-4 md:pb-8 gap-2 md:gap-1">
          {tabGroups.map((group) => (
            <div key={group.id} className="flex md:flex-col gap-2 md:gap-1 md:mb-4 last:md:mb-0">
              <h2 className="hidden md:block px-4 pt-2 pb-1 text-[11px] font-black uppercase tracking-widest text-textMuted/60">
                {group.label}
              </h2>
              {group.tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-primary text-white shadow-lg shadow-primary/20'
                      : 'text-textMuted hover:bg-white/5 hover:text-textMain'
                  }`}
                >
                  <span className="text-xl">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 relative"
      >
        <div className="max-w-5xl mx-auto">
          <AnimatePresence mode="wait">{renderContent()}</AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
