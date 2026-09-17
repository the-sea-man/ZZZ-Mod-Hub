import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';

export function ThemeProvider() {
  const {
    theme,
    primaryColor,
    appOpacity,
    sidebarOpacity,
    bgOpacity,
    blurAmount,
    uiScale,
    animationsEnabled,
    performanceProfile,
  } = useAppStore();

  const isLowPerf = performanceProfile === 'low';

  useEffect(() => {
    document.documentElement.className = theme === 'dark' ? '' : `theme-${theme}`;
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (primaryColor) {
      document.documentElement.style.setProperty('--color-primary', primaryColor);
    } else {
      document.documentElement.style.removeProperty('--color-primary');
    }
  }, [primaryColor, theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--app-opacity', (appOpacity / 100).toString());
    document.documentElement.style.setProperty(
      '--sidebar-opacity',
      (sidebarOpacity / 100).toString()
    );
    document.documentElement.style.setProperty('--bg-opacity-start', (bgOpacity / 100).toString());
    document.documentElement.style.setProperty(
      '--bg-opacity-end',
      ((bgOpacity + 20) / 100).toString()
    );
    // In low performance mode or zero blur, bypass backdrop-filter blur regardless of slider value.
    document.documentElement.style.setProperty(
      '--app-blur',
      isLowPerf || blurAmount === 0 ? '0px' : `${blurAmount}px`
    );
  }, [appOpacity, sidebarOpacity, bgOpacity, blurAmount, isLowPerf]);

  useEffect(() => {
    if (uiScale) {
      document.documentElement.style.fontSize = `${(uiScale / 100) * 16}px`;
      // Clear legacy CSS zoom property to prevent WebView2 layout distortion
      (document.documentElement.style as CSSStyleDeclaration & { zoom?: string }).zoom = '';
    }
    document.documentElement.setAttribute('data-no-motion', (!animationsEnabled).toString());
    // Apply low-perf CSS data attribute on startup and on change.
    document.documentElement.setAttribute('data-low-perf', isLowPerf ? 'true' : 'false');
    // Disable all backdrop blur shaders across panels and Tailwind classes when blur is 0 or low perf.
    document.documentElement.setAttribute(
      'data-no-blur',
      (blurAmount === 0 || isLowPerf).toString()
    );
  }, [uiScale, animationsEnabled, isLowPerf, blurAmount]);

  return null;
}
