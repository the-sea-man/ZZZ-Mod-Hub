# Customization & extra tools

Make ZZZ Mod Hub truly your own. The app includes visual personalization, a multi-language translation engine, audio synthesizer feedback, an in-game screenshot snapper, and progress achievements.

---

## Mod card appearance customizer

Under **Settings > Mod Cards**, you can personalize the layout and visual styling of mod cards with a live interactive mock card preview:

### 1. Style presets

- **Default:** Clean, glass-morphic dark design tailored for Zenless Zone Zero.
- **Minimal:** Ultra-clean aesthetic with reduced padding and flat borders for dense libraries.
- **Cyber:** High-tech styling with neon accent borders and futuristic shadows.
- **Contrast:** High-contrast borders and solid card backgrounds for maximum readability.

### 2. Fine-Tuned sliders

- **Background Opacity:** Adjust how translucent your cards are against your background wallpaper.
- **Frosted Glass Blur:** Control backdrop blur intensity.
- **Corner Rounding:** From sharp rectangular corners (0px) to rounded cards (16px).
- **Border & Shadow Controls:** Adjust border width and elevation glow.
- **Hover Zoom:** Toggle subtle card hover scaling animations.

### 3. Action visibility toggles

Prefer a clutter-free card? You can toggle the visibility of individual card elements:

- Favorite Star icon
- 3D Preview button
- Action Cog menu
- Warning & Status badges

---

## Language Hub & automated translations

ZZZ Mod Hub ships with **9 built-in native languages**:

- English
- Portuguese (Português do Brasil)
- Chinese Simplified (简体中文)
- Chinese Traditional (繁體中文)
- Spanish (Español)
- Japanese (日本語)
- Korean (한국어)
- Russian (Русский)
- Thai (ไทย)

### Generating custom language packs (50+ languages)

If your native tongue is not listed:

1. Open the **Language Hub** in **Settings**.
2. Select your language from the dropdown of over 50 world languages.
3. Click **Language Hub & Pack Editor**.
4. The built-in Google Translate integration translates all interface keys while protecting formatting variables and code tags.
5. The language applies instantly across the app.

---

## Synthesized audio sound effects

ZZZ Mod Hub includes a procedural Web Audio synthesizer:

- Clicking toggles, installing mods, and activating presets plays sound effects.
- Adjust effect volume or mute sound effects anytime in **Settings > Appearance**.

---

## In-Game Quick Snapper (screenshots)

Want custom preview thumbnails for your mods? The **Quick Snapper** lets you capture, crop, and assign custom 360x450 mod thumbnails directly from live gameplay:

- **Automated Cycling Queue:** It specifically filters and cycles through _deactivated mods without an existing preview image_.
- **Rapid Multi-Mod Studio Workflow:**
  1. Open the character category in ZZZ Mod Hub.
  2. Position your character in a clean in-game setting with good lighting.
  3. Trigger the Quick Picture session.
  4. Switch to the game window and press <kbd>F10</kbd> to render the mod.
  5. _If the model appears broken or in a bind-pose upon loading, quickly switch characters back and forth in-game to force the game engine to bind the meshes._
  6. Press <kbd>Ctrl + F11</kbd> to capture: it automatically crops to 360x450, saves `preview.png` into the mod folder, updates the card thumbnail, disables that mod, and enables the next one in queue.

<div class="guide-video-wrapper">
  <video controls playsinline class="guide-video" src="/videos/quick-snap.mp4"></video>
  <div class="guide-video-caption">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    <span><strong>Video walkthrough:</strong> Capturing custom mod thumbnails in rapid succession with Quick Snapper</span>
  </div>
</div>

---

## Achievements & exploration tracker

Under the **Achievements** tab, you can track your journey as a modder:

- Progress badges for discovering features (e.g. splitting your first mod, using the 3D viewer, generating a language pack, backing up a mod).
- Helps you explore all the advanced utilities the manager has to offer.
