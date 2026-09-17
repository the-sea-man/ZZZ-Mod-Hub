import React, { useState } from 'react';
import {
  LayoutTemplate,
  Image as ImageIcon,
  FolderOpen,
  Box,
  MoreVertical,
  Heart,
  Sparkles,
  RotateCcw,
  ShieldCheck,
  Tag,
  Sliders,
  Maximize2,
  Lock,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import {
  ModCardComponentId,
  CARD_PRESETS,
  DEFAULT_MOD_CARD_CUSTOMIZATION,
  getBorderRadiusClass,
} from '../../types/cardCustomization';

export function CardCustomizerSettings() {
  const { t } = useTranslation();
  const {
    cardCustomization = DEFAULT_MOD_CARD_CUSTOMIZATION,
    setCardCustomization,
    resetCardCustomization,
    applyCardPreset,
  } = useAppStore();

  const [selectedComponent, setSelectedComponent] = useState<ModCardComponentId>('card_frame');
  const [hoveredComponent, setHoveredComponent] = useState<ModCardComponentId | null>(null);
  const [previewActive, setPreviewActive] = useState<boolean>(true);
  const [isFavorite, setIsFavorite] = useState<boolean>(true);

  // Helper for applying partial config to cardCustomization
  const updateFrame = (patch: Partial<typeof cardCustomization.frame>) => {
    setCardCustomization({ frame: { ...cardCustomization.frame, ...patch } });
  };
  const updateOverlay = (patch: Partial<typeof cardCustomization.imageOverlay>) => {
    setCardCustomization({ imageOverlay: { ...cardCustomization.imageOverlay, ...patch } });
  };
  const updateActions = (patch: Partial<typeof cardCustomization.actionButtons>) => {
    setCardCustomization({ actionButtons: { ...cardCustomization.actionButtons, ...patch } });
  };
  const updateBadges = (patch: Partial<typeof cardCustomization.badges>) => {
    setCardCustomization({ badges: { ...cardCustomization.badges, ...patch } });
  };
  const updateInfoPanel = (patch: Partial<typeof cardCustomization.infoPanel>) => {
    setCardCustomization({ infoPanel: { ...cardCustomization.infoPanel, ...patch } });
  };
  const updateToggleButton = (patch: Partial<typeof cardCustomization.toggleButton>) => {
    setCardCustomization({ toggleButton: { ...cardCustomization.toggleButton, ...patch } });
  };

  // Compute shadow class
  const getShadowClass = (intensity: string) => {
    switch (intensity) {
      case 'none':
        return 'shadow-none';
      case 'subtle':
        return 'shadow-md';
      case 'medium':
        return 'shadow-xl';
      case 'intense':
        return 'shadow-2xl shadow-primary/20';
      default:
        return 'shadow-xl';
    }
  };

  // Compute border width class
  const getBorderWidthClass = (width: number) => {
    switch (width) {
      case 0:
        return 'border-0';
      case 1:
        return 'border';
      case 2:
        return 'border-2';
      case 3:
        return 'border-[3px]';
      default:
        return 'border';
    }
  };

  // Compute border color class
  const getBorderColorClass = (color: string) => {
    switch (color) {
      case 'primary':
        return 'border-primary';
      case 'white':
        return 'border-white/30';
      case 'none':
        return 'border-transparent';
      case 'default':
      default:
        return 'border-textMain/10';
    }
  };

  // Compute action button styles
  const getActionButtonClass = () => {
    const style = cardCustomization.actionButtons.buttonStyle;
    let base =
      'p-2.5 rounded-full border transition-all shadow-lg flex items-center justify-center cursor-pointer ';
    if (style === 'solid') {
      base += 'bg-surface border-textMain/20 ';
    } else if (style === 'transparent') {
      base += 'bg-black/30 border-white/10 hover:bg-black/50 ';
    } else {
      // glass
      base += 'bg-background/80 border-textMain/10 backdrop-blur-md hover:bg-surface ';
    }

    const iconColor = cardCustomization.actionButtons.iconColor;
    if (iconColor === 'primary') {
      base += 'text-primary';
    } else if (iconColor === 'white') {
      base += 'text-white';
    } else {
      base += 'text-textMuted hover:text-textMain';
    }
    return base;
  };

  // Compute badge style
  const getBadgeStyleClass = () => {
    if (cardCustomization.badges.badgeStyle === 'solid') {
      return 'bg-zinc-900 border border-zinc-700 text-white';
    }
    return 'bg-black/70 backdrop-blur-md border border-white/10 text-white';
  };

  // Compute toggle button padding
  const getTogglePaddingClass = () => {
    switch (cardCustomization.toggleButton.buttonPadding) {
      case 'compact':
        return 'py-2 text-xs';
      case 'large':
        return 'py-3.5 text-base';
      case 'normal':
      default:
        return 'py-3 text-sm';
    }
  };

  // Compute toggle button radius
  const getToggleRadiusClass = () => {
    switch (cardCustomization.toggleButton.borderRadius) {
      case 'match':
        return getBorderRadiusClass(cardCustomization.frame.borderRadius);
      case 'md':
        return 'rounded-md';
      case 'lg':
        return 'rounded-lg';
      case 'xl':
        return 'rounded-xl';
      case 'full':
        return 'rounded-full';
      default:
        return 'rounded-xl';
    }
  };

  // Nav items for components
  const componentTabs: { id: ModCardComponentId; label: string; icon: React.ReactNode }[] = [
    {
      id: 'card_frame',
      label: t('card_comp_frame', 'Frame & Glass'),
      icon: <LayoutTemplate size={16} />,
    },
    {
      id: 'image_overlay',
      label: t('card_comp_overlay', 'Image & Overlay'),
      icon: <ImageIcon size={16} />,
    },
    { id: 'badges', label: t('card_comp_badges', 'Badges'), icon: <Heart size={16} /> },
    {
      id: 'action_buttons',
      label: t('card_comp_actions', 'Quick Actions'),
      icon: <FolderOpen size={16} />,
    },
    { id: 'info_panel', label: t('card_comp_info_panel', 'Info Panel'), icon: <Tag size={16} /> },
    {
      id: 'toggle_button',
      label: t('card_comp_toggle', 'Toggle Button'),
      icon: <Lock size={16} />,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="glass-panel border border-textMain/5 rounded-3xl p-6 md:p-8 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3.5 rounded-2xl bg-primary/10 text-primary border border-primary/20">
              <Sliders size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-textMain tracking-tight">
                {t('settings_card_appearance_title', 'Mod Card Designer')}
              </h2>
              <p className="text-sm text-textMuted mt-1 max-w-2xl">
                {t(
                  'settings_card_appearance_desc',
                  'Customize the visual presentation of mod cards across your library. Click any component on the preview card below or select an inspector tab.'
                )}
              </p>
            </div>
          </div>

          {/* Quick Presets & Global Reset */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => resetCardCustomization()}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-textMuted hover:text-textMain border border-white/5 transition-all flex items-center gap-1.5 cursor-pointer"
              title={t('card_reset_all_tooltip', 'Reset all card styles to defaults')}
            >
              <RotateCcw size={14} />
              <span>{t('card_reset_all', 'Reset Defaults')}</span>
            </button>
          </div>
        </div>

        {/* 1-Click Presets Strip */}
        <div className="mt-6 pt-6 border-t border-textMain/5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} className="text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-textMuted">
              {t('card_presets_label', 'Curated Presets')}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.values(CARD_PRESETS).map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyCardPreset(preset.id)}
                className="p-3 rounded-2xl bg-surface/40 hover:bg-surface border border-textMain/5 hover:border-primary/40 text-left transition-all group cursor-pointer"
              >
                <div className="font-bold text-sm text-textMain group-hover:text-primary transition-colors">
                  {preset.name}
                </div>
                <div className="text-[11px] text-textMuted line-clamp-2 mt-1">
                  {preset.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Two-Column Designer Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Interactive Mock ModCard */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <LayoutTemplate size={16} className="text-primary" />
              <span className="text-xs font-black uppercase tracking-wider text-textMuted">
                {t('card_preview_title', 'Interactive Preview')}
              </span>
            </div>

            {/* State Simulation Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-textMuted">
                {previewActive
                  ? t('card_preview_active', 'Active Mod')
                  : t('card_preview_disabled', 'Disabled Mod')}
              </span>
              <button
                type="button"
                onClick={() => setPreviewActive(!previewActive)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                  previewActive ? 'bg-primary' : 'bg-white/10'
                }`}
                title={t('card_toggle_preview_state', 'Toggle Enabled/Disabled preview')}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    previewActive ? 'translate-x-4.5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          <p className="text-xs text-textMuted px-2">
            {t(
              'card_interactive_hint',
              '💡 Click on any component (borders, buttons, badges, image, or info panel) to edit its properties.'
            )}
          </p>

          {/* Interactive Card Container */}
          <div className="p-4 rounded-3xl bg-black/30 border border-white/5 flex justify-center">
            <div
              onClick={() => setSelectedComponent('card_frame')}
              onMouseEnter={() => setHoveredComponent('card_frame')}
              onMouseLeave={() => setHoveredComponent(null)}
              style={{
                backgroundColor: `rgba(var(--bg-surface), ${cardCustomization.frame.bgOpacity / 100})`,
                backdropFilter: `blur(${cardCustomization.frame.blurAmount}px)`,
                WebkitBackdropFilter: `blur(${cardCustomization.frame.blurAmount}px)`,
              }}
              className={`w-72 overflow-hidden flex flex-col relative transition-all duration-200 select-none group cursor-pointer ${getBorderRadiusClass(
                cardCustomization.frame.borderRadius
              )} ${getBorderWidthClass(cardCustomization.frame.borderWidth)} ${getBorderColorClass(
                cardCustomization.frame.borderColor
              )} ${getShadowClass(cardCustomization.frame.shadowIntensity)} ${
                selectedComponent === 'card_frame'
                  ? 'ring-2 ring-primary ring-offset-2 ring-offset-black'
                  : hoveredComponent === 'card_frame'
                    ? 'ring-1 ring-white/30'
                    : ''
              }`}
            >
              {/* Component Badge Indicator (Frame) */}
              {selectedComponent === 'card_frame' && (
                <div className="absolute top-2 right-2 z-40 px-2 py-0.5 rounded-md bg-primary text-black font-black text-[10px] tracking-wider uppercase shadow-md pointer-events-none">
                  {t('card_comp_frame', 'Frame')}
                </div>
              )}

              {/* Artwork / Image Overlay Area */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedComponent('image_overlay');
                }}
                onMouseEnter={(e) => {
                  e.stopPropagation();
                  setHoveredComponent('image_overlay');
                }}
                onMouseLeave={() => setHoveredComponent(null)}
                className={`aspect-[4/5] bg-gradient-to-b from-zinc-800 to-zinc-950 flex items-center justify-center relative overflow-hidden transition-all ${
                  selectedComponent === 'image_overlay'
                    ? 'ring-2 ring-inset ring-primary'
                    : hoveredComponent === 'image_overlay'
                      ? 'ring-1 ring-inset ring-white/30'
                      : ''
                }`}
              >
                {/* Mock Mod Artwork Graphic */}
                <div
                  className={`w-full h-full flex flex-col items-center justify-center relative transition-transform duration-200 ${
                    cardCustomization.imageOverlay.imageHoverZoom ? 'group-hover:scale-105' : ''
                  }`}
                >
                  <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-cyan-500/20 to-primary/30 flex items-center justify-center border border-primary/20 shadow-inner">
                    <span className="text-4xl select-none">🦈</span>
                  </div>
                  <span className="text-xs font-bold text-textMuted mt-3">Ellen Joe Mockup</span>
                </div>

                {/* Darkening Gradient Overlay */}
                <div
                  className="absolute inset-0 pointer-events-none transition-all"
                  style={{
                    background: `linear-gradient(to top, rgba(0,0,0,${
                      cardCustomization.imageOverlay.darkeningGradient / 100
                    }) 0%, rgba(0,0,0,${
                      (cardCustomization.imageOverlay.darkeningGradient * 0.4) / 100
                    }) 55%, transparent 100%)`,
                  }}
                />

                {/* Badges Container */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedComponent('badges');
                  }}
                  onMouseEnter={(e) => {
                    e.stopPropagation();
                    setHoveredComponent('badges');
                  }}
                  onMouseLeave={() => setHoveredComponent(null)}
                  className={`absolute top-2.5 left-2.5 right-2.5 flex justify-between items-start pointer-events-auto transition-all p-1 rounded-xl ${
                    selectedComponent === 'badges'
                      ? 'ring-2 ring-primary bg-primary/10'
                      : hoveredComponent === 'badges'
                        ? 'ring-1 ring-white/30'
                        : ''
                  }`}
                >
                  {/* Top-Left: Favorite Heart */}
                  {cardCustomization.badges.showFavoriteHeart ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsFavorite(!isFavorite);
                      }}
                      className={`p-2 rounded-full transition-all shadow-lg flex items-center justify-center cursor-pointer ${
                        isFavorite
                          ? 'bg-rose-500/80 border border-rose-500 text-white shadow-rose-500/30'
                          : getBadgeStyleClass()
                      }`}
                      title="Toggle favorite preview"
                    >
                      <Heart size={13} className={isFavorite ? 'fill-current' : ''} />
                    </button>
                  ) : (
                    <div />
                  )}

                  {/* Top-Right: Size & Update Badges */}
                  <div className="flex flex-col items-end gap-1.5">
                    {cardCustomization.badges.showUpdateBadge && (
                      <span className="bg-amber-500/90 text-black text-[10px] px-2 py-0.5 rounded-full border border-amber-300 font-bold flex items-center gap-1 shadow-md">
                        <Sparkles size={10} /> Update
                      </span>
                    )}
                    {cardCustomization.badges.showSizeBadge && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wide shadow-md ${getBadgeStyleClass()}`}
                      >
                        42.8 MB
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons Area */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedComponent('action_buttons');
                  }}
                  onMouseEnter={(e) => {
                    e.stopPropagation();
                    setHoveredComponent('action_buttons');
                  }}
                  onMouseLeave={() => setHoveredComponent(null)}
                  className={`absolute bottom-2.5 left-2.5 right-2.5 flex justify-between items-center pointer-events-auto transition-all p-1 rounded-xl ${
                    selectedComponent === 'action_buttons'
                      ? 'ring-2 ring-primary bg-primary/10'
                      : hoveredComponent === 'action_buttons'
                        ? 'ring-1 ring-white/30'
                        : ''
                  }`}
                >
                  <div className="flex gap-1.5 items-center">
                    {cardCustomization.actionButtons.showFolderButton && (
                      <button className={getActionButtonClass()} title="Open Mod Folder">
                        <FolderOpen size={13} />
                      </button>
                    )}
                    {cardCustomization.actionButtons.show3dPreviewButton && (
                      <button className={getActionButtonClass()} title="3D Preview">
                        <Box size={13} />
                      </button>
                    )}
                  </div>

                  {cardCustomization.actionButtons.showOptionsMenuButton && (
                    <button className={getActionButtonClass()} title="Options Menu">
                      <MoreVertical size={13} />
                    </button>
                  )}
                </div>

                {/* Disabled Overlay Simulation */}
                {!previewActive && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center backdrop-blur-xs z-30 pointer-events-none">
                    <span className="text-red-400 font-black tracking-widest uppercase rotate-[-15deg] border-4 border-red-400/50 px-5 py-1.5 rounded-xl text-lg shadow-[0_0_30px_rgba(255,0,0,0.2)]">
                      Disabled
                    </span>
                  </div>
                )}
              </div>

              {/* Bottom Info Panel */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedComponent('info_panel');
                }}
                onMouseEnter={(e) => {
                  e.stopPropagation();
                  setHoveredComponent('info_panel');
                }}
                onMouseLeave={() => setHoveredComponent(null)}
                style={{
                  backgroundColor: `rgba(var(--bg-surface), ${cardCustomization.infoPanel.bgOpacity / 100})`,
                  backdropFilter: `blur(${cardCustomization.infoPanel.blurAmount}px)`,
                  WebkitBackdropFilter: `blur(${cardCustomization.infoPanel.blurAmount}px)`,
                }}
                className={`p-4 flex flex-col gap-3 relative z-20 border-t border-textMain/10 transition-all ${
                  selectedComponent === 'info_panel'
                    ? 'ring-2 ring-primary'
                    : hoveredComponent === 'info_panel'
                      ? 'ring-1 ring-white/30'
                      : ''
                }`}
              >
                <div>
                  <h3
                    className={`font-bold text-sm leading-tight line-clamp-1 transition-colors ${
                      cardCustomization.infoPanel.titleColor === 'primary'
                        ? 'text-primary'
                        : cardCustomization.infoPanel.titleColor === 'white'
                          ? 'text-white'
                          : 'text-textMain group-hover:text-primary'
                    }`}
                  >
                    Shark Skin Outfit
                  </h3>
                  {cardCustomization.infoPanel.showCategorySubtitle && (
                    <span className="text-[11px] font-semibold text-primary/80 block mt-0.5 truncate">
                      Victoria Housekeeping • Ellen Joe
                    </span>
                  )}
                </div>

                {/* Tags Simulation */}
                {cardCustomization.infoPanel.showTags && (
                  <div className="flex flex-wrap gap-1">
                    {['outfit', 'retexture'].map((tag) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/15 text-primary border border-primary/20"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Toggle Button Area */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedComponent('toggle_button');
                  }}
                  onMouseEnter={(e) => {
                    e.stopPropagation();
                    setHoveredComponent('toggle_button');
                  }}
                  onMouseLeave={() => setHoveredComponent(null)}
                  className={`pt-1 rounded-xl transition-all ${
                    selectedComponent === 'toggle_button'
                      ? 'ring-2 ring-primary p-1 bg-primary/10'
                      : hoveredComponent === 'toggle_button'
                        ? 'ring-1 ring-white/30'
                        : ''
                  }`}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewActive(!previewActive);
                    }}
                    className={`w-full font-bold transition-all duration-200 cursor-pointer ${getTogglePaddingClass()} ${getToggleRadiusClass()} ${
                      previewActive
                        ? 'bg-white/5 hover:bg-red-500/20 text-textMuted hover:text-red-400 border border-white/5 hover:border-red-500/30'
                        : `bg-primary text-white hover:bg-primary/80 ${
                            cardCustomization.toggleButton.glowEffect
                              ? 'shadow-lg shadow-primary/30'
                              : ''
                          }`
                    }`}
                  >
                    {previewActive
                      ? t('disable_mod', 'Disable Mod')
                      : t('enable_mod', 'Enable Mod')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Tailored Inspector Controls */}
        <div className="lg:col-span-7 glass-panel border border-textMain/5 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
          {/* Component Tabs Navigator */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-textMuted block mb-3">
              {t('card_select_component', 'Select Component to Customize')}
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {componentTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedComponent(tab.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    selectedComponent === tab.id
                      ? 'bg-primary text-white shadow-md shadow-primary/20'
                      : 'bg-white/5 hover:bg-white/10 text-textMuted hover:text-textMain'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span className="truncate">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Active Section Header & Reset */}
          <div className="flex items-center justify-between pb-4 border-b border-textMain/5">
            <div>
              <h3 className="text-lg font-black text-textMain tracking-tight">
                {componentTabs.find((t) => t.id === selectedComponent)?.label}
              </h3>
              <p className="text-xs text-textMuted mt-0.5">
                {selectedComponent === 'card_frame' &&
                  t(
                    'card_frame_desc',
                    'Adjust glass opacity, background blur, borders, and shadows for the entire card.'
                  )}
                {selectedComponent === 'image_overlay' &&
                  t('card_overlay_desc', 'Control image darkening gradient and hover zoom effect.')}
                {selectedComponent === 'action_buttons' &&
                  t(
                    'card_actions_desc',
                    'Choose which quick-access buttons appear and customize their visual style.'
                  )}
                {selectedComponent === 'badges' &&
                  t(
                    'card_badges_desc',
                    'Manage status indicators, favorite hearts, and update badges.'
                  )}
                {selectedComponent === 'info_panel' &&
                  t(
                    'card_info_panel_desc',
                    'Style the lower card panel containing the title, category, and tags.'
                  )}
                {selectedComponent === 'toggle_button' &&
                  t(
                    'card_toggle_desc',
                    'Style the primary activation toggle button. Cannot be hidden to guarantee usability.'
                  )}
              </p>
            </div>

            <button
              onClick={() => resetCardCustomization(selectedComponent)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-textMuted hover:text-textMain border border-white/5 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              title={t('card_reset_section', 'Reset this section')}
            >
              <RotateCcw size={12} />
              <span>{t('reset', 'Reset')}</span>
            </button>
          </div>

          {/* DYNAMIC INSPECTOR PANELS */}
          {/* 1. CARD FRAME */}
          {selectedComponent === 'card_frame' && (
            <div className="space-y-6">
              {/* Opacity Slider */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-bold text-textMuted">
                    {t('card_bg_opacity', 'Background Opacity')}
                  </label>
                  <span className="text-xs font-mono font-bold text-primary">
                    {cardCustomization.frame.bgOpacity}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={cardCustomization.frame.bgOpacity}
                  onChange={(e) => updateFrame({ bgOpacity: parseInt(e.target.value, 10) })}
                  className="w-full h-2 bg-background/50 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              {/* Blur Slider */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-bold text-textMuted">
                    {t('card_blur_amount', 'Frosted Glass Blur')}
                  </label>
                  <span className="text-xs font-mono font-bold text-primary">
                    {cardCustomization.frame.blurAmount}px
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="24"
                  value={cardCustomization.frame.blurAmount}
                  onChange={(e) => updateFrame({ blurAmount: parseInt(e.target.value, 10) })}
                  className="w-full h-2 bg-background/50 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              {/* Border Width */}
              <div>
                <label className="text-sm font-bold text-textMuted block mb-2">
                  {t('card_border_width', 'Border Width')}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: 0, label: t('none', 'None') },
                    { value: 1, label: '1px' },
                    { value: 2, label: '2px' },
                    { value: 3, label: '3px' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => updateFrame({ borderWidth: opt.value })}
                      className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        cardCustomization.frame.borderWidth === opt.value
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-white/5 hover:bg-white/10 text-textMuted hover:text-textMain'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Border Color */}
              <div>
                <label className="text-sm font-bold text-textMuted block mb-2">
                  {t('card_border_color', 'Border Accent')}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: 'default', label: t('border_subtle', 'Subtle') },
                    { value: 'primary', label: t('border_primary', 'Primary Accent') },
                    { value: 'white', label: t('border_white', 'White / Crisp') },
                    { value: 'none', label: t('none', 'Transparent') },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => updateFrame({ borderColor: opt.value as any })}
                      className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        cardCustomization.frame.borderColor === opt.value
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-white/5 hover:bg-white/10 text-textMuted hover:text-textMain'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Border Radius */}
              <div>
                <label className="text-sm font-bold text-textMuted block mb-2">
                  {t('card_border_radius', 'Corner Rounding')}
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[
                    { value: 'sm', label: 'Sm' },
                    { value: 'md', label: 'Md' },
                    { value: 'lg', label: 'Lg' },
                    { value: 'xl', label: 'XL' },
                    { value: '2xl', label: '2XL' },
                    { value: '3xl', label: '3XL' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => updateFrame({ borderRadius: opt.value as any })}
                      className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        cardCustomization.frame.borderRadius === opt.value
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-white/5 hover:bg-white/10 text-textMuted hover:text-textMain'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Shadow Depth */}
              <div>
                <label className="text-sm font-bold text-textMuted block mb-2">
                  {t('card_shadow_depth', 'Shadow Depth')}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: 'none', label: t('none', 'None') },
                    { value: 'subtle', label: t('shadow_subtle', 'Subtle') },
                    { value: 'medium', label: t('shadow_medium', 'Medium') },
                    { value: 'intense', label: t('shadow_intense', 'Glow') },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => updateFrame({ shadowIntensity: opt.value as any })}
                      className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        cardCustomization.frame.shadowIntensity === opt.value
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-white/5 hover:bg-white/10 text-textMuted hover:text-textMain'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 2. IMAGE OVERLAY */}
          {selectedComponent === 'image_overlay' && (
            <div className="space-y-6">
              {/* Darkening Gradient */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-bold text-textMuted">
                    {t('card_darkening_gradient', 'Darkening Gradient')}
                  </label>
                  <span className="text-xs font-mono font-bold text-primary">
                    {cardCustomization.imageOverlay.darkeningGradient}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={cardCustomization.imageOverlay.darkeningGradient}
                  onChange={(e) =>
                    updateOverlay({ darkeningGradient: parseInt(e.target.value, 10) })
                  }
                  className="w-full h-2 bg-background/50 rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <p className="text-xs text-textMuted mt-1.5">
                  {t(
                    'card_darkening_gradient_desc',
                    'Smooth bottom shadow to enhance readability of buttons and text.'
                  )}
                </p>
              </div>

              {/* Hover Zoom Toggle */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5">
                <div>
                  <span className="font-bold text-textMain block text-sm">
                    {t('card_hover_zoom', 'Artwork Hover Zoom')}
                  </span>
                  <span className="text-xs text-textMuted">
                    {t(
                      'card_hover_zoom_desc',
                      'Slightly enlarge mod thumbnail when hovered with the mouse.'
                    )}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateOverlay({
                      imageHoverZoom: !cardCustomization.imageOverlay.imageHoverZoom,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    cardCustomization.imageOverlay.imageHoverZoom ? 'bg-primary' : 'bg-white/10'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      cardCustomization.imageOverlay.imageHoverZoom
                        ? 'translate-x-6'
                        : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* 3. ACTION BUTTONS */}
          {selectedComponent === 'action_buttons' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-white/5 space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-textMuted block">
                  {t('card_button_visibility', 'Button Visibility')}
                </span>

                {/* Show Folder Button */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-surface text-textMuted">
                      <FolderOpen size={16} />
                    </div>
                    <div>
                      <span className="font-bold text-textMain text-sm block">
                        {t('card_show_folder_btn', 'Folder Quick-Open Button')}
                      </span>
                      <span className="text-xs text-textMuted">
                        {t(
                          'card_show_folder_btn_desc',
                          'Directly open the mod folder in Windows Explorer.'
                        )}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateActions({
                        showFolderButton: !cardCustomization.actionButtons.showFolderButton,
                      })
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                      cardCustomization.actionButtons.showFolderButton
                        ? 'bg-primary'
                        : 'bg-white/10'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        cardCustomization.actionButtons.showFolderButton
                          ? 'translate-x-6'
                          : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Show 3D Preview Button */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-surface text-purple-400">
                      <Box size={16} />
                    </div>
                    <div>
                      <span className="font-bold text-textMain text-sm block">
                        {t('card_show_3d_btn', '3D Model Viewer Button')}
                      </span>
                      <span className="text-xs text-textMuted">
                        {t(
                          'card_show_3d_btn_desc',
                          'Launch the embedded 3D viewer for 3DMigoto meshes.'
                        )}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateActions({
                        show3dPreviewButton: !cardCustomization.actionButtons.show3dPreviewButton,
                      })
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                      cardCustomization.actionButtons.show3dPreviewButton
                        ? 'bg-primary'
                        : 'bg-white/10'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        cardCustomization.actionButtons.show3dPreviewButton
                          ? 'translate-x-6'
                          : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Show Options Menu Button */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-surface text-textMuted">
                      <MoreVertical size={16} />
                    </div>
                    <div>
                      <span className="font-bold text-textMain text-sm block">
                        {t('card_show_options_btn', 'Card Options Menu (3-Dots)')}
                      </span>
                      <span className="text-xs text-textMuted">
                        {t(
                          'card_show_options_btn_desc',
                          'Context actions: rename, move, repair, backup, and delete.'
                        )}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateActions({
                        showOptionsMenuButton:
                          !cardCustomization.actionButtons.showOptionsMenuButton,
                      })
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                      cardCustomization.actionButtons.showOptionsMenuButton
                        ? 'bg-primary'
                        : 'bg-white/10'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        cardCustomization.actionButtons.showOptionsMenuButton
                          ? 'translate-x-6'
                          : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Button Style */}
              <div>
                <label className="text-sm font-bold text-textMuted block mb-2">
                  {t('card_btn_style', 'Button Background Style')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'glass', label: t('style_glass', 'Glass Pill') },
                    { value: 'solid', label: t('style_solid', 'Solid Surface') },
                    { value: 'transparent', label: t('style_transparent', 'Minimal Dark') },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => updateActions({ buttonStyle: opt.value as any })}
                      className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        cardCustomization.actionButtons.buttonStyle === opt.value
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-white/5 hover:bg-white/10 text-textMuted hover:text-textMain'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Button Icon Color */}
              <div>
                <label className="text-sm font-bold text-textMuted block mb-2">
                  {t('card_btn_icon_color', 'Icon Accent Color')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'default', label: t('color_default', 'Subtle Muted') },
                    { value: 'primary', label: t('color_primary', 'Primary Accent') },
                    { value: 'white', label: t('color_white', 'Pure White') },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => updateActions({ iconColor: opt.value as any })}
                      className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        cardCustomization.actionButtons.iconColor === opt.value
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-white/5 hover:bg-white/10 text-textMuted hover:text-textMain'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4. BADGES */}
          {selectedComponent === 'badges' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-white/5 space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-textMuted block">
                  {t('card_badge_visibility', 'Badge Visibility')}
                </span>

                {/* Show Favorite Heart */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-surface text-rose-400">
                      <Heart size={16} />
                    </div>
                    <div>
                      <span className="font-bold text-textMain text-sm block">
                        {t('card_show_favorite_badge', 'Favorite Heart Button')}
                      </span>
                      <span className="text-xs text-textMuted">
                        {t(
                          'card_show_favorite_badge_desc',
                          'Quick toggle to add or remove mod from favorites.'
                        )}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateBadges({
                        showFavoriteHeart: !cardCustomization.badges.showFavoriteHeart,
                      })
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                      cardCustomization.badges.showFavoriteHeart ? 'bg-primary' : 'bg-white/10'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        cardCustomization.badges.showFavoriteHeart
                          ? 'translate-x-6'
                          : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Show Size Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-surface text-textMuted">
                      <Maximize2 size={16} />
                    </div>
                    <div>
                      <span className="font-bold text-textMain text-sm block">
                        {t('card_show_size_badge', 'File Size Badge')}
                      </span>
                      <span className="text-xs text-textMuted">
                        {t(
                          'card_show_size_badge_desc',
                          'Shows disk size in MB/GB on the upper right.'
                        )}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateBadges({ showSizeBadge: !cardCustomization.badges.showSizeBadge })
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                      cardCustomization.badges.showSizeBadge ? 'bg-primary' : 'bg-white/10'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        cardCustomization.badges.showSizeBadge ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Show Update Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-surface text-amber-400">
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <span className="font-bold text-textMain text-sm block">
                        {t('card_show_update_badge', 'GameBanana Update Badge')}
                      </span>
                      <span className="text-xs text-textMuted">
                        {t(
                          'card_show_update_badge_desc',
                          'Alerts when newer mod files are available on GameBanana.'
                        )}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateBadges({ showUpdateBadge: !cardCustomization.badges.showUpdateBadge })
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                      cardCustomization.badges.showUpdateBadge ? 'bg-primary' : 'bg-white/10'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        cardCustomization.badges.showUpdateBadge ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Badge Style */}
              <div>
                <label className="text-sm font-bold text-textMuted block mb-2">
                  {t('card_badge_style', 'Badge Style')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'glass', label: t('style_glass', 'Glass Pill') },
                    { value: 'solid', label: t('style_solid', 'Solid Pill') },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => updateBadges({ badgeStyle: opt.value as any })}
                      className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        cardCustomization.badges.badgeStyle === opt.value
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-white/5 hover:bg-white/10 text-textMuted hover:text-textMain'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 5. INFO PANEL */}
          {selectedComponent === 'info_panel' && (
            <div className="space-y-6">
              {/* Opacity Slider */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-bold text-textMuted">
                    {t('card_info_opacity', 'Panel Background Opacity')}
                  </label>
                  <span className="text-xs font-mono font-bold text-primary">
                    {cardCustomization.infoPanel.bgOpacity}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={cardCustomization.infoPanel.bgOpacity}
                  onChange={(e) => updateInfoPanel({ bgOpacity: parseInt(e.target.value, 10) })}
                  className="w-full h-2 bg-background/50 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              {/* Blur Slider */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-bold text-textMuted">
                    {t('card_info_blur', 'Panel Frosted Blur')}
                  </label>
                  <span className="text-xs font-mono font-bold text-primary">
                    {cardCustomization.infoPanel.blurAmount}px
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={cardCustomization.infoPanel.blurAmount}
                  onChange={(e) => updateInfoPanel({ blurAmount: parseInt(e.target.value, 10) })}
                  className="w-full h-2 bg-background/50 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              {/* Title Color */}
              <div>
                <label className="text-sm font-bold text-textMuted block mb-2">
                  {t('card_title_color', 'Mod Title Color')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'default', label: t('color_default', 'Default White/Hover') },
                    { value: 'primary', label: t('color_primary', 'Primary Accent') },
                    { value: 'white', label: t('color_white', 'Pure White') },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => updateInfoPanel({ titleColor: opt.value as any })}
                      className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        cardCustomization.infoPanel.titleColor === opt.value
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-white/5 hover:bg-white/10 text-textMuted hover:text-textMain'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Show Category Subtitle */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5">
                <div>
                  <span className="font-bold text-textMain block text-sm">
                    {t('card_show_subtitle', 'Character & Category Subtitle')}
                  </span>
                  <span className="text-xs text-textMuted">
                    {t(
                      'card_show_subtitle_desc',
                      'Displays the character name or category under the mod title.'
                    )}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateInfoPanel({
                      showCategorySubtitle: !cardCustomization.infoPanel.showCategorySubtitle,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    cardCustomization.infoPanel.showCategorySubtitle ? 'bg-primary' : 'bg-white/10'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      cardCustomization.infoPanel.showCategorySubtitle
                        ? 'translate-x-6'
                        : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Show Tags */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5">
                <div>
                  <span className="font-bold text-textMain block text-sm">
                    {t('card_show_tags', 'Tag Badges')}
                  </span>
                  <span className="text-xs text-textMuted">
                    {t(
                      'card_show_tags_desc',
                      'Renders clickable tag chips (#outfit, #nsfw, etc.) inside the card.'
                    )}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateInfoPanel({
                      showTags: !cardCustomization.infoPanel.showTags,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    cardCustomization.infoPanel.showTags ? 'bg-primary' : 'bg-white/10'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      cardCustomization.infoPanel.showTags ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* 6. TOGGLE BUTTON */}
          {selectedComponent === 'toggle_button' && (
            <div className="space-y-6">
              {/* Mandatory Invariant Badge */}
              <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 flex items-start gap-3">
                <ShieldCheck size={20} className="text-primary shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-textMain block">
                    {t('card_toggle_locked_title', 'Permanent Essential Control')}
                  </span>
                  <p className="text-xs text-textMuted mt-0.5">
                    {t(
                      'card_toggle_locked_desc',
                      'The enable/disable action button cannot be hidden. This ensures that mods can always be toggled directly from the card.'
                    )}
                  </p>
                </div>
              </div>

              {/* Button Padding */}
              <div>
                <label className="text-sm font-bold text-textMuted block mb-2">
                  {t('card_toggle_size', 'Button Size & Padding')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'compact', label: t('size_compact', 'Compact') },
                    { value: 'normal', label: t('size_normal', 'Normal') },
                    { value: 'large', label: t('size_large', 'Large') },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => updateToggleButton({ buttonPadding: opt.value as any })}
                      className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        cardCustomization.toggleButton.buttonPadding === opt.value
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-white/5 hover:bg-white/10 text-textMuted hover:text-textMain'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Button Radius */}
              <div>
                <label className="text-sm font-bold text-textMuted block mb-2">
                  {t('card_toggle_radius', 'Corner Shape')}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { value: 'match', label: t('radius_match', 'Match Frame') },
                    { value: 'md', label: 'Medium' },
                    { value: 'lg', label: 'Large' },
                    { value: 'xl', label: 'Extra Lg' },
                    { value: 'full', label: 'Full Pill' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => updateToggleButton({ borderRadius: opt.value as any })}
                      className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        cardCustomization.toggleButton.borderRadius === opt.value
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-white/5 hover:bg-white/10 text-textMuted hover:text-textMain'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Glow Effect Toggle */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5">
                <div>
                  <span className="font-bold text-textMain block text-sm">
                    {t('card_toggle_glow', 'Active Glow Accent')}
                  </span>
                  <span className="text-xs text-textMuted">
                    {t(
                      'card_toggle_glow_desc',
                      'Soft colored drop-shadow when the mod is enabled.'
                    )}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateToggleButton({
                      glowEffect: !cardCustomization.toggleButton.glowEffect,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    cardCustomization.toggleButton.glowEffect ? 'bg-primary' : 'bg-white/10'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      cardCustomization.toggleButton.glowEffect ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
