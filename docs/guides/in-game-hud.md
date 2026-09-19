# In-Game HUD & Tools

ZZZ Mod Hub includes tools that work directly while Zenless Zone Zero is running, allowing you to toggle outfits, capture mod preview cards, and reload 3DMigoto without alt-tabbing.

---

## Interactive In-Game HUD Menu (`H`)

The **In-Game HUD** is a GPU-rendered Direct3D 11 overlay generated directly into 3DMigoto. It renders a clean mod menu inside the game process.

### How to Use the In-Game HUD

1. Open **Settings > Advanced > In-Game Overlay**.
2. Toggle on **Enable In-Game Overlay**.
3. Launch the game with your 3DMigoto or XXMI loader.
4. Press <kbd>H</kbd> on your keyboard (default hotkey) while in-game.
5. The overlay appears on screen, showing:
   - **Active Character Outfits:** Displays which mods are currently active for the agent on screen.
   - **Page Navigation:** Flip through multi-variant mods and toggle clothing layers in real time.
   - **Keybind Display:** Shows the assigned hotkeys for mod toggles.

::: tip Customizing the HUD Hotkey
You can change the menu hotkey from <kbd>H</kbd> to any key of your choice in **Settings > In-Game Overlay**.
:::

### How It Works Behind the Scenes

The manager inspects your installed mods and generates a lightweight 3DMigoto configuration file (`zzzmodmanager_ui.ini`) along with custom vertex buffers and texture font atlases.

- Zero external overlay hooks or third-party DLL injections.
- Renders entirely through 3DMigoto Direct3D 11 shaders for stable performance.
- To disable the overlay entirely, toggle it off in Settings or delete the generated UI files.

---

## Automatic Hot Reload (<kbd>F10</kbd>)

Whenever you enable, disable, or install a mod in ZZZ Mod Hub while the game is running:

1. The manager detects the active `ZenlessZoneZero.exe` window.
2. It sends an automatic <kbd>F10</kbd> reload command to 3DMigoto.
3. Your mod updates on screen immediately without requiring you to alt-tab and press <kbd>F10</kbd> manually.

::: info Manual Reload
You can always press <kbd>F10</kbd> manually on your keyboard while in-game to force 3DMigoto to reload its cache and scripts.
:::

---

## Quick Snapper: In-Game Screenshot Cropper (<kbd>Ctrl + F11</kbd>)

Finding high-quality preview images for your mod cards can be tedious. The **Quick Snapper** lets you create custom card previews directly from your game:

1. Pose your character in Zenless Zone Zero.
2. Press <kbd>Ctrl + F11</kbd> (default hotkey).
3. The manager captures the game screen and opens the **Quick Snapper Crop Modal**.
4. Adjust the crop box, which is locked to the standard 360x450 card aspect ratio.
5. Select which mod in your library should receive the preview.
6. Click **Save Thumbnail**. The mod card updates immediately in your library.

::: tip Hotkey Customization
Update the Quick Snapper hotkey anytime under **Settings > Mod Management > Quick Snapper**.
:::

---

## Outfit Randomizer

If you have collected dozens of outfits, skins, and weapon mods, the **Outfit Randomizer** keeps your commissions fresh:

1. Click the **Randomize** button in the top toolbar (dice icon).
2. The **Outfit Randomizer Modal** opens:
   - Choose whether to randomize mods across **All Characters** or only for the **Current Category**.
   - Choose whether to include only **Favorited Mods** or your whole library.
3. Click **Roll Loadout**.
4. The manager randomly selects and enables one mod per character while disabling conflicting alternatives.
5. If the game is running, <kbd>F10</kbd> sends automatically to show your new loadout.
