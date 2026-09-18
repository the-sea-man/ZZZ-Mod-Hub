# Performance Modes

Not everyone runs on a high-end desktop. ZZZ Mod Hub is built with an **Infrastructure Over Rules** mindset, meaning resource-heavy features are strictly opt-in and configurable.

---

## The Three Performance Profiles

Under **Settings > Performance**, you can switch between three tailored operational profiles:

### 1. High Power Mode

- **Target Hardware:** Dedicated gaming PCs with 6+ CPU cores and fast NVMe storage.
- **File System Watcher:** Real-time active watching. Files added, deleted, or moved externally in Windows Explorer show up immediately in the manager without pressing refresh.
- **Conflict & Warning Scanners:** Asynchronous scanning runs continuously in the background whenever mods are toggled or modified.
- **Thumbnail Prewarming:** Automatically generates 360x450 JPEG thumbnails in parallel using Rayon threads for instant scrolling.

### 2. Balanced Mode (Default & Recommended)

- **Target Hardware:** Mid-range PCs and modern gaming laptops.
- **File System Watcher:** Debounced folder events to reduce disk I/O.
- **Conflict & Warning Scanners:** Scans run only when you switch categories or install new mods.
- **Memory Optimization:** Bounded cache sizes to prevent background memory growth.

### 3. Potato / Low Power Mode

- **Target Hardware:** Budget laptops, handheld PCs (Steam Deck, ROG Ally), or older machines running on battery.
- **File System Watcher:** Completely disabled. The app will never poll your disk in the background. Use the **Reload** button in the toolbar when you make external changes.
- **Scanners:** On-demand only. Warning badges and conflict detections only run when you explicitly click **Scan** or use a fixer tool.
- **3D Viewer Optimization:** Drops texture resolutions to half-size and enables simplified mesh rendering to minimize GPU VRAM usage.

---

## Individual Performance Toggles

If you prefer custom control, you can fine-tune specific subsystems in **Settings**:

- **Hardware Acceleration:** Toggle Chromium hardware acceleration for the UI. Disable if you experience GPU driver conflicts with 3DMigoto overlays.
- **Thumbnail Generation:** Enable or disable pre-caching mod preview images.
- **Animation Effects:** Turn off UI motion and transitions for an instant, snappier interface.
- **In-Game Overlay UI:** Disable in-game HUD generation if you only want desktop-side mod management.
