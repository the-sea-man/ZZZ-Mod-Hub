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
        let temp_dir = std::env::temp_dir().join("zzz_test_fixer_regex_safe");
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
