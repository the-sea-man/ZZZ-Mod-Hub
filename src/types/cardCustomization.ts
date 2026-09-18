export type ModCardComponentId =
  'card_frame' | 'image_overlay' | 'action_buttons' | 'badges' | 'info_panel' | 'toggle_button';

export interface CardFrameConfig {
  bgOpacity: number; // 0 to 100
  blurAmount: number; // 0 to 24 px
  borderWidth: number; // 0 to 3 px
  borderColor: 'default' | 'primary' | 'element' | 'white' | 'none';
  borderRadius: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  shadowIntensity: 'none' | 'subtle' | 'medium' | 'intense';
  aspectRatio: 'portrait' | 'square' | 'wide';
  elementalGlow: boolean;
}

export interface CardImageOverlayConfig {
  darkeningGradient: number; // 0 to 100
  imageHoverZoom: boolean;
}

export interface CardActionButtonsConfig {
  showFolderButton: boolean;
  show3dPreviewButton: boolean;
  showOptionsMenuButton: boolean;
  buttonStyle: 'glass' | 'solid' | 'transparent';
  iconColor: 'default' | 'primary' | 'white';
}

export interface CardBadgesConfig {
  showFavoriteHeart: boolean;
  showLockBadge: boolean;
  showSizeBadge: boolean;
  showUpdateBadge: boolean;
  showWarningBadges: boolean;
  badgeStyle: 'glass' | 'solid';
}

export interface CardInfoPanelConfig {
  bgOpacity: number; // 0 to 100
  blurAmount: number; // 0 to 20 px
  titleColor: 'default' | 'primary' | 'white';
  showCategorySubtitle: boolean;
  showTags: boolean;
}

export interface CardToggleButtonConfig {
  buttonPadding: 'compact' | 'normal' | 'large';
  borderRadius: 'match' | 'md' | 'lg' | 'xl' | 'full';
  glowEffect: boolean;
}

export interface ModCardCustomization {
  version: 1;
  frame: CardFrameConfig;
  imageOverlay: CardImageOverlayConfig;
  actionButtons: CardActionButtonsConfig;
  badges: CardBadgesConfig;
  infoPanel: CardInfoPanelConfig;
  toggleButton: CardToggleButtonConfig;
}

export const DEFAULT_MOD_CARD_CUSTOMIZATION: ModCardCustomization = {
  version: 1,
  frame: {
    bgOpacity: 40,
    blurAmount: 12,
    borderWidth: 1,
    borderColor: 'default',
    borderRadius: '2xl',
    shadowIntensity: 'medium',
    aspectRatio: 'portrait',
    elementalGlow: false,
  },
  imageOverlay: {
    darkeningGradient: 50,
    imageHoverZoom: true,
  },
  actionButtons: {
    showFolderButton: true,
    show3dPreviewButton: true,
    showOptionsMenuButton: true,
    buttonStyle: 'glass',
    iconColor: 'default',
  },
  badges: {
    showFavoriteHeart: true,
    showLockBadge: true,
    showSizeBadge: true,
    showUpdateBadge: true,
    showWarningBadges: true,
    badgeStyle: 'glass',
  },
  infoPanel: {
    bgOpacity: 90,
    blurAmount: 8,
    titleColor: 'default',
    showCategorySubtitle: true,
    showTags: true,
  },
  toggleButton: {
    buttonPadding: 'normal',
    borderRadius: 'xl',
    glowEffect: true,
  },
};

export interface CardPresetDefinition {
  id: string;
  name: string;
  description: string;
  config: ModCardCustomization;
}

export const CARD_PRESETS: Record<string, CardPresetDefinition> = {
  default: {
    id: 'default',
    name: 'Default Glass',
    description: 'Balanced frosted glass with smooth blur and standard buttons.',
    config: DEFAULT_MOD_CARD_CUSTOMIZATION,
  },
  minimal: {
    id: 'minimal',
    name: 'Minimalist Clean',
    description:
      'Clean look hiding floating buttons and secondary badges for maximum focus on artwork.',
    config: {
      version: 1,
      frame: {
        bgOpacity: 25,
        blurAmount: 8,
        borderWidth: 1,
        borderColor: 'default',
        borderRadius: 'xl',
        shadowIntensity: 'subtle',
        aspectRatio: 'portrait',
        elementalGlow: false,
      },
      imageOverlay: {
        darkeningGradient: 35,
        imageHoverZoom: true,
      },
      actionButtons: {
        showFolderButton: false,
        show3dPreviewButton: false,
        showOptionsMenuButton: true,
        buttonStyle: 'transparent',
        iconColor: 'default',
      },
      badges: {
        showFavoriteHeart: true,
        showLockBadge: false,
        showSizeBadge: false,
        showUpdateBadge: true,
        showWarningBadges: false,
        badgeStyle: 'glass',
      },
      infoPanel: {
        bgOpacity: 85,
        blurAmount: 6,
        titleColor: 'default',
        showCategorySubtitle: false,
        showTags: false,
      },
      toggleButton: {
        buttonPadding: 'compact',
        borderRadius: 'lg',
        glowEffect: false,
      },
    },
  },
  cyber: {
    id: 'cyber',
    name: 'Cyber Glow',
    description: 'Vibrant primary accents with neon border highlights and high darkening.',
    config: {
      version: 1,
      frame: {
        bgOpacity: 55,
        blurAmount: 16,
        borderWidth: 2,
        borderColor: 'element',
        borderRadius: '2xl',
        shadowIntensity: 'intense',
        aspectRatio: 'portrait',
        elementalGlow: true,
      },
      imageOverlay: {
        darkeningGradient: 65,
        imageHoverZoom: true,
      },
      actionButtons: {
        showFolderButton: true,
        show3dPreviewButton: true,
        showOptionsMenuButton: true,
        buttonStyle: 'glass',
        iconColor: 'primary',
      },
      badges: {
        showFavoriteHeart: true,
        showLockBadge: true,
        showSizeBadge: true,
        showUpdateBadge: true,
        showWarningBadges: true,
        badgeStyle: 'solid',
      },
      infoPanel: {
        bgOpacity: 95,
        blurAmount: 12,
        titleColor: 'primary',
        showCategorySubtitle: true,
        showTags: true,
      },
      toggleButton: {
        buttonPadding: 'large',
        borderRadius: 'full',
        glowEffect: true,
      },
    },
  },
  contrast: {
    id: 'contrast',
    name: 'OLED High Contrast',
    description:
      'Deep black opaque panels, crisp white borders, and zero blur for maximum readability.',
    config: {
      version: 1,
      frame: {
        bgOpacity: 95,
        blurAmount: 0,
        borderWidth: 2,
        borderColor: 'white',
        borderRadius: 'md',
        shadowIntensity: 'none',
        aspectRatio: 'portrait',
        elementalGlow: false,
      },
      imageOverlay: {
        darkeningGradient: 75,
        imageHoverZoom: false,
      },
      actionButtons: {
        showFolderButton: true,
        show3dPreviewButton: true,
        showOptionsMenuButton: true,
        buttonStyle: 'solid',
        iconColor: 'white',
      },
      badges: {
        showFavoriteHeart: true,
        showLockBadge: true,
        showSizeBadge: true,
        showUpdateBadge: true,
        showWarningBadges: true,
        badgeStyle: 'solid',
      },
      infoPanel: {
        bgOpacity: 100,
        blurAmount: 0,
        titleColor: 'white',
        showCategorySubtitle: true,
        showTags: true,
      },
      toggleButton: {
        buttonPadding: 'normal',
        borderRadius: 'md',
        glowEffect: false,
      },
    },
  },
};

/**
 * Returns Tailwind border-radius class corresponding to the config radius
 */
export function getBorderRadiusClass(
  radius: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full' | 'match'
): string {
  switch (radius) {
    case 'sm':
      return 'rounded-sm';
    case 'md':
      return 'rounded-md';
    case 'lg':
      return 'rounded-lg';
    case 'xl':
      return 'rounded-xl';
    case '2xl':
      return 'rounded-2xl';
    case '3xl':
      return 'rounded-3xl';
    case 'full':
      return 'rounded-full';
    case 'match':
    default:
      return 'rounded-2xl';
  }
}

/**
 * Returns Tailwind aspect-ratio class corresponding to the config aspect ratio
 */
export function getAspectRatioClass(aspectRatio?: 'portrait' | 'square' | 'wide' | string): string {
  switch (aspectRatio) {
    case 'square':
      return 'aspect-square';
    case 'wide':
      return 'aspect-[16/9]';
    case 'portrait':
    default:
      return 'aspect-[4/5]';
  }
}

/**
 * Elemental visual definition for Zenless Zone Zero character affinities
 */
export interface ElementalTheme {
  element: string;
  hex: string;
  rgb: string;
  borderClass: string;
  glowShadowClass: string;
  textColorClass: string;
  badgeBgClass: string;
}

/**
 * Resolves ZZZ element color palette (Ice, Fire, Electric, Physical, Ether)
 */
export function getElementalTheme(element?: string | null): ElementalTheme {
  const normalized = (element || '').trim().toLowerCase();
  switch (normalized) {
    case 'ice':
      return {
        element: 'Ice',
        hex: '#38bdf8',
        rgb: '56, 189, 248',
        borderClass: 'border-sky-400',
        glowShadowClass: 'shadow-lg shadow-sky-400/30',
        textColorClass: 'text-sky-400',
        badgeBgClass: 'bg-sky-500/20 text-sky-400 border-sky-400/40',
      };
    case 'fire':
      return {
        element: 'Fire',
        hex: '#fb923c',
        rgb: '251, 146, 60',
        borderClass: 'border-orange-400',
        glowShadowClass: 'shadow-lg shadow-orange-400/30',
        textColorClass: 'text-orange-400',
        badgeBgClass: 'bg-orange-500/20 text-orange-400 border-orange-400/40',
      };
    case 'electric':
      return {
        element: 'Electric',
        hex: '#a855f7',
        rgb: '168, 85, 247',
        borderClass: 'border-purple-400',
        glowShadowClass: 'shadow-lg shadow-purple-400/30',
        textColorClass: 'text-purple-400',
        badgeBgClass: 'bg-purple-500/20 text-purple-400 border-purple-400/40',
      };
    case 'physical':
      return {
        element: 'Physical',
        hex: '#facc15',
        rgb: '250, 204, 21',
        borderClass: 'border-amber-400',
        glowShadowClass: 'shadow-lg shadow-amber-400/30',
        textColorClass: 'text-amber-400',
        badgeBgClass: 'bg-amber-500/20 text-amber-400 border-amber-400/40',
      };
    case 'ether':
      return {
        element: 'Ether',
        hex: '#f472b6',
        rgb: '244, 114, 182',
        borderClass: 'border-pink-400',
        glowShadowClass: 'shadow-lg shadow-pink-400/30',
        textColorClass: 'text-pink-400',
        badgeBgClass: 'bg-pink-500/20 text-pink-400 border-pink-400/40',
      };
    default:
      return {
        element: 'Default',
        hex: '#eab308',
        rgb: '234, 179, 8',
        borderClass: 'border-primary',
        glowShadowClass: 'shadow-lg shadow-primary/30',
        textColorClass: 'text-primary',
        badgeBgClass: 'bg-primary/20 text-primary border-primary/40',
      };
  }
}

/**
 * Defensively validates, normalizes, and clamps an imported or parsed card theme object.
 * Deeply populates missing fields from DEFAULT_MOD_CARD_CUSTOMIZATION to prevent white-screen crashes.
 */
export function validateAndNormalizeCardTheme(raw: unknown): ModCardCustomization | null {
  if (!raw) return null;
  let obj: any = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw.trim());
    } catch {
      return null;
    }
  }
  if (typeof obj !== 'object' || obj === null) return null;

  const clamp = (val: any, min: number, max: number, fallback: number): number => {
    if (typeof val !== 'number' || isNaN(val)) return fallback;
    return Math.max(min, Math.min(max, Math.round(val)));
  };
  const bool = (val: any, fallback: boolean): boolean =>
    typeof val === 'boolean' ? val : fallback;
  const oneOf = <T extends string>(val: any, allowed: readonly T[], fallback: T): T =>
    allowed.includes(val) ? val : fallback;

  const d = DEFAULT_MOD_CARD_CUSTOMIZATION;
  const f = obj.frame || {};
  const o = obj.imageOverlay || {};
  const a = obj.actionButtons || {};
  const b = obj.badges || {};
  const i = obj.infoPanel || {};
  const t = obj.toggleButton || {};

  return {
    version: 1,
    frame: {
      bgOpacity: clamp(f.bgOpacity, 0, 100, d.frame.bgOpacity),
      blurAmount: clamp(f.blurAmount, 0, 24, d.frame.blurAmount),
      borderWidth: clamp(f.borderWidth, 0, 3, d.frame.borderWidth),
      borderColor: oneOf(
        f.borderColor,
        ['default', 'primary', 'element', 'white', 'none'] as const,
        d.frame.borderColor
      ),
      borderRadius: oneOf(
        f.borderRadius,
        ['sm', 'md', 'lg', 'xl', '2xl', '3xl'] as const,
        d.frame.borderRadius
      ),
      shadowIntensity: oneOf(
        f.shadowIntensity,
        ['none', 'subtle', 'medium', 'intense'] as const,
        d.frame.shadowIntensity
      ),
      aspectRatio: oneOf(
        f.aspectRatio,
        ['portrait', 'square', 'wide'] as const,
        d.frame.aspectRatio
      ),
      elementalGlow: bool(f.elementalGlow, d.frame.elementalGlow),
    },
    imageOverlay: {
      darkeningGradient: clamp(o.darkeningGradient, 0, 100, d.imageOverlay.darkeningGradient),
      imageHoverZoom: bool(o.imageHoverZoom, d.imageOverlay.imageHoverZoom),
    },
    actionButtons: {
      showFolderButton: bool(a.showFolderButton, d.actionButtons.showFolderButton),
      show3dPreviewButton: bool(a.show3dPreviewButton, d.actionButtons.show3dPreviewButton),
      showOptionsMenuButton: bool(a.showOptionsMenuButton, d.actionButtons.showOptionsMenuButton),
      buttonStyle: oneOf(
        a.buttonStyle,
        ['glass', 'solid', 'transparent'] as const,
        d.actionButtons.buttonStyle
      ),
      iconColor: oneOf(
        a.iconColor,
        ['default', 'primary', 'white'] as const,
        d.actionButtons.iconColor
      ),
    },
    badges: {
      showFavoriteHeart: bool(b.showFavoriteHeart, d.badges.showFavoriteHeart),
      showLockBadge: bool(b.showLockBadge, d.badges.showLockBadge),
      showSizeBadge: bool(b.showSizeBadge, d.badges.showSizeBadge),
      showUpdateBadge: bool(b.showUpdateBadge, d.badges.showUpdateBadge),
      showWarningBadges: bool(b.showWarningBadges, d.badges.showWarningBadges),
      badgeStyle: oneOf(b.badgeStyle, ['glass', 'solid'] as const, d.badges.badgeStyle),
    },
    infoPanel: {
      bgOpacity: clamp(i.bgOpacity, 0, 100, d.infoPanel.bgOpacity),
      blurAmount: clamp(i.blurAmount, 0, 20, d.infoPanel.blurAmount),
      titleColor: oneOf(
        i.titleColor,
        ['default', 'primary', 'white'] as const,
        d.infoPanel.titleColor
      ),
      showCategorySubtitle: bool(i.showCategorySubtitle, d.infoPanel.showCategorySubtitle),
      showTags: bool(i.showTags, d.infoPanel.showTags),
    },
    toggleButton: {
      buttonPadding: oneOf(
        t.buttonPadding,
        ['compact', 'normal', 'large'] as const,
        d.toggleButton.buttonPadding
      ),
      borderRadius: oneOf(
        t.borderRadius,
        ['match', 'md', 'lg', 'xl', 'full'] as const,
        d.toggleButton.borderRadius
      ),
      glowEffect: bool(t.glowEffect, d.toggleButton.glowEffect),
    },
  };
}
