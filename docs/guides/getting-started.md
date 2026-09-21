# Quick start guide

Get up and running with **ZZZ Mod Hub** in 5 minutes. This step-by-step walkthrough covers downloading the manager, completing the setup wizard, installing your first mod, and launching the game.

---

## Step 1: download & launch

1. Download the latest version from the official GitHub release page:
   - **[Download ZZZ Mod Hub on GitHub Releases](https://github.com/the-sea-man/ZZZ-Mod-Hub/releases)**
2. Run the Windows installer (`setup.exe` or `.msi`) or extract the portable `.zip` to any folder.
3. Launch **ZZZ Mod Hub**.

::: tip SmartScreen Prompt
If Windows SmartScreen appears on first launch, click **More info** and then click **Run anyway**. For technical details on certificates and runtime dependencies, see the [Installation & System Setup](/guides/installation-and-setup) guide.
:::

---

## Step 2: first-time Setup Wizard

When you open the manager for the first time, a 4-step wizard guides you through your initial setup:

### 1. Choose your language & verify loader

- Select your preferred interface language. If your language is not in the native list, choose an auto-translated language pack from the right-hand menu. You can change this anytime later in Settings.
- Make sure you have **3DMigoto** or the **XXMI Launcher** installed. If you do not have a loader yet, click **Get XXMI Launcher** to download it.

### 2. Select your mods directory

Click **Browse** and select your `Mods/` directory.

- If you use the XXMI Launcher, the standard path is detected and filled in automatically:
  `%appdata%\XXMI Launcher\ZZMI\Mods`
- Always select the `Mods` folder itself, rather than the game root or a single mod folder.

### 3. Import from another mod manager (optional)

If you are switching from another mod manager:

- Select your previous mods folder.
- Choose whether to **Copy** or **Move** your mods. If you choose to copy, remember to disable or remove the old copies in your previous tool so you do not have duplicates.
- If any mods end up in `Unassigned`, open that folder and click **Auto-Sort**. The manager reads 3DMigoto buffer hashes to move them into their matching character folders automatically.
- If you are new to modding or starting fresh, click **Skip** to continue.

### 4. Finish setup

Click **Enter App** to open your mod library.

---

## Step 3: sync the database & generate folders

1. On your first launch, the manager will prompt you to sync the character database.
2. Clicking **Sync Database** downloads the latest character definitions and 3DMigoto buffer hashes. This ensures new characters and skin variants are recognized.
3. Click **Generate Character Folders** to create clean folders for every current Zenless Zone Zero agent.

---

## Step 4: install your first mod

You can install mods using any of these three methods:

1. **Drag-and-Drop (Easiest):**
   Drag any `.zip`, `.7z`, or `.rar` archive directly into the ZZZ Mod Hub window. The manager unpacks the archive in a background staging area without opening terminal windows.
2. **Toolbar Button:**
   Click the **Install Mod** (`+`) button in the top toolbar to select an archive from Windows Explorer.
3. **Discover Tab:**
   Click the **Discover** tab in the sidebar to browse trending GameBanana mods. Click **Install** on any mod to download and unpack it automatically.

### Strict buffer hash sorting

You do not need to figure out which character folder a mod belongs to. The manager reads internal 3DMigoto buffer hashes (`ib`, `vb`) directly from the `.ini` files:

- If a mod belongs to Ellen, it goes straight into `Mods/Ellen/`.
- If hashes are unrecognized or ambiguous, it is safely placed in `Unassigned` for you to review without guessing.

---

## Step 5: enable mods & play

1. Find your mod in the character category and click the **toggle switch** on the card to enable it.
2. Launch the game through your 3DMigoto loader or XXMI Launcher (or use the 1-click **Launch Game** button in the manager if configured).
3. If you enable or disable mods while the game is running, switch to the game window and press <kbd>F10</kbd> on your keyboard to reload your mods instantly.

---

## Finding your way around Settings

Settings is split into four groups in the left sidebar. If you are looking for something specific, this is where it lives:

**Setup**

- **Game & Folders**: your mods folder, the game executable, hot reload, and the database URL.
- **Library**: the randomizer whitelist and which filter chips appear above your mods.
- **Downloads**: download behaviour, the Discover feed, and the adult content filters.

**Tools**

- **In-Game**: the in-game overlay menu and the Quick Snapper screenshot hotkey.
- **Diagnostics**: the mod health scanner, conflict detection rules, and the hash sniffer.

**Look & Feel**

- **Appearance**: theme, accent colour, wallpaper, interface language, and sound effects.
- **Mod Cards**: the card designer, card size, and grid density.

**System**

- **Performance**: performance profiles, the file watcher, animations, and blur.
- **Advanced**: experimental features, configuration backup and restore, operation history, and the danger zone.
- **Help & About**: replay the tutorials, check your version, and read the credits.

Each setting only lives in one place. If you change animations or blur, you do that in Performance; if you change card size, you do that in Mod Cards.

## Helpful tips for new users

- **NSFW Mods:** If you install adult or NSFW mods, turn off the censor and thumbnail blur filters in **Settings > Downloads** (they are enabled by default for safe browsing).
- **Outdated Mods (Blue File Badge):** If an older mod shows a Blue File badge after a game patch, click the **Upgrade** button on the card to update byte strides and vertex buffers automatically.
- **In-Game Menu (<kbd>H</kbd>):** Press <kbd>H</kbd> in-game to open the Direct3D 11 mod menu and toggle outfit variants on the fly.
- **In-Game Quick Snapper (<kbd>Ctrl + F11</kbd>):** Press <kbd>Ctrl + F11</kbd> while playing to capture and crop custom 360x450 card preview thumbnails.

---

## Next steps & deep dives

- [Installation & System Setup](/guides/installation-and-setup): Detailed directory trees, runtime dependencies, and engine initialization sequence.
- [Installing & Managing Mods](/guides/mod-management): Batch operations, emergency disable, and automatic tag filters.
- [In-Game HUD & Tools](/guides/in-game-hud): Direct3D 11 menu configuration, in-game screenshot snapper, and outfit randomizer.
- [Mod Fixer Engine](/guides/mod-fixer): How the patch upgrade engine repairs outdated mods and manages backups.
- [Troubleshooting & Badges](/guides/troubleshooting): Explanations for Blue File, Yellow Person, and Red Shield warning badges.
