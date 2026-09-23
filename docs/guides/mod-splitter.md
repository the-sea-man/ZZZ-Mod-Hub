# 3-Mode Mod Splitter

Often you will download a composite mod pack containing multiple characters, or an outfit with a jacket you want to remove, or a hairstyle you want to use with another skin. The **3-Mode Mod Splitter** decomposes these archives into independent, toggleable mods.

---

## Accessing the splitter

1. Enable **Experimental Features** in **Settings > Advanced**.
2. Click the **Advanced** button on a mod card.
3. In the advanced tools sidebar, click **Split Mod**.

<div class="guide-video-wrapper">
  <video controls playsinline class="guide-video" src="/videos/3d-split-mod.mp4"></video>
  <div class="guide-video-caption">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    <span><strong>Video walkthrough:</strong> Decomposing a mod into independent components with the 3-Mode Splitter</span>
  </div>
</div>

---

## The 3 dedicated split modes

### Mode 1: character pack decomposition

Many mod creators bundle multiple characters together (e.g. a pack containing Anby, Nicole, and Billy).

- **What it does:** Groups connected meshes and textures by buffer hash, then moves each character into its own folder (`Mods/Anby Swimsuit`, `Mods/Nicole Swimsuit`, `Mods/Billy Swimsuit`).
- **Benefit:** You can enable Anby's outfit while keeping Billy vanilla, without having to manually edit scripts.

### Mode 2: accessories & toggle isolation

Mods frequently include optional accessories (e.g. sunglasses, hats, coats, jackets) controlled by hotkeys in 3DMigoto.

- **What it does:** Scans the `.ini` CommandLists and Key sections for conditional blocks. Isolates the accessory into its own sub-mod with an independent on/off toggle.
- **Benefit:** Permanently wear or remove an accessory without needing in-game toggle keys.

### Mode 3: anatomical body part splitting

For power modders who want to mix and match outfit parts across different creators:

- **What it does:** Decompiles the mesh and buffers into standard anatomical slots:
  - `Top / Shirt`
  - `Bottom / Pants / Skirt`
  - `Hair / Headwear`
  - `Weapon / Combat Gear`
- **Benefit:** Combine the hair from Mod A with the dress from Mod B.

---

## Monolithic mesh protection

Not every 3D model can be split cleanly into body parts:

- Some 3D artists sculpt a character as a **single unified mesh** (where vertices for the skin, shirt, and limbs share a single continuous polygon buffer).
- Slicing a monolithic mesh causes missing limbs, holes in geometry, or vertex explosion in-game.

### The guardrail

Before splitting, the engine analyzes vertex index tables and UV coordinates:

- If it detects a **monolithic unified mesh**, it displays a warning dialog explaining that separating body parts will break geometry.
- You can still proceed with **Character Pack** or **Accessory** splitting safely, but anatomical body part splitting is guarded to protect your game from crashes.
