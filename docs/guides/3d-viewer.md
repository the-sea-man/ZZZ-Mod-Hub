# 3D Mesh Viewer & Advanced Mode

ZZZ Mod Hub includes a built-in Three.js WebGL 3D model viewer, allowing you to preview character skins, inspect submeshes, and check textures before ever booting up the game.

---

## Launching the 3D Viewer

1. Navigate to any character mod in your library.
2. Click the **3D Preview / Advanced** button on the mod card (cube icon).
3. The viewport opens, parsing the 3DMigoto binary vertex buffers (`.buf`) and texture maps (`.dds` / `.png`).

::: tip Enabling Advanced Features
If the 3D Preview button is not visible on your cards, ensure **Advanced Features** is toggled on under **Settings > Mod Management**.
:::

---

## Viewport Controls & Camera Presets

- **Orbit Camera:** Left-click and drag to rotate around the model.
- **Pan:** Right-click and drag to move the camera horizontally and vertically.
- **Zoom:** Mouse wheel scroll.

### Quick Camera Angles

Use the floating camera toolbar at the top of the viewport to instantly jump to common viewpoints:

- **Face Angle:** Focuses close up on facial expressions, eyes, and hair accessories.
- **Full Body:** Centers the entire character outfit.
- **Feet / Shoes:** Zooms into footwear, boots, and ground-level geometry.

---

## Shading & Material Inspection

ZZZ character models use multi-map physically based rendering (PBR). In the 3D viewer toolbar, you can inspect each channel:

- **Full Shading (Default):** Blends diffuse, normal maps, and lightmaps for an in-game representation.
- **Wireframe Mode:** Renders the underlying polygonal mesh topology. Useful for checking polygon density or verifying clean splits.
- **Texture Channel Toggles:** Toggle Diffuse, Normal, or Specular maps individually to diagnose texture alignment bugs.

---

## Submesh Isolation

Complex character mods are composed of multiple draw calls:

- Head & Hair
- Body & Outfit
- Weapon / Props
- Outer Accessories (glasses, ribbons, jackets)

In the viewer sidebar, you can toggle individual submeshes on or off to inspect parts independently.

---

## Potato Mode Optimization

Rendering dense high-poly meshes with 4K textures in a desktop app can consume memory on budget GPUs:

- When running in **Potato / Low Power** mode, the 3D viewer automatically downscales textures to 50% resolution and clamps vertex buffer decoding.
- This allows smooth 60 FPS previews even on laptops with integrated Intel/AMD graphics.
