use super::*;

    #[test]
    fn test_ini_ast_parse_and_to_string() {
        let content = r#"; Top level comment
[Constants]
global_var = 1

[TextureOverrideBelleBody]
hash = 9af848eb
match_first_index = 0
ib = ResourceBelleBodyIB

[ResourceBelleBodyIB]
type = Buffer
filename = BelleBodyIB.buf
"#;
        let ast = IniAst::parse(content);
        assert_eq!(ast.header_lines, vec!["; Top level comment"]);
        assert_eq!(ast.sections.len(), 3);
        assert_eq!(ast.sections[0].name, "Constants");
        assert_eq!(ast.sections[1].name, "TextureOverrideBelleBody");
        assert_eq!(ast.sections[2].name, "ResourceBelleBodyIB");

        let generated = ast.to_string();
        assert!(generated.contains("[Constants]"));
        assert!(generated.contains("[TextureOverrideBelleBody]"));
        assert!(generated.contains("[ResourceBelleBodyIB]"));
        assert!(generated.contains("filename = BelleBodyIB.buf"));
    }

    #[test]
    fn test_dependency_extraction() {
        let content = r#"
[TextureOverrideJaneDoeHRFace]
hash = 12345678
ib = ResourceFaceIB
ps-t0 = ResourceFaceDiffuse
run = CommandListSkinTexture
filename = LooseTexture.dds

[ResourceFaceIB]
filename = Face.buf

[ResourceFaceDiffuse]
filename = Textures/FaceDiff.dds

[CommandListSkinTexture]
ResourceDiffuse = ResourceFaceDiffuse
"#;
        let ast = IniAst::parse(content);
        let override_sec = &ast.sections[0];

        let (res_sections, asset_files) = extract_section_dependencies(&ast, override_sec);
        assert_eq!(res_sections.len(), 3);
        assert!(res_sections.iter().any(|s| s.name == "ResourceFaceIB"));
        assert!(res_sections.iter().any(|s| s.name == "ResourceFaceDiffuse"));
        assert!(res_sections.iter().any(|s| s.name == "CommandListSkinTexture"));

        assert_eq!(asset_files.len(), 3);
        assert!(asset_files.contains(&"Face.buf".to_string()));
        assert!(asset_files.contains(&"Textures/FaceDiff.dds".to_string()));
        assert!(asset_files.contains(&"LooseTexture.dds".to_string()));
    }

    #[test]
    fn test_extract_character_group() {
        let content = r#"
[TextureOverrideJaneDoeHRFace]
hash = 9af848eb

[TextureOverrideBelleBody]
hash = 12345678

[TextureOverride01]
hash = 0xabcdef12
"#;
        let ast = IniAst::parse(content);
        assert_eq!(extract_character_group(&ast.sections[0]), "JaneDoeHR");
        assert_eq!(extract_character_group(&ast.sections[1]), "Belle");
        assert_eq!(extract_character_group(&ast.sections[2]), "abcdef12");
    }

    #[test]
    fn test_extract_anatomical_component() {
        let test_pipe = |name: &str| -> String {
            standardize_group_name(&extract_semantic_stem(name))
        };

        assert_eq!(
            test_pipe("TextureOverrideJaneBodyPosition"),
            "Body"
        );
        assert_eq!(
            test_pipe("TextureOverrideJaneBodyTexcoord"),
            "Body"
        );
        assert_eq!(
            test_pipe("TextureOverrideJaneBodyIB"),
            "Body"
        );
        assert_eq!(
            test_pipe("TextureOverrideJaneBodyA"),
            "Body"
        );
        assert_eq!(
            test_pipe("TextureOverrideJaneBodyADiffuse"),
            "Body"
        );
        assert_eq!(
            test_pipe("TextureOverrideJaneBodyALOD2"),
            "Body"
        );

        assert_eq!(
            test_pipe("TextureOverrideJaneHairPosition"),
            "Hair"
        );
        assert_eq!(
            test_pipe("TextureOverrideJaneHairTexcoord"),
            "Hair"
        );
        assert_eq!(
            test_pipe("TextureOverrideJaneHairIB"),
            "Hair"
        );
        assert_eq!(
            test_pipe("TextureOverrideJaneHairA"),
            "Hair"
        );
        assert_eq!(
            test_pipe("TextureOverrideJaneHairB"),
            "Hair"
        );
        assert_eq!(
            test_pipe("TextureOverrideJaneHairADiffuse"),
            "Hair"
        );

        assert_eq!(
            test_pipe("TextureOverrideJaneFace"),
            "Face"
        );
        assert_eq!(
            test_pipe("TextureOverrideJaneHead"),
            "Face"
        );
        assert_eq!(
            test_pipe("TextureOverrideJaneMakeup"),
            "Face"
        );

        assert_eq!(
            test_pipe("TextureOverrideJaneWeaponPosition"),
            "Weapon"
        );
        assert_eq!(
            test_pipe("TextureOverrideJaneDress"),
            "Outfit"
        );
        assert_eq!(
            test_pipe("TextureOverrideJaneLegs"),
            "Legs"
        );
        assert_eq!(
            test_pipe("TextureOverrideJaneArms"),
            "Arms"
        );
        assert_eq!(
            test_pipe("TextureOverrideJaneTail"),
            "Tail"
        );
        assert_eq!(
            test_pipe("TextureOverrideJaneGlasses"),
            "Accessories"
        );

        // Yidhari specific overrides
        assert_eq!(
            test_pipe("TextureOverrideYidhariTentaclesA"),
            "Tail"
        );
        assert_eq!(
            test_pipe("TextureOverrideYidhariTentaclesIB"),
            "Tail"
        );
        assert_eq!(
            test_pipe("TextureOverrideTentaclesGlow"),
            "Tail"
        );
        assert_eq!(
            test_pipe("TextureOverrideYidhariGadgetA"),
            "Accessories"
        );
        assert_eq!(
            test_pipe("TextureOverrideYidhariGadgetBlend"),
            "Accessories"
        );
        assert_eq!(
            test_pipe("TextureOverrideHairshadow"),
            "Hair"
        );
    }

    #[test]
    fn test_split_and_preview_anatomical_mod() {
        let temp_dir = std::env::temp_dir().join("zzz_test_split_anatomical");
        let _ = fs::remove_dir_all(&temp_dir);
        let mod_dir = temp_dir
            .join("Playable Characters")
            .join("Jane Doe")
            .join("Jane Full Outfit Mod");
        let _ = fs::create_dir_all(&mod_dir);

        let ini_content = r#"
[Constants]
global $active = 0

[Present]
post $active = 0

[TextureOverrideJaneBodyPosition]
hash = 10050266
vb0 = ResourceJaneBodyPos

[TextureOverrideJaneBodyA]
hash = ba4255a5
ib = ResourceJaneBodyIB

[TextureOverrideJaneHairPosition]
hash = e7a3b7dc
vb0 = ResourceJaneHairPos

[TextureOverrideJaneHairA]
hash = 9268a5af
ib = ResourceJaneHairIB

[ResourceJaneBodyPos]
filename = JaneBody.buf

[ResourceJaneBodyIB]
filename = JaneBody.ib

[ResourceJaneHairPos]
filename = JaneHair.buf

[ResourceJaneHairIB]
filename = JaneHair.ib
"#;
        let _ = fs::write(mod_dir.join("mod.ini"), ini_content);
        let _ = fs::write(mod_dir.join("JaneBody.buf"), b"body buf");
        let _ = fs::write(mod_dir.join("JaneBody.ib"), b"body ib");
        let _ = fs::write(mod_dir.join("JaneHair.buf"), b"hair buf");
        let _ = fs::write(mod_dir.join("JaneHair.ib"), b"hair ib");

        // Add nested subfolder Face mod with texture
        let face_sub = mod_dir.join("Face").join("ef86fc9f");
        let _ = fs::create_dir_all(&face_sub);
        let face_ini = r#"
[TextureOverrideJaneFace]
hash = 3b75aa2c
this = ResourceFaceDiffuse

[ResourceFaceDiffuse]
filename = FaceDiffuse.dds
"#;
        let _ = fs::write(face_sub.join("face.ini"), face_ini);
        let _ = fs::write(face_sub.join("FaceDiffuse.dds"), b"face dds content");

        let dummy_db = Path::new("dummy.json");

        // 1. Preview split
        let previews = preview_split_mod_impl(
            dummy_db,
            mod_dir.to_string_lossy().to_string(),
            "component".to_string(),
        )
        .unwrap();
        assert_eq!(previews.len(), 3);
        assert_eq!(previews[0].group_name, "Body");
        assert_eq!(previews[0].asset_files.len(), 2);
        assert_eq!(previews[1].group_name, "Face");
        assert_eq!(previews[1].asset_files.len(), 1);
        assert_eq!(previews[2].group_name, "Hair");
        assert_eq!(previews[2].asset_files.len(), 2);

        // 2. Perform split
        let created =
            split_mod_impl(dummy_db, mod_dir.to_string_lossy().to_string(), "component".to_string(), None).unwrap();
        assert_eq!(created.len(), 3);

        let body_dir = temp_dir
            .join("Playable Characters")
            .join("Jane Doe")
            .join("Jane Full Outfit Mod - Body");
        let face_dir = temp_dir
            .join("Playable Characters")
            .join("Jane Doe")
            .join("Jane Full Outfit Mod - Face");
        let hair_dir = temp_dir
            .join("Playable Characters")
            .join("Jane Doe")
            .join("Jane Full Outfit Mod - Hair");

        assert!(body_dir.exists());
        assert!(body_dir.join("JaneBody.buf").exists());
        assert!(body_dir.join("JaneBody.ib").exists());
        assert!(body_dir.join("mod.ini").exists());

        assert!(face_dir.exists());
        assert!(face_dir.join("FaceDiffuse.dds").exists(), "FaceDiffuse.dds from nested subfolder must be copied!");
        assert!(face_dir.join("mod.ini").exists());

        assert!(hair_dir.exists());
        assert!(hair_dir.join("JaneHair.buf").exists());
        assert!(hair_dir.join("JaneHair.ib").exists());
        assert!(hair_dir.join("mod.ini").exists());

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_break_mod_easter_egg() {
        let temp_dir = std::env::temp_dir().join("zzz_test_break_mod");
        let _ = fs::remove_dir_all(&temp_dir);
        let mod_dir = temp_dir
            .join("Playable Characters")
            .join("Jane Doe")
            .join("Jane Break Mod");
        let _ = fs::create_dir_all(&mod_dir);

        let ini_content = r#"
[TextureOverrideJaneBodyPosition]
hash = 10050266
vb0 = ResourceJaneBodyPos

[TextureOverrideJaneBodyA]
hash = ba4255a5
ib = ResourceJaneBodyIB

[ResourceJaneBodyPos]
filename = JaneBody.buf

[ResourceJaneBodyIB]
filename = JaneBody.ib
"#;
        let _ = fs::write(mod_dir.join("mod.ini"), ini_content);
        let _ = fs::write(mod_dir.join("JaneBody.buf"), b"body buf");
        let _ = fs::write(mod_dir.join("JaneBody.ib"), b"body ib");

        let dummy_db = Path::new("dummy.json");
        let created = split_mod_impl(dummy_db, mod_dir.to_string_lossy().to_string(), "break".to_string(), None).unwrap();
        assert_eq!(created.len(), 2);

        let pos_dir = temp_dir.join("Playable Characters").join("Jane Doe").join("Jane Break Mod - Position");
        let a_dir = temp_dir.join("Playable Characters").join("Jane Doe").join("Jane Break Mod - A");

        assert!(pos_dir.exists(), "Position shard folder should exist");
        assert!(a_dir.exists(), "A shard folder should exist");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_extract_semantic_stem() {
        assert_eq!(extract_semantic_stem("TextureOverrideYidhariTentaclesVertexLimitRaise"), "tentacles");
        assert_eq!(extract_semantic_stem("TextureOverrideYidhariGadgetA"), "gadget");
        assert_eq!(extract_semantic_stem("TextureOverrideJaneBodyALOD2"), "body");
        assert_eq!(extract_semantic_stem("TextureOverrideJaneHairPosition"), "hair");
        assert_eq!(extract_semantic_stem("TextureOverrideCustomCyberWingsDiffuse1024"), "customcyberwings");
        assert_eq!(extract_semantic_stem("TextureOverrideHairshadow"), "hair");
    }

    #[test]
    fn test_synthetic_mod_split() {
        let temp_dir = std::env::temp_dir().join("zmm_test_split_synthetic");
        let _ = fs::remove_dir_all(&temp_dir);
        let _ = fs::create_dir_all(&temp_dir);

        let ini_content = r#"
[TextureOverrideAriaHead]
hash = 11111111
match_first_index = 0

[TextureOverrideJaneBody]
hash = 22222222
match_first_index = 100
"#;
        let ini_path = temp_dir.join("mod.ini");
        fs::write(&ini_path, ini_content).unwrap();

        let db_content = r#"[
            {"id": "aria", "name": "Aria", "skins": [{"id": "default", "name": "Default", "components": {"Head": "11111111"}}]},
            {"id": "jane", "name": "Jane", "skins": [{"id": "default", "name": "Default", "components": {"Body": "22222222"}}]}
        ]"#;
        let db_path = temp_dir.join("characters.json");
        fs::write(&db_path, db_content).unwrap();

        let res = preview_split_mod_impl(&db_path, temp_dir.to_string_lossy().to_string(), "character".to_string());
        assert!(res.is_ok());
        let groups = res.unwrap();
        assert_eq!(groups.len(), 2);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_yuzuha_style_component_split() {
        let temp_dir = std::env::temp_dir().join("zzz_test_yuzuha_split");
        let _ = fs::remove_dir_all(&temp_dir);
        let mod_dir = temp_dir
            .join("Playable Characters")
            .join("Ukinami Yuzuha - Tanuki Under the Shade")
            .join("YuzuhaPirateMod");
        let _ = fs::create_dir_all(&mod_dir);

        let ini_content = r#"
[Constants]
global $active = 0

[TextureOverrideYuzuhaBagStrapsBlend]
hash = 7ca97675
handling = skip
vb2 = ResourceYuzuhaBagStrapsBlend

[TextureOverrideYuzuhaBagStrapsVertexLimitRaise]
hash = 966e777b
override_vertex_count = 676

[TextureOverrideYuzuhaBagStrapsA]
hash = cf3172e4
match_first_index = 0
ib = ResourceYuzuhaBagStrapsAIB
Resource\ZZMI\Diffuse = ref ResourceYuzuhaBodyADiffuse

[TextureOverrideYuzuhaBodyBlend]
hash = 0db66603
vb2 = ResourceYuzuhaBodyBlend

[TextureOverrideYuzuhaBodyVertexLimitRaise]
hash = 2a99e69b
override_vertex_count = 12637

[TextureOverrideYuzuhaBodyA]
hash = 5144c409
ib = ResourceYuzuhaBodyAIB
Resource\ZZMI\Diffuse = ref ResourceYuzuhaBodyADiffuse

[ResourceYuzuhaBagStrapsBlend]
filename = YuzuhaBagStrapsBlend.buf

[ResourceYuzuhaBagStrapsAIB]
filename = YuzuhaBagStrapsA.ib

[ResourceYuzuhaBodyBlend]
filename = YuzuhaBodyBlend.buf

[ResourceYuzuhaBodyAIB]
filename = YuzuhaBodyA.ib

[ResourceYuzuhaBodyADiffuse]
filename = YuzuhaBodyADiffuse.dds
"#;
        let _ = fs::write(mod_dir.join("mod.ini"), ini_content);
        let _ = fs::write(mod_dir.join("YuzuhaBagStrapsBlend.buf"), b"buf");
        let _ = fs::write(mod_dir.join("YuzuhaBagStrapsA.ib"), b"ib");
        let _ = fs::write(mod_dir.join("YuzuhaBodyBlend.buf"), b"buf");
        let _ = fs::write(mod_dir.join("YuzuhaBodyA.ib"), b"ib");
        let _ = fs::write(mod_dir.join("YuzuhaBodyADiffuse.dds"), b"dds");

        let db_content = r#"[
            {"id": "ukinami_yuzuha", "name": "Ukinami Yuzuha", "category_name": "Ukinami Yuzuha - Tanuki Under the Shade", "skins": [{"id": "default", "name": "Default", "components": {"Body": "5144c409"}}]}
        ]"#;
        let db_path = temp_dir.join("characters.json");
        let _ = fs::write(&db_path, db_content);

        let previews = preview_split_mod_impl(&db_path, mod_dir.to_string_lossy().to_string(), "component".to_string()).unwrap();
        assert_eq!(previews.len(), 2);
        assert_eq!(previews[0].group_name, "Accessories");
        assert!(previews[0].asset_files.contains(&"YuzuhaBodyADiffuse.dds".to_string()));
        assert_eq!(previews[1].group_name, "Body");
        assert!(previews[1].asset_files.contains(&"YuzuhaBodyADiffuse.dds".to_string()));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_real_rina_split() {
        let appdata = match std::env::var("APPDATA") {
            Ok(v) => v,
            Err(_) => return,
        };
        let path_buf = Path::new(&appdata).join("XXMI Launcher").join("ZZMI").join("Mods").join("Playable Characters").join("Alexandrina Sebastiane - Head Maid's Perfection").join("RinaRose_Enhanced");
        if !path_buf.exists() {
            return;
        }
        let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap_or_else(|_| ".".to_string());
        let db_path = Path::new(&manifest_dir).join("..").join("src").join("characters.json");
        let path_str = path_buf.to_str().unwrap();
        let previews = preview_split_mod_impl(&db_path, path_str.to_string(), "component".to_string()).unwrap();
        println!("RinaRose_Enhanced split previews (total {}):", previews.len());
        for p in &previews {
            println!("  Group: '{}' -> Folder: '{}' (overrides: {}, resources: {}, assets: {})",
                p.group_name, p.target_folder_name, p.override_count, p.resource_count, p.asset_files.len());
        }

        let group_names: Vec<&str> = previews.iter().map(|p| p.group_name.as_str()).collect();
        // Verify key anatomical categories are present
        assert!(group_names.contains(&"Hair & Headwear"), "Must contain Hair & Headwear");
        assert!(group_names.contains(&"Legs & Stockings"), "Must contain Legs & Stockings");
        assert!(group_names.contains(&"Dress & Skirt"), "Must contain Dress & Skirt");
        assert!(group_names.contains(&"Top & Torso"), "Must contain Top & Torso");
        assert!(group_names.contains(&"Arms & Gloves"), "Must contain Arms & Gloves");

        // Verify no false character pollution or orphaned utility junk
        for p in &previews {
            assert!(!p.group_name.to_lowercase().contains("billy"), "Must not falsely match Billy Kid");
            assert!(!p.group_name.to_lowercase().contains("noise"), "Must not split Noise into standalone mod");
            assert!(!p.group_name.contains("1024"), "Must not split resolution into standalone mod");
        }
    }

    #[test]
    fn test_submesh_decompilation_preserves_section_headers_with_comments() {
        let temp_dir = std::env::temp_dir().join("zzz_test_submesh_header_preservation");
        let _ = fs::remove_dir_all(&temp_dir);
        let mod_dir = temp_dir.join("SubmeshMod");
        let _ = fs::create_dir_all(&mod_dir);

        let ini_content = r#"; Top level mod credit
[Constants]
global $active = 1

[TextureOverrideJaneBody]
; Author: CommunityModder
; Version: 1.0
hash = 10050266
match_first_index = 0
handling = skip
vb0 = ResourceJaneBodyPos

; Submesh 1: Hair
if $hair == 1
    drawindexed = auto
endif

; Submesh 2: Body
if $body == 1
    drawindexed = auto
endif

[ResourceJaneBodyPos]
filename = JaneBody.buf
"#;
        fs::write(mod_dir.join("mod.ini"), ini_content).unwrap();
        fs::write(mod_dir.join("JaneBody.buf"), b"buffer data").unwrap();

        let dummy_db = Path::new("dummy.json");
        let created = split_mod_impl(dummy_db, mod_dir.to_string_lossy().to_string(), "component".to_string(), None).unwrap();
        assert_eq!(created.len(), 2, "Expected 2 decompiled submesh categories (Hair & Body)");

        for path in &created {
            let split_ini = fs::read_to_string(Path::new(path).join("mod.ini")).unwrap();
            let parsed = IniAst::parse(&split_ini);
            let body_sec = parsed.sections.iter().find(|s| s.name == "TextureOverrideJaneBody");
            assert!(body_sec.is_some(), "Every split partition must contain TextureOverrideJaneBody");
            let lines = &body_sec.unwrap().lines;
            // Invariant: hash, match_first_index, handling, and vb0 must be preserved
            assert!(lines.iter().any(|l| l.trim() == "hash = 10050266"), "Hash must be preserved in {:?}", lines);
            assert!(lines.iter().any(|l| l.trim() == "match_first_index = 0"), "match_first_index must be preserved");
            assert!(lines.iter().any(|l| l.trim() == "handling = skip"), "handling must be preserved");
            assert!(lines.iter().any(|l| l.trim() == "vb0 = ResourceJaneBodyPos"), "vb0 must be preserved");
            // Invariant: Top comment is preserved in header
            assert!(lines.iter().any(|l| l.contains("Author: CommunityModder")), "Author comment should be preserved in section header");
        }

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_copy_asset_file_with_quotes_and_relative_paths() {
        let temp_dir = std::env::temp_dir().join("zzz_test_asset_quotes_rel");
        let _ = fs::remove_dir_all(&temp_dir);
        let src_dir = temp_dir.join("Source");
        let target_dir = temp_dir.join("Target");
        let _ = fs::create_dir_all(src_dir.join("Textures"));
        let _ = fs::create_dir_all(&target_dir);

        fs::write(src_dir.join("Textures").join("Face.dds"), b"face data").unwrap();
        fs::write(src_dir.join("Model.buf"), b"buf data").unwrap();

        // 1. Quoted relative path with backslashes
        assert!(copy_asset_file(&src_dir, &target_dir, r#""Textures\Face.dds""#).is_ok());
        assert!(target_dir.join("Textures").join("Face.dds").exists());

        // 2. Path with leading ./ and single quotes
        assert!(copy_asset_file(&src_dir, &target_dir, "'./Model.buf'").is_ok());
        assert!(target_dir.join("Model.buf").exists());

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_anchor_character_filtering_generic_shared_hashes() {
        let temp_dir = std::env::temp_dir().join("zzz_test_anchor_filter");
        let _ = fs::remove_dir_all(&temp_dir);
        let mod_dir = temp_dir.join("JaneMod");
        let _ = fs::create_dir_all(&mod_dir);

        let ini_content = r#"
[TextureOverrideEngineUI]
hash = d9a12c0a
ib = ResourceGenericUI

[TextureOverrideJaneReal]
hash = 10050266
vb0 = ResourceJanePos
"#;
        let ast = IniAst::parse(ini_content);
        let mut hash_alias_map: HashMap<String, Vec<HashTarget>> = HashMap::new();
        // Generic UI mapped to fake "Billy Kid"
        hash_alias_map.insert(
            "d9a12c0a".to_string(),
            vec![HashTarget {
                character_id: "billy_kid".to_string(),
                category_name: "Billy Kid".to_string(),
                skin_id: "default".to_string(),
                match_type: None,
                component_name: Some("Extra".to_string()),
                is_base_skin: true,
            }],
        );
        // Real Jane mesh hash
        hash_alias_map.insert(
            "10050266".to_string(),
            vec![HashTarget {
                character_id: "jane_doe".to_string(),
                category_name: "Jane Doe".to_string(),
                skin_id: "default".to_string(),
                match_type: None,
                component_name: Some("Body".to_string()),
                is_base_skin: true,
            }],
        );

        let anchor = determine_anchor_character(&mod_dir, &ast, &hash_alias_map);
        assert!(anchor.is_some(), "Anchor must be resolved");
        let (id, name) = anchor.unwrap();
        assert_eq!(id, "jane_doe", "Anchor must resolve to Jane Doe, ignoring generic engine hash d9a12c0a");
        assert_eq!(name, "Jane Doe");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_shader_override_and_commandlist_partitioning() {
        let content = r#"
[Constants]
global $active = 1

[ShaderOverrideEllenEye]
hash = abcdef12

[TextureOverrideEllenHair]
hash = 11111111
run = CommandListEllenSpecial

[TextureOverrideCorinBody]
hash = 22222222
run = CommandListCorinSpecial

[CommandListEllenSpecial]
ResourceDiffuse = ResourceEllenDiff

[CommandListCorinSpecial]
ResourceDiffuse = ResourceCorinDiff
"#;
        let ast = IniAst::parse(content);
        let (global_sections, texture_overrides, _) = partition_sections(&ast);

        // Invariant: ShaderOverride must be clustered with overrides, NOT dumped into global_sections
        assert!(
            texture_overrides.iter().any(|s| s.name == "ShaderOverrideEllenEye"),
            "ShaderOverride must be in texture_overrides"
        );
        assert!(
            !global_sections.iter().any(|s| s.name == "ShaderOverrideEllenEye"),
            "ShaderOverride must NOT be in global_sections"
        );

        // Invariant: CommandList must NOT be in global_sections
        assert!(
            !global_sections.iter().any(|s| s.name.starts_with("CommandList")),
            "CommandList sections must NOT be in global_sections"
        );

        // Invariant: Dependency extraction for Ellen only extracts Ellen's command list
        let ellen_sec = texture_overrides.iter().find(|s| s.name == "TextureOverrideEllenHair").unwrap();
        let (ellen_deps, _) = extract_section_dependencies(&ast, ellen_sec);
        assert!(ellen_deps.iter().any(|s| s.name == "CommandListEllenSpecial"));
        assert!(!ellen_deps.iter().any(|s| s.name == "CommandListCorinSpecial"), "Ellen must not receive Corin's command list");
    }

    #[test]
    fn test_multi_character_mod_split_isolation() {
        let temp_dir = std::env::temp_dir().join("zzz_test_multichar_isolation");
        let _ = fs::remove_dir_all(&temp_dir);
        let mod_dir = temp_dir.join("MultiPackMod");
        let _ = fs::create_dir_all(&mod_dir);

        let ini_content = r#"
[Constants]
global $active = 1

[TextureOverrideEllenHair]
hash = 11111111
vb0 = ResourceEllenHairPos

[TextureOverrideCorinBody]
hash = 22222222
vb0 = ResourceCorinBodyPos

[ResourceEllenHairPos]
filename = EllenHair.buf

[ResourceCorinBodyPos]
filename = CorinBody.buf
"#;
        fs::write(mod_dir.join("mod.ini"), ini_content).unwrap();
        fs::write(mod_dir.join("EllenHair.buf"), b"ellen data").unwrap();
        fs::write(mod_dir.join("CorinBody.buf"), b"corin data").unwrap();

        let db_content = r#"[
            {"id": "ellen_joe", "name": "Ellen Joe", "skins": [{"id": "default", "name": "Default", "components": {"Hair": "11111111"}}]},
            {"id": "corin_wickes", "name": "Corin Wickes", "skins": [{"id": "default", "name": "Default", "components": {"Body": "22222222"}}]}
        ]"#;
        let db_path = temp_dir.join("characters.json");
        fs::write(&db_path, db_content).unwrap();

        let created = split_mod_impl(&db_path, mod_dir.to_string_lossy().to_string(), "character".to_string(), None).unwrap();
        assert_eq!(created.len(), 2, "Expected 2 separate mod directories for Ellen and Corin");

        for path in &created {
            let path_buf = Path::new(path);
            let folder_name = path_buf.file_name().unwrap().to_string_lossy();
            let ini_str = fs::read_to_string(path_buf.join("mod.ini")).unwrap();

            if folder_name.contains("Ellen Joe") {
                assert!(path_buf.join("EllenHair.buf").exists(), "Ellen mod must have EllenHair.buf");
                assert!(!path_buf.join("CorinBody.buf").exists(), "Ellen mod must NOT have CorinBody.buf");
                assert!(ini_str.contains("TextureOverrideEllenHair"));
                assert!(!ini_str.contains("TextureOverrideCorinBody"));
            } else if folder_name.contains("Corin Wickes") {
                assert!(path_buf.join("CorinBody.buf").exists(), "Corin mod must have CorinBody.buf");
                assert!(!path_buf.join("EllenHair.buf").exists(), "Corin mod must NOT have EllenHair.buf");
                assert!(ini_str.contains("TextureOverrideCorinBody"));
                assert!(!ini_str.contains("TextureOverrideEllenHair"));
            }
        }

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_sanitize_rel_path_and_ini_path_line() {
        assert_eq!(sanitize_rel_path(r#""..\textures\body\Base.dds""#), "textures/body/Base.dds");
        assert_eq!(sanitize_rel_path("../toggles/Shapes.hlsl"), "toggles/Shapes.hlsl");
        assert_eq!(sanitize_rel_path("./Model.buf"), "Model.buf");
        assert_eq!(sanitize_rel_path(r#"..\..\secret.buf"#), "secret.buf");

        // INI line sanitization
        let line1 = r#"filename = ..\textures\body\Base.dds"#;
        assert_eq!(sanitize_ini_path_line(line1), r#"filename = textures\body\Base.dds"#);

        let line2 = "cs = ../toggles/Shapes.hlsl ; compute shader";
        assert_eq!(sanitize_ini_path_line(line2), "cs = toggles/Shapes.hlsl ; compute shader");

        let line3 = r#"filename = "..\textures\materialmap\Base.dds""#;
        assert_eq!(sanitize_ini_path_line(line3), r#"filename = "textures\materialmap\Base.dds""#);

        // Lines without .. should remain untouched
        let line4 = "filename = ClaretTopPosition.buf";
        assert_eq!(sanitize_ini_path_line(line4), "filename = ClaretTopPosition.buf");
        let line5 = "; comment line with ..";
        assert_eq!(sanitize_ini_path_line(line5), "; comment line with ..");
    }

    #[test]
    fn test_split_nested_ini_with_parent_traversal_paths() {
        let temp_dir = std::env::temp_dir().join("zzz_test_nested_ini_traversal");
        let _ = fs::remove_dir_all(&temp_dir);
        let category_dir = temp_dir.join("TestChar - Default Outfit");
        let mod_dir = category_dir.join("TestMod");
        let res_dir = mod_dir.join("resources");
        let tex_dir = mod_dir.join("textures");
        let toggles_dir = mod_dir.join("toggles");

        let _ = fs::create_dir_all(&res_dir);
        let _ = fs::create_dir_all(&tex_dir);
        let _ = fs::create_dir_all(&toggles_dir);

        // Nested INI located in resources/
        let ini_content = r#"
[Constants]
global $active = 1

[CustomShaderElement]
cs = ../toggles/Shapes.hlsl

[TextureOverrideTestBody]
hash = 11111111
ib = ResourceTestBodyIB
run = CommandListSharedDiffuse

[TextureOverrideTestHair]
hash = 22222222
ib = ResourceTestHairIB
run = CommandListSharedDiffuse

[CommandListSharedDiffuse]
Resource\ZZMI\Diffuse = ref ResourceSharedDiffuse

[ResourceSharedDiffuse]
filename = ..\textures\SharedDiffuse.dds

[ResourceTestBodyIB]
filename = TestBody.ib

[ResourceTestHairIB]
filename = TestHair.ib
"#;
        fs::write(res_dir.join("Mod.ini"), ini_content).unwrap();
        fs::write(res_dir.join("TestBody.ib"), b"body ib").unwrap();
        fs::write(res_dir.join("TestHair.ib"), b"hair ib").unwrap();
        fs::write(tex_dir.join("SharedDiffuse.dds"), b"shared texture data").unwrap();
        fs::write(toggles_dir.join("Shapes.hlsl"), b"shader code").unwrap();

        let db_content = r#"[
            {"id": "test_char", "name": "TestChar", "skins": [{"id": "default", "name": "Default", "components": {"Body": "11111111", "Hair": "22222222"}}]}
        ]"#;
        let db_path = temp_dir.join("characters.json");
        fs::write(&db_path, db_content).unwrap();

        // Perform split by component
        let created = split_mod_impl(
            &db_path,
            mod_dir.to_string_lossy().to_string(),
            "component".to_string(),
            None,
        )
        .expect("Splitting must succeed without OS Error 32 sharing violations");

        assert_eq!(created.len(), 2, "Expected 2 split components (Body and Hair)");

        // CRITICAL INVARIANT: The parent category directory must NOT contain stray textures or toggles
        assert!(
            !category_dir.join("textures").exists(),
            "Parent folder must NOT be polluted by escaped textures"
        );
        assert!(
            !category_dir.join("toggles").exists(),
            "Parent folder must NOT be polluted by escaped toggles"
        );

        // Verify each split sub-mod
        for path_str in &created {
            let path = Path::new(path_str);
            assert!(path.join("mod.ini").exists(), "Sub-mod must have mod.ini at root");

            // Local textures and shaders must exist inside target_dir
            assert!(
                path.join("textures").join("SharedDiffuse.dds").exists(),
                "SharedDiffuse.dds must be copied inside sub-mod textures directory"
            );
            assert!(
                path.join("toggles").join("Shapes.hlsl").exists(),
                "Shapes.hlsl must be copied inside sub-mod toggles directory"
            );

            // Verify mod.ini has sanitized paths without ..
            let ini_str = fs::read_to_string(path.join("mod.ini")).unwrap();
            assert!(
                !ini_str.contains(r#"..\textures"#) && !ini_str.contains("../textures"),
                "mod.ini must not contain parent traversal ..\\textures: {}",
                ini_str
            );
            assert!(
                !ini_str.contains(r#"..\toggles"#) && !ini_str.contains("../toggles"),
                "mod.ini must not contain parent traversal ../toggles: {}",
                ini_str
            );
            assert!(
                ini_str.contains("textures") && ini_str.contains("SharedDiffuse.dds"),
                "mod.ini must reference local textures path: {}",
                ini_str
            );
        }

        // Verify source folder was cleanly renamed to DISABLED TestMod
        assert!(
            category_dir.join("DISABLED TestMod").exists(),
            "Source mod folder must be disabled after split"
        );

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_detect_monolithic_mesh() {
        // Monolithic: handling = skip with multiple drawindexed calls
        let monolithic_content = r#"
[TextureOverrideClaretTopA]
hash = d942b3a7
handling = skip
drawindexed = 13392, 0, 0
drawindexed = 163770, 13392, 0
drawindexed = 152430, 177162, 0

[TextureOverrideClaretBottomA]
hash = 98ece166
handling = skip
drawindexed = 10338, 0, 0
drawindexed = 1818, 10338, 0
"#;
        let mono_ast = IniAst::parse(monolithic_content);
        assert!(detect_monolithic_mesh(&mono_ast));

        // Non-monolithic: clean single draw per section
        let clean_content = r#"
[TextureOverrideAliceHair]
hash = 13596d7b
handling = skip
drawindexed = 15999, 0, 0

[TextureOverrideAliceOutfit]
hash = d942b3a7
handling = skip
drawindexed = 39828, 0, 0
"#;
        let clean_ast = IniAst::parse(clean_content);
        assert!(!detect_monolithic_mesh(&clean_ast));

        let temp_dir = std::env::temp_dir().join("zzz_test_mono_detection");
        let _ = fs::remove_dir_all(&temp_dir);
        let mod_dir = temp_dir.join("TestMonoMod");
        fs::create_dir_all(&mod_dir).unwrap();
        fs::write(mod_dir.join("mod.ini"), monolithic_content).unwrap();

        let db_path = temp_dir.join("characters.json");
        fs::write(&db_path, "{}").unwrap();

        let previews = preview_split_mod_impl(&db_path, mod_dir.to_string_lossy().to_string(), "component".to_string()).unwrap();
        assert!(!previews.is_empty());
        assert_eq!(previews[0].is_monolithic, Some(true));
        assert!(previews[0].warning.is_some());

        // When split using "bodypart" mode, macro draw-call clustering is used:
        let bodypart_previews = preview_split_mod_impl(&db_path, mod_dir.to_string_lossy().to_string(), "bodypart".to_string()).unwrap();
        assert_eq!(bodypart_previews.len(), 2, "Bodypart mode must produce 2 macro groups (Top and Bottom)");
        assert!(bodypart_previews.iter().any(|p| p.group_name == "Top"));
        assert!(bodypart_previews.iter().any(|p| p.group_name == "Bottom"));
        assert_eq!(bodypart_previews[0].is_monolithic, None, "Bodypart mode preserves full body parts without monolithic warnings");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_three_mode_split_pipeline() {
        let temp_dir = std::env::temp_dir().join("zzz_test_three_modes");
        let _ = fs::remove_dir_all(&temp_dir);
        let mod_dir = temp_dir.join("ThreeModeMod");
        fs::create_dir_all(&mod_dir).unwrap();

        let ini_content = r#"
[TextureOverrideJaneBody]
hash = 10050266
handling = skip
vb0 = ResourceJanePos

; Submesh 1: Hair
if $hair == 1
    drawindexed = auto
endif

; Submesh 2: Glasses
if $glasses == 1
    drawindexed = auto
endif

[TextureOverrideNicoleOutfit]
hash = 98ece166
handling = skip
drawindexed = auto

[ResourceJanePos]
filename = Jane.buf
"#;
        fs::write(mod_dir.join("mod.ini"), ini_content).unwrap();
        fs::write(mod_dir.join("Jane.buf"), b"mesh data").unwrap();

        let db_path = temp_dir.join("characters.json");
        fs::write(&db_path, "{}").unwrap();

        // 1. Character mode -> groups by character (Jane vs Nicole)
        let char_previews = preview_split_mod_impl(&db_path, mod_dir.to_string_lossy().to_string(), "character".to_string()).unwrap();
        assert_eq!(char_previews.len(), 2, "Character mode separates Jane and Nicole");

        // 2. Submesh mode -> decomposes internal toggles (Hair vs Glasses)
        let submesh_previews = preview_split_mod_impl(&db_path, mod_dir.to_string_lossy().to_string(), "submesh".to_string()).unwrap();
        assert!(submesh_previews.len() >= 2, "Submesh mode separates toggles");
        assert!(submesh_previews.iter().any(|p| p.group_name.contains("Hair")));

        // 3. Bodypart mode -> macro draw calls intact
        let bodypart_previews = preview_split_mod_impl(&db_path, mod_dir.to_string_lossy().to_string(), "bodypart".to_string()).unwrap();
        assert!(!bodypart_previews.is_empty(), "Bodypart mode creates macro clusters");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_compute_shader_uav_and_copy_resources_split() {
        let temp_dir = std::env::temp_dir().join("zmm_test_compute_split");
        let _ = fs::remove_dir_all(&temp_dir);
        let mod_dir = temp_dir.join("ClaretComputeMod");
        fs::create_dir_all(&mod_dir).unwrap();

        let ini_content = r#"; Compute Shader and Shapekey Mod
[Present]
if $active == 1
    run = CustomShaderComputeShapes.Top
    run = CustomShaderComputeShapes.Bottom
endif

[TextureOverrideTopBlend]
hash = 11111111
vb0 = ResourceTopPosition
handling = skip
drawindexed = auto

[ResourceTopPosition]
type = Buffer
stride = 40
filename = TopPosition.buf

[ResourceTopPosition.Base]
type = Buffer
stride = 40
filename = TopPosition.buf

[ResourceTopPosition.Flat]
type = Buffer
stride = 40
filename = TopPositionFlat.buf

[CustomShaderComputeShapes.Top]
cs = toggles/Shapes.hlsl
cs-u5 = copy ResourceTopPosition.Base
cs-t51 = copy ResourceTopPosition.Flat
ResourceTopPosition = ref cs-u5

[TextureOverrideBottomBlend]
hash = 22222222
vb0 = ResourceBottomPosition
handling = skip
drawindexed = auto

[ResourceBottomPosition]
type = Buffer
stride = 40
filename = BottomPosition.buf

[ResourceBottomPosition.Base]
type = Buffer
stride = 40
filename = BottomPosition.buf

[ResourceBottomPosition.Flat]
type = Buffer
stride = 40
filename = BottomPositionFlat.buf

[CustomShaderComputeShapes.Bottom]
cs = toggles/Shapes.hlsl
cs-u5 = copy ResourceBottomPosition.Base
cs-t51 = copy ResourceBottomPosition.Flat
ResourceBottomPosition = ref cs-u5
"#;
        fs::write(mod_dir.join("mod.ini"), ini_content).unwrap();
        fs::write(mod_dir.join("TopPosition.buf"), b"top base").unwrap();
        fs::write(mod_dir.join("TopPositionFlat.buf"), b"top flat").unwrap();
        fs::write(mod_dir.join("BottomPosition.buf"), b"bottom base").unwrap();
        fs::write(mod_dir.join("BottomPositionFlat.buf"), b"bottom flat").unwrap();

        let toggles_dir = mod_dir.join("toggles");
        fs::create_dir_all(&toggles_dir).unwrap();
        fs::write(toggles_dir.join("Shapes.hlsl"), b"shader code").unwrap();

        let db_path = temp_dir.join("characters.json");
        fs::write(&db_path, "{}").unwrap();

        let results = split_mod_impl(
            &db_path,
            mod_dir.to_string_lossy().to_string(),
            "bodypart".to_string(),
            None,
        ).unwrap();

        assert_eq!(results.len(), 2, "Should produce Top and Bottom splits");

        // Validate Top split
        let top_path_str = results.iter().find(|p| p.contains("Top")).expect("Top split must exist");
        let top_path = Path::new(top_path_str);
        assert!(top_path.join("TopPositionFlat.buf").exists(), "TopPositionFlat.buf must be copied to Top split");
        let top_ini = fs::read_to_string(top_path.join("mod.ini")).unwrap();
        assert!(top_ini.contains("[ResourceTopPosition.Base]"), "Top ini must contain ResourceTopPosition.Base");
        assert!(top_ini.contains("[ResourceTopPosition.Flat]"), "Top ini must contain ResourceTopPosition.Flat");
        assert!(top_ini.contains("run = CustomShaderComputeShapes.Top"), "Top ini must run CustomShaderComputeShapes.Top");
        assert!(!top_ini.contains("run = CustomShaderComputeShapes.Bottom"), "Top ini must NOT run CustomShaderComputeShapes.Bottom");
        assert!(!top_ini.contains("[CustomShaderComputeShapes.Bottom]"), "Top ini must NOT include CustomShaderComputeShapes.Bottom section");

        // Validate Bottom split
        let bottom_path_str = results.iter().find(|p| p.contains("Bottom")).expect("Bottom split must exist");
        let bottom_path = Path::new(bottom_path_str);
        assert!(bottom_path.join("BottomPositionFlat.buf").exists(), "BottomPositionFlat.buf must be copied to Bottom split");
        let bottom_ini = fs::read_to_string(bottom_path.join("mod.ini")).unwrap();
        assert!(bottom_ini.contains("[ResourceBottomPosition.Base]"), "Bottom ini must contain ResourceBottomPosition.Base");
        assert!(bottom_ini.contains("[ResourceBottomPosition.Flat]"), "Bottom ini must contain ResourceBottomPosition.Flat");
        assert!(bottom_ini.contains("run = CustomShaderComputeShapes.Bottom"), "Bottom ini must run CustomShaderComputeShapes.Bottom");
        assert!(!bottom_ini.contains("run = CustomShaderComputeShapes.Top"), "Bottom ini must NOT run CustomShaderComputeShapes.Top");
        assert!(!bottom_ini.contains("[CustomShaderComputeShapes.Top]"), "Bottom ini must NOT include CustomShaderComputeShapes.Top section");

        let _ = fs::remove_dir_all(&temp_dir);
    }

