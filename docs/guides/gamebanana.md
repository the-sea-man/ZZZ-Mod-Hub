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

## High-Speed & resilient downloads

GameBanana file servers can occasionally suffer from rate limits, slow speeds, or dead mirror links. ZZZ Mod Hub includes built-in network protections:

### 1. 4-Chunk multi-threaded parallel downloads

For any mod archive larger than 5MB, the manager splits the download stream into 4 concurrent byte-range requests. This maximizes your bandwidth and cuts download times significantly.

### 2. Automatic Cloudflare CDN failover

If the primary GameBanana download node times out, returns HTTP 500/503 errors, or fails integrity checks:

- The downloader automatically catches the failure.
- It switches to fallback Cloudflare mirror endpoints automatically without interrupting your download or prompting you with error dialogs.

---

## One-Click mod updates

Mod authors frequently release updates to fix bugs, add new color variants, or support new game patches.

### How to check for updates:

1. In your **Library**, click the **Check for Updates** button in the toolbar.
2. The manager queries the GameBanana API in efficient batches of 50 to compare your installed mod version against the latest online submission.
3. If an update is found, an update banner appears on the mod card.
4. Click **Update** to download the new version and replace the older files safely.
