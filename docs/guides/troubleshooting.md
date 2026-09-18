# Troubleshooting & FAQ

Common questions, warning badge explanations, and solutions for typical issues when modding Zenless Zone Zero.

---

## Warning Badge Reference

When inspecting cards or categories, you may see colored badges:

### 1. Blue Wrench Badge (Outdated Script / Patch Fix Available)

- **What it means:** The mod's `.ini` script has syntax bugs (such as missing texture definitions, missing conditions, or outdated vertex strides).
- **What to do:** Click the **Fix** button on the card. The manager automatically rewrites the script, remaps buffers if needed, and backs up your original files.

### 2. Yellow Shield Badge (Multi-Entity / Shared Base Hashes)

- **What it means:** The character has multiple skins in the game (for instance, Belle or Caesar) and some 3DMigoto buffer hashes are shared between versions.
- **What to do:** This is purely informational. No fix is needed unless you have two active mods installed that replace the exact same skin variant at the same time.

### 3. Red Hazard Badge (Hash Collision Conflict)

- **What it means:** Two or more active mods are trying to replace the exact same 3D mesh at the same time.
- **What to do:** In 3DMigoto, only one mod can override a given mesh at once. Disable one of the conflicting mods, or use the conflict resolver to choose which mod takes precedence.

---

## Frequently Asked Questions

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

### 4. A mod update broke my character. How do I go back?

- Click the **Rollback** badge on the mod card (or open the card's cog menu and click **Restore from Backup**).
- Select your backup and click **Restore Files**. The original pre-update files will be restored immediately.
