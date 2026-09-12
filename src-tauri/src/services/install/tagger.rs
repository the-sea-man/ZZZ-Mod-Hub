//! Heuristic auto-tagging for mods.

use crate::conflict_scanner::extract_overrides_from_ini;
use crate::utils::{find_ini_files, read_ini_to_string};
use std::fs;
use std::path::Path;

pub fn detect_mod_auto_tags(
    mod_dir: &Path,
    target_category: &str,
    is_nsfw_hint: bool,
) -> Vec<String> {
    let mut tags: std::collections::HashSet<String> = std::collections::HashSet::new();

    let target_cat_trimmed = target_category.trim().to_lowercase();
    let folder_name = mod_dir
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_lowercase();

    let path_components: Vec<String> = mod_dir
        .components()
        .map(|c| c.as_os_str().to_string_lossy().to_lowercase())
        .collect();

    // 1. Recursive file scan for physical assets
    #[derive(Default)]
    struct AssetFlags {
        audio: bool,
        anim: bool,
        buf: bool,
        ib: bool,
        tex: bool,
        anim_buf: bool,
        menu_dir: bool,
    }

    fn scan_files_recursive(
        dir: &Path,
        flags: &mut AssetFlags,
        depth: usize,
    ) {
        if depth > 8 {
            return;
        }
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.filter_map(Result::ok) {
                let p = entry.path();
                if p.is_dir() {
                    let dir_name = p.file_name().unwrap_or_default().to_string_lossy();
                    let dir_upper = dir_name.to_ascii_uppercase();
                    if dir_upper.starts_with("DISABLED") || dir_upper.starts_with("DISABLE_") {
                        continue;
                    }
                    if dir_upper == "UIRESOURCES" || dir_upper == "ANIMATEDMENU" || dir_upper == "MENU" {
                        flags.menu_dir = true;
                    }
                    scan_files_recursive(&p, flags, depth + 1);
                } else if let Some(ext) = p.extension().and_then(|s| s.to_str()) {
                    let ext_lower = ext.to_lowercase();
                    let file_name_lower = p.file_name().unwrap_or_default().to_string_lossy().to_lowercase();
                    if matches!(ext_lower.as_str(), "pck" | "bnk" | "wem" | "wav" | "ogg") {
                        flags.audio = true;
                    } else if matches!(ext_lower.as_str(), "anim" | "hvk") {
                        flags.anim = true;
                    } else if ext_lower == "buf" {
                        flags.buf = true;
                        if file_name_lower.contains("animframe") || file_name_lower.contains("anim_frame") || file_name_lower.contains("shapekey") {
                            flags.anim_buf = true;
                        }
                    } else if ext_lower == "ib" {
                        flags.ib = true;
                    } else if matches!(ext_lower.as_str(), "dds" | "png" | "jpg" | "jpeg" | "tga") {
                        flags.tex = true;
                    }
                }
            }
        }
    }

    let mut asset_flags = AssetFlags::default();
    scan_files_recursive(mod_dir, &mut asset_flags, 0);

    let has_audio_file = asset_flags.audio;
    let has_animation_file = asset_flags.anim;
    let has_buf_file = asset_flags.buf;
    let has_ib_file = asset_flags.ib;
    let has_texture_file = asset_flags.tex;
    let has_anim_buf_file = asset_flags.anim_buf;
    let has_menu_folder = asset_flags.menu_dir;

    // 2. INI parsing for precise overrides & resource references
    let mut ini_files = Vec::new();
    find_ini_files(mod_dir, &mut ini_files, 0, 15);

    let mut has_audio_ini = false;
    let mut has_ui_override = false;
    let mut has_ingame_menu_ini = false;
    let mut has_character_anim_ini = false;
    let mut has_ui_anim_ini = false;
    let mut has_weapon_override = false;
    let mut has_hair_override = false;
    let mut has_face_override = false;
    let mut has_body_or_outfit_override = false;
    let mut has_custom_vb_res = false;
    let mut has_texture_override = false;
    let mut has_dynamic_anim_ini = false;

    for ini_path in &ini_files {
        let f_name = ini_path.file_name().unwrap_or_default().to_string_lossy().to_lowercase();
        if f_name.contains("hud") || f_name.contains("crosshair") || f_name.contains("minimap") || f_name.contains("uid") || f_name.contains("wallpaper") || f_name.contains("loadscreen") {
            has_ui_override = true;
        }

        if let Ok(content) = read_ini_to_string(ini_path) {
            let lower = content.to_lowercase();

            if lower.contains("[audiotrack")
                || lower.contains("[actiontrackaudio")
                || lower.contains("playaudio")
            {
                has_audio_ini = true;
            }

            // In-game custom interactive menus (e.g. UIResources / RenderUI.hlsl / MenuRender.hlsl)
            if lower.contains("renderui.hlsl")
                || lower.contains("menurender.hlsl")
                || lower.contains("[commandlistuianimation]")
                || lower.contains("[resourcemenuitem")
                || lower.contains("customshader\\ui")
                || lower.contains("uiresources")
                || has_menu_folder
            {
                has_ingame_menu_ini = true;
            }

            // Character mesh animation (Compute shaders, dynamic shapekeys, multi-frame position morph buffers)
            if lower.contains("computeshapekeys")
                || lower.contains("customshaderkeys")
                || lower.contains("animframe")
                || lower.contains("shapekey")
                || lower.contains("swapvaranimframe")
                || has_anim_buf_file
            {
                has_character_anim_ini = true;
            }

            // UI animation (animated in-game menus, animated cursor sprites, UI tickers)
            if lower.contains("swapvaruianim")
                || lower.contains("animatedmenu")
                || lower.contains("uifps")
                || lower.contains("$common_frameindex")
            {
                has_ui_anim_ini = true;
            }

            if lower.contains("time *")
                || lower.contains("(time -")
                || lower.contains("(time-")
                || lower.contains("(time +")
                || lower.contains("(time+")
                || lower.contains("(time %")
                || lower.contains("(time%")
                || lower.contains("$animation_timer")
                || lower.contains("animacao")
                || lower.contains("resourceani")
                || lower.contains("frameindex")
                || lower.contains("frame_index")
                || lower.contains("current_dds_index")
            {
                has_dynamic_anim_ini = true;
            }

            if lower.contains(".dds")
                || lower.contains(".png")
                || lower.contains(".jpg")
                || lower.contains("resourcediffuse")
                || lower.contains("resourcetexture")
                || lower.contains("ps-t0")
                || lower.contains("this = resource")
            {
                has_texture_override = true;
            }

            // Inspect section headers and declarations
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with('[') && trimmed.ends_with(']') {
                    let sec = trimmed[1..trimmed.len() - 1].trim();
                    if super::classifier::is_ui_section_header(sec) {
                        has_ui_override = true;
                    }
                } else if (trimmed.starts_with("vb0") || trimmed.starts_with("vb2"))
                    && trimmed.contains("resource") && !trimmed.contains("null") {
                        has_custom_vb_res = true;
                    }
            }

            let rel_path = ini_path
                .strip_prefix(mod_dir)
                .unwrap_or(ini_path)
                .to_string_lossy()
                .to_string();
            let overrides = extract_overrides_from_ini(&content, &rel_path);

            for ov in overrides {
                let comp = ov.component_name.to_lowercase();
                if comp.contains("weapon") || comp.contains("gun") || comp.contains("sword") || comp.contains("wengine") {
                    has_weapon_override = true;
                }
                if comp.contains("hair") || comp.contains("wig") {
                    has_hair_override = true;
                }
                if comp.contains("face") || comp.contains("head") || comp.contains("eye") {
                    has_face_override = true;
                }
                if comp.contains("body") || comp.contains("dress") || comp.contains("outfit") || comp.contains("costume") || comp.contains("legs") || comp.contains("arm") {
                    has_body_or_outfit_override = true;
                }
                if !comp.contains("menu") {
                    let has_ui_token = comp.split(|c: char| !c.is_alphanumeric()).any(|w| w == "ui" || w == "gui");
                    if has_ui_token || comp.contains("hud") || comp.contains("wallpaper") || comp.contains("screenuid") {
                        has_ui_override = true;
                    }
                }
                if comp.contains("diffuse") || comp.contains("lightmap") || comp.contains("normalmap") || comp.contains("materialmap") || comp.contains("texture") {
                    has_texture_override = true;
                }
            }
        }
    }

    // 3. Category & Keyword heuristics
    let is_ui_category = target_cat_trimmed == "ui"
        || target_cat_trimmed.starts_with("ui/")
        || target_cat_trimmed.starts_with("ui\\")
        || target_cat_trimmed.starts_with("ui -")
        || path_components.iter().any(|c| c == "ui");

    let has_3d_mesh = has_buf_file || has_ib_file || has_custom_vb_res;
    let has_textures = has_texture_file || has_texture_override;

    let is_weapon_category = target_cat_trimmed == "weapons"
        || target_cat_trimmed.starts_with("weapons/")
        || target_cat_trimmed.starts_with("weapons\\")
        || target_cat_trimmed.starts_with("weapons -")
        || target_cat_trimmed.contains("w-engine")
        || target_cat_trimmed.contains("wengine")
        || path_components.iter().any(|c| c == "weapons" || c == "w-engine" || c == "wengine");

    let is_npc_category = target_cat_trimmed == "npcs"
        || target_cat_trimmed.starts_with("npcs/")
        || target_cat_trimmed.starts_with("npcs\\")
        || target_cat_trimmed.starts_with("npcs -")
        || path_components.iter().any(|c| c == "npcs");

    let is_bangboo_category = target_cat_trimmed == "bangboos"
        || target_cat_trimmed.starts_with("bangboos/")
        || target_cat_trimmed.starts_with("bangboos\\")
        || target_cat_trimmed.starts_with("bangboos -")
        || path_components.iter().any(|c| c == "bangboos");

    let is_non_character_category = is_ui_category || is_weapon_category || is_npc_category || is_bangboo_category;
    let has_character_presence = has_body_or_outfit_override
        || has_hair_override
        || has_face_override
        || (!is_non_character_category && has_3d_mesh);

    let is_explicit_ui_name = !folder_name.contains("menu") && (
        folder_name.contains("hide_uid")
            || folder_name.contains("hideuid")
            || folder_name.contains("screenuid")
            || folder_name.contains("hud")
            || folder_name.contains("wallpaper")
            || folder_name.contains("loadscreen")
            || folder_name.contains("loading_screen")
            || folder_name.contains("loadingscreen")
            || folder_name.contains("loading screen")
            || folder_name.contains("icons mod")
            || folder_name.contains("agent icons")
            || folder_name.contains("agent_icons")
            || folder_name.split(|c: char| !c.is_alphanumeric()).any(|w| w == "ui" || w == "gui")
    );

    // A mod is only classified as a UI mod if:
    // 1. It is explicitly in a UI category, OR
    // 2. Its folder/mod name explicitly denotes a UI/HUD/Icon mod, OR
    // 3. It has UI overrides AND lacks character body/outfit presence (in-game customization menus in outfit mods do NOT make the mod a UI mod).
    let is_ui = is_ui_category
        || is_explicit_ui_name
        || (has_ui_override && !has_character_presence);

    let is_weapon = is_weapon_category || has_weapon_override || folder_name.contains("weapon") || folder_name.contains("sword") || folder_name.contains("gun");

    // 4. Tag Assignment
    if is_ui {
        tags.insert("UI".to_string());
    }

    if has_ingame_menu_ini || has_menu_folder {
        tags.insert("In-Game Menu".to_string());
    }

    if has_ui_anim_ini || (has_dynamic_anim_ini && (is_ui || has_ingame_menu_ini)) {
        tags.insert("UI Animation".to_string());
    }

    if is_weapon && !is_ui {
        tags.insert("Weapon".to_string());
    }

    if is_npc_category {
        tags.insert("NPC".to_string());
    }

    if is_bangboo_category {
        tags.insert("Bangboo".to_string());
    }

    if has_audio_file || has_audio_ini {
        tags.insert("Audio".to_string());
    }

    let is_animated_name = folder_name.contains("anim_")
        || folder_name.contains("_anim")
        || folder_name.contains("animation")
        || folder_name.contains("animated");

    // Character Animation is assigned if:
    // 1. Physical .anim or .hvk animation files exist, OR
    // 2. Mod uses compute shaders / multi-frame vertex buffer morphing for character parts, OR
    // 3. Folder explicitly says animated/animation (and not a pure UI mod), OR
    // 4. Dynamic flipbook anim script in a non-character mod (like animated wallpapers or icons).
    let is_character_anim = has_animation_file || has_character_anim_ini || (is_animated_name && !is_ui);
    let is_dynamic_non_char_anim = has_dynamic_anim_ini && !has_character_presence;

    if is_character_anim || is_dynamic_non_char_anim {
        tags.insert("Animation".to_string());
    }

    // 5. NSFW / SFW detection
    let is_nsfw_name = folder_name.contains("nsfw")
        || folder_name.contains("r18")
        || folder_name.contains("18+")
        || folder_name.contains("nude")
        || folder_name.contains("naked")
        || folder_name.contains("lewd")
        || folder_name.contains("topless")
        || folder_name.contains("bottomless")
        || folder_name.contains("uncensored")
        || folder_name.contains("bikini")
        || folder_name.contains("microbikini");

    if is_nsfw_hint || is_nsfw_name {
        tags.insert("NSFW".to_string());
    } else if folder_name.contains("sfw") || folder_name.contains("safe_for_work") {
        tags.insert("SFW".to_string());
    }

    // 6. Outfit vs Recolor (Only for character/model mods; strictly NEVER for pure UI or pure Weapon mods)
    let is_pure_weapon = is_weapon_category && !has_body_or_outfit_override && !has_hair_override;

    if !is_ui && !is_pure_weapon {
        if has_3d_mesh {
            tags.insert("Outfit".to_string());
        } else if has_textures {
            tags.insert("Recolor".to_string());
        }
    } else if is_pure_weapon && !has_3d_mesh && has_textures {
        tags.insert("Recolor".to_string());
    }

    // 7. Component-level sub-tags
    if has_hair_override && (folder_name.contains("hair") || folder_name.contains("wig") || folder_name.contains("hairstyle")) {
        tags.insert("Hair".to_string());
    }
    if has_face_override
        && (folder_name.contains("makeup")
            || folder_name.contains("face")
            || folder_name.contains("eyes")
            || folder_name.contains("retouch"))
    {
        tags.insert("Face".to_string());
    }

    let mut result: Vec<String> = tags.into_iter().collect();
    result.sort();
    result
}
