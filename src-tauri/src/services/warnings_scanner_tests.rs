use super::*;
    use std::io::Write;

    #[test]
    fn test_analyze_ini_script_integrity_rules() {
        // 1. Rogue help.ini with standalone and HUD erasure
        let rogue_help_ini = r#"
[Present]
if $active == 1
    Resource\ShaderFixes\help.ini\Help = null
    Resource\ShaderFixes\help.ini\HelpShort = null
endif
post $velinahelp = 0

[KeyHelp]
condition = $velinahelp == 1
key = no_modifiers z
type = toggle
run = CommandListHelp
"#;
        let warnings = analyze_ini_script_integrity(rogue_help_ini, "help.ini");
        assert!(warnings.iter().any(|w| w.rule_id == "standalone_help" && w.level == "ini_issue"));
        assert!(warnings.iter().any(|w| w.rule_id == "rogue_hud" && w.level == "ini_issue"));

        // 2. Standard character INI with Present post $active = 0 should NOT trigger warnings
        let standard_char_ini = r#"
[Constants]
global persist $active = 0

[TextureOverrideNicole]
hash = 12345678
if DRAW_TYPE == 1
    pre $active = 1
endif

[Present]
post $active = 0
"#;
        let warnings = analyze_ini_script_integrity(standard_char_ini, "Nicole.ini");
        assert!(warnings.is_empty());

        // 3. Unconditional key binding
        let unconditional_key = r#"
[KeyOutfitToggle]
key = no_modifiers x
type = cycle
$swapvar = 0, 1, 2
"#;
        let warnings = analyze_ini_script_integrity(unconditional_key, "mod.ini");
        assert!(warnings.iter().any(|w| w.rule_id == "unconditional_key" && w.level == "ini_issue"));

        // 4. Conditional key binding should NOT trigger warning
        let conditional_key = r#"
[KeyOutfitToggle]
condition = $active == 1
key = no_modifiers x
type = cycle
$swapvar = 0, 1, 2
"#;
        let warnings = analyze_ini_script_integrity(conditional_key, "mod.ini");
        assert!(warnings.is_empty());

        // 5. Timer-based HUD dismiss (like in Belle mod) should NOT trigger warning
        let belle_timer_ini = r#"
[Constants]
global $active = 0
global $menuOff = 1
global $menuTimeout

[Present]
if $menuOff == 0
    if time - $menuTimeout >= 1.2
        post $menuOff = 1
        post Resource\ShaderFixes\help.ini\Help = null
    endif
endif
post $active = 0
"#;
        let warnings = analyze_ini_script_integrity(belle_timer_ini, "Belle.ini");
        assert!(warnings.is_empty(), "Timer-based HUD dismiss should NOT trigger rogue_hud warning: {:?}", warnings);
    }

    #[test]
    fn test_multi_character_detection() {
        let temp_dir = std::env::temp_dir().join("zzz_test_multi_char_warnings");
        let _ = fs::remove_dir_all(&temp_dir);
        let mods_dir = temp_dir.join("Mods");
        let db_dir = temp_dir.join("DB");

        let _ = fs::create_dir_all(&mods_dir);
        let _ = fs::create_dir_all(&db_dir);

        // Create db file
        let db_file = db_dir.join("playable_characters.json");
        let db_content = r#"{
            "playable_characters": [
                {
                    "id": "jane",
                    "name": "Jane Doe",
                    "skins": [
                        {
                            "id": "default",
                            "name": "Default Outfit",
                            "components": {
                                "Body": { "ib": "11112222" }
                            }
                        }
                    ]
                },
                {
                    "id": "anby",
                    "name": "Anby",
                    "skins": [
                        {
                            "id": "default",
                            "name": "Default Outfit",
                            "components": {
                                "Body": { "ib": "33334444" }
                            }
                        }
                    ]
                }
            ]
        }"#;
        let mut f = fs::File::create(&db_file).unwrap();
        f.write_all(db_content.as_bytes()).unwrap();

        // Create mod in CategoryA with both Jane and Anby hashes
        let mod_dir = mods_dir.join("CategoryA").join("MultiCharMod");
        let _ = fs::create_dir_all(&mod_dir);
        let ini_file = mod_dir.join("mod.ini");
        let ini_content = r#"
[TextureOverrideJane]
hash = 11112222

[TextureOverrideAnby]
hash = 33334444
"#;
        let mut f_ini = fs::File::create(&ini_file).unwrap();
        f_ini.write_all(ini_content.as_bytes()).unwrap();

        let warnings = scan_warnings(&mods_dir.to_string_lossy(), &db_dir.to_string_lossy());

        let mod_key = mod_dir.to_string_lossy().replace('\\', "/");
        let mod_warnings = warnings.get(&mod_key).expect("Should have warnings for MultiCharMod");
        let warn = mod_warnings.iter().find(|w| w.rule_id == "multi_character").expect("Should find multi_character rule");
        assert!(warn.message.contains("Affects multiple characters:"));
        assert!(warn.message.contains("Anby - Default Outfit (Body)"));
        assert!(warn.message.contains("Jane Doe - Default Outfit (Body)"));
        let details = warn.details.as_ref().expect("Should have details");
        assert!(details.contains("• Jane Doe - Default Outfit: Body [11112222]"));
        assert!(details.contains("• Anby - Default Outfit: Body [33334444]"));

        // Create mod in Jane Doe - Hidden Nightfade folder with two skins of Jane Doe
        let mod_dir_b = mods_dir.join("Jane Doe - Hidden Nightfade").join("MultiOutfitMod");
        let _ = fs::create_dir_all(&mod_dir_b);
        let ini_file_b = mod_dir_b.join("mod.ini");
        let ini_content_b = r#"
[TextureOverrideJaneFace]
hash = 11112222
"#;
        let _ = fs::write(&ini_file_b, ini_content_b);

        // Update DB to have 2 skins for Jane with shared face
        let db_content_b = r#"{
            "playable_characters": [
                {
                    "id": "jane",
                    "name": "Jane Doe",
                    "skins": [
                        {
                            "id": "hidden_nightfade",
                            "name": "Hidden Nightfade",
                            "components": {
                                "Face": { "ib": "11112222" }
                            }
                        },
                        {
                            "id": "nocturne_of_light",
                            "name": "Nocturne of Light",
                            "components": {
                                "Face": { "ib": "11112222" }
                            }
                        }
                    ]
                }
            ]
        }"#;
        let _ = fs::write(&db_file, db_content_b);

        // Invalidate cache since we just overwrote the db file with different content.
        crate::utils::invalidate_hash_alias_cache();

        let warnings_b = scan_warnings(&mods_dir.to_string_lossy(), &db_dir.to_string_lossy());
        let mod_key_b = mod_dir_b.to_string_lossy().replace('\\', "/");
        let mod_warnings_b = warnings_b.get(&mod_key_b).expect("Should have warnings for MultiOutfitMod");
        let warn_b = mod_warnings_b.iter().find(|w| w.rule_id == "multi_character").expect("Should find multi_character rule");
        assert_eq!(warn_b.message, "Also affects other outfit(s): Jane Doe - Nocturne of Light (Face)");
        let details_b = warn_b.details.as_ref().expect("Should have details");
        assert!(details_b.contains("• Jane Doe - Nocturne of Light: Face [11112222]"));
        assert!(details_b.contains("• Jane Doe - Hidden Nightfade (Current Folder): Face [11112222]"));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_auto_fix_mod_script() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_autofix_script_{}", unique_id));
        let _ = fs::remove_dir_all(&temp_dir);
        let mod_dir = temp_dir.join("CategoryA").join("RogueMod");
        let _ = fs::create_dir_all(&mod_dir);

        // 1. Create standalone help.ini
        let help_ini = mod_dir.join("help.ini");
        let help_txt = mod_dir.join("help.txt");
        let _ = fs::write(&help_ini, "[Present]\nResource\\ShaderFixes\\help.ini\\Help = null\n");
        let _ = fs::write(&help_txt, "Some help instructions\n");

        // 2. Create mod.ini with rogue HUD erasure
        let mod_ini = mod_dir.join("mod.ini");
        let mod_ini_content = "[Constants]\nglobal $active = 0\n\n[Present]\nResource\\ShaderFixes\\help.ini\\Help = null\npost $active = 0\n";
        let _ = fs::write(&mod_ini, mod_ini_content);

        // Run auto fix
        let res = auto_fix_mod_script(mod_dir.to_string_lossy().to_string()).expect("Auto-fix should succeed");
        assert!(res.len() >= 2);

        // Verify standalone help.ini renamed to help.ini.disabled.bak
        assert!(!help_ini.exists());
        assert!(mod_dir.join("help.ini.disabled.bak").exists());
        assert!(mod_dir.join("help.txt.disabled.bak").exists());

        // Verify mod.ini has backup and is sanitized
        assert!(mod_dir.join("mod.ini.disabled.bak").exists());
        let new_mod_ini = fs::read_to_string(&mod_ini).unwrap();
        assert!(new_mod_ini.contains("; [ZZZMODMANAGER AUTO-FIX: Disabled rogue HUD clearing line]"));
        assert!(new_mod_ini.contains("; Resource\\ShaderFixes\\help.ini\\Help = null"));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_auto_fix_unconditional_key_mod() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_autofix_key_{}", unique_id));
        let _ = fs::remove_dir_all(&temp_dir);
        let mod_dir = temp_dir.join("CategoryA").join("JaneMod");
        let _ = fs::create_dir_all(&mod_dir);

        let mod_ini = mod_dir.join("Jane.ini");
        let mod_ini_content = r#"; Jane
[Constants]
global $active = 0

[Present]
post $active = 0

[KeyToggleHairTail]
key = K
type = cycle
$HairTail = 0, 1
"#;
        let _ = fs::write(&mod_ini, mod_ini_content);

        // Pre-fix: scan warnings should flag unconditional_key
        let pre_warnings = analyze_ini_script_integrity(mod_ini_content, "Jane.ini");
        assert!(pre_warnings.iter().any(|w| w.rule_id == "unconditional_key"));

        // Run auto fix
        let res = auto_fix_mod_script(mod_dir.to_string_lossy().to_string()).expect("Auto-fix should succeed");
        assert!(res.iter().any(|msg| msg.contains("Added active character guard")));

        // Verify backup created
        assert!(mod_dir.join("Jane.ini.disabled.bak").exists());

        // Verify fixed INI content
        let fixed_content = fs::read_to_string(&mod_ini).unwrap();
        assert!(fixed_content.contains("condition = $active == 1"));

        // Post-fix: scan warnings should be clean!
        let post_warnings = analyze_ini_script_integrity(&fixed_content, "Jane.ini");
        assert!(post_warnings.is_empty(), "Expected no warnings after auto-fix, got: {:?}", post_warnings);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_auto_fix_indirect_commandlist_rogue_hud() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_autofix_indirect_hud_{}", unique_id));
        let _ = fs::remove_dir_all(&temp_dir);
        let mod_dir = temp_dir.join("CategoryCissia").join("CissiaMod");
        let _ = fs::create_dir_all(&mod_dir);

        let mod_ini = mod_dir.join("0Cissia.ini");
        let mod_ini_content = r#"; Cissia
[Constants]
global $active = 0
global $help = 0

[KeyHelp]
condition = $active > 0
key = CTRL ALT
type = cycle
$help = 0,1

[Present]
if $help == 1 && $active > 0
    run = CommandListHelp
else
    run = CommandListClean
endif

[CommandListHelp]
pre Resource\ShaderFixes\help.ini\Help = ref ResourceHelp

[CommandListClean]
post Resource\ShaderFixes\help.ini\Help = null
"#;
        let _ = fs::write(&mod_ini, mod_ini_content);

        // Pre-fix: scanner should detect indirect rogue HUD reset in CommandListClean
        let pre_warnings = analyze_ini_script_integrity(mod_ini_content, "0Cissia.ini");
        assert!(pre_warnings.iter().any(|w| w.rule_id == "rogue_hud"), "Expected rogue_hud warning, got: {:?}", pre_warnings);

        // Run auto fix
        let res = auto_fix_mod_script(mod_dir.to_string_lossy().to_string()).expect("Auto-fix should succeed");
        assert!(res.iter().any(|msg| msg.contains("Sanitized")));

        // Verify backup created and line commented
        assert!(mod_dir.join("0Cissia.ini.disabled.bak").exists());
        let fixed_content = fs::read_to_string(&mod_ini).unwrap();
        assert!(fixed_content.contains("; [ZZZMODMANAGER AUTO-FIX: Disabled rogue HUD clearing line]"));
        assert!(fixed_content.contains("; post Resource\\ShaderFixes\\help.ini\\Help = null"));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_auto_fix_missing_vertex_limit_override() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_autofix_vertex_limit_{}", unique_id));
        let _ = fs::remove_dir_all(&temp_dir);
        let mod_dir = temp_dir.join("YidhariMerged");
        let _ = fs::create_dir_all(&mod_dir);

        let mod_ini = mod_dir.join("merged.ini");
        let mod_ini_content = r#"[TextureOverrideYidhariBodyBlend]
hash = eff05950
draw = 34914, 0

[TextureOverrideYidhariBodyVertexLimitRaise]
hash = 471aa92a

[TextureOverrideYidhariBodyIB]
hash = 12251f42
"#;
        let _ = fs::write(&mod_ini, mod_ini_content);

        // Pre-fix: detect missing override_vertex_count
        let pre_warnings = analyze_ini_script_integrity(mod_ini_content, "merged.ini");
        assert!(pre_warnings.iter().any(|w| w.rule_id == "missing_vertex_limit_override"));

        // Auto fix
        let res = auto_fix_mod_script(mod_dir.to_string_lossy().to_string()).expect("Auto-fix should succeed");
        assert!(res.iter().any(|msg| msg.contains("override_vertex_count")));

        // Verify fixed INI
        let fixed_content = fs::read_to_string(&mod_ini).unwrap();
        assert!(fixed_content.contains("override_vertex_count = 34914"));
        assert!(fixed_content.contains("override_byte_stride = 40"));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_auto_fix_missing_resource_definition() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_autofix_missing_res_{}", unique_id));
        let _ = fs::remove_dir_all(&temp_dir);
        let mod_dir = temp_dir.join("YidhariTest");
        let _ = fs::create_dir_all(&mod_dir);

        // Create the dummy buffer files on disk
        let _ = fs::write(mod_dir.join("YidhariTentaclesPosition.buf"), b"1234");
        let _ = fs::write(mod_dir.join("YidhariTentaclesBlend.buf"), b"1234");
        let _ = fs::write(mod_dir.join("YidhariTentaclesA.ib"), b"1234");

        let mod_ini = mod_dir.join("Yidhari.ini");
        let mod_ini_content = r#"[TextureOverrideYidhariTentaclesBlend]
hash = 9b99674d
vb2 = ResourceYidhariTentaclesBlend
vb0 = ResourceYidhariTentaclesPosition

[TextureOverrideYidhariTentaclesA]
hash = 4cb99618
ib = ResourceYidhariTentaclesAIB
"#;
        let _ = fs::write(&mod_ini, mod_ini_content);

        // Pre-fix: scanner must detect missing resource definitions as crash_risk
        let pre_warnings = analyze_ini_script_integrity(mod_ini_content, "Yidhari.ini");
        assert!(pre_warnings.iter().any(|w| w.rule_id == "missing_resource_definition" && w.level == "crash_risk"));

        // Auto-fix
        let res = auto_fix_mod_script(mod_dir.to_string_lossy().to_string()).expect("Auto-fix should succeed");
        assert!(res.iter().any(|msg| msg.contains("Generated missing buffer resource")));

        // Verify fixed INI
        let fixed_content = fs::read_to_string(&mod_ini).unwrap();
        assert!(fixed_content.contains("[ResourceYidhariTentaclesPosition]"));
        assert!(fixed_content.contains("stride = 40"));
        assert!(fixed_content.contains("[ResourceYidhariTentaclesBlend]"));
        assert!(fixed_content.contains("stride = 32"));
        assert!(fixed_content.contains("[ResourceYidhariTentaclesAIB]"));
        assert!(fixed_content.contains("format = DXGI_FORMAT_R32_UINT"));

        // Post-fix: no missing resource warnings
        let post_warnings = analyze_ini_script_integrity(&fixed_content, "Yidhari.ini");
        assert!(!post_warnings.iter().any(|w| w.rule_id == "missing_resource_definition"));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_analyze_ini_key_condition_without_active_flagged() {
        let ini_without_active = r#"
[Constants]
global $outfit = 0

[KeyToggleOutfit]
condition = $outfit == 1
key = x
type = cycle
$outfit = 0, 1
"#;
        let warnings = analyze_ini_script_integrity(ini_without_active, "mod.ini");
        assert!(warnings.iter().any(|w| w.rule_id == "unconditional_key"), "Key condition missing $active must be flagged as unconditional");
    }

    #[test]
    fn test_auto_fix_injects_active_setter_into_texture_override() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_autofix_active_setter_{}", unique_id));
        let _ = fs::remove_dir_all(&temp_dir);
        let mod_dir = temp_dir.join("AnbyMod");
        let _ = fs::create_dir_all(&mod_dir);

        let mod_ini = mod_dir.join("Anby.ini");
        let mod_ini_content = r#"[TextureOverrideAnbyBody]
hash = 12345678

[KeyOutfit]
key = z
type = toggle
$swap = 0, 1
"#;
        let _ = fs::write(&mod_ini, mod_ini_content);

        let res = auto_fix_mod_script(mod_dir.to_string_lossy().to_string()).expect("Auto-fix should succeed");
        assert!(res.iter().any(|m| m.contains("Injected active character detection")));

        let fixed_content = fs::read_to_string(&mod_ini).unwrap();
        assert!(fixed_content.contains("[Constants]"));
        assert!(fixed_content.contains("global $active = 0"));
        assert!(fixed_content.contains("condition = $active == 1"));
        assert!(fixed_content.contains("[Present]"));
        assert!(fixed_content.contains("post $active = 0"));
        assert!(fixed_content.contains("if DRAW_TYPE == 1"));
        assert!(fixed_content.contains("pre $active = 1"));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_auto_fix_vertex_limit_preserves_existing_byte_stride() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_autofix_stride_preserve_{}", unique_id));
        let _ = fs::remove_dir_all(&temp_dir);
        let mod_dir = temp_dir.join("BlendMod");
        let _ = fs::create_dir_all(&mod_dir);

        let mod_ini = mod_dir.join("mod.ini");
        let mod_ini_content = r#"[TextureOverrideBodyBlendVertexLimitRaise]
hash = 12345678
override_byte_stride = 32
"#;
        let _ = fs::write(&mod_ini, mod_ini_content);

        let _ = auto_fix_mod_script(mod_dir.to_string_lossy().to_string()).expect("Auto-fix should succeed");

        let fixed_content = fs::read_to_string(&mod_ini).unwrap();
        assert!(fixed_content.contains("override_vertex_count = 35000"));
        assert!(fixed_content.contains("override_byte_stride = 32"));
        assert!(!fixed_content.contains("override_byte_stride = 40"), "Existing stride of 32 must not be overwritten with 40");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_multi_ini_shared_resource_not_flagged() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_multi_ini_shared_res_{}", unique_id));
        let _ = fs::remove_dir_all(&temp_dir);
        let mods_dir = temp_dir.join("Mods");
        let db_dir = temp_dir.join("DB");
        let mod_dir = mods_dir.join("Anby").join("MultiIniMod");
        let _ = fs::create_dir_all(&mod_dir);
        let _ = fs::create_dir_all(&db_dir);

        // Dummy database file
        let db_file = db_dir.join("playable_characters.json");
        let _ = fs::write(&db_file, r#"{"playable_characters":[]}"#);

        // File 1: references ResourceSharedVB0
        let main_ini = mod_dir.join("main.ini");
        let main_content = r#"[TextureOverrideAnby]
hash = aabbccdd
vb0 = ResourceSharedVB0
"#;
        let _ = fs::write(&main_ini, main_content);

        // File 2: defines [ResourceSharedVB0]
        let res_ini = mod_dir.join("resources.ini");
        let res_content = r#"[ResourceSharedVB0]
type = Buffer
stride = 40
filename = buffer.buf
"#;
        let _ = fs::write(&res_ini, res_content);

        let warnings_map = scan_warnings(&mods_dir.to_string_lossy(), &db_dir.to_string_lossy());
        let mod_key = mod_dir.to_string_lossy().replace('\\', "/");
        let mod_warnings = warnings_map.get(&mod_key);

        if let Some(warns) = mod_warnings {
            assert!(!warns.iter().any(|w| w.rule_id == "missing_resource_definition"), "Resource defined in sibling INI must not be flagged as missing: {:?}", warns);
        }

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_vertex_limit_raise_empty_stub_not_flagged_for_low_poly() {
        let ini_content = r#"[TextureOverrideRinaPosition]
hash = 41149c54
handling = skip
vb0 = ResourceRinaPosition
vb2 = ResourceRinaBlend
draw = 7846,0
$active = 1

[TextureOverrideRinaTexcoord]
hash = 4c259bf3
vb1 = ResourceRinaTexcoord

[TextureOverrideRinaVertexLimitRaise]
hash = 03e8990d

[TextureOverrideRina2Position]
hash = 06c78cb0
handling = skip
vb0 = ResourceRina2Position
vb2 = ResourceRina2Blend
draw = 10488,0
$active = 1

[TextureOverrideRina2VertexLimitRaise]
hash = 8ca7dc4b
"#;
        let warnings = analyze_ini_script_integrity(ini_content, "Rina.ini");
        assert!(
            !warnings.iter().any(|w| w.rule_id == "missing_vertex_limit_override"),
            "Benign VertexLimitRaise stubs on low-poly meshes must not be flagged as errors: {:?}",
            warnings
        );
    }

    #[test]
    fn test_duplicate_section_detection_and_autofix() {
        let temp_dir = std::env::temp_dir().join("zzz_test_dup_section");
        let _ = fs::remove_dir_all(&temp_dir);
        let _ = fs::create_dir_all(&temp_dir);

        let ini_content = r#"[ResourceAriaHairShadowAriaHairShadowALightMap]
filename = AriaHairShadowAriaHairShadowALightMap.dds

[ResourceAriaHairShadowAriaHairShadowALightMap]
filename = AriaHairShadowAriaHairShadowALightMap.dds
"#;
        let ini_file = temp_dir.join("AriaHairShadow.ini");
        fs::write(&ini_file, ini_content).unwrap();

        let warnings = analyze_ini_script_integrity(ini_content, "AriaHairShadow.ini");
        assert!(
            warnings.iter().any(|w| w.rule_id == "duplicate_section"),
            "Duplicate section header must be detected: {:?}",
            warnings
        );

        let actions = auto_fix_mod_script(temp_dir.to_string_lossy().to_string()).unwrap();
        assert!(actions.iter().any(|a| a.contains("duplicate section")));

        let fixed_content = fs::read_to_string(&ini_file).unwrap();
        let post_warnings = analyze_ini_script_integrity(&fixed_content, "AriaHairShadow.ini");
        assert!(
            !post_warnings.iter().any(|w| w.rule_id == "duplicate_section"),
            "Duplicate section warning must be cleared after auto-fix"
        );

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_missing_resource_ref_detection_and_autofix() {
        let temp_dir = std::env::temp_dir().join("zzz_test_missing_ref");
        let _ = fs::remove_dir_all(&temp_dir);
        let _ = fs::create_dir_all(&temp_dir);

        let ini_content = r#"[TextureOverrideAriaFace]
hash = 27966f80
Resource\ZZMI\Diffuse = ref ResourceAriaFaceADiffuse
Resource\ZZMI\WengineFX = Resource\ZZMI\EmptyGlowMap
Resource\ZZMI\Extra = ResourceAriaExtraFX
"#;
        let ini_file = temp_dir.join("Aria.ini");
        fs::write(&ini_file, ini_content).unwrap();

        let warnings = analyze_ini_script_integrity(ini_content, "Aria.ini");
        assert_eq!(
            warnings.iter().filter(|w| w.rule_id == "missing_resource_ref").count(),
            2,
            "Both missing ref lines must be flagged: {:?}",
            warnings
        );

        let actions = auto_fix_mod_script(temp_dir.to_string_lossy().to_string()).unwrap();
        assert!(actions.iter().any(|a| a.contains("missing 'ref'")));

        let fixed_content = fs::read_to_string(&ini_file).unwrap();
        assert!(fixed_content.contains("Resource\\ZZMI\\WengineFX = ref Resource\\ZZMI\\EmptyGlowMap"));
        assert!(fixed_content.contains("Resource\\ZZMI\\Extra = ref ResourceAriaExtraFX"));

        let post_warnings = analyze_ini_script_integrity(&fixed_content, "Aria.ini");
        assert!(
            !post_warnings.iter().any(|w| w.rule_id == "missing_resource_ref"),
            "Missing ref warnings must be cleared after auto-fix"
        );

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_unconditional_texture_override_detection() {
        let ini_content = r#"[TextureOverrideAriaFaceA]
hash = 27966f80
ib = ResourceAriaFaceAIB
Resource\ZZMI\Diffuse = ref ResourceAriaFaceADiffuse
run = CommandList\ZZMI\SetTextures
drawindexed = 8142, 0, 0

Resource\ZZMI\Diffuse = ref ResourceAriaFaceADiffuse2
run = CommandList\ZZMI\SetTextures
if $FaceA2 == 1
drawindexed = 8142, 8142, 0
endif
"#;
        let warnings = analyze_ini_script_integrity(ini_content, "Aria.ini");
        assert!(
            warnings.iter().any(|w| w.rule_id == "unconditional_texture_override"),
            "Unconditional texture re-assignment after draw call must be flagged: {:?}",
            warnings
        );
    }

    #[test]
    fn test_auto_fix_vertex_limit_override_zero_value_fixed() {
        let temp_dir = std::env::temp_dir().join("zzz_test_vlr_zero_val");
        let _ = fs::remove_dir_all(&temp_dir);
        let _ = fs::create_dir_all(&temp_dir);

        let ini_content = r#"[TextureOverrideYixuanBodyBlend]
hash = 3e629c05
draw = 213651,0

[TextureOverrideYixuanJacketVertexLimitRaise]
hash = 73599fbb
override_vertex_count = 0
override_byte_stride = 96
"#;
        let ini_file = temp_dir.join("YiXuan.ini");
        fs::write(&ini_file, ini_content).unwrap();

        // 1. Detection must catch override_vertex_count = 0
        let pre_warnings = analyze_ini_script_integrity(ini_content, "YiXuan.ini");
        assert!(
            pre_warnings.iter().any(|w| w.rule_id == "missing_vertex_limit_override"),
            "Zero override_vertex_count must be flagged: {:?}",
            pre_warnings
        );

        // 2. Auto-fix must replace 0 with target vertex count (213651) and preserve stride 96
        let actions = auto_fix_mod_script(temp_dir.to_string_lossy().to_string()).unwrap();
        assert!(actions.iter().any(|a| a.contains("Fixed 'override_vertex_count = 213651'")));

        let fixed_content = fs::read_to_string(&ini_file).unwrap();
        assert!(fixed_content.contains("override_vertex_count = 213651"));
        assert!(fixed_content.contains("override_byte_stride = 96"));
        assert!(!fixed_content.contains("override_vertex_count = 0"));

        // 3. Post-fix detection must be clean
        let post_warnings = analyze_ini_script_integrity(&fixed_content, "YiXuan.ini");
        assert!(
            !post_warnings.iter().any(|w| w.rule_id == "missing_vertex_limit_override"),
            "Warning must be cleared after auto-fix: {:?}",
            post_warnings
        );

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_multiple_constants_and_present_not_flagged_nor_commented() {
        let temp_dir = std::env::temp_dir().join("zzz_test_mult_const_pres");
        let _ = fs::remove_dir_all(&temp_dir);
        let _ = fs::create_dir_all(&temp_dir);

        let ini_content = r#"[Constants]
global $active = 0
global persist $outfit = 0

[Constants]
global $menu = 0
global $drag = 0

[Present]
post $active = 0

[Present]
if $active == 1
    run = CommandListComputeShapeKeys
endif
"#;
        let ini_file = temp_dir.join("mod.ini");
        fs::write(&ini_file, ini_content).unwrap();

        // 1. Scanner must NOT flag multiple Constants or Present as duplicates
        let warnings = analyze_ini_script_integrity(ini_content, "mod.ini");
        assert!(
            !warnings.iter().any(|w| w.rule_id == "duplicate_section"),
            "Multiple Constants and Present must NOT be flagged as duplicate sections: {:?}",
            warnings
        );

        // 2. Auto-fix must NOT comment them out
        let _ = auto_fix_mod_script(temp_dir.to_string_lossy().to_string()).unwrap();
        let content_after = fs::read_to_string(&ini_file).unwrap();
        assert!(!content_after.contains("Commented out duplicate section"));
        assert!(content_after.contains("run = CommandListComputeShapeKeys"));
        assert!(content_after.contains("global $drag = 0"));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_auto_fix_restores_accidentally_commented_constants_and_present() {
        let temp_dir = std::env::temp_dir().join("zzz_test_restore_commented");
        let _ = fs::remove_dir_all(&temp_dir);
        let _ = fs::create_dir_all(&temp_dir);

        let damaged_content = r#"[Constants]
global $active = 0

; [ZZZMODMANAGER AUTO-FIX: Commented out duplicate section header]
; [Constants]
; global $menu = 0
; global $drag = 0

[Present]
post $active = 0

; [ZZZMODMANAGER AUTO-FIX: Commented out duplicate section header]
; [Present]
; if $active == 1
;     run = CommandListComputeShapeKeys
; endif
"#;
        let ini_file = temp_dir.join("damaged.ini");
        fs::write(&ini_file, damaged_content).unwrap();

        let actions = auto_fix_mod_script(temp_dir.to_string_lossy().to_string()).unwrap();
        assert!(actions.iter().any(|a| a.contains("Restored erroneously commented-out '[Constants]'")));
        assert!(actions.iter().any(|a| a.contains("Restored erroneously commented-out '[Present]'")));

        let restored = fs::read_to_string(&ini_file).unwrap();
        assert!(!restored.contains("; [ZZZMODMANAGER AUTO-FIX: Commented out duplicate section header]"));
        assert!(restored.contains("[Constants]\r\nglobal $menu = 0") || restored.contains("[Constants]\nglobal $menu = 0"));
        assert!(restored.contains("run = CommandListComputeShapeKeys"));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_auto_fix_preserves_existing_key_condition_and_chains_active() {
        let temp_dir = std::env::temp_dir().join("zzz_test_key_chain_active");
        let _ = fs::remove_dir_all(&temp_dir);
        let _ = fs::create_dir_all(&temp_dir);

        let ini_content = r#"[Constants]
global $active = 0
global $menu = 0
global $hovering = 0

[TextureOverrideBody]
hash = 12345678
if DRAW_TYPE == 1
    pre $active = 1
endif

[KeyMenuReset]
condition = $menu == 1
key = \
run = CommandListResetMenuPos

[KeyHold]
condition = $menu == 1 && $hovering == 0
key = VK_RBUTTON
type = hold
$hold = 1

[Present]
post $active = 0
"#;
        let ini_file = temp_dir.join("mod.ini");
        fs::write(&ini_file, ini_content).unwrap();

        // 1. Detection flags both keys
        let warnings = analyze_ini_script_integrity(ini_content, "mod.ini");
        assert_eq!(warnings.iter().filter(|w| w.rule_id == "unconditional_key").count(), 2);

        // 2. Auto-fix chains condition = $active == 1 && (...)
        let actions = auto_fix_mod_script(temp_dir.to_string_lossy().to_string()).unwrap();
        assert!(actions.iter().any(|a| a.contains("Added active character guard")));

        let fixed = fs::read_to_string(&ini_file).unwrap();
        assert!(fixed.contains("condition = $active == 1 && ($menu == 1)"));
        assert!(fixed.contains("condition = $active == 1 && ($menu == 1 && $hovering == 0)"));

        // 3. Post-fix: 0 warnings
        let post_warnings = analyze_ini_script_integrity(&fixed, "mod.ini");
        assert!(post_warnings.is_empty(), "All unconditional key warnings should be resolved: {:?}", post_warnings);

        let _ = fs::remove_dir_all(&temp_dir);
    

    /// A ZZZ texcoord vertex is COLOR (unorm4, 4) + TEXCOORD (float2, 8) + TEXCOORD1 (float2, 8)
    /// = 20 bytes. Narrower than that and TEXCOORD1 is absent, so whatever map the shader
    /// samples with the second UV set reads past the end of each record and body parts render
    /// with each other's textures.
    ///
    /// Measured before adding: 143 of 144 texcoord declarations across a 40-mod corpus are 20 or
    /// wider and render correctly; the single 12-byte mod shows exactly that symptom and its
    /// buffer decodes as COLOR plus one UV pair with nothing following. The check must stay
    /// silent on 20 and above or it would flag most of the corpus.
    #[test]
    fn test_texcoord_narrower_than_one_uv_set_is_flagged() {
        let narrow = r#"[TextureOverrideJaneHairTexcoord]
hash = fa617c9a
vb1 = ResourceJaneHairTexcoord

[ResourceJaneHairTexcoord]
type = Buffer
stride = 12
filename = JaneHairTexcoord.buf
"#;
        let w = analyze_ini_script_integrity(narrow, "Jane.ini");
        let hits: Vec<_> = w.iter().filter(|x| x.rule_id == "texcoord_missing_second_uv").collect();
        assert_eq!(hits.len(), 1, "a 12-byte texcoord is flagged: {w:?}");
        assert!(hits[0].message.contains("stride 12"), "states what it found");

        // The two widths the corpus actually uses must stay silent.
        for stride in [20, 24, 32] {
            let ok = narrow.replace("stride = 12", &format!("stride = {stride}"));
            let w = analyze_ini_script_integrity(&ok, "Jane.ini");
            assert!(
                !w.iter().any(|x| x.rule_id == "texcoord_missing_second_uv"),
                "stride {stride} is a complete layout and must not be flagged: {w:?}"
            );
        }

        // Only buffers actually bound to vb1 are texcoords; a same-named resource that nothing
        // binds there is not this check's business.
        let unbound = narrow.replace("vb1 = ResourceJaneHairTexcoord", "");
        assert!(
            !analyze_ini_script_integrity(&unbound, "Jane.ini")
                .iter()
                .any(|x| x.rule_id == "texcoord_missing_second_uv"),
            "an unbound resource is not checked"
        );
    }
}
