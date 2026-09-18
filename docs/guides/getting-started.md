# Quick Start & Setup

Welcome to **ZZZ Mod Hub**. This guide walks you through setting up your environment, configuring your folders, and launching your first mods in **Zenless Zone Zero**.

---

## Prerequisites

ZZZ Mod Hub is a **mod manager**, not a mod loader. To load mods into the game, you need one of the following loaders installed:

1. **3DMigoto for Zenless Zone Zero** (or the **XXMI Launcher** by SpectrumQT).
2. A working **Mods** folder created by your loader.

::: tip Loader vs Manager
Think of 3DMigoto/XXMI as the engine that injects mods into the game process, while ZZZ Mod Hub is the dashboard that organizes, fixes, toggles, and previews your mods without messing up your files.
:::

---

## Initial Setup Wizard

When you launch ZZZ Mod Hub for the first time, the setup wizard will ask you for two paths:

### 1. Mods Folder Path

Select the directory where 3DMigoto or XXMI looks for active mods.

- Example: `C:\Games\ZenlessZoneZero\3DMigoto\Mods` or `D:\XXMI\ZenlessZoneZero\Mods`
- The manager reads and organizes subfolders directly inside this directory.

### 2. Game Executable Path (Optional)

Select your game executable (`ZenlessZoneZero.exe`).

- Providing this path enables the in-app **Launch Game** button and automatic game process detection.
- If you use the official HoYoPlay launcher or XXMI Launcher to start the game, you can skip this step or configure it later in **Settings**.

---

## Selecting a Performance Profile

During first-time setup (or anytime in **Settings > Performance**), choose a performance profile suited to your PC:

| Profile                      | Best For                   | Background Watcher        | Automatic Scans                        |
| :--------------------------- | :------------------------- | :------------------------ | :------------------------------------- |
| **High Power**               | Modern gaming desktops     | Real-time file watcher    | Instant hash collision & script checks |
| **Balanced** _(Recommended)_ | Most PCs & laptops         | Debounced watcher         | Scans on category change               |
| **Potato / Low Power**       | Budget laptops / handhelds | Disabled (manual refresh) | Manual checks only, low RAM mode       |

::: info Changing Settings Later
You can update your paths, performance profiles, or UI preferences at any time by clicking the **Settings** gear icon in the bottom-left corner of the app.
:::

---

## Your First Launch Check

Once setup is complete, you should see your character categories in the left sidebar:

1. If you already have existing mods in your folder, click the **Reload** icon on the top toolbar to scan them.
2. If your mods are placed into an `Unassigned` folder, click the **Auto-Sort** button in the toolbar. The manager will inspect each mod's 3DMigoto buffer hashes and automatically move it into the correct character folder.
3. Toggle a mod on using the toggle switch on its card.
4. Launch the game. Press **F10** while in-game to reload 3DMigoto and see your mod in action!
