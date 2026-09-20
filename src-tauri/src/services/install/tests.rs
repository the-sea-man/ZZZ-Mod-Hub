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

    #[test]
    fn test_scan_external_folder_depth_1_flat() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_root = std::env::temp_dir().join(format!("zzz_test_importer_d1_{}", unique_id));
        let _ = fs::create_dir_all(&temp_root);

        let mod_a = temp_root.join("ModA");
        let mod_b = temp_root.join("ModB");
        let _ = fs::create_dir_all(&mod_a);
        let _ = fs::create_dir_all(&mod_b);
        let _ = fs::write(mod_a.join("ModA.ini"), "[TextureOverrideA]\nhash=12345678\n");
        let _ = fs::write(mod_b.join("ModB.ini"), "[TextureOverrideB]\nhash=87654321\n");

        let result = scan_external_folder(&temp_root, None).expect("Scan should succeed");
        assert_eq!(result.recommended_depth, 1, "Flat directory must recommend Depth 1");
        assert_eq!(result.candidates.len(), 2, "Must discover both Depth 1 candidate mods");
        for cand in &result.candidates {
            assert!(cand.ini_count >= 1, "Each candidate should have at least 1 ini");
            assert!(!cand.has_subdirs_with_mods, "Candidates should not have nested sub-mods");
            assert!(!cand.is_likely_subcomponent, "Candidates should not be subcomponents");
        }

        let _ = fs::remove_dir_all(&temp_root);
    }

    #[test]
    fn test_scan_external_folder_depth_2_categorized() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_root = std::env::temp_dir().join(format!("zzz_test_importer_d2_{}", unique_id));
        let _ = fs::create_dir_all(&temp_root);

        let char_dir = temp_root.join("Playable Characters");
        let mod_a = char_dir.join("Ellen_Maid");
        let mod_b = char_dir.join("Jane_Police");
        let _ = fs::create_dir_all(&mod_a);
        let _ = fs::create_dir_all(&mod_b);
        let _ = fs::write(mod_a.join("Ellen.ini"), "[TextureOverrideEllen]\nhash=11111111\n");
        let _ = fs::write(mod_b.join("Jane.ini"), "[TextureOverrideJane]\nhash=22222222\n");

        let result = scan_external_folder(&temp_root, None).expect("Scan should succeed");
        assert_eq!(result.recommended_depth, 2, "Nested category structure must recommend Depth 2");
        assert_eq!(result.candidates.len(), 2, "Must discover both candidate mods at Depth 2");

        // Verify Depth 1 was flagged with shallow warnings
        let d1_analysis = result.depth_analyses.iter().find(|d| d.depth == 1).unwrap();
        assert!(d1_analysis.shallow_warning_count > 0, "Depth 1 must have shallow warning for container category");

        let _ = fs::remove_dir_all(&temp_root);
    }

    #[test]
    fn test_scan_external_folder_deep_warning_detection() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_root = std::env::temp_dir().join(format!("zzz_test_importer_deep_{}", unique_id));
        let _ = fs::create_dir_all(&temp_root);

        let mod_dir = temp_root.join("Ellen_Outfit");
        let tex_sub = mod_dir.join("textures");
        let _ = fs::create_dir_all(&tex_sub);
        let _ = fs::write(mod_dir.join("Ellen.ini"), "[TextureOverride]\nhash=12345678\n");
        let _ = fs::write(tex_sub.join("diffuse.dds"), b"fake texture");

        // When scanning at Depth 2 explicitly:
        let result = scan_external_folder(&temp_root, Some(2)).expect("Scan should succeed");
        let d2_analysis = result.depth_analyses.iter().find(|d| d.depth == 2).unwrap();
        assert!(d2_analysis.deep_warning_count > 0, "Depth 2 must detect texture subfolder as deep warning");

        let _ = fs::remove_dir_all(&temp_root);
    }

    #[test]
    fn test_scan_external_folder_no_valid_mods_yields_zero_recommendation() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_root = std::env::temp_dir().join(format!("zzz_test_importer_empty_{}", unique_id));
        let _ = fs::create_dir_all(&temp_root);

        // Create empty folders without any inis or buffers
        let _ = fs::create_dir_all(temp_root.join("FolderA"));
        let _ = fs::create_dir_all(temp_root.join("FolderB"));

        let result = scan_external_folder(&temp_root, None).expect("Scan should succeed");
        assert_eq!(result.recommended_depth, 0, "When no valid mods exist at any depth, recommended_depth must be 0");

        let _ = fs::remove_dir_all(&temp_root);
    }

    #[test]
    fn test_scan_external_folder_mod_with_suboptions_not_penalized_as_container() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_root = std::env::temp_dir().join(format!("zzz_test_importer_subopt_{}", unique_id));
        let _ = fs::create_dir_all(&temp_root);

        // Mod folder directly has an ini, AND has subdirectories with toggle options
        let mod_dir = temp_root.join("Nicole_Party_Dress");
        let opt_dir = mod_dir.join("Options").join("No_Glasses");
        let _ = fs::create_dir_all(&opt_dir);
        let _ = fs::write(mod_dir.join("Nicole.ini"), "[TextureOverrideNicole]\nhash=33333333\n");
        let _ = fs::write(opt_dir.join("GlassesToggle.ini"), "[Constants]\nglobal $glasses=0\n");

        let result = scan_external_folder(&temp_root, None).expect("Scan should succeed");
        assert_eq!(result.recommended_depth, 1, "Mod with sub-options must be recommended at Depth 1");
        let d1_analysis = result.depth_analyses.iter().find(|d| d.depth == 1).unwrap();
        assert_eq!(d1_analysis.valid_mod_count, 1, "Mod with sub-options must count as a valid mod");
        assert_eq!(d1_analysis.shallow_warning_count, 0, "Mod with direct ini must not be penalized as a container");

        let _ = fs::remove_dir_all(&temp_root);
    }

    #[test]
    fn test_execute_external_import_copy_and_conflict_avoidance() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_src = std::env::temp_dir().join(format!("zzz_test_import_src_{}", unique_id));
        let temp_dest = std::env::temp_dir().join(format!("zzz_test_import_dest_{}", unique_id));
        let _ = fs::create_dir_all(&temp_src);
        let _ = fs::create_dir_all(&temp_dest);

        // Create source mod
        let src_mod = temp_src.join("Corin_Bunny");
        let _ = fs::create_dir_all(&src_mod);
        let _ = fs::write(src_mod.join("Corin.ini"), "[TextureOverrideCorin]\nhash=abcdef12\n");
        let _ = fs::write(src_mod.join("CorinBody.buf"), b"vertex buffer data");

        // Pre-create existing mod in Unassigned to induce collision
        let unassigned_dir = temp_dest.join("Unassigned");
        let _ = fs::create_dir_all(unassigned_dir.join("Corin_Bunny"));

        let request = ExecuteImportRequest {
            candidate_paths: vec![src_mod.to_string_lossy().to_string()],
            destination_root: temp_dest.to_string_lossy().to_string(),
            copy_mode: true,
        };

        let exec_result = execute_external_import(request).expect("Import execution should succeed");
        assert_eq!(exec_result.success_count, 1, "Must report 1 success");
        assert_eq!(exec_result.conflict_count, 1, "Must detect and record 1 conflict");

        // Verify source files still exist (copy mode non-destructive guarantee)
        assert!(src_mod.join("Corin.ini").exists(), "Source files must not be deleted in copy mode");

        // Verify destination has the conflict-renamed folder and .zmm-meta.json
        let dest_entries: Vec<String> = fs::read_dir(&unassigned_dir)
            .unwrap()
            .filter_map(Result::ok)
            .map(|e| e.file_name().to_string_lossy().to_string())
            .collect();
        assert!(dest_entries.iter().any(|name| name.starts_with("DISABLED Corin_Bunny_conflict_")),
            "Conflict folder must be created with DISABLED prefix and conflict hash");

        let _ = fs::remove_dir_all(&temp_src);
        let _ = fs::remove_dir_all(&temp_dest);
    }

    #[test]
    fn test_execute_external_import_routes_to_playable_characters_and_migrates_orphan_unassigned() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_src = std::env::temp_dir().join(format!("zzz_test_pc_src_{}", unique_id));
        let temp_dest = std::env::temp_dir().join(format!("zzz_test_pc_dest_{}", unique_id));
        let _ = fs::create_dir_all(&temp_src);
        let pc_dir = temp_dest.join("Playable Characters");
        let _ = fs::create_dir_all(&pc_dir);

        // Pre-create an orphan mod in top-level Unassigned (e.g. from previous mistaken run)
        let top_unassigned = temp_dest.join("Unassigned");
        let orphan_mod = top_unassigned.join("Legacy_Mod");
        let _ = fs::create_dir_all(&orphan_mod);
        let _ = fs::write(orphan_mod.join("mod.ini"), "[TextureOverride]\nhash=12345678\n");

        // Create new external candidate mod
        let new_mod = temp_src.join("New_Billy_Skin");
        let _ = fs::create_dir_all(&new_mod);
        let _ = fs::write(new_mod.join("Billy.ini"), "[TextureOverride]\nhash=87654321\n");

        let request = ExecuteImportRequest {
            candidate_paths: vec![new_mod.to_string_lossy().to_string()],
            destination_root: temp_dest.to_string_lossy().to_string(),
            copy_mode: true,
        };

        let result = execute_external_import(request).expect("Import should succeed");
        assert_eq!(result.success_count, 1);

        // Verify the canonical Unassigned folder inside Playable Characters exists
        let canonical_unassigned = pc_dir.join("Unassigned");
        assert!(canonical_unassigned.exists(), "Canonical Unassigned must exist in Playable Characters");

        // Verify new mod is in Playable Characters/Unassigned
        assert!(canonical_unassigned.join("New_Billy_Skin").exists(), "New mod must be in canonical Unassigned");

        // Verify orphan mod was migrated from top-level Unassigned to Playable Characters/Unassigned
        assert!(canonical_unassigned.join("Legacy_Mod").exists(), "Orphan mod must be migrated to canonical Unassigned");
        assert!(!top_unassigned.exists(), "Top-level orphan Unassigned folder must be cleaned up");

        let _ = fs::remove_dir_all(&temp_src);
        let _ = fs::remove_dir_all(&temp_dest);
    }

    #[test]
    fn test_scan_external_folder_heterogeneous_xxmi_structure() {
        let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
        let temp_root = std::env::temp_dir().join(format!("zzz_test_xxmi_smart_{}", unique_id));
        let _ = fs::create_dir_all(&temp_root);

        // 1. Direct mod at depth 1
        let caesar_dir = temp_root.join("DISABLED CaesarKing-BottomHeavy(NSFW)");
        let _ = fs::create_dir_all(&caesar_dir);
        let _ = fs::write(caesar_dir.join("CaesarBH.ini"), "[TextureOverrideCaesar]\nhash=11111111\n");
        let _ = fs::write(caesar_dir.join("CaesarBody.buf"), b"buf data");

        // 2. Category container at depth 1 with multiple child mods at depth 2
        let belle_container = temp_root.join("Belle - Vibrant Store Manager");
        let _ = fs::create_dir_all(&belle_container);
        let _ = fs::write(belle_container.join("category.json"), r#"{"character_id":"belle"}"#);

        // Child mod A: single-mod wrapper folder
        let juicier_dir = belle_container.join("DISABLED Juicier Belle");
        let juicier_inner = juicier_dir.join("Juicier Belle");
        let _ = fs::create_dir_all(&juicier_inner);
        let _ = fs::write(juicier_dir.join("Toggles.txt"), "Toggle info");
        let _ = fs::write(juicier_inner.join("Belle.ini"), "[TextureOverrideBelle]\nhash=22222222\n");
        let _ = fs::write(juicier_inner.join("BelleBody.buf"), b"buf data");

        // Child mod B: single-mod wrapper folder with previews
        let bakery_dir = belle_container.join("DISABLED bakery_belle_mod_nsfw_v12");
        let bakery_inner = bakery_dir.join("Bakery-Belle NSFW");
        let bakery_previews = bakery_dir.join("Previews");
        let _ = fs::create_dir_all(&bakery_inner);
        let _ = fs::create_dir_all(&bakery_previews);
        let _ = fs::write(bakery_inner.join("BelleNSFW.ini"), "[TextureOverrideBelleNSFW]\nhash=33333333\n");
        let _ = fs::write(bakery_previews.join("preview.png"), b"fake png");

        // 3. Direct mod with component subfolders at depth 1
        let mod1_dir = temp_root.join("Mod1");
        let mod1_buffer = mod1_dir.join("Buffer");
        let mod1_texture = mod1_dir.join("Texture");
        let _ = fs::create_dir_all(&mod1_buffer);
        let _ = fs::create_dir_all(&mod1_texture);
        let _ = fs::write(mod1_dir.join("Belle.ini"), "[TextureOverrideMod1]\nhash=44444444\n");
        let _ = fs::write(mod1_buffer.join("BelleBody.buf"), b"buffer");
        let _ = fs::write(mod1_texture.join("BelleBody.dds"), b"dds");

        // 4. Ignored system folder
        let system_ui_dir = temp_root.join("zzzzzz_ZZZModManagerUI");
        let _ = fs::create_dir_all(&system_ui_dir);
        let _ = fs::write(system_ui_dir.join("zzzmanager_ui_test.ini"), "[Constants]\n");

        // 5. Empty category folder (0 inis)
        let empty_cat = temp_root.join("Aria - Crispy Delight");
        let _ = fs::create_dir_all(&empty_cat);
        let _ = fs::write(empty_cat.join("category.json"), r#"{"character_id":"aria"}"#);

        // Run scan with default depth (None -> Smart)
        let result = scan_external_folder(&temp_root, None).expect("Scan should succeed");

        // Mixed layout with shallow warnings at depth 1 must recommend Smart (Depth 0)
        assert_eq!(result.recommended_depth, 0, "Heterogeneous directory must recommend Depth 0 (Smart Auto-Detect)");

        let candidate_names: Vec<String> = result.candidates.iter().map(|c| c.folder_name.clone()).collect();
        assert!(candidate_names.contains(&"DISABLED CaesarKing-BottomHeavy(NSFW)".to_string()),
            "Depth 0 must discover top-level Caesar King mod");
        assert!(candidate_names.contains(&"DISABLED Juicier Belle".to_string()),
            "Depth 0 must discover Juicier Belle inside container");
        assert!(candidate_names.contains(&"DISABLED bakery_belle_mod_nsfw_v12".to_string()),
            "Depth 0 must discover bakery belle inside container");
        assert!(candidate_names.contains(&"Mod1".to_string()),
            "Depth 0 must discover Mod1");

        // Must NOT include container, system folder, empty folder, or subcomponents
        assert!(!candidate_names.contains(&"Belle - Vibrant Store Manager".to_string()),
            "Container folder must not be included as a mod");
        assert!(!candidate_names.contains(&"zzzzzz_ZZZModManagerUI".to_string()),
            "System UI manager must be excluded");
        assert!(!candidate_names.contains(&"Aria - Crispy Delight".to_string()),
            "Empty category folder must be excluded");
        assert!(!candidate_names.contains(&"Buffer".to_string()),
            "Subcomponents must not be included as mods");
        assert!(!candidate_names.contains(&"Texture".to_string()),
            "Subcomponents must not be included as mods");

        // Verify aggregated metrics for single-mod wrapper
        let juicier_cand = result.candidates.iter().find(|c| c.folder_name == "DISABLED Juicier Belle").unwrap();
        assert_eq!(juicier_cand.ini_count, 1, "Wrapped mod should reflect aggregated INI count");
        assert_eq!(juicier_cand.buf_count, 1, "Wrapped mod should reflect aggregated BUF count");

        let _ = fs::remove_dir_all(&temp_root);
    }



