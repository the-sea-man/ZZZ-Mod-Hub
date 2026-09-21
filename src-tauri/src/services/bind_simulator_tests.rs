use super::*;
use std::fs;

/// Jane Doe's Hair and Arms, trimmed to what the simulator reads. Hair has the two sub-draws
/// (`0` and `16986`) whose mishandling produced the "bald at the front" bug.
const BASE: &str = r#"{
 "components": {
  "Jane Doe|Hair": {
   "agent": "Jane Doe", "component": "Hair", "ib": "3275b812", "vertex_count": 5067,
   "subdraws": [
    {"first_index": 0, "index_count": 16986, "passes": 5},
    {"first_index": 16986, "index_count": 1572, "passes": 11}
   ],
   "buffers": {
    "position_vb": {"hash": "33a09cfe", "stride": 40, "elements": []},
    "texcoord_vb": {"hash": "fa617c9a", "stride": 24, "elements": []},
    "blend_vb":    {"hash": "e42171df", "stride": 32, "elements": []}
   },
   "texture_slots": {"ps-t3": "f7ef1a53", "ps-t5": "9ec4cd4f"},
   "texture_roles": {}
  },
  "Jane Doe|Arms": {
   "agent": "Jane Doe", "component": "Arms", "ib": "294a319a", "vertex_count": 5275,
   "subdraws": [{"first_index": 0, "index_count": 16848, "passes": 4}],
   "buffers": {"blend_vb": {"hash": "d06a9206", "stride": 32, "elements": []}},
   "texture_slots": {"ps-t3": "f7ef1a53"},
   "texture_roles": {}
  }
 }
}"#;

fn baselines() -> VanillaBaselines {
    VanillaBaselines::parse(BASE).expect("fixture baseline must parse")
}

fn mod_with(ini: &str, tag: &str) -> std::path::PathBuf {
    let id = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let dir = std::env::temp_dir().join(format!("zzz_bindsim_{tag}_{id}"));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).expect("temp dir");
    fs::write(dir.join("mod.ini"), ini).expect("write ini");
    dir
}

fn run(ini: &str, tag: &str) -> BindReport {
    let dir = mod_with(ini, tag);
    let report = simulate(&dir, &baselines());
    let _ = fs::remove_dir_all(&dir);
    report
}

fn draw_at<'a>(r: &'a BindReport, component: &str, offset: i64) -> &'a DrawSim {
    r.draws
        .iter()
        .find(|d| d.component.as_deref() == Some(component) && d.first_index == offset)
        .unwrap_or_else(|| panic!("no simulated draw for {component} at {offset}: {:#?}", r.draws))
}

/// A mod that replaces both Hair sub-draws and feeds its own buffers is clean.
#[test]
fn test_a_correctly_wired_mod_reports_every_draw_replaced_and_no_errors() {
    let r = run(
        "[TextureOverrideHairIB]\nhash = 3275b812\nhandling = skip\n\
         [TextureOverrideHairA]\nhash = 3275b812\nmatch_first_index = 0\n\
         ib = ResourceHairAIB\nps-t3 = ResourceMyDiffuse\ndrawindexed = 16932, 0, 0\n\
         [TextureOverrideHairB]\nhash = 3275b812\nmatch_first_index = 16986\n\
         ib = ResourceHairBIB\ndrawindexed = 1626, 0, 0\n\
         [TextureOverrideHairPosition]\nhash = 33a09cfe\nvb0 = ResourceMyPosition\n\
         [TextureOverrideHairBlend]\nhash = e42171df\nvb2 = ResourceMyBlend\n",
        "clean",
    );

    assert_eq!(r.agents, vec!["Jane Doe".to_string()]);
    let first = draw_at(&r, "Hair", 0);
    assert!(first.replaced && first.suppressed);
    assert_eq!(first.ib, Binding::Mod("ResourceHairAIB".into()));
    assert_eq!(first.textures["ps-t3"], Binding::Mod("ResourceMyDiffuse".into()));
    // a slot the mod does not touch stays the game's own, rather than being reported as missing
    assert_eq!(first.textures["ps-t5"], Binding::Vanilla);
    assert_eq!(first.buffers["position_vb"], Binding::Mod("ResourceMyPosition".into()));
    assert_eq!(first.buffers["blend_vb"], Binding::Mod("ResourceMyBlend".into()));

    let second = draw_at(&r, "Hair", 16986);
    assert!(second.replaced, "the second sub-draw is replaced too");
    assert_eq!(second.ib, Binding::Mod("ResourceHairBIB".into()));

    assert!(
        !r.has_errors(),
        "a correctly wired mod must produce no errors, got {:#?}",
        r.findings
    );
}

/// The failure this simulator exists to catch offline. A blanket `handling = skip` suppresses
/// **every** sub-draw of the component, so replacing only the first leaves the second drawing
/// nothing — which in game is a character bald at the front, and previously took a game launch
/// and a frame dump to see.
#[test]
fn test_suppressed_subdraw_with_no_replacement_is_an_error() {
    let r = run(
        "[TextureOverrideHairIB]\nhash = 3275b812\nhandling = skip\n\
         [TextureOverrideHairA]\nhash = 3275b812\nmatch_first_index = 0\n\
         ib = ResourceHairAIB\ndrawindexed = 16932, 0, 0\n",
        "gap",
    );

    let orphan = draw_at(&r, "Hair", 16986);
    assert!(orphan.suppressed, "the blanket skip reaches this offset");
    assert!(!orphan.replaced, "and nothing replaces it");

    let errs: Vec<&Finding> = r
        .findings
        .iter()
        .filter(|f| f.code == "subdraw_suppressed_with_no_replacement")
        .collect();
    assert_eq!(errs.len(), 1, "exactly one gap reported: {:#?}", r.findings);
    assert_eq!(errs[0].severity, Severity::Error);
    assert!(errs[0].message.contains("16986"), "names the offset: {}", errs[0].message);
    assert!(errs[0].message.contains("1572"), "and what would disappear: {}", errs[0].message);

    // the offset that *is* replaced must not be reported
    assert!(draw_at(&r, "Hair", 0).replaced);
}

/// Bindings behind a mod's own command list are reported unresolved, never guessed. Guessing is
/// the failure mode this module exists to remove.
#[test]
fn test_bindings_behind_a_mod_command_list_are_unresolved_not_assumed() {
    let r = run(
        "[TextureOverrideHairIB]\nhash = 3275b812\nrun = CommandListMyHairIB\n\
         [TextureOverrideHairA]\nhash = 3275b812\nmatch_first_index = 0\n\
         run = CommandListMyHairA\n\
         [CommandListMyHairA]\nib = ResourceHidden\ndrawindexed = 100, 0, 0\n",
        "indirect",
    );

    let d = draw_at(&r, "Hair", 0);
    assert!(d.ib.is_unresolved(), "the ib is not claimed to be vanilla: {:?}", d.ib);
    assert!(
        r.findings.iter().any(|f| f.code == "binding_behind_mod_command_list"),
        "and it is reported: {:#?}",
        r.findings
    );

    // The framework's own lists are not indirection - every ZZMI mod runs those.
    let r2 = run(
        "[TextureOverrideHairA]\nhash = 3275b812\nmatch_first_index = 0\n\
         run = CommandListSkinTexture\nib = ResourceHairAIB\ndrawindexed = 16932, 0, 0\n",
        "framework",
    );
    assert_eq!(draw_at(&r2, "Hair", 0).ib, Binding::Mod("ResourceHairAIB".into()));
    assert!(
        !r2.findings.iter().any(|f| f.code == "binding_behind_mod_command_list"),
        "CommandListSkinTexture must not count as unresolved: {:#?}",
        r2.findings
    );
}

/// A mod that feeds a component's buffers but never draws it renders nothing from them — the
/// shape of a half-applied migration.
#[test]
fn test_buffers_bound_without_a_draw_is_reported() {
    let r = run(
        "[TextureOverrideArmsBlend]\nhash = d06a9206\nvb2 = ResourceMyArmsBlend\n",
        "nodraw",
    );
    assert!(
        r.findings.iter().any(|f| f.code == "buffers_bound_but_never_drawn"),
        "expected the warning, got {:#?}",
        r.findings
    );
}

#[test]
fn test_a_mod_touching_nothing_produces_no_draws() {
    let r = run("[TextureOverrideSomethingElse]\nhash = deadbeef\nhandling = skip\n", "untouched");
    assert!(r.draws.is_empty(), "no component is touched, so no draw is simulated");
    assert!(r.findings.is_empty());
    assert_eq!(r.untouched_components, 2, "both fixture components are untouched");
    assert!(r.agents.is_empty());
}

/// `DISABLED*` files are excluded from 3DMigoto's recursive include, so they must not influence
/// the simulation. Reading them has already produced one false diagnosis in this project.
#[test]
fn test_disabled_inis_are_ignored() {
    let dir = mod_with(
        "[TextureOverrideHairA]\nhash = 3275b812\nmatch_first_index = 0\n\
         ib = ResourceLive\ndrawindexed = 16932, 0, 0\n",
        "disabled",
    );
    fs::write(
        dir.join("DISABLED_BACKUP_1_mod.ini.bak"),
        "[TextureOverrideHairA]\nhash = 3275b812\nmatch_first_index = 0\nib = ResourceStale\n",
    )
    .expect("write disabled ini");

    let r = simulate(&dir, &baselines());
    assert_eq!(
        draw_at(&r, "Hair", 0).ib,
        Binding::Mod("ResourceLive".into()),
        "the live INI wins and the DISABLED one is not read"
    );
    let _ = fs::remove_dir_all(&dir);
}

/// Output order must not depend on map iteration, or a golden comparison is meaningless.
#[test]
fn test_draw_order_is_stable() {
    let ini = "[TextureOverrideHairA]\nhash = 3275b812\nmatch_first_index = 0\n\
               ib = ResourceA\ndrawindexed = 1, 0, 0\n\
               [TextureOverrideArmsA]\nhash = 294a319a\nmatch_first_index = 0\n\
               ib = ResourceB\ndrawindexed = 1, 0, 0\n";
    let a = run(ini, "order_a");
    let b = run(ini, "order_b");
    let key = |r: &BindReport| -> Vec<(String, i64)> {
        r.draws
            .iter()
            .map(|d| (d.component.clone().unwrap_or_default(), d.first_index))
            .collect()
    };
    assert_eq!(key(&a), key(&b));
    assert_eq!(
        key(&a),
        vec![("Arms".to_string(), 0), ("Hair".to_string(), 0), ("Hair".to_string(), 16986)],
        "sorted by agent then component, then by offset within a component"
    );
}

/// `handling = skip` plus `draw = from_caller` is the common ZZMI texture-only override: suppress
/// the game's draw, then immediately re-issue it with new textures bound. The geometry is
/// untouched, so this must **not** be reported as a gap.
///
/// Treating only `drawindexed` as a replacement reported two real mods as losing their entire
/// face - found by sweeping the library with this simulator, which is exactly what it is for.
#[test]
fn test_draw_from_caller_counts_as_replacing_the_suppressed_draw() {
    let r = run(
        "[TextureOverrideHairA]\nhash = 3275b812\nmatch_first_index = 0\n\
         handling = skip\nrun = CommandList\\ZZMI\\SetTextures\ndraw = from_caller\n\
         [TextureOverrideHairB]\nhash = 3275b812\nmatch_first_index = 16986\n\
         handling = skip\ndrawindexed = 40*3, first_index, 0\n",
        "fromcaller",
    );

    let a = draw_at(&r, "Hair", 0);
    assert!(a.suppressed && a.replaced, "from_caller puts the draw back");
    assert_eq!(a.ib, Binding::Vanilla, "a texture-only override leaves ib alone, legitimately");
    assert!(
        !a.ib.is_unresolved(),
        "and must not be reported unreadable just because it binds no ib"
    );

    // an expression operand is still a draw
    assert!(draw_at(&r, "Hair", 16986).replaced, "drawindexed with expressions counts");

    assert!(
        !r.has_errors(),
        "neither offset loses geometry, so there must be no error: {:#?}",
        r.findings
    );
}
