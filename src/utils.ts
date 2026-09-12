export const getBaseSkinName = (char: any) => {
  if (!char.skins || char.skins.length === 0) return char.name;
  const baseSkin = char.skins.find((s: any) => s.is_base) || char.skins[0];
  return baseSkin ? `${char.name} - ${baseSkin.name}` : char.name;
};

export const isNsfwMod = (mod: any): boolean => {
  if (!mod) return false;
  if (mod._bHasContentRatings === true) return true;
  if (mod._bIsNsfw === true) return true;
  if (mod._sInitialVisibility === 'hide' || mod._sInitialVisibility === 'warn') return true;
  if (
    mod._aContentRatings &&
    Array.isArray(mod._aContentRatings) &&
    mod._aContentRatings.length > 0
  )
    return true;
  return false;
};

export * from './utils/modPath';
