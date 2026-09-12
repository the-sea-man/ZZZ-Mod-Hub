import { EntityDBInfo, CharacterSkin } from "../types";

export interface HashOwner {
  character: EntityDBInfo;
  skin: CharacterSkin;
  componentName: string;
  field: string;
}

export const findHashOwner = (hash: string, characters: EntityDBInfo[]): HashOwner | null => {
  const target = hash.toLowerCase();

  for (const char of characters) {
    if (!char.skins) continue;
    
    for (const skin of char.skins) {
      if (!skin.components) continue;
      
      for (const [compName, comp] of Object.entries(skin.components)) {
        if (comp.draw_vb?.toLowerCase() === target) return { character: char, skin, componentName: compName, field: "draw_vb" };
        if (comp.position_vb?.toLowerCase() === target) return { character: char, skin, componentName: compName, field: "position_vb" };
        if (comp.blend_vb?.toLowerCase() === target) return { character: char, skin, componentName: compName, field: "blend_vb" };
        if (comp.texcoord_vb?.toLowerCase() === target) return { character: char, skin, componentName: compName, field: "texcoord_vb" };
        if (comp.ib?.toLowerCase() === target) return { character: char, skin, componentName: compName, field: "ib" };
        
        if (comp.textures) {
          for (const [texName, texHash] of Object.entries(comp.textures)) {
            if (texHash?.toLowerCase() === target) {
              return { character: char, skin, componentName: compName, field: `textures.${texName}` };
            }
          }
        }
      }
    }
  }

  return null;
};
