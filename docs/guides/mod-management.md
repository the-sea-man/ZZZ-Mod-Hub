# Installing & Managing Mods

ZZZ Mod Hub organizes your mod library from installation to in-game toggling.

---

## Installing Mods

There are three ways to install mods into your library:

### Method A: Drag-and-Drop (Recommended)

Drag any `.zip`, `.7z`, or `.rar` archive directly from your browser or file manager and drop it anywhere inside the ZZZ Mod Hub window.

- The manager unpacks the archive in a temporary staging area without popping up console windows.
- It scans the `.ini` scripts for 3DMigoto buffer hashes (`ib`, `vb`).
- It routes the mod directly into the matching character folder (e.g. `Mods/Ellen/`) or into `Unassigned` if the hashes are unrecognized.

### Method B: Install Button in Toolbar

Click the **Install Mod** button (`+`) on the top toolbar:

- Select one or more mod archives from the file browser.
- The manager extracts and categorizes each mod in sequence.

### Method C: In-Manager Download from Discover

Browse mods directly in the **Discover** tab and click **Install**. The manager downloads, verifies, and installs the mod automatically.

---

## Enabling and Disabling Mods

### Single Mod Toggle

Click the toggle switch on any mod card.

- **Enabled:** The mod folder is in standard naming format (e.g. `Ellen Maid Dress`).
- **Disabled:** The manager renames the folder with a `DISABLED_` prefix (e.g. `DISABLED_Ellen Maid Dress`). 3DMigoto ignores folders with this prefix, disabling the mod in-game.
- **Hotkey Synchronization:** If the game is running, the manager automatically sends an `F10` keypress to reload 3DMigoto without requiring you to alt-tab and press it manually.

### Batch Operations

Hold `Ctrl` and click multiple mod cards, or use the **Select All** checkbox in the category header.

- A floating action bar appears at the bottom of the screen.
- You can **Enable All**, **Disable All**, **Move to Category**, or **Delete** selected mods in bulk.

### Emergency "Disable All" Button

If a broken mod crashes your game or causes visual glitches during combat:

1. Click the red **Disable All Mods** button in the top toolbar.
2. Every active mod across all categories will immediately receive the `DISABLED_` prefix.
3. An **Undo** button will appear in the toolbar notification.

::: warning Undoing Disable All
The Undo action restores your previous configuration only if no new mods were added or folders altered in the meantime.
:::

---

## Mod Card Features

Every card in the library offers quick-action tools:

- **Favorite (Star Icon):** Pin your favorite mods to the top of the category or filter by favorites using the filter chip.
- **Mod Notes:** Click the notes icon on the card to write custom reminders (such as hotkey combinations like `[F8] Toggle Jacket`, author notes, or recommended settings).
- **Custom Preview Image:** Right-click a card or open the card menu (`...`) and select **Change Preview Image** to assign your own screenshot.
- **Open in Explorer:** Jump straight to the physical mod folder on disk.
- **Rollback Badge:** If you modified or fixed a mod, a rollback badge appears allowing you to restore the pre-fix backup at any time.
