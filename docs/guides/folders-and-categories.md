# Categories & custom folders

ZZZ Mod Hub organizes mods into clean character categories while giving you full control over custom folder structures.

---

## The category sidebar

The left sidebar displays all available character entities in Zenless Zone Zero:

- **Badge Counts:** Shows how many mods are installed and how many are currently enabled for each character (e.g. `2 / 5`).
- **Health Indicators:** If a category contains mods with script errors or hash collisions, a colored dot alerts you.
- **Generating Default Folders:** Clicking **Generate Character Folders** in setup or the folder manager populates your `Mods/` directory with clean canonical folders for every agent.

<div class="guide-video-wrapper">
  <video controls playsinline class="guide-video" src="/videos/sync-and-create-folders.mp4"></video>
  <div class="guide-video-caption">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    <span><strong>Video walkthrough:</strong> Generating clean character category folders</span>
  </div>
</div>

---

## The Unassigned folder & 1-click Auto-Sort

If an imported archive has non-standard naming, ambiguous author folders, or was placed loosely in your mods directory, it safely lands in `Unassigned/`:

- **Zero Guesswork:** Rather than guessing a character from the archive name, the manager keeps it in Unassigned until hashes are inspected.
- **1-Click Auto-Sort:** Open the `Unassigned` folder and click **Auto-Sort**. The manager parses the `.ini` files inside every unassigned mod, extracts 3DMigoto buffer hashes (`ib`, `vb`), compares them against the database, and automatically routes each mod into its matching character folder without modifying or corrupting any files.

<div class="guide-video-wrapper">
  <video controls playsinline class="guide-video" src="/videos/auto-sort.mp4"></video>
  <div class="guide-video-caption">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    <span><strong>Video walkthrough:</strong> Auto-sorting loose mods from Unassigned into character folders</span>
  </div>
</div>

::: tip Run Auto-Sort After Every Migration
Whenever you import mods from another mod manager or copy an existing mod library, any unrecognized or loose folders will appear here in `Unassigned/`. Simply click **Auto-Sort** to let the manager identify and distribute every mod to its correct character folder automatically based on buffer hashes.
:::

---

## Custom folder manager (status)

::: info Feature Currently Disabled
The **Custom Folder Manager** is currently disabled while the category engine undergoes improvements.

Currently, your mod library is organized strictly into official **character folders** (e.g. `Ellen`, `Jane Doe`, `Miyabi`) generated directly from the canonical database, alongside essential system folders. Arbitrary custom folder creation will return in a future update.
:::

### Protected system folders

To protect your installation from accidental deletion or corruption, certain essential system folders are permanently protected:

- `Unassigned` (holds unorganized or ambiguous mods pending hash auto-sort)
- `_Conflicts` (quarantines conflicting files)
- `.staging` (isolated temporary extraction workspace)

::: tip Essential Folders Protection
The manager locks these folders against renaming or deletion, and ensures they are recreated automatically if missing.
:::

---

## Library search & filter system

At the top of the mod library, the comprehensive filter and search toolbar helps you instantly locate and organize mods:

- **Active Only:** Hides all disabled mods to show what is currently live in-game.
- **Favorites Only:** Displays starred mods.
- **Needs Fix:** Shows mods with fixable Blue File badges.
- **Has Backup:** Shows mods with active `.zmm-backup` directories available for rollback.
- **Tag Chips:** Filter by automatic content tags (`Outfit`, `UI`, `Weapon`, `IN GAME MENU`, `NSFW`).

### Sidebar search vs "Search All Mods" toggle

Understanding the search scope toggle is crucial for efficient navigation:

1. **Standard Search (Sidebar Filter):** By default, typing in the search box filters the _character list in the left-hand sidebar_ so you can quickly jump to an agent (e.g. typing "Jane" highlights Jane Doe).
2. **Search All Mods Toggle:** When you click the **"Search All Mods"** toggle button next to the search input, the search mode switches to filter the _mod cards themselves_ across your entire library in the main grid view! This allows searching for specific mod names, authors, or outfit keywords regardless of which character category they belong to.

<div class="guide-video-wrapper">
  <video controls playsinline class="guide-video" src="/videos/using-filters.mp4"></video>
  <div class="guide-video-caption">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    <span><strong>Video walkthrough:</strong> Filtering mods and using the "Search All Mods" toggle</span>
  </div>
</div>

::: info Customizing Filter Chips
If you find the filter chips too crowded, open **Settings > Library** to hide or show specific filter chips based on your preference.
:::
