import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, TutorialId } from '../store/useAppStore';
import {
  X,
  Zap,
  MonitorPlay,
  CloudDownload,
  Sparkles,
  MonitorSmartphone,
  AlertTriangle,
} from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

export function TutorialOverlay() {
  const { activeTutorial, setActiveTutorial, markTutorialSeen } = useAppStore();
  const { t } = useTranslation();

  const TUTORIAL_CONTENT: Record<
    TutorialId,
    { title: string; description: React.ReactNode; icon: any; iconColor: string }
  > = {
    post_setup: {
      title: t('tutorial_post_setup_title', "You're all set!"),
      description: (
        <>
          <p className="mb-3">
            {t(
              'tutorial_post_setup_desc_1',
              'Now that your mods folder is connected, there are a few things you should know:'
            )}
          </p>
          <div className="bg-red-500/10 border border-red-500/20 rounded p-3 mb-4">
            <p className="text-red-400 text-sm font-bold mb-1 flex items-center gap-1.5">
              <AlertTriangle size={15} />
              <span>{t('tutorial_warning_important', 'IMPORTANT WARNING')}</span>
            </p>
            <p
              className="text-red-400/90 text-sm leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: t(
                  'tutorial_post_setup_desc_2',
                  'Using previously created folders or manually dragging in old mods is <b>extremely discouraged</b> and may break the app. We highly recommend starting fresh: use the <b>Generate Folders</b> button in the Library to create empty folders, then install your mods via the app.'
                ),
              }}
            />
          </div>
          <p
            className="mb-3"
            dangerouslySetInnerHTML={{
              __html: t(
                'tutorial_post_setup_desc_3',
                'To help you learn the ropes, keep an eye out for <b>buttons with pulsing colored borders</b>! Clicking these special buttons will trigger short, helpful tutorials for their features.'
              ),
            }}
          />
          <p className="mb-3 font-bold text-primary">
            {t(
              'tutorial_post_setup_desc_4',
              'Let\'s start by clicking the pulsing "Sync Cloud DB" button on the top left!'
            )}
          </p>
        </>
      ),
      icon: Sparkles,
      iconColor: 'text-blue-400',
    },
    install_mod: {
      title: t('tutorial_install_mod_title', 'Installing Local Mods'),
      description: (
        <>
          <p
            className="mb-3"
            dangerouslySetInnerHTML={{
              __html: t(
                'tutorial_install_mod_desc_1',
                'Clicking <b>Install Mod (Archive)</b> allows you to select a `.zip`, `.rar`, or `.7z` file directly from your computer. The app will automatically extract it, determine which character it belongs to, and place it in the correct folder!'
              ),
            }}
          />
          <div className="bg-primary/10 border border-primary/20 rounded p-3">
            <p className="text-primary font-bold text-sm mb-1">
              {t('tutorial_install_mod_warning_title', 'Important Note for .rar files')}
            </p>
            <p
              className="text-sm"
              dangerouslySetInnerHTML={{
                __html: t(
                  'tutorial_install_mod_warning_desc',
                  'If you want to install `.rar` or `.7z` archives locally, you <b>must</b> first go to the Settings tab and set your WinRAR executable path (usually <code>C:\\Program Files\\WinRAR\\WinRAR.exe</code>). Otherwise, only `.zip` files will work.'
                ),
              }}
            />
          </div>
        </>
      ),
      icon: Sparkles,
      iconColor: 'text-blue-400',
    },
    launch_game: {
      title: t('tutorial_launch_game_title', 'Launching the Game'),
      description: (
        <p
          dangerouslySetInnerHTML={{
            __html: t(
              'tutorial_launch_game_desc',
              "This button will launch the game using the exact executable path you've provided in the <b>Settings</b> tab. It supports custom command-line arguments (like <code>--nogui</code>) so it works perfectly with the XXMI Launcher!"
            ),
          }}
        />
      ),
      icon: Sparkles,
      iconColor: 'text-blue-400',
    },
    discover_page: {
      title: t('tutorial_discover_title', 'Discover GameBanana Mods'),
      description: (
        <p
          dangerouslySetInnerHTML={{
            __html: t(
              'tutorial_discover_desc',
              'Welcome to the <b>Discover</b> page! Here you can browse, search, and instantly download thousands of mods directly from GameBanana. No need to download zip files manually,just click install and the manager handles the rest.'
            ),
          }}
        />
      ),
      icon: Sparkles,
      iconColor: 'text-blue-400',
    },
    achievements_page: {
      title: t('tutorial_achievements_title', 'Your Achievements'),
      description: (
        <p
          dangerouslySetInnerHTML={{
            __html: t(
              'tutorial_achievements_desc',
              'Welcome to the <b>Achievements</b> page! As you use the mod manager, installing mods, toggling them, using filters, and syncing the database, you will unlock special achievements here. Try to collect them all!'
            ),
          }}
        />
      ),
      icon: Sparkles,
      iconColor: 'text-blue-400',
    },
    settings_page: {
      title: t('tutorial_settings_title', 'Settings & Customization'),
      description: (
        <p
          dangerouslySetInnerHTML={{
            __html: t(
              'tutorial_settings_desc',
              "Welcome to <b>Settings</b>! This is where you configure your critical paths (like the Mods Folder and Game Executable). You can also customize the app's look and feel, change the theme, tweak the transparency, or even set a custom background image."
            ),
          }}
        />
      ),
      icon: Sparkles,
      iconColor: 'text-blue-400',
    },
    hud: {
      title: t('tutorial_hud_title', 'In-Game HUD Controller'),
      description: (
        <>
          <p className="mb-4">
            {t(
              'tutorial_hud_desc_1',
              'The HUD system creates a tiny, interactive menu inside your game!'
            )}
          </p>
          <p
            className="mb-4"
            dangerouslySetInnerHTML={{
              __html: t(
                'tutorial_hud_desc_2',
                'Once enabled, the app automatically tracks your active mods and generates the HUD instantly every time you toggle a mod. Press <b>/</b> in-game to see your keybinds.'
              ),
            }}
          />
        </>
      ),
      icon: MonitorPlay,
      iconColor: 'text-green-400',
    },
    randomize: {
      title: t('tutorial_randomize_title', 'Mod Randomizer'),
      description: (
        <>
          <p className="mb-4">
            {t(
              'tutorial_randomize_desc_1',
              'Ready to spice things up? The Randomizer automatically picks random mods from your library for a fresh experience.'
            )}
          </p>
          <p className="mb-4">
            {t(
              'tutorial_randomize_desc_2',
              'You can favorite specific mods to increase their chances of being picked, or add characters to the whitelist so only they get randomized!'
            )}
          </p>
        </>
      ),
      icon: Zap,
      iconColor: 'text-purple-400',
    },
    sync: {
      title: t('tutorial_sync_title', 'Database Syncing'),
      description: (
        <>
          <p className="mb-4">
            {t(
              'tutorial_sync_desc_1',
              'By syncing the database, your app connects directly to a community-maintained list of ZZZ characters, weapons, and more.'
            )}
          </p>
          <p className="mb-4">
            {t(
              'tutorial_sync_desc_2',
              'This powers the GameBanana downloader and the automatic folder categorization features, ensuring everything stays neat and organized.'
            )}
          </p>
        </>
      ),
      icon: CloudDownload,
      iconColor: 'text-sky-400',
    },
    quick_snapper: {
      title: t('tutorial_quick_snapper_title', 'Quick Snapper'),
      description: (
        <>
          <p
            className="mb-3"
            dangerouslySetInnerHTML={{
              __html: t(
                'tutorial_quick_snapper_desc_1',
                'The <b>Quick Snapper</b> allows you to take automatic screenshots of your currently enabled mod and automatically cycle to the next mod without alt-tabbing!'
              ),
            }}
          />
          <p
            className="mb-3"
            dangerouslySetInnerHTML={{
              __html: t(
                'tutorial_quick_snapper_desc_2',
                'Press <kbd className="px-2 py-1 bg-black/40 rounded border border-white/20 font-mono text-xs">Alt+Shift+S</kbd> while in-game. The app will snap a screenshot, crop it to the values you set in Settings, and automatically move on to the next mod.'
              ),
            }}
          />
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-3">
            <p className="text-yellow-500 font-bold text-sm mb-1 flex items-center gap-1.5">
              <AlertTriangle size={15} />
              <span>{t('tutorial_quick_snapper_warning_title', 'Shortcut Conflict Warning')}</span>
            </p>
            <p
              className="text-sm text-yellow-500/90"
              dangerouslySetInnerHTML={{
                __html: t(
                  'tutorial_quick_snapper_warning_desc',
                  'If this global shortcut does not work, it means another program on your system (like GeForce Experience, Discord, or AMD Adrenalin) is already using <b>Alt+Shift+S</b>. You will need to disable or change it in that other program for this to work.'
                ),
              }}
            />
          </div>
        </>
      ),
      icon: MonitorSmartphone,
      iconColor: 'text-purple-400',
    },
    generate_folders: {
      title: t('tutorial_generate_folders_title', 'Generate Folders'),
      description: (
        <>
          <p className="mb-3">
            {t('tutorial_generate_folders_desc_1', 'Awesome, your database is synced!')}
          </p>
          <p
            className="mb-3"
            dangerouslySetInnerHTML={{
              __html: t(
                'tutorial_generate_folders_desc_2',
                'To get started with adding mods, you first need to setup your base folders. Click the <b className="text-primary">Generate Folders</b> button in the Library top bar.'
              ),
            }}
          />
          <p
            className="mb-3"
            dangerouslySetInnerHTML={{
              __html: t(
                'tutorial_generate_folders_desc_3',
                'This will automatically create all the necessary character and skin folders in your XXMI Launcher directory perfectly matching the cloud database!'
              ),
            }}
          />
        </>
      ),
      icon: Sparkles,
      iconColor: 'text-blue-400',
    },
  };

  if (!activeTutorial) return null;

  const content = TUTORIAL_CONTENT[activeTutorial];
  const Icon = content.icon;

  const handleClose = () => {
    markTutorialSeen(activeTutorial);
    setActiveTutorial(null);
  };

  return (
    <AnimatePresence>
      {activeTutorial && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="glass-panel w-full max-w-lg rounded-3xl border border-textMain/10 shadow-2xl overflow-hidden relative"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/50" />

            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 text-textMuted hover:text-textMain bg-surface/50 rounded-full transition-colors"
            >
              <X size={20} />
            </button>

            <div className="p-8">
              <div className="flex items-center gap-4 mb-6">
                <div
                  className={`p-4 rounded-2xl bg-surface/50 border border-textMain/5 ${content.iconColor}`}
                >
                  <Icon size={32} />
                </div>
                <h2 className="text-2xl font-bold text-textMain">{content.title}</h2>
              </div>

              <div className="text-textMain/90 leading-relaxed text-lg">{content.description}</div>

              <div className="mt-8 flex justify-end">
                <button
                  onClick={handleClose}
                  className="px-8 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/80 transition-all shadow-lg shadow-primary/20"
                >
                  {t('tutorial_got_it', 'Got it!')}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
