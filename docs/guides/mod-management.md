# Installing & managing mods

ZZZ Mod Hub organizes your mod library from installation to in-game toggling.

---

## Installing mods

There are three ways to install mods into your library:

### Method a: Drag-and-Drop (recommended)

Drag any `.zip`, `.7z`, or `.rar` archive directly from your browser or file manager and drop it anywhere inside the ZZZ Mod Hub window.

- The manager unpacks the archive in a temporary staging area without popping up console windows.
- It scans the `.ini` scripts for 3DMigoto buffer hashes (`ib`, `vb`).
- It routes the mod directly into the matching character folder (e.g. `Mods/Ellen/`) or into `Unassigned` if the hashes are unrecognized.

### Method b: install button in toolbar

Click the **Install Mod** button (`+`) on the top toolbar:

- Select one or more mod archives from the file browser.
- The manager extracts and categorizes each mod in sequence.

### Method c: in-manager download from Discover

Browse mods directly in the **Discover** tab and click **Install**. The manager downloads, verifies, and installs the mod automatically into the correct character folder.

### Method d: importing existing folders

If you have mod folders from another manager or an external backup drive, open **Settings > Game & Folders** and click **Import Mods**. You can choose to Copy or Move them with full hash verification. (See [Importing after setup](./installation-and-setup.md#_2-importing-after-setup-settings-menu) for a full video walkthrough).

---

## Auto-Sorting Unassigned mods

If a mod archive is missing clear naming or contains unusual subfolder structures, the manager places it safely into `Unassigned/`:

- Open the `Unassigned` category in the sidebar.
- Click **Auto-Sort**: the manager parses all `.ini` files inside every unassigned mod folder, checks 3DMigoto buffer hashes against the canonical character database, and moves each mod to its matching agent folder automatically.

<div class="guide-video-wrapper">
  <video controls playsinline class="guide-video" src="/videos/auto-sort.mp4"></video>
  <div class="guide-video-caption">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    <span><strong>Video walkthrough:</strong> Auto-sorting unassigned mods using buffer hashes</span>
  </div>
</div>

---

## Enabling and disabling mods

### Single mod toggle

Click the toggle switch on any mod card.

- **Enabled:** The mod folder is in standard naming format (e.g. `Ellen Maid Dress`).
- **Disabled:** The manager renames the folder with a `DISABLED_` prefix (e.g. `DISABLED_Ellen Maid Dress`). 3DMigoto ignores folders with this prefix, disabling the mod in-game.
- **In-Game Reload:** While playing the game, press <kbd>F10</kbd> on your keyboard to reload 3DMigoto and display your updated mods.

### Batch operations & Shift multi-selection

When managing dozens of mods, use the batch selection system:

- **Single Selection:** Click the selection checkbox on any mod card.
- **Range Selection with Shift:** Click the first mod's checkbox, hold <kbd>Shift</kbd>, and click another mod. The manager instantly selects every mod in between!
- **Select All:** Click the checkbox in the category header toolbar to select all visible mods in that category.
- **Batch Actions Bar:** A floating toolbar appears at the bottom offering:
  - **Enable All:** Activates all selected mods simultaneously.
  - **Disable All:** Deactivates all selected mods simultaneously.
  - **Move to Category:** Moves selected mods to another character or custom folder.
  - **Add / Remove Tags:** Batch tag mods with custom labels.
  - **Delete:** Batch removes selected mods (with safety prompt).

<div class="guide-video-wrapper">
  <video controls playsinline class="guide-video" src="/videos/batch-actions.mp4"></video>
  <div class="guide-video-caption">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    <span><strong>Video walkthrough:</strong> Batch selecting mods with Shift-click and bulk operations</span>
  </div>
</div>

### Emergency "Disable all" button

If a broken mod crashes your game or causes visual glitches during combat:

1. Click the red **Disable All Mods** button in the top toolbar.
2. Every active mod across all categories will immediately receive the `DISABLED_` prefix.
3. An **Undo** button will appear in the toolbar notification.

::: warning Undoing Disable All
The Undo action restores your previous configuration only if no new mods were added or folders altered in the meantime.
:::

---

## Favorites, Locks, and the Randomizer

ZZZ Mod Hub includes a comprehensive outfit curation and randomization engine:

### 1. Starring favorites

Click the **Star icon** on any mod card to mark it as a favorite. Starred mods can be filtered in 1 click using the **Favorites** filter chip at the top of your library.

### 2. The lock system

Click the **Lock icon** on a mod card to lock its current state (active or disabled):

- **Protected from Accidental Toggles:** Locked mods are immune to bulk operations like "Disable All" or batch toggles.
- **Immune to Randomization & Presets:** When switching profiles or running the outfit randomizer, locked mods stay strictly in their designated state.

### 3. Randomizer & bias system

Click the **Randomizer** button (dice icon) in the character header to select a random active mod:

- **Randomizer Bias Slider:** In **Settings > Library**, you can adjust the **Favorite Bias Slider**. Setting a high bias gives starred favorite mods a significantly higher probability of being chosen, while still allowing occasional surprises from your broader collection.
- **Category Whitelist:** You can choose which specific character categories participate in random cycling so your main team's appearance is preserved.

<div class="guide-video-wrapper">
  <video controls playsinline class="guide-video" src="/videos/full-favorite-system.mp4"></video>
  <div class="guide-video-caption">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    <span><strong>Video walkthrough:</strong> Starred favorites, locking mods, and configuring the randomizer bias</span>
  </div>
</div>

---

## Automatic mod tagging

When you install or scan mods, the manager automatically inspects their files and assigns tags based on their contents:

- **`Outfit`**: Changes character outfits, clothing models, or complete skins.
- **`UI`**: Modifies user interface textures, icons, HUD elements, or custom banners.
- **`Weapon`**: Replaces character weapons, combat props, or gear meshes.
- **`IN GAME MENU`**: Mods equipped with interactive in-game menu support.
- **`NSFW`**: Content tagged with adult or explicit themes (respects your safety blur settings in **Settings > Downloads**).

You can filter your library by these tags using the search filter chips at the top of your library.

---

## Mod card features

Every card in the library offers quick-action tools:

- **Favorite (Star Icon):** Pin your favorite mods to the top of the category or filter by favorites using the filter chip.
- **Mod Notes:** Click the notes icon on the card to write custom reminders (such as hotkey combinations like `[F8] Toggle Jacket`, author notes, or recommended settings).
- **Custom Preview Image:** Right-click a card or open the card options menu (⚙️) and select **Change Preview Image** to assign your own screenshot.
- **Open in Explorer:** Jump straight to the physical mod folder on disk.
- **Rollback Badge:** If you modified or fixed a mod, a rollback badge appears allowing you to restore the pre-fix backup at any time.
