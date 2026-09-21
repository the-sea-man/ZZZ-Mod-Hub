//! Loads the vanilla baseline from disk, once per process.
//!
//! The parsing and the questions live in `core::vanilla_baseline`; this is only the filesystem
//! half. The file ships beside `characters.json` and is located the same way, because the binary
//! runs from several working directories (app bundle, `cargo test`, `zmm-cli`).
//!
//! A missing or malformed file is not an error: callers fall back to their built-in tables, so an
//! Agent with no dump behaves exactly as before.

use std::path::PathBuf;
use std::sync::OnceLock;

use crate::core::vanilla_baseline::VanillaBaselines;

static BASELINES: OnceLock<Option<VanillaBaselines>> = OnceLock::new();

fn candidates() -> Vec<PathBuf> {
    vec![
        PathBuf::from("src/vanilla_baselines.json"),
        PathBuf::from("../src/vanilla_baselines.json"),
        PathBuf::from("../../src/vanilla_baselines.json"),
        PathBuf::from("vanilla_baselines.json"),
    ]
}

/// The baseline library, or `None` when no dump-derived data is available.
pub fn baselines() -> Option<&'static VanillaBaselines> {
    BASELINES
        .get_or_init(|| {
            for path in candidates() {
                let Ok(text) = std::fs::read_to_string(&path) else { continue };
                match VanillaBaselines::parse(&text) {
                    Ok(b) if !b.is_empty() => return Some(b),
                    Ok(_) => continue,
                    Err(e) => {
                        crate::infra::logger::log_error(
                            "vanilla_baseline",
                            &format!("{} is malformed: {e}", path.display()),
                            Some("falling back to the built-in sub-draw table"),
                        );
                        continue;
                    }
                }
            }
            None
        })
        .as_ref()
}
