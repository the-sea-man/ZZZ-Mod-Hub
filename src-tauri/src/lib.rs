pub mod core;
pub mod services;
pub(crate) mod infra;

// Facades ensuring existing call sites, tests, and CLI continue working unchanged:
pub use core::{error, models, utils};
pub use services::{install, mod_fixer, mod_viewer, mods, warnings_scanner};
pub(crate) use infra::{
    fs_ops, game_ops, hotreload, hunting, ini_ops, screenshot, state_tracker, task_manager,
    thumbnail_cache, watcher,
};
pub(crate) use services::{
    community_tags, conflict_scanner, gamebanana, mod_splitter, sync, ui_generator,
};

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            app.manage(watcher::WatcherState::default());
            app.manage(hotreload::HotreloadState::default());
            std::thread::spawn(|| {
                utils::cleanup_legacy_installations();
            });
            Ok(())
        })
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            // mods.rs — Core scanner
            mods::scan_mods_folder,
            mods::get_cached_mods_folder,
            mods::scan_broken_mods,
            // watcher.rs — Live directory watching
            watcher::start_folder_watch,
            // game_ops.rs — Game state operations
            game_ops::toggle_mod,
            game_ops::bulk_toggle_mods,
            game_ops::randomize_mods,
            game_ops::disable_all_mods,
            game_ops::restore_mods_state,
            game_ops::launch_game,
            game_ops::generate_in_game_ui,
            game_ops::disable_in_game_ui,
            game_ops::is_game_running,
            // hotreload.rs — Active window monitoring & in-game reload
            hotreload::start_window_monitoring,
            hotreload::set_hotreload,
            hotreload::focus_and_send_f10,
            // install.rs — Extraction & auto-sorting
            install::extract_mod_zip,
            install::install_mods,
            install::generate_character_folders,
            install::auto_assign_mods,
            // fs_ops.rs — File system operations
            fs_ops::set_category_mapping,
            fs_ops::delete_mod,
            fs_ops::open_folder,
            fs_ops::open_logs_folder,
            utils::expand_env_path,
            fs_ops::move_to_unassigned,
            fs_ops::rename_mod,
            fs_ops::move_mod_to_category,
            fs_ops::resolve_conflict,
            fs_ops::set_mod_preview_image,
            fs_ops::save_mod_preview_base64,
            fs_ops::set_mod_note,
            fs_ops::set_mod_tags,
            // ini_ops.rs — INI parsing & metadata
            ini_ops::get_mod_keybinds,
            ini_ops::set_mod_keybind,
            ini_ops::get_mod_toggles,
            ini_ops::set_mod_toggle_state,
            ini_ops::get_mod_metadata,
            ini_ops::detect_keybind_conflicts,
            // sync.rs — Database sync
            sync::sync_database,
            sync::get_cached_database,
            // gamebanana.rs — GameBanana API
            gamebanana::fetch_gb_mods,
            gamebanana::fetch_gb_mods_multi,
            gamebanana::fetch_gb_mod_details,
            gamebanana::download_gb_mod,
            gamebanana::cancel_gb_mod_download,
            gamebanana::open_url,
            gamebanana::check_mod_updates,
            gamebanana::fetch_mod_updates_v13,
            // screenshot.rs - Screen capture
            screenshot::take_and_crop_screenshot,
            // conflict_scanner.rs - Hash conflict scanning
            conflict_scanner::scan_mod_conflicts,
            conflict_scanner::analyze_mod_hashes,
            // mod_splitter.rs - Split monolithic mods
            mod_splitter::split_mod,
            mod_splitter::preview_split_mod,
            // warnings_scanner.rs - Asynchronous warnings scanner & auto-fix
            warnings_scanner::start_warnings_scan,
            warnings_scanner::auto_fix_mod_script,
            // community_tags.rs - Auto-tagging & community crowdsourcing
            community_tags::auto_tag_mod,
            community_tags::auto_tag_all_library_mods,
            community_tags::submit_community_tag_vote,
            // hunting.rs - 3DMigoto hunting mode & log sniffer
            hunting::get_hunting_mode_status,
            hunting::set_hunting_mode,
            hunting::read_hunting_log,
            // mod_viewer.rs — 3D mod preview
            mod_viewer::parse_mod_for_viewer,
            mod_viewer::preview_gamebanana_mod,
            mod_viewer::discard_gamebanana_preview,
            mod_viewer::commit_gamebanana_preview,
            // mod_fixer.rs — Native mod fixer & version upgrades
            mod_fixer::check_mod_fixable,
            mod_fixer::fix_mod,
            mod_fixer::batch_scan_fixable_mods,
            mod_fixer::batch_fix_mods,
            mod_fixer::restore_mod_backup_command,
            // thumbnail_cache.rs — High-performance non-destructive thumbnail cache
            thumbnail_cache::get_cached_thumbnail,
            thumbnail_cache::prewarm_thumbnails,
            // task_manager.rs — Universal action & task cancellation engine
            task_manager::cancel_task,
            task_manager::cancel_tasks_by_prefix,
            task_manager::list_active_tasks
        ])

        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
