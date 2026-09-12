# ZZZ Mod Hub

[![CI](https://github.com/the-sea-man/ZZZ-Mod-Hub/actions/workflows/ci.yml/badge.svg)](https://github.com/the-sea-man/ZZZ-Mod-Hub/actions/workflows/ci.yml)

A desktop mod manager for **Zenless Zone Zero** and **3DMigoto / XXMI**.

Organize your mods, preview 3D models before launching the game, download directly from GameBanana, randomize your outfits, split composite packs, and fix broken mod scripts in one place.

> **Developer documentation:** Looking to contribute, inspect the architecture, or build from source? See [DEVELOPMENT.md](./DEVELOPMENT.md) and [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## Table of contents

1. [Initial setup and cloud database sync](#1-initial-setup-and-cloud-database-sync)
2. [Installing mods](#2-installing-mods)
3. [Auto-sorting and the unassigned resolver](#3-auto-sorting-and-the-unassigned-resolver)
4. [Library search, attribute filters, and filter customization](#4-library-search-attribute-filters-and-filter-customization)
5. [Toggling mods, batch mode, and tutorial prompts](#5-toggling-mods-batch-mode-and-tutorial-prompts)
6. [Auto-tagging and custom tags](#6-auto-tagging-and-custom-tags)
7. [Favorites, locking, and pinning](#7-favorites-locking-and-pinning)
8. [Mod randomizer and rules](#8-mod-randomizer-and-rules)
9. [Disable all and snapshot restore](#9-disable-all-and-snapshot-restore)
10. [In-manager 3D model viewer](#10-in-manager-3d-model-viewer)
11. [Mod splitter](#11-mod-splitter)
12. [Image editor and preview cropper](#12-image-editor-and-preview-cropper)
13. [In-game tools and hotkeys](#13-in-game-tools-and-hotkeys)
14. [Diagnostics, warning badges, and auto-fix](#14-diagnostics-warning-badges-and-auto-fix)
15. [Fixing outdated mods with the upgrade button](#15-fixing-outdated-mods-with-the-upgrade-button)
16. [GameBanana Discover, tabs, and update checking](#16-gamebanana-discover-tabs-and-update-checking)
17. [Achievements and feature discovery](#17-achievements-and-feature-discovery)
18. [Mod profiles and presets](#18-mod-profiles-and-presets)
19. [Performance profiles and manual low-power controls](#19-performance-profiles-and-manual-low-power-controls)
20. [Customization, audio settings, and custom languages](#20-customization-audio-settings-and-custom-languages)
21. [Configuration backup and restore](#21-configuration-backup-and-restore)
22. [Requirements and disclaimer](#22-requirements-and-disclaimer)

---

## 1. Initial setup and cloud database sync

### Configuring folder paths

1. Run `ZZZ.Mod.Hub_x64-setup.exe` to install and launch the app.
2. Click the **Settings** gear icon in the lower-left sidebar.
3. Under **Paths**, configure your folders:
   - **Mods folder**: Select the folder where your mods are kept.
     - For **XXMI Launcher**, this is usually `XXMI/Mods`.
     - For standalone **3DMigoto**, this is your `3DMigoto/Mods` folder.
   - **Game executable** (optional): Select your `ZenlessZoneZero.exe` path if you want to launch the game directly from the app top bar.
   - **7-Zip / WinRAR executable** (optional): If you plan to install `.rar` or `.7z` archives using the install button, you can specify your extraction tool path here.
4. If you already have mods installed on your drive, click the **Refresh** button in the sidebar (or press `Ctrl+R`) to scan your collection.

### Syncing with the cloud database

The manager maintains a remote database of Zenless Zone Zero character definitions, skin variants, and 3DMigoto buffer hashes.

- Whenever a new game patch drops, new characters release, or hashes change, click the **Sync Database** cloud icon in the top bar (or in Settings).
- The app updates your local character list and hash definitions directly from GitHub without needing to wait for a new app release.

---

## 2. Installing mods

You can add mods to your library using three different methods:

### Method A: Drag and drop (Recommended)

1. Download a mod archive (`.zip`, `.rar`, or `.7z`) or locate an uncompressed mod folder on your computer.
2. Drag the file directly into the app window.
3. The app inspects the 3D model buffer hashes inside the archive, creates the folder, and routes it directly to the matching character.
4. A confirmation dialog shows the target character and extraction status.

### Method B: Direct download from Discover

1. Click the **Discover** tab in the sidebar to open the integrated GameBanana feed.
2. Browse trending mods or use the search bar to find a specific character skin.
3. Click **Download** on any mod card.
4. The app downloads the file in chunks, handles mirror retries if a server fails, and installs the mod into your library automatically.

### Method C: Install Mod button

1. In the library toolbar, click the **Install Mod (Archive)** button.
2. A file selection dialog opens. Browse your computer and choose any `.zip`, `.rar`, or `.7z` archive.
3. The app extracts the archive, inspects its files, and sorts the mod into the matching character folder automatically.

---

## 3. Auto-sorting and the unassigned resolver

The app identifies characters by analyzing DirectX buffer hashes (`ib`, `vb`) inside mod `.ini` files rather than relying on folder names, preventing misrouted files.

### How auto-sorting works

- When you install a mod through drag-and-drop or the Install Mod button, the app matches internal model hashes against an official character database.
- If the hashes match a known agent (e.g. Ellen, Jane, Nicole), the mod is placed directly into that character folder.
- If a mod is ambiguous, contains multiple characters, or does not contain recognizable hashes (such as a generic UI mod), it is placed safely into the **Unassigned** category so no files are misplaced.

### Using the Auto-Sort button

1. If you have mods sitting in the **Unassigned** category or moved folders manually in Windows Explorer, click the **Auto-Sort** button in the library top bar or inside the Unassigned view.
2. The app re-evaluates all unassigned mods against updated database hashes.
3. A summary dialog displays each sorted mod, its destination character, and confidence score. Click **Apply** to confirm moving the folders.

---

## 4. Library search, attribute filters, and filter customization

Finding the exact mod you want in a large library is easy with cross-category search and attribute filtering.

### Global cross-category search

- Type any character name, mod title, author name, or keyword into the search bar at the top of the library.
- The app flattens all character categories into a single unified search view.
- Each card displays its origin character badge so you know exactly where it belongs. Clear the search bar to return to your normal character gallery view.

### Character attribute filters

Above the character list and mod gallery, you can filter by agent attributes:

- **Faction**: Victoria Housekeeping, Belobog Heavy Industries, Section 6, Cunning Hares, Sons of Calydon, etc.
- **Element**: Fire, Electric, Physical, Ice, Ether.
- **Specialty**: Attack, Stun, Anomaly, Support, Defense.
- **Category types**: Switch between Agents, Bangboos, NPCs, Enemies, UI/HUD, and Custom folders.

### Hiding filters in Settings

If you prefer a simpler interface without extra filter bars:

1. Open **Settings > Appearance / Library Filters**.
2. Toggle off the filters you do not use (e.g. hide element pills, faction groups, or category sub-headers).
3. The library adjusts to show only the search controls you care about.

---

## 5. Toggling mods, batch mode, and tutorial prompts

### Toggling individual mods

- Click the toggle switch on any mod card:
  - **Green switch (Active)**: The mod is enabled and loaded by 3DMigoto.
  - **Gray switch (Disabled)**: The mod is disabled (renamed with a `DISABLED_` prefix so 3DMigoto ignores it).
- If Zenless Zone Zero is currently running, the app automatically triggers a 3DMigoto reload (`F10`). You do not need to restart the game to see your changes.

### Interactive tutorial prompts (Two-click buttons)

- When you use certain key buttons for the very first time (such as Batch Mode, Install Mod, Randomize, or Splitter), clicking the button will display a quick interactive guide explaining what the tool does and how to use it safely.
- Simply click **Got it!** (or click the button a second time) to proceed.
- Once you have seen the guide once, the button works immediately on a single click without showing the prompt again.

### Using batch operations mode

To manage multiple mods across different characters at once:

1. Click the **Batch** button in the library top bar.
2. Checkboxes will appear on every mod card. Select the mods you want to adjust, or click **Select all**.
3. Use the floating batch toolbar at the bottom of the screen to perform bulk actions:
   - **Enable all**: Enables every selected mod.
   - **Disable all**: Disables every selected mod.
   - **Move to category**: Moves all selected mods to a different character folder.
   - **Delete**: Sends selected mod folders directly to the Windows Recycle Bin.
4. Click **Exit batch mode** when you are done.

---

## 6. Auto-tagging and custom tags

Tags help you filter and categorize large libraries by outfit type, content, or style.

### Using auto-tagging

1. Click the mod config button (the **cog icon** in the bottom-right of any mod card) and select **Edit tags** (or click the tag icon on the card).
2. In the Tag Editor, click the **Auto-detect tags** button (sparkles icon).
3. The app inspects the mod files (textures, shaders, key conditions, audio assets, and meshes) and automatically assigns matching tags:
   - `Outfit`: Full character replacement meshes.
   - `Recolor`: Texture replacements (`.dds`) without new geometry.
   - `Weapon`: Replaces or modifies character weapons.
   - `In-Game Menu`: Mod contains interactive toggle hotkeys.
   - `Hair` / `Face` / `Accessory`: Mod affects specific body components.
   - `Audio`: Mod contains custom `.pck`, `.bnk`, or `.wem` sound files.
4. Click **Save** to persist the tags.

### Adding custom tags and filtering

1. In the Tag Editor, type a custom name in the text field (e.g. `Casual`, `Combat`, `Cyberpunk`) and press Enter.
2. You can pick from suggestions already used in your library.
3. To filter by tag, click any tag pill in the filter bar above the gallery grid. You can select multiple tags simultaneously to narrow your search.

---

## 7. Favorites, locking, and pinning

Keep your most-used characters and mods organized, and control which mods are eligible for random rolls.

### Favoriting characters

- Click the star icon next to any character name in the left sidebar.
- Starred characters float to the top of the sidebar under a dedicated **Favorites** section.

### Favoriting mods

- Click the heart icon in the upper-left of any mod card to mark it as a favorite.
- Favorite mods are pinned to the top of that character's gallery grid so you do not have to scroll through dozens of skins to find them.
- Favorite mods also receive higher selection weight when using the **Mod randomizer**.

### Locking mods from the randomizer

- Next to the favorite heart, click the **Lock / Unlock** icon in the upper-left of a mod card.
- **Locked**: The mod will never be touched or altered by randomizer rolls.
- **Unlocked**: The mod is included in the randomizer pool.

---

## 8. Mod randomizer and rules

The randomizer selects random mod combinations across your characters so every game session looks different.

### Setting up randomizer rules

Before using the randomizer, decide which characters should participate:

1. Open **Settings** and scroll down to **Randomizer rules**.
2. You will see two columns: **Do Not Randomize** and **Randomize**.
3. Move characters between columns using the arrow buttons:
   - Only characters in the **Randomize** column will have their mods changed.
   - Characters in the **Do Not Randomize** column remain on whatever mod you previously selected.
4. You can also click **Move all to randomize** or **Move all to do not randomize** for quick setup.

### Favorite weighting

- The randomizer is weighted by your favorites.
- Mods marked with a favorite heart have a higher probability of being chosen during a roll than unstarred mods.
- Mods with a **Lock** icon are excluded from being replaced.

### Rolling the randomizer

- Click the **Randomize** button in the library top bar (or press `Ctrl+Shift+R`).
- The app rolls a random mod for each enabled character in your pool, turns on the winning mod, and turns off the others.

---

## 9. Disable all and snapshot restore

When testing game updates, isolating game crashes, or verifying vanilla gameplay:

### Disabling all mods

1. Click the **Disable all** button in the library top bar.
2. Every active mod across all characters will be disabled immediately.
3. The app records an internal snapshot of your exact active loadout right before disabling.

### Restoring your previous setup

1. After clicking Disable all, a notification banner appears at the top of the window: **Mods disabled. Restore previous state?**
2. Click **Restore state** to re-enable the exact mods that were active before.

> **Important:** The restore snapshot only works if you do not make other alterations in between. Toggling, installing, or modifying any mod after clicking Disable All will clear the restore point.

---

## 10. In-manager 3D model viewer

The app includes a built-in 3D renderer that parses raw DirectX binary buffers (`vb0`, `vb1`, `ib`) and textures directly from installed mod folders without starting the game.

### How to open the viewer

- On any mod card, click the **3D Preview** button (the purple 3D box icon in the lower-left of the thumbnail).
- Or click the mod config button (the **cog icon** in the bottom-right) and select **3D Preview**.

### Viewport navigation controls

- **Orbit / Rotate**: Click and drag with the Left Mouse Button.
- **Pan**: Click and drag with the Right Mouse Button (or hold Shift + Left Click).
- **Zoom**: Scroll the mouse wheel up and down.

### Camera presets

Click the camera angle buttons in the bottom toolbar to snap the view:

- **Front**: Centered head-on view.
- **Back**: Snaps directly behind the character.
- **Left**: Left profile angle.
- **Right**: Right profile angle.
- **Face**: Close-up framing on the character's face.
- **Reset**: Restores default camera position and zoom.

### Render modes and lighting

- **Render mode**: Switch between **Textured** (`diffuse`), **Normal maps** (surface bumps), **Matcap** (clay sculpt mode), and **Unlit** (flat color).
- **Lighting presets**: Choose between **Studio** (neutral white), **Warm**, **Cool**, or **High contrast**.
- **Wireframe mode**: Toggle the wireframe button to inspect 3D polygon topology and vertex density.
- **Turntable**: Click the turntable button to start continuous 360-degree rotation.

### Interactive toggle testing

If a mod contains in-game outfit toggles (such as removing a jacket or swapping glasses):

1. Open the **Toggles** tab in the side panel.
2. Adjust the toggle sliders or click variant buttons.
3. The 3D model updates in real time to show how each variation looks in-game.

### Potato mode (Low-end GPU optimization)

- If you are on an integrated GPU or older laptop, toggle the **Potato mode** switch in the viewer toolbar.
- This downscales texture resolutions and simplifies mesh decoding for fast, lag-free viewing.

### Texture recolor base borrowing

- If you open a texture-only recolor mod (`.dds`) that does not contain its own 3D model buffers, the viewer automatically searches your library for candidate base character models.
- It loads the base geometry and wraps the recolor texture on top so you can still preview recolors in 3D.

### Saving the 3D view as a preview

- Adjust your camera and lighting to your preferred angle.
- Click **Use as preview** in the upper toolbar.
- The viewer renders a snapshot and transfers it directly into the image cropper so you can save it as `preview.png`.

---

## 11. Mod splitter

The Mod Splitter decomposes complex mod archives into isolated, fully playable standalone folders.

### How to access the splitter

1. Turn on **Experimental tools** in **Settings > Experimental**.
2. On any mod card, click the **3D Preview / Advanced** button (the purple 3D box icon in the lower-left of the thumbnail).
3. The Advanced window will open. In the top navigation bar, click the **Mod Splitter** tab (scissors icon).

### The 3 splitting modes

Choose the mode that fits your mod:

1. **Split by Body Part (Upper Body, Lower Body, Hair, Weapon)**
   - Clusters model draw calls along anatomical boundaries while keeping vertex and index buffers 100% intact.
   - Guarantees zero missing limbs or invisible geometry.
   - Enables mixing and matching body parts across different mods (for example, wearing the sweater from Mod A with the pants from Mod B).

2. **Split by Accessory & Toggles (Hats, Props, Pieces)**
   - Extracts isolated accessories, glasses, chokers, hats, and toggleable clothing pieces into standalone folders.
   - Best for mods with many toggleable props.

3. **Split by Character (Multi-Character Pack)**
   - Slices multi-character archives (packs containing models for Ellen, Jane, and Nicole in one download) into separate standalone folders for each agent.

### Monolithic mesh protection

- Some mods are sculpted as a single unified mesh (`handling = skip`). Slicing internal submeshes on these models can result in missing limbs or invisible geometry.
- The splitter automatically scans for monolithic meshes:
  - If detected, an amber warning banner alerts you in submesh mode.
  - An emerald tip recommends switching to **Split by Body Part**, which safely extracts playable top and bottom sections without slicing unified meshes.

### Applying the split

1. Review the generated list of output folders in the preview panel.
2. Click **Split mod**.
3. The app creates the isolated folders in your library and keeps your original mod untouched.

---

## 12. Image editor and preview cropper

Give your mod cards clean, properly proportioned preview art without leaving the app.

### How to open the cropper

- On any mod card, click the **3D Preview / Advanced** button and click the **Preview Image** tab (crop icon).

### Loading images

You can supply an image in three ways:

1. Click **Upload image** to choose a picture from your computer.
2. Drag and drop any `.png`, `.jpg`, or `.webp` file directly onto the crop canvas.
3. **Paste from clipboard**: Copy any image from your web browser or screenshot tool, switch to the app, and press `Ctrl+V`.

### Framing controls

- **Aspect ratio presets**: Choose between **4:5** (standard mod card format), **16:9** (widescreen banner), **1:1** (square avatar), **3:4** (portrait), or **Free** (drag any border or corner handle to create custom dimensions).
- **Zoom**: Adjust the zoom slider, or use your mouse scroll wheel over the canvas.
- **Pan / Re-center**: Click and drag anywhere inside the crop box to position your character.
- **Rotate**: Click the **Rotate** button to turn the image 90 degrees clockwise.
- **Save**: Click the green checkmark (**Save preview**). The app renders the crop to `<canvas>` and writes it as `preview.png` inside the mod folder.

---

## 13. In-game tools and hotkeys

The manager works alongside 3DMigoto while Zenless Zone Zero is running:

| Default Hotkey | Action                | Function                                                                   |
| :------------- | :-------------------- | :------------------------------------------------------------------------- |
| `h`            | In-game mod menu      | Opens an on-screen overlay listing active mods, toggles, and hotkeys.      |
| `F10`          | Reload mods           | Reloads all active mods in 3DMigoto without restarting the game.           |
| `Alt+Shift+S`  | Quick preview snapper | Captures an in-game screenshot, crops it, and saves it as the mod preview. |

> **Customizing hotkeys:** The overlay menu key (`h`) and screenshot hotkey (`Alt+Shift+S`) can be changed to any key combination in **Settings > In-Game Integration**.

### In-game overlay menu (`h`)

When enabled in Settings, the app generates a lightweight helper script (`zzzzzz_ZZZModManagerUI`) inside your `Mods` directory:

- Press `h` while in-game to display a text overlay showing your loaded mods.
- Check toggle states, verify hotkeys, and see which outfit parts are active without alt-tabbing.
- Disabling a mod in the app automatically cleans up its menu entries so you never get ghost menus.

### Quick preview snapper (`Alt+Shift+S`)

To assign preview cards directly from your gameplay:

1. In the app, click the mod card you want to update so it is highlighted.
2. Switch to the game window and pose your character.
3. Press `Alt+Shift+S` on your keyboard.
4. The app captures your screen, crops the character area, and writes it directly as `preview.png` inside the mod folder.

---

## 14. Diagnostics, warning badges, and auto-fix

Mod cards display colored warning badges in the upper-right corner to help you diagnose and repair file issues before launching the game:

### 1. Blue badge: INI script issues (Auto-fix available)

- **What it means**: Mod script files (`.ini`) have formatting bugs, such as missing conditions, rogue `[Present]` loops that drop frame rates, missing vertex limit overrides, or unassigned active variables.
- **How to fix**: Click the blue badge to open the Script Warnings dialog. Review the issues and click **Auto-fix script**. The app saves a pristine backup (`.ini.bak`) and cleans the script automatically.

### 2. Yellow badge: Multi-entity / shared hashes

- **What it means**: The mod contains hashes that belong to more than one character or skin entity.
- **Why this happens**: Characters with multiple official skins or related models (such as Belle and Wise) share identical base body hashes. Packs with multiple characters also trigger this badge.
- **What to do**: Click the yellow badge to see which characters share the hashes. If it is a multi-character pack, you can use the **Mod Splitter** to separate them into standalone folders.

### 3. Red badge: Hash conflicts

- **What it means**: Two or more currently enabled mods replace the exact same character mesh or buffer hash at the same time.
- **How to fix**: Click the red badge to open the Conflict Resolver. The app shows which mods collide. You can disable one of the conflicting mods or choose to whitelist the conflict if they modify different toggleable parts.

---

## 15. Fixing outdated mods with the upgrade button

When major game patches change character vertex layouts, older mods can produce invisible limbs, stretched meshes, or crashes.

### How the upgrade button works

1. Make sure **Experimental tools** is turned on in **Settings > Experimental**.
2. When the app detects an outdated mod whose vertex layouts no longer match the current game version, an **Upgrade** button (with a sparkles icon) automatically appears in the upper-right corner of the mod card.
3. Click the **Upgrade** button.
4. The Mod Fixer wizard opens and displays the recommended remappings:
   - Updates half-float (`f16`) bone weights and blend indices.
   - Remaps changed vertex buffer layouts.
   - Adjusts resource `stride` values to prevent mesh stretching.
   - Preserves custom texture bindings and weapon links.
5. Follow the on-screen instructions and click **Apply fixes**. The app saves a pristine backup of your original folder before applying any changes.

---

## 16. GameBanana Discover, tabs, and update checking

The integrated GameBanana browser gives you access to thousands of Zenless Zone Zero community mods directly inside the manager.

### Discover tabs

- **Featured / Trending**: The most popular and recently trending mods on GameBanana.
- **Latest**: Recently published and updated mods in chronological order.
- **Top rated**: All-time community favorite mods.
- **Recommended**: Personalized recommendations based on your favorited characters and active library agents.
- **Downloaded**: Tracks every mod you have acquired through Discover, showing its download status and an instant shortcut to view it in your local library.

### Discover filters and categories

Use the Discover sidebar to quickly filter the feed:

- Filter by specific character or NPC.
- Filter by mod section (Skins, UI, Audio, Weapons, Tools).
- Search by keyword or author.

### Checking for mod updates

Mod authors frequently update their mods with bug fixes, new outfit toggles, or patch compatibility.

- In the library top bar, click the **Check for Updates** button.
- The app compares the version and timestamps of your installed GameBanana mods against the live API.
- If an update is found, a pulsing **Page Updated** badge appears on the mod card.
- Click the badge to open the update dialog, read the author changelog, and download the new release or replace the existing folder.

---

## 17. Achievements and feature discovery

The manager includes an in-app progression and achievement system located by clicking the trophy icon in the top navigation.

### The purpose of achievements

Achievements in ZZZ Mod Hub are not just for fun. They serve as an interactive checklist designed to introduce you to every feature the manager has to offer.

- By browsing the achievement list, you can discover features you might not know existed, such as:
  - Setting up randomizer rules.
  - Using the in-manager 3D previewer.
  - Creating and exporting custom profiles.
  - Auto-fixing a broken script.
  - Capturing an in-game preview card with `Alt+Shift+S`.
  - Splitting a multi-part mod.
- Click any incomplete achievement to see a step-by-step hint guiding you to that feature.

---

## 18. Mod profiles and presets

Save and swap different outfit loadouts for different characters or play sessions.

### Creating a profile

1. Turn on the mods you want active for your characters.
2. Click the **Profiles** button in the library top bar.
3. Click **Create new profile**, name it (e.g. `Casual Streetwear` or `Boss Fight Loadout`), and save it.

### Switching profiles

1. Open the **Profiles** dialog.
2. Click **Apply** on the profile you want to load.
3. The app enables all mods saved in that profile and disables the rest in a single operation.

### Sharing profiles

- In the Profiles menu, click **Export** to copy your profile configuration as a JSON snippet.
- Click **Import** to paste a profile string from another player.

---

## 19. Performance profiles and manual low-power controls

Adjust how the app consumes background resources based on your computer hardware.

Open **Settings** and choose your **Performance mode**:

| Profile             | File Watcher                       | Thumbnail Generation        | Warning Scanners                 | Recommended For                                                |
| :------------------ | :--------------------------------- | :-------------------------- | :------------------------------- | :------------------------------------------------------------- |
| **High (Default)**  | Real-time continuous file watcher  | Instant parallel generation | Continuous background scans      | Fast NVMe SSDs, small-to-medium libraries (<150 mods).         |
| **Balanced**        | Debounced polling watcher          | On-demand generation        | Scans active category on view    | General systems, libraries up to 500 mods.                     |
| **Low performance** | Disabled (Manual `Ctrl+R` refresh) | Deferred until scrolled     | Scans only when opening mod card | Mechanical hard drives (HDDs), laptops on battery, 1000+ mods. |

### Manual operations in low-performance mode

In **Low performance** mode, automatic background heavy lifting is turned off to save CPU, RAM, and battery:

- **Checking updates**: Mod updates are not polled in the background. Click **Check for Updates** manually in the top bar.
- **Conflict and script scans**: Scanners do not run across your entire library on startup. Badges are checked on-demand when you open or interact with a mod card.
- **Folder changes**: The background file watcher is turned off. Press `Ctrl+R` or click **Refresh** in the sidebar to detect newly added or deleted folders.

### Personalizing background tasks

In **Settings**, you can individually toggle background tasks to match your preferences (e.g. keep thumbnail generation on while disabling continuous warning checks).

---

## 20. Customization, audio settings, and custom languages

Personalize the look, feel, audio, and language of your manager.

### Themes, glass mode, and wallpapers

- Go to **Settings > Customization**.
- Choose between **Dark**, **Light**, and **Glass** themes.
- Under **Glass theme**, panels become translucent frosted glass that floats over your desktop wallpaper.
- Click **Select background** to pick any custom image from your computer, and adjust **Background dimming** and **Background blur** sliders to maintain text readability.
- Pick from preset accent colors or use the color picker to customize the highlight theme.
- Adjust **Background dimming** and **Background blur** sliders to ensure text remains readable.

### UI scaling and mod card sizes

- Adjust the **Interface scale** slider to scale the entire app up or down.
- Change **Mod card size** between **Compact**, **Medium**, and **Large** to fit more mods on your monitor.

### NSFW content controls

- Go to **Settings > Discover**.
- Toggle **Show adult content** on or off.
- Turn on **Blur mature thumbnails** so sensitive mod images are blurred until you hover your mouse over them.

### Sound effects and audio volume

The app includes procedural audio cues (synthesized using the Web Audio API) for toggling mods, batch actions, clicking buttons, and unlocking achievements.

- Go to **Settings > Audio / Sound Effects**.
- Adjust the master SFX volume slider to your preference.
- Or toggle **Sound effects** completely off if you prefer silent operation.

### Built-in languages

The app includes complete translations for 8 languages:

- English
- Português (Brasil)
- Español
- 繁體中文
- 简体中文
- 日本語
- 한국어
- Русский

Switch languages anytime under **Settings > General > Language**.

### Creating your own custom language adaptation

You can customize existing translations or create a translation pack for your own language or gaming dialect:

1. Go to **Settings > General > Language** and open the **Language Manager**.
2. Click **Export base language pack** to save the English translation template (`en.json`).
3. Edit the translation values in any text or JSON editor.
4. Click **Load custom language pack** to import your translations directly into the app.
5. The interface updates instantly to your personalized language pack.

---

## 21. Configuration backup and restore

Safeguard your library settings, custom tags, and mod notes.

### Exporting a backup

1. Go to **Settings > Advanced > Backup & restore**.
2. Click **Export configuration**.
3. Choose a destination on your computer. The app saves all your profiles, custom tags, notes, and path settings into a single `.json` file.

### Restoring a backup

1. Click **Restore configuration**.
2. Select your previously saved `.json` backup file.
3. The app restores all settings and reloads your library.

---

## 22. Requirements and disclaimer

- **Operating system**: Windows 10 or Windows 11 (64-bit).
- **Mod loader**: ZZZ Mod Hub is a **mod manager**, not a mod loader. You still need **3DMigoto** or the **XXMI Launcher** installed to load mods into Zenless Zone Zero.
- **Game disclaimer**: This application is an independent freeware utility and is not affiliated with, endorsed by, or connected to miHoYo, HoYoverse, or Zenless Zone Zero. Use mods responsibly.
- **License**: This software is provided as proprietary freeware for personal, non-commercial use only.
