# Troubleshooting & FAQ

Common questions, warning badge explanations, and solutions for typical issues when modding Zenless Zone Zero.

---

## Warning badge reference

When inspecting cards or categories, you may see colored badges:

### 1. Blue file badge (outdated script / patch fix available)

- **What it means:** Strictly an `.ini` script update. Can usually be ignored safely without visual issues, but in rare cases an unpatched `.ini` can break other mods' in-game menus or cause severe FPS drops even when the character is not on screen.
- **What to do:** Click the **Upgrade** button on the card. The manager automatically rewrites the script, remaps buffers if needed, and backs up your original files into `.zmm-backup/`.

### 2. Yellow person badge (multi-entity / shared base hashes)

- **What it means:** The character has multiple skins or shared base models in the game (for instance, Belle or Aria) where some 3DMigoto buffer hashes are shared between versions. (Not critical)
- **What to do:** This is purely informational. No action is needed unless you have two active mods installed that replace the exact same skin variant at the same time.

### 3. Red shield badge (mesh collision conflict)

- **What it means:** Two or more active mods are replacing overlapping 3D meshes or textures at the same time.
- **What to do:** You don't strictly have to resolve it—the game will still run without crashing, though visual glitches may appear. In some rare instances, nothing will even be apparent if both mods edit different textures or distinct body parts. For the cleanest visual results, disable one of the conflicting mods or use the conflict resolver.

---

## Frequently asked questions

### 1. My mod is enabled in the manager, but does not show in-game.

- **Is your loader running?** 3DMigoto or XXMI must be launched and running before or alongside Zenless Zone Zero.
- **Did you press F10?** While inside the game, press **F10** to reload 3DMigoto scripts and cache.
- **Is the mod in the right folder?** Make sure the mod folder isn't double-nested (e.g. `Mods/Ellen/Ellen Mod/Ellen Mod/...`).
- **Is the game graphics setting correct?** Ensure Character Detail is set to High in the in-game settings. Some low-poly settings bypass custom 3DMigoto meshes.

### 2. Can using mods get my Zenless Zone Zero account banned?

- **Safety Guidelines:** 3DMigoto operates purely on client-side rendering via DirectX 11 hooking; it does not modify game memory, character stats, or combat logic.
- **Disclaimer:** Modding any online game carries inherent risks and violates HoYoverse Terms of Service. Always use mods responsibly, avoid sharing in-game screenshots with your UID visible, and do not use mods in public multiplayer or competitive modes.

### 3. Windows file lock error when deleting or moving a mod.

- If Windows Explorer or 3DMigoto has an open handle on a `.buf` or `.dds` file, Windows may temporarily lock the file.
- Close the game or 3DMigoto, or click the **Retry** button on the error dialog.

### 4. A mod update broke my character. how do I go back?

- Click the **Rollback** badge on the mod card (or open the card's cog menu and click **Restore from Backup**).
- Select your backup and click **Restore Settings Backup**. The original pre-update files will be restored immediately.
