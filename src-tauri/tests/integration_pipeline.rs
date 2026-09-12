use std::collections::HashMap;
use std::fs;
use std::path::Path;

#[test]
fn test_end_to_end_archive_extraction_and_root_discovery() {
    let fixture_zip = Path::new("fixtures/fixture_nested.zip");
    assert!(fixture_zip.exists(), "fixture_nested.zip must exist");

    let temp_dir = std::env::temp_dir().join("zmm_test_e2e_extraction");
    let _ = fs::remove_dir_all(&temp_dir);
    fs::create_dir_all(&temp_dir).unwrap();

    let status = zzzmodmanager_tauri_lib::install::extract_mod_zip(
        &fixture_zip.to_string_lossy(),
        &temp_dir.to_string_lossy(),
    )
    .expect("Extraction should succeed");

    assert_eq!(status, "Extracted successfully");

    let mod_root = zzzmodmanager_tauri_lib::mod_viewer::find_mod_root_in_extracted(&temp_dir);
    assert!(mod_root.exists());
    assert!(mod_root.join("mod.ini").exists());

    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_end_to_end_viewer_pipeline_on_character_fixture() {
    let fixture_dir = Path::new("fixtures/fixture_character_mod");
    assert!(fixture_dir.exists(), "fixture_character_mod must exist");

    // Quality: None defaults to fast preview / potato
    let payload = zzzmodmanager_tauri_lib::mod_viewer::parse_mod(
        &fixture_dir.to_string_lossy(),
        None,
        Some("full"),
    )
    .expect("parse_mod should succeed on real fixture");

    assert_eq!(payload.meshes.len(), 1);
    assert!(payload.meshes[0].name.contains("EllenHead"));
    assert!(!payload.meshes[0].positions.is_empty());
    assert!(!payload.meshes[0].indices.is_empty());
    assert!(!payload.textures.is_empty());
    assert!(payload.suggested_tags.contains(&"Outfit".to_string()));
}

#[test]
fn test_end_to_end_toggle_mod_parsing() {
    let fixture_dir = Path::new("fixtures/fixture_toggle_mod");
    assert!(fixture_dir.exists(), "fixture_toggle_mod must exist");

    let payload = zzzmodmanager_tauri_lib::mod_viewer::parse_mod(
        &fixture_dir.to_string_lossy(),
        None,
        Some("full"),
    )
    .expect("parse_mod should succeed on toggle fixture");

    assert_eq!(payload.toggles.len(), 1);
    assert_eq!(payload.toggles[0].variable, "$outfit");
    assert_eq!(payload.toggles[0].values, vec![0, 1]);
    assert!(payload.suggested_tags.contains(&"Toggle".to_string()));
}

#[test]
fn test_end_to_end_category_scoring_on_fixture() {
    let fixture_dir = Path::new("fixtures/fixture_character_mod");
    assert!(fixture_dir.exists());

    let mut hash_alias_map = HashMap::new();
    hash_alias_map.insert(
        "8a512b21".to_string(),
        vec![zzzmodmanager_tauri_lib::models::HashTarget {
            category_name: "Ellen Joe".to_string(),
            character_id: "ellen".to_string(),
            skin_id: "default".to_string(),
            component_name: Some("Head".to_string()),
            is_base_skin: true,
            match_type: None,
        }],
    );

    let match_result = zzzmodmanager_tauri_lib::install::determine_mod_category(
        fixture_dir,
        &hash_alias_map,
    );

    assert!(match_result.is_some());
    let m = match_result.unwrap();
    assert_eq!(m.category_name, "Ellen Joe");
    assert_eq!(m.character_id.as_deref(), Some("ellen"));
}
