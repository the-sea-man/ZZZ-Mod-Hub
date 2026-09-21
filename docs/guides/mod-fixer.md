# Mod Fixer engine

When Zenless Zone Zero receives a game patch (e.g. from version 1.0 to 1.4, or 2.0 to 3.2), older character mods often break:

- Models appear yellow or orange in-game.
- Meshes stretch into the sky or deform during combat animations.
- The game crashes or fails to render the character model entirely.

Instead of waiting weeks for mod creators to manually re-upload their work, the **Native Mod Fixer** repairs these outdated mods automatically.

---

## Why mods break across game patches

Game updates alter internal Direct3D 11 rendering structures:

1. **Hash Lineage Shifts:** Character buffer hashes change with new animations and outfits.
2. **Byte Stride Changes:** The stride of vertex buffers shifts (for instance, vertex format changes from 32 bytes to 40 bytes to include new shader data).
3. **Submesh Match Index Misalignments:** The submesh draw call sequence (`match_first_index`) gets reorganized when developers add new clothing layers or physics bones.

---

## How to fix a mod

### Method 1: single mod fix

When a mod has an outdated structure, a **Blue File** badge appears on its card:

1. Click the yellow/blue **Upgrade** button on the card.
2. The **Mod Fixer Inspection Modal** opens:
   - Displays which game versions the mod is migrating from and to (e.g. `v1.0 -> v3.2`).
   - Details the hash remappings and buffer transformations that will be performed.
3. Click **Apply Fix**.
4. The manager creates a timestamped backup in `.zmm-backup/`, remaps the binary vertex buffers, synchronizes `.ini` strides, and recalculates submesh indices.
5. In-game, press **F10** to reload.

### Method 2: batch category fix

If multiple mods for a character are outdated after a major patch:

1. Navigate to that character's category in the sidebar.
2. Click the **1-Click Auto-Fix** button in the top toolbar.
3. The engine safely processes and backs up each mod in sequence.

---

## Warning badge taxonomy

ZZZ Mod Hub uses a 3-tier color system on mod cards so you always know what action is needed:

| Badge                                                 | Meaning                                   | Action Needed                                                                                                                                                                                                                                                                  |
| :---------------------------------------------------- | :---------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <span class="badge badge-blue">Blue File</span>       | **INI Script Fix Available**              | Strictly an `.ini` script update. Can usually be ignored safely, but in rare cases an unpatched `.ini` can break other mods' menus or cause FPS drops even when the character is not on screen. Click the **Upgrade** button to patch safely.                                  |
| <span class="badge badge-yellow">Yellow Person</span> | **Shared Entity / Multi-Skin**            | Informational. Mod belongs to a character with multiple skins or shared base hashes (e.g. Belle or Aria). No action needed unless conflicting with another active skin mod.                                                                                                    |
| <span class="badge badge-red">Red Shield</span>       | **Mesh Collision / Shared Hash Conflict** | Two active mods replace overlapping meshes or textures. You don't strictly have to resolve it—the game will still run without crashing, though visual glitches may appear. In some rare instances nothing will be apparent if both mods edit different textures or body parts. |

---

## Automatic backups guaranteed

Every time the Mod Fixer runs, it saves the untouched original files into a hidden `.zmm-backup` folder inside the mod directory. If a fix does not work as expected, you can restore your original files with 1 click.
