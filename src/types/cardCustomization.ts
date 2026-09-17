export type ModCardComponentId =
  'card_frame' | 'image_overlay' | 'action_buttons' | 'badges' | 'info_panel' | 'toggle_button';

export interface CardFrameConfig {
  bgOpacity: number; // 0 to 100
  blurAmount: number; // 0 to 24 px
  borderWidth: number; // 0 to 3 px
  borderColor: 'default' | 'primary' | 'white' | 'none';
  borderRadius: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  shadowIntensity: 'none' | 'subtle' | 'medium' | 'intense';
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
  showSizeBadge: boolean;
  showUpdateBadge: boolean;
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
    showSizeBadge: true,
    showUpdateBadge: true,
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
        showSizeBadge: false,
        showUpdateBadge: true,
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
        borderColor: 'primary',
        borderRadius: '2xl',
        shadowIntensity: 'intense',
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
        showSizeBadge: true,
        showUpdateBadge: true,
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
        showSizeBadge: true,
        showUpdateBadge: true,
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
