use super::*;
use byteorder::{LittleEndian, WriteBytesExt};
use std::fs;

/// Builds a synthetic legacy Jane Doe mod whose single Hair-slot buffer packs both
/// halves of the modern split: vertices 0-59 weighted to hand-palette bone 4,
/// vertices 60-99 weighted to hair-palette bone 26.
fn make_fixture(dir: &std::path::Path) -> String {
    let meshes = dir.join("Meshes");
    fs::create_dir_all(&meshes).unwrap();

    let mut blend = Vec::new();
    for v in 0..100u32 {
        // weights: first slot 1.0, rest 0 - only the first bone index is meaningful
        blend.write_f32::<LittleEndian>(1.0).unwrap();
        for _ in 0..3 {
            blend.write_f32::<LittleEndian>(0.0).unwrap();
        }
        let bone = if v < 60 { 4u32 } else { 26u32 };
        blend.write_u32::<LittleEndian>(bone).unwrap();
        for _ in 0..3 {
            blend.write_u32::<LittleEndian>(0).unwrap();
        }
    }
    fs::write(meshes.join("JaneHairBlend.buf"), &blend).unwrap();

    // positions/texcoords carry a per-vertex marker so slicing can be verified
    let mut pos = Vec::new();
    for v in 0..100u32 {
        pos.write_u32::<LittleEndian>(v).unwrap();
        pos.extend(std::iter::repeat_n(0u8, 36));
    }
    fs::write(meshes.join("JaneHairPosition.buf"), &pos).unwrap();
    let mut tex = Vec::new();
    for v in 0..100u32 {
        tex.write_u32::<LittleEndian>(v + 1000).unwrap();
        tex.extend(std::iter::repeat_n(0u8, 20));
    }
    fs::write(meshes.join("JaneHairTexcoord.buf"), &tex).unwrap();

    // identity index buffer 0..99
    let mut iba = Vec::new();
    for v in 0..100u32 {
        iba.write_u32::<LittleEndian>(v).unwrap();
    }
    fs::write(meshes.join("JaneHairA.ib"), &iba).unwrap();
    // second index buffer covering the last 10 hair vertices
    let mut ibb = Vec::new();
    for v in 90..100u32 {
        ibb.write_u32::<LittleEndian>(v).unwrap();
    }
    fs::write(meshes.join("JaneHairB.ib"), &ibb).unwrap();

    r#"[TextureOverrideJaneHairBlend]
hash = 8721477f
handling = skip
vb2 = ResourceJaneHairBlend
if DRAW_TYPE == 1
	vb0 = ResourceJaneHairPosition
	draw = 100,0
endif
$active = 1
[TextureOverrideJaneHairTexcoord]
hash = acec29f8
vb1 = ResourceJaneHairTexcoord
[TextureOverrideJaneHairVertexLimitRaise]
hash = 2d06e785
override_vertex_count = 100
override_byte_stride = 96
[TextureOverrideJaneHairIB]
hash = 9268a5af
handling = skip
[TextureOverrideJaneHairA]
hash = 9268a5af
match_first_index = 0
run = CommandListSkinTexture
ib = ResourceJaneHairAIB
	; GlovesBase
	if $swapvarGloves == 1
	    drawindexed = 60, 0, 0
	endif
	; HairLong
	drawindexed = 40, 60, 0
[TextureOverrideJaneHairB]
hash = 9268a5af
match_first_index = 33780
run = CommandListSkinTexture
ib = ResourceJaneHairBIB
	; HaairShort
	drawindexed = 10, 0, 0
[TextureOverrideJaneBodyIB]
hash = ba4255a5
handling = skip
[ResourceJaneHairBlend]
type = Buffer
stride = 32
filename = .\Meshes\JaneHairBlend.buf
[ResourceJaneHairPosition]
type = Buffer
stride = 40
filename = .\Meshes\JaneHairPosition.buf
[ResourceJaneHairTexcoord]
type = Buffer
stride = 24
filename = .\Meshes\JaneHairTexcoord.buf
[ResourceJaneHairAIB]
type = Buffer
format = DXGI_FORMAT_R32_UINT
filename = .\Meshes\JaneHairA.ib
[ResourceJaneHairBIB]
type = Buffer
format = DXGI_FORMAT_R32_UINT
filename = .\Meshes\JaneHairB.ib
"#
    .to_string()
}

fn temp_dir(tag: &str) -> std::path::PathBuf {
    let id = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let p = std::env::temp_dir().join(format!("zzz_split_{tag}_{id}"));
    let _ = fs::remove_dir_all(&p);
    fs::create_dir_all(&p).unwrap();
    p
}

fn remap() -> HashMap<i64, i64> {
    [(0i64, 0i64), (33780, 16986)].into_iter().collect()
}

#[test]
fn test_find_component_split_detects_jane_legacy_hair() {
    let dir = temp_dir("detect");
    let ini = make_fixture(&dir);
    let rule = find_component_split(&ini, Some("JaneDoe")).expect("must detect Jane split");
    assert_eq!(rule.character, "JaneDoe");
    assert_eq!(rule.primary.ib, "3275b812");
    assert_eq!(rule.secondary.ib, "294a319a");
    // a mod without the legacy hashes must not match
    assert!(find_component_split("[TextureOverrideX]\nhash = deadbeef\n", Some("JaneDoe")).is_none());
    // another character must not pick up Jane's rule
    assert!(find_component_split(&ini, Some("Belle")).is_none());
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn test_split_partitions_vertices_by_bone_palette() {
    let dir = temp_dir("partition");
    let ini = make_fixture(&dir);
    let rule = find_component_split(&ini, Some("JaneDoe")).unwrap();
    let out = apply_component_split(&dir, &ini, rule, &remap()).expect("split must succeed");

    // hand-palette verts (0-59) -> Arms, hair-palette verts (60-99) -> Hair
    assert_eq!(out.secondary_vertices, 60, "Arms must take the 60 hand-weighted vertices");
    assert_eq!(out.primary_vertices, 40, "Hair must take the 40 hair-weighted vertices");

    let m = dir.join("Meshes");
    assert_eq!(fs::read(m.join("JaneDoeArmsSplitPosition.buf")).unwrap().len(), 60 * 40);
    assert_eq!(fs::read(m.join("JaneDoeHairSplitPosition.buf")).unwrap().len(), 40 * 40);
    assert_eq!(fs::read(m.join("JaneDoeArmsSplitTexcoord.buf")).unwrap().len(), 60 * 24);
    assert_eq!(fs::read(m.join("JaneDoeHairSplitTexcoord.buf")).unwrap().len(), 40 * 24);

    // the per-vertex markers prove the correct slice went to each component
    let hp = fs::read(m.join("JaneDoeHairSplitPosition.buf")).unwrap();
    assert_eq!(u32::from_le_bytes(hp[0..4].try_into().unwrap()), 60);
    let ht = fs::read(m.join("JaneDoeHairSplitTexcoord.buf")).unwrap();
    assert_eq!(u32::from_le_bytes(ht[0..4].try_into().unwrap()), 1060);
    let ap = fs::read(m.join("JaneDoeArmsSplitPosition.buf")).unwrap();
    assert_eq!(u32::from_le_bytes(ap[0..4].try_into().unwrap()), 0);

    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn test_split_remaps_bones_per_palette_and_preserves_weights() {
    let dir = temp_dir("bones");
    let ini = make_fixture(&dir);
    let rule = find_component_split(&ini, Some("JaneDoe")).unwrap();
    apply_component_split(&dir, &ini, rule, &remap()).unwrap();
    let m = dir.join("Meshes");

    // Arms: legacy bone 4 -> hand table -> 0
    let ab = fs::read(m.join("JaneDoeArmsSplitBlend.buf")).unwrap();
    assert_eq!(u32::from_le_bytes(ab[16..20].try_into().unwrap()), 0, "hand bone 4 -> 0");
    // Hair: legacy bone 26 -> hair table -> 4
    let hb = fs::read(m.join("JaneDoeHairSplitBlend.buf")).unwrap();
    assert_eq!(u32::from_le_bytes(hb[16..20].try_into().unwrap()), 4, "hair bone 26 -> 4");

    // weights must be byte-identical to the source for every vertex
    let src = fs::read(m.join("JaneHairBlend.buf")).unwrap();
    for v in 0..60usize {
        assert_eq!(&ab[v * 32..v * 32 + 16], &src[v * 32..v * 32 + 16], "arms weights vertex {v}");
    }
    for v in 0..40usize {
        let s = (60 + v) * 32;
        assert_eq!(&hb[v * 32..v * 32 + 16], &src[s..s + 16], "hair weights vertex {v}");
    }
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn test_split_rebases_index_buffers_to_compacted_vertices() {
    let dir = temp_dir("rebase");
    let ini = make_fixture(&dir);
    let rule = find_component_split(&ini, Some("JaneDoe")).unwrap();
    apply_component_split(&dir, &ini, rule, &remap()).unwrap();
    let m = dir.join("Meshes");

    // Hair's ibA draw covered source verts 60..99 -> rebased to 0..39
    let hia = fs::read(m.join("JaneDoeHairSplitJaneHairAIB.ib")).unwrap();
    let idx: Vec<u32> = hia.chunks(4).map(|c| u32::from_le_bytes(c.try_into().unwrap())).collect();
    assert_eq!(idx.len(), 40);
    assert_eq!(idx[0], 0, "source vertex 60 becomes 0");
    assert_eq!(idx[39], 39, "source vertex 99 becomes 39");
    assert!(idx.iter().all(|&i| i < 40), "every hair index must be inside the hair buffer");

    // Arms kept verts 0..59, so its rebased indices are unchanged
    let aia = fs::read(m.join("JaneDoeArmsSplitJaneHairAIB.ib")).unwrap();
    let aidx: Vec<u32> = aia.chunks(4).map(|c| u32::from_le_bytes(c.try_into().unwrap())).collect();
    assert_eq!(aidx.len(), 60);
    assert!(aidx.iter().all(|&i| i < 60), "every arms index must be inside the arms buffer");

    // ibB covered verts 90..99 -> 30..39 in the hair buffer
    let hib = fs::read(m.join("JaneDoeHairSplitJaneHairBIB.ib")).unwrap();
    let bidx: Vec<u32> = hib.chunks(4).map(|c| u32::from_le_bytes(c.try_into().unwrap())).collect();
    assert_eq!(bidx, (30..40).collect::<Vec<u32>>());

    let _ = fs::remove_dir_all(&dir);
}

/// The invariant this whole module exists to protect. Frame analysis of a "fixed" mod
/// showed that merging two draw sections which carry different `match_first_index`
/// values leaves one vanilla sub-draw suppressed by `handling = skip` with nothing
/// drawn in its place - in that case the lost sub-draw was hit in 5 of 8 passes.
#[test]
fn test_distinct_match_first_index_never_merged_and_is_remapped() {
    let dir = temp_dir("mfi");
    let ini = make_fixture(&dir);
    let rule = find_component_split(&ini, Some("JaneDoe")).unwrap();
    let out = apply_component_split(&dir, &ini, rule, &remap()).unwrap();
    let new_ini = out.new_ini;

    let hair_draw_sections: Vec<&str> = new_ini
        .lines()
        .filter(|l| l.starts_with("[TextureOverrideJaneDoeHairSplitDraw"))
        .collect();
    assert_eq!(
        hair_draw_sections.len(),
        2,
        "the two legacy sub-draws must stay in two sections, got {hair_draw_sections:?}"
    );

    // the legacy offsets must be translated through the database remap
    assert!(new_ini.contains("match_first_index = 0"), "sub-draw 0 must be present");
    assert!(
        new_ini.contains("match_first_index = 16986"),
        "sub-draw 33780 must be remapped to 16986, got:\n{new_ini}"
    );
    assert!(
        !new_ini.contains("match_first_index = 33780"),
        "the legacy offset must not survive"
    );

    // every draw section must still request the texture slot fix
    let skin = new_ini.matches("run = CommandListSkinTexture").count();
    assert!(skin >= 3, "each draw section keeps its SkinTexture call, got {skin}");

    let _ = fs::remove_dir_all(&dir);
}

/// Some exporters put `vb0`/`vb2` and the skinning draw on the POSITION-hash section and
/// ship no blend section at all, and their draw bodies carry `if/else/endif` chains plus
/// per-draw texture rebinds. Reconstructing such a body from parts silently drops that
/// state, so it has to be reproduced line for line.
fn make_position_layout_fixture(dir: &std::path::Path) -> String {
    let meshes = dir.join("Meshes");
    fs::create_dir_all(&meshes).unwrap();
    let mut blend = Vec::new();
    for v in 0..100u32 {
        blend.write_f32::<LittleEndian>(1.0).unwrap();
        for _ in 0..3 {
            blend.write_f32::<LittleEndian>(0.0).unwrap();
        }
        blend.write_u32::<LittleEndian>(if v < 60 { 4 } else { 26 }).unwrap();
        for _ in 0..3 {
            blend.write_u32::<LittleEndian>(0).unwrap();
        }
    }
    fs::write(meshes.join("JaneHairBlend.buf"), &blend).unwrap();
    fs::write(meshes.join("JaneHairPosition.buf"), vec![7u8; 100 * 40]).unwrap();
    fs::write(meshes.join("JaneHairTexcoord.buf"), vec![9u8; 100 * 24]).unwrap();
    let mut iba = Vec::new();
    for v in 0..100u32 {
        iba.write_u32::<LittleEndian>(v).unwrap();
    }
    fs::write(meshes.join("JaneHairA.ib"), &iba).unwrap();

    r#"[TextureOverrideJaneHairPosition]
hash = e7a3b7dc
handling = skip
vb0 = ResourceJaneHairPosition
vb2 = ResourceJaneHairBlend
draw = 100,0
$active = 1
[TextureOverrideJaneHairTexcoord]
hash = acec29f8
vb1 = ResourceJaneHairTexcoord
[TextureOverrideJaneHairVertexLimitRaise]
hash = 2d06e785
; override_vertex_count = 526
; override_byte_stride = 92
[TextureOverrideJaneHairIB]
hash = 9268a5af
handling = skip
[TextureOverrideJaneHairA]
hash = 9268a5af
match_first_index = 0
run = CommandListSkinTexture
ib = ResourceJaneHairAIB
ps-t4 = ResourceJaneHairANormalMap
; placeholder emitted by the exporter
drawindexed = 0, 0, 0
	; Gloves
	if $swapvarg == 0
	drawindexed = 60, 0, 0
	else
	handling = skip
	endif
	; XBatWings.Head
	ps-t3 = ResourceJaneBodyADiffuse
	ps-t5 = ResourceJaneBodyALightMap
	if $detail == 0
	drawindexed = 40, 60, 0
	else
	handling = skip
	endif
[ResourceJaneHairBlend]
type = Buffer
stride = 32
filename = .\Meshes\JaneHairBlend.buf
[ResourceJaneHairPosition]
type = Buffer
stride = 40
filename = .\Meshes\JaneHairPosition.buf
[ResourceJaneHairTexcoord]
type = Buffer
stride = 24
filename = .\Meshes\JaneHairTexcoord.buf
[ResourceJaneHairAIB]
type = Buffer
format = DXGI_FORMAT_R32_UINT
filename = .\Meshes\JaneHairA.ib
"#
    .to_string()
}

#[test]
fn test_position_bound_layout_is_detected_and_split() {
    let dir = temp_dir("poslayout");
    let ini = make_position_layout_fixture(&dir);
    let rule = find_component_split(&ini, Some("JaneDoe"))
        .expect("a mod binding on the position hash with no blend section must still match");
    let out = apply_component_split(&dir, &ini, rule, &remap()).expect("split must succeed");
    assert_eq!(out.secondary_vertices, 60);
    assert_eq!(out.primary_vertices, 40);

    let ini2 = out.new_ini;
    // bound on the modern POSITION hashes, because that is where the source bound them
    assert!(ini2.contains("hash = 33a09cfe"), "hair binds on modern position hash");
    assert!(ini2.contains("hash = 82e7c056"), "arms binds on modern position hash");
    // the source had no DRAW_TYPE gate, so the generated draw must not invent one
    assert!(ini2.contains("draw = 40,0") && ini2.contains("draw = 60,0"));
    assert!(!ini2.contains("DRAW_TYPE"), "must not add gating the source did not have");
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn test_body_state_is_preserved_verbatim() {
    let dir = temp_dir("verbatim");
    let ini = make_position_layout_fixture(&dir);
    let rule = find_component_split(&ini, Some("JaneDoe")).unwrap();
    let ini2 = apply_component_split(&dir, &ini, rule, &remap()).unwrap().new_ini;

    // if/else/endif chains survive, including the `handling = skip` else branch
    assert_eq!(ini2.matches("if $swapvarg == 0").count(), 2, "condition kept in both components");
    assert_eq!(ini2.matches("if $detail == 0").count(), 2);
    assert!(ini2.contains("else"), "else branches preserved");
    // per-draw texture rebinds must not be dropped - reconstructing bodies loses these
    assert_eq!(ini2.matches("ps-t3 = ResourceJaneBodyADiffuse").count(), 2);
    assert_eq!(ini2.matches("ps-t5 = ResourceJaneBodyALightMap").count(), 2);
    assert_eq!(ini2.matches("ps-t4 = ResourceJaneHairANormalMap").count(), 2);
    // comment labels survive
    assert!(ini2.contains("; Gloves") && ini2.contains("; XBatWings.Head"));
    // the exporter's zero-count placeholder must not survive as an ACTIVE draw
    let active_zero = ini2
        .lines()
        .any(|l| !l.trim_start().starts_with(';') && l.contains("drawindexed = 0,"));
    assert!(!active_zero, "zero-count placeholder must be commented out, not issued");
    assert_eq!(ini2.matches("EXPORTER PLACEHOLDER").count(), 2);
    // each component keeps only its own draw, the other is commented out
    assert_eq!(ini2.matches("MOVED TO THE OTHER COMPONENT").count(), 2);
    let _ = fs::remove_dir_all(&dir);
}

/// Shape-key mods blend several position variants in a compute shader and copy the whole
/// result into the position buffer every frame, so there is no file to slice and a
/// compacted per-component buffer would be overwritten. The split must refuse in a way
/// that tells the caller to leave the component's hashes alone: migrating them would aim
/// the buffers and the index buffer at two different modern components, which is what
/// made such a mod render bald with invisible hands.
/// Only the BLEND buffer genuinely has to differ per component - that is where the bone
/// palettes live. So a shape-key mod, whose position buffer a compute shader rebuilds and
/// copies in whole every frame, is still fixable: fall back to SHARED mode, which splits
/// only the blend buffer, keeps the mod's own position/texcoord, and partitions the index
/// buffer without rebasing. Compacting is an optimisation, not a correctness requirement.
#[test]
fn test_runtime_built_position_falls_back_to_shared_mode() {
    let dir = temp_dir("shapekey");
    let ini = make_fixture(&dir).replace(
        "[ResourceJaneHairPosition]\ntype = Buffer\nstride = 40\nfilename = .\\Meshes\\JaneHairPosition.buf",
        "[ResourceJaneHairPosition]\n\n[CommandListComputeShapeKeys]\nResourceJaneHairPosition = copy ResourceJaneHairPositionBase",
    );
    let rule = find_component_split(&ini, Some("JaneDoe")).unwrap();
    let out = apply_component_split(&dir, &ini, rule, &remap())
        .expect("a runtime-built position buffer must not block the split any more");
    let ini2 = out.new_ini;

    // the mod keeps feeding its own runtime-built position buffer
    assert!(ini2.contains("vb0 = ResourceJaneHairPosition"), "mod's own position kept:\n{ini2}");
    assert!(!ini2.contains("SplitPosition"), "no compacted position buffer is generated");
    // only the blend buffers are written, one per palette
    let m = dir.join("Meshes");
    assert!(m.join("JaneDoeHairSplitBlend.buf").exists());
    assert!(m.join("JaneDoeArmsSplitBlend.buf").exists());
    assert!(!m.join("JaneDoeHairSplitPosition.buf").exists());
    let _ = fs::remove_dir_all(&dir);
}

/// Shared mode must classify exactly as compacting mode does - only the buffer handling
/// differs. A mod with no texcoord section takes this path.
#[test]
fn test_shared_mode_classifies_the_same_as_compacting() {
    let dir = temp_dir("sharedclass");
    let ini = make_fixture(&dir);
    // drop the texcoord section and its resource, forcing shared mode
    let ini = ini
        .replace("[TextureOverrideJaneHairTexcoord]\nhash = acec29f8\nvb1 = ResourceJaneHairTexcoord\n", "")
        .replace("[ResourceJaneHairTexcoord]\ntype = Buffer\nstride = 24\nfilename = .\\Meshes\\JaneHairTexcoord.buf\n", "");
    assert!(!ini.contains("vb1"), "fixture must bind no vb1");

    let rule = find_component_split(&ini, Some("JaneDoe")).unwrap();
    let out = apply_component_split(&dir, &ini, rule, &remap()).expect("shared-mode split");
    assert_eq!(out.secondary_vertices, 60, "hand-weighted verts still go to Arms");
    assert_eq!(out.primary_vertices, 40, "hair-weighted verts still go to Hair");
    assert!(out.new_ini.contains("hash = 294a319a"), "Arms component must be emitted");
    let _ = fs::remove_dir_all(&dir);
}

/// The blend buffer is the one thing the split must rewrite, so if *that* is built at
/// runtime there is nothing we can do and the caller must withhold its migrations.
#[test]
fn test_runtime_built_blend_still_blocks() {
    let dir = temp_dir("shapekeyblend");
    let ini = make_fixture(&dir).replace(
        "[ResourceJaneHairBlend]\ntype = Buffer\nstride = 32\nfilename = .\\Meshes\\JaneHairBlend.buf",
        "[ResourceJaneHairBlend]\n\n[CommandListComputeShapeKeys]\nResourceJaneHairBlend = copy ResourceJaneHairBlendBase",
    );
    let rule = find_component_split(&ini, Some("JaneDoe")).unwrap();
    let err = apply_component_split(&dir, &ini, rule, &remap())
        .expect_err("a runtime-built blend buffer cannot be split");
    assert!(err.is_blocking(), "must block the caller's migration, got: {err}");
    assert!(format!("{err}").contains("runtime"), "message should explain why: {err}");
    let _ = fs::remove_dir_all(&dir);
}

/// A mod we cannot inspect at all is a different case: the caller should fall back to its
/// normal migration instead of assuming a split was required.
#[test]
fn test_unanalysable_component_does_not_block_migration() {
    let dir = temp_dir("unanalysable");
    let ini = make_fixture(&dir).replace(
        "filename = .\\Meshes\\JaneHairBlend.buf",
        "filename = .\\Meshes\\DoesNotExist.buf",
    );
    let rule = find_component_split(&ini, Some("JaneDoe")).unwrap();
    let err = apply_component_split(&dir, &ini, rule, &remap()).expect_err("missing buffer");
    assert!(!err.is_blocking(), "missing files must not block migration, got: {err}");
    let _ = fs::remove_dir_all(&dir);
}

/// Where a binding sits relative to `if DRAW_TYPE == 1` is meaning, not formatting.
/// The source binds `vb0` INSIDE the gate so the position buffer only replaces the main
/// colour pass; a rebuilt section that hoisted it out also replaced the buffer the
/// shadow/depth passes read, which rendered the mesh in bind pose and rotated.
#[test]
fn test_binding_sections_keep_their_draw_type_gating() {
    let dir = temp_dir("gating");
    let ini = make_fixture(&dir);
    let rule = find_component_split(&ini, Some("JaneDoe")).unwrap();
    let ini2 = apply_component_split(&dir, &ini, rule, &remap()).unwrap().new_ini;

    for label in ["Hair", "Arms"] {
        let sec = ini2
            .split(&format!("[TextureOverrideJaneDoe{label}SplitBlend]"))
            .nth(1)
            .unwrap_or_else(|| panic!("{label} blend section missing"))
            .split("\n[")
            .next()
            .unwrap();
        let gate = sec.find("if DRAW_TYPE == 1").unwrap_or_else(|| panic!("{label} lost its gate"));
        let vb0 = sec.find("vb0 =").unwrap_or_else(|| panic!("{label} lost its vb0 binding"));
        let vb2 = sec.find("vb2 =").unwrap_or_else(|| panic!("{label} lost its vb2 binding"));
        assert!(vb0 > gate, "{label}: vb0 must stay INSIDE the DRAW_TYPE gate, got:\n{sec}");
        assert!(vb2 < gate, "{label}: vb2 must stay outside the gate, as authored:\n{sec}");
        assert!(sec.contains("$active = 1"), "{label}: section state preserved");
    }
    let _ = fs::remove_dir_all(&dir);
}

/// `handling = skip` suppresses EVERY sub-draw of a component, but our draw sections only
/// replace the offsets the legacy mod used. Vanilla Jane's Hair has two sub-draws (0 and
/// 16986) and her Face three, so a blanket skip deletes geometry we never replace, while
/// no skip at all leaves the vanilla mesh rendering alongside ours. Each skip must be
/// scoped to an offset we actually draw into.
#[test]
fn test_suppression_is_scoped_to_the_subdraws_we_replace() {
    let dir = temp_dir("scoped");
    let ini = make_fixture(&dir);
    let rule = find_component_split(&ini, Some("JaneDoe")).unwrap();
    let ini2 = apply_component_split(&dir, &ini, rule, &remap()).unwrap().new_ini;

    // Hair replaces both vanilla sub-draws, so both get their own scoped skip.
    assert!(ini2.contains("[TextureOverrideJaneDoeHairSplitIB0]"), "hair sub-draw 0 suppressed");
    assert!(ini2.contains("[TextureOverrideJaneDoeHairSplitIB16986]"), "hair sub-draw 16986 suppressed");
    // Arms has a single vanilla sub-draw at 0.
    assert!(ini2.contains("[TextureOverrideJaneDoeArmsSplitIB0]"), "arms sub-draw 0 suppressed");
    // No blanket skip may remain on a component we only partially replace.
    assert!(
        !ini2.contains("[TextureOverrideJaneDoeHairSplitIB]\r\nhash"),
        "blanket hair suppression must be gone"
    );
    for h in ["3275b812", "294a319a"] {
        let skips = ini2.matches(&format!("hash = {h}")).count();
        assert!(skips >= 2, "component {h} needs scoped skip(s) plus its draw section");
    }
    assert_eq!(
        vanilla_subdraws("3275b812"),
        Some(&[0i64, 16986][..]),
        "Jane hair's dumped sub-draw offsets"
    );
    assert_eq!(vanilla_subdraws("ef86fc9f"), Some(&[0i64, 7152, 9012][..]), "Jane face has three");
    assert_eq!(vanilla_subdraws("deadbeef"), None, "undumped characters fall back");
    let _ = fs::remove_dir_all(&dir);
}

/// A mod with no `handling = skip` on its component index buffer must get one, or the
/// vanilla mesh renders alongside the mod's - the "everything is doubled" symptom.
#[test]
fn test_missing_ib_suppression_is_synthesised() {
    let dir = temp_dir("nosuppress");
    let ini = make_fixture(&dir)
        .replace("[TextureOverrideJaneHairIB]\nhash = 9268a5af\nhandling = skip\n", "");
    let rule = find_component_split(&ini, Some("JaneDoe")).unwrap();
    let ini2 = apply_component_split(&dir, &ini, rule, &remap()).unwrap().new_ini;
    for h in ["3275b812", "294a319a"] {
        let after = ini2.split(&format!("hash = {h}")).nth(1).unwrap_or("");
        assert!(
            ini2.matches(&format!("hash = {h}")).count() >= 2 || after.contains("handling = skip"),
            "component {h} must end up with a handling = skip suppression"
        );
    }
    assert!(ini2.contains("SplitIB"), "a suppression section is synthesised when absent");
    let _ = fs::remove_dir_all(&dir);
}

/// A draw weighted only to the shared low bone indices (a pair of glasses referencing
/// nothing but bone 0) cannot be placed by palette. Index 0 survives into both components
/// but means a different joint in each, so a wrong guess leaves the part offset and
/// rotated. It must be placed by where it physically sits, not by which draw happens to
/// neighbour it in the index buffer - that heuristic put glasses on the hands.
#[test]
fn test_ambiguous_draw_is_placed_by_geometry_not_buffer_adjacency() {
    let dir = temp_dir("ambiguous");
    let meshes = dir.join("Meshes");
    fs::create_dir_all(&meshes).unwrap();

    // 0-39 hands (hand palette, low in space), 40-79 head (hair palette, high in space),
    // 80-99 glasses (bone 0 only, sitting up at head height).
    let mut blend = Vec::new();
    let mut pos = Vec::new();
    for v in 0..100u32 {
        blend.write_f32::<LittleEndian>(1.0).unwrap();
        for _ in 0..3 {
            blend.write_f32::<LittleEndian>(0.0).unwrap();
        }
        let bone = if v < 40 { 4u32 } else if v < 80 { 26u32 } else { 0u32 };
        blend.write_u32::<LittleEndian>(bone).unwrap();
        for _ in 0..3 {
            blend.write_u32::<LittleEndian>(0).unwrap();
        }
        let y: f32 = if v < 40 { 1.0 } else { 10.0 };
        pos.write_f32::<LittleEndian>(0.0).unwrap();
        pos.write_f32::<LittleEndian>(y).unwrap();
        pos.write_f32::<LittleEndian>(0.0).unwrap();
        pos.extend(std::iter::repeat_n(0u8, 28));
    }
    fs::write(meshes.join("JaneHairBlend.buf"), &blend).unwrap();
    fs::write(meshes.join("JaneHairPosition.buf"), &pos).unwrap();
    fs::write(meshes.join("JaneHairTexcoord.buf"), vec![0u8; 100 * 24]).unwrap();
    let mut ib = Vec::new();
    for v in 0..100u32 {
        ib.write_u32::<LittleEndian>(v).unwrap();
    }
    fs::write(meshes.join("JaneHairA.ib"), &ib).unwrap();

    // Draw order puts the glasses immediately after the hands, so buffer adjacency would
    // wrongly pull them into Arms; geometry must win.
    let ini = r#"[TextureOverrideJaneHairBlend]
hash = 8721477f
handling = skip
vb2 = ResourceJaneHairBlend
if DRAW_TYPE == 1
	vb0 = ResourceJaneHairPosition
	draw = 100,0
endif
[TextureOverrideJaneHairTexcoord]
hash = acec29f8
vb1 = ResourceJaneHairTexcoord
[TextureOverrideJaneHairIB]
hash = 9268a5af
handling = skip
[TextureOverrideJaneHairA]
hash = 9268a5af
match_first_index = 0
run = CommandListSkinTexture
ib = ResourceJaneHairAIB
	; Head
	drawindexed = 40, 40, 0
	; Hands
	drawindexed = 40, 0, 0
	; Glasses
	drawindexed = 20, 80, 0
[ResourceJaneHairBlend]
type = Buffer
stride = 32
filename = .\Meshes\JaneHairBlend.buf
[ResourceJaneHairPosition]
type = Buffer
stride = 40
filename = .\Meshes\JaneHairPosition.buf
[ResourceJaneHairTexcoord]
type = Buffer
stride = 24
filename = .\Meshes\JaneHairTexcoord.buf
[ResourceJaneHairAIB]
type = Buffer
format = DXGI_FORMAT_R32_UINT
filename = .\Meshes\JaneHairA.ib
"#;
    let rule = find_component_split(ini, Some("JaneDoe")).unwrap();
    let out = apply_component_split(&dir, ini, rule, &remap()).unwrap();

    // head (40) + glasses (20) ride together on Hair; only the hands go to Arms
    assert_eq!(out.primary_vertices, 60, "glasses must join the head in Hair");
    assert_eq!(out.secondary_vertices, 40, "Arms takes only the hands");
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn test_split_emits_both_components_and_drops_legacy_hashes() {
    let dir = temp_dir("wiring");
    let ini = make_fixture(&dir);
    let rule = find_component_split(&ini, Some("JaneDoe")).unwrap();
    let out = apply_component_split(&dir, &ini, rule, &remap()).unwrap();
    let ini2 = out.new_ini;

    for legacy in ["8721477f", "acec29f8", "2d06e785", "9268a5af"] {
        assert!(!ini2.contains(legacy), "legacy hash {legacy} must be gone");
    }
    // both modern components fully wired
    for h in ["3275b812", "e42171df", "fa617c9a", "74bc0b7f",
              "294a319a", "d06a9206", "6d482e21", "2b5dc947"] {
        assert!(ini2.contains(h), "modern hash {h} must be present");
    }
    // untouched sections survive
    assert!(ini2.contains("ba4255a5"), "body section must be preserved");
    // each component skins only its own vertices
    assert!(ini2.contains("draw = 40,0"), "hair skins 40 verts");
    assert!(ini2.contains("draw = 60,0"), "arms skins 60 verts");
    assert!(ini2.contains("override_vertex_count = 40"));
    assert!(ini2.contains("override_vertex_count = 60"));
    // the authored VLR stride is carried over, not invented
    assert!(ini2.contains("override_byte_stride = 96"), "authored stride preserved");
    // toggle conditions preserved
    assert!(ini2.contains("if $swapvarGloves == 1"), "toggle condition preserved");

    let _ = fs::remove_dir_all(&dir);
}

/// Builds a fixture in the style used by mods that let the game supply the draw range:
/// each sub-draw section binds its own index buffer and its own material, and the range is
/// either `drawindexed = auto` or absent entirely (stated once in the component's blanket
/// suppression section). Both styles ship in the wild.
///
/// `slot_checks` picks how the section rebinds textures: ZZMI's command list, or its own
/// `checktextureoverride` lines.
fn make_auto_fixture(dir: &std::path::Path, slot_checks: bool) -> String {
    let full = make_fixture(dir);
    let resources = &full[full.find("[ResourceJaneHairBlend]").unwrap()..];
    let rebind = if slot_checks {
        "checktextureoverride = ps-t4\r\n"
    } else {
        "run = CommandListSkinTexture\r\n"
    };
    format!(
        "[TextureOverrideJaneHairBlend]\r\n\
hash = 8721477f\r\n\
handling = skip\r\n\
vb2 = ResourceJaneHairBlend\r\n\
vb0 = ResourceJaneHairPosition\r\n\
draw = 100,0\r\n\
[TextureOverrideJaneHairTexcoord]\r\n\
hash = acec29f8\r\n\
vb1 = ResourceJaneHairTexcoord\r\n\
[TextureOverrideJaneHairVertexLimitRaise]\r\n\
hash = 2d06e785\r\n\
[TextureOverrideJaneHairIB]\r\n\
hash = 9268a5af\r\n\
handling = skip\r\n\
drawindexed = auto\r\n\
[TextureOverrideJaneHairA]\r\n\
hash = 9268a5af\r\n\
match_first_index = 0\r\n\
{rebind}\
ib = ResourceJaneHairAIB\r\n\
ps-t4 = ResourceJaneHairANormalMap\r\n\
[TextureOverrideJaneHairB]\r\n\
hash = 9268a5af\r\n\
match_first_index = 33780\r\n\
{rebind}\
ib = ResourceJaneHairBIB\r\n\
ps-t4 = ResourceJaneHairANormalMap\r\n\
drawindexed = auto\r\n\
{resources}"
    )
}

/// The failure this locks out: both hard mods in the corpus state their draw range as
/// `auto`, or state it only in the component's blanket skip section. Requiring a numeric
/// `drawindexed` classed their sub-draw sections as "not draws", so the whole component fell
/// through to a single synthesised draw that took the first index buffer it found and
/// rebuilt the section body from scratch. That silently dropped the second sub-draw (the
/// character went bald at the front) and every per-sub-draw texture binding with it (the
/// hair rendered with the wrong material and the hands with none).
#[test]
fn test_auto_range_keeps_every_subdraw_and_its_material() {
    let dir = temp_dir("autorange");
    let ini = make_auto_fixture(&dir, false);
    let rule = &COMPONENT_SPLITS[0];
    let out = apply_component_split(&dir, &ini, rule, &remap()).expect("split succeeds");

    // Both hair sub-draws survive, the later one remapped onto its modern offset.
    assert!(
        out.new_ini.contains("[TextureOverrideJaneDoeHairSplitDraw]"),
        "first hair sub-draw emitted:\n{}",
        out.new_ini
    );
    assert!(
        out.new_ini.contains("[TextureOverrideJaneDoeHairSplitDraw2]"),
        "second hair sub-draw emitted:\n{}",
        out.new_ini
    );
    assert!(out.new_ini.contains("match_first_index = 16986"), "sub-draw 33780 remapped");
    assert!(!out.new_ini.contains("match_first_index = 33780"), "legacy offset not left behind");

    // Its index buffer is written, not dropped in favour of the first one.
    assert!(
        out.files_written.iter().any(|f| f.contains("HairSplitJaneHairBIB")),
        "second sub-draw's index buffer written, got {:?}",
        out.files_written
    );

    // The per-sub-draw material survives on both halves.
    assert_eq!(
        out.new_ini.matches("ps-t4 = ResourceJaneHairANormalMap").count(),
        3,
        "each emitted draw section keeps its material:\n{}",
        out.new_ini
    );

    // `auto` cannot survive a split - the counts are no longer the vanilla ones.
    assert!(!out.new_ini.contains("drawindexed = auto"), "auto resolved to explicit ranges");

    let _ = fs::remove_dir_all(&dir);
}

/// The mixed sub-draw must be cut by triangle, not voted on as a unit. Classifying a whole
/// draw that holds both halves sends a majority's worth of geometry to one component and
/// loses the rest.
#[test]
fn test_mixed_auto_draw_is_partitioned_by_triangle_without_loss() {
    let dir = temp_dir("autopartition");
    let ini = make_auto_fixture(&dir, false);
    let rule = &COMPONENT_SPLITS[0];
    let out = apply_component_split(&dir, &ini, rule, &remap()).expect("split succeeds");

    // Fixture: vertices 0-59 on the hand palette, 60-99 on the hair palette. `JaneHairA.ib`
    // is the identity 0..99 and so spans both; `JaneHairB.ib` is hair only.
    let counts: Vec<usize> = Regex::new(r"drawindexed = (\d+),")
        .unwrap()
        .captures_iter(&out.new_ini)
        .map(|c| c[1].parse().unwrap())
        .collect();
    // 99 + 9: each index buffer is consumed whole, rounded down to whole triangles.
    assert_eq!(
        counts.iter().sum::<usize>(),
        108,
        "every legacy triangle is placed exactly once, got {counts:?}"
    );
    assert!(
        counts.contains(&60),
        "the 60 hand-palette vertices form one contiguous draw, got {counts:?}"
    );
    // Neither half may be empty, or the split lost a component.
    assert!(out.primary_vertices > 0 && out.secondary_vertices > 0);
    // 99, not 100: the last vertex falls in the partial triangle both buffers drop.
    assert_eq!(
        out.primary_vertices + out.secondary_vertices,
        99,
        "vertices are partitioned, not duplicated: {} + {}",
        out.primary_vertices,
        out.secondary_vertices
    );

    let _ = fs::remove_dir_all(&dir);
}

/// ZZMI restores the texture slots after every legacy draw, but only for sections that ran
/// `CommandListSkinTexture` — `CommandListCleanUp` is gated on the `$saved_main` flag that
/// its `SaveDefault.All` sets. A section binding `ps-tN` without it leaves those textures
/// bound for the draws that follow, so every split draw section gets it, including one that
/// already carries `checktextureoverride` lines of its own (those are only the check half).
#[test]
fn test_every_split_draw_section_runs_the_texture_command_list() {
    let dir = temp_dir("slotchecks");
    let rule = &COMPONENT_SPLITS[0];

    for own_slot_checks in [true, false] {
        let out = apply_component_split(
            &dir,
            &make_auto_fixture(&dir, own_slot_checks),
            rule,
            &remap(),
        )
        .expect("split succeeds");
        assert_eq!(
            out.new_ini.matches("run = CommandListSkinTexture").count(),
            3,
            "all three emitted draw sections save and restore their slots              (own_slot_checks = {own_slot_checks}):
{}",
            out.new_ini
        );
    }

    // The author's own slot checks are still carried through, not replaced.
    let own = apply_component_split(&dir, &make_auto_fixture(&dir, true), rule, &remap())
        .expect("split succeeds");
    assert!(own.new_ini.contains("checktextureoverride = ps-t4"), "slot checks preserved");

    let _ = fs::remove_dir_all(&dir);
}
