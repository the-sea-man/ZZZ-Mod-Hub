# 3-Mode Mod Splitter

Often you will download a composite mod pack containing multiple characters, or an outfit with a jacket you want to remove, or a hairstyle you want to use with another skin. The **3-Mode Mod Splitter** decomposes these archives into independent, toggleable mods.

---

## Accessing the Splitter

1. Enable **Advanced Mode** in **Settings > Mod Management**.
2. Click the **3D / Advanced** button on a mod card.
3. In the advanced tools sidebar, click **Split Mod**.

---

## The 3 Dedicated Split Modes

### Mode 1: Character Pack Decomposition

Many mod creators bundle multiple characters together (e.g. a pack containing Anby, Nicole, and Billy).

- **What it does:** Groups connected meshes and textures by buffer hash, then moves each character into its own folder (`Mods/Anby Swimsuit`, `Mods/Nicole Swimsuit`, `Mods/Billy Swimsuit`).
- **Benefit:** You can enable Anby's outfit while keeping Billy vanilla, without having to manually edit scripts.

### Mode 2: Accessories & Toggle Isolation

Mods frequently include optional accessories (e.g. sunglasses, hats, coats, jackets) controlled by hotkeys in 3DMigoto.

- **What it does:** Scans the `.ini` CommandLists and Key sections for conditional blocks. Isolates the accessory into its own sub-mod with an independent on/off toggle.
- **Benefit:** Permanently wear or remove an accessory without needing in-game toggle keys.

### Mode 3: Anatomical Body Part Splitting

For power modders who want to mix and match outfit parts across different creators:

- **What it does:** Decompiles the mesh and buffers into standard anatomical slots:
  - `Top / Shirt`
  - `Bottom / Pants / Skirt`
  - `Hair / Headwear`
  - `Weapon / Combat Gear`
- **Benefit:** Combine the hair from Mod A with the dress from Mod B.

---

## Monolithic Mesh Protection

Not every 3D model can be split cleanly into body parts:

- Some 3D artists sculpt a character as a **single unified mesh** (where vertices for the skin, shirt, and limbs share a single continuous polygon buffer).
- Slicing a monolithic mesh causes missing limbs, holes in geometry, or vertex explosion in-game.

### The Guardrail

Before splitting, the engine analyzes vertex index tables and UV coordinates:

- If it detects a **monolithic unified mesh**, it displays a warning dialog explaining that separating body parts will break geometry.
- You can still proceed with **Character Pack** or **Accessory** splitting safely, but anatomical body part splitting is guarded to protect your game from crashes.
