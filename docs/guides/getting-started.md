# Quick Start & Setup

Welcome to **ZZZ Mod Hub**. This guide covers system requirements, installation options, first-time setup, and what the manager does during initialization.

---

## System Requirements & Compatibility

ZZZ Mod Hub is a native 64-bit desktop application built for Windows.

| Requirement          | Specification                    | Details                                                                                                                                                                             |
| :------------------- | :------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Operating System** | Windows 10 / Windows 11 (64-bit) | Built natively with Tauri and Rust.                                                                                                                                                 |
| **Platform Scope**   | Desktop PCs & Laptops            | Designed specifically for Windows desktop environments. Not compatible with handheld console operating systems (like SteamOS) or mobile devices.                                    |
| **Runtime**          | Microsoft Edge WebView2          | Installed by default on modern Windows 10 and 11 systems. If missing, download it from [Microsoft's official site](https://developer.microsoft.com/en-us/microsoft-edge/webview2/). |
| **Mod Loader**       | 3DMigoto or XXMI Launcher        | Required to load mods into the game process.                                                                                                                                        |
| **Hardware**         | Any modern CPU / 4GB+ RAM        | Runs smoothly on integrated graphics (Intel HD/UHD, AMD Radeon Vega) or dedicated gaming GPUs.                                                                                      |

::: tip Mod Manager vs Mod Loader
ZZZ Mod Hub is a **mod manager**, not a mod loader.

- **3DMigoto / XXMI** injects meshes and textures into the game DirectX 11 pipeline at runtime.
- **ZZZ Mod Hub** is the desktop hub that organizes folders, repairs outdated scripts, auto-sorts archives, previews 3D models, and manages profiles.
  :::

---

## Downloading & Installing

Download the latest version from the official GitHub repository:

- **[Download ZZZ Mod Hub on GitHub Releases](https://github.com/the-sea-man/ZZZ-Mod-Hub/releases)**

### Installation Options

1. **Windows Installer (`.msi` or `setup.exe`)** _(Recommended)_
   - Installs to your local user application folder (`%LOCALAPPDATA%\Programs\zzzmodmanager`).
   - Automatically registers Start Menu shortcuts and desktop icons.
   - Includes automatic update checks when a new release is published.

2. **Portable Archive (`.zip`)**
   - Extract the archive to any folder on your drive (e.g. `D:\Tools\ZZZModHub\`).
   - Runs directly without modifying system registry keys.
   - Ideal if you prefer keeping all tool files in a custom portable folder.

### Windows SmartScreen Notice

Because ZZZ Mod Hub is an open-source community utility signed without expensive enterprise code-signing certificates, Windows SmartScreen may show a security prompt on first launch:

```text
Windows protected your PC
Microsoft Defender SmartScreen prevented an unrecognized app from starting.
```

1. Click **More info**.
2. Click **Run anyway**.

All source code is completely public and verified on [GitHub](https://github.com/the-sea-man/ZZZ-Mod-Hub).

---

## Preparing Your 3DMigoto or XXMI Directory

Before opening the manager, ensure you have your 3DMigoto or XXMI directory ready.

### Recommended Directory Structure

```text
C:\Program Files\HoYoPlay\Game/
                           ├── ZenlessZoneZero/
                               └── ZenlessZoneZero.exe
C:\Users\*YOURUSER*\AppData\Roaming\XXMI Launcher\Resources\Bin
                                                            └── 3DMigoto/ (or XXMI Launcher)
                                                               ├── 3DMigoto Loader.exe (or XXMI.exe)
                                                               ├── d3dx.ini
                                                               └── Mods/  <-- THIS IS YOUR MODS DIRECTORY
                                                                  ├── Ellen/
                                                                  ├── JaneDoe/
                                                                  └── Unassigned/

```

### Folder Selection Rule

Always select the **`Mods`** directory itself.

- Do not select the game root folder (`ZenlessZoneZero/`).
- Do not select the 3DMigoto parent folder without the `Mods` subfolder.
- If you use the **XXMI Launcher**, your default path is usually:
  `%appdata%\XXMI Launcher\ZZMI\Mods`

---

## The 4-Step Setup Wizard

When you open the manager for the first time, the setup wizard guides you through the initial configuration:

### Step 1: Welcome, Language & Loader Verification

- Choose your display language. You can select one of the built-in native translations or an auto-translated pack from the Language Hub.
- Explains the prerequisite mod loader. If you do not have a loader installed, click **Get XXMI Launcher** to open the official release page.

### Step 2: Selecting Your Mods Directory

Click **Browse** and select your `Mods/` folder.

- If XXMI is detected, the manager pre-fills the standard path automatically (`%appdata%\XXMI Launcher\ZZMI\Mods`).
- The manager checks folder permissions to make sure files can be organized properly.

### Step 3: Importing from Another Mod Manager (Optional)

If you are migrating from another tool:

- Select your previous mods directory.
- Choose whether to **Copy** or **Move** your mods. If you choose to copy, deactivate older versions in your previous tool to prevent duplicate files.
- The multi-depth scanner detects nested folders automatically.
- Any mods placed in `Unassigned` can be sorted with 1 click using **Auto-Sort**, which reads 3DMigoto buffer hashes to move them to their correct character folders.
- If you are starting fresh, simply click **Skip** to continue.

### Step 4: Setup Complete

Confirms your configuration and opens the main Library view with your staged mods ready to play.

::: tip Configuring the Game Executable
After setup, you can optionally link your game executable (`ZenlessZoneZero.exe`) in **Settings > General > Game Paths**. This enables:

- 1-click **Launch Game** button in the header toolbar.
- Direct game process detection.
  :::

::: tip NSFW Content Filter
If you use NSFW mods, remember to turn off the censor and thumbnail blur filters in **Settings > Mod Management** (they are enabled by default to keep browsing safe).
:::

---

## What Happens During Initialization

Every time ZZZ Mod Hub opens, it runs an initialization sequence designed for speed and data safety:

1. **Character Database Mount**
   Loads the canonical database of 61 playable Zenless Zone Zero agents, skin variants, and over 2,200 verified 3DMigoto component buffer hashes (`ib`, `vb0`, `vb1`, `vb2`).
2. **Offline-First Cache Hydration (< 50ms)**
   Reads your saved library index from local storage. Your mod cards, categories, and tags render instantly without waiting for disk scans.
3. **Background Directory Re-Index**
   Inspects subfolders in your `Mods/` directory. Identifies active mods versus disabled mods (folders prefixed with `DISABLED_`), checks for missing previews, and updates badge counts.
4. **Buffer Hash Auto-Classification**
   If new mod folders were placed into `Unassigned`, the manager reads the internal `.ini` files to identify character hashes and suggest moving them to the right character folder.
5. **System Folder Verification**
   Ensures essential system folders (`Unassigned`, `_Conflicts`) exist and remain protected from accidental deletion.
6. **Filesystem Watcher Registration**
   If running in **Balanced** or **High Power** mode, starts a background folder listener. Any mod folders you extract, rename, or delete directly in Windows Explorer update in the manager automatically.
7. **Silent Update Checks**
   Checks GitHub Releases for new manager versions, and optionally checks GameBanana for updates to your installed mods.

---

## Feature Overview: Everything Included

Here is a quick directory of the tools available in ZZZ Mod Hub:

### Mod Management & Library

- [Installing & Managing Mods](/guides/mod-management): Drag-and-drop archives, 1-click toggles, batch operations, and emergency "Disable All" button.
- [Categories & Custom Folders](/guides/folders-and-categories): Character categories, custom folders (weapons, UI, music), and search filters.
- [Profiles & Presets](/guides/profiles): Save entire outfit loadouts, switch presets in seconds, and share via clipboard.

### In-Game Tools & Visualization

- [In-Game HUD & Quick Snapper](/guides/in-game-hud): Direct3D 11 in-game menu (`H`), F10 in-game reload, and in-game screenshot snapper (`Ctrl + F11`).
- [3D Mesh Viewer](/guides/3d-viewer): Built-in WebGL viewer with multi-map PBR textures, camera presets, wireframe, and submesh isolation.
- [3-Mode Mod Splitter](/guides/mod-splitter): Decompose character packs, isolate toggleable accessories, or split anatomical body parts.

### Repairs, Safety & Discovery

- [Mod Fixer Engine](/guides/mod-fixer): Migrate older mods across game patches, repair byte strides, and convert vertex buffers.
- [Backups & Operation History](/guides/backups-and-history): Timestamped `.zmm-backup/` inspection, file size comparison, and 1-click operation undo.
- [GameBanana Integration](/guides/gamebanana): In-app discovery feed, 4-chunk multi-threaded downloads, and CDN failover.
- [Performance Modes](/guides/performance): High Power, Balanced, and Potato profiles to suit any desktop or laptop hardware.
- [Customization & Themes](/guides/customization): Card visual designer, frosted glass, audio synthesizer, and 50+ language packs.
- [3DMigoto INI Reference](/ini/): 14 in-depth guides covering CommandLists, constants, overrides, shaders, and keybinds.
