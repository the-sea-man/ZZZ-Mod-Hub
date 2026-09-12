import type {
  ModMeta,
  ModInfo,
  UpdateAvailable,
  CategoryInfo,
  KeybindInfo,
  InstallResult,
  ModWarning,
  KeybindConflict,
} from './types/ipc';

export type {
  ModMeta,
  ModInfo,
  UpdateAvailable,
  CategoryInfo,
  KeybindInfo,
  InstallResult,
  ModWarning,
  KeybindConflict,
};

export type EntityCategory =
  'playable_characters' | 'npcs' | 'bangboos' | 'weapons' | 'ui' | 'enemies';

export type ModSortMode = 'alpha_asc' | 'alpha_desc' | 'enabled_first' | 'disabled_first';

export const ENTITY_FOLDERS: Record<string, string> = {
  playable_characters: 'Playable Characters',
  npcs: 'NPCs',
  bangboos: 'Bangboos',
  weapons: 'Weapons',
  ui: 'UI',
  enemies: 'Enemies',
};

export const getActiveModsPath = (modsPath: string, activeTab: string): string => {
  if (!modsPath) return '';
  const folder = ENTITY_FOLDERS[activeTab] || 'Playable Characters';
  return modsPath.replace(/[\\/]$/, '') + '\\' + folder;
};

export interface ComponentTextures {
  Diffuse?: string;
  NormalMap?: string;
  LightMap?: string;
  MaterialMap?: string;
}

export interface HashComponent {
  draw_vb?: string;
  position_vb?: string;
  blend_vb?: string;
  texcoord_vb?: string;
  ib?: string;
  textures?: ComponentTextures;
}

export interface CharacterSkin {
  id: string;
  name: string;
  aliases: string[];
  image_url?: string;
  icon_url?: string;
  components?: Record<string, HashComponent>;
}

export interface EntityDBInfo {
  id: string;
  name: string;
  aliases: string[];
  entity_type?: EntityCategory;
  element?: string;
  faction: string;
  image_url: string;
  icon_url?: string;
  mindscape_url?: string;
  height?: string;
  height_cm?: number;
  role?: string;
  real_name?: string;
  gender?: string;
  birthday?: string;
  species?: string;
  model_type?: string;
  w_engine?: string;
  release_date?: string;
  base_skin_id?: string;
  skins?: CharacterSkin[];
}

export interface CategorySummary {
  categoryName: string;
  category: CategoryInfo;
  charInfo: EntityDBInfo | null;
  totalMods: number;
  activeModsCount: number;
  updateModsCount: number;
  hasActiveMods: boolean;
  hasInstalledMods: boolean;
  hasUpdates: boolean;
  searchHaystack: string;
}

/**
 * Strips DISABLED prefixes (e.g. 'DISABLED ', 'DISABLED_', 'DISABLE ')
 * to produce a canonical, stable mod name regardless of enable/disable state.
 */
export const getCleanModName = (name: string): string => {
  if (!name) return '';
  return name.replace(/^(?:DISABLED\s+|DISABLED_+|DISABLE\s+|DISABLE_+)/i, '').trim();
};

/**
 * Resolves a category folder name or category character_id to an EntityDBInfo record,
 * matching by exact id, name, aliases, or normalized token matches.
 */
export const resolveCategoryEntity = (
  categoryName: string,
  characterId?: string | null,
  entities: EntityDBInfo[] = []
): EntityDBInfo | null => {
  if (!entities || entities.length === 0) return null;

  // 1. Direct character_id match
  if (characterId) {
    const found = entities.find((c) => c.id.toLowerCase() === characterId.toLowerCase());
    if (found) return found;
  }

  if (!categoryName) return null;

  const normCat = categoryName
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
    .trim();
  const rawCatLower = categoryName.toLowerCase().trim();

  // 2. Exact match on character ID or clean ID
  for (const c of entities) {
    const normId = c.id
      .toLowerCase()
      .replace(/[\s_-]+/g, ' ')
      .trim();
    if (rawCatLower === c.id.toLowerCase() || normCat === normId) {
      return c;
    }
  }

  // 3. Exact match on character Name or Real Name
  for (const c of entities) {
    const normName = c.name
      .toLowerCase()
      .replace(/[\s_-]+/g, ' ')
      .trim();
    if (normCat === normName) {
      return c;
    }
    if (c.real_name) {
      const normReal = c.real_name
        .toLowerCase()
        .replace(/[\s_-]+/g, ' ')
        .trim();
      if (normCat === normReal) {
        return c;
      }
    }
  }

  // 4. Aliases exact match
  for (const c of entities) {
    if (c.aliases) {
      for (const a of c.aliases) {
        const normAlias = a
          .toLowerCase()
          .replace(/[\s_-]+/g, ' ')
          .trim();
        if (normCat === normAlias || rawCatLower === a.toLowerCase()) {
          return c;
        }
      }
    }
  }

  // 5. Token containment (e.g. folder "Ellen" matches "Ellen Joe", "Miyabi" matches "Hoshimi Miyabi")
  for (const c of entities) {
    const normName = c.name
      .toLowerCase()
      .replace(/[\s_-]+/g, ' ')
      .trim();
    const nameTokens = normName.split(' ');
    if (nameTokens.includes(normCat) || normCat.split(' ').includes(normName)) {
      return c;
    }
    // Also check aliases tokens
    if (c.aliases) {
      for (const a of c.aliases) {
        const normAlias = a
          .toLowerCase()
          .replace(/[\s_-]+/g, ' ')
          .trim();
        const aliasTokens = normAlias.split(' ');
        if (aliasTokens.includes(normCat)) {
          return c;
        }
      }
    }
  }

  return null;
};
