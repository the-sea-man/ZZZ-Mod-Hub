//! Headless CLI validation tool for ZzzModManager (zmm-cli).
//!
//! Provides automated verification for CI, scripts, and manual diagnosis without
//! needing to launch the GUI or spawn a WebView.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use serde::Serialize;
use zzzmodmanager_tauri_lib::models::ModWarning;

#[derive(Debug, Clone)]
struct CliConfig {
    command: Command,
    json: bool,
    db_path: Option<PathBuf>,
}

#[derive(Debug, Clone)]
enum Command {
    VerifyMods { dir: PathBuf },
    VerifyMod { dir: PathBuf, quality: String },
    HealthCheck,
    Help,
}

#[derive(Serialize)]
struct ModsAuditReport {
    mods_dir: String,
    db_path: String,
    total_categories: usize,
    total_mods: usize,
    enabled_mods: usize,
    disabled_mods: usize,
    total_warnings: usize,
    severities: HashMap<String, usize>,
    warnings: HashMap<String, Vec<ModWarning>>,
    status: String,
}

#[derive(Serialize)]
struct SingleModAuditReport {
    mod_path: String,
    is_valid: bool,
    meshes_count: usize,
    total_vertices: usize,
    total_indices: usize,
    textures_count: usize,
    toggles_count: usize,
    suggested_tags: Vec<String>,
    script_warnings: Vec<ModWarning>,
    status: String,
    error: Option<String>,
}

#[derive(Serialize)]
struct HealthCheckReport {
    db_path: String,
    is_valid: bool,
    total_characters: usize,
    total_hashes_indexed: usize,
    generic_shared_hashes: usize,
    fixer_rules_loaded: usize,
    status: String,
    errors: Vec<String>,
}

fn print_help() {
    println!(
        r#"
========================================================================
  ZzzModManager Headless CLI (zmm-cli)
========================================================================

USAGE:
    zmm-cli <COMMAND> [OPTIONS]

COMMANDS:
    verify-mods <MODS_DIR>   Audit an entire mods directory for conflicts,
                             corrupt files, and script integrity warnings.
    verify-mod  <MOD_DIR>    Deeply inspect and parse a single mod folder,
                             verifying 3D meshes, textures, toggles, and INIs.
    health-check             Audit character databases and migration rules.
    help                     Display this help message.

OPTIONS:
    --json                   Output machine-readable JSON (ideal for CI).
    --db <PATH>              Explicit path to character database (characters.json).
    --quality <QUALITY>      Mesh parse quality for verify-mod: potato | fast | full.
                             Default: potato.
    -h, --help               Display this help message.

EXAMPLES:
    zmm-cli verify-mods "C:\Games\ZZZ\Mods"
    zmm-cli verify-mods "C:\Games\ZZZ\Mods" --json
    zmm-cli verify-mod  "fixtures/fixture_character_mod"
    zmm-cli health-check --db "src/characters.json"
"#
    );
}

fn resolve_db_path(explicit: Option<&PathBuf>) -> PathBuf {
    if let Some(p) = explicit {
        if p.exists() {
            return p.clone();
        }
    }

    let candidates = [
        PathBuf::from("src/characters.json"),
        PathBuf::from("../src/characters.json"),
        PathBuf::from("characters.json"),
        PathBuf::from("playable_characters.json"),
        PathBuf::from("../ZzzModManager-DB/playable_characters.json"),
        PathBuf::from("../../ZzzModManager-DB/playable_characters.json"),
        PathBuf::from("fixtures/fixture_character_mod"),
    ];

    for c in candidates {
        if c.exists() {
            return c;
        }
    }

    PathBuf::from("characters.json")
}

fn parse_cli_args() -> Result<CliConfig, String> {
    let args: Vec<String> = std::env::args().skip(1).collect();

    if args.is_empty() {
        return Ok(CliConfig {
            command: Command::Help,
            json: false,
            db_path: None,
        });
    }

    let mut json = false;
    let mut db_path = None;
    let mut quality = "potato".to_string();
    let mut positional: Vec<String> = Vec::new();

    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--json" => {
                json = true;
            }
            "--db" => {
                i += 1;
                if i < args.len() {
                    db_path = Some(PathBuf::from(&args[i]));
                } else {
                    return Err("Missing argument for --db".to_string());
                }
            }
            "--quality" => {
                i += 1;
                if i < args.len() {
                    quality = args[i].clone();
                } else {
                    return Err("Missing argument for --quality".to_string());
                }
            }
            "-h" | "--help" | "help" => {
                return Ok(CliConfig {
                    command: Command::Help,
                    json: false,
                    db_path: None,
                });
            }
            arg => {
                if !arg.starts_with('-') {
                    positional.push(arg.to_string());
                } else {
                    return Err(format!("Unknown option: {}", arg));
                }
            }
        }
        i += 1;
    }

    if positional.is_empty() {
        return Ok(CliConfig {
            command: Command::Help,
            json,
            db_path,
        });
    }

    let cmd_name = positional[0].to_lowercase();
    let command = match cmd_name.as_str() {
        "verify-mods" | "verifymods" | "scan" => {
            if positional.len() < 2 {
                return Err("verify-mods requires a directory path: zmm-cli verify-mods <MODS_DIR>".to_string());
            }
            Command::VerifyMods {
                dir: PathBuf::from(&positional[1]),
            }
        }
        "verify-mod" | "verifymod" | "check-mod" => {
            if positional.len() < 2 {
                return Err("verify-mod requires a mod path: zmm-cli verify-mod <MOD_DIR>".to_string());
            }
            Command::VerifyMod {
                dir: PathBuf::from(&positional[1]),
                quality,
            }
        }
        "health-check" | "healthcheck" | "health" => Command::HealthCheck,
        "help" => Command::Help,
        other => return Err(format!("Unknown command '{}'. Run 'zmm-cli help' for usage.", other)),
    };

    Ok(CliConfig {
        command,
        json,
        db_path,
    })
}

fn execute_verify_mods(dir: &Path, db_path: &Path, json: bool) -> ExitCode {
    if !dir.exists() || !dir.is_dir() {
        if json {
            println!(
                "{}",
                serde_json::to_string_pretty(&serde_json::json!({
                    "status": "error",
                    "error": format!("Directory does not exist: {}", dir.display())
                }))
                .unwrap_or_default()
            );
        } else {
            eprintln!("[ERROR] Directory does not exist: {}", dir.display());
        }
        return ExitCode::from(1);
    }

    let categories = match zzzmodmanager_tauri_lib::mods::scan_mods_folder_sync(
        &dir.to_string_lossy(),
        None,
    ) {
        Ok(cats) => cats,
        Err(e) => {
            if json {
                println!(
                    "{}",
                    serde_json::to_string_pretty(&serde_json::json!({
                        "status": "error",
                        "error": format!("Scan failed: {}", e)
                    }))
                    .unwrap_or_default()
                );
            } else {
                eprintln!("[ERROR] Scan failed: {}", e);
            }
            return ExitCode::from(1);
        }
    };

    let warnings_map = zzzmodmanager_tauri_lib::warnings_scanner::scan_warnings(
        &dir.to_string_lossy(),
        &db_path.to_string_lossy(),
    );

    let total_categories = categories.len();
    let mut total_mods = 0;
    let mut enabled_mods = 0;
    let mut disabled_mods = 0;

    for cat in &categories {
        for m in &cat.mods {
            total_mods += 1;
            if m.is_enabled {
                enabled_mods += 1;
            } else {
                disabled_mods += 1;
            }
        }
    }

    let mut severities: HashMap<String, usize> = HashMap::new();
    let mut total_warnings = 0;
    let mut has_crash_risk = false;

    for list in warnings_map.values() {
        for w in list {
            total_warnings += 1;
            *severities.entry(w.level.clone()).or_insert(0) += 1;
            if w.level == "crash_risk" {
                has_crash_risk = true;
            }
        }
    }

    let status = if has_crash_risk {
        "fail".to_string()
    } else if total_warnings > 0 {
        "warn".to_string()
    } else {
        "pass".to_string()
    };

    if json {
        let report = ModsAuditReport {
            mods_dir: dir.to_string_lossy().to_string(),
            db_path: db_path.to_string_lossy().to_string(),
            total_categories,
            total_mods,
            enabled_mods,
            disabled_mods,
            total_warnings,
            severities,
            warnings: warnings_map,
            status,
        };
        println!("{}", serde_json::to_string_pretty(&report).unwrap_or_default());
    } else {
        println!("========================================================================");
        println!(" ZzzModManager - Mods Audit Report");
        println!("========================================================================");
        println!("Directory: {}", dir.display());
        println!("Database:  {}", db_path.display());
        println!("------------------------------------------------------------------------");
        println!(
            "Categories: {} | Total Mods: {} ({} enabled, {} disabled)",
            total_categories, total_mods, enabled_mods, disabled_mods
        );
        println!("Warnings:   {}", total_warnings);
        for (sev, count) in &severities {
            println!("  - {}: {}", sev, count);
        }

        if !warnings_map.is_empty() {
            println!("------------------------------------------------------------------------");
            println!("Detailed Findings:");
            for (mod_path, warns) in &warnings_map {
                let mod_name = Path::new(mod_path)
                    .file_name()
                    .map(|n| n.to_string_lossy())
                    .unwrap_or_else(|| mod_path.as_str().into());
                println!("\n  Mod: {}", mod_name);
                for w in warns {
                    println!("    [{}] {}", w.level.to_uppercase(), w.message);
                }
            }
        }

        println!("------------------------------------------------------------------------");
        if has_crash_risk {
            println!("RESULT: FAILED (High-risk or crash issues detected)");
        } else if total_warnings > 0 {
            println!("RESULT: PASSED WITH WARNINGS");
        } else {
            println!("RESULT: PASSED (All mods clean and validated)");
        }
        println!("========================================================================");
    }

    if has_crash_risk {
        ExitCode::from(1)
    } else {
        ExitCode::from(0)
    }
}

fn execute_verify_mod(dir: &Path, quality: &str, json: bool) -> ExitCode {
    if !dir.exists() || !dir.is_dir() {
        if json {
            println!(
                "{}",
                serde_json::to_string_pretty(&serde_json::json!({
                    "status": "error",
                    "error": format!("Mod directory does not exist: {}", dir.display())
                }))
                .unwrap_or_default()
            );
        } else {
            eprintln!("[ERROR] Mod directory does not exist: {}", dir.display());
        }
        return ExitCode::from(1);
    }

    let parsed = zzzmodmanager_tauri_lib::mod_viewer::parse_mod(
        &dir.to_string_lossy(),
        None,
        Some(quality),
    );

    let mut ini_files = Vec::new();
    zzzmodmanager_tauri_lib::utils::find_ini_files(dir, &mut ini_files, 0, 10);
    let mut script_warnings = Vec::new();
    for ini_path in &ini_files {
        if let Ok(content) = zzzmodmanager_tauri_lib::utils::read_ini_to_string(ini_path) {
            let rel_name = ini_path.strip_prefix(dir).unwrap_or(ini_path).to_string_lossy();
            let mut warns = zzzmodmanager_tauri_lib::warnings_scanner::analyze_ini_script_integrity(
                &content,
                &rel_name,
            );
            script_warnings.append(&mut warns);
        }
    }

    match parsed {
        Ok(payload) => {
            let total_vertices: usize = payload
                .meshes
                .iter()
                .map(|m| (m.positions.len() * 3 / 4) / 12)
                .sum();
            let total_indices: usize = payload
                .meshes
                .iter()
                .map(|m| (m.indices.len() * 3 / 4) / 2)
                .sum();

            if json {
                let report = SingleModAuditReport {
                    mod_path: dir.to_string_lossy().to_string(),
                    is_valid: true,
                    meshes_count: payload.meshes.len(),
                    total_vertices,
                    total_indices,
                    textures_count: payload.textures.len(),
                    toggles_count: payload.toggles.len(),
                    suggested_tags: payload.suggested_tags.clone(),
                    script_warnings,
                    status: "valid".to_string(),
                    error: None,
                };
                println!("{}", serde_json::to_string_pretty(&report).unwrap_or_default());
            } else {
                println!("========================================================================");
                println!(" ZzzModManager - Single Mod Inspection");
                println!("========================================================================");
                println!("Mod Path: {}", dir.display());
                println!("Status:   VALID");
                println!("------------------------------------------------------------------------");
                println!("Meshes ({}):", payload.meshes.len());
                for mesh in &payload.meshes {
                    let v_count = (mesh.positions.len() * 3 / 4) / 12;
                    let i_count = (mesh.indices.len() * 3 / 4) / 2;
                    let comp = mesh.component.as_deref().unwrap_or("General");
                    println!(
                        "  - [{}] {} vertices, ~{} indices, component: {}",
                        mesh.name, v_count, i_count, comp
                    );
                }
                println!("Totals:     {} vertices, {} indices", total_vertices, total_indices);
                println!("Textures:   {} detected/embedded", payload.textures.len());
                println!("Toggles:    {}", payload.toggles.len());
                for t in &payload.toggles {
                    println!("  - {} (values: {:?})", t.variable, t.values);
                }
                println!("Tags:       {:?}", payload.suggested_tags);

                if !script_warnings.is_empty() {
                    println!("------------------------------------------------------------------------");
                    println!("Script Warnings ({}):", script_warnings.len());
                    for w in &script_warnings {
                        println!("  [{}] {}", w.level.to_uppercase(), w.message);
                    }
                }
                println!("========================================================================");
            }
            ExitCode::from(0)
        }
        Err(e) => {
            if json {
                let report = SingleModAuditReport {
                    mod_path: dir.to_string_lossy().to_string(),
                    is_valid: false,
                    meshes_count: 0,
                    total_vertices: 0,
                    total_indices: 0,
                    textures_count: 0,
                    toggles_count: 0,
                    suggested_tags: Vec::new(),
                    script_warnings,
                    status: "invalid".to_string(),
                    error: Some(e.to_string()),
                };
                println!("{}", serde_json::to_string_pretty(&report).unwrap_or_default());
            } else {
                eprintln!("========================================================================");
                eprintln!(" ZzzModManager - Single Mod Inspection FAILED");
                eprintln!("========================================================================");
                eprintln!("Mod Path: {}", dir.display());
                eprintln!("Error:    {}", e);
                eprintln!("========================================================================");
            }
            ExitCode::from(1)
        }
    }
}

fn execute_health_check(db_path: &Path, json: bool) -> ExitCode {
    let mut errors = Vec::new();
    let mut is_valid = true;

    if !db_path.exists() {
        errors.push(format!("Database file/folder not found: {}", db_path.display()));
        is_valid = false;
    }

    let hash_alias_map = zzzmodmanager_tauri_lib::utils::build_hash_alias_map(db_path);
    let total_hashes = hash_alias_map.len();

    let mut character_ids = std::collections::HashSet::new();
    let mut generic_count = 0;

    for (hash, targets) in &hash_alias_map {
        if zzzmodmanager_tauri_lib::utils::is_generic_shared_hash(hash, &hash_alias_map) {
            generic_count += 1;
        }
        for t in targets {
            character_ids.insert(t.character_id.clone());
        }
    }

    let fixer_db = zzzmodmanager_tauri_lib::mod_fixer::load_fixer_database(Some(db_path));
    let fixer_rules_loaded = fixer_db.rules.len();

    if total_hashes == 0 {
        errors.push("No hashes were indexed from the character database.".to_string());
        is_valid = false;
    }

    let status = if is_valid && errors.is_empty() {
        "healthy".to_string()
    } else {
        "degraded".to_string()
    };

    if json {
        let report = HealthCheckReport {
            db_path: db_path.to_string_lossy().to_string(),
            is_valid,
            total_characters: character_ids.len(),
            total_hashes_indexed: total_hashes,
            generic_shared_hashes: generic_count,
            fixer_rules_loaded,
            status,
            errors,
        };
        println!("{}", serde_json::to_string_pretty(&report).unwrap_or_default());
    } else {
        println!("========================================================================");
        println!(" ZzzModManager - Database Health Check");
        println!("========================================================================");
        println!("Database Path:          {}", db_path.display());
        println!("Characters Indexed:     {}", character_ids.len());
        println!("Unique Hashes Mapped:   {}", total_hashes);
        println!("Generic Shared Hashes:  {}", generic_count);
        println!("Fixer Rules Loaded:     {}", fixer_rules_loaded);
        println!("------------------------------------------------------------------------");
        if is_valid && errors.is_empty() {
            println!("RESULT: HEALTHY (Database schema and hash indices fully valid)");
        } else {
            println!("RESULT: DEGRADED / UNHEALTHY");
            for err in &errors {
                eprintln!("  - [ERROR] {}", err);
            }
        }
        println!("========================================================================");
    }

    if is_valid {
        ExitCode::from(0)
    } else {
        ExitCode::from(1)
    }
}

fn main() -> ExitCode {
    let config = match parse_cli_args() {
        Ok(cfg) => cfg,
        Err(e) => {
            eprintln!("[ERROR] {}", e);
            eprintln!("Run 'zmm-cli help' for usage instructions.");
            return ExitCode::from(1);
        }
    };

    let db_path = resolve_db_path(config.db_path.as_ref());

    match config.command {
        Command::Help => {
            print_help();
            ExitCode::from(0)
        }
        Command::VerifyMods { dir } => execute_verify_mods(&dir, &db_path, config.json),
        Command::VerifyMod { dir, quality } => execute_verify_mod(&dir, &quality, config.json),
        Command::HealthCheck => execute_health_check(&db_path, config.json),
    }
}
