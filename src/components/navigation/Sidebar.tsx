import { motion, AnimatePresence } from 'framer-motion';

import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { Library, Compass, Settings, Trophy } from 'lucide-react';
import { SidebarDownloadPanel } from './SidebarDownloadPanel';

export function Sidebar() {
  const { activeTab, setActiveTab, hasVisitedSettings, availableUpdates } = useAppStore();
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ x: -50, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="w-72 flex-shrink-0 glass-sidebar border-r border-textMain/10 flex flex-col items-center py-10 gap-6 shadow-[20px_0_40px_rgba(0,0,0,0.3)] z-10"
    >
      <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-primary to-accent p-1 mb-8 shadow-lg shadow-primary/20">
        <div className="w-full h-full rounded-full bg-surface flex items-center justify-center font-bold text-3xl tracking-tighter shadow-inner">
          ZZZ
        </div>
      </div>

      <div className="flex flex-col gap-3 w-full px-6">
        <NavButton
          active={activeTab === 'library'}
          onClick={() => setActiveTab('library')}
          icon={<Library size={24} />}
          label={t('library')}
          countBadge={availableUpdates.length}
          countBadgeTooltip={
            availableUpdates.length > 0
              ? t('sidebar_updates_tooltip', '{{count}} mod update(s) available on GameBanana', {
                  count: availableUpdates.length,
                })
              : undefined
          }
          buttonTitle={
            availableUpdates.length > 0
              ? t('sidebar_updates_tooltip', '{{count}} mod update(s) available on GameBanana', {
                  count: availableUpdates.length,
                })
              : t('library')
          }
          highlightId="nav_library_tab"
        />
        <NavButton
          active={activeTab === 'gamebanana'}
          onClick={() => setActiveTab('gamebanana')}
          icon={<Compass size={24} />}
          label={t('discover')}
          buttonTitle={t('discover')}
          highlightId="nav_discover_tab"
        />
        <NavButton
          active={activeTab === 'achievements'}
          onClick={() => setActiveTab('achievements')}
          icon={<Trophy size={24} />}
          label={t('achievements')}
          buttonTitle={t('achievements')}
          highlightId="nav_achievements_tab"
        />
        <NavButton
          active={activeTab === 'settings'}
          onClick={() => setActiveTab('settings')}
          icon={<Settings size={24} />}
          label={t('settings')}
          badge={!hasVisitedSettings}
          badgeTooltip={t(
            'sidebar_settings_badge_tooltip',
            'Setup or configuration recommended in Settings'
          )}
          buttonTitle={
            !hasVisitedSettings
              ? t(
                  'sidebar_settings_badge_tooltip',
                  'Setup or configuration recommended in Settings'
                )
              : t('settings')
          }
          highlightId="nav_settings_tab"
        />
      </div>

      <SidebarDownloadPanel />
    </motion.div>
  );
}

function NavButton({
  active,
  onClick,
  icon,
  label,
  badge,
  badgeTooltip,
  countBadge,
  countBadgeTooltip,
  buttonTitle,
  highlightId,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: boolean;
  badgeTooltip?: string;
  countBadge?: number;
  countBadgeTooltip?: string;
  buttonTitle?: string;
  highlightId?: string;
}) {
  const { highlightTargetId } = useAppStore();
  const isHighlighted = !!highlightId && highlightTargetId === highlightId;

  return (
    <button
      data-highlight-id={highlightId}
      onClick={onClick}
      title={buttonTitle || label}
      className={`relative w-full h-14 rounded-2xl flex items-center px-6 gap-4 font-bold text-base transition-all duration-300 overflow-hidden group
        ${isHighlighted ? 'highlight-target animate-pulse ring-2 ring-primary shadow-lg' : ''}
        ${active ? 'text-textMain' : 'text-textMuted hover:text-textMain hover:bg-textMain/5'}`}
    >
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-primary/20 border border-primary/50 rounded-2xl shadow-[inset_0_0_20px_rgba(var(--color-primary),0.2)]"
          />
        )}
      </AnimatePresence>
      <div
        className={`absolute left-0 w-1.5 h-8 rounded-r-full bg-primary transition-transform duration-300 origin-left ${active ? 'scale-x-100' : 'scale-x-0'}`}
      />
      <span className="relative z-10 flex items-center justify-center w-8 h-8 opacity-90 group-hover:opacity-100 transition-opacity">
        {icon}
      </span>
      <span className="relative z-10 tracking-wide truncate flex-1 text-left flex items-center justify-between">
        <span>{label}</span>
        {countBadge !== undefined && countBadge > 0 && (
          <span
            title={countBadgeTooltip}
            aria-label={countBadgeTooltip}
            className="px-2 py-0.5 rounded-full bg-amber-500 text-black text-xs font-black animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.6)] cursor-help"
          >
            {countBadge}
          </span>
        )}
        {badge && !active && (
          <span
            title={badgeTooltip}
            aria-label={badgeTooltip}
            className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse shadow-[0_0_10px_rgba(var(--color-primary-rgb),0.8)] cursor-help"
          />
        )}
      </span>
    </button>
  );
}
