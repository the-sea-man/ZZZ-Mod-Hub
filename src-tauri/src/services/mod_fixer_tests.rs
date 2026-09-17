use super::*;

    #[test]
    fn test_extract_hashes_from_ini() {
        let content = r#"
[TextureOverrideAnby]
hash = 39538886
; hash = deadbeef
# hash = 11112222
hash = b54f2a3d
"#;
        let hashes = extract_hashes_from_ini(content);
        assert_eq!(hashes.len(), 2);
        assert!(hashes.contains("39538886"));
        assert!(hashes.contains("b54f2a3d"));
        assert!(!hashes.contains("deadbeef"));
        assert!(!hashes.contains("11112222"));
    }

    #[test]
    fn test_remap_buffer_bytes_half_float() {
        // Create a 4-byte buffer containing 2x half-floats (1.0, 2.0)
        let h1 = f16::from_f32(1.0).to_bits();
        let h2 = f16::from_f32(2.0).to_bits();

        let mut buf = Vec::new();
        buf.write_u16::<LittleEndian>(h1).unwrap();
        buf.write_u16::<LittleEndian>(h2).unwrap();

        let old_format = vec!["2e".to_string()];
        let new_format = vec!["2f".to_string()];

        let remapped = remap_buffer_bytes(&buf, 4, &old_format, &new_format);
        assert_eq!(remapped.len(), 8); // 2x 32-bit floats = 8 bytes

        let mut cursor = Cursor::new(remapped);
        let f1 = cursor.read_f32::<LittleEndian>().unwrap();
        let f2 = cursor.read_f32::<LittleEndian>().unwrap();

        assert!((f1 - 1.0).abs() < 1e-5);
        assert!((f2 - 2.0).abs() < 1e-5);
    }

    #[test]
    fn test_shrink_color_buffer_bytes() {
        // Create 16-byte vertex with 4x f32 (1.0, 0.5, 0.0, 1.0)
        let mut buf = Vec::new();
        buf.write_f32::<LittleEndian>(1.0).unwrap();
        buf.write_f32::<LittleEndian>(0.5).unwrap();
        buf.write_f32::<LittleEndian>(0.0).unwrap();
        buf.write_f32::<LittleEndian>(1.0).unwrap();

        let shrunken = shrink_color_buffer_bytes(&buf, 16);
        assert_eq!(shrunken.len(), 4);
        assert_eq!(shrunken[0], 255);
        assert_eq!(shrunken[1], 127);
        assert_eq!(shrunken[2], 0);
        assert_eq!(shrunken[3], 255);
    }

    #[test]
    fn test_resolve_terminal_hash_multi_hop() {
        let mut db = FixerDatabase::default();
        // H1 -> H2
        db.rules.insert(
            "11111111".to_string(),
            FixerRule {
                hash: "11111111".to_string(),
                character: "anby".to_string(),
                description: "Anby Head".to_string(),
                version_from: "1.0".to_string(),
                version_to: "1.2".to_string(),
                actions: vec![FixerRuleAction {
                    action_type: "update_hash".to_string(),
                    new_hash: Some("22222222".to_string()),
                    ..Default::default()
                }],
            },
        );
        // H2 -> H3
        db.rules.insert(
            "22222222".to_string(),
            FixerRule {
                hash: "22222222".to_string(),
                character: "anby".to_string(),
                description: "Anby Head".to_string(),
                version_from: "1.2".to_string(),
                version_to: "3.1".to_string(),
                actions: vec![FixerRuleAction {
                    action_type: "update_hash".to_string(),
                    new_hash: Some("33333333".to_string()),
                    ..Default::default()
                }],
            },
        );

        let (terminal, path) = resolve_terminal_hash("11111111", &db);
        assert_eq!(terminal, "33333333");
        assert_eq!(path, vec!["22222222", "33333333"]);
    }

    #[test]
    fn test_reindex_submesh_sections() {
        let ini = r#"
[TextureOverrideAnbyHairA]
hash = aabbccdd
match_first_index = 0
ib = ResourceAnbyHairIB

[TextureOverrideAnbyHairB]
hash = aabbccdd
match_first_index = 15000
ib = ResourceAnbyHairIB
"#;
        let src = vec!["0".to_string(), "15000".to_string()];
        let trg = vec!["100".to_string(), "16500".to_string()];

        let (new_ini, count) = reindex_submesh_sections(ini, "aabbccdd", &src, &trg);
        assert_eq!(count, 2);
        assert!(new_ini.contains("match_first_index = 100"));
        assert!(new_ini.contains("match_first_index = 16500"));
        assert!(!new_ini.contains("match_first_index = 0"));
        assert!(!new_ini.contains("match_first_index = 15000"));
    }

    #[test]
    fn test_remap_bone_indices_buffer_bytes() {
        // Create 32-byte stride vertex
        // 16 bytes weights, 16 bytes indices (4x u32: 26, 27, 40, 90)
        let mut buf = vec![0u8; 16]; // 16 bytes weights
        buf.write_u32::<LittleEndian>(26).unwrap();
        buf.write_u32::<LittleEndian>(27).unwrap();
        buf.write_u32::<LittleEndian>(40).unwrap();
        buf.write_u32::<LittleEndian>(90).unwrap();

        let mappings = get_jane_hair_bone_mappings();
        let remapped = remap_bone_indices_buffer_bytes(&buf, 32, &mappings);

        let mut cursor = Cursor::new(&remapped[16..32]);
        let i1 = cursor.read_u32::<LittleEndian>().unwrap();
        let i2 = cursor.read_u32::<LittleEndian>().unwrap();
        let i3 = cursor.read_u32::<LittleEndian>().unwrap();
        let i4 = cursor.read_u32::<LittleEndian>().unwrap();

        assert_eq!(i1, 4);  // 26 -> 4
        assert_eq!(i2, 5);  // 27 -> 5
        assert_eq!(i3, 19); // 40 -> 19
        assert_eq!(i4, 33); // 90 -> 33
    }

    #[test]
    fn test_load_fixer_database_nested_and_direct() {
        let temp_dir = std::env::temp_dir().join("zzz_test_fixer_load");
        let _ = fs::remove_dir_all(&temp_dir);
        let _ = fs::create_dir_all(&temp_dir);

        let nested_json = r#"{
            "hash_migrations": {
                "version": "3.1",
                "rules": {
                    "11111111": {
                        "hash": "11111111",
                        "character": "Jane",
                        "description": "Jane Body IB",
                        "version_from": "1.0",
                        "version_to": "1.4",
                        "actions": []
                    }
                }
            }
        }"#;
        let db_file = temp_dir.join("database.json");
        fs::write(&db_file, nested_json).unwrap();

        invalidate_fixer_db_cache();
        let db = load_fixer_database(Some(&db_file));
        assert_eq!(db.rules.len(), 1);
        assert!(db.rules.contains_key("11111111"));

        // Cache hit test: should return same DB without error
        let cached_db = load_fixer_database(Some(&db_file));
        assert_eq!(cached_db.rules.len(), 1);

        invalidate_fixer_db_cache();
        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_apply_mod_fix_safe_regex_replacement() {
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_fixer_regex_safe_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        let _ = fs::remove_dir_all(&temp_dir);
        let _ = fs::create_dir_all(&temp_dir);

        let ini_content = r#"[TextureOverrideBelleShirt]
hash = 65481194
vb2 = ResourceBelleShirtBlend
"#;
        let ini_path = temp_dir.join("Belle.ini");
        fs::write(&ini_path, ini_content).unwrap();

        let mut db = FixerDatabase::default();
        db.rules.insert(
            "65481194".to_string(),
            FixerRule {
                hash: "65481194".to_string(),
                character: "Belle".to_string(),
                description: "Belle Shirt".to_string(),
                version_from: "1.0".to_string(),
                version_to: "1.4".to_string(),
                actions: vec![FixerRuleAction {
                    action_type: "update_hash".to_string(),
                    new_hash: Some("0a00d846".to_string()),
                    ..Default::default()
                }],
            },
        );

        let res = apply_mod_fix(&temp_dir, &db).unwrap();
        assert!(res.success);
        assert_eq!(res.hashes_updated, 1);

        let updated_content = fs::read_to_string(&ini_path).unwrap();
        assert!(updated_content.contains("hash = 0a00d846"), "Should contain valid hash line without missing 'hash'");
        assert!(!updated_content.lines().any(|l| l.trim().starts_with("= 0a00d846")), "Should not have line starting with '= 0a00d846'");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_version_range_aggregation_and_ordering() {
        assert_eq!(parse_version_tuple("1.4"), Some((1, 4)));
        assert_eq!(parse_version_tuple("v2.5"), Some((2, 5)));
        assert_eq!(parse_version_tuple(""), None);

        let temp_dir = std::env::temp_dir().join("zzz_test_fixer_versions");
        let _ = fs::remove_dir_all(&temp_dir);
        let _ = fs::create_dir_all(&temp_dir);

        let ini_content = r#"[TextureOverrideA]
hash = 11111111
[TextureOverrideB]
hash = 22222222
"#;
        fs::write(temp_dir.join("test.ini"), ini_content).unwrap();

        let mut db = FixerDatabase::default();
        db.rules.insert(
            "11111111".to_string(),
            FixerRule {
                hash: "11111111".to_string(),
                character: "Jane".to_string(),
                description: "Jane Body".to_string(),
                version_from: "2.4".to_string(),
                version_to: "3.0".to_string(),
                actions: vec![FixerRuleAction {
                    action_type: "update_hash".to_string(),
                    new_hash: Some("99999999".to_string()),
                    ..Default::default()
                }],
            },
        );
        db.rules.insert(
            "22222222".to_string(),
            FixerRule {
                hash: "22222222".to_string(),
                character: "Jane".to_string(),
                description: "Jane Hair".to_string(),
                version_from: "1.0".to_string(),
                version_to: "1.4".to_string(),
                actions: vec![FixerRuleAction {
                    action_type: "update_hash".to_string(),
                    new_hash: Some("88888888".to_string()),
                    ..Default::default()
                }],
            },
        );

        let analysis = analyze_mod_for_fixes(&temp_dir, &db);
        assert!(analysis.is_fixable);
        assert_eq!(analysis.detected_version_from, Some("1.0".to_string()));
        assert_eq!(analysis.detected_version_to, Some("3.0".to_string()));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_apply_mod_fix_character_isolation_prevents_cross_pollution() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_fixer_isolation_{}", unique_id));
        let _ = fs::remove_dir_all(&temp_dir);
        let mod_dir = temp_dir.join("NicoleMod");
        let _ = fs::create_dir_all(&mod_dir);

        let ini_content = r#"[TextureOverrideNicoleBody]
hash = 5a4c1ef3
"#;
        fs::write(mod_dir.join("Nicole.ini"), ini_content).unwrap();

        let mut db = FixerDatabase::default();
        // Nicole rule
        db.rules.insert(
            "5a4c1ef3".to_string(),
            FixerRule {
                hash: "5a4c1ef3".to_string(),
                character: "Nicole".to_string(),
                description: "Nicole Body IB".to_string(),
                actions: vec![FixerRuleAction {
                    action_type: "update_hash".to_string(),
                    new_hash: Some("e53364dd".to_string()),
                    ..Default::default()
                }],
                ..Default::default()
            },
        );
        // Rogue cross-character rule matching a generic hash
        db.rules.insert(
            "ebac056e".to_string(),
            FixerRule {
                hash: "ebac056e".to_string(),
                character: "Belle".to_string(),
                description: "Belle Summer Hair".to_string(),
                actions: vec![FixerRuleAction {
                    action_type: "add_section_if_missing".to_string(),
                    equiv_hashes: Some(vec!["a7683988".to_string()]),
                    section_title: Some("BelleSummer.Hair.IB".to_string()),
                    section_content: Some("match_priority = 0\n".to_string()),
                    ..Default::default()
                }],
                ..Default::default()
            },
        );

        let res = apply_mod_fix(&mod_dir, &db).expect("Fix should succeed");
        assert!(res.success);

        let fixed_ini = fs::read_to_string(mod_dir.join("Nicole.ini")).unwrap();
        assert!(fixed_ini.contains("hash = e53364dd"));
        // Ensure NO Belle sections were injected into Nicole's mod!
        assert!(!fixed_ini.contains("BelleSummer"));
        assert!(!fixed_ini.contains("a7683988"));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_find_referenced_buffers_contract_invariants() {
        let ini_content = r#"; Main body override with mixed casing and comments
[TextureOverrideHeroBodyTexcoord]
hash = 7B6C7D8E
; vb1 = ResourceIgnoredInComment
vb1 = ResourceHeroBodyTexcoord
run = CommandListDummy

; Unrelated section that must not contaminate results
[TextureOverrideOtherWeapon]
hash = 11223344
vb1 = ResourceWeaponTexcoord

; Matching Resource section
[ResourceHeroBodyTexcoord]
type = Buffer
stride = 28
filename = HeroBodyTexcoord.buf

; Unrelated resource
[ResourceWeaponTexcoord]
type = Buffer
stride = 36
filename = WeaponTexcoord.buf

; Malformed resource with missing stride (should default to 0 gracefully)
[TextureOverrideHeadTexcoord]
hash = 99887766
vb0 = ResourceHeadPosition

[ResourceHeadPosition]
type = Buffer
filename = HeadPosition.buf
"#;
        // 1. Invariant: Extracts correct filename and stride for matching hash and slot
        let buffers = find_referenced_buffers(ini_content, "7b6c7d8e", "vb1");
        assert_eq!(buffers.len(), 1);
        assert_eq!(buffers[0].0, "HeroBodyTexcoord.buf");
        assert_eq!(buffers[0].1, 28);

        // 2. Invariant: Case-insensitive hash and slot matching
        let buffers_upper = find_referenced_buffers(ini_content, "7B6C7D8E", "VB1");
        assert_eq!(buffers_upper.len(), 1);
        assert_eq!(buffers_upper[0].0, "HeroBodyTexcoord.buf");

        // 3. Invariant: Missing stride defaults to 0 without panicking
        let head_buffers = find_referenced_buffers(ini_content, "99887766", "vb0");
        assert_eq!(head_buffers.len(), 1);
        assert_eq!(head_buffers[0].0, "HeadPosition.buf");
        assert_eq!(head_buffers[0].1, 0);

        // 4. Invariant: Non-existent hash or slot returns empty Vec safely
        let unknown = find_referenced_buffers(ini_content, "deadbeef", "vb1");
        assert!(unknown.is_empty());
        let wrong_slot = find_referenced_buffers(ini_content, "7b6c7d8e", "ib");
        assert!(wrong_slot.is_empty());
    }

    #[test]
    fn test_analyze_mod_for_fixes_accurate_character_detection_and_isolation() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_fixer_analysis_{}", unique_id));
        let _ = fs::remove_dir_all(&temp_dir);

        let mod_dir = temp_dir
            .join("Playable Characters")
            .join("Nicole Demara - Lil Sassy")
            .join("NicolePinkMod");
        let _ = fs::create_dir_all(&mod_dir);

        let ini_content = r#"[TextureOverrideNicoleBody]
hash = 5a4c1ef3
[TextureOverrideSharedNormal]
hash = ebac056e
[TextureOverrideBelleRogueIB]
hash = 619c5c94
"#;
        fs::write(mod_dir.join("Nicole.ini"), ini_content).unwrap();

        let mut db = FixerDatabase::default();
        // Nicole Body IB
        db.rules.insert(
            "5a4c1ef3".to_string(),
            FixerRule {
                hash: "5a4c1ef3".to_string(),
                character: "Nicole".to_string(),
                description: "Nicole Body IB".to_string(),
                actions: vec![FixerRuleAction {
                    action_type: "update_hash".to_string(),
                    new_hash: Some("e53364dd".to_string()),
                    ..Default::default()
                }],
                ..Default::default()
            },
        );
        // Shared texture that was cataloged under Jane in the database
        db.rules.insert(
            "ebac056e".to_string(),
            FixerRule {
                hash: "ebac056e".to_string(),
                character: "Jane".to_string(),
                description: "Jane NormalMap".to_string(),
                actions: vec![FixerRuleAction {
                    action_type: "update_hash".to_string(),
                    new_hash: Some("798adba3".to_string()),
                    ..Default::default()
                }],
                ..Default::default()
            },
        );
        // Belle rogue IB
        db.rules.insert(
            "619c5c94".to_string(),
            FixerRule {
                hash: "619c5c94".to_string(),
                character: "Belle".to_string(),
                description: "Belle Summer Body IB".to_string(),
                actions: vec![FixerRuleAction {
                    action_type: "update_hash".to_string(),
                    new_hash: Some("99999999".to_string()),
                    ..Default::default()
                }],
                ..Default::default()
            },
        );

        let analysis = analyze_mod_for_fixes(&mod_dir, &db);
        assert_eq!(analysis.detected_character, Some("Nicole".to_string()));

        // Check hash_fixes: must only contain Nicole body and shared normal (attributed to Nicole)
        assert_eq!(analysis.hash_fixes.len(), 2);
        let chars: Vec<String> = analysis.hash_fixes.iter().map(|f| f.character.clone()).collect();
        assert!(chars.iter().all(|c| c == "Nicole"));

        // Belle rogue IB must NOT be in the fix list!
        assert!(!analysis.hash_fixes.iter().any(|f| f.old_hash == "619c5c94"));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_apply_mod_fix_texcoord_buffer_remapping_and_stride_sync() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_fixer_texcoord_{}", unique_id));
        let _ = fs::remove_dir_all(&temp_dir);
        let mod_dir = temp_dir
            .join("Playable Characters")
            .join("Caesar King - Inferno Joyride")
            .join("CaesarMod");
        let _ = fs::create_dir_all(&mod_dir);

        let ini_content = r#"[TextureOverrideCaesarBodyTexcoord]
hash = 3b2a70a5
vb1 = ResourceCaesarBodyTexcoord

[ResourceCaesarBodyTexcoord]
type = Buffer
stride = 24
filename = CaesarBodyTexcoord.buf
"#;
        fs::write(mod_dir.join("Caesar.ini"), ini_content).unwrap();

        // Write a mock 24-byte stride buffer for 2 vertices (2 * 24 = 48 bytes)
        let mock_buf = vec![0u8; 48];
        fs::write(mod_dir.join("CaesarBodyTexcoord.buf"), &mock_buf).unwrap();

        let mut db = FixerDatabase::default();
        db.rules.insert(
            "3b2a70a5".to_string(),
            FixerRule {
                hash: "3b2a70a5".to_string(),
                character: "Caesar".to_string(),
                description: "Caesar Body Texcoord Hash".to_string(),
                actions: vec![
                    FixerRuleAction {
                        action_type: "update_hash".to_string(),
                        new_hash: Some("0ca81129".to_string()),
                        ..Default::default()
                    },
                    FixerRuleAction {
                        action_type: "remap_texcoord".to_string(),
                        old_format: Some(vec!["4B".to_string(), "2e".to_string(), "2f".to_string(), "2e".to_string(), "2e".to_string()]),
                        new_format: Some(vec!["4B".to_string(), "2f".to_string(), "2f".to_string(), "2f".to_string(), "2f".to_string()]),
                        ..Default::default()
                    },
                ],
                ..Default::default()
            },
        );

        let res = apply_mod_fix(&mod_dir, &db).expect("Fix should succeed");
        assert!(res.success);
        assert_eq!(res.hashes_updated, 1);
        assert_eq!(res.buffers_remapped, 1);

        // Check that INI updated the hash AND the stride
        let fixed_ini = fs::read_to_string(mod_dir.join("Caesar.ini")).unwrap();
        assert!(fixed_ini.contains("hash = 0ca81129"));
        assert!(fixed_ini.contains("stride = 36"));
        assert!(!fixed_ini.contains("stride = 24"));

        // Check that binary buffer was resized to 2 * 36 = 72 bytes
        let fixed_buf = fs::read(mod_dir.join("CaesarBodyTexcoord.buf")).unwrap();
        assert_eq!(fixed_buf.len(), 72);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_find_referenced_buffers_ref_syntax_and_commandlist_indirection() {
        let ini_content = r#"; Toggle mod using command lists and ref syntax
[TextureOverrideCaesarBody]
hash = 3b2a70a5
run = CommandListCaesarBody

[CommandListCaesarBody]
vb1 = ref ResourceCaesarTexcoord
run = CommandListNested

[CommandListNested]
vb2 = ref ResourceCaesarBlend

[ResourceCaesarTexcoord]
type = Buffer
stride = 24
filename = ".\CaesarTexcoord.buf"

[ResourceCaesarBlend]
type = Buffer
stride = 32
filename = "CaesarBlend.buf"
"#;
        // Test ref keyword and commandlist indirection
        let vb1_bufs = find_referenced_buffers(ini_content, "3b2a70a5", "vb1");
        assert_eq!(vb1_bufs.len(), 1);
        assert_eq!(vb1_bufs[0].0, "CaesarTexcoord.buf");
        assert_eq!(vb1_bufs[0].1, 24);

        // Test nested commandlist indirection
        let vb2_bufs = find_referenced_buffers(ini_content, "3b2a70a5", "vb2");
        assert_eq!(vb2_bufs.len(), 1);
        assert_eq!(vb2_bufs[0].0, "CaesarBlend.buf");
        assert_eq!(vb2_bufs[0].1, 32);
    }

    #[test]
    fn test_calc_format_chunk_size_contract_invariants() {
        // 2-byte formats
        assert_eq!(calc_format_chunk_size("1e"), 2);
        assert_eq!(calc_format_chunk_size("1E"), 2);
        assert_eq!(calc_format_chunk_size("1i"), 2);
        assert_eq!(calc_format_chunk_size("1s"), 2);

        // 4-byte formats
        assert_eq!(calc_format_chunk_size("4B"), 4);
        assert_eq!(calc_format_chunk_size("4b"), 4);
        assert_eq!(calc_format_chunk_size("2e"), 4);
        assert_eq!(calc_format_chunk_size("2E"), 4);
        assert_eq!(calc_format_chunk_size("1f"), 4);
        assert_eq!(calc_format_chunk_size("1F"), 4);
        assert_eq!(calc_format_chunk_size("2i"), 4);
        assert_eq!(calc_format_chunk_size("2s"), 4);
        assert_eq!(calc_format_chunk_size("1I"), 4);

        // 8-byte formats
        assert_eq!(calc_format_chunk_size("2f"), 8);
        assert_eq!(calc_format_chunk_size("2F"), 8);
        assert_eq!(calc_format_chunk_size("4e"), 8);
        assert_eq!(calc_format_chunk_size("4E"), 8);
        assert_eq!(calc_format_chunk_size("4i"), 8);
        assert_eq!(calc_format_chunk_size("4s"), 8);
        assert_eq!(calc_format_chunk_size("2I"), 8);

        // 12-byte formats
        assert_eq!(calc_format_chunk_size("3f"), 12);
        assert_eq!(calc_format_chunk_size("3F"), 12);
        assert_eq!(calc_format_chunk_size("3I"), 12);

        // 16-byte formats
        assert_eq!(calc_format_chunk_size("4f"), 16);
        assert_eq!(calc_format_chunk_size("4F"), 16);
        assert_eq!(calc_format_chunk_size("4I"), 16);
    }

    #[test]
    fn test_update_resource_stride_in_ini_quotes_and_relative_paths() {
        let ini = "[ResourceCaesar]\ntype = Buffer\nfilename = \".\\Caesar.buf\"\nstride = 24\n";
        let (updated, changed) = update_resource_stride_in_ini(ini, "Caesar.buf", 36);
        assert!(changed);
        assert!(updated.contains("stride = 36"));
        assert!(!updated.contains("stride = 24"));

        // Test with standard relative path .\
        let ini2 = "[ResourceCaesar]\ntype = Buffer\nfilename = .\\Caesar.buf\nstride = 20\n";
        let (updated2, changed2) = update_resource_stride_in_ini(ini2, "Caesar.buf", 28);
        assert!(changed2);
        assert!(updated2.contains("stride = 28"));
    }

    #[test]
    fn test_update_blend_indices_serde_alias_and_remapping() {
        let json_rule = r#"{
            "type": "update_blend_indices",
            "hash": "d2844c01",
            "old_indices": [10, 20],
            "new_indices": [5, 15]
        }"#;

        let action: FixerRuleAction = serde_json::from_str(json_rule).expect("Must deserialize 'hash' as target_hash");
        assert_eq!(action.target_hash, Some("d2844c01".to_string()));

        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_fixer_blend_{}", unique_id));
        let _ = fs::remove_dir_all(&temp_dir);
        let mod_dir = temp_dir
            .join("Playable Characters")
            .join("Jane Doe - Crimson Shadow")
            .join("JaneMod");
        let _ = fs::create_dir_all(&mod_dir);

        let ini_content = r#"[TextureOverrideJaneTrigger]
hash = caf95576

[TextureOverrideJaneBlendTarget]
hash = d2844c01
vb2 = ResourceJaneBlend

[ResourceJaneBlend]
type = Buffer
stride = 32
filename = JaneBlend.buf
"#;
        fs::write(mod_dir.join("Jane.ini"), ini_content).unwrap();

        // 32-byte stride: 16 bytes weights, 16 bytes indices (4x u32: 10, 20, 0, 0)
        let mut mock_buf = vec![0u8; 16];
        mock_buf.write_u32::<LittleEndian>(10).unwrap();
        mock_buf.write_u32::<LittleEndian>(20).unwrap();
        mock_buf.write_u32::<LittleEndian>(0).unwrap();
        mock_buf.write_u32::<LittleEndian>(0).unwrap();
        fs::write(mod_dir.join("JaneBlend.buf"), &mock_buf).unwrap();

        let mut db = FixerDatabase::default();
        db.rules.insert(
            "caf95576".to_string(),
            FixerRule {
                hash: "caf95576".to_string(),
                character: "Jane".to_string(),
                description: "Jane Trigger Hash".to_string(),
                actions: vec![action],
                ..Default::default()
            },
        );

        let res = apply_mod_fix(&mod_dir, &db).expect("Fix should succeed");
        assert!(res.success);
        assert_eq!(res.buffers_remapped, 1);

        let fixed_buf = fs::read(mod_dir.join("JaneBlend.buf")).unwrap();
        let mut cursor = Cursor::new(&fixed_buf[16..32]);
        let i1 = cursor.read_u32::<LittleEndian>().unwrap();
        let i2 = cursor.read_u32::<LittleEndian>().unwrap();
        assert_eq!(i1, 5);  // 10 -> 5
        assert_eq!(i2, 15); // 20 -> 15

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_recursive_backup_and_restore_contract_invariants() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_fixer_backup_{}", unique_id));
        let _ = fs::remove_dir_all(&temp_dir);
        let sub_dir = temp_dir.join("Subfolder").join("Nested");
        let _ = fs::create_dir_all(&sub_dir);

        let ini_file = sub_dir.join("NestedMod.ini");
        fs::write(&ini_file, "[TextureOverride]\nhash = 11112222\n").unwrap();

        assert!(!has_mod_backup(&temp_dir));

        // Create backup in nested subfolder
        let backup_file = sub_dir.join("DISABLED_BACKUP_1700000000_NestedMod.ini.bak");
        fs::write(&backup_file, "[TextureOverrideOriginal]\nhash = 00000000\n").unwrap();

        // Must detect backup recursively
        assert!(has_mod_backup(&temp_dir));

        // Restore backup
        let restored = restore_mod_backup(&temp_dir).expect("Restore should succeed");
        assert!(restored);

        // Verify restored file exists in subfolder and has original content without double extension
        assert!(ini_file.exists());
        let restored_content = fs::read_to_string(&ini_file).unwrap();
        assert!(restored_content.contains("hash = 00000000"));
        assert!(!backup_file.exists(), "Backup file should be removed upon restoration");
        assert!(!has_mod_backup(&temp_dir));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_add_section_if_missing_analysis_and_injection() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_fixer_add_sec_{}", unique_id));
        let _ = fs::remove_dir_all(&temp_dir);
        let mod_dir = temp_dir
            .join("Playable Characters")
            .join("Caesar King - Inferno Joyride")
            .join("CaesarWeaponMod");
        let _ = fs::create_dir_all(&mod_dir);

        let ini_content = "[TextureOverrideCaesarWeaponTex]\nhash = 12345678\n";
        fs::write(mod_dir.join("Weapon.ini"), ini_content).unwrap();

        let mut db = FixerDatabase::default();
        db.rules.insert(
            "12345678".to_string(),
            FixerRule {
                hash: "12345678".to_string(),
                character: "Caesar".to_string(),
                description: "Caesar Weapon Tex".to_string(),
                actions: vec![FixerRuleAction {
                    action_type: "add_section_if_missing".to_string(),
                    equiv_hashes: Some(vec!["57c63788".to_string()]),
                    section_title: Some("Caesar.Weapon.IB".to_string()),
                    section_content: Some("match_priority = 0".to_string()),
                    ..Default::default()
                }],
                ..Default::default()
            },
        );

        let analysis = analyze_mod_for_fixes(&mod_dir, &db);
        assert!(analysis.is_fixable, "Mod with missing required section must be marked is_fixable");
        assert_eq!(analysis.multi_res_fixes.len(), 1);
        assert_eq!(analysis.multi_res_fixes[0].target_hash, "57c63788");

        let fix_res = apply_mod_fix(&mod_dir, &db).expect("Fix should succeed");
        assert!(fix_res.success);
        assert_eq!(fix_res.sections_added, 1);

        let fixed_ini = fs::read_to_string(mod_dir.join("Weapon.ini")).unwrap();
        assert!(fixed_ini.contains("[TextureOverrideCaesar.Weapon.IB]"));
        assert!(fixed_ini.contains("hash = 57c63788"));
        assert!(fixed_ini.contains("match_priority = 0"));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_shared_hash_section_title_character_isolation() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_fixer_shared_hash_isolation_{}", unique_id));
        let _ = fs::remove_dir_all(&temp_dir);
        let mod_dir = temp_dir
            .join("Playable Characters")
            .join("Alice Thymefield - Celestian Etiquette")
            .join("AliceMod");
        let _ = fs::create_dir_all(&mod_dir);

        let ini_content = "[TextureOverrideAliceFace]\nhash = 9f3e582c\nthis = ResourceDiffuseMap_Face\n\n[TextureOverrideAliceLegs]\nhash = 3e4c0174\n";
        fs::write(mod_dir.join("Alice.ini"), ini_content).unwrap();

        let mut db = FixerDatabase::default();
        // 3e4c0174 is shared between Alice and Billy, but rule.character is Alice
        db.rules.insert(
            "3e4c0174".to_string(),
            FixerRule {
                hash: "3e4c0174".to_string(),
                character: "Alice".to_string(),
                description: "Legs VB Hash".to_string(),
                actions: vec![
                    FixerRuleAction {
                        action_type: "add_section_if_missing".to_string(),
                        equiv_hashes: Some(vec!["625c2692".to_string()]),
                        section_title: Some("Alice.Legs.IB".to_string()),
                        section_content: Some("match_priority = 0".to_string()),
                        ..Default::default()
                    },
                    FixerRuleAction {
                        action_type: "add_section_if_missing".to_string(),
                        equiv_hashes: Some(vec!["21e98aeb".to_string()]),
                        section_title: Some("Billy.Hair.IB".to_string()),
                        section_content: Some("match_priority = 0".to_string()),
                        ..Default::default()
                    },
                ],
                ..Default::default()
            },
        );

        // 9f3e582c has a multi-res duplication for Alice Face
        db.rules.insert(
            "9f3e582c".to_string(),
            FixerRule {
                hash: "9f3e582c".to_string(),
                character: "Alice".to_string(),
                description: "Face Diffuse 2048p".to_string(),
                actions: vec![
                    FixerRuleAction {
                        action_type: "multiply_section_if_missing".to_string(),
                        equiv_hashes: Some(vec!["33fdeb6d".to_string()]),
                        section_title: Some("Alice.FaceA.Diffuse.1024".to_string()),
                        ..Default::default()
                    },
                ],
                ..Default::default()
            },
        );

        let analysis = analyze_mod_for_fixes(&mod_dir, &db);
        // Billy.Hair.IB must NOT be proposed for an Alice mod!
        assert!(!analysis.multi_res_fixes.iter().any(|f| f.section_title.starts_with("Billy")), "Billy actions must be excluded from Alice mod: {:?}", analysis.multi_res_fixes);
        assert!(analysis.multi_res_fixes.iter().any(|f| f.section_title == "Alice.FaceA.Diffuse.1024"));
        assert!(analysis.multi_res_fixes.iter().any(|f| f.section_title == "Alice.Legs.IB"));

        let fix_res = apply_mod_fix(&mod_dir, &db).expect("Fix should succeed");
        assert!(fix_res.success);

        let fixed_ini = fs::read_to_string(mod_dir.join("Alice.ini")).unwrap();
        // Billy.Hair.IB must NOT be in the INI!
        assert!(!fixed_ini.contains("Billy"), "Billy hair override must not be injected into Alice mod");
        // Alice.FaceA.Diffuse.1024 must be present and preserve 'this = ResourceDiffuseMap_Face'
        assert!(fixed_ini.contains("[TextureOverrideAlice.FaceA.Diffuse.1024]"));
        assert!(fixed_ini.contains("hash = 33fdeb6d"));
        assert!(fixed_ini.contains("this = ResourceDiffuseMap_Face"), "Copied section body must preserve resource bindings");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_skin_isolation_prevents_cross_pollution() {
        // Base Jane vs alternate skin
        assert!(!is_character_match("Jane", "JaneDoeNocturneOfLight"));
        assert!(!is_character_match("JaneDoe", "JaneDoeNocturneOfLight"));
        assert!(!is_character_match("Jane Doe", "JaneDoeNocturneOfLight"));
        assert!(is_character_match("Jane", "JaneDoe"));
        assert!(is_character_match("JaneDoe", "Jane"));
        assert!(is_character_match("Jane Doe", "JaneDoe"));
        assert!(is_character_match("JaneDoeNocturneOfLight", "JaneDoeNocturneOfLight"));

        // Ellen vs EllenCampus
        assert!(!is_character_match("Ellen", "EllenCampus"));
        assert!(!is_character_match("EllenJoe", "EllenCampus"));
        assert!(is_character_match("Ellen", "EllenJoe"));
        assert!(is_character_match("EllenCampus", "EllenCampus"));

        // Belle vs Belle alternate skins
        assert!(!is_character_match("Belle", "BelleSummer"));
        assert!(!is_character_match("Belle", "BelleBrillianceOfStars"));
        assert!(!is_character_match("Belle", "BelleDelicateSunlight"));
        assert!(is_character_match("Belle", "Belle"));

        // Alice vs AliceSummer
        assert!(!is_character_match("Alice", "AliceSummer"));
        assert!(!is_character_match("Alice", "AliceSeaOfTime"));
        assert!(is_character_match("Alice", "Alice"));

        // Known aliases: Rina <-> Alexandrina
        assert!(is_character_match("Rina", "Alexandrina"));
        assert!(is_character_match("Rina", "AlexandrinaSebastiane"));
        assert!(is_character_match("AlexandrinaSebastiane", "Rina"));
    }

    #[test]
    fn test_detect_character_and_skin_from_category_path() {
        let p_jane_base = Path::new(r"C:\Games\Mods\Playable Characters\Jane Doe - Hidden Nightfade\JaneDice");
        assert_eq!(detect_character_from_mod_path(p_jane_base), Some("JaneDoe".to_string()));

        let p_jane_alt = Path::new(r"C:\Games\Mods\Playable Characters\Jane Doe - Nocturne of Light\JaneBikini");
        assert_eq!(detect_character_from_mod_path(p_jane_alt), Some("JaneDoeNocturneOfLight".to_string()));

        let p_ellen_alt = Path::new(r"C:\Games\Mods\Playable Characters\Ellen Joe - On Campus\EllenSchool");
        assert_eq!(detect_character_from_mod_path(p_ellen_alt), Some("EllenCampus".to_string()));

        let p_ellen_base = Path::new(r"C:\Games\Mods\Playable Characters\Ellen Joe - Ellen Scissorhands\EllenMod");
        assert_eq!(detect_character_from_mod_path(p_ellen_base), Some("Ellen".to_string()));

        let p_rina_base = Path::new(r"C:\Games\Mods\Playable Characters\Alexandrina Sebastiane - Head Maid's Perfection\RinaMod");
        assert_eq!(detect_character_from_mod_path(p_rina_base), Some("Rina".to_string()));
    }

    #[test]
    fn test_predecessor_lineage_satisfies_add_section_if_missing() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_fixer_lineage_{}", unique_id));
        let _ = fs::remove_dir_all(&temp_dir);
        let mod_dir = temp_dir
            .join("Playable Characters")
            .join("Jane Doe - Hidden Nightfade")
            .join("JaneTestMod");
        let _ = fs::create_dir_all(&mod_dir);

        // Mod has old IB hash 9268a5af
        let ini_content = "[TextureOverrideJaneHairIB]\nhash = 9268a5af\nhandling = skip\n";
        fs::write(mod_dir.join("Jane.ini"), ini_content).unwrap();

        let mut db = FixerDatabase::default();
        // 9268a5af migrates to 3275b812
        db.rules.insert(
            "9268a5af".to_string(),
            FixerRule {
                hash: "9268a5af".to_string(),
                character: "JaneDoe".to_string(),
                description: "Jane Hair IB".to_string(),
                actions: vec![FixerRuleAction {
                    action_type: "update_hash".to_string(),
                    new_hash: Some("3275b812".to_string()),
                    ..Default::default()
                }],
                ..Default::default()
            },
        );

        // Another rule triggers add_section_if_missing for 3275b812
        db.rules.insert(
            "40fca454".to_string(),
            FixerRule {
                hash: "40fca454".to_string(),
                character: "JaneDoe".to_string(),
                description: "Jane Hair MaterialMap".to_string(),
                actions: vec![FixerRuleAction {
                    action_type: "add_section_if_missing".to_string(),
                    equiv_hashes: Some(vec!["3275b812".to_string()]),
                    section_title: Some("Jane.Hair.IB".to_string()),
                    section_content: Some("match_priority = 0".to_string()),
                    ..Default::default()
                }],
                ..Default::default()
            },
        );

        // Mod hashes set has 9268a5af
        let mut mod_hashes = HashSet::new();
        mod_hashes.insert("9268a5af".to_string());
        // 3275b812 must be satisfied because 9268a5af resolves to 3275b812!
        assert!(is_equiv_hash_satisfied("3275b812", &mod_hashes, &db));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_jane_dice_upgrade_clean_contract() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_fixer_janedice_{}", unique_id));
        let _ = fs::remove_dir_all(&temp_dir);
        let mod_dir = temp_dir
            .join("Playable Characters")
            .join("Jane Doe - Hidden Nightfade")
            .join("JaneDice");
        let _ = fs::create_dir_all(&mod_dir);

        let original_ini = r#"
[TextureOverrideJaneHairIB]
hash = 9268a5af
handling = skip

[TextureOverrideJaneHairA]
hash = 9268a5af
match_first_index = 0
run = CommandListSkinTexture
ib = ResourceJaneHairAIB

[TextureOverrideJaneHairBlend]
hash = 8721477f

[TextureOverrideJaneHairDraw]
hash = 2d06e785

[TextureOverrideJaneHairTexcoord]
hash = acec29f8

[TextureOverrideJaneHairAMaterialMap]
hash = 5e34e275
this = ResourceJaneHairAMaterialMap

[TextureOverrideJane.HairA.MaterialMap.1024]
hash = 40fca454
this = ResourceJaneHairAMaterialMap
"#;
        fs::write(mod_dir.join("Jane.ini"), original_ini).unwrap();

        let mut db = FixerDatabase::default();
        // 1. Jane Hair IB
        db.rules.insert(
            "9268a5af".to_string(),
            FixerRule {
                hash: "9268a5af".to_string(),
                character: "JaneDoe".to_string(),
                description: "Jane Hair IB Hash".to_string(),
                version_from: "1.4".to_string(),
                version_to: "2.5".to_string(),
                actions: vec![FixerRuleAction {
                    action_type: "update_hash".to_string(),
                    new_hash: Some("3275b812".to_string()),
                    ..Default::default()
                }],
            },
        );
        // 2. Jane Hair Blend
        db.rules.insert(
            "8721477f".to_string(),
            FixerRule {
                hash: "8721477f".to_string(),
                character: "JaneDoe".to_string(),
                description: "Jane Hair Blend Hash".to_string(),
                version_from: "1.4".to_string(),
                version_to: "2.5".to_string(),
                actions: vec![FixerRuleAction {
                    action_type: "update_hash".to_string(),
                    new_hash: Some("e42171df".to_string()),
                    ..Default::default()
                }],
            },
        );
        // 3. Jane Hair Draw
        db.rules.insert(
            "2d06e785".to_string(),
            FixerRule {
                hash: "2d06e785".to_string(),
                character: "JaneDoe".to_string(),
                description: "Jane Hair Draw Hash".to_string(),
                version_from: "1.4".to_string(),
                version_to: "2.5".to_string(),
                actions: vec![FixerRuleAction {
                    action_type: "update_hash".to_string(),
                    new_hash: Some("74bc0b7f".to_string()),
                    ..Default::default()
                }],
            },
        );
        // 4. Jane Hair Texcoord
        db.rules.insert(
            "acec29f8".to_string(),
            FixerRule {
                hash: "acec29f8".to_string(),
                character: "JaneDoe".to_string(),
                description: "Jane Hair Texcoord Hash".to_string(),
                version_from: "1.4".to_string(),
                version_to: "2.5".to_string(),
                actions: vec![FixerRuleAction {
                    action_type: "update_hash".to_string(),
                    new_hash: Some("fa617c9a".to_string()),
                    ..Default::default()
                }],
            },
        );
        // 5. 40fca454 with both base Jane action and rogue JaneDoeNocturneOfLight action
        db.rules.insert(
            "40fca454".to_string(),
            FixerRule {
                hash: "40fca454".to_string(),
                character: "JaneDoe".to_string(),
                description: "Jane Hair MaterialMap 1024p".to_string(),
                version_from: "2.5".to_string(),
                version_to: "2.5".to_string(),
                actions: vec![
                    FixerRuleAction {
                        action_type: "multiply_section_if_missing".to_string(),
                        equiv_hashes: Some(vec!["5e34e275".to_string()]),
                        section_title: Some("Jane.HairA.MaterialMap.2048".to_string()),
                        ..Default::default()
                    },
                    FixerRuleAction {
                        action_type: "add_section_if_missing".to_string(),
                        equiv_hashes: Some(vec!["3275b812".to_string(), "9268a5af".to_string()]),
                        section_title: Some("Jane.Hair.IB".to_string()),
                        section_content: Some("match_priority = 0".to_string()),
                        ..Default::default()
                    },
                    FixerRuleAction {
                        action_type: "add_section_if_missing".to_string(),
                        equiv_hashes: Some(vec!["3275b812".to_string()]),
                        section_title: Some("JaneDoeNocturneOfLight.Hair.IB".to_string()),
                        section_content: Some("match_priority = 0".to_string()),
                        ..Default::default()
                    },
                ],
            },
        );

        let analysis = analyze_mod_for_fixes(&mod_dir, &db);
        assert!(analysis.is_fixable);
        assert_eq!(analysis.detected_character, Some("JaneDoe".to_string()));
        assert_eq!(analysis.hash_fixes.len(), 4, "Must detect exactly the 4 legitimate hash upgrades");
        assert_eq!(analysis.multi_res_fixes.len(), 0, "Must NOT propose rogue Nocturne of Light multi-res overrides");
        assert_eq!(analysis.buffer_fixes.len(), 0);

        let fix_res = apply_mod_fix(&mod_dir, &db).expect("Fix should succeed");
        assert!(fix_res.success);
        assert_eq!(fix_res.hashes_updated, 4);
        assert_eq!(fix_res.sections_added, 0, "No rogue sections must be injected");

        let fixed_ini = fs::read_to_string(mod_dir.join("Jane.ini")).unwrap();
        assert!(!fixed_ini.contains("JaneDoeNocturneOfLight"), "Must NEVER inject Nocturne of Light section");
        assert!(fixed_ini.contains("hash = 3275b812"), "Must upgrade 9268a5af to 3275b812");
        assert!(fixed_ini.contains("handling = skip"), "Must preserve handling = skip");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_multi_version_chain_resolution_1_0_to_3_2() {
        let mut db = FixerDatabase::default();
        // 1.0 -> 1.4
        db.rules.insert(
            "10101010".to_string(),
            FixerRule {
                hash: "10101010".to_string(),
                character: "Anby".to_string(),
                description: "Anby Head (1.0 -> 1.4)".to_string(),
                version_from: "1.0".to_string(),
                version_to: "1.4".to_string(),
                actions: vec![FixerRuleAction {
                    action_type: "update_hash".to_string(),
                    new_hash: Some("14141414".to_string()),
                    ..Default::default()
                }],
            },
        );
        // 1.4 -> 2.5
        db.rules.insert(
            "14141414".to_string(),
            FixerRule {
                hash: "14141414".to_string(),
                character: "Anby".to_string(),
                description: "Anby Head (1.4 -> 2.5)".to_string(),
                version_from: "1.4".to_string(),
                version_to: "2.5".to_string(),
                actions: vec![FixerRuleAction {
                    action_type: "update_hash".to_string(),
                    new_hash: Some("25252525".to_string()),
                    ..Default::default()
                }],
            },
        );
        // 2.5 -> 3.1
        db.rules.insert(
            "25252525".to_string(),
            FixerRule {
                hash: "25252525".to_string(),
                character: "Anby".to_string(),
                description: "Anby Head (2.5 -> 3.1)".to_string(),
                version_from: "2.5".to_string(),
                version_to: "3.1".to_string(),
                actions: vec![FixerRuleAction {
                    action_type: "update_hash".to_string(),
                    new_hash: Some("31313131".to_string()),
                    ..Default::default()
                }],
            },
        );
        // 3.1 -> 3.2 (Terminal)
        db.rules.insert(
            "31313131".to_string(),
            FixerRule {
                hash: "31313131".to_string(),
                character: "Anby".to_string(),
                description: "Anby Head (3.1 -> 3.2)".to_string(),
                version_from: "3.1".to_string(),
                version_to: "3.2".to_string(),
                actions: vec![FixerRuleAction {
                    action_type: "update_hash".to_string(),
                    new_hash: Some("32323232".to_string()),
                    ..Default::default()
                }],
            },
        );

        let (terminal_from_1_0, path_from_1_0) = resolve_terminal_hash("10101010", &db);
        assert_eq!(terminal_from_1_0, "32323232");
        assert_eq!(path_from_1_0, vec!["14141414", "25252525", "31313131", "32323232"]);

        let (terminal_from_2_5, path_from_2_5) = resolve_terminal_hash("25252525", &db);
        assert_eq!(terminal_from_2_5, "32323232");
        assert_eq!(path_from_2_5, vec!["31313131", "32323232"]);

        // Already at 3.2 (terminal)
        let (terminal_from_3_2, path_from_3_2) = resolve_terminal_hash("32323232", &db);
        assert_eq!(terminal_from_3_2, "32323232");
        assert!(path_from_3_2.is_empty(), "Terminal hash must have 0 outgoing hops");
    }

    #[test]
    fn test_remielle_3_1_to_3_2_upgrade_contract() {
        let temp_dir = std::env::temp_dir().join(format!(
            "zzz_test_remielle_3_2_upgrade_{}",
            std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()
        ));
        let _ = fs::remove_dir_all(&temp_dir);
        let mod_dir = temp_dir.join("Playable Characters").join("Remielle - Default Outfit").join("RemielleMod");
        fs::create_dir_all(&mod_dir).unwrap();

        let ini_content = r#"[TextureOverrideRemielleBody]
hash = 785b21f5
match_first_index = 0

[TextureOverrideRemielleBodyVB]
hash = 7a92a10a
"#;
        fs::write(mod_dir.join("Remielle.ini"), ini_content).unwrap();

        let mut db = FixerDatabase::default();
        // 3.1 -> 3.2 Body IB
        db.rules.insert(
            "785b21f5".to_string(),
            FixerRule {
                hash: "785b21f5".to_string(),
                character: "Remielle".to_string(),
                description: "Remielle Body ib".to_string(),
                version_from: "3.1".to_string(),
                version_to: "3.2".to_string(),
                actions: vec![FixerRuleAction {
                    action_type: "update_hash".to_string(),
                    new_hash: Some("28e05a59".to_string()),
                    ..Default::default()
                }],
            },
        );
        // 3.1 -> 3.2 Body VB
        db.rules.insert(
            "7a92a10a".to_string(),
            FixerRule {
                hash: "7a92a10a".to_string(),
                character: "Remielle".to_string(),
                description: "Remielle Body draw".to_string(),
                version_from: "3.1".to_string(),
                version_to: "3.2".to_string(),
                actions: vec![FixerRuleAction {
                    action_type: "update_hash".to_string(),
                    new_hash: Some("97664f2f".to_string()),
                    ..Default::default()
                }],
            },
        );

        let analysis = analyze_mod_for_fixes(&mod_dir, &db);
        assert!(analysis.is_fixable);
        assert_eq!(analysis.hash_fixes.len(), 2);
        assert_eq!(analysis.hash_fixes[0].new_hash, "28e05a59");
        assert_eq!(analysis.hash_fixes[1].new_hash, "97664f2f");
        
        let fix_res = apply_mod_fix(&mod_dir, &db).expect("Fix should succeed");
        assert!(fix_res.success);
        assert_eq!(fix_res.hashes_updated, 2);

        let fixed_ini = fs::read_to_string(mod_dir.join("Remielle.ini")).unwrap();
        assert!(fixed_ini.contains("hash = 28e05a59"), "Must upgrade Body IB to 28e05a59");
        assert!(fixed_ini.contains("hash = 97664f2f"), "Must upgrade Body VB to 97664f2f");
        assert!(fixed_ini.contains("; [ZZZMODMANAGER PREVIOUS HASH] hash = 785b21f5"));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_cycle_prevention_on_historical_reverts() {
        let mut db = FixerDatabase::default();
        // Commit 1: 39538886 -> 496a781d
        db.rules.insert(
            "39538886".to_string(),
            FixerRule {
                hash: "39538886".to_string(),
                character: "Anby".to_string(),
                description: "Anby Hair revert".to_string(),
                version_from: "Commit1".to_string(),
                version_to: "3.2".to_string(),
                actions: vec![FixerRuleAction {
                    action_type: "update_hash".to_string(),
                    new_hash: Some("496a781d".to_string()),
                    ..Default::default()
                }],
            },
        );
        // Terminal grounded: 496a781d is active, has NO outgoing update_hash
        db.rules.insert(
            "496a781d".to_string(),
            FixerRule {
                hash: "496a781d".to_string(),
                character: "Anby".to_string(),
                description: "Anby Hair active canonical".to_string(),
                version_from: "3.2".to_string(),
                version_to: "3.2".to_string(),
                actions: vec![],
            },
        );

        let (terminal_old, path_old) = resolve_terminal_hash("39538886", &db);
        assert_eq!(terminal_old, "496a781d");
        assert_eq!(path_old, vec!["496a781d"]);

        let (terminal_active, path_active) = resolve_terminal_hash("496a781d", &db);
        assert_eq!(terminal_active, "496a781d");
        assert!(path_active.is_empty());
    }

    #[test]
    fn test_submesh_index_remapping_contract() {
        let temp_dir = std::env::temp_dir().join(format!("zmm_test_index_remap_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        let mod_dir = temp_dir.join("Playable Characters").join("Remielle Dan - Test").join("MyRemielleMod");
        fs::create_dir_all(&mod_dir).unwrap();

        let ini_content = r#"[TextureOverrideRemielleBodyA]
hash = 785b21f5
match_first_index = 0
ib = ResourceBodyAIB

[TextureOverrideRemielleBodyB]
hash = 785b21f5
match_first_index = 57612
ib = ResourceBodyBIB
"#;
        fs::write(mod_dir.join("Mod.ini"), ini_content).unwrap();

        let mut db = FixerDatabase::default();
        db.rules.insert(
            "785b21f5".to_string(),
            FixerRule {
                hash: "785b21f5".to_string(),
                character: "Remielle".to_string(),
                description: "Remielle Body IB Hash".to_string(),
                version_from: "3.1".to_string(),
                version_to: "3.2".to_string(),
                actions: vec![
                    FixerRuleAction {
                        action_type: "update_hash".to_string(),
                        new_hash: Some("28e05a59".to_string()),
                        ..Default::default()
                    },
                    FixerRuleAction {
                        action_type: "remap_indices".to_string(),
                        from_indices: Some(vec![0, 57612]),
                        to_indices: Some(vec![0, 59094]),
                        ..Default::default()
                    },
                ],
            },
        );

        // 1. Analysis phase
        let analysis = analyze_mod_for_fixes(&mod_dir, &db);
        assert!(analysis.is_fixable);
        assert_eq!(analysis.hash_fixes.len(), 1);
        assert_eq!(analysis.hash_fixes[0].new_hash, "28e05a59");
        assert_eq!(analysis.index_fixes.len(), 1);
        assert_eq!(analysis.index_fixes[0].old_index, 57612);
        assert_eq!(analysis.index_fixes[0].new_index, 59094);
        assert_eq!(analysis.index_fixes[0].section, "TextureOverrideRemielleBodyB");

        // 2. Application phase
        let fix_res = apply_mod_fix(&mod_dir, &db).expect("Fix should succeed");
        assert!(fix_res.success);
        assert_eq!(fix_res.hashes_updated, 1);
        assert_eq!(fix_res.indices_remapped, 1);

        let fixed_ini = fs::read_to_string(mod_dir.join("Mod.ini")).unwrap();
        assert!(fixed_ini.contains("hash = 28e05a59"));
        assert!(fixed_ini.contains("match_first_index = 59094"));
        assert!(fixed_ini.contains("; [ZZZMODMANAGER PREVIOUS INDEX] match_first_index = 57612"));

        // 3. Terminal/Idempotency check: once upgraded to 28e05a59, re-analysis must report 0 fixes
        let mut active_db = FixerDatabase::default();
        active_db.rules.insert(
            "28e05a59".to_string(),
            FixerRule {
                hash: "28e05a59".to_string(),
                character: "Remielle".to_string(),
                description: "Remielle Body active".to_string(),
                version_from: "3.2".to_string(),
                version_to: "3.2".to_string(),
                actions: vec![],
            },
        );
        let post_analysis = analyze_mod_for_fixes(&mod_dir, &active_db);
        assert!(!post_analysis.is_fixable, "Upgraded mod must not be fixable again");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_submesh_index_count_remapping_contract() {
        let temp_dir = std::env::temp_dir().join(format!("zmm_test_index_count_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        let mod_dir = temp_dir.join("Playable Characters").join("Remielle Dan - Feathered Murmurs").join("SparxieRemielleBase");
        fs::create_dir_all(&mod_dir).unwrap();

        let ini_content = r#"; Sparxie Remielle Mod
[Constants]
global $active0 = 0

[TextureOverrideRemielleV5BodyA]
hash = 785b21f5
match_first_index = 0
match_index_count = 57612
handling = skip
ib = ResourceRemielleV5BodyAIB

[TextureOverrideRemielleV5BodyB]
hash = 785b21f5
match_first_index = 57612
match_index_count = 1014
handling = skip
ib = ResourceRemielleV5BodyBIB
"#;
        fs::write(mod_dir.join("Remielle_Base.ini"), ini_content).unwrap();

        let mut db = FixerDatabase::default();
        db.rules.insert(
            "785b21f5".to_string(),
            FixerRule {
                hash: "785b21f5".to_string(),
                character: "Remielle".to_string(),
                description: "Remielle Body IB Hash".to_string(),
                version_from: "3.1".to_string(),
                version_to: "3.2".to_string(),
                actions: vec![
                    FixerRuleAction {
                        action_type: "update_hash".to_string(),
                        new_hash: Some("28e05a59".to_string()),
                        ..Default::default()
                    },
                    FixerRuleAction {
                        action_type: "remap_indices".to_string(),
                        from_indices: Some(vec![0, 57612]),
                        to_indices: Some(vec![0, 59094]),
                        from_index_counts: Some(vec![57612, 1014]),
                        to_index_counts: Some(vec![59094, 984]),
                        ..Default::default()
                    },
                ],
            },
        );

        // 1. Analysis phase
        let analysis = analyze_mod_for_fixes(&mod_dir, &db);
        assert!(analysis.is_fixable);
        assert_eq!(analysis.hash_fixes.len(), 1);
        assert_eq!(analysis.hash_fixes[0].new_hash, "28e05a59");

        // Should detect 2 index fixes: BodyA count (57612 -> 59094) and BodyB first index + count
        assert!(analysis.index_fixes.len() >= 2, "Must detect index count shifts for both submeshes");
        let body_a_fix = analysis.index_fixes.iter().find(|f| f.section == "TextureOverrideRemielleV5BodyA").expect("BodyA fix must be detected");
        assert_eq!(body_a_fix.old_count, Some(57612));
        assert_eq!(body_a_fix.new_count, Some(59094));

        let body_b_fix = analysis.index_fixes.iter().find(|f| f.section == "TextureOverrideRemielleV5BodyB").expect("BodyB fix must be detected");
        assert_eq!(body_b_fix.old_index, 57612);
        assert_eq!(body_b_fix.new_index, 59094);
        assert_eq!(body_b_fix.old_count, Some(1014));
        assert_eq!(body_b_fix.new_count, Some(984));

        // 2. Application phase
        let fix_res = apply_mod_fix(&mod_dir, &db).expect("Fix should succeed");
        assert!(fix_res.success);
        assert_eq!(fix_res.hashes_updated, 1);
        assert!(fix_res.indices_remapped >= 3, "Must remap first index and counts");

        let fixed_ini = fs::read_to_string(mod_dir.join("Remielle_Base.ini")).unwrap();
        assert!(fixed_ini.contains("hash = 28e05a59"));
        // BodyA: match_index_count remapped to 59094
        assert!(fixed_ini.contains("match_index_count = 59094"));
        assert!(fixed_ini.contains("; [ZZZMODMANAGER PREVIOUS COUNT] match_index_count = 57612"));
        // BodyB: match_first_index remapped to 59094 and match_index_count remapped to 984
        assert!(fixed_ini.contains("match_first_index = 59094"));
        assert!(fixed_ini.contains("; [ZZZMODMANAGER PREVIOUS INDEX] match_first_index = 57612"));
        assert!(fixed_ini.contains("match_index_count = 984"));
        assert!(fixed_ini.contains("; [ZZZMODMANAGER PREVIOUS COUNT] match_index_count = 1014"));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_character_family_skin_check_remapping_contract() {
        let temp_dir = std::env::temp_dir().join(format!("zmm_test_family_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        let mod_dir = temp_dir.join("Playable Characters").join("Remielle Dan - Feathered Murmurs").join("MultiSkinCheckMod");
        fs::create_dir_all(&mod_dir).unwrap();

        let ini_content = r#"; Multi-Skin Sparxie Mod
[Constants]
global $skin = 0

[TextureOverride_IB_SkinCheck1]
hash = 785b21f5
$skin = 0

[TextureOverride_IB_SkinCheck2]
hash = f57f3e40
$skin = 1

[TextureOverride_IB_SkinCheck3]
hash = 241deac5
$skin = 2

[TextureOverrideUnrelatedEllenIB]
hash = 2f38c35a
handling = skip
"#;
        fs::write(mod_dir.join("MultiSkin.ini"), ini_content).unwrap();

        let mut db = FixerDatabase::default();
        // 1. Remielle Default Body IB
        db.rules.insert(
            "785b21f5".to_string(),
            FixerRule {
                hash: "785b21f5".to_string(),
                character: "Remielle".to_string(),
                description: "Remielle Body IB Hash".to_string(),
                version_from: "3.1".to_string(),
                version_to: "3.2".to_string(),
                actions: vec![
                    FixerRuleAction {
                        action_type: "update_hash".to_string(),
                        new_hash: Some("28e05a59".to_string()),
                        ..Default::default()
                    },
                ],
            },
        );
        // 2. Remielle Moonlight Whispers Body IB
        db.rules.insert(
            "f57f3e40".to_string(),
            FixerRule {
                hash: "f57f3e40".to_string(),
                character: "RemielleMoonlightWhispers".to_string(),
                description: "RemielleMoonlightWhispers Body IB Hash".to_string(),
                version_from: "3.1".to_string(),
                version_to: "3.2".to_string(),
                actions: vec![
                    FixerRuleAction {
                        action_type: "update_hash".to_string(),
                        new_hash: Some("92cb56c9".to_string()),
                        ..Default::default()
                    },
                ],
            },
        );
        // 3. Remielle Seashade Pas Seul Body IB
        db.rules.insert(
            "241deac5".to_string(),
            FixerRule {
                hash: "241deac5".to_string(),
                character: "RemielleSeashadePasSeul".to_string(),
                description: "RemielleSeashadePasSeul Body IB Hash".to_string(),
                version_from: "3.1".to_string(),
                version_to: "3.2".to_string(),
                actions: vec![
                    FixerRuleAction {
                        action_type: "update_hash".to_string(),
                        new_hash: Some("2cd6516a".to_string()),
                        ..Default::default()
                    },
                ],
            },
        );
        // 4. Unrelated character IB: Ellen (must NOT be migrated!)
        db.rules.insert(
            "2f38c35a".to_string(),
            FixerRule {
                hash: "2f38c35a".to_string(),
                character: "Ellen".to_string(),
                description: "Ellen Hair IB Hash".to_string(),
                version_from: "3.1".to_string(),
                version_to: "3.2".to_string(),
                actions: vec![
                    FixerRuleAction {
                        action_type: "update_hash".to_string(),
                        new_hash: Some("11223344".to_string()),
                        ..Default::default()
                    },
                ],
            },
        );

        // 1. Analysis phase
        let analysis = analyze_mod_for_fixes(&mod_dir, &db);
        assert!(analysis.is_fixable);
        // All 3 Remielle family hashes must be included, Ellen must be excluded!
        assert_eq!(analysis.hash_fixes.len(), 3);
        let migrated_hashes: Vec<String> = analysis.hash_fixes.iter().map(|f| f.new_hash.clone()).collect();
        assert!(migrated_hashes.contains(&"28e05a59".to_string()));
        assert!(migrated_hashes.contains(&"92cb56c9".to_string()));
        assert!(migrated_hashes.contains(&"2cd6516a".to_string()));
        assert!(!migrated_hashes.contains(&"11223344".to_string()), "Unrelated character mesh must not be migrated");

        // 2. Application phase
        let fix_res = apply_mod_fix(&mod_dir, &db).expect("Fix should succeed");
        assert!(fix_res.success);
        assert_eq!(fix_res.hashes_updated, 3);

        let fixed_ini = fs::read_to_string(mod_dir.join("MultiSkin.ini")).unwrap();
        assert!(fixed_ini.contains("hash = 28e05a59"));
        assert!(fixed_ini.contains("hash = 92cb56c9"));
        assert!(fixed_ini.contains("hash = 2cd6516a"));
        // Unrelated hash must remain untouched
        assert!(fixed_ini.contains("hash = 2f38c35a"));
        assert!(!fixed_ini.contains("hash = 11223344"));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_list_mod_backups_parses_all_formats() {
        let temp_dir = std::env::temp_dir().join(format!("zmm_test_list_bak_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        let mod_dir = temp_dir.join("TestMod");
        let sub_dir = mod_dir.join("subfolder");
        fs::create_dir_all(&sub_dir).unwrap();

        // 1. Timestamped INI backup
        fs::write(mod_dir.join("DISABLED_BACKUP_1700000000_ModA.ini.bak"), "old ini").unwrap();
        fs::write(mod_dir.join("ModA.ini"), "new ini content is longer").unwrap();

        // 2. Timestamped BUF backup
        fs::write(sub_dir.join("DISABLED_BACKUP_1700000100_Mesh.buf.bak"), "old buf bytes").unwrap();
        fs::write(sub_dir.join("Mesh.buf"), "new buf bytes").unwrap();

        // 3. Disabled script backup (.disabled.bak)
        fs::write(mod_dir.join("help.ini.disabled.bak"), "help script").unwrap();

        // 4. Simple .ini.bak
        fs::write(mod_dir.join("Other.ini.bak"), "other old").unwrap();

        let backups = list_mod_backups(&mod_dir).expect("Should list backups");
        assert_eq!(backups.len(), 4);

        // Verify ModA
        let b_a = backups.iter().find(|b| b.target_file_name == "ModA.ini").expect("ModA backup found");
        assert_eq!(b_a.created_at, Some(1700000000));
        assert!(b_a.target_exists);
        assert_eq!(b_a.backup_size_bytes, 7); // "old ini".len()
        assert_eq!(b_a.target_size_bytes, Some(25)); // "new ini content is longer".len()

        // Verify Mesh.buf
        let b_buf = backups.iter().find(|b| b.target_file_name == "Mesh.buf").expect("Mesh.buf backup found");
        assert_eq!(b_buf.created_at, Some(1700000100));
        assert!(b_buf.target_exists);

        // Verify help.ini
        let b_help = backups.iter().find(|b| b.target_file_name == "help.ini").expect("help.ini backup found");
        assert_eq!(b_help.target_file_name, "help.ini");

        // Verify Other.ini
        let b_other = backups.iter().find(|b| b.target_file_name == "Other.ini").expect("Other.ini backup found");
        assert!(!b_other.target_exists); // Active file does not exist yet

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_restore_selected_mod_backups_selective_and_safe() {
        let temp_dir = std::env::temp_dir().join(format!("zmm_test_sel_bak_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        let mod_dir = temp_dir.join("Playable Characters").join("Anby").join("SelectiveMod");
        fs::create_dir_all(&mod_dir).unwrap();

        // Active files
        let active_ini = mod_dir.join("Mod.ini");
        let active_buf = mod_dir.join("Model.buf");
        fs::write(&active_ini, "MODIFIED_INI").unwrap();
        fs::write(&active_buf, "MODIFIED_BUF").unwrap();

        // Backups
        let bak_ini = mod_dir.join("DISABLED_BACKUP_1700000000_Mod.ini.bak");
        let bak_buf = mod_dir.join("DISABLED_BACKUP_1700000000_Model.buf.bak");
        fs::write(&bak_ini, "ORIGINAL_INI").unwrap();
        fs::write(&bak_buf, "ORIGINAL_BUF").unwrap();

        // 1. Restore ONLY the INI, keep backup copy
        let selected = vec![bak_ini.to_string_lossy().to_string()];
        let res = restore_selected_mod_backups(&mod_dir, &selected, true).expect("Restore INI");
        assert!(res.success);
        assert_eq!(res.restored_files, vec!["Mod.ini"]);
        assert_eq!(fs::read_to_string(&active_ini).unwrap(), "ORIGINAL_INI");
        assert_eq!(fs::read_to_string(&active_buf).unwrap(), "MODIFIED_BUF"); // Untouched!
        assert!(bak_ini.exists(), "Backup should be kept when keep_backups is true");

        // 2. Restore the BUF with keep_backups = false
        let selected_buf = vec![bak_buf.to_string_lossy().to_string()];
        let res_buf = restore_selected_mod_backups(&mod_dir, &selected_buf, false).expect("Restore BUF");
        assert!(res_buf.success);
        assert_eq!(res_buf.restored_files, vec!["Model.buf"]);
        assert_eq!(fs::read_to_string(&active_buf).unwrap(), "ORIGINAL_BUF");
        assert!(!bak_buf.exists(), "Backup should be deleted when keep_backups is false");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_restore_selected_mod_backups_path_traversal_guard() {
        let temp_dir = std::env::temp_dir().join(format!("zmm_test_sec_bak_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        let mod_dir = temp_dir.join("ModA");
        let outside_dir = temp_dir.join("Outside");
        fs::create_dir_all(&mod_dir).unwrap();
        fs::create_dir_all(&outside_dir).unwrap();

        let malicious_bak = outside_dir.join("DISABLED_BACKUP_1700000000_Secret.ini.bak");
        fs::write(&malicious_bak, "MALICIOUS").unwrap();

        let selected = vec![malicious_bak.to_string_lossy().to_string()];
        let err = restore_selected_mod_backups(&mod_dir, &selected, false);
        assert!(err.is_err(), "Must reject backup paths outside the mod directory");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_bidirectional_equiv_hash_satisfaction() {
        let mut db = FixerDatabase::default();
        db.rules.insert(
            "11111111".to_string(),
            FixerRule {
                hash: "11111111".to_string(),
                character: "Belle".to_string(),
                actions: vec![FixerRuleAction {
                    action_type: "update_hash".to_string(),
                    new_hash: Some("22222222".to_string()),
                    ..Default::default()
                }],
                ..Default::default()
            },
        );

        // Case 1: Mod has unmigrated hash "11111111", rule equiv is "22222222"
        let mut mod_hashes_old = HashSet::new();
        mod_hashes_old.insert("11111111".to_string());
        assert!(is_equiv_hash_satisfied("22222222", &mod_hashes_old, &db));

        // Case 2: Mod has migrated terminal hash "22222222", rule equiv is "11111111"
        let mut mod_hashes_new = HashSet::new();
        mod_hashes_new.insert("22222222".to_string());
        assert!(is_equiv_hash_satisfied("11111111", &mod_hashes_new, &db));
    }

    #[test]
    fn test_legacy_stride_normalization_and_idempotency_contract() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_stride_{}", unique_id));
        let _ = fs::remove_dir_all(&temp_dir);
        let mod_dir = temp_dir.join("Playable Characters").join("Belle - Vibrant Store Manager").join("BelleTest");
        let _ = fs::create_dir_all(&mod_dir);

        let test_ini = r#"
[TextureOverrideBelleHairVertexLimitRaise]
hash = 142ddbbc
override_vertex_count = 29710
override_byte_stride = 92

[TextureOverrideBelleBodyVertexLimitRaise]
hash = ac1c8f80
override_vertex_count = 22514
override_byte_stride = 92
"#;
        fs::write(mod_dir.join("Belle.ini"), test_ini).unwrap();

        let mut db = FixerDatabase::default();
        db.rules.insert(
            "142ddbbc".to_string(),
            FixerRule {
                hash: "142ddbbc".to_string(),
                character: "Belle".to_string(),
                actions: vec![FixerRuleAction {
                    action_type: "update_hash".to_string(),
                    new_hash: Some("992d149f".to_string()),
                    ..Default::default()
                }],
                ..Default::default()
            },
        );
        db.rules.insert(
            "ac1c8f80".to_string(),
            FixerRule {
                hash: "ac1c8f80".to_string(),
                character: "Belle".to_string(),
                actions: vec![FixerRuleAction {
                    action_type: "update_hash".to_string(),
                    new_hash: Some("bea2b94e".to_string()),
                    ..Default::default()
                }],
                ..Default::default()
            },
        );

        // Pre-analysis: must be fixable because of hashes and stride 92
        let pre_analysis = analyze_mod_for_fixes(&mod_dir, &db);
        assert!(pre_analysis.is_fixable);
        assert!(pre_analysis.buffer_fixes.iter().any(|bf| bf.fix_type == "normalize_byte_stride"));

        // Apply fix
        let fix_res = apply_mod_fix(&mod_dir, &db).expect("Fix must succeed");
        assert!(fix_res.success);

        let fixed_ini = fs::read_to_string(mod_dir.join("Belle.ini")).unwrap();
        assert!(fixed_ini.contains("override_byte_stride = 40"));
        assert!(!fixed_ini.lines().any(|l| !l.trim().starts_with(';') && l.contains("override_byte_stride = 92")));

        // Post-analysis: MUST NOT be fixable again (idempotent, single pass convergence)
        let post_analysis = analyze_mod_for_fixes(&mod_dir, &db);
        assert!(!post_analysis.is_fixable, "Post-fix analysis must not be fixable again");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_find_all_slot_buffers_contract() {
        let ini = r#"
[TextureOverrideBelleHairBlend]
hash = 76a50b18
vb2 = ResourceBelleHairBlend

[TextureOverrideBelleBodyBlend]
hash = 3ee01622
vb2 = ref ResourceBelleBodyBlend

[ResourceBelleHairBlend]
type = Buffer
stride = 32
filename = BelleHairBlend.buf

[ResourceBelleBodyBlend]
type = Buffer
stride = 32
filename = ".\BelleBodyBlend.buf"
"#;
        let buffers = find_all_slot_buffers(ini, "vb2");
        assert_eq!(buffers.len(), 2);
        let filenames: Vec<&str> = buffers.iter().map(|(f, _)| f.as_str()).collect();
        assert!(filenames.contains(&"BelleHairBlend.buf"));
        assert!(filenames.contains(&"BelleBodyBlend.buf"));
        assert_eq!(buffers[0].1, 32);
        assert_eq!(buffers[1].1, 32);
    }

    #[test]
    fn test_ensure_handling_skip_on_draw_sections_contract() {
        let ini = r#"
[TextureOverrideBelleHairIB]
hash = aa9ffb85
handling = skip

[TextureOverrideBelleHair]
hash = aa9ffb85
match_first_index = 0
run = CommandListSkinTexture
ib = ResourceBelleHairIB
drawindexed = 22587, 26247, 0

[TextureOverrideBelleDiffuse]
hash = 1ce58567
this = ResourceBelleDiffuse
"#;
        let (fixed_ini, count) = ensure_handling_skip_on_draw_sections(ini);
        assert_eq!(count, 1);
        assert!(fixed_ini.contains("[TextureOverrideBelleHair]\r\nhash = aa9ffb85\r\nhandling = skip\r\nmatch_first_index = 0"));
        assert!(!fixed_ini.contains("[TextureOverrideBelleDiffuse]\r\nhandling = skip"));

        // Running again must be idempotent (0 modifications)
        let (fixed_ini_2, count_2) = ensure_handling_skip_on_draw_sections(&fixed_ini);
        assert_eq!(count_2, 0);
        assert_eq!(fixed_ini, fixed_ini_2);
    }

    #[test]
    fn test_ensure_character_suppressions_belle_contract() {
        let ini = r#"
[TextureOverrideBelleHair]
hash = aa9ffb85
handling = skip

[TextureOverrideBelleBody]
hash = c2b4ce3a
match_first_index = 0
handling = skip
"#;
        let (suppressed, count) = ensure_character_suppressions(ini, "Belle");
        // Legs (e6afd8d1), Earrings (07920753), Hairpin (3acf9aea), BodyB (c2b4ce3a with match_first_index = 31275)
        assert_eq!(count, 4);
        assert!(suppressed.contains("[TextureOverrideBelleLegs]"));
        assert!(suppressed.contains("hash = e6afd8d1"));
        assert!(suppressed.contains("[TextureOverrideBelleEarrings]"));
        assert!(suppressed.contains("[TextureOverrideBelleHairpin]"));
        assert!(suppressed.contains("[TextureOverrideBelleBodyB]"));
        assert!(suppressed.contains("match_first_index = 31275"));

        // Running again on already suppressed content must not duplicate
        let (suppressed_2, count_2) = ensure_character_suppressions(&suppressed, "Belle");
        assert_eq!(count_2, 0);
        assert_eq!(suppressed, suppressed_2);
    }

    #[test]
    fn test_prevent_infinite_upgrade_prompts_when_section_exists() {
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_inf_prompts_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        let mod_dir = temp_dir.join("Playable Characters").join("Belle - Vibrant Store Manager").join("TestMod");
        fs::create_dir_all(&mod_dir).unwrap();

        // INI already has Belle.Hair.IB and terminal hash aa9ffb85
        let ini_content = r#"
[TextureOverrideBelleHair]
hash = aa9ffb85
handling = skip

[TextureOverrideBelle.Hair.IB]
hash = aa9ffb85
match_priority = 0
"#;
        fs::write(mod_dir.join("Belle.ini"), ini_content).unwrap();

        let mut db = FixerDatabase::default();
        // A rule that would otherwise propose adding Belle.Hair.IB
        db.rules.insert(
            "1ce58567".to_string(),
            FixerRule {
                hash: "1ce58567".to_string(),
                character: "Belle".to_string(),
                description: "Belle Hair Diffuse".to_string(),
                actions: vec![FixerRuleAction {
                    action_type: "add_section_if_missing".to_string(),
                    equiv_hashes: Some(vec!["bea4a483".to_string()]),
                    section_title: Some("Belle.Hair.IB".to_string()),
                    section_content: Some("match_priority = 0\n".to_string()),
                    ..Default::default()
                }],
                ..Default::default()
            },
        );

        let analysis = analyze_mod_for_fixes(&mod_dir, &db);
        assert!(!analysis.is_fixable, "Must not propose adding section that is already present in INI");

        let _ = fs::remove_dir_all(&temp_dir);
    }
