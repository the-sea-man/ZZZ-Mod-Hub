# Presets & profiles

Mod profiles allow you to save entire loadouts of active mods and switch between them in seconds.

---

## Why use profiles?

Zenless Zone Zero players often want different visual styles depending on their mood:

- A "Casual Streetwear" profile for daily commissions.
- A "Combat Armor" profile for Hollow Zero runs.
- A "Clean & Vanilla" profile for testing new patches.

Instead of toggling 30 individual mods one by one, a profile remembers exactly which mods are enabled and disabled across all characters.

---

## Creating and applying profiles

1. In the top library toolbar, click the **Presets** button.
2. The **Mod Profiles** modal opens:
   - **Save Current Loadout as Profile:** Enter a name (e.g. `Hollow Zero Outfit Set`) and click **Save**.
   - **Apply Profile:** Select any saved preset from the list and click **Load**. All mods will automatically switch to the saved state.
   - **Active Badge:** The currently loaded profile name is displayed directly on the library toolbar.

<div class="guide-video-wrapper">
  <video controls playsinline class="guide-video" src="/videos/presets-experiment.mp4"></video>
  <div class="guide-video-caption">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    <span><strong>Video walkthrough:</strong> Creating, switching, and experimenting with preset configurations</span>
  </div>
</div>

### Lock system integration

If you have specific core mods (like global UI overhauls, sound replacers, or a favorite main weapon) that you want active in _all_ presets:

- Click the **Lock icon** on that mod's card.
- The preset engine recognizes locked mods and preserves their state when swapping profiles. You never have to manually re-enable your foundational mods after switching from a casual outfit to combat armor.

---

## Hardened canonical path matching

Previous mod managers often suffered from a nasty bug: if a mod folder was renamed with a `DISABLED_` prefix, swapping profiles could fail to recognize it or accidentally create duplicate entries.

ZZZ Mod Hub uses **Canonical Path Resolution**:

- The manager strips prefixes and resolves the core identity of every mod folder.
- Even if mods were renamed, disabled, or moved between categories, the profile engine tracks the true mod identity and applies your loadout cleanly without cross-character collisions.

---

## Sharing profiles via clipboard

You can share your presets with friends or backup your configurations:

- **Export to Clipboard:** Click the **Export** icon next to any profile. A compact JSON string is copied to your clipboard.
- **Import from Clipboard:** Click **Import Profile**, paste the JSON string, and the manager validates the mod list against your local library. If any mods are missing, it flags them so you can download them from GameBanana.
