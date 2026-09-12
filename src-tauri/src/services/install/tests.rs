use super::*;
use super::classifier::*;
use super::tagger::*;
use crate::models::HashTarget;
use std::fs;

    #[test]
    fn test_detect_mod_auto_tags_character_not_ui() {
        let temp_dir = std::env::temp_dir().join("zzz_test_auto_tags_char");
        let _ = fs::remove_dir_all(&temp_dir);
        let mod_dir = temp_dir.join("Playable Characters").join("Jane Doe - Hidden Nightfade").join("Jane as Sasha without tag");
        let _ = fs::create_dir_all(&mod_dir);

        let ini_file = mod_dir.join("Jane.ini");
        let ini_content = r#"
[Constants]
global $active = 0
global $help = 1

[Present]
post $active = 0

[TextureOverrideJaneBody]
hash = 0e1c6740
ib = ResourceJaneBodyIB

[ResourceJaneBodyIB]
type = Buffer
format = DXGI_FORMAT_R16_UINT
filename = JaneBody.buf
"#;
        let _ = fs::write(&ini_file, ini_content);
        let _ = fs::write(mod_dir.join("JaneBody.buf"), b"mock buffer");

        let tags = detect_mod_auto_tags(&mod_dir, "Jane Doe - Hidden Nightfade", false);
        assert!(!tags.contains(&"UI".to_string()), "Character mod should NOT be tagged as UI");
        assert!(tags.contains(&"Outfit".to_string()), "Character mod with IB/buf should be tagged as Outfit");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_detect_mod_auto_tags_swimsuit_not_ui() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_auto_tags_swimsuit_{}", unique_id));
        let _ = fs::remove_dir_all(&temp_dir);
        let mod_dir = temp_dir.join("Playable Characters").join("Ellen Joe").join("Ellen_Swimsuit_Beach");
        let _ = fs::create_dir_all(&mod_dir);

        let ini_file = mod_dir.join("Ellen.ini");
        let ini_content = r#"
[TextureOverrideEllenDiffuse]
hash = 12345678
ResourceDiffuse = ResourceEllenDiffuse

[ResourceEllenDiffuse]
filename = EllenDiffuse.dds
"#;
        let _ = fs::write(&ini_file, ini_content);

        let tags = detect_mod_auto_tags(&mod_dir, "Ellen Joe - Ellen Scissorhands", false);
        assert!(!tags.contains(&"UI".to_string()), "Swimsuit containing 'ui' substring should NOT be tagged as UI");
        assert!(tags.contains(&"Recolor".to_string()), "Texture-only mod should be tagged as Recolor");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_detect_mod_auto_tags_genuine_ui() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_auto_tags_ui_{}", unique_id));
        let mod_dir = temp_dir.join("UI").join("DamageNumbers");
        let _ = fs::create_dir_all(&mod_dir);

        let ini_file = mod_dir.join("DamageNumbers.ini");
        let ini_content = r#"
[TextureOverrideDamageFont]
hash = aabbccdd
"#;
        let _ = fs::write(&ini_file, ini_content);

        let tags = detect_mod_auto_tags(&mod_dir, "UI", false);
        assert!(tags.contains(&"UI".to_string()), "Mod in UI folder should be tagged as UI");
        assert!(!tags.contains(&"Outfit".to_string()), "Pure UI mod should NOT be tagged as Outfit");
        assert!(!tags.contains(&"Recolor".to_string()), "Pure UI mod should NOT be tagged as Recolor");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_detect_mod_auto_tags_retexture_with_template_ib() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_auto_tags_retext_{}", unique_id));
        let mod_dir = temp_dir.join("Playable Characters").join("Harumasa").join("Retouch");
        let _ = fs::create_dir_all(&mod_dir);

        let ini_file = mod_dir.join("Harumasa.ini");
        let ini_content = r#"
[TextureOverrideHarumasaBody]
hash = 771fdae9
ib = 3371580a
match_first_index = 0
this = ResourceBodyDDS

[ResourceBodyDDS]
filename = HarumasaBody.dds
"#;
        let _ = fs::write(&ini_file, ini_content);
        let _ = fs::write(mod_dir.join("HarumasaBody.dds"), b"fake texture");

        let tags = detect_mod_auto_tags(&mod_dir, "Asaba Harumasa - Full-Fledged Strings", false);
        assert!(tags.contains(&"Recolor".to_string()), "Texture only mod with template IB must be tagged as Recolor");
        assert!(!tags.contains(&"Outfit".to_string()), "Texture only mod must NOT be tagged as Outfit");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_detect_mod_auto_tags_pure_weapon() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_auto_tags_weap_{}", unique_id));
        let mod_dir = temp_dir.join("Weapons").join("Steel Cushion").join("CustomWeapon");
        let _ = fs::create_dir_all(&mod_dir);

        let ini_file = mod_dir.join("Weapon.ini");
        let ini_content = r#"
[TextureOverrideWeapon]
hash = 11223344
vb0 = ResourceWeaponVB

[ResourceWeaponVB]
type = Buffer
filename = Weapon.buf
"#;
        let _ = fs::write(&ini_file, ini_content);
        let _ = fs::write(mod_dir.join("Weapon.buf"), b"mock buffer");

        let tags = detect_mod_auto_tags(&mod_dir, "Weapons - Steel Cushion", false);
        assert!(tags.contains(&"Weapon".to_string()), "Weapon category mod must be tagged as Weapon");
        assert!(!tags.contains(&"Outfit".to_string()), "Pure weapon mod must NOT be tagged as Outfit");
        assert!(!tags.contains(&"Animation".to_string()), "Pure weapon mod must NOT be tagged as Animation");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_detect_mod_auto_tags_blender_file_not_anim() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_auto_tags_blender_{}", unique_id));
        let mod_dir = temp_dir.join("Playable Characters").join("Anton").join("AntonMod");
        let _ = fs::create_dir_all(&mod_dir);

        let _ = fs::write(mod_dir.join("project.blend"), b"blender file");
        let _ = fs::write(mod_dir.join("AntonBody.buf"), b"mock buffer");

        let tags = detect_mod_auto_tags(&mod_dir, "Anton Ivanov - Earthshaking Axle", false);
        assert!(!tags.contains(&"Animation".to_string()), ".blend file must NOT tag mod as Animation");
        assert!(tags.contains(&"Outfit".to_string()), "3D mod with .buf must be tagged as Outfit");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_detect_mod_auto_tags_ui_screen_uid() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_auto_tags_uid_{}", unique_id));
        let mod_dir = temp_dir.join("Playable Characters").join("Unassigned").join("hide_uid_26");
        let _ = fs::create_dir_all(&mod_dir);

        let ini_file = mod_dir.join("Hide_UID 2.6.ini");
        let ini_content = r#"
[TextureOverrideScreenUID]
hash = 079c5c45
handling = skip
"#;
        let _ = fs::write(&ini_file, ini_content);

        let tags = detect_mod_auto_tags(&mod_dir, "Unassigned", false);
        assert!(tags.contains(&"UI".to_string()), "hide_uid mod with TextureOverrideScreenUID must be tagged as UI");
        assert!(!tags.contains(&"Outfit".to_string()), "UI mod must NOT be tagged as Outfit");
        assert!(!tags.contains(&"Recolor".to_string()), "UI mod must NOT be tagged as Recolor");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_detect_mod_auto_tags_animated_wallpaper() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_auto_tags_wall_{}", unique_id));
        let mod_dir = temp_dir.join("Playable Characters").join("Unassigned").join("Burnice wallpaper");
        let _ = fs::create_dir_all(&mod_dir);

        let ini_file = mod_dir.join("mod.ini");
        let ini_content = r#"
[Constants]
global $animation_timer = 1
global $speed = 0.5

[Present]
$animation_timer = $animation_timer + $speed
if $animation_timer >= 302
    $animation_timer = 1
endif

[TextureOverrideMudar]
hash = 173039b8
run = CommandlistAnimacao
"#;
        let _ = fs::write(&ini_file, ini_content);

        let tags = detect_mod_auto_tags(&mod_dir, "Unassigned", false);
        assert!(tags.contains(&"UI".to_string()), "Wallpaper mod must be tagged as UI");
        assert!(tags.contains(&"Animation".to_string()), "Flipbook animation timer must be tagged as Animation");
        assert!(!tags.contains(&"Outfit".to_string()), "Wallpaper mod must NOT be tagged as Outfit");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_detect_mod_auto_tags_animated_icons() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_auto_tags_icons_{}", unique_id));
        let mod_dir = temp_dir.join("Playable Characters").join("Unassigned").join("Klons Agents Icons Mod Animated SFW v27");
        let _ = fs::create_dir_all(&mod_dir);

        let ini_file = mod_dir.join("YeSh.ini");
        let ini_content = r#"
[Constants]
global $YeSh_FPS = 60
global $YeSh_Frames = 240

[TextureOverrideIcon]
hash = 1d3d3a23
$Common_FrameIndex = (time * $YeSh_FPS % ($YeSh_Frames - 1)) // 1
this = ResourceAni
"#;
        let _ = fs::write(&ini_file, ini_content);

        let tags = detect_mod_auto_tags(&mod_dir, "Unassigned", false);
        assert!(tags.contains(&"UI".to_string()), "Icons mod must be tagged as UI");
        assert!(tags.contains(&"Animation".to_string()), "Animated icons must be tagged as Animation");
        assert!(tags.contains(&"SFW".to_string()), "SFW in folder name must be tagged as SFW");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_detect_mod_auto_tags_character_outfit_with_ui_menu_not_ui_or_anim() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_auto_tags_rina_{}", unique_id));
        let _ = fs::remove_dir_all(&temp_dir);
        let mod_dir = temp_dir.join("Playable Characters").join("Alexandrina Sebastiane - Head Maid's Perfection").join("RinaRose_Enhanced");
        let _ = fs::create_dir_all(mod_dir.join("UIResources").join("AnimatedMenu"));
        let _ = fs::create_dir_all(mod_dir.join("Meshes"));

        // Simulate 3D mesh buffers, animation frames, and textures
        let _ = fs::write(mod_dir.join("Meshes").join("RinaBody.buf"), b"mock body buf");
        let _ = fs::write(mod_dir.join("Meshes").join("RinaBody.ib"), b"mock body ib");
        let _ = fs::write(mod_dir.join("Meshes").join("RinaBodyPositionAnimFrame1.buf"), b"mock anim frame");
        let _ = fs::write(mod_dir.join("RinaBodyDiffuse.dds"), b"mock dds");

        // Simulate INI with character body override, compute shape keys, in-game UI customization menu, and cursor timer math
        let ini_file = mod_dir.join("Rina.ini");
        let ini_content = r#"
[Constants]
global persist $swapvar = 0
$swapvarUIAnim = (time * $UIfps % ($UIframeEnd - $UIframeStart + 1) + $UIframeStart) // 1

[TextureOverrideRinaBody]
hash = 17471aea
ib = ResourceRinaBodyIB

[TextureOverrideRinaHair]
hash = fef908be

[CommandListComputeShapeKeys]
run = CustomShaderKeys

[CommandListUIAnimation]
run = CustomShader\UI\Render

[ResourceMenuItem.Hair]
filename = UIResources\Hair.png
"#;
        let _ = fs::write(&ini_file, ini_content);

        let tags = detect_mod_auto_tags(&mod_dir, "Alexandrina Sebastiane - Head Maid's Perfection", false);
        assert!(tags.contains(&"Outfit".to_string()), "Character mod with 3D body/hair mesh must be tagged as Outfit");
        assert!(tags.contains(&"In-Game Menu".to_string()), "Mod with UIResources/RenderUI must be tagged as In-Game Menu");
        assert!(tags.contains(&"UI Animation".to_string()), "Mod with animated menu must be tagged as UI Animation");
        assert!(tags.contains(&"Animation".to_string()), "Mod with character shape keys/AnimFrame buffers must be tagged as Animation");
        assert!(!tags.contains(&"UI".to_string()), "Character outfit with in-game menu must NOT be tagged as UI");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_determine_mod_category_alice_vs_billy_noise() {
        let temp_dir = std::env::temp_dir().join("zzz_test_determine_alice");
        let _ = fs::remove_dir_all(&temp_dir);
        let _ = fs::create_dir_all(&temp_dir);

        let ini_content = r#"
[TextureOverrideAliceBodyIB]
hash = 8a512b21

[TextureOverrideAliceLegsIB]
hash = 625c2692

[TextureOverrideAliceLegsDrawVB]
hash = 3e4c0174
"#;
        let _ = fs::write(temp_dir.join("Alice.ini"), ini_content);

        let mut hash_map: HashMap<String, Vec<HashTarget>> = HashMap::new();
        // Alice matches
        hash_map.insert("8a512b21".to_string(), vec![HashTarget {
            category_name: "Alice Thymefield - Celestian Etiquette".to_string(),
            character_id: "alice_thymefield".to_string(),
            skin_id: "celestian_etiquette".to_string(),
            match_type: Some("ib".to_string()),
            component_name: Some("Body".to_string()),
            is_base_skin: true,
        }]);
        hash_map.insert("625c2692".to_string(), vec![HashTarget {
            category_name: "Alice Thymefield - Celestian Etiquette".to_string(),
            character_id: "alice_thymefield".to_string(),
            skin_id: "celestian_etiquette".to_string(),
            match_type: Some("ib".to_string()),
            component_name: Some("Legs".to_string()),
            is_base_skin: true,
        }]);
        // 3e4c0174 collides between Alice and Billy Kid
        hash_map.insert("3e4c0174".to_string(), vec![
            HashTarget {
                category_name: "Alice Thymefield - Celestian Etiquette".to_string(),
                character_id: "alice_thymefield".to_string(),
                skin_id: "celestian_etiquette".to_string(),
                match_type: Some("draw_vb".to_string()),
                component_name: Some("Legs".to_string()),
                is_base_skin: true,
            },
            HashTarget {
                category_name: "Billy Kid - Shining Starlight Costume".to_string(),
                character_id: "billy_kid".to_string(),
                skin_id: "shining_starlight_costume".to_string(),
                match_type: Some("draw_vb".to_string()),
                component_name: Some("Hair".to_string()),
                is_base_skin: true,
            },
        ]);

        let matched = determine_mod_category(&temp_dir, &hash_map);
        assert!(matched.is_some());
        let m = matched.unwrap();
        assert_eq!(m.category_name, "Alice Thymefield - Celestian Etiquette");
        assert_eq!(m.character_id.as_deref(), Some("alice_thymefield"));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_determine_mod_category_true_multi_character() {
        let temp_dir = std::env::temp_dir().join("zzz_test_determine_multi");
        let _ = fs::remove_dir_all(&temp_dir);
        let _ = fs::create_dir_all(&temp_dir);

        let ini_content = r#"
[TextureOverrideJaneBodyIB]
hash = 10050266

[TextureOverrideNicoleBodyIB]
hash = 20050266
"#;
        let _ = fs::write(temp_dir.join("Multi.ini"), ini_content);

        let mut hash_map: HashMap<String, Vec<HashTarget>> = HashMap::new();
        hash_map.insert("10050266".to_string(), vec![HashTarget {
            category_name: "Jane Doe - Default".to_string(),
            character_id: "jane_doe".to_string(),
            skin_id: "jane_default".to_string(),
            match_type: Some("ib".to_string()),
            component_name: Some("Body".to_string()),
            is_base_skin: true,
        }]);
        hash_map.insert("20050266".to_string(), vec![HashTarget {
            category_name: "Nicole Demara - Default".to_string(),
            character_id: "nicole_demara".to_string(),
            skin_id: "nicole_default".to_string(),
            match_type: Some("ib".to_string()),
            component_name: Some("Body".to_string()),
            is_base_skin: true,
        }]);

        let matched = determine_mod_category(&temp_dir, &hash_map);
        assert!(matched.is_some());
        let m = matched.unwrap();
        assert_eq!(m.category_name, "Multi-Character");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_determine_mod_category_ui_mod_stays_unassigned() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_determine_ui_{}", unique_id));
        let mod_dir = temp_dir.join("Burnice Ui Gb v2.0");
        let _ = fs::create_dir_all(&mod_dir);

        // UI mod that happens to override a Burnice portrait texture
        let ini_content = r#"
[TextureOverrideBurnicePortrait]
hash = bb112233
this = ResourcePortraitDDS

[ResourcePortraitDDS]
filename = BurnicePortrait.dds
"#;
        let _ = fs::write(mod_dir.join("BurniceUi.ini"), ini_content);
        let _ = fs::write(mod_dir.join("BurnicePortrait.dds"), b"fake image");

        let mut hash_map: HashMap<String, Vec<HashTarget>> = HashMap::new();
        hash_map.insert("bb112233".to_string(), vec![HashTarget {
            category_name: "Burnice White - Wildfire Rave".to_string(),
            character_id: "burnice_white".to_string(),
            skin_id: "burnice_alt".to_string(),
            match_type: Some("textures.Head".to_string()),
            component_name: Some("Head".to_string()),
            is_base_skin: false,
        }]);

        let matched = determine_mod_category(&mod_dir, &hash_map);
        // Explicit rule: UI mods must return None so they route to Unassigned!
        assert!(matched.is_none(), "Burnice UI mod must return None and stay in Unassigned");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_determine_mod_category_character_recolor_not_blocked() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_recolor_{}", unique_id));
        let mod_dir = temp_dir.join("Burnice Red Flame Recolor");
        let _ = fs::create_dir_all(&mod_dir);

        // Texture recolor mod with NO .buf files
        let ini_content = r#"
[TextureOverrideBurniceBody]
hash = 77889900
this = ResourceBodyDDS

[ResourceBodyDDS]
filename = BurniceBody.dds
"#;
        let _ = fs::write(mod_dir.join("BurniceRecolor.ini"), ini_content);
        let _ = fs::write(mod_dir.join("BurniceBody.dds"), b"fake dds");

        let mut hash_map: HashMap<String, Vec<HashTarget>> = HashMap::new();
        hash_map.insert("77889900".to_string(), vec![HashTarget {
            category_name: "Burnice White - Default".to_string(),
            character_id: "burnice_white".to_string(),
            skin_id: "burnice_default".to_string(),
            match_type: Some("textures.Body".to_string()),
            component_name: Some("Body".to_string()),
            is_base_skin: true,
        }]);

        let matched = determine_mod_category(&mod_dir, &hash_map);
        assert!(matched.is_some(), "Character recolor mod must route to the character folder");
        let m = matched.unwrap();
        assert_eq!(m.category_name, "Burnice White - Default");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_determine_mod_category_hybrid_outfit_with_ui_icon_routes_to_character() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_hybrid_{}", unique_id));
        let mod_dir = temp_dir.join("Jane Doe Custom Outfit Plus UI");
        let _ = fs::create_dir_all(&mod_dir);

        // Hybrid mod: has 3D geometry buffer AND custom UI icon
        let ini_content = r#"
[TextureOverrideJaneBody]
hash = 10050266
vb0 = ResourceBodyVB

[TextureOverrideJaneIcon]
hash = 99887766
this = ResourceIconDDS

[ResourceBodyVB]
type = Buffer
filename = JaneBody.buf

[ResourceIconDDS]
filename = JaneIcon.dds
"#;
        let _ = fs::write(mod_dir.join("JaneMod.ini"), ini_content);
        let _ = fs::write(mod_dir.join("JaneBody.buf"), b"mock 3d vertex buffer");
        let _ = fs::write(mod_dir.join("JaneIcon.dds"), b"mock icon");

        let mut hash_map: HashMap<String, Vec<HashTarget>> = HashMap::new();
        hash_map.insert("10050266".to_string(), vec![HashTarget {
            category_name: "Jane Doe - Default".to_string(),
            character_id: "jane_doe".to_string(),
            skin_id: "jane_default".to_string(),
            match_type: Some("position_vb".to_string()),
            component_name: Some("Body".to_string()),
            is_base_skin: true,
        }]);

        let matched = determine_mod_category(&mod_dir, &hash_map);
        assert!(matched.is_some(), "Hybrid 3D outfit must route to the character folder");
        let m = matched.unwrap();
        assert_eq!(m.category_name, "Jane Doe - Default");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_determine_mod_category_legacy_hashes() {
        let temp_dir = std::env::temp_dir().join("zzz_test_determine_legacy_hashes");
        let _ = fs::remove_dir_all(&temp_dir);
        let _ = fs::create_dir_all(&temp_dir);

        let mod_dir = temp_dir.join("OldBelleMod");
        let _ = fs::create_dir_all(&mod_dir);

        // An old v1.0 Belle Swimsuit mod with legacy IB hash 43ed3c22
        let ini_content = r#"
[TextureOverrideBelleSummerBodyIB]
hash = 43ed3c22
"#;
        let _ = fs::write(mod_dir.join("BelleSummer.ini"), ini_content);

        // Build hash alias map populated with both modern and legacy hashes
        let mut hash_map: HashMap<String, Vec<HashTarget>> = HashMap::new();
        hash_map.insert("43ed3c22".to_string(), vec![HashTarget {
            category_name: "Belle - Summer Skies".to_string(),
            character_id: "belle".to_string(),
            skin_id: "summer_skies".to_string(),
            match_type: Some("ib".to_string()),
            component_name: Some("Body".to_string()),
            is_base_skin: false,
        }]);

        let matched = determine_mod_category(&mod_dir, &hash_map);
        assert!(matched.is_some(), "Legacy mod must automatically resolve to character & skin category");
        let m = matched.unwrap();
        assert_eq!(m.category_name, "Belle - Summer Skies");
        assert_eq!(m.character_id.as_deref(), Some("belle"));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_determine_mod_category_alternative_skin_with_shared_head() {
        let temp_dir = std::env::temp_dir().join("zzz_test_alt_skin_shared_head");
        let _ = fs::remove_dir_all(&temp_dir);
        let _ = fs::create_dir_all(&temp_dir);

        let mod_dir = temp_dir.join("BelleSummerSkiesOutfit");
        let _ = fs::create_dir_all(&mod_dir);

        // Mod contains shared head/hair VB (hash: aaaaaaaa) AND unique Summer Body IB (hash: bbbbbbbb)
        let ini_content = r#"
[TextureOverrideBelleHead]
hash = aaaaaaaa

[TextureOverrideBelleSummerBodyIB]
hash = bbbbbbbb
"#;
        let _ = fs::write(mod_dir.join("BelleSummer.ini"), ini_content);

        let mut hash_map: HashMap<String, Vec<HashTarget>> = HashMap::new();
        // Hash aaaaaaaa is shared by both default Belle and Summer Belle
        hash_map.insert("aaaaaaaa".to_string(), vec![
            HashTarget {
                category_name: "Belle - Default".to_string(),
                character_id: "belle".to_string(),
                skin_id: "belle_default".to_string(),
                match_type: Some("blend_vb".to_string()),
                component_name: Some("Head".to_string()),
                is_base_skin: true,
            },
            HashTarget {
                category_name: "Belle - Summer Skies".to_string(),
                character_id: "belle".to_string(),
                skin_id: "summer_skies".to_string(),
                match_type: Some("blend_vb".to_string()),
                component_name: Some("Head".to_string()),
                is_base_skin: false,
            },
        ]);

        // Hash bbbbbbbb is UNIQUE to Summer Belle
        hash_map.insert("bbbbbbbb".to_string(), vec![
            HashTarget {
                category_name: "Belle - Summer Skies".to_string(),
                character_id: "belle".to_string(),
                skin_id: "summer_skies".to_string(),
                match_type: Some("ib".to_string()),
                component_name: Some("Body".to_string()),
                is_base_skin: false,
            },
        ]);

        let matched = determine_mod_category(&mod_dir, &hash_map);
        assert!(matched.is_some());
        let m = matched.unwrap();
        assert_eq!(m.category_name, "Belle - Summer Skies", "Must route to Summer Skies, not Base Belle");
        assert_eq!(m.character_id.as_deref(), Some("belle"));
        assert_eq!(m.skin_id.as_deref(), Some("summer_skies"));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_determine_mod_category_multiple_ib_meshes_not_dropped() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_mult_ib_{}", unique_id));
        let _ = fs::create_dir_all(&temp_dir);

        // Mod has 3 distinct IB hashes for Alice (Body, Legs, Hair)
        let ini_content = r#"
[TextureOverrideAliceBodyIB]
hash = 11111111

[TextureOverrideAliceLegsIB]
hash = 22222222

[TextureOverrideAliceHairIB]
hash = 33333333
"#;
        let _ = fs::write(temp_dir.join("Alice.ini"), ini_content);

        let mut hash_map: HashMap<String, Vec<HashTarget>> = HashMap::new();
        hash_map.insert("11111111".to_string(), vec![HashTarget {
            category_name: "Alice Thymefield - Celestian Etiquette".to_string(),
            character_id: "alice_thymefield".to_string(),
            skin_id: "celestian_etiquette".to_string(),
            match_type: Some("ib".to_string()),
            component_name: Some("Body".to_string()),
            is_base_skin: true,
        }]);
        hash_map.insert("22222222".to_string(), vec![HashTarget {
            category_name: "Alice Thymefield - Celestian Etiquette".to_string(),
            character_id: "alice_thymefield".to_string(),
            skin_id: "celestian_etiquette".to_string(),
            match_type: Some("ib".to_string()),
            component_name: Some("Legs".to_string()),
            is_base_skin: true,
        }]);
        hash_map.insert("33333333".to_string(), vec![HashTarget {
            category_name: "Alice Thymefield - Celestian Etiquette".to_string(),
            character_id: "alice_thymefield".to_string(),
            skin_id: "celestian_etiquette".to_string(),
            match_type: Some("ib".to_string()),
            component_name: Some("Hair".to_string()),
            is_base_skin: true,
        }]);

        // Competing stray runner-up with 1 IB
        hash_map.insert("11111111".to_string(), vec![
            HashTarget {
                category_name: "Alice Thymefield - Celestian Etiquette".to_string(),
                character_id: "alice_thymefield".to_string(),
                skin_id: "celestian_etiquette".to_string(),
                match_type: Some("ib".to_string()),
                component_name: Some("Body".to_string()),
                is_base_skin: true,
            },
            HashTarget {
                category_name: "Billy Kid - Shining Starlight".to_string(),
                character_id: "billy_kid".to_string(),
                skin_id: "shining_starlight".to_string(),
                match_type: Some("ib".to_string()),
                component_name: Some("Body".to_string()),
                is_base_skin: true,
            },
        ]);

        let matched = determine_mod_category(&temp_dir, &hash_map);
        assert!(matched.is_some());
        let m = matched.unwrap();
        // Alice has 3 IBs (300 pts) while Billy only has 1 IB (100 pts = 33.3% < 35%).
        // Alice wins cleanly and is NOT falsely flagged as Multi-Character!
        assert_eq!(m.category_name, "Alice Thymefield - Celestian Etiquette");
        assert_eq!(m.character_id.as_deref(), Some("alice_thymefield"));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_determine_mod_category_belle_summer_skies_shared_legs_first() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_belle_legs_first_{}", unique_id));
        let _ = fs::create_dir_all(&temp_dir);

        // LegsIB (shared) appears BEFORE BodyIB (unique to Summer Skies) in the INI
        let ini_content = r#"
[TextureOverrideBelleLegsIB]
hash = bcc9e4e1

[TextureOverrideBelleSummerBodyIB]
hash = 619c5c94
"#;
        let _ = fs::write(temp_dir.join("Belle.ini"), ini_content);

        let mut hash_map: HashMap<String, Vec<HashTarget>> = HashMap::new();
        // bcc9e4e1 is shared between Summer Skies and Delicate Sunlight
        hash_map.insert("bcc9e4e1".to_string(), vec![
            HashTarget {
                category_name: "Belle - Summer Skies".to_string(),
                character_id: "belle".to_string(),
                skin_id: "summer_skies".to_string(),
                match_type: Some("ib".to_string()),
                component_name: Some("Legs".to_string()),
                is_base_skin: false,
            },
            HashTarget {
                category_name: "Belle - Delicate Sunlight".to_string(),
                character_id: "belle".to_string(),
                skin_id: "delicate_sunlight".to_string(),
                match_type: Some("ib".to_string()),
                component_name: Some("Legs".to_string()),
                is_base_skin: false,
            },
        ]);
        // 619c5c94 is UNIQUE to Summer Skies
        hash_map.insert("619c5c94".to_string(), vec![HashTarget {
            category_name: "Belle - Summer Skies".to_string(),
            character_id: "belle".to_string(),
            skin_id: "summer_skies".to_string(),
            match_type: Some("ib".to_string()),
            component_name: Some("Body".to_string()),
            is_base_skin: false,
        }]);

        let matched = determine_mod_category(&temp_dir, &hash_map);
        assert!(matched.is_some());
        let m = matched.unwrap();
        assert_eq!(m.category_name, "Belle - Summer Skies", "Summer Skies must win even when shared legs IB appears first");
        assert_eq!(m.skin_id.as_deref(), Some("summer_skies"));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_determine_mod_category_jane_nocturne_of_light() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_jane_nocturne_{}", unique_id));
        let _ = fs::create_dir_all(&temp_dir);

        // Shared hair IB 3275b812 and unique body IB ac900322
        let ini_content = r#"
[TextureOverrideJaneHairIB]
hash = 3275b812

[TextureOverrideJaneNocturneBodyIB]
hash = ac900322
"#;
        let _ = fs::write(temp_dir.join("Jane.ini"), ini_content);

        let mut hash_map: HashMap<String, Vec<HashTarget>> = HashMap::new();
        // Hair IB is shared across Hidden Nightfade (base) and Nocturne of Light (alt)
        hash_map.insert("3275b812".to_string(), vec![
            HashTarget {
                category_name: "Jane Doe - Hidden Nightfade".to_string(),
                character_id: "jane_doe".to_string(),
                skin_id: "hidden_nightfade".to_string(),
                match_type: Some("ib".to_string()),
                component_name: Some("Hair".to_string()),
                is_base_skin: true,
            },
            HashTarget {
                category_name: "Jane Doe - Nocturne of Light".to_string(),
                character_id: "jane_doe".to_string(),
                skin_id: "nocturne_of_light".to_string(),
                match_type: Some("ib".to_string()),
                component_name: Some("Hair".to_string()),
                is_base_skin: false,
            },
        ]);
        // Body IB is unique to Nocturne of Light
        hash_map.insert("ac900322".to_string(), vec![HashTarget {
            category_name: "Jane Doe - Nocturne of Light".to_string(),
            character_id: "jane_doe".to_string(),
            skin_id: "nocturne_of_light".to_string(),
            match_type: Some("ib".to_string()),
            component_name: Some("Body".to_string()),
            is_base_skin: false,
        }]);

        let matched = determine_mod_category(&temp_dir, &hash_map);
        assert!(matched.is_some());
        let m = matched.unwrap();
        assert_eq!(m.category_name, "Jane Doe - Nocturne of Light", "Nocturne of Light must win over Hidden Nightfade");
        assert_eq!(m.skin_id.as_deref(), Some("nocturne_of_light"));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_determine_mod_category_shared_head_only_deterministic_base() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_shared_only_{}", unique_id));
        let _ = fs::create_dir_all(&temp_dir);

        // Mod only modifies shared hair (hash aaaaaaaa)
        let ini_content = r#"
[TextureOverrideBelleHair]
hash = aaaaaaaa
"#;
        let _ = fs::write(temp_dir.join("Belle.ini"), ini_content);

        let mut hash_map: HashMap<String, Vec<HashTarget>> = HashMap::new();
        hash_map.insert("aaaaaaaa".to_string(), vec![
            HashTarget {
                category_name: "Belle - Vibrant Store Manager".to_string(),
                character_id: "belle".to_string(),
                skin_id: "vibrant_store_manager".to_string(),
                match_type: Some("ib".to_string()),
                component_name: Some("Hair".to_string()),
                is_base_skin: true,
            },
            HashTarget {
                category_name: "Belle - Summer Skies".to_string(),
                character_id: "belle".to_string(),
                skin_id: "summer_skies".to_string(),
                match_type: Some("ib".to_string()),
                component_name: Some("Hair".to_string()),
                is_base_skin: false,
            },
        ]);

        let matched = determine_mod_category(&temp_dir, &hash_map);
        assert!(matched.is_some());
        let m = matched.unwrap();
        assert_eq!(m.category_name, "Belle - Vibrant Store Manager", "Shared-only mod must route deterministically to base skin");
        assert_eq!(m.skin_id.as_deref(), Some("vibrant_store_manager"));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_find_mod_content_root_unwrapping() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let staging_dir = std::env::temp_dir().join(format!("zzz_test_staging_{}", unique_id));
        let nested_dir = staging_dir.join("ArchiveWrapper").join("InnerRelease").join("ActualMod");
        let _ = fs::create_dir_all(&nested_dir);

        // Trivial readme at wrapper level
        let _ = fs::write(staging_dir.join("ArchiveWrapper").join("readme.txt"), b"trivial");
        // Mod file inside ActualMod
        let _ = fs::write(nested_dir.join("Mod.ini"), b"[TextureOverride]\nhash=12345678");

        let (root, unwrapped) = find_mod_content_root(&staging_dir);
        assert!(unwrapped, "Must unwrap single-child nested directories");
        assert_eq!(root.file_name().unwrap().to_string_lossy(), "ActualMod");

        let _ = fs::remove_dir_all(&staging_dir);
    }

    #[test]
    fn test_generic_folder_naming_heuristic() {
        assert!(is_generic_mod_folder_name("mod"));
        assert!(is_generic_mod_folder_name("mods"));
        assert!(is_generic_mod_folder_name("Release"));
        assert!(is_generic_mod_folder_name("build"));
        assert!(is_generic_mod_folder_name("v1.0"));
        assert!(is_generic_mod_folder_name("v2.1.3"));
        assert!(!is_generic_mod_folder_name("Jane Doe Street Outfit"));
        assert!(!is_generic_mod_folder_name("Belle Summer Bikini"));
    }

    #[test]
    fn test_determine_mod_category_agent_and_companion_submesh_pack_routes_cleanly() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_dir = std::env::temp_dir().join(format!("zzz_test_agent_companion_{}", unique_id));
        let _ = fs::create_dir_all(&temp_dir);

        let ini_content = r#"
[TextureOverrideAriaTorsoIB]
hash = 8c5b553a

[TextureOverrideAriaRobotBodyIB]
hash = 046400d3
"#;
        let _ = fs::write(temp_dir.join("AriaPack.ini"), ini_content);

        let mut hash_map: HashMap<String, Vec<HashTarget>> = HashMap::new();
        // Agent mesh (Aria Torso IB)
        hash_map.insert("8c5b553a".to_string(), vec![HashTarget {
            category_name: "Aria - Energetic Idol".to_string(),
            character_id: "aria".to_string(),
            skin_id: "energetic_idol".to_string(),
            match_type: Some("ib".to_string()),
            component_name: Some("Torso".to_string()),
            is_base_skin: true,
        }]);
        // Companion / alternate form mesh (Aria Robot Body IB)
        hash_map.insert("046400d3".to_string(), vec![HashTarget {
            category_name: "Aria - Energetic Idol".to_string(),
            character_id: "aria".to_string(),
            skin_id: "energetic_idol".to_string(),
            match_type: Some("ib".to_string()),
            component_name: Some("Robot_Body".to_string()),
            is_base_skin: true,
        }]);

        let matched = determine_mod_category(&temp_dir, &hash_map);
        assert!(matched.is_some(), "Must successfully match agent and companion pack");
        let m = matched.unwrap();
        assert_eq!(m.character_id.as_deref(), Some("aria"), "Must route to parent character");
        assert_ne!(m.category_name, "Multi-Character", "Must NEVER falsely classify agent + companion submeshes as Multi-Character");
        assert_eq!(m.category_name, "Aria - Energetic Idol");

        let _ = fs::remove_dir_all(&temp_dir);
    }

