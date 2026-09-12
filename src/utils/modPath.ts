/**
 * Normalizes a mod path for robust, cross-platform comparison:
 * - Replaces backslashes with forward slashes
 * - Trims leading and trailing slashes
 * - Strips `DISABLED ` or `DISABLED_` prefixes from every segment
 * - Converts to lowercase for Windows case-insensitive filesystem matching
 */
export function normalizeModPath(pathStr: string): string {
  if (!pathStr) return '';
  return pathStr
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .map((seg) => seg.replace(/^(DISABLED_|DISABLED )/i, ''))
    .join('/')
    .toLowerCase();
}

/**
 * Checks if a mod's full path matches a conflict or warning identifier.
 * Avoids false positive collisions where different characters share generic folder names (e.g. Anby/Default vs Jane/Default).
 *
 * @param modFullPath Absolute or relative path of the mod being evaluated
 * @param modIdentifier Conflict mod identifier from backend scanner (e.g. "Playable Characters/Jane/Default" or "Jane/Default")
 * @param modsPath Optional root mods directory
 */
export function isModMatchingIdentifier(
  modFullPath: string,
  modIdentifier: string,
  modsPath?: string
): boolean {
  if (!modFullPath || !modIdentifier) return false;

  const normFull = normalizeModPath(modFullPath);
  const normId = normalizeModPath(modIdentifier);

  if (normFull === normId) return true;

  // If modsPath is provided, compute exact relative path from the root
  if (modsPath) {
    const normMods = normalizeModPath(modsPath);
    if (normFull.startsWith(normMods + '/')) {
      const relFromMods = normFull.slice(normMods.length + 1);
      if (relFromMods === normId) return true;
    }
  }

  // Fallback if modsPath is not provided or normFull does not start with modsPath:
  if (normFull.endsWith('/' + normId)) {
    const idSegments = normId.split('/').filter(Boolean);
    // If normId has multiple segments (e.g. "Anby/Default"), parent folder matches so it is safe
    if (idSegments.length >= 2) {
      return true;
    }

    // If normId has only 1 segment (e.g. root-level mod "Default"):
    const fullSegments = normFull.split('/').filter(Boolean);
    if (fullSegments.length <= 1) {
      return true;
    }

    if (modsPath) {
      const normMods = normalizeModPath(modsPath);
      if (normFull.startsWith(normMods + '/')) {
        const rel = normFull.slice(normMods.length + 1);
        return rel === normId;
      }
    }

    // Never allow a single generic segment to match a deeply nested mod without modsPath confirmation
    return false;
  }

  return false;
}
