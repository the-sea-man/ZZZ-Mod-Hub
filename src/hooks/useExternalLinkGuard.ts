import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

/**
 * Stops any link click from navigating the application window.
 *
 * The app renders HTML it does not control: GameBanana mod descriptions and
 * changelogs, and language packs that players share as .json. Sanitizing that
 * HTML removes scripts but deliberately keeps `<a href>`. Inside a desktop
 * webview a plain anchor click replaces the *whole application* with that page,
 * which is how a changelog entry turns the mod manager into a browser pointed
 * at someone else's site.
 *
 * A single capture-phase listener covers every current and future render site,
 * so a new panel cannot forget to add its own handler. External links are
 * handed to the `open_url` command, which validates them before asking the OS
 * to open them in the real browser.
 */
export function useExternalLinkGuard(): void {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      // Let modified clicks and non-primary buttons alone.
      if (event.defaultPrevented || event.button !== 0) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      // In-app anchors (hash links, router-ish paths) keep working.
      const isExternal = /^(https?:)?\/\//i.test(href);
      if (!isExternal) {
        // Anything that is not a plain in-page anchor is still not allowed to
        // navigate the window - javascript:, data: and file: are refused.
        if (/^(javascript|data|file|vbscript):/i.test(href.trim())) {
          event.preventDefault();
        }
        return;
      }

      event.preventDefault();
      invoke('open_url', { url: anchor.href }).catch(() => {
        /* open_url rejects anything it does not trust; nothing to do here. */
      });
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
}
