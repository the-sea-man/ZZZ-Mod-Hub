# Presets & Profiles

Mod profiles allow you to save entire loadouts of active mods and switch between them in seconds.

---

## Why Use Profiles?

Zenless Zone Zero players often want different visual styles depending on their mood:

- A "Casual Streetwear" profile for daily commissions.
- A "Combat Armor" profile for Hollow Zero runs.
- A "Clean & Vanilla" profile for testing new patches.

Instead of toggling 30 individual mods one by one, a profile remembers exactly which mods are enabled and disabled across all characters.

---

## Creating and Applying Profiles

1. In the top library toolbar, click the **Presets / Profiles** button.
2. The **Mod Profiles** modal opens:
   - **Save Current Loadout as Profile:** Enter a name (e.g. `Hollow Zero Outfit Set`) and click **Save**.
   - **Apply Profile:** Select any saved preset from the list and click **Load**. All mods will automatically switch to the saved state.
   - **Active Badge:** The currently loaded profile name is displayed directly on the library toolbar.

---

## Hardened Canonical Path Matching

Previous mod managers often suffered from a nasty bug: if a mod folder was renamed with a `DISABLED_` prefix, swapping profiles could fail to recognize it or accidentally create duplicate entries.

ZZZ Mod Hub uses **Canonical Path Resolution**:

- The manager strips prefixes and resolves the core identity of every mod folder.
- Even if mods were renamed, disabled, or moved between categories, the profile engine tracks the true mod identity and applies your loadout cleanly without cross-character collisions.

---

## Sharing Profiles via Clipboard

You can share your presets with friends or backup your configurations:

- **Export to Clipboard:** Click the **Export** icon next to any profile. A compact JSON string is copied to your clipboard.
- **Import from Clipboard:** Click **Import Profile**, paste the JSON string, and the manager validates the mod list against your local library. If any mods are missing, it flags them so you can download them from GameBanana.
