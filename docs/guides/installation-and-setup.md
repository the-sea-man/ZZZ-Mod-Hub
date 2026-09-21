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
