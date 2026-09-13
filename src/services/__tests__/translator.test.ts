import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  detectSystemLanguage,
  maskVariables,
  unmaskVariables,
  parseIndexedResponse,
  translateBatch,
} from '../translator';

describe('translator service', () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
    });
    vi.restoreAllMocks();
  });

  describe('detectSystemLanguage', () => {
    function mockNavigatorLanguage(lang: string) {
      Object.defineProperty(globalThis, 'navigator', {
        value: { language: lang },
        writable: true,
      });
    }

    it('detects Portuguese (Brazil) as built-in pt_BR', () => {
      mockNavigatorLanguage('pt-BR');
      const res = detectSystemLanguage();
      expect(res.matchedCode).toBe('pt_BR');
      expect(res.isBuiltin).toBe(true);
    });

    it('detects Traditional Chinese as built-in zh_TW', () => {
      mockNavigatorLanguage('zh-TW');
      const res = detectSystemLanguage();
      expect(res.matchedCode).toBe('zh_TW');
      expect(res.isBuiltin).toBe(true);
    });

    it('detects Simplified Chinese as built-in zh', () => {
      mockNavigatorLanguage('zh-CN');
      const res = detectSystemLanguage();
      expect(res.matchedCode).toBe('zh');
      expect(res.isBuiltin).toBe(true);
    });

    it('detects Japanese as built-in ja', () => {
      mockNavigatorLanguage('ja-JP');
      const res = detectSystemLanguage();
      expect(res.matchedCode).toBe('ja');
      expect(res.isBuiltin).toBe(true);
    });

    it('detects French as community language fr', () => {
      mockNavigatorLanguage('fr-FR');
      const res = detectSystemLanguage();
      expect(res.matchedCode).toBe('fr');
      expect(res.isBuiltin).toBe(false);
      expect(res.displayName).toBe('Français');
    });

    it('detects German as community language de', () => {
      mockNavigatorLanguage('de-DE');
      const res = detectSystemLanguage();
      expect(res.matchedCode).toBe('de');
      expect(res.isBuiltin).toBe(false);
      expect(res.displayName).toBe('Deutsch');
    });
  });

  describe('variable masking and restoring', () => {
    it('masks and unmasks double bracket {{variables}} without corruption', () => {
      const texts = ['Hello {{name}}, you have {{count}} mods ready!'];
      const { maskedTexts, varMaps } = maskVariables(texts);

      expect(maskedTexts[0]).toContain('___V0___');
      expect(maskedTexts[0]).toContain('___V1___');

      // Simulate a translation that shifts words around
      const fakeTranslated = 'Bonjour ___V0___, vos ___V1___ mods sont prêts !';
      const restored = unmaskVariables(fakeTranslated, varMaps[0]);

      expect(restored).toBe('Bonjour {{name}}, vos {{count}} mods sont prêts !');
    });

    it('masks and unmasks single bracket {variables}', () => {
      const texts = ['Select {char} to continue'];
      const { maskedTexts, varMaps } = maskVariables(texts);

      expect(maskedTexts[0]).toContain('___V0___');
      const fakeTranslated = 'Wählen Sie ___V0___ zum Fortfahren';
      const restored = unmaskVariables(fakeTranslated, varMaps[0]);

      expect(restored).toBe('Wählen Sie {char} zum Fortfahren');
    });
  });

  describe('parseIndexedResponse', () => {
    it('parses indexed delimiter blocks accurately regardless of newlines', () => {
      const raw = `
<<<INDEX_0>>> First message line 1
line 2
<<<INDEX_1>>> Second message
<<<INDEX_2>>> Third message
`;
      const { results, matchedCount } = parseIndexedResponse(raw, 3);
      expect(matchedCount).toBe(3);
      expect(results[0]).toBe('First message line 1\nline 2');
      expect(results[1]).toBe('Second message');
      expect(results[2]).toBe('Third message');
    });

    it('safely handles missing indices', () => {
      const raw = `<<<INDEX_0>>> Only one message`;
      const { results, matchedCount } = parseIndexedResponse(raw, 2);
      expect(matchedCount).toBe(1);
      expect(results[0]).toBe('Only one message');
      expect(results[1]).toBe('');
    });
  });

  describe('translateBatch', () => {
    it('returns empty array when given empty input', async () => {
      const res = await translateBatch([], 'fr');
      expect(res).toEqual([]);
    });

    it('sends encoded query and unmasks returned translation', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [[['<<<INDEX_0>>> Bonjour ___V0___ !\n<<<INDEX_1>>> Enregistrer']]],
      });
      globalThis.fetch = mockFetch;

      const input = ['Hello {{user}}!', 'Save'];
      const res = await translateBatch(input, 'fr');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(res[0]).toBe('Bonjour {{user}} !');
      expect(res[1]).toBe('Enregistrer');
    });
  });
});
