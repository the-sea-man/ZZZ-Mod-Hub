import { describe, it, expect } from 'vitest';
import { normalizeModPath, isModMatchingIdentifier } from '../modPath';

describe('modPath utilities', () => {
  describe('normalizeModPath', () => {
    it('normalizes backslashes, casing, and trims slashes', () => {
      expect(normalizeModPath('C:\\Games\\ZZZ\\Mods\\Anby\\Default\\')).toBe(
        'c:/games/zzz/mods/anby/default'
      );
    });

    it('strips DISABLED and DISABLED_ prefixes from path segments', () => {
      expect(normalizeModPath('C:\\Mods\\Characters\\DISABLED Jane\\DISABLED_Summer')).toBe(
        'c:/mods/characters/jane/summer'
      );
    });

    it('returns empty string for empty or null input', () => {
      expect(normalizeModPath('')).toBe('');
    });
  });

  describe('isModMatchingIdentifier', () => {
    const modsRoot = 'C:/Games/ZZZ/Mods';

    it('matches identical normalized paths', () => {
      expect(
        isModMatchingIdentifier(
          'C:/Games/ZZZ/Mods/Characters/Jane/OutfitA',
          'characters/jane/outfita',
          modsRoot
        )
      ).toBe(true);
    });

    it('prevents false positive collisions between different characters sharing generic folder names', () => {
      const anbyMod = 'C:/Games/ZZZ/Mods/Characters/Anby/Default';
      const janeConflictId = 'Characters/Jane/Default';

      // Anby mod must NOT match Jane's conflict identifier
      expect(isModMatchingIdentifier(anbyMod, janeConflictId, modsRoot)).toBe(false);
      expect(isModMatchingIdentifier(anbyMod, 'Jane/Default', modsRoot)).toBe(false);
    });

    it('correctly matches when folder is DISABLED', () => {
      const disabledJaneMod = 'C:/Games/ZZZ/Mods/Characters/Jane/DISABLED Default';
      const janeConflictId = 'Characters/Jane/Default';

      expect(isModMatchingIdentifier(disabledJaneMod, janeConflictId, modsRoot)).toBe(true);
    });

    it('matches when modsPath is omitted but relative path has specific character prefix', () => {
      const janeMod = 'C:/Games/ZZZ/Mods/Characters/Jane/Summer';
      expect(isModMatchingIdentifier(janeMod, 'Characters/Jane/Summer')).toBe(true);
      expect(isModMatchingIdentifier(janeMod, 'Jane/Summer')).toBe(true);
      expect(isModMatchingIdentifier(janeMod, 'Anby/Summer')).toBe(false);
    });

    it('does not match a single-segment generic folder against a nested character mod without root proof', () => {
      const janeMod = 'C:/Games/ZZZ/Mods/Characters/Jane/Default';
      // If an identifier is only 'Default' from some root mod, Jane's nested mod must not blindly match
      expect(isModMatchingIdentifier(janeMod, 'Default', modsRoot)).toBe(false);
    });
  });
});
