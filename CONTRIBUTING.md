# Contributing to ZZZ Mod Hub

Thank you for your interest in contributing to ZZZ Mod Hub. This document outlines the development workflow, architecture invariants, and testing standards.

---

## Development setup

### Prerequisites

- **Node.js**: v20 or newer (`npm` v10+)
- **Rust**: Latest stable (`rustup default stable`) with `clippy` component installed
- **Platform**: Windows 10/11 (required for DirectX 11 in-game hooks and 3DMigoto/XXMI integration)

### Installation

```bash
# Clone the repository
git clone https://github.com/<owner>/ZZZ-Mod-Hub.git
cd ZZZ-Mod-Hub

# Install frontend dependencies (automatically configures Husky pre-commit hooks)
npm install
```

### Running locally

```bash
# Run the Tauri application in development mode
npm run tauri dev

# Run only the Vite frontend dev server (with mocked IPC)
npm run dev
```

---

## Architecture and invariants

Before writing code, review the core invariants that protect the codebase:

1. **Strict hash authority and zero name-based routing**:
   - All mod categorization, character identification, and component resolution must be grounded in 3DMigoto buffer hashes (`ib`, `vb`, `texture`).
   - Never use folder names, archive filenames, or internal strings to tiebreak, guess, or search for target folders.
   - If hashes are missing, ambiguous, or tied, leave the mod in `Unassigned`. False negatives are safe; false positives corrupt libraries.

2. **Domain separation and 3-layer architecture**:
   - `lib.rs` is an IPC dispatcher and facade router only, with zero business logic.
   - Backend logic is structured into 3 distinct layers: `core/` (pure models, errors, low-level math), `services/` (business engines), and `infra/` (OS, hardware, persistence).
   - Domain logic lives in focused service modules (`services/install`, `services/mod_fixer`, `services/mod_splitter`, `services/mod_viewer`).
   - For full design diagrams and module breakdowns, see [DEVELOPMENT.md](./DEVELOPMENT.md).

3. **Panic safety**:
   - Production code must never use bare `.unwrap()` or `.expect()` that could crash the Tauri runtime.
   - Use typed `AppError` variants and propagate errors across the IPC boundary.

4. **Internationalization (i18n)**:
   - Every user-facing UI string must be registered in `src/locales/en.json` first.
   - Never use bare fallback strings in JSX.
   - Enforced automatically via `npm run check:i18n`.

5. **Portaled modals**:
   - All dialogs and popups must render via `<Modal>` / `<ModalPortal>` from `src/components/ui/Modal.tsx` or `createPortal(..., document.body)`.
   - Never render raw inline `fixed inset-0` overlays.
   - Enforced automatically via `npm run check:modals`.

---

## Verification and testing protocol

Before submitting a pull request, verify that all automated checks pass cleanly:

### 1. Frontend preflight check

```bash
npm run check
```

This runs:

- `tsc --noEmit` (TypeScript type check)
- `vitest run` (frontend unit tests)
- `node scripts/check-i18n.cjs` (translation key completeness check)
- `node scripts/check-modals.cjs` (portal modal integrity check)

### 2. Rust backend check

```bash
# Verify Clippy has ZERO warnings
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings

# Run all unit and integration tests
cargo test --manifest-path src-tauri/Cargo.toml
```

### 3. Headless CLI diagnostics check

```bash
cargo run --manifest-path src-tauri/Cargo.toml --bin zmm-cli -- health-check
```

---

## Database changes

Character entity definitions, skins, and 3DMigoto hash mappings belong to the companion database repository (`ZzzModManager-DB`).

- Never edit JSON files manually.
- All database modifications are executed by improving the pipeline scripts (`ingest_hashes.py`, `sync_to_app.py`, `health_check.py`).
- Run `python scripts/health_check.py` to ensure 100% character health score with 0 warnings.
