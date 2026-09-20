# GameBanana 1-Click Mod Installer Integration Guide

This document outlines the technical specification, Discord submission templates, and answers to administrator questions for enabling **1-Click Mod Install** on [GameBanana.com](https://gamebanana.com) for **ZZZ Mod Hub**.

---

## 1. Discord Communication Guidelines

> [!IMPORTANT]
> **Who to contact**: Ping **`@tom`** directly in the `#mod-manager-creators` / `#1-click-installer-dev` channel.
> **Do NOT ping `@MythsList`**: MythsList is a Discord moderator not involved in backend 1-Click configuration and has explicitly requested not to be pinged for mod manager requests.

---

## 2. Discord Submission Message (Ready to Send to `@tom`)

Copy and paste this message into the channel:

```text
Howdy @tom and the GameBanana team!

I'd like to request GameBanana 1-Click Mod Installer & Remote Install integration for ZZZ Mod Hub, the dedicated mod manager for Zenless Zone Zero (Game ID: 19567).

• Tool Submission: https://gamebanana.com/tools/XXXXX (replace with your tool page URL)
• Target Game: Zenless Zone Zero (Game ID: 19567)
• Protocol Scheme: zzzmm
• 1-Click URL Format: zzzmm:{downloadUrl},Mod,{modId}
  Example: zzzmm:https://gamebanana.com/mmdl/[FILE-ID]?toolid=[TOOL-ID],Mod,[MOD-ID]
• Remote Install Pair Command: zzzmm://pair/{SecretKey}/{MemberId} (or zzzmm:{SecretKey},{MemberId})
• Remote Install Queue Alias: ZzzModManager
• Remote Install Queue Format: [ '{downloadURL},Mod,{modID}' ] (or direct mmdl URLs)
• Supported Archive Formats: .zip, .rar, .7z
• Archive Requirement (Regex): .*\.ini$
  (All 3DMigoto/ZZMI mods in ZZZ require a .ini script. This automatically filters out standalone tools, executables, cheat tables, or non-mod uploads)

Supported Categories:
• Character Skins (Cat ID: 30305 - includes all subcategories)
• Bangboo Skins (Cat ID: 30702 - includes all subcategories)
• UI (Cat ID: 30395 - includes all subcategories)
• Other/Misc (Cat ID: 29874 - includes all subcategories)

Unsupported / Excluded:
• Standalone Tools / Executables (.exe)
• Cheat Tables (.ct)
• Archives without a .ini configuration file

Technical Readiness & Compliance:
1. Mod Manager Logging (Download Stats Beta): Fully tested and supported. Our client preserves the ?toolid={toolid} parameter on mmdl URLs to ensure download counts log accurately.
2. Remote Install Support: Fully implemented with automatic browser pairing (`zzzmm://pair/...`), secure credential storage in user preferences, and polite non-hammering queue polling (runs once on app launch + user on-demand button).
3. Sharding & Infrastructure: We do NOT hardcode or bypass to filecache nodes. We use the official mmdl endpoints and follow the 302 redirection shard assigned by GameBanana's system.
4. Traffic Identification: All client requests send an explicit `User-Agent: ZzzModManager/1.0` header.
5. Security & Privileges: Protocol is registered strictly under `HKCU\Software\Classes\zzzmm` (zero UAC admin prompts required). Includes domain whitelisting, SSRF guards, open-redirect protection, and Zip Slip prevention.

App icon: (Attached 32x32 transparent PNG from src-tauri/icons/32x32.png)

Whenever you are ready, please let me know if you need any adjustments or if you would like me to test on the dev toggle first! Thank you!
```

---

## 3. How to Answer Admin / Discord Scrutiny Questions

If Tom, administrators, or community members ask follow-up questions, here are the exact technical answers:

### Q1: "Are you bypassing sharding or hardcoding filecacheX nodes?"

> **Answer**: _"No. We do not hardcode or bypass to filecache nodes. Our client sends its download request directly to the official `mmdl` (or `files.gamebanana.com`) endpoint and follows the standard HTTP 302 redirect to whatever CDN shard GameBanana designates. This ensures our traffic fully participates in your global cache and sharding infrastructure."_

### Q2: "How do you identify your traffic?"

> **Answer**: _"Every network request made by our app carries the header `User-Agent: ZzzModManager/1.0`. Your ops and infrastructure teams can easily identify, filter, or log our requests."_

### Q3: "Does your manager support the Download Stats Beta / `?toolid={toolid}` parameter?"

> **Answer**: _"Yes. We specifically added test coverage for the `?toolid={toolid}` query parameter on `mmdl` URLs. Our parser handles comma-separated, query-style, and URL-encoded formats, retaining query arguments when connecting so download counts register accurately on your tool dashboard."_

### Q4: "How does your Remote Install implementation work and does it hammer the server?"

> **Answer**: *"Our Remote Install client is designed to be server-friendly:
>
> 1. **Pairing**: We support both `zzzmm://pair/{secretKey}/{memberId}` and `zzzmm:{secretKey},{memberId}`. When the user clicks 'Enroll & Pair' on GameBanana, our client captures the credentials and stores them locally in app preferences.
> 2. **Polling Frequency**: We intentionally avoid aggressive polling loops. By default, the client checks the queue once on application startup (when the user turns on their PC / launches the app) and provides a manual 'Check Remote Queue' button in Settings.
> 3. **Queue Processing**: When `GET /apiv11/RemoteInstall/{memberID}/{secretKey}/{alias}` returns queued items, they are routed directly through our safe 1-Click extraction pipeline."*

### Q5: "What happens if an archive has a weird folder structure or is split across folders?"

> **Answer**: _"ZZZ Mod Hub uses 3DMigoto buffer hash scanning (`ib`, `vb`, `texture`). Regardless of how authors name their folders or how deeply nested the files are (e.g. `Archive/Release/Mod/Character/`), the client unrolls redundant single-child directories, scans the vertex/index hashes against the canonical character database, and routes the files directly to the correct Agent folder in the user's mods directory."_

### Q6: "What security measures prevent malicious links from executing arbitrary code?"

> **Answer**:
>
> 1. **Zero Admin Privileges**: We write only to `HKEY_CURRENT_USER\Software\Classes\zzzmm`, never touching `HKLM` or requesting UAC elevation.
> 2. **Strict Origin Whitelisting**: Every 1-Click URL is validated against official GameBanana domains (`gamebanana.com`, `*.gamebanana.com`, `gbcdn.net`, `*.gbcdn.net`, `gamemods.com`). Non-HTTPS, local IPs, `file://`, `ftp://`, or arbitrary third-party hosts are rejected immediately.
> 3. **Open Redirect Defense**: Even if an attacker attempts an open redirect via a 302 bounce, every redirect hop is checked against the domain whitelist.
> 4. **Zip Slip Prevention**: Decompression strictly enforces enclosed relative paths (`file.enclosed_name()`), preventing directory traversal outside the staging directory.
> 5. **Process Injection Prevention**: URLs are parsed through structured string routines without invoking Windows `cmd.exe` or `powershell.exe`.

### Q7: "Can it be opt-in vs opt-out?"

> **Answer**: _"Because 100% of functional ZZZ 3DMigoto mods require an `.ini` file, configuring GameBanana's `archive_files_regex` to `.*\.ini$` guarantees that 1-Click buttons only appear on actual game mods. Standalone programs, guides, and tools will never display the button, so enabling it across the game's mod categories is safe and automatic for creators."_

---

## 4. Technical Reference Table

| Item                   | Value                                                                                  |
| :--------------------- | :------------------------------------------------------------------------------------- |
| **Game ID**            | `19567` (Zenless Zone Zero)                                                            |
| **Categories**         | `30305` (Character Skins), `30702` (Bangboo Skins), `30395` (UI), `29874` (Other/Misc) |
| **File Filter Regex**  | `.*\.ini$`                                                                             |
| **Formats**            | `.zip`, `.rar`, `.7z`                                                                  |
| **Protocol Scheme**    | `zzzmm`                                                                                |
| **1-Click URL Format** | `zzzmm:[FILE_URL],[ITEM_TYPE],[ITEM_ID]`                                               |
| **Remote Pair Format** | `zzzmm://pair/{SecretKey}/{MemberId}` or `zzzmm:{SecretKey},{MemberId}`                |
| **Remote Install API** | `GET https://gamebanana.com/apiv11/RemoteInstall/{memberID}/{secretKey}/ZzzModManager` |
| **Registry Path**      | `HKEY_CURRENT_USER\Software\Classes\zzzmm`                                             |
| **User-Agent**         | `ZzzModManager/1.0`                                                                    |
