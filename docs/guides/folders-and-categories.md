# Categories & Custom Folders

ZZZ Mod Hub organizes mods into clean character categories while giving you full control over custom folder structures.

---

## The Category Sidebar

The left sidebar displays all available character entities in Zenless Zone Zero:

- **Badge Counts:** Shows how many mods are installed and how many are currently enabled for each character (e.g. `2 / 5`).
- **Health Indicators:** If a category contains mods with script errors or hash collisions, a small colored dot alerts you.
- **Unassigned Folder:** If a mod has missing hashes or unrecognizable components, it is safely routed here. You can manually inspect or assign it to any character.

---

## Custom Folder Manager

You are not locked into standard character names. If you prefer grouping by factions, NPCs, weapons, or custom folders (e.g. `UI Mods`, `Global Shaders`, `Music`):

1. Click the **Folder Manager** gear icon in the sidebar header.
2. The **Custom Folder Management** dialog opens:
   - **Create Folder:** Type a new category name and click **Add**.
   - **Rename Folder:** Update folder names without breaking mod associations.
   - **Delete Folder:** Remove unused category directories.
   - **Map to Character Entity:** Link your custom folder to an official character entity so auto-sorting and 3D previewing work directly.

### Protected System Folders

To protect your installation from accidental deletion or corruption, certain essential system folders are permanently protected:

- `Unassigned`
- `_Conflicts`
- `.staging`

::: tip Essential Folders Protection
The manager locks these folders against renaming or deletion, and ensures they are recreated automatically if missing.
:::

---

## Library Search & Filter System

At the top of the mod library, the filter bar helps you quickly find what you need:

- **Search All:** Type any term to search across mod titles, folder paths, and author notes.
- **Active Only:** Filters out all disabled mods.
- **Favorites Only:** Displays only starred mods.
- **Needs Fix:** Shows mods with fixable Blue File badges.
- **Has Backup:** Shows mods with active `.zmm-backup` directories available for rollback.
- **Tag Chips:** Filter by automatic content tags (`Outfit`, `UI`, `Weapon`, `IN GAME MENU`, `NSFW`).

::: info Customizing Filter Chips
If you find the filter chips too crowded, open **Settings > Mod Management** to hide or show specific filter chips based on your preference.
:::
