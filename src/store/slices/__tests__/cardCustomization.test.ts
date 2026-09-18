import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../useAppStore';
import {
  DEFAULT_MOD_CARD_CUSTOMIZATION,
  CARD_PRESETS,
  getBorderRadiusClass,
  getAspectRatioClass,
  getElementalTheme,
  validateAndNormalizeCardTheme,
} from '../../../types/cardCustomization';

describe('cardCustomization slice', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.getState().resetCardCustomization();
  });

  it('initializes with default mod card customization', () => {
    const config = useAppStore.getState().cardCustomization;
    expect(config).toBeDefined();
    expect(config.frame.bgOpacity).toBe(DEFAULT_MOD_CARD_CUSTOMIZATION.frame.bgOpacity);
    expect(config.frame.blurAmount).toBe(DEFAULT_MOD_CARD_CUSTOMIZATION.frame.blurAmount);
    expect(config.actionButtons.showFolderButton).toBe(true);
    expect(config.badges.showFavoriteHeart).toBe(true);
    expect(config.badges.showLockBadge).toBe(true);
    expect(config.badges.showWarningBadges).toBe(true);
    expect(config.infoPanel.showCategorySubtitle).toBe(true);
    expect(config.toggleButton.glowEffect).toBe(true);
  });

  it('updates partial frame properties without losing sibling fields', () => {
    useAppStore.getState().setCardCustomization({
      frame: {
        ...useAppStore.getState().cardCustomization.frame,
        bgOpacity: 85,
        blurAmount: 20,
        borderColor: 'primary',
      },
    });

    const updated = useAppStore.getState().cardCustomization;
    expect(updated.frame.bgOpacity).toBe(85);
    expect(updated.frame.blurAmount).toBe(20);
    expect(updated.frame.borderColor).toBe('primary');
    // Ensure untouched sibling fields and sections remain intact
    expect(updated.frame.borderRadius).toBe('2xl');
    expect(updated.imageOverlay.darkeningGradient).toBe(
      DEFAULT_MOD_CARD_CUSTOMIZATION.imageOverlay.darkeningGradient
    );
    expect(updated.actionButtons.showFolderButton).toBe(true);
  });

  it('updates button and badge visibility independently', () => {
    useAppStore.getState().setCardCustomization({
      actionButtons: {
        ...useAppStore.getState().cardCustomization.actionButtons,
        showFolderButton: false,
        show3dPreviewButton: false,
      },
      badges: {
        ...useAppStore.getState().cardCustomization.badges,
        showSizeBadge: false,
        badgeStyle: 'solid',
      },
    });

    const updated = useAppStore.getState().cardCustomization;
    expect(updated.actionButtons.showFolderButton).toBe(false);
    expect(updated.actionButtons.show3dPreviewButton).toBe(false);
    expect(updated.actionButtons.showOptionsMenuButton).toBe(true);
    expect(updated.badges.showSizeBadge).toBe(false);
    expect(updated.badges.showFavoriteHeart).toBe(true);
    expect(updated.badges.badgeStyle).toBe('solid');
  });

  it('applies curated presets correctly', () => {
    // Apply Minimal preset
    useAppStore.getState().applyCardPreset('minimal');
    let config = useAppStore.getState().cardCustomization;
    expect(config.frame.borderRadius).toBe(CARD_PRESETS.minimal.config.frame.borderRadius);
    expect(config.actionButtons.showFolderButton).toBe(false);
    expect(config.badges.showLockBadge).toBe(false);
    expect(config.badges.showWarningBadges).toBe(false);
    expect(config.infoPanel.showTags).toBe(false);

    // Apply Cyber Glow preset
    useAppStore.getState().applyCardPreset('cyber');
    config = useAppStore.getState().cardCustomization;
    expect(config.frame.borderColor).toBe('element');
    expect(config.frame.elementalGlow).toBe(true);
    expect(config.frame.shadowIntensity).toBe('intense');
    expect(config.infoPanel.titleColor).toBe('primary');

    // Apply OLED Contrast preset
    useAppStore.getState().applyCardPreset('contrast');
    config = useAppStore.getState().cardCustomization;
    expect(config.frame.blurAmount).toBe(0);
    expect(config.frame.borderColor).toBe('white');
  });

  it('resets a single component back to defaults while preserving other customized sections', () => {
    // Customize both frame and action buttons
    useAppStore.getState().setCardCustomization({
      frame: {
        ...useAppStore.getState().cardCustomization.frame,
        bgOpacity: 10,
        blurAmount: 0,
      },
      actionButtons: {
        ...useAppStore.getState().cardCustomization.actionButtons,
        showFolderButton: false,
        showOptionsMenuButton: false,
      },
    });

    expect(useAppStore.getState().cardCustomization.frame.bgOpacity).toBe(10);
    expect(useAppStore.getState().cardCustomization.actionButtons.showFolderButton).toBe(false);

    // Reset only frame
    useAppStore.getState().resetCardCustomization('card_frame');

    const config = useAppStore.getState().cardCustomization;
    expect(config.frame.bgOpacity).toBe(DEFAULT_MOD_CARD_CUSTOMIZATION.frame.bgOpacity);
    expect(config.frame.blurAmount).toBe(DEFAULT_MOD_CARD_CUSTOMIZATION.frame.blurAmount);
    // Action buttons modification should still be preserved
    expect(config.actionButtons.showFolderButton).toBe(false);
    expect(config.actionButtons.showOptionsMenuButton).toBe(false);
  });

  it('resets all components when componentId is not provided', () => {
    useAppStore.getState().applyCardPreset('cyber');
    expect(useAppStore.getState().cardCustomization.frame.borderColor).toBe('element');

    useAppStore.getState().resetCardCustomization();
    expect(useAppStore.getState().cardCustomization).toEqual(DEFAULT_MOD_CARD_CUSTOMIZATION);
  });

  it('getBorderRadiusClass returns expected tailwind classes', () => {
    expect(getBorderRadiusClass('sm')).toBe('rounded-sm');
    expect(getBorderRadiusClass('md')).toBe('rounded-md');
    expect(getBorderRadiusClass('lg')).toBe('rounded-lg');
    expect(getBorderRadiusClass('xl')).toBe('rounded-xl');
    expect(getBorderRadiusClass('2xl')).toBe('rounded-2xl');
    expect(getBorderRadiusClass('3xl')).toBe('rounded-3xl');
    expect(getBorderRadiusClass('full')).toBe('rounded-full');
    expect(getBorderRadiusClass('match')).toBe('rounded-2xl');
  });

  it('getAspectRatioClass returns correct aspect ratio classes', () => {
    expect(getAspectRatioClass('portrait')).toBe('aspect-[4/5]');
    expect(getAspectRatioClass('square')).toBe('aspect-square');
    expect(getAspectRatioClass('wide')).toBe('aspect-[16/9]');
    expect(getAspectRatioClass()).toBe('aspect-[4/5]');
  });

  it('getElementalTheme resolves colors for all ZZZ elements and default fallback', () => {
    const ice = getElementalTheme('Ice');
    expect(ice.element).toBe('Ice');
    expect(ice.hex).toBe('#38bdf8');
    expect(ice.borderClass).toBe('border-sky-400');

    const fire = getElementalTheme('Fire');
    expect(fire.element).toBe('Fire');
    expect(fire.hex).toBe('#fb923c');
    expect(fire.borderClass).toBe('border-orange-400');

    const electric = getElementalTheme('electric');
    expect(electric.element).toBe('Electric');
    expect(electric.hex).toBe('#a855f7');
    expect(electric.borderClass).toBe('border-purple-400');

    const physical = getElementalTheme('Physical');
    expect(physical.element).toBe('Physical');
    expect(physical.hex).toBe('#facc15');
    expect(physical.borderClass).toBe('border-amber-400');

    const ether = getElementalTheme('Ether');
    expect(ether.element).toBe('Ether');
    expect(ether.hex).toBe('#f472b6');
    expect(ether.borderClass).toBe('border-pink-400');

    const fallback = getElementalTheme(null);
    expect(fallback.element).toBe('Default');
    expect(fallback.borderClass).toBe('border-primary');
  });

  it('validateAndNormalizeCardTheme validates and defensively clamps configs', () => {
    // Valid object
    const valid = validateAndNormalizeCardTheme(DEFAULT_MOD_CARD_CUSTOMIZATION);
    expect(valid).toEqual(DEFAULT_MOD_CARD_CUSTOMIZATION);

    // Valid JSON string
    const fromJson = validateAndNormalizeCardTheme(
      JSON.stringify({
        frame: { bgOpacity: 50, blurAmount: 10, aspectRatio: 'wide', elementalGlow: true },
      })
    );
    expect(fromJson).not.toBeNull();
    expect(fromJson?.frame.bgOpacity).toBe(50);
    expect(fromJson?.frame.blurAmount).toBe(10);
    expect(fromJson?.frame.aspectRatio).toBe('wide');
    expect(fromJson?.frame.elementalGlow).toBe(true);
    // Missing fields should be populated from defaults
    expect(fromJson?.actionButtons.showFolderButton).toBe(true);
    expect(fromJson?.badges.showFavoriteHeart).toBe(true);

    // Clamping out-of-range numbers
    const clamped = validateAndNormalizeCardTheme({
      frame: { bgOpacity: 999, blurAmount: -50, borderWidth: 10 },
      imageOverlay: { darkeningGradient: -20 },
    });
    expect(clamped?.frame.bgOpacity).toBe(100);
    expect(clamped?.frame.blurAmount).toBe(0);
    expect(clamped?.frame.borderWidth).toBe(3);
    expect(clamped?.imageOverlay.darkeningGradient).toBe(0);

    // Invalid string or input
    expect(validateAndNormalizeCardTheme('not a valid json {')).toBeNull();
    expect(validateAndNormalizeCardTheme(null)).toBeNull();
    expect(validateAndNormalizeCardTheme(12345)).toBeNull();
  });
});
