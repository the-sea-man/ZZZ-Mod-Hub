# Installation & system setup

A detailed technical guide to system requirements, installation types, directory structures, and application initialization in ZZZ Mod Hub.

---

## System requirements & compatibility

ZZZ Mod Hub is a native 64-bit desktop application built for Windows using Tauri and Rust.

| Requirement          | Specification                    | Details                                                                                                                                                                             |
| :------------------- | :------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Operating System** | Windows 10 / Windows 11 (64-bit) | Built natively for Windows desktop environments.                                                                                                                                    |
| **Platform Scope**   | Desktop PCs & Laptops            | Designed specifically for Windows desktop computers. Not compatible with handheld console operating systems (such as SteamOS) or mobile devices.                                    |
| **Runtime**          | Microsoft Edge WebView2          | Installed by default on modern Windows 10 and 11 systems. If missing, download it from [Microsoft's official site](https://developer.microsoft.com/en-us/microsoft-edge/webview2/). |
| **Mod Loader**       | 3DMigoto or XXMI Launcher        | Required to load custom textures and meshes into the game process at runtime.                                                                                                       |
| **Hardware**         | Any modern CPU / 4GB+ RAM        | Runs smoothly on integrated graphics (Intel HD/UHD, AMD Radeon Vega) or dedicated gaming GPUs.                                                                                      |

::: tip Mod Manager vs Mod Loader
It helps to understand the difference between the two tools:

- **3DMigoto / XXMI** is the runtime loader. It hooks into the game DirectX 11 rendering pipeline to replace 3D character models, textures, and shaders while you play.
- **ZZZ Mod Hub** is the desktop management application. It organizes folders, repairs outdated `.ini` scripts, auto-sorts archives, previews 3D models, and manages profiles.
  :::

---

## Installation types

You can download the latest version from the official GitHub repository:

- **[Download ZZZ Mod Hub on GitHub Releases](https://github.com/the-sea-man/ZZZ-Mod-Hub/releases)**

### 1. Windows installer (`.msi` or `setup.exe`) (recommended)

<div class="guide-video-wrapper">
  <video controls playsinline class="guide-video" src="/videos/install-mod-manager.mp4"></video>
  <div class="guide-video-caption">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    <span><strong>Video walkthrough:</strong> Downloading and installing the desktop application</span>
  </div>
</div>

- Installs to your local user application folder (`%LOCALAPPDATA%\Programs\zzzmodmanager`).
- Automatically registers Start Menu shortcuts and desktop icons.
- Includes automatic update checks when a new release is published.

### 2. Portable archive (`.zip`)

- Extract the archive to any folder on your drive (for example `D:\Tools\ZZZModHub\`).
- Runs directly without modifying system registry keys.
- Ideal if you prefer keeping all tool files inside a portable folder on an external drive.

### Windows SmartScreen notice

Because ZZZ Mod Hub is an open-source community utility signed without expensive enterprise code-signing certificates, Windows SmartScreen may show a security prompt on first launch:

```text
Windows protected your PC
Microsoft Defender SmartScreen prevented an unrecognized app from starting.
```

To run the application:

1. Click **More info**.
2. Click **Run anyway**.

All source code is open and verified on [GitHub](https://github.com/the-sea-man/ZZZ-Mod-Hub).

---

## Interface language & Language Hub

During setup, you can select your interface language. ZZZ Mod Hub provides 9 built-in native translations (English, Spanish, Japanese, Korean, Brazilian Portuguese, Russian, Thai, Simplified Chinese, Traditional Chinese).

If your language is not yet officially translated, click the **Language Hub** menu on the right. You can select from over 50 automated translations or import custom community translation files. Language preferences can be changed at any time in **Settings > Appearance**.

<div class="guide-video-wrapper">
  <video controls playsinline class="guide-video" src="/videos/language-selection.mp4"></video>
  <div class="guide-video-caption">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    <span><strong>Video walkthrough:</strong> Selecting non-supported languages in Language Hub</span>
  </div>
</div>

---

## Migrating from another mod manager

If you already have a mod collection managed by another tool (such as generic mod managers or manual folder setups), you can import your entire library without losing your files or having to re-download anything.

### 1. Importing during first-time setup

During the initial setup wizard (Step 3), the manager detects if you want to import an existing folder:

- Select your previous manager's `Mods/` directory.
- Select **Copy** (leaves old folders intact) or **Move** (transfers files directly to save disk space).
- The manager indexes each mod, checks 3DMigoto hashes, and sorts recognized characters automatically while keeping unrecognized folders safe in `Unassigned/`.

<div class="guide-video-wrapper">
  <video controls playsinline class="guide-video" src="/videos/import-during-first-install.mp4"></video>
  <div class="guide-video-caption">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    <span><strong>Video walkthrough:</strong> Importing mods during the initial setup wizard</span>
  </div>
</div>

::: tip Remember to Auto-Sort after initial setup
Any imported mods with non-standard naming or loose directories will land safely in `Unassigned/`. Once setup finishes, navigate to **Unassigned** in your sidebar and click **Auto-Sort** to let the manager check their buffer hashes and place them into their matching character folders!
:::

### 2. Importing after setup (Settings menu)

If you skipped the initial import or have additional mod archives on another drive that you want to bring in later, you do not need to re-run the wizard:

1. Open **Settings > Game & Folders**.
2. Click the **Import Mods** button under the migration section.
3. Select your external mod directory, choose **Copy** or **Move**, and confirm. The exact same migration pipeline executes in the background.
4. **Run Auto-Sort:** After importing, click into the **Unassigned** category in the left sidebar and press **Auto-Sort**. The manager will inspect all 3DMigoto buffer hashes inside any loose mod folders and distribute them straight to the correct agent folders.

<div class="guide-video-wrapper">
  <video controls playsinline class="guide-video" src="/videos/partial-import-after-setup.mp4"></video>
  <div class="guide-video-caption">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    <span><strong>Video walkthrough:</strong> Accessing the import tool from Settings after initial setup</span>
  </div>
</div>

::: tip Looking for the Complete Initial Setup Walkthrough?
This video demonstrates accessing the import tool through Settings if you skipped it during first installation. Because this clip cuts straight to the Settings menu, if you want to see the complete setup flow from the very beginning (including the full first-time setup wizard and initial folder selection), check out [Importing during first-time setup](#_1-importing-during-first-time-setup) above or the [Getting Started — Initial Setup Guide](./getting-started.md#step-2-first-time-setup-wizard) where the complete walkthrough video is shown.
:::

---

## Directory hierarchy & loader paths

Before launching the manager, make sure your 3DMigoto or XXMI directory is set up.

### Recommended directory structure

```text
C:\Program Files\HoYoPlay\Game/
                           ├── ZenlessZoneZero/
                               └── ZenlessZoneZero.exe
C:\Users\*YOURUSER*\AppData\Roaming\XXMI Launcher\Resources\Bin
                                                            └── 3DMigoto/ (or XXMI Launcher)
                                                               ├── 3DMigoto Loader.exe (or XXMI.exe)
                                                               ├── d3dx.ini
                                                               └── Mods/  <-- SELECT THIS FOLDER
                                                                  ├── Ellen/
                                                                  ├── JaneDoe/
                                                                  └── Unassigned/
```

### The folder selection rule

Always select the **`Mods`** directory itself.

- Do not select the game root folder (`ZenlessZoneZero/`).
- Do not select the 3DMigoto parent folder without the `Mods` subfolder.
- If you use the **XXMI Launcher**, your default path is usually:
  `%appdata%\XXMI Launcher\ZZMI\Mods`

---

## Configuring the game executable

Linking your game executable allows you to launch Zenless Zone Zero directly from the manager:

1. Open **Settings > Game & Folders**.
2. Click **Browse** under **Game Executable Path**.
3. Select your `ZenlessZoneZero.exe` (usually located in your HoYoPlay game installation folder).
4. This enables the 1-click **Launch Game** button in the header toolbar.

::: tip Direct Game Detection
Linking your game path also allows the manager to detect when the game process is running so you can track your play sessions.
:::

---

## What happens during initialization

Every time ZZZ Mod Hub opens, it runs an initialization sequence designed for fast performance and data safety:

1. **Character Database Mount**
   Loads the canonical database of 61 playable Zenless Zone Zero agents, skin variants, and over 2,200 verified 3DMigoto component buffer hashes (`ib`, `vb0`, `vb1`, `vb2`).
2. **Offline-First Cache Hydration (< 50ms)**
   Reads your saved library index from local storage. Your mod cards, categories, and tags render instantly without waiting for disk scans.
3. **Background Directory Re-Index**
   Inspects subfolders in your `Mods/` directory. Identifies active mods versus disabled mods (folders prefixed with `DISABLED_`), checks for missing previews, and updates badge counts.
4. **Buffer Hash Auto-Classification**
   If new mod folders were placed into `Unassigned`, the manager reads the internal `.ini` files to identify character hashes and suggest moving them to the right character folder.
5. **System Folder Verification**
   Ensures essential system folders (`Unassigned`, `_Conflicts`, `.staging`) exist and remain protected from accidental deletion.
6. **Filesystem Watcher Registration**
   If running in **Balanced** or **High Power** mode, starts a background folder listener. Any mod folders you extract, rename, or delete directly in Windows Explorer update in the manager automatically.
7. **Silent Update Checks**
   Checks GitHub Releases for new manager versions, and optionally checks GameBanana for updates to your installed mods.
