use super::*;
use std::fs;

#[test]
fn test_extract_variable_from_condition() {
    assert_eq!(extract_variable_from_condition("$active > 0"), "$active");
    assert_eq!(extract_variable_from_condition("$active == 1"), "$active");
    assert_eq!(extract_variable_from_condition("$\\cissia\\active == 1"), "$cissia\\active");
    assert_eq!(extract_variable_from_condition("$active >= 1 && $swap == 0"), "$active");
    assert_eq!(extract_variable_from_condition("1 == 1"), "");
}

#[test]
fn test_get_tracking_hashes_with_various_conditions_and_assignments() {
    let temp_dir = std::env::temp_dir().join(format!("zzz_test_tracking_hashes_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis()));
    let _ = fs::create_dir_all(&temp_dir);
    let ini_file = temp_dir.join("test.ini");

    let ini_content = r#"; Test Mod
[TextureOverrideFace]
hash = face1234
match_priority = 0

[TextureOverrideBody]
hash = 3b944072
handling = skip
vb2 = ResourceBodyBlend
if DRAW_TYPE == 1
    vb0 = ResourceBodyPos
    draw = 160595, 0
    $active = 3
endif
"#;
    fs::write(&ini_file, ini_content).unwrap();

    let hashes = get_tracking_hashes(&ini_file, "$active > 0");
    assert_eq!(hashes, vec!["3b944072"]);

    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_get_tracking_hashes_with_commandlist_indirection() {
    let temp_dir = std::env::temp_dir().join(format!("zzz_test_tracking_cmdlist_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis()));
    let _ = fs::create_dir_all(&temp_dir);
    let ini_file = temp_dir.join("Promeia.ini");

    let ini_content = r#"; Promeia Test
[TextureOverridePromeiaBodyBlend]
hash = 112582ea
handling = skip
run = CommandListPromeiaBodyBlend

[TextureOverridePromeiaBody2Blend]
hash = ee35cc06
handling = skip
vb2 = ResourcePromeiaBody2Blend
if DRAW_TYPE == 1
    vb0 = ResourcePromeiaBody2Position
    draw = 47651, 0
    $active = 1
endif

[CommandListPromeiaBodyBlend]
vb2 = ResourcePromeiaBodyBlend
if DRAW_TYPE == 1
    vb0 = ResourcePromeiaBodyPosition
    draw = 47794, 0
    $active = 1
endif
"#;
    fs::write(&ini_file, ini_content).unwrap();

    let hashes = get_tracking_hashes(&ini_file, "$active == 1");
    assert!(hashes.contains(&"112582ea".to_string()), "Expected indirect hash 112582ea in {:?}", hashes);
    assert!(hashes.contains(&"ee35cc06".to_string()), "Expected direct hash ee35cc06 in {:?}", hashes);

    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_get_tracking_targets_differentiates_ib_and_vb() {
    let temp_dir = std::env::temp_dir().join(format!("zzz_test_tracking_ib_vb_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis()));
    let _ = fs::create_dir_all(&temp_dir);
    let ini_file = temp_dir.join("AliceLike.ini");

    let ini_content = r#"; Alice-like mod with both IB assignment and VB draw call
[KeySwap]
condition = $active == 1
key = 9
type = cycle
$swap = 0,1

[TextureOverrideAliceBodyBlend]
hash = 15935e48
handling = skip
vb2 = ResourceAliceBodyBlend
if DRAW_TYPE == 1
    vb0 = ResourceAliceBodyPosition
    draw = 61694, 0
endif

[TextureOverrideAliceBodyIB]
hash = 8a512b21
handling = skip

[TextureOverrideAliceBodyA]
$active = 1
hash = 8a512b21
match_first_index = 0
ib = ResourceAliceBodyAIB
"#;
    fs::write(&ini_file, ini_content).unwrap();

    let targets = get_tracking_targets(&ini_file, "$active == 1");
    assert_eq!(targets.len(), 1);
    assert_eq!(targets[0].hash, "8a512b21");
    assert!(!targets[0].has_draw_type_1, "IB tracking targets must not have DRAW_TYPE == 1 guard");

    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_parse_mod_menu_pagination_and_cycles() {
    let temp_dir = std::env::temp_dir().join(format!("zzz_test_menu_pagination_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis()));
    let _ = fs::create_dir_all(&temp_dir);
    let ini_file = temp_dir.join("ComplexMod.ini");

    let mut ini_content = String::from("; Complex 12-slot mod\n[TextureOverrideBody]\nhash = aabbccdd\n$active = 1\n\n");
    for i in 1..=12 {
        ini_content.push_str(&format!(
            "[KeyOption{}]\ncondition = $active == 1\nkey = {}\ntype = cycle\n$opt_{} = 0, 1, 2\n\n",
            i, i, i
        ));
    }
    fs::write(&ini_file, ini_content).unwrap();

    let menu_def = parser::parse_mod_menu(&temp_dir, &[ini_file], "Playable Characters", "Valkyrie")
        .expect("Should parse menu def");

    assert_eq!(menu_def.total_controls(), 12);
    assert_eq!(menu_def.total_pages(), 2, "12 controls should be split across 2 pages (8 + 4)");
    assert_eq!(menu_def.pages[0].slots.len(), 8);
    assert_eq!(menu_def.pages[1].slots.len(), 4);

    // Test INI building
    let ini_output = builder::build_interactive_menu_ini(&menu_def, "h");
    assert!(ini_output.contains("namespace = ZzzManagerUI_"));
    assert!(ini_output.contains("[KeyToggleMenu_ZzzManagerUI_"));
    assert!(ini_output.contains("[KeyHold_ZzzManagerUI_"));
    assert!(ini_output.contains("[KeyClickSlot_ZzzManagerUI_"));
    assert!(ini_output.contains("[KeyClickPage_ZzzManagerUI_"));
    assert!(ini_output.contains("[CommandListDrawPage_0_ZzzManagerUI_"));
    assert!(ini_output.contains("[CommandListDrawPage_1_ZzzManagerUI_"));
    assert!(ini_output.contains("ResourceBtnNext_ZzzManagerUI_"));
    assert!(ini_output.contains("ResourceBtnPrev_ZzzManagerUI_"));

    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_ensure_ui_assets_installed() {
    let temp_dir = std::env::temp_dir().join(format!("zzz_test_assets_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis()));
    let assets_dir = temp_dir.join("assets");

    let res = assets::ensure_ui_assets_installed(&assets_dir);
    assert!(res.is_ok());

    assert!(assets_dir.join("draw_2d.hlsl").exists());
    assert!(assets_dir.join("draw_2d_disabled.hlsl").exists());
    assert!(assets_dir.join("menu_bg.png").exists());
    assert!(assets_dir.join("slot.png").exists());
    assert!(assets_dir.join("slot_hover.png").exists());
    assert!(assets_dir.join("button_prev.png").exists());
    assert!(assets_dir.join("button_next.png").exists());
    assert!(assets_dir.join("badge_1.png").exists());

    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_live_mods_dir_ui_generation_if_exists() {
    if let Ok(appdata) = std::env::var("APPDATA") {
        let live_path = std::path::Path::new(&appdata).join("XXMI Launcher").join("ZZMI").join("Mods");
        if live_path.exists() {
            let res = generate_in_game_ui(live_path.to_str().unwrap(), None, Some("h".to_string()), Some("interactive".to_string()));
            assert!(res.is_ok(), "Live generation should succeed: {:?}", res);
        }
    }
}
