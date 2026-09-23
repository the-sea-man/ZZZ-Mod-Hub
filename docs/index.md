---
layout: home

hero:
  name: 'ZZZ Mod Hub'
  text: 'The Modern Mod Manager for Zenless Zone Zero'
  tagline: 'Strict buffer hash sorting, in-game Direct3D 11 menu, 3D model previews, patch-proof mod fixing, and 3-mode outfit splitting.'
  image:
    src: /logo.png
    alt: ZZZ Mod Hub Logo
  actions:
    - theme: brand
      text: Quick Start Guide
      link: /guides/getting-started
    - theme: alt
      text: Explore Features
      link: /guides/mod-management

features:
  - icon:
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>'
    title: Strict Buffer Hash Auto-Sorting
    details: Drag and drop any .zip, .7z, or .rar archive. The manager reads 3DMigoto buffer hashes to identify character entities accurately without guessing by folder names.
    link: /guides/mod-management
  - icon:
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" x2="10" y1="12" y2="12"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="15" x2="15.01" y1="13" y2="13"/><line x1="18" x2="18.01" y1="11" y2="11"/><rect width="20" height="12" x="2" y="6" rx="6"/></svg>'
    title: Direct3D 11 In-Game HUD Menu
    details: Press H in-game to switch character skins, cycle multi-variant outfits, and view active mod hotkeys directly on screen without alt-tabbing.
    link: /guides/in-game-hud
  - icon:
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L4.3 4.3"/><path d="m19.7 4.3-6.528 6.528A4 4 0 0 0 12 13.7"/></svg>'
    title: 3-Mode Mod Splitter
    details: Split composite mods by character pack, by accessory toggle (glasses, jackets, weapons), or by anatomical body parts to mix and match outfits.
    link: /guides/mod-splitter
  - icon:
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>'
    title: Patch-Proof Mod Fixer
    details: Migrate older mods broken by game updates. Automatically syncs byte strides, converts vertex buffers, and recalculates submesh match indices.
    link: /guides/mod-fixer
  - icon:
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.12 6.4-6.05-4.06a2 2 0 0 0-2.17-.05L2.95 6.4a2 2 0 0 0-.95 1.7v8.8a2 2 0 0 0 .95 1.7l6.05 4.06c.67.45 1.54.45 2.21 0l6.05-4.06a2 2 0 0 0 .95-1.7V8.1a2 2 0 0 0-.95-1.7z"/><polyline points="3.29 7 12 12.8 20.71 7"/><line x1="12" y1="22.8" x2="12" y2="12.8"/></svg>'
    title: In-App 3D Mesh Viewer
    details: Inspect 3D models with PBR textures (diffuse, normal, lightmaps), camera presets, wireframe mode, and submesh toggles before opening the game.
    link: /guides/3d-viewer
  - icon:
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>'
    title: In-Game Quick Snapper
    details: Press Ctrl + F11 while in-game to snap and crop custom 360x450 preview thumbnails directly for your mod cards.
    link: /guides/in-game-hud
  - icon:
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>'
    title: Interactive Backups & History Undo
    details: Inspect backup timestamps and file sizes in a dedicated comparison modal. Restore original files with 1 click or undo recent file operations.
    link: /guides/backups-and-history
  - icon:
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>'
    title: Language Hub & 50+ Languages
    details: Fully translated into 9 built-in languages, with an integrated machine translator that generates custom language packs in one click.
    link: /guides/customization
---
