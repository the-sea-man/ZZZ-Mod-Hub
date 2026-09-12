import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { convertFileSrc } from '@tauri-apps/api/core';
import { appDataDir } from '@tauri-apps/api/path';
import { exists } from '@tauri-apps/plugin-fs';
import { useAppStore } from '../../store/useAppStore';
import { safeGetString } from '../../utils/storage';

export function BackgroundEngine() {
  const {
    theme,
    customBackground,
    bgOpacity,
    bgImageBlur,
    bgImageSaturation,
    bgImageBrightness,
    bgImageFit,
    blurAmount,
    lowPerformanceMode,
    performanceProfile,
  } = useAppStore();

  // Instant Frame-0 Pre-Hydration: Load pre-resolved local file URL without flashing default wallpaper
  const [bgUrl, setBgUrl] = useState(() =>
    safeGetString('cached_resolved_bg_url', '/app_background.jpg')
  );

  useEffect(() => {
    const resolveBg = async () => {
      if (!customBackground) {
        localStorage.setItem('cached_resolved_bg_url', '/app_background.jpg');
        setBgUrl('/app_background.jpg');
        return;
      }

      let finalPath = customBackground;

      // Expand %appdata%\com.zzzmodhub.app or similar
      if (
        finalPath.toLowerCase().includes('%appdata%\\com.zzzmodhub.app') ||
        finalPath.toLowerCase().includes('%appdata%/com.zzzmodhub.app')
      ) {
        try {
          const appData = await appDataDir();
          finalPath = finalPath.replace(/%appdata%[\\/]com\.zzzmodhub\.app/i, appData);
        } catch (e) {
          console.error('Failed to resolve appDataDir', e);
        }
      }

      try {
        const doesExist = await exists(finalPath);
        if (doesExist) {
          const resolvedSrc = convertFileSrc(finalPath);
          localStorage.setItem('cached_resolved_bg_url', resolvedSrc);
          setBgUrl(resolvedSrc);
        } else {
          localStorage.setItem('cached_resolved_bg_url', '/app_background.jpg');
          setBgUrl('/app_background.jpg');
        }
      } catch (e) {
        console.error('Failed to check background existence', e);
        setBgUrl('/app_background.jpg');
      }
    };

    resolveBg();
  }, [customBackground]);

  if (theme !== 'glass') return null;

  const isLowPerf = lowPerformanceMode || performanceProfile === 'low';
  const effectiveBgBlur = blurAmount === 0 || isLowPerf ? 0 : bgImageBlur;

  return createPortal(
    <div
      className="fixed inset-0 pointer-events-none transition-all duration-500"
      style={{
        backgroundImage: `linear-gradient(to bottom right, rgba(5, 5, 16, ${bgOpacity / 100}), rgba(10, 10, 26, ${(bgOpacity + 20) / 100})), url("${bgUrl}")`,
        backgroundSize: bgImageFit || 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        filter: `blur(${effectiveBgBlur}px) saturate(${bgImageSaturation}%) brightness(${bgImageBrightness}%)`,
      }}
    />,
    document.body
  );
}
