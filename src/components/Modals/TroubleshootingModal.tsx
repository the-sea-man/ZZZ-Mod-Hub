import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Search,
  LifeBuoy,
  Scissors,
  FolderOpen,
  RefreshCw,
  Sliders,
  ShieldAlert,
  Wrench,
  HelpCircle,
  ChevronDown,
  Sparkles,
  MessageSquare,
  Globe,
  Monitor,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from '../../hooks/useTranslation';
import type { SettingsCategory } from '../../store/slices/preferencesSlice';
import { useAppStore } from '../../store/useAppStore';

type SettingsTabType = SettingsCategory;

interface TroubleshootingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GuideTopic {
  id: string;
  category: 'graphics' | 'variants' | 'missing' | 'ingame' | 'updates' | 'conflicts' | 'community';
  titleKey: string;
  titleDefault: string;
  summaryKey: string;
  summaryDefault: string;
  icon: React.ElementType;
  badgeColor: string;
  keywords: string[];
  steps: {
    titleKey: string;
    titleDefault: string;
    descKey: string;
    descDefault: string;
  }[];
  actionButton?: {
    labelKey: string;
    labelDefault: string;
    icon: React.ElementType;
    action: (helpers: {
      navigate: (
        tab: 'library' | 'settings' | 'gamebanana' | 'achievements',
        settingsTab?: SettingsTabType
      ) => void;
      openFolder: (path: string) => void;
      syncDb: () => void;
      modsPath: string;
    }) => void;
  };
}

export const TroubleshootingModal: React.FC<TroubleshootingModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { setActiveTab, setSettingsActiveTab, modsPath, syncDatabase } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>('game_graphics_settings');

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKey);
    }
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const GUIDES: GuideTopic[] = useMemo(
    () => [
      {
        id: 'game_graphics_settings',
        category: 'graphics',
        titleKey: 'guide_game_graphics_title',
        titleDefault: 'Required Game & Graphics Settings (DirectX 11)',
        summaryKey: 'guide_game_graphics_summary',
        summaryDefault:
          'Mods not loading or rendering with broken shading? Ensure the game runs in DirectX 11 with the required graphics options.',
        icon: Monitor,
        badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
        keywords: [
          'directx',
          'dx11',
          'graphics',
          'illumination',
          'character quality',
          'dynamic precision',
          'volume fog',
          'highlight overflow',
          'smaa',
          'motion blur',
          'settings',
          'glitch',
          'rendering',
          'invisible',
          'pink',
          'black',
        ],
        steps: [
          {
            titleKey: 'guide_game_graphics_step1_title',
            titleDefault: '1. Launch Zenless Zone Zero in DirectX 11',
            descKey: 'guide_game_graphics_step1_desc',
            descDefault:
              '3DMigoto and ZZMI only hook into DirectX 11. If the game launches in DirectX 12, mods will not load. Add "-force-d3d11" to your game launch arguments or ensure your launcher targets DirectX 11.',
          },
          {
            titleKey: 'guide_game_graphics_step2_title',
            titleDefault: '2. Set "Global Illumination" to High',
            descKey: 'guide_game_graphics_step2_desc',
            descDefault:
              'In Options > Graphics, set Global Illumination to High. Lower settings disable lighting calculations that custom shaders rely on, causing character models to appear dark or flat.',
          },
          {
            titleKey: 'guide_game_graphics_step3_title',
            titleDefault: '3. Set "Character Quality" to High',
            descKey: 'guide_game_graphics_step3_desc',
            descDefault:
              'In Options > Graphics, set Character Quality to High. This forces the game engine to always render top-level LOD0 meshes that match the vertex buffers and hashes used by character mods.',
          },
          {
            titleKey: 'guide_game_graphics_step4_title',
            titleDefault: '4. Turn Off "Character Dynamic High Precision"',
            descKey: 'guide_game_graphics_step4_desc',
            descDefault:
              'In Options > Graphics, turn off Character Dynamic High Precision. Leaving this setting enabled dynamically changes vertex precision during gameplay, which causes mesh jittering, stretched polygons, or broken bone weights.',
          },
          {
            titleKey: 'guide_game_graphics_step5_title',
            titleDefault: '5. Optional: Turn Off "Volume Fog"',
            descKey: 'guide_game_graphics_step5_desc',
            descDefault:
              'In Options > Graphics, turn off Volumetric Fog (Volume Fog). This prevents translucent fog passes from clipping or creating unwanted visual halos around custom hair and cloth meshes.',
          },
          {
            titleKey: 'guide_game_graphics_step6_title',
            titleDefault: '6. Optional: Enable "Highlight Overflow"',
            descKey: 'guide_game_graphics_step6_desc',
            descDefault:
              'In Options > Graphics, enable Highlight Overflow. This bloom setting ensures that glowing textures, emissive weapon effects, and neon outfit details render at full intensity.',
          },
          {
            titleKey: 'guide_game_graphics_step7_title',
            titleDefault: '7. Optional: Switch Anti-Aliasing to "SMAA"',
            descKey: 'guide_game_graphics_step7_desc',
            descDefault:
              'In Options > Graphics, switch Anti-Aliasing to SMAA instead of TAA. TAA frequently introduces temporal ghosting and blurriness on custom high-resolution textures and fine hair strands.',
          },
          {
            titleKey: 'guide_game_graphics_step8_title',
            titleDefault: '8. Optional: Turn Off "Motion Blur"',
            descKey: 'guide_game_graphics_step8_desc',
            descDefault:
              'In Options > Graphics, turn off Motion Blur. Disabling motion blur eliminates camera smear during fast combat actions, keeping modded outfits and weapon animations crisp.',
          },
        ],
        actionButton: {
          labelKey: 'guide_action_open_mods_folder',
          labelDefault: 'Open XXMI Mods Folder',
          icon: FolderOpen,
          action: ({ openFolder, modsPath }) => {
            if (modsPath) openFolder(modsPath);
          },
        },
      },
      {
        id: 'dual_variants',
        category: 'variants',
        titleKey: 'guide_dual_variants_title',
        titleDefault: 'Mod Has 2+ Versions/Outfits Inside Same Folder',
        summaryKey: 'guide_dual_variants_summary',
        summaryDefault:
          'Downloaded a mod pack with SFW/NSFW or multiple character variants in one folder and they are glitching or overlapping?',
        icon: Scissors,
        badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        keywords: [
          'two',
          'multiple',
          'versions',
          'variants',
          'sfw',
          'nsfw',
          'subfolders',
          'same folder',
          'split',
          'overlapping',
          'flicker',
        ],
        steps: [
          {
            titleKey: 'guide_dual_variants_step1_title',
            titleDefault: '1. Why This Happens in 3DMigoto',
            descKey: 'guide_dual_variants_step1_desc',
            descDefault:
              '3DMigoto automatically executes every active .ini file inside a mod folder and its subdirectories. If a mod creator puts Variant A and Variant B in subfolders without keybind switches, the game tries to load BOTH simultaneously, causing texture glitches or mesh collisions.',
          },
          {
            titleKey: 'guide_dual_variants_step2_title',
            titleDefault: '2. Solution A: Use "Split Mod Pack" (Recommended)',
            descKey: 'guide_dual_variants_step2_desc',
            descDefault:
              'Click the "..." (Mod Options) button on the mod card and select "Split Mod Pack". The built-in Mod Splitter will isolate each subfolder into its own standalone mod card, allowing you to toggle each version independently!',
          },
          {
            titleKey: 'guide_dual_variants_step3_title',
            titleDefault: '3. Solution B: Disable Unused Subfolders Manually',
            descKey: 'guide_dual_variants_step3_desc',
            descDefault:
              'Click "Open Folder" to view the mod files in Windows Explorer. Rename any subfolder you do not want to use by prefixing it with "DISABLED " (e.g., "DISABLED Variant 2"). 3DMigoto will ignore disabled subfolders.',
          },
        ],
        actionButton: {
          labelKey: 'guide_action_view_experimental',
          labelDefault: 'Unlock Mod Splitter in Settings',
          icon: Sliders,
          action: ({ navigate }) => {
            navigate('settings', 'advanced');
            onClose();
          },
        },
      },
      {
        id: 'unassigned_mods',
        category: 'missing',
        titleKey: 'guide_unassigned_title',
        titleDefault: 'Where Did My Mod Go? (Unassigned Folder)',
        summaryKey: 'guide_unassigned_summary',
        summaryDefault:
          'Downloaded a UI mod, loading screen, or sound mod and cannot find it in your character list?',
        icon: FolderOpen,
        badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        keywords: [
          'where',
          'unassigned',
          'missing',
          'lost',
          'ui',
          'wallpaper',
          'loading screen',
          'audio',
        ],
        steps: [
          {
            titleKey: 'guide_unassigned_step1_title',
            titleDefault: '1. Non-Mesh Mods Stay in "Unassigned"',
            descKey: 'guide_unassigned_step1_desc',
            descDefault:
              'To protect your character folders from broken 3D assets, non-character mods (HUD overlays, loading screen wallpapers, agent icons, screen UID removers, and audio packs) are safely sorted into the "Unassigned" category.',
          },
          {
            titleKey: 'guide_unassigned_step2_title',
            titleDefault: '2. Finding and Enabling Them',
            descKey: 'guide_unassigned_step2_desc',
            descDefault:
              'Open the Library tab and scroll down to the "Unassigned" folder. All UI and general mods are located there and can be enabled or disabled just like character skins.',
          },
        ],
        actionButton: {
          labelKey: 'guide_action_open_library',
          labelDefault: 'Go to Library',
          icon: FolderOpen,
          action: ({ navigate }) => {
            navigate('library');
            onClose();
          },
        },
      },
      {
        id: 'ingame_reload',
        category: 'ingame',
        titleKey: 'guide_ingame_reload_title',
        titleDefault: 'Mods Enabled but Not Showing In-Game',
        summaryKey: 'guide_ingame_reload_summary',
        summaryDefault: 'Toggled a mod on but nothing changes in Zenless Zone Zero while playing?',
        icon: RefreshCw,
        badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        keywords: ['ingame', 'reload', 'f10', 'hot-reload', 'not working', 'invisible', 'xxmi'],
        steps: [
          {
            titleKey: 'guide_ingame_reload_step1_title',
            titleDefault: '1. Press F10 In-Game to Hot-Reload',
            descKey: 'guide_ingame_reload_step1_desc',
            descDefault:
              'Zenless Zone Zero 3DMigoto mods do not require restarting the game. Whenever you enable, disable, or install a mod, press F10 on your keyboard in-game to instantly reload 3DMigoto.',
          },
          {
            titleKey: 'guide_ingame_reload_step2_title',
            titleDefault: '2. Verify Your XXMI Mods Path',
            descKey: 'guide_ingame_reload_step2_desc',
            descDefault:
              'Make sure your Mods folder path in Settings → General is pointing directly to your active XXMI launcher directory (typically %APPDATA%\\XXMI Launcher\\ZZMI\\Mods).',
          },
        ],
        actionButton: {
          labelKey: 'guide_action_open_mods_folder',
          labelDefault: 'Open XXMI Mods Folder',
          icon: FolderOpen,
          action: ({ openFolder, modsPath }) => {
            if (modsPath) openFolder(modsPath);
          },
        },
      },
      {
        id: 'outdated_hashes',
        category: 'updates',
        titleKey: 'guide_outdated_hashes_title',
        titleDefault: 'Game Patch Broke Mod (Outdated Hashes)',
        summaryKey: 'guide_outdated_hashes_summary',
        summaryDefault:
          'Did a recent game version update cause your favorite character skin to break, stretch, or disappear?',
        icon: Wrench,
        badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        keywords: [
          'patch',
          'update',
          'broken',
          'stretch',
          'vertex',
          'hash',
          'fixer',
          'repair',
          'migration',
        ],
        steps: [
          {
            titleKey: 'guide_outdated_hashes_step1_title',
            titleDefault: '1. Why Game Patches Break Mods',
            descKey: 'guide_outdated_hashes_step1_desc',
            descDefault:
              'When HoYoverse updates the game, character 3D models are often re-compiled, changing their 8-character vertex and index buffer hashes. Mods targeting older game versions will not appear.',
          },
          {
            titleKey: 'guide_outdated_hashes_step2_title',
            titleDefault: '2. Use Native Mod Fixer to Auto-Repair',
            descKey: 'guide_outdated_hashes_step2_desc',
            descDefault:
              'ZZZ Mod Hub includes a built-in Native Mod Fixer with hash migration lineages. Click "Upgrade Outdated Mods" in the Library toolbar or the Wrench button on any mod card to automatically re-index vertex buffers and migrate hashes to the latest patch!',
          },
        ],
        actionButton: {
          labelKey: 'guide_action_sync_db',
          labelDefault: 'Sync Latest Hash Database',
          icon: RefreshCw,
          action: ({ syncDb }) => {
            syncDb();
            onClose();
          },
        },
      },
      {
        id: 'mesh_conflicts',
        category: 'conflicts',
        titleKey: 'guide_mesh_conflicts_title',
        titleDefault: 'Mesh Conflicts & Keybind Overlaps',
        summaryKey: 'guide_mesh_conflicts_summary',
        summaryDefault:
          'Seeing red conflict badges on mod cards or pressing a key switches outfits on multiple characters?',
        icon: ShieldAlert,
        badgeColor: 'bg-red-500/10 text-red-400 border-red-500/20',
        keywords: ['conflict', 'red badge', 'overlap', 'keybind', 'hotkey', 'same key'],
        steps: [
          {
            titleKey: 'guide_mesh_conflicts_step1_title',
            titleDefault: '1. Resolving 3D Mesh Conflicts',
            descKey: 'guide_mesh_conflicts_step1_desc',
            descDefault:
              'If two enabled mods attempt to replace the same character component (e.g., both replace Ellen\'s Body IB), the game will experience rendering glitches. Click the "View Hash Conflicts" badge on the mod card to see conflicting mods and disable one.',
          },
          {
            titleKey: 'guide_mesh_conflicts_step2_title',
            titleDefault: '2. Customizing Keybinds',
            descKey: 'guide_mesh_conflicts_step2_desc',
            descDefault:
              'If two mods use the same key (e.g. key []), click "Keybinds" on the mod card or open Settings → Mod Management → Keybind Conflicts to rebind them to different keys without editing text files.',
          },
        ],
        actionButton: {
          labelKey: 'guide_action_health_settings',
          labelDefault: 'Open Mod Health Settings',
          icon: Sliders,
          action: ({ navigate }) => {
            navigate('settings', 'diagnostics');
            onClose();
          },
        },
      },
      {
        id: 'gb_comments',
        category: 'community',
        titleKey: 'guide_gb_comments_title',
        titleDefault: 'Ask on GameBanana (Comments & Author Notes)',
        summaryKey: 'guide_gb_comments_summary',
        summaryDefault:
          "Still experiencing an unexplained bug or missing textures specific to a mod? Check the author's page or post a question.",
        icon: MessageSquare,
        badgeColor: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
        keywords: [
          'gamebanana',
          'comment',
          'author',
          'ask',
          'question',
          'feedback',
          'bug',
          'help',
          'discussion',
        ],
        steps: [
          {
            titleKey: 'guide_gb_comments_step1_title',
            titleDefault: '1. Check Author Notes & Pinned Comments',
            descKey: 'guide_gb_comments_step1_desc',
            descDefault:
              'Mod creators frequently post crucial installation notes, dependencies, toggles, or known bugs in the GameBanana description and pinned comments.',
          },
          {
            titleKey: 'guide_gb_comments_step2_title',
            titleDefault: '2. Jump Straight to the Mod Page',
            descKey: 'guide_gb_comments_step2_desc',
            descDefault:
              "Click the globe icon or title link on any mod card in your Library (or in the Downloads history drawer) to instantly open the mod's official GameBanana page.",
          },
          {
            titleKey: 'guide_gb_comments_step3_title',
            titleDefault: '3. Ask in the Comments Section',
            descKey: 'guide_gb_comments_step3_desc',
            descDefault:
              "Scroll down to the Comments section on the mod's GameBanana page. Mod authors and other players are very active and can often help solve issues with specific variants or patch updates!",
          },
        ],
        actionButton: {
          labelKey: 'guide_action_open_gamebanana',
          labelDefault: 'Browse Discover / GameBanana',
          icon: Globe,
          action: ({ navigate }) => {
            navigate('gamebanana');
            onClose();
          },
        },
      },
    ],
    [onClose]
  );

  const filteredGuides = useMemo(() => {
    return GUIDES.filter((g) => {
      const matchesCat = selectedCategory === 'all' || g.category === selectedCategory;
      if (!matchesCat) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const title = t(g.titleKey, g.titleDefault).toLowerCase();
      const summary = t(g.summaryKey, g.summaryDefault).toLowerCase();
      const keywords = g.keywords.some((k) => k.toLowerCase().includes(q));
      return title.includes(q) || summary.includes(q) || keywords;
    });
  }, [GUIDES, selectedCategory, searchQuery, t]);

  const handleAction = (topic: GuideTopic) => {
    if (!topic.actionButton) return;
    topic.actionButton.action({
      navigate: (tab, settingsTab) => {
        setActiveTab(tab);
        if (settingsTab) setSettingsActiveTab(settingsTab);
      },
      openFolder: (path) => invoke('open_folder', { path }),
      syncDb: () => syncDatabase(),
      modsPath,
    });
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/75 backdrop-blur-md"
      />

      {/* Modal Card */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="relative w-full max-w-4xl bg-surface/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] z-10"
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b border-white/5 flex items-center justify-between bg-black/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shadow-lg">
              <LifeBuoy size={22} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-black text-textMain flex items-center gap-2">
                <span>{t('troubleshooting_modal_title', 'Troubleshooting and Quick Fixes')}</span>
              </h2>
              <p className="text-xs text-textMuted">
                {t(
                  'troubleshooting_modal_desc',
                  'Instant solutions for mod pack variants, missing mods, F10 reloads, and version updates.'
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-textMuted hover:text-textMain hover:bg-white/5 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search & Category Filter Strip */}
        <div className="p-4 px-6 border-b border-white/5 bg-black/10 flex flex-col md:flex-row gap-3 shrink-0">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textMuted"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t(
                'troubleshoot_search_placeholder',
                'Search issues (e.g. two versions, split, missing, F10, conflict)...'
              )}
              className="w-full pl-10 pr-4 py-2 bg-black/30 border border-white/10 rounded-xl text-xs text-textMain placeholder:text-textMuted/60 focus:outline-none focus:border-amber-500/50 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-textMuted hover:text-textMain"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 md:pb-0">
            {[
              { id: 'all', labelKey: 'troubleshoot_cat_all', labelDefault: 'All Issues' },
              {
                id: 'graphics',
                labelKey: 'troubleshoot_cat_graphics',
                labelDefault: 'Graphics & DX11',
              },
              {
                id: 'variants',
                labelKey: 'troubleshoot_cat_variants',
                labelDefault: 'Dual Variants / Split',
              },
              {
                id: 'missing',
                labelKey: 'troubleshoot_cat_missing',
                labelDefault: 'Missing / Unassigned',
              },
              { id: 'ingame', labelKey: 'troubleshoot_cat_ingame', labelDefault: 'In-Game & F10' },
              {
                id: 'updates',
                labelKey: 'troubleshoot_cat_updates',
                labelDefault: 'Game Updates & Hashes',
              },
              {
                id: 'conflicts',
                labelKey: 'troubleshoot_cat_conflicts',
                labelDefault: 'Conflicts',
              },
              {
                id: 'community',
                labelKey: 'troubleshoot_cat_community',
                labelDefault: 'GameBanana & Comments',
              },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'bg-black/20 text-textMuted hover:text-textMain hover:bg-white/5 border border-white/5'
                }`}
              >
                {t(cat.labelKey, cat.labelDefault)}
              </button>
            ))}
          </div>
        </div>

        {/* Content Topics List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-3">
          {filteredGuides.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <HelpCircle size={40} className="text-textMuted/40 mb-2" />
              <h3 className="text-sm font-bold text-textMain">
                {t('no_guides_found', 'No troubleshooting guides match your search.')}
              </h3>
              <p className="text-xs text-textMuted mt-1">
                {t('no_guides_hint', 'Try different keywords or clear the filter.')}
              </p>
            </div>
          ) : (
            filteredGuides.map((topic) => {
              const Icon = topic.icon;
              const isExpanded = expandedTopicId === topic.id;

              return (
                <div
                  key={topic.id}
                  className={`border rounded-xl transition-all overflow-hidden ${
                    isExpanded
                      ? 'bg-black/30 border-amber-500/30 shadow-lg'
                      : 'bg-black/20 border-white/5 hover:border-white/10'
                  }`}
                >
                  {/* Topic Header Accordion Bar */}
                  <div
                    onClick={() => setExpandedTopicId(isExpanded ? null : topic.id)}
                    className="p-4 flex items-start justify-between gap-3 cursor-pointer select-none"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border mt-0.5 ${topic.badgeColor}`}
                      >
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-textMain hover:text-amber-300 transition-colors">
                          {t(topic.titleKey, topic.titleDefault)}
                        </h3>
                        <p className="text-xs text-textMuted mt-0.5 leading-relaxed">
                          {t(topic.summaryKey, topic.summaryDefault)}
                        </p>
                      </div>
                    </div>

                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-textMuted hover:text-textMain p-1 shrink-0"
                    >
                      <ChevronDown size={18} />
                    </motion.div>
                  </div>

                  {/* Expanded Guide Steps */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 pt-0 border-t border-white/5 space-y-3 mt-1">
                          <div className="space-y-2.5 pt-3">
                            {topic.steps.map((step, idx) => (
                              <div
                                key={idx}
                                className="bg-surface/50 border border-white/5 p-3 rounded-xl flex flex-col gap-1"
                              >
                                <h4 className="text-xs font-bold text-textMain flex items-center gap-1.5">
                                  <span className="text-amber-400 font-mono">▶</span>
                                  <span>{t(step.titleKey, step.titleDefault)}</span>
                                </h4>
                                <p className="text-[11px] text-textMuted leading-relaxed pl-4">
                                  {t(step.descKey, step.descDefault)}
                                </p>
                              </div>
                            ))}
                          </div>

                          {/* Quick Action Button */}
                          {topic.actionButton && (
                            <div className="pt-2 flex justify-end">
                              <button
                                onClick={() => handleAction(topic)}
                                className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md cursor-pointer"
                              >
                                <topic.actionButton.icon size={14} className="text-amber-400" />
                                <span>
                                  {t(topic.actionButton.labelKey, topic.actionButton.labelDefault)}
                                </span>
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-white/5 bg-black/30 flex items-center justify-between text-xs text-textMuted shrink-0 gap-4">
          <span className="flex items-center gap-1.5 min-w-0">
            <Sparkles size={14} className="text-amber-400 shrink-0" />
            <span className="truncate md:whitespace-normal">
              {t(
                'troubleshoot_footer_tip',
                'Tip: If a mod is still glitching, click the GameBanana icon on the mod card to read author notes and ask questions in the comments!'
              )}
            </span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/15 text-textMain rounded-lg font-bold transition-colors cursor-pointer shrink-0"
          >
            {t('close', 'Close')}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};
