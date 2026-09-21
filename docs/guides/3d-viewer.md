# 3D mesh viewer & advanced mode

ZZZ Mod Hub includes a built-in Three.js WebGL 3D model viewer, allowing you to preview character skins, inspect submeshes, and check textures before ever booting up the game.

---

## Launching the 3D viewer

1. Navigate to any character mod in your library.
2. Click the **3D Preview** button on the mod card (cube icon).
3. The viewport opens, parsing the 3DMigoto binary vertex buffers (`.buf`) and texture maps (`.dds` / `.png`).

<div class="guide-video-wrapper">
  <video controls playsinline class="guide-video" src="/videos/3d-viewing.mp4"></video>
  <div class="guide-video-caption">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    <span><strong>Video walkthrough:</strong> Inspecting models in 3D, toggling wireframe, submeshes, and Potato Mode</span>
  </div>
</div>

::: tip Enabling Advanced Features
If the 3D Preview button is not visible on your cards, ensure **Advanced Features** is toggled on under **Settings > Advanced**.
:::

---

## Viewport controls & camera presets

- **Orbit Camera:** Left-click and drag to rotate around the model.
- **Pan:** Right-click and drag to move the camera horizontally and vertically.
- **Zoom:** Mouse wheel scroll.

### Quick camera angles

Use the floating camera toolbar at the top of the viewport to instantly jump to common viewpoints:

- **Face Angle:** Focuses close up on facial expressions, eyes, and hair accessories.
- **Full Body:** Centers the entire character outfit.
- **Feet / Shoes:** Zooms into footwear, boots, and ground-level geometry.

---

## Shading & material inspection

ZZZ character models use multi-map physically based rendering (PBR). In the 3D viewer toolbar, you can inspect each channel:

- **Full Shading (Default):** Blends diffuse, normal maps, and lightmaps for an in-game representation.
- **Wireframe Mode:** Renders the underlying polygonal mesh topology. Useful for checking polygon density or verifying clean splits.
- **Texture Channel Toggles:** Toggle Diffuse, Normal, or Specular maps individually to diagnose texture alignment bugs.

---

## Submesh isolation

Complex character mods are composed of multiple draw calls:

- Head & Hair
- Body & Outfit
- Weapon / Props
- Outer Accessories (glasses, ribbons, jackets)

In the viewer sidebar, you can toggle individual submeshes on or off to inspect parts independently.

---

## Potato mode optimization

Rendering dense high-poly meshes with 4K textures in a desktop app can consume memory on budget GPUs:

- When running in **Potato / Low Power** mode, the 3D viewer automatically downscales textures to 50% resolution and clamps vertex buffer decoding.
- This allows smooth 60 FPS previews even on laptops with integrated Intel/AMD graphics.
