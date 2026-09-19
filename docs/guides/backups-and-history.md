# Backups & Operation History

Modding can be unpredictable. An unexpected patch, an experimental split, or an accidental file deletion shouldn't ruin your library. ZZZ Mod Hub includes two recovery tools: **Interactive Mod Backups** and **Dual-Track Operation History**.

---

## Interactive Mod Backups

Whenever the manager modifies a mod (applying a patch fix, running a script repair, or remapping vertex buffers), it automatically archives the untouched originals into a `.zmm-backup/` subfolder.

### How to Restore a Mod from Backup

When a backup exists for a mod, a **Rollback** badge appears on its card:

1. Click the **Rollback** badge, or click the card menu (`...`) and select **Restore from Backup**.
2. The **Restore Backup Inspection Modal** opens:
   - **Timestamp:** Shows the exact date and time the backup was created.
   - **File Size Comparison:** Compares current files against backup originals (highlighting differences in bytes and file counts).
   - **Selective Rollback:** Choose to restore specific files (e.g. only the `.ini` script while keeping new textures) or restore the entire directory.
3. Click **Restore Files**. The original files are swapped back into place immediately.

::: tip Non-Destructive Safety
Restoring a backup does not delete your backup archive. If you change your mind, you can re-apply fixes or switch back at any time.
:::

---

## Dual-Track Operation History

Under **Settings > Operation History**, the manager maintains two dedicated, thread-safe logs:

### 1. Alterations Log (`alterations.log` / `.jsonl`)

Records every filesystem change made through the manager:

- Mod folder installations and extractions
- Renames and category relocations
- Enabled/disabled toggles
- Patch fixes and split operations

### 2. Errors Log (`errors.log` / `.jsonl`)

Captures detailed diagnostic context:

- Incomplete archives or corrupted files
- Windows file access locks
- Network timeouts during GameBanana downloads
- INI syntax parsing warnings

---

## 1-Click Operation Rollback

In the **Operation History** panel:

- Each past action displays an **Undo** button (if the action is safe to revert).
- For example, if you accidentally moved 20 mods to the wrong category, or ran an auto-sort you want to revert, click **Undo** next to the operation to reverse the action automatically.
