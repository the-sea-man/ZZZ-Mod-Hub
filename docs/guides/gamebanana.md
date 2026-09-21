# GameBanana Discover & downloader

ZZZ Mod Hub integrates directly with GameBanana's API, allowing you to discover, download, and update mods without opening a web browser.

---

## Exploring the Discover feed

Click the **Discover** tab in the main navigation sidebar to browse mods:

- **Featured & Trending:** Curated and popular mods for Zenless Zone Zero.
- **Recent Submissions:** The newest mods uploaded by the community.
- **Character Filtering:** Filter the feed by specific agents (Ellen, Miyabi, Jane, Zhu Yuan, etc.).
- **Tools & Utilities:** Dedicated tab for 3DMigoto scripts, HUD overlays, and launchers.
- **Downloaded Tracker:** Easily view which online mods you already have installed locally.

---

## Browsing & installing mods

When you find a mod you want to try, installing it takes a single click:

1. Click **Install** directly on the mod card, or open the preview modal to view author screenshots and description notes.
2. The manager begins downloading the archive in the background.
3. **Download History Panel (Bottom-Left Sidebar):** Look at the bottom-left corner of the manager window. An expandable download drawer shows your active and recent downloads:
   - Real-time download speed (e.g. `12.4 MB/s`) and progress bar.
   - Target destination folder (automatically resolved by buffer hash, e.g. `Mods/JaneDoe/`).
   - Quick navigation buttons: click the card icon to jump directly to the newly installed mod in your library, or the folder icon to open it in Windows Explorer.

<div class="guide-video-wrapper">
  <video controls playsinline class="guide-video" src="/videos/install-mod-gamebanana.mp4"></video>
  <div class="guide-video-caption">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    <span><strong>Video walkthrough:</strong> Downloading a mod from Discover and inspecting the download history panel</span>
  </div>
</div>

## High-Speed & resilient downloads

GameBanana file servers can occasionally suffer from rate limits, slow speeds, or dead mirror links. ZZZ Mod Hub includes built-in network protections:

### 1. 4-Chunk multi-threaded parallel downloads

For any mod archive larger than 5MB, the manager splits the download stream into 4 concurrent byte-range requests. This maximizes your bandwidth and cuts download times significantly.

### 2. Automatic Cloudflare CDN failover

If the primary GameBanana download node times out, returns HTTP 500/503 errors, or fails integrity checks:

- The downloader automatically catches the failure.
- It switches to fallback Cloudflare mirror endpoints automatically without interrupting your download or prompting you with error dialogs.

---

## Preview images for mods without one

Many GameBanana uploads do not include a `preview.png`, so their library cards show the character's default art instead of the mod. The app can show the mod's first GameBanana screenshot on those cards.

Turn it on in **Settings > Downloads > Online Previews for Mods Without Images**. It is off by default because it contacts GameBanana.

What to expect:

- **It only covers mods you downloaded through the app.** Those remember their GameBanana page. A mod you installed from an archive on your drive has no link back to GameBanana, so it keeps the character art.
- **A mod's own preview always wins.** If the mod folder has a `preview.png` or `preview.jpg`, that is what you see.
- **The image loads from GameBanana, it is not saved.** You need to be online to see it. Offline, the card falls back to the character art.
- **Each mod is checked once per session.** Mods with no screenshot on GameBanana are not asked about again until you restart the app.

To give a mod a permanent image of your own, use [Quick Snapper](./in-game-hud.md) or the image cropper from the mod card menu. That saves a real `preview.png` into the mod folder.

## One-Click mod updates

Mod authors frequently release updates to fix bugs, add new color variants, or support new game patches.

### How to check for updates:

1. In your **Library**, click the **Check for Updates** button in the toolbar.
2. The manager queries the GameBanana API in efficient batches of 50 to compare your installed mod version against the latest online submission.
3. If an update is found, an update banner appears on the mod card.
4. Click **Update** to download the new version and replace the older files safely.
