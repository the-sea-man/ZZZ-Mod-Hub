# In-Game HUD & tools

ZZZ Mod Hub includes tools that work directly while Zenless Zone Zero is running, allowing you to toggle outfits, capture mod preview cards, and reload 3DMigoto without alt-tabbing.

---

## Interactive in-game HUD menu (`h`)

The **In-Game HUD** is a GPU-rendered Direct3D 11 overlay generated directly into 3DMigoto. It renders a clean mod menu inside the game process.

### How to use the in-game HUD

1. Open **Settings > In-Game > In-Game Overlay**.
2. Toggle on **ZZMI In-Game Overlay**.
3. Launch the game with your 3DMigoto or XXMI loader.
4. Press <kbd>H</kbd> on your keyboard (default hotkey) while in-game.
5. The overlay appears on screen, showing:
   - **Active Character Outfits:** Displays which mods are currently active for the agent on screen.
   - **Page Navigation:** Flip through multi-variant mods and toggle clothing layers in real time.
   - **Keybind Display:** Shows the assigned hotkeys for mod toggles.
6. If the menu or outfit switches do not appear immediately, press <kbd>F10</kbd> on your keyboard to reload 3DMigoto caches.

<div class="guide-video-wrapper">
  <video controls playsinline class="guide-video" src="/videos/in-game-hud-menu.mp4"></video>
  <div class="guide-video-caption">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    <span><strong>Video walkthrough:</strong> Opening the in-game HUD, cycling variants, and configuring hotkeys</span>
  </div>
</div>

::: tip Checking if a mod has an in-game menu
To check if a specific mod includes in-game toggleable variants or keys, open the mod card actions menu (`...`) in your library and select **Change Keybind**. This displays all active toggle keys and allows assigning custom hotkeys.
:::

::: tip Customizing the HUD Hotkey
You can change the menu hotkey from <kbd>H</kbd> to any key of your choice in **Settings > In-Game**.
:::

### How it works behind the scenes

The manager inspects your installed mods and generates a lightweight 3DMigoto configuration file (`zzzmanager_ui_<mod>.ini`, inside a `zzzzzz_ZZZModManagerUI` folder in your Mods directory) along with the shaders and texture atlases it draws with.

- Zero external overlay hooks or third-party DLL injections.
- Renders entirely through 3DMigoto Direct3D 11 shaders for stable performance.
- To disable the overlay entirely, toggle it off in Settings or delete the generated UI files.

---

## In-Game hot reload (<kbd>F10</kbd>)

Whenever you enable, disable, or install a mod in ZZZ Mod Hub, 3DMigoto needs to reload its internal cache to apply the changes:

1. Click into or alt-tab to the active **Zenless Zone Zero** game window.
2. Press <kbd>F10</kbd> on your keyboard.
3. 3DMigoto reloads its active shaders and textures instantly on screen, without restarting the game.

---

## Quick Snapper: rapid multi-mod photo studio

Finding high-quality preview images for your mod cards can take hours. The **Quick Snapper** automates the entire process, allowing you to take clean preview shots of dozens of mods in rapid succession:

### The automated cycling rule

Quick Snapper uses a smart filtering queue:

- **It only targets deactivated mods that lack a preview image.**
- It ignores mods that already have a `preview.png` or custom artwork.
- It enables one un-previewed mod at a time, waits for your capture, saves the thumbnail, disables it, and enables the next one in queue.

### Step-by-step Quick Snapper workflow

1. **Be on the Character Category Page:** In ZZZ Mod Hub, navigate to the specific character whose mods you want to preview (e.g. `Ellen` or `Jane Doe`).
2. **Set up your In-Game Pose:** Switch to Zenless Zone Zero and position your character in a clean, well-lit location (such as Random Play video store or training arena).
3. **Trigger Quick Snapper:** Press the Quick Picture command shortcut (or start the batch session from the toolbar).
4. **Reload In-Game (<kbd>F10</kbd>):** Switch to the game window and press <kbd>F10</kbd> to render the newly enabled mod.
5. **Fixing Bind-Pose or Broken Meshes:** _If the character model appears distorted, floating, or in a T-pose when reloading, quickly swap characters back and forth in-game (switch to another teammate and switch back)._ This forces the game engine to rebind vertex buffers and bone matrices properly.
6. **Capture & Repeat:** Press your snapshot hotkey (default <kbd>Ctrl + F11</kbd>). The manager instantly captures the frame, crops it to the 360x450 card aspect ratio, saves `preview.png` directly into the mod directory, updates the card thumbnail, disables that mod, and primes the next un-previewed mod!

<div class="guide-video-wrapper">
  <video controls playsinline class="guide-video" src="/videos/quick-snap.mp4"></video>
  <div class="guide-video-caption">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    <span><strong>Video walkthrough:</strong> Rapidly capturing previews for multiple mods using Quick Snapper</span>
  </div>
</div>

::: tip Hotkey Customization
Update the Quick Snapper hotkey anytime under **Settings > In-Game > Quick Snapper**.
:::

---

## Outfit randomizer

If you have collected dozens of outfits, skins, and weapon mods, the **Outfit Randomizer** keeps your commissions fresh:

1. Click the **Randomize** button in the top toolbar (dice icon).
2. The **Outfit Randomizer Modal** opens:
   - Choose whether to randomize mods across **All Characters** or only for the **Current Category**.
   - Choose whether to include only **Favorited Mods** or your whole library.
3. Click **Randomize**.
4. The manager randomly selects and enables one mod per character while disabling conflicting alternatives.
5. Return to the game window and press <kbd>F10</kbd> to load your new outfit combination.
