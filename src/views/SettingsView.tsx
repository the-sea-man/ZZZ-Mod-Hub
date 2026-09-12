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

type SettingsCategory =
  'general' | 'mod_management' | 'downloads' | 'appearance' | 'advanced' | 'about';
import { Settings, Folder, Download, Palette, Beaker, Info } from 'lucide-react';
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

  const tabs: { id: SettingsCategory; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: t('settings_general', 'General'), icon: <Settings size={20} /> },
    {
      id: 'mod_management',
      label: t('settings_mod_management', 'Mod Management'),
      icon: <Folder size={20} />,
    },
    { id: 'downloads', label: t('settings_downloads', 'Downloads'), icon: <Download size={20} /> },
    {
      id: 'appearance',
      label: t('settings_appearance', 'Appearance'),
      icon: <Palette size={20} />,
    },
    { id: 'advanced', label: t('settings_advanced', 'Advanced'), icon: <Beaker size={20} /> },
    { id: 'about', label: t('settings_about', 'About'), icon: <Info size={20} /> },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <motion.div
            key="general"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8 pb-20"
          >
            <PerformanceSettings />
            <GamePaths />
            <SoundSettings />
            <TutorialSettings />
          </motion.div>
        );
      case 'mod_management':
        return (
          <motion.div
            key="mod_management"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8 pb-20"
          >
            <HealthSettings />
            <ConflictSettings />
            <QuickSnapperSettings />
            <RandomizerSettings />
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
            <CharacterFilterSettings />
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
            <InGameOverlaySettings />
            <ExperimentalSettings />
            <BackupSettings />
            <DangerZoneSettings />
          </motion.div>
        );
      case 'about':
        return (
          <motion.div
            key="about"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8 pb-20"
          >
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
        <div className="flex md:flex-col overflow-x-auto md:overflow-x-visible custom-scrollbar px-4 md:px-6 pb-4 md:pb-8 gap-2">
          {tabs.map((tab) => (
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
