//! Unit tests for 3D Mod Viewer.

use super::*;
use super::ini_parser::*;
use std::fs;

    #[test]
    fn test_parse_mod_with_synthetic_mesh() {
        let temp_dir = std::env::temp_dir().join("zmm_test_viewer_synthetic");
        let _ = fs::remove_dir_all(&temp_dir);
        let _ = fs::create_dir_all(&temp_dir);

        let ini_content = r#"
[TextureOverrideHead]
hash = a1b2c3d4
handling = skip
ib = ResourceHeadIB
vb0 = ResourceHeadPosition
drawindexed = 3, 0, 0

[ResourceHeadPosition]
type = Buffer
stride = 40
filename = head_pos.buf

[ResourceHeadIB]
type = Buffer
format = DXGI_FORMAT_R16_UINT
filename = head.ib
"#;
        fs::write(temp_dir.join("mod.ini"), ini_content).unwrap();

        // Create a synthetic vertex buffer with 3 vertices (3 * 40 bytes = 120 bytes)
        let mut buf_data = vec![0u8; 120];
        buf_data[0..4].copy_from_slice(&0.0f32.to_le_bytes());
        buf_data[4..8].copy_from_slice(&0.0f32.to_le_bytes());
        buf_data[8..12].copy_from_slice(&0.0f32.to_le_bytes());

        buf_data[40..44].copy_from_slice(&1.0f32.to_le_bytes());
        buf_data[44..48].copy_from_slice(&0.0f32.to_le_bytes());
        buf_data[48..52].copy_from_slice(&0.0f32.to_le_bytes());

        buf_data[80..84].copy_from_slice(&0.0f32.to_le_bytes());
        buf_data[84..88].copy_from_slice(&1.0f32.to_le_bytes());
        buf_data[88..92].copy_from_slice(&0.0f32.to_le_bytes());

        fs::write(temp_dir.join("head_pos.buf"), buf_data).unwrap();

        // 3 uint16 indices: 0, 1, 2 (6 bytes total)
        let ib_data = vec![0u8, 0, 1, 0, 2, 0];
        fs::write(temp_dir.join("head.ib"), ib_data).unwrap();

        let result = parse_mod(&temp_dir.to_string_lossy(), None, None);
        assert!(result.is_ok(), "Failed to parse synthetic mod: {:?}", result.err());
        let payload = result.unwrap();
        assert_eq!(payload.meshes.len(), 1);
        assert!(!payload.meshes[0].positions.is_empty());

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_retexture_candidate_discovery() {
        let temp_parent = std::env::temp_dir().join("zmm_test_retexture_parent");
        let _ = fs::remove_dir_all(&temp_parent);

        let base_dir = temp_parent.join("BaseMod");
        let retex_dir = temp_parent.join("RetexMod");
        let _ = fs::create_dir_all(&base_dir);
        let _ = fs::create_dir_all(&retex_dir);

        // Base mod has meshes
        let base_ini = r#"
[TextureOverrideHead]
hash = 12345678
match_first_index = 0
ResourcePosition = ResourceHeadPosition

[ResourceHeadPosition]
type = Buffer
stride = 40
filename = head.buf
"#;
        fs::write(base_dir.join("mod.ini"), base_ini).unwrap();
        fs::write(base_dir.join("head.buf"), vec![0u8; 120]).unwrap();

        // Retexture mod only overrides texture (no position buffer)
        let retex_ini = r#"
[TextureOverrideHead]
hash = 12345678
ResourceDiffuse = ResourceHeadDiffuse

[ResourceHeadDiffuse]
filename = skin.png
"#;
        fs::write(retex_dir.join("mod.ini"), retex_ini).unwrap();

        let result = parse_mod(&retex_dir.to_string_lossy(), None, None);
        assert!(result.is_ok());
        let payload = result.unwrap();
        assert!(payload.is_retexture, "Must detect retexture");
        assert!(!payload.base_model_candidates.is_empty(), "Must find BaseMod as candidate");

        let _ = fs::remove_dir_all(&temp_parent);
    }

    #[test]
    fn test_texture_downscaling_logic() {
        let img = image::RgbaImage::new(3000, 3000);
        let scaled = if img.width() > 2048 || img.height() > 2048 {
            image::DynamicImage::ImageRgba8(img).thumbnail(2048, 2048)
        } else {
            image::DynamicImage::ImageRgba8(img)
        };
        assert!(scaled.width() <= 2048);
        assert!(scaled.height() <= 2048);
    }

    #[test]
    fn test_multi_map_and_toggle_parsing() {
        let temp_dir = std::env::temp_dir().join("zmm_test_multimap_toggles");
        let _ = fs::remove_dir_all(&temp_dir);
        let _ = fs::create_dir_all(&temp_dir);

        let ini_content = r#"
[Constants]
global persist $cloth = 1
global persist $jacket = 0

[KeySwapCloth]
key = 5
type = cycle
$cloth = 0, 1

[TextureOverrideBody]
hash = 11223344
handling = skip
ib = ResourceBodyIB
vb0 = ResourceBodyPos
ps-t0 = ResourceBodyDiffuse
ps-t1 = ResourceBodyNormal
ps-t2 = ResourceBodyLight
ps-t3 = ResourceBodyMaterial

if $cloth == 1
drawindexed = 3, 0, 0
endif

[ResourceBodyPos]
type = Buffer
stride = 40
filename = body_pos.buf

[ResourceBodyIB]
type = Buffer
format = DXGI_FORMAT_R16_UINT
filename = body.ib

[ResourceBodyDiffuse]
filename = body_diffuse.png

[ResourceBodyNormal]
filename = body_normal.png

[ResourceBodyLight]
filename = body_light.png

[ResourceBodyMaterial]
filename = body_material.png
"#;
        fs::write(temp_dir.join("mod.ini"), ini_content).unwrap();

        // 3 vertices: 120 bytes
        let mut buf_data = vec![0u8; 120];
        buf_data[0..4].copy_from_slice(&0.0f32.to_le_bytes());
        buf_data[40..44].copy_from_slice(&1.0f32.to_le_bytes());
        buf_data[80..84].copy_from_slice(&0.0f32.to_le_bytes());
        fs::write(temp_dir.join("body_pos.buf"), buf_data).unwrap();

        // 3 indices
        let ib_data = vec![0u8, 0, 1, 0, 2, 0];
        fs::write(temp_dir.join("body.ib"), ib_data).unwrap();

        // Write small 1x1 dummy PNG textures
        let dummy_img = image::RgbaImage::new(1, 1);
        dummy_img.save(temp_dir.join("body_diffuse.png")).unwrap();
        dummy_img.save(temp_dir.join("body_normal.png")).unwrap();
        dummy_img.save(temp_dir.join("body_light.png")).unwrap();
        dummy_img.save(temp_dir.join("body_material.png")).unwrap();

        let result = parse_mod(&temp_dir.to_string_lossy(), None, Some("full"));
        assert!(result.is_ok(), "Failed to parse: {:?}", result.err());
        let payload = result.unwrap();

        // Check toggles
        assert_eq!(payload.toggles.len(), 1);
        let toggle = &payload.toggles[0];
        assert_eq!(toggle.variable, "$cloth");
        assert_eq!(toggle.key.as_deref(), Some("5"));
        assert_eq!(toggle.current_value, 1);
        assert_eq!(toggle.values, vec![0, 1]);

        // Check meshes and conditions
        assert_eq!(payload.meshes.len(), 1);
        let mesh = &payload.meshes[0];
        assert_eq!(mesh.condition.as_deref(), Some("$cloth == 1"));
        assert!(mesh.tex_key.is_some(), "Diffuse key must be present");
        assert!(mesh.normal_key.is_some(), "Normal key must be present");
        assert!(mesh.light_key.is_some(), "Light key must be present");
        assert!(mesh.material_key.is_some(), "Material key must be present");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_compact_vertices_filters_primitive_restarts_and_out_of_bounds() {
        // 4 vertices (x, y, z): 12 floats total
        let positions: Vec<f32> = vec![
            0.0, 0.0, 0.0, // vertex 0
            1.0, 0.0, 0.0, // vertex 1
            0.0, 1.0, 0.0, // vertex 2
            1.0, 1.0, 0.0, // vertex 3
        ];
        let uvs: Vec<f32> = vec![
            0.0, 0.0, // uv 0
            1.0, 0.0, // uv 1
            0.0, 1.0, // uv 2
            1.0, 1.0, // uv 3
        ];

        // 4 triangles:
        // Tri 1: (0, 1, 2) -> valid
        // Tri 2: (0, 65535, 1) -> DX11 primitive restart (0xFFFF), must be discarded
        // Tri 3: (0, 1, 999) -> out-of-bounds index (999 >= 4), must be discarded
        // Tri 4: (1, 2, 3) -> valid
        let raw_indices: Vec<u32> = vec![
            0, 1, 2,
            0, 0xFFFF, 1,
            0, 1, 999,
            1, 2, 3,
        ];

        let result = compact_vertices(&positions, Some(&uvs), &raw_indices, 0);
        assert!(result.is_some(), "Compaction must succeed by keeping valid triangles");

        let (compact_pos, compact_uv, remapped_idx) = result.unwrap();

        // 2 valid triangles = 6 remapped indices
        assert_eq!(remapped_idx.len(), 6);
        // Compacted positions should contain all 4 used vertices (4 * 3 = 12 floats)
        assert_eq!(compact_pos.len(), 12);
        assert_eq!(compact_uv.unwrap().len(), 8);

        // Ensure all remapped indices are within [0, 3]
        for &idx in &remapped_idx {
            assert!(idx < 4, "Remapped index {} must be within [0, 3]", idx);
        }
    }

    #[test]
    fn test_read_positions_and_texcoords_zero_stride_guard() {
        let dummy_data = vec![0u8; 120];

        // Stride 0 must not loop infinitely and must fallback safely
        let pos = read_positions(&dummy_data, 0);
        assert!(!pos.is_empty(), "Zero stride must fallback to DEFAULT_POSITION_STRIDE");

        let uvs = read_texcoords(&dummy_data, 0, 0, UvFormat::Float16);
        assert!(!uvs.is_empty(), "Zero stride must fallback to safe texcoord stride");

        // Index size 0 must not divide by zero panic
        let indices = read_indices(&dummy_data, 0, 10, 0);
        assert!(!indices.is_empty(), "Zero index size must default to INDEX_SIZE_U16");
    }

    #[test]
    fn test_convert_texture_bounded_and_fallback() {
        let temp_dir = std::env::temp_dir().join("zmm_test_texture_guard");
        let _ = fs::create_dir_all(&temp_dir);

        let empty_path = temp_dir.join("empty.png");
        fs::write(&empty_path, []).unwrap();
        assert!(convert_texture_to_data_uri(&empty_path, 512).is_none(), "Zero byte file must return None");

        let valid_img = image::RgbaImage::new(4, 4);
        let valid_path = temp_dir.join("valid.png");
        valid_img.save(&valid_path).unwrap();

        let data_uri = convert_texture_to_data_uri(&valid_path, 512);
        assert!(data_uri.is_some(), "Valid image must decode to data URI");
        assert!(data_uri.unwrap().starts_with("data:image/png;base64,"));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_synthetic_potato_mode_filtering() {
        let temp_dir = std::env::temp_dir().join("zmm_test_potato_mode_synthetic");
        let _ = fs::remove_dir_all(&temp_dir);
        let _ = fs::create_dir_all(&temp_dir);

        let ini_content = r#"
[TextureOverrideBody]
hash = 99887766
handling = skip
ib = ResourceBodyIB
vb0 = ResourceBodyPos
ps-t0 = ResourceBodyDiffuse
ps-t1 = ResourceBodyNormal

[ResourceBodyPos]
type = Buffer
stride = 40
filename = body_pos.buf

[ResourceBodyIB]
type = Buffer
format = DXGI_FORMAT_R16_UINT
filename = body.ib

[ResourceBodyDiffuse]
filename = diff.png

[ResourceBodyNormal]
filename = norm.png
"#;
        fs::write(temp_dir.join("mod.ini"), ini_content).unwrap();

        let mut buf_data = vec![0u8; 120];
        buf_data[0..4].copy_from_slice(&0.0f32.to_le_bytes());
        fs::write(temp_dir.join("body_pos.buf"), buf_data).unwrap();

        let ib_data = vec![0u8, 0, 1, 0, 2, 0];
        fs::write(temp_dir.join("body.ib"), ib_data).unwrap();

        let dummy_img = image::RgbaImage::new(2, 2);
        dummy_img.save(temp_dir.join("diff.png")).unwrap();
        dummy_img.save(temp_dir.join("norm.png")).unwrap();

        // 1. Potato mode: normal map should be filtered out
        let potato_res = parse_mod(&temp_dir.to_string_lossy(), None, Some("potato")).unwrap();
        assert_eq!(potato_res.meshes.len(), 1);
        assert!(potato_res.meshes[0].tex_key.is_some(), "Diffuse must exist in potato mode");
        assert!(potato_res.meshes[0].normal_key.is_none(), "Normal map must be stripped in potato mode");

        // 2. Full mode: normal map should be present
        let full_res = parse_mod(&temp_dir.to_string_lossy(), None, Some("full")).unwrap();
        assert_eq!(full_res.meshes.len(), 1);
        assert!(full_res.meshes[0].tex_key.is_some(), "Diffuse must exist in full mode");
        assert!(full_res.meshes[0].normal_key.is_some(), "Normal map must exist in full mode");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_compute_suggested_tags() {
        let dummy_mesh = MeshData {
            name: "EllenBodyA #1".to_string(),
            positions: "".to_string(),
            uvs: None,
            indices: "".to_string(),
            tex_key: None,
            normal_key: None,
            light_key: None,
            material_key: None,
            component: Some("EllenBodyA".to_string()),
            condition: None,
        };
        let dummy_weapon = MeshData {
            name: "EllenWeapon #1".to_string(),
            positions: "".to_string(),
            uvs: None,
            indices: "".to_string(),
            tex_key: None,
            normal_key: None,
            light_key: None,
            material_key: None,
            component: Some("EllenWeapon".to_string()),
            condition: None,
        };
        let toggles = vec![ViewerToggle {
            id: "t1".to_string(),
            name: "Hair".to_string(),
            key: Some("5".to_string()),
            variable: "$hair".to_string(),
            current_value: 0,
            values: vec![0, 1],
            labels: None,
        }];

        let tags = compute_suggested_tags(false, &[dummy_mesh, dummy_weapon], &HashMap::new(), &toggles);
        assert!(tags.contains(&"Outfit".to_string()));
        assert!(tags.contains(&"Weapon".to_string()));
        assert!(tags.contains(&"Toggle".to_string()));
        assert!(!tags.contains(&"Retexture".to_string()));

        let retexture_tags = compute_suggested_tags(true, &[], &HashMap::from([("t0".to_string(), "".to_string())]), &[]);
        assert_eq!(retexture_tags, vec!["Retexture".to_string()]);
    }

    #[test]
    fn test_parse_mod_with_cancellation_token() {
        use std::sync::atomic::AtomicBool;
        use std::sync::Arc;

        let temp_dir = std::env::temp_dir().join("zmm_test_viewer_cancellation");
        let _ = fs::remove_dir_all(&temp_dir);
        let _ = fs::create_dir_all(&temp_dir);

        let ini_content = r#"
[TextureOverrideHead]
hash = a1b2c3d4
handling = skip
ib = ResourceHeadIB
vb0 = ResourceHeadPosition
drawindexed = 3, 0, 0

[ResourceHeadPosition]
type = Buffer
stride = 40
filename = head_pos.buf

[ResourceHeadIB]
type = Buffer
format = DXGI_FORMAT_R16_UINT
filename = head.ib
"#;
        fs::write(temp_dir.join("mod.ini"), ini_content).unwrap();

        let cancel_token = Arc::new(AtomicBool::new(true)); // Pre-cancelled
        let result = parse_mod_with_cancel(&temp_dir.to_string_lossy(), None, None, Some(&cancel_token));

        assert!(matches!(result, Err(AppError::Cancelled)));
        let _ = fs::remove_dir_all(&temp_dir);
    }


