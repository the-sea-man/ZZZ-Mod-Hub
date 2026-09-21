use super::*;

/// A trimmed slice of the real `vanilla_baselines.json`, with the values that were first
/// measured by hand from Jane Doe's frame dump. If the extractor ever stops reproducing these,
/// every downstream check built on the baseline is reading fiction.
const JANE: &str = r#"{
 "components": {
  "Jane Doe|Hair": {
   "agent": "Jane Doe", "component": "Hair", "ib": "3275b812",
   "index_format": "DXGI_FORMAT_R16_UINT", "vertex_count": 5067,
   "bone_palette_joints": 69,
   "subdraws": [
    {"first_index": 16986, "index_count": 1572, "passes": 11},
    {"first_index": 0, "index_count": 16986, "passes": 5}
   ],
   "buffers": {
    "position_vb": {"hash": "33a09cfe", "stride": 40, "vertex_count": 5067, "elements": []},
    "texcoord_vb": {"hash": "fa617c9a", "stride": 24, "vertex_count": 5067, "elements": [
      {"semantic": "COLOR", "semantic_index": 0, "format": "R8G8B8A8_UNORM", "byte_offset": 0},
      {"semantic": "TEXCOORD", "semantic_index": 0, "format": "R32G32_FLOAT", "byte_offset": 4},
      {"semantic": "TEXCOORD", "semantic_index": 1, "format": "R32G32_FLOAT", "byte_offset": 12}
    ]},
    "blend_vb": {"hash": "e42171df", "stride": 32, "vertex_count": 5067, "elements": []}
   },
   "texture_slots": {"ps-t3": "f7ef1a53", "ps-t4": "ebac056e", "ps-t5": "9ec4cd4f", "ps-t6": "5e34e275"},
   "texture_roles": {"Diffuse": "f7ef1a53", "NormalMap": "ebac056e"}
  },
  "Jane Doe|Arms": {
   "agent": "Jane Doe", "component": "Arms", "ib": "294a319a",
   "vertex_count": 5275, "bone_palette_joints": 61,
   "subdraws": [{"first_index": 0, "index_count": 16848, "passes": 4}],
   "buffers": {"texcoord_vb": {"hash": "6d482e21", "stride": 24, "vertex_count": 5275, "elements": []}},
   "texture_slots": {"ps-t3": "f7ef1a53"},
   "texture_roles": {}
  }
 }
}"#;

fn jane() -> VanillaBaselines {
    VanillaBaselines::parse(JANE).expect("baseline must parse")
}

#[test]
fn test_lookup_by_index_buffer_and_component() {
    let b = jane();
    assert_eq!(b.len(), 2);

    let hair = b.by_ib("3275b812").expect("Hair found by its index buffer");
    assert_eq!(hair.component.as_deref(), Some("Hair"));
    assert_eq!(hair.vertex_count, Some(5067));

    // hashes are matched case-insensitively; dumps and INIs disagree on case constantly
    assert!(b.by_ib("3275B812").is_some(), "index buffer lookup ignores case");
    assert!(b.by_ib("deadbeef").is_none(), "an unknown buffer has no baseline");

    assert_eq!(
        b.by_agent_component("jane doe", "arms").and_then(|c| c.vertex_count),
        Some(5275)
    );
}

/// The offsets are the whole reason this table exists: `handling = skip` suppresses every
/// sub-draw of a component, so a fixer that does not know they are `0` and `16986` either
/// deletes geometry or leaves the vanilla mesh rendering alongside the mod's.
#[test]
fn test_subdraw_offsets_are_sorted_and_deduplicated() {
    let b = jane();
    // deliberately stored out of order in the fixture
    assert_eq!(b.by_ib("3275b812").unwrap().subdraw_offsets(), vec![0, 16986]);
    assert_eq!(b.by_ib("294a319a").unwrap().subdraw_offsets(), vec![0]);
}

#[test]
fn test_strides_and_texture_slots() {
    let b = jane();
    let hair = b.by_ib("3275b812").unwrap();
    assert_eq!(hair.stride("position_vb"), Some(40));
    assert_eq!(hair.stride("texcoord_vb"), Some(24));
    assert_eq!(hair.stride("blend_vb"), Some(32));
    assert_eq!(hair.stride("nonexistent_vb"), None);

    // Hair and Arms share their textures - the giveaway that they were once one draw call
    assert_eq!(hair.slot_of_texture("f7ef1a53"), Some(3));
    assert_eq!(b.by_ib("294a319a").unwrap().slot_of_texture("f7ef1a53"), Some(3));
    assert_eq!(hair.slot_of_texture("9ec4cd4f"), Some(5));
    assert_eq!(hair.slot_of_texture("deadbeef"), None);

    assert_eq!(hair.bone_palette_joints, Some(69), "matches the hand-built hair table");
    assert_eq!(
        b.by_ib("294a319a").unwrap().bone_palette_joints,
        Some(61),
        "matches the hand-built arms table"
    );
}

/// A mod's texcoord buffer must be wide enough for every attribute the game reads. One mod in
/// the corpus supplies 12 bytes where the layout needs 20 — COLOR plus one UV pair, with no room
/// for the second UV set the shader samples. `minimum_stride` is how that is detected without
/// guessing at the layout.
#[test]
fn test_minimum_stride_comes_from_the_layout_not_the_declared_stride() {
    let b = jane();
    let tex = &b.by_ib("3275b812").unwrap().buffers["texcoord_vb"];
    // COLOR(4) at 0, TEXCOORD(8) at 4, TEXCOORD1(8) at 12 -> last element ends at 20
    assert_eq!(tex.minimum_stride(), Some(20));
    assert_eq!(tex.stride, Some(24), "the game's stride has 4 bytes of tail beyond that");
    assert!(
        tex.minimum_stride().unwrap() < tex.stride.unwrap(),
        "a complete buffer may be narrower than the game's stride, but never narrower than this"
    );

    // no layout recorded -> no claim made, rather than a wrong one
    assert_eq!(b.by_ib("3275b812").unwrap().buffers["position_vb"].minimum_stride(), None);
}

#[test]
fn test_format_widths() {
    let w = |f: &str| VertexElement {
        semantic: "X".into(),
        semantic_index: 0,
        format: f.into(),
        byte_offset: 0,
    }
    .format_bytes();
    assert_eq!(w("R32G32B32_FLOAT"), 12);
    assert_eq!(w("R32G32_FLOAT"), 8);
    assert_eq!(w("R8G8B8A8_UNORM"), 4);
    assert_eq!(w("R32G32B32A32_UINT"), 16);
    assert_eq!(w("R16G16_FLOAT"), 4);
    assert_eq!(w("SOMETHING_UNKNOWN"), 0, "an unknown format claims nothing");
}

#[test]
fn test_malformed_json_is_an_error_not_a_panic() {
    assert!(VanillaBaselines::parse("{").is_err());
    // an empty document is valid and simply covers nothing, so callers fall back
    let empty = VanillaBaselines::parse("{}").expect("an empty baseline is legal");
    assert!(empty.is_empty());
    assert!(empty.by_ib("3275b812").is_none());
}

/// The shipped baseline must parse and must still carry the values that were first measured by
/// hand from the dumps. Embedded at compile time, so this is a contract on the real data rather
/// than on a fixture: if the extractor changes shape, or a regenerated file loses a field, this
/// fails instead of every downstream check quietly reading `None`.
#[test]
fn test_shipped_baseline_parses_and_matches_measured_values() {
    const SHIPPED: &str = include_str!("../../../src/vanilla_baselines.json");
    let b = VanillaBaselines::parse(SHIPPED).expect("the shipped baseline must parse");
    assert!(b.len() >= 10, "expected both dumped Agents, got {} components", b.len());

    // Jane Doe, measured by hand and independently reproduced by the extractor.
    let hair = b.by_ib("3275b812").expect("Jane Hair");
    assert_eq!(hair.vertex_count, Some(5067));
    assert_eq!(hair.subdraw_offsets(), vec![0, 16986]);
    assert_eq!(hair.stride("texcoord_vb"), Some(24));
    assert_eq!(hair.stride("position_vb"), Some(40));
    assert_eq!(hair.bone_palette_joints, Some(69), "hair palette: bones 4..=68");
    assert_eq!(hair.slot_of_texture("f7ef1a53"), Some(3), "Diffuse in ps-t3");
    assert_eq!(hair.slot_of_texture("9ec4cd4f"), Some(5), "LightMap in ps-t5");

    let arms = b.by_ib("294a319a").expect("Jane Arms");
    assert_eq!(arms.vertex_count, Some(5275));
    assert_eq!(arms.subdraw_offsets(), vec![0]);
    assert_eq!(arms.bone_palette_joints, Some(61), "arms palette: bones 0..=60");
    // the shared material is the giveaway that Hair and Arms were once one draw call
    assert_eq!(arms.slot_of_texture("f7ef1a53"), Some(3));

    let body = b.by_ib("ba4255a5").expect("Jane Body");
    assert_eq!(body.stride("texcoord_vb"), Some(32), "the Body reads a wider texcoord than Hair");

    // Remielle Dan, the second dumped Agent - proves the extractor is not Jane-specific.
    let r_hair = b.by_ib("789ae812").expect("Remielle Hair");
    assert_eq!(r_hair.subdraw_offsets(), vec![0, 16590]);
    assert_eq!(b.by_ib("28e05a59").unwrap().subdraw_offsets(), vec![0, 59094]);
    assert_eq!(
        b.by_ib("7fbbcf0d").unwrap().subdraw_offsets(),
        vec![0, 7116, 9402],
        "a three-sub-draw component"
    );
}

/// Every offset the hardcoded `VANILLA_SUBDRAWS` table carries must be present in the baseline,
/// so replacing the table with a lookup cannot silently lose an Agent.
#[test]
fn test_baseline_covers_the_hardcoded_subdraw_table() {
    const SHIPPED: &str = include_str!("../../../src/vanilla_baselines.json");
    let b = VanillaBaselines::parse(SHIPPED).unwrap();
    for (ib, offsets) in crate::services::component_split::VANILLA_SUBDRAWS {
        let c = b
            .by_ib(ib)
            .unwrap_or_else(|| panic!("hardcoded {ib} has no baseline - regenerate the file"));
        assert_eq!(
            c.subdraw_offsets(),
            offsets.to_vec(),
            "offsets disagree for {ib} ({:?})",
            c.component
        );
    }
}
