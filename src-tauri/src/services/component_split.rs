//! Splitting a legacy mesh component across two modern components.
//!
//! Some ZZZ patches split one character component into two, each with its own
//! renumbered bone palette. Jane Doe's legacy `Hair` component became modern `Hair`
//! (`3275b812`) plus `Arms` (`294a319a`) — they still share textures, which is the
//! giveaway they were once one draw call.
//!
//! A legacy mod authored before the split packs both halves into a single vertex
//! buffer, so migrating its hashes to either component alone loses the other half.
//! The mod has to be registered on BOTH: each component gets its own compacted
//! vertex buffers (blend remapped through that component's bone table), its own
//! index buffer with indices rebased, and its own override sections.
//!
//! Two invariants here were established the hard way, by reading a 3DMigoto frame
//! analysis dump of a mod this code had already "fixed":
//!
//! 1. Which half a draw call belongs to is decided by the **bone palette its
//!    vertices are weighted to**, not by the comment labels modders leave. Labels
//!    are unreliable (typos, other languages); weights are ground truth.
//!
//! 2. Draw sections carrying different `match_first_index` values must never be
//!    merged, even though each costs a `run = CommandListSkinTexture`.
//!    `match_first_index` selects WHICH vanilla sub-draw a section replaces, so
//!    merging two of them leaves the other sub-draw suppressed by `handling = skip`
//!    with nothing drawn in its place. In the Jane case the lost sub-draw was hit
//!    in 5 of 8 passes per frame.

use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;

use byteorder::{LittleEndian, ReadBytesExt, WriteBytesExt};
use regex::Regex;
use std::io::Cursor;
use std::sync::LazyLock;

use crate::services::mod_fixer::{
    get_jane_hair_bone_mappings, get_jane_hand_bone_mappings, parse_ini_sections, IniSectionData,
};

/// The hashes that identify one character component.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ComponentHashes {
    pub ib: &'static str,
    pub position_vb: &'static str,
    pub blend_vb: &'static str,
    pub texcoord_vb: &'static str,
    pub draw_vb: &'static str,
}

/// Which buffer of a component a hash names.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ComponentSlot {
    Ib,
    Position,
    Blend,
    Texcoord,
    Draw,
}

impl ComponentHashes {
    pub fn slot_of(&self, hash: &str) -> Option<ComponentSlot> {
        if hash == self.ib {
            Some(ComponentSlot::Ib)
        } else if hash == self.position_vb {
            Some(ComponentSlot::Position)
        } else if hash == self.blend_vb {
            Some(ComponentSlot::Blend)
        } else if hash == self.texcoord_vb {
            Some(ComponentSlot::Texcoord)
        } else if hash == self.draw_vb {
            Some(ComponentSlot::Draw)
        } else {
            None
        }
    }

    pub fn contains(&self, hash: &str) -> bool {
        self.slot_of(hash).is_some()
    }
}

/// Describes a component the game split in two.
///
/// `primary` keeps the legacy component's migration lineage (what the fixer database's
/// `update_hash` rule points at). `secondary` is the component that was split off.
pub struct ComponentSplitRule {
    pub character: &'static str,
    /// Short label used in generated section names, e.g. "Hair" / "Arms".
    pub primary_label: &'static str,
    pub secondary_label: &'static str,
    /// Every legacy hash set this component has shipped under. Exporters of different
    /// eras used different sets for the same component, so a rule needs all of them.
    pub legacy: &'static [ComponentHashes],
    pub primary: ComponentHashes,
    pub secondary: ComponentHashes,
    pub primary_bones: fn() -> HashMap<u32, u32>,
    pub secondary_bones: fn() -> HashMap<u32, u32>,
}

/// Registry of known component splits. Adding a character is a data-only change,
/// provided its two bone remapping tables are known.
pub static COMPONENT_SPLITS: &[ComponentSplitRule] = &[ComponentSplitRule {
    character: "JaneDoe",
    primary_label: "Hair",
    secondary_label: "Arms",
    legacy: &[
        ComponentHashes {
            ib: "9268a5af",
            position_vb: "e7a3b7dc",
            blend_vb: "8721477f",
            texcoord_vb: "acec29f8",
            draw_vb: "2d06e785",
        },
        ComponentHashes {
            ib: "7b16a708",
            position_vb: "24323bf9",
            blend_vb: "0a10c747",
            texcoord_vb: "257a90d6",
            draw_vb: "5721e4e7",
        },
        // Game 1.1: the texcoord hash changed at 1.2 while the rest of the set stayed put,
        // so this era differs from the one above in that slot alone. A mod can still be
        // carrying it - see `ComponentSplitRule::slot_of`.
        ComponentHashes {
            ib: "7b16a708",
            position_vb: "24323bf9",
            blend_vb: "0a10c747",
            texcoord_vb: "c8ad344e",
            draw_vb: "5721e4e7",
        },
    ],
    primary: ComponentHashes {
        ib: "3275b812",
        position_vb: "33a09cfe",
        blend_vb: "e42171df",
        texcoord_vb: "fa617c9a",
        draw_vb: "74bc0b7f",
    },
    secondary: ComponentHashes {
        ib: "294a319a",
        position_vb: "82e7c056",
        blend_vb: "d06a9206",
        texcoord_vb: "6d482e21",
        draw_vb: "2b5dc947",
    },
    primary_bones: get_jane_hair_bone_mappings,
    secondary_bones: get_jane_hand_bone_mappings,
}];

/// Sub-draw offsets the unmodded game issues for each component index buffer, recovered
/// from 3DMigoto frame analysis dumps (`hunting = 1`, `F8`) of the characters with every
/// mod disabled.
///
/// This matters because `handling = skip` on an index buffer suppresses **every** sub-draw
/// of that component, while a mod's draw sections only replace the offsets that mod
/// happens to use. Skipping more than you replace deletes geometry; skipping less renders
/// the vanilla mesh alongside the mod's. Knowing the real offsets lets the fixer suppress
/// exactly what it replaces and leave the rest to the game.
pub static VANILLA_SUBDRAWS: &[(&str, &[i64])] = &[
    // Jane Doe
    ("3275b812", &[0, 16986]),      // Hair
    ("294a319a", &[0]),             // Arms
    ("ba4255a5", &[0]),             // Body
    ("ef86fc9f", &[0, 7152, 9012]), // Face
    // Remielle Dan
    ("789ae812", &[0, 16590]),      // Hair
    ("28e05a59", &[0, 59094]),      // Body
    ("7fbbcf0d", &[0, 7116, 9402]), // Face
    ("fe9fc31a", &[0]),             // Legs
    ("9004a39a", &[0]),             // Wings
    ("fcbae9a5", &[0]),             // Eyebrows
];

/// The sub-draw offsets the game issues for `ib_hash`, if we have dumped that character.
pub fn vanilla_subdraws(ib_hash: &str) -> Option<&'static [i64]> {
    VANILLA_SUBDRAWS
        .iter()
        .find(|(h, _)| h.eq_ignore_ascii_case(ib_hash))
        .map(|(_, v)| *v)
}

/// Finds a split rule whose legacy component is present in this INI.
///
/// Mods bind the component's buffers in different places depending on the exporter that
/// produced them: some carry `vb0`/`vb2` on the blend-hash section, others on the
/// position-hash section (and then have no blend section at all). Requiring one specific
/// slot would silently skip half of them, so only the index buffer is mandatory.
pub fn find_component_split(ini_content: &str, character: Option<&str>) -> Option<&'static ComponentSplitRule> {
    COMPONENT_SPLITS.iter().find(|rule| {
        let char_ok = character.is_none_or(|c| {
            crate::services::mod_fixer::is_same_character_family(c, rule.character)
        });
        char_ok && detect_source_component(ini_content, rule).is_some()
    })
}

/// Which hash set the mod currently uses for the component that needs splitting.
///
/// A mod may already have had its hashes migrated to the modern component by an earlier
/// fixer run or by one of the community fixers, without ever being split - the hands
/// geometry still sits in the Hair component. Those mods report no pending hash fixes and
/// look "already fixed", yet render the character's hands at her head while the vanilla
/// arms draw underneath. Detecting only the legacy hashes misses that entire class, so
/// match the modern (primary) hashes too and let vertex classification decide.
pub fn detect_source_component(
    ini_content: &str,
    rule: &ComponentSplitRule,
) -> Option<ComponentHashes> {
    let active: HashSet<String> = parse_ini_sections(ini_content)
        .iter()
        .filter_map(|s| s.get_hash())
        .collect();
    let uses = |c: &ComponentHashes| {
        active.contains(c.ib)
            && (active.contains(c.blend_vb) || active.contains(c.position_vb))
    };
    rule.legacy
        .iter()
        .find(|c| uses(c))
        .copied()
        .or_else(|| uses(&rule.primary).then_some(rule.primary))
}

impl ComponentSplitRule {
    /// True when `hash` belongs to any legacy set this component has shipped under.
    pub fn legacy_contains(&self, hash: &str) -> bool {
        self.legacy.iter().any(|c| c.contains(hash))
    }

    /// Which buffer of this component `hash` names, resolved against `detected` first and
    /// then every legacy set the component has shipped under.
    ///
    /// A slot must be resolved across eras, not only within the set that identified the
    /// component, because a mod can mix them: one in the corpus binds the `7b16a708`-era
    /// index, position and blend buffers but a 1.1-era texcoord (`c8ad344e`). Matching only
    /// the detected set left that texcoord section unrecognised, so it was never re-emitted
    /// for the split-off component, which then drew the mod's texture atlas with the vanilla
    /// component's UVs - a mesh with the right textures and unreadable hands.
    pub fn slot_of(&self, detected: &ComponentHashes, hash: &str) -> Option<ComponentSlot> {
        detected
            .slot_of(hash)
            .or_else(|| self.legacy.iter().find_map(|c| c.slot_of(hash)))
    }

    /// The legacy index buffer hashes, for looking up database sub-draw remaps.
    pub fn legacy_ibs(&self) -> impl Iterator<Item = &'static str> + '_ {
        self.legacy.iter().map(|c| c.ib)
    }
}

/// Reads the legacy -> modern sub-draw offset mapping out of the fixer database's
/// `remap_indices` action for the legacy index buffer hash.
pub fn subdraw_remap_from_db(
    fixer_db: &crate::services::mod_fixer::FixerDatabase,
    legacy_ib_hash: &str,
) -> HashMap<i64, i64> {
    let mut out = HashMap::new();
    if let Some(rule) = fixer_db.rules.get(legacy_ib_hash) {
        for action in &rule.actions {
            if action.action_type != "remap_indices" {
                continue;
            }
            if let (Some(from), Some(to)) = (&action.from_indices, &action.to_indices) {
                for (f, t) in from.iter().zip(to.iter()) {
                    out.insert(*f, *t);
                }
            }
        }
    }
    out
}

/// One `drawindexed` inside a legacy draw section, located by line so the surrounding
/// body can be reproduced verbatim.
#[derive(Debug, Clone)]
struct DrawRef {
    line_idx: usize,
    count: usize,
    offset: usize,
    /// Index buffer resource bound at this point in the section.
    ib_resource: String,
    /// Pre-computed index list, for draws we synthesised rather than read from the INI.
    preset: Option<Vec<u32>>,
    /// The section left the range to the game (`drawindexed = auto`, or no `drawindexed` at
    /// all beside its `ib =` binding), so the draw covers the whole bound index buffer and
    /// `count` is not known until that buffer is read.
    whole_ib: bool,
}

/// A legacy draw section, kept whole.
///
/// The body is reproduced line for line rather than rebuilt from parts, because these
/// sections carry state that belongs to specific draws and would be lost by a
/// reconstruction: `if`/`else`/`endif` chains where the else branch is `handling = skip`,
/// and per-draw texture rebinds (`ps-t3`..`ps-t6`) that change the material mid-section.
#[derive(Debug, Clone)]
struct LegacyDrawSection {
    match_first_index: i64,
    lines: Vec<String>,
    draws: Vec<DrawRef>,
}

/// A resource declaration (`[Resource...]`) from the INI.
#[derive(Debug, Clone)]
struct ResourceDecl {
    filename: String,
    stride: usize,
    format: String,
}

/// Names of `[Resource...]` sections that declare no `filename`. These are built at
/// runtime (`X = copy Y`, or a compute shader writing into them, as shape-key mods do),
/// so there is no file on disk to slice.
fn runtime_built_resources(sections: &[IniSectionData]) -> HashSet<String> {
    sections
        .iter()
        .filter(|s| s.header.to_lowercase().starts_with("resource"))
        .filter(|s| section_value(s, "filename").is_none())
        .map(|s| s.header.clone())
        .collect()
}

fn parse_resources(sections: &[IniSectionData]) -> HashMap<String, ResourceDecl> {
    let mut out = HashMap::new();
    for sec in sections {
        if !sec.header.to_lowercase().starts_with("resource") {
            continue;
        }
        let mut filename = None;
        let mut stride = 0usize;
        let mut format = String::new();
        for line in &sec.lines {
            let clean = line.split(';').next().unwrap_or("").split('#').next().unwrap_or("").trim();
            let Some((k, v)) = clean.split_once('=') else { continue };
            let key = k.trim().to_lowercase();
            let val = v.trim().trim_matches('"').trim();
            match key.as_str() {
                "filename" => {
                    filename = Some(val.trim_start_matches(".\\").trim_start_matches("./").to_string())
                }
                "stride" => stride = val.parse().unwrap_or(0),
                "format" => format = val.to_string(),
                _ => {}
            }
        }
        if let Some(f) = filename {
            out.insert(sec.header.clone(), ResourceDecl { filename: f, stride, format });
        }
    }
    out
}

fn resolve_resource<'a>(
    resources: &'a HashMap<String, ResourceDecl>,
    name: &str,
) -> Option<&'a ResourceDecl> {
    resources.iter().find_map(|(k, v)| {
        let bare = k.strip_prefix("Resource").unwrap_or(k);
        if k.eq_ignore_ascii_case(name) || bare.eq_ignore_ascii_case(name) {
            Some(v)
        } else {
            None
        }
    })
}

/// Reads the value of a key from a section, ignoring comments.
fn section_value(sec: &IniSectionData, key: &str) -> Option<String> {
    for line in &sec.lines {
        let clean = line.split(';').next().unwrap_or("").split('#').next().unwrap_or("").trim();
        if let Some((k, v)) = clean.split_once('=') {
            if k.trim().eq_ignore_ascii_case(key) {
                return Some(v.trim().to_string());
            }
        }
    }
    None
}

static DRAW_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)^\s*drawindexed\s*=\s*(\d+)\s*,\s*(\d+)").expect("Valid regex"));

/// `drawindexed = auto` hands the range to the game: it redraws whatever the vanilla
/// sub-draw would have drawn, against the index buffer the section bound.
static DRAW_AUTO_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)^\s*drawindexed\s*=\s*auto\s*$").expect("Valid regex"));

/// Locates every `drawindexed` in a legacy draw section, tracking which index buffer is
/// bound at that point. The body itself is left untouched for verbatim reproduction.
///
/// A section that binds an index buffer is a draw section even with no numeric
/// `drawindexed`, because two common exporter styles leave the range to the game: writing
/// `drawindexed = auto` inline, or writing it once in the component's blanket
/// `handling = skip` section and nothing in the per-sub-draw sections. Treating those as
/// "no draws" is what dropped the second hair sub-draw of every mod built either way.
fn collect_draw_section(sec: &IniSectionData) -> LegacyDrawSection {
    let mut draws = Vec::new();
    let mut lines = sec.lines.clone();
    let mut ib_resource = section_value(sec, "ib").unwrap_or_default();
    let mfi = section_value(sec, "match_first_index")
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(0);

    for (line_idx, line) in sec.lines.iter().enumerate() {
        let trimmed = line.trim();
        if trimmed.starts_with(';') || trimmed.starts_with('#') {
            continue;
        }
        if let Some((k, v)) = trimmed.split_once('=') {
            if k.trim().eq_ignore_ascii_case("ib") {
                ib_resource = v.trim().to_string();
                continue;
            }
        }
        if DRAW_AUTO_RE.is_match(trimmed) {
            // Without a bound index buffer this is the component's blanket suppression
            // section, not a draw.
            if !ib_resource.is_empty() {
                draws.push(DrawRef {
                    line_idx,
                    count: 0,
                    offset: 0,
                    ib_resource: ib_resource.clone(),
                    preset: None,
                    whole_ib: true,
                });
            }
            continue;
        }
        if let Some(caps) = DRAW_RE.captures(trimmed) {
            let count: usize = caps[1].parse().unwrap_or(0);
            // ZZMI exporters emit `drawindexed = 0, 0, 0` placeholders; they draw nothing
            // and their offset is meaningless, so they are not real draws.
            if count == 0 {
                continue;
            }
            draws.push(DrawRef {
                line_idx,
                count,
                offset: caps[2].parse().unwrap_or(0),
                ib_resource: ib_resource.clone(),
                preset: None,
                whole_ib: false,
            });
        }
    }

    // The section bound an index buffer but never said what to draw from it, because the
    // component's `drawindexed = auto` lives in its blanket skip section. The draw is
    // implicit; give it a line of its own so the rewrite has somewhere to put the explicit
    // range the split requires.
    if draws.is_empty() && !ib_resource.is_empty() {
        lines.push("drawindexed = auto".to_string());
        draws.push(DrawRef {
            line_idx: lines.len() - 1,
            count: 0,
            offset: 0,
            ib_resource,
            preset: None,
            whole_ib: true,
        });
    }

    LegacyDrawSection { match_first_index: mfi, lines, draws }
}

fn read_ib(path: &Path, format: &str) -> (Vec<u32>, usize) {
    let bytes = fs::read(path).unwrap_or_default();
    let size = if format.to_uppercase().contains("R16") { 2 } else { 4 };
    let mut out = Vec::with_capacity(bytes.len() / size);
    let mut i = 0;
    while i + size <= bytes.len() {
        let v = if size == 2 {
            u16::from_le_bytes([bytes[i], bytes[i + 1]]) as u32
        } else {
            u32::from_le_bytes([bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]])
        };
        out.push(v);
        i += size;
    }
    (out, size)
}

/// Which half of the split a draw call belongs to, decided from the bone palettes
/// its vertices are actually weighted to.
fn classify_draw(
    verts: &HashSet<u32>,
    blend: &[u8],
    stride: usize,
    primary: &HashMap<u32, u32>,
    secondary: &HashMap<u32, u32>,
) -> Option<bool> {
    let mut p = 0usize;
    let mut s = 0usize;
    for &v in verts {
        let base = v as usize * stride;
        if base + 32 > blend.len() {
            continue;
        }
        let mut wc = Cursor::new(&blend[base..base + 16]);
        let mut bc = Cursor::new(&blend[base + 16..base + 32]);
        for _ in 0..4 {
            let w = wc.read_f32::<LittleEndian>().unwrap_or(0.0);
            let b = bc.read_u32::<LittleEndian>().unwrap_or(0);
            if w <= 1e-6 {
                continue;
            }
            if primary.contains_key(&b) {
                p += 1;
            } else if secondary.contains_key(&b) {
                s += 1;
            }
        }
    }
    if p == 0 && s == 0 {
        None // only shared root bones - renders correctly in either component
    } else {
        Some(p >= s)
    }
}

/// The average position of a set of vertices, or `None` if none could be read.
fn centroid_of(verts: &[u32], pos: &[u8], stride: usize) -> Option<[f64; 3]> {
    let mut sum = [0f64; 3];
    let mut n = 0u64;
    for &v in verts {
        let base = v as usize * stride;
        if base + 12 > pos.len() {
            continue;
        }
        let mut c = Cursor::new(&pos[base..base + 12]);
        for s in sum.iter_mut() {
            *s += c.read_f32::<LittleEndian>().unwrap_or(0.0) as f64;
        }
        n += 1;
    }
    (n > 0).then(|| [sum[0] / n as f64, sum[1] / n as f64, sum[2] / n as f64])
}

fn dist2(a: [f64; 3], b: [f64; 3]) -> f64 {
    (0..3).map(|i| (a[i] - b[i]).powi(2)).sum()
}

/// Splits one draw's triangles between the two components.
///
/// Returns `None` when every triangle lands on the same side, which is the common case and
/// means the draw belongs wholly to one component - the caller then classifies it as a unit
/// and keeps its index buffer intact.
fn partition_draw_triangles(
    idx: &[u32],
    blend: &[u8],
    stride: usize,
    pos: &[u8],
    pstride: usize,
    primary: &HashMap<u32, u32>,
    secondary: &HashMap<u32, u32>,
) -> Option<(Vec<u32>, Vec<u32>)> {
    let mut prim: Vec<u32> = Vec::new();
    let mut sec: Vec<u32> = Vec::new();
    let mut shared: Vec<&[u32]> = Vec::new();
    for tri in idx.chunks_exact(3) {
        let verts: HashSet<u32> = tri.iter().copied().collect();
        match classify_draw(&verts, blend, stride, primary, secondary) {
            Some(true) => prim.extend_from_slice(tri),
            Some(false) => sec.extend_from_slice(tri),
            None => shared.push(tri),
        }
    }
    if prim.is_empty() || sec.is_empty() {
        return None;
    }

    // Triangles weighted only to the shared low bone indices carry no palette evidence, and
    // those indices are NOT the same joint in both palettes - putting them on the wrong side
    // leaves that geometry visibly offset and rotated. Place each one with the half it
    // physically sits on, the same way an unclassifiable whole draw is resolved.
    let c_prim = centroid_of(&prim, pos, pstride);
    let c_sec = centroid_of(&sec, pos, pstride);
    for tri in shared {
        let to_primary = match (c_prim, c_sec, centroid_of(tri, pos, pstride)) {
            (Some(cp), Some(cs), Some(c)) => dist2(c, cp) <= dist2(c, cs),
            // No geometry to compare: keep the larger side, which renders at least as well.
            _ => prim.len() >= sec.len(),
        };
        if to_primary { &mut prim } else { &mut sec }.extend_from_slice(tri);
    }
    Some((prim, sec))
}

/// Remaps bone indices for the given vertices into a compacted buffer.
/// Blend weights are copied byte-for-byte; only the index half is touched.
fn build_component_blend(
    blend: &[u8],
    stride: usize,
    order: &[u32],
    table: &HashMap<u32, u32>,
) -> Vec<u8> {
    let mut out = Vec::with_capacity(order.len() * stride);
    for &v in order {
        let base = v as usize * stride;
        if base + stride > blend.len() {
            out.extend(std::iter::repeat_n(0u8, stride));
            continue;
        }
        let mut vert = blend[base..base + stride].to_vec();
        let indices: Vec<u32> = {
            let mut c = Cursor::new(&vert[16..32]);
            (0..4).map(|_| c.read_u32::<LittleEndian>().unwrap_or(0)).collect()
        };
        let mut w = Cursor::new(&mut vert[16..32]);
        for idx in indices {
            let mapped = match table.get(&idx) {
                Some(m) => *m,
                // shared root bones exist in both palettes; anything else is out of
                // this palette and always carries zero weight, so park it at 0.
                None if idx < 4 => idx,
                None => 0,
            };
            let _ = w.write_u32::<LittleEndian>(mapped);
        }
        out.extend_from_slice(&vert);
    }
    out
}

fn slice_by_order(data: &[u8], stride: usize, order: &[u32]) -> Vec<u8> {
    let mut out = Vec::with_capacity(order.len() * stride);
    for &v in order {
        let base = v as usize * stride;
        if base + stride <= data.len() {
            out.extend_from_slice(&data[base..base + stride]);
        } else {
            out.extend(std::iter::repeat_n(0u8, stride));
        }
    }
    out
}

/// Why a split could not be produced.
///
/// The distinction matters: migrating a legacy component's hashes when it genuinely needs
/// a split points its buffers and its index buffer at two different modern components,
/// which renders the character with one half missing. That is worse than doing nothing,
/// so `Unsupported` tells the caller to leave the component alone. `NotAnalysable` means
/// we could not inspect it at all and the caller should just apply its normal migration.
#[derive(Debug)]
pub enum SplitError {
    Unsupported(String),
    NotAnalysable(String),
}

impl std::fmt::Display for SplitError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SplitError::Unsupported(m) | SplitError::NotAnalysable(m) => write!(f, "{m}"),
        }
    }
}

impl SplitError {
    pub fn is_blocking(&self) -> bool {
        matches!(self, SplitError::Unsupported(_))
    }
}

/// One generated component: buffers plus the draw sections that reference them.
#[derive(Debug)]
pub struct SplitOutput {
    pub files_written: Vec<String>,
    pub new_ini: String,
    pub primary_vertices: usize,
    pub secondary_vertices: usize,
    /// The legacy blend buffer this split consumed. The caller must not also queue a
    /// whole-buffer bone remap for it - the split already remapped it per component.
    pub source_blend: String,
}

/// Executes the split. Writes the per-component buffers next to the existing meshes and
/// returns the rewritten INI.
///
/// `subdraw_remap` maps the legacy component's `match_first_index` values to the primary
/// component's (from the fixer database's `remap_indices` action).
pub fn apply_component_split(
    base_dir: &Path,
    ini_content: &str,
    rule: &ComponentSplitRule,
    subdraw_remap: &HashMap<i64, i64>,
) -> Result<SplitOutput, SplitError> {
    let sections = parse_ini_sections(ini_content);
    let resources = parse_resources(&sections);

    // The component may still carry its legacy hashes, or may already have been migrated
    // to the modern ones without ever being split.
    let source = detect_source_component(ini_content, rule)
        .ok_or_else(|| SplitError::NotAnalysable("component not present in this mod".into()))?;
    let already_migrated = source == rule.primary;

    // Depending on the exporter, vb0/vb2 and the skinning draw live either on the
    // blend-hash section or on the position-hash section, so search every section
    // belonging to the legacy component rather than one specific slot.
    let legacy_secs: Vec<&IniSectionData> = sections
        .iter()
        .filter(|s| s.get_hash().as_deref().is_some_and(|h| rule.slot_of(&source, h).is_some()))
        .collect();

    let find_binding = |slot: &str| -> Option<(String, String)> {
        legacy_secs.iter().find_map(|s| {
            s.lines.iter().find_map(|l| {
                let clean = l.split(';').next().unwrap_or("").trim();
                clean.split_once('=').and_then(|(k, v)| {
                    k.trim()
                        .eq_ignore_ascii_case(slot)
                        .then(|| (v.trim().to_string(), s.get_hash().unwrap_or_default()))
                })
            })
        })
    };

    let (vb2_name, _binding_hash) = find_binding("vb2")
        .ok_or_else(|| SplitError::NotAnalysable("component binds no vb2".into()))?;
    let (vb0_name, _) = find_binding("vb0")
        .ok_or_else(|| SplitError::NotAnalysable("component binds no vb0".into()))?;
    let vb1_name = find_binding("vb1").map(|(n, _)| n);

    let resolve = |name: &str| -> Result<ResourceDecl, SplitError> {
        resolve_resource(&resources, name)
            .cloned()
            .ok_or_else(|| SplitError::NotAnalysable(format!("unresolved resource {name}")))
    };
    // Only the BLEND buffer genuinely has to differ per component - that is where the bone
    // palettes live. Compacting position/texcoord as well is an optimisation, so when they
    // cannot be sliced we fall back to SHARED mode: split just the blend buffer, keep the
    // mod's own position/texcoord, and partition the index buffer without rebasing (the
    // vertex numbering is unchanged). That covers mods whose texcoord sits under a hash we
    // do not recognise, and shape-key mods whose position buffer is produced at runtime by
    // a compute shader and copied in whole - a compacted buffer would be overwritten every
    // frame, but a full-size one is exactly what the mod already feeds.
    let runtime_built = runtime_built_resources(&sections);
    let is_runtime = |name: &str| {
        runtime_built.iter().any(|r| {
            r.eq_ignore_ascii_case(name)
                || r.strip_prefix("Resource").is_some_and(|b| b.eq_ignore_ascii_case(name))
        })
    };
    if is_runtime(&vb2_name) {
        return Err(SplitError::Unsupported(format!(
            "{vb2_name} is built at runtime; its bone palettes cannot be split"
        )));
    }
    let blend_res = resolve(&vb2_name)?;

    let pos_res = resolve(&vb0_name).ok();
    let tex_res = vb1_name.as_deref().and_then(|n| resolve(n).ok());
    let compacting = pos_res.is_some()
        && tex_res.is_some()
        && !is_runtime(&vb0_name)
        && vb1_name.as_deref().is_some_and(|n| !is_runtime(n));

    let blend = fs::read(base_dir.join(&blend_res.filename))
        .map_err(|e| SplitError::NotAnalysable(format!("read blend buffer: {e}")))?;
    let (pos, tex) = if compacting {
        let p = fs::read(base_dir.join(&pos_res.as_ref().unwrap().filename))
            .map_err(|e| SplitError::NotAnalysable(format!("read position buffer: {e}")))?;
        let t = fs::read(base_dir.join(&tex_res.as_ref().unwrap().filename))
            .map_err(|e| SplitError::NotAnalysable(format!("read texcoord buffer: {e}")))?;
        (p, t)
    } else {
        // Positions are still needed to place ambiguous draws geometrically; best effort.
        let p = pos_res
            .as_ref()
            .map(|r| fs::read(base_dir.join(&r.filename)).unwrap_or_default())
            .unwrap_or_default();
        (p, Vec::new())
    };

    let bstride = if blend_res.stride == 0 { 32 } else { blend_res.stride };
    let pstride = pos_res.as_ref().map(|r| r.stride).filter(|s| *s > 0).unwrap_or(40);
    let tstride = tex_res.as_ref().map(|r| r.stride).filter(|s| *s > 0).unwrap_or(24);
    if bstride < 32 {
        return Err(SplitError::NotAnalysable("blend stride must be at least 32".into()));
    }

    let primary_bones = (rule.primary_bones)();
    let secondary_bones = (rule.secondary_bones)();

    // Gather the legacy draw sections (those carrying the legacy IB hash).
    let draw_sections: Vec<LegacyDrawSection> = sections
        .iter()
        .filter(|s| s.get_hash().as_deref() == Some(source.ib))
        .map(collect_draw_section)
        .filter(|s| !s.draws.is_empty())
        .collect();
    if draw_sections.is_empty() {
        return Err(SplitError::NotAnalysable(
            "component has neither draw calls nor an ib binding".into(),
        ));
    }

    let mut ib_cache: HashMap<String, (Vec<u32>, usize)> = HashMap::new();

    // Resolve every draw to an explicit index list, splitting any draw whose triangles span
    // both palettes into one draw per component.
    //
    // A draw is not the unit of a component: a mod that replaces the whole legacy mesh has
    // one draw holding both halves, and classifying it as a unit sends a majority vote's
    // worth of geometry to one side and loses the rest. Partitioning by triangle is what
    // lets those mods split at all.
    let mut draw_sections = draw_sections;
    for sec in draw_sections.iter_mut() {
        let mut expanded: Vec<DrawRef> = Vec::with_capacity(sec.draws.len());
        for d in sec.draws.iter() {
            if d.preset.is_some() {
                expanded.push(d.clone());
                continue;
            }
            let ib = match ib_cache.get(&d.ib_resource) {
                Some(v) => v,
                None => {
                    let decl = resolve_resource(&resources, &d.ib_resource).ok_or_else(|| {
                        SplitError::NotAnalysable(format!(
                            "unresolved index buffer {}",
                            d.ib_resource
                        ))
                    })?;
                    let loaded = read_ib(&base_dir.join(&decl.filename), &decl.format);
                    ib_cache.insert(d.ib_resource.clone(), loaded);
                    &ib_cache[&d.ib_resource]
                }
            };
            // A whole-buffer draw takes every triangle the mod shipped. The vanilla count it
            // inherited through `auto` can be smaller than the buffer (the mod was authored
            // against another game version), which silently clipped its last triangles; the
            // split writes an explicit range, so they come back.
            let end = if d.whole_ib { ib.0.len() - ib.0.len() % 3 } else { d.offset + d.count };
            if end > ib.0.len() {
                return Err(SplitError::NotAnalysable(format!(
                    "draw {}@{} exceeds index buffer {} ({} indices)",
                    d.count, d.offset, d.ib_resource, ib.0.len()
                )));
            }
            let idx: Vec<u32> = ib.0[d.offset..end].to_vec();
            match partition_draw_triangles(
                &idx,
                &blend,
                bstride,
                &pos,
                pstride,
                &primary_bones,
                &secondary_bones,
            ) {
                Some((prim, sec_idx)) => {
                    expanded.push(DrawRef { preset: Some(prim), ..d.clone() });
                    expanded.push(DrawRef { preset: Some(sec_idx), ..d.clone() });
                }
                None => expanded.push(DrawRef { preset: Some(idx), ..d.clone() }),
            }
        }
        sec.draws = expanded;
    }

    // Classify every draw by the bone palette its vertices are weighted to.
    // Key: (section index, draw index) -> is_primary
    let mut indices_of: HashMap<(usize, usize), Vec<u32>> = HashMap::new();
    let mut verdict: HashMap<(usize, usize), bool> = HashMap::new();
    let mut ambiguous: Vec<(usize, usize)> = Vec::new();

    // Every draw carries its resolved index list by now, from the expansion pass above.
    for (si, sec) in draw_sections.iter().enumerate() {
        for (di, d) in sec.draws.iter().enumerate() {
            let idx = d.preset.clone().unwrap_or_default();
            let verts: HashSet<u32> = idx.iter().copied().collect();
            match classify_draw(&verts, &blend, bstride, &primary_bones, &secondary_bones) {
                Some(is_primary) => {
                    verdict.insert((si, di), is_primary);
                }
                None => ambiguous.push((si, di)),
            }
            indices_of.insert((si, di), idx);
        }
    }

    // Some draws are weighted only to the shared low bone indices, so the palettes cannot
    // tell us which half they belong to - a pair of glasses might reference nothing but
    // bone 0. Those indices survive into both components, but index 0 of the Arms palette
    // is a different joint than index 0 of the Hair palette, so guessing wrong leaves the
    // part visibly offset and rotated.
    //
    // Resolve them geometrically instead: a part rides with the body region it physically
    // sits on, so compare its centroid against the centroids of the vertices we did
    // classify. (Index-offset adjacency was tried first and put a pair of glasses on the
    // hands, because the neighbouring draw in the buffer happened to be the hands.)
    if !ambiguous.is_empty() {
        let centroid = |vs: &[u32]| centroid_of(vs, &pos, pstride);
        let collect = |want: bool| -> Vec<u32> {
            verdict
                .iter()
                .filter(|(_, p)| **p == want)
                .filter_map(|(k, _)| indices_of.get(k))
                .flatten()
                .copied()
                .collect()
        };
        let c_primary = centroid(&collect(true));
        let c_secondary = centroid(&collect(false));
        for (si, di) in ambiguous {
            let mine = centroid(indices_of.get(&(si, di)).map(|v| &v[..]).unwrap_or(&[]));
            let is_primary = match (mine, c_primary, c_secondary) {
                (Some(m), Some(p), Some(s)) => dist2(m, p) <= dist2(m, s),
                // Nothing to compare against: keep it with the lineage component.
                _ => true,
            };
            verdict.insert((si, di), is_primary);
        }
    }

    let mut primary_verts: Vec<u32> = Vec::new();
    let mut secondary_verts: Vec<u32> = Vec::new();
    let mut seen_p: HashSet<u32> = HashSet::new();
    let mut seen_s: HashSet<u32> = HashSet::new();
    for (key, idx) in &indices_of {
        let is_primary = verdict.get(key).copied().unwrap_or(true);
        for &v in idx {
            let (list, seen) = if is_primary {
                (&mut primary_verts, &mut seen_p)
            } else {
                (&mut secondary_verts, &mut seen_s)
            };
            if seen.insert(v) {
                list.push(v);
            }
        }
    }
    primary_verts.sort_unstable();
    secondary_verts.sort_unstable();

    // Compacting renumbers vertices, so indices must be rebased through these maps.
    // Shared mode keeps the original numbering, so the maps are identities.
    let (p_map, s_map): (HashMap<u32, u32>, HashMap<u32, u32>) = if compacting {
        (
            primary_verts.iter().enumerate().map(|(i, &v)| (v, i as u32)).collect(),
            secondary_verts.iter().enumerate().map(|(i, &v)| (v, i as u32)).collect(),
        )
    } else {
        (
            primary_verts.iter().map(|&v| (v, v)).collect(),
            secondary_verts.iter().map(|&v| (v, v)).collect(),
        )
    };

    // Write the per-component buffers.
    let mesh_rel = Path::new(&blend_res.filename)
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    let join_rel = |name: &str| {
        if mesh_rel.is_empty() {
            name.to_string()
        } else {
            format!("{mesh_rel}\\{name}")
        }
    };

    let mut files_written = Vec::new();
    let write = |rel: &str, data: &[u8]| -> Result<(), SplitError> {
        let path = base_dir.join(rel);
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        fs::write(&path, data).map_err(|e| SplitError::NotAnalysable(format!("write {rel}: {e}")))?;
        Ok(())
    };

    let pl = rule.primary_label;
    let sl = rule.secondary_label;
    let ch = rule.character;

    let all_verts: Vec<u32> = (0..(blend.len() / bstride) as u32).collect();
    let (p_order, s_order): (&[u32], &[u32]) = if compacting {
        (&primary_verts, &secondary_verts)
    } else {
        (&all_verts, &all_verts)
    };
    let mut names = vec![
        (
            format!("{ch}{pl}SplitBlend.buf"),
            build_component_blend(&blend, bstride, p_order, &primary_bones),
        ),
        (
            format!("{ch}{sl}SplitBlend.buf"),
            build_component_blend(&blend, bstride, s_order, &secondary_bones),
        ),
    ];
    if compacting {
        names.push((format!("{ch}{pl}SplitPosition.buf"), slice_by_order(&pos, pstride, &primary_verts)));
        names.push((format!("{ch}{pl}SplitTexcoord.buf"), slice_by_order(&tex, tstride, &primary_verts)));
        names.push((format!("{ch}{sl}SplitPosition.buf"), slice_by_order(&pos, pstride, &secondary_verts)));
        names.push((format!("{ch}{sl}SplitTexcoord.buf"), slice_by_order(&tex, tstride, &secondary_verts)));
    }
    for (name, data) in &names {
        let rel = join_rel(name);
        write(&rel, data)?;
        files_written.push(rel);
    }

    // Rebased index buffers, one per (component, source index buffer), with each draw's
    // offset rewritten to its position in the compacted buffer.
    struct RebasedIb {
        rel: String,
        res_name: String,
        data: Vec<u8>,
    }
    let mut ibs: Vec<RebasedIb> = Vec::new();
    // (section, draw) -> its offset in the rebased index buffer of its component
    let mut draw_offsets: HashMap<(usize, usize), usize> = HashMap::new();

    let mut keys: Vec<(usize, usize)> = indices_of.keys().copied().collect();
    keys.sort_unstable();
    for key in keys {
        let (si, di) = key;
        let d = &draw_sections[si].draws[di];
        let idx = &indices_of[&key];
        let is_primary = verdict.get(&key).copied().unwrap_or(true);
        let label = if is_primary { pl } else { sl };
        let vmap = if is_primary { &p_map } else { &s_map };
        let src = d.ib_resource.strip_prefix("Resource").unwrap_or(&d.ib_resource).to_string();
        let res_name = format!("Resource{ch}{label}Split{src}");
        let pos_in_ib = match ibs.iter_mut().find(|x| x.res_name == res_name) {
            Some(existing) => {
                let at = existing.data.len() / 4;
                for &v in idx {
                    let _ = existing.data.write_u32::<LittleEndian>(*vmap.get(&v).unwrap_or(&0));
                }
                at
            }
            None => {
                let mut data = Vec::with_capacity(idx.len() * 4);
                for &v in idx {
                    let _ = data.write_u32::<LittleEndian>(*vmap.get(&v).unwrap_or(&0));
                }
                ibs.push(RebasedIb {
                    rel: join_rel(&format!("{ch}{label}Split{src}.ib")),
                    res_name,
                    data,
                });
                0
            }
        };
        draw_offsets.insert(key, pos_in_ib);
    }
    for ib in &ibs {
        write(&ib.rel, &ib.data)?;
        files_written.push(ib.rel.clone());
    }

    // ---- rewrite the INI ----
    let mut out = String::new();

    // Keep every section that isn't part of the legacy component.
    for sec in &sections {
        let is_legacy =
            sec.get_hash().as_deref().is_some_and(|h| rule.slot_of(&source, h).is_some());
        if is_legacy {
            continue;
        }
        if !sec.header.is_empty() {
            out.push_str(&format!("[{}]\r\n", sec.header));
        }
        for line in &sec.lines {
            out.push_str(line.trim_end());
            out.push_str("\r\n");
        }
    }

    // Emit both components.
    for is_primary in [true, false] {
        let (label, hashes, verts) = if is_primary {
            (pl, rule.primary, primary_verts.len())
        } else {
            (sl, rule.secondary, secondary_verts.len())
        };
        out.push_str(&format!(
            "\r\n; [ZZZMODMANAGER SPLIT LEGACY COMPONENT -> {label}]\r\n"
        ));

        // Reproduce every non-draw legacy section verbatim, retargeted to this component.
        // Only the hash, the buffer resource names and the vertex counts are substituted.
        //
        // Synthesising these instead is what produced a T-posing, rotated mesh: the source
        // deliberately binds `vb0` INSIDE its `if DRAW_TYPE == 1` gate, and a rebuilt
        // section hoisted it out, so the position buffer also replaced the one the
        // shadow/depth passes expect. Where a line sits relative to that gate is meaning,
        // not formatting - so copy it rather than re-derive it.
        let mut emitted_ib_skip = false;
        for sec in &sections {
            let Some(h) = sec.get_hash() else { continue };
            let Some(slot_kind) = rule.slot_of(&source, &h) else { continue };
            // draw sections are rewritten separately below
            if sec.lines.iter().any(|l| DRAW_RE.is_match(l.trim())) {
                continue;
            }
            let (slot, new_hash) = match slot_kind {
                ComponentSlot::Ib => {
                    // Emitted separately below, scoped to the sub-draws we actually replace.
                    emitted_ib_skip = true;
                    continue;
                }
                ComponentSlot::Position => ("Position", hashes.position_vb),
                ComponentSlot::Blend => ("Blend", hashes.blend_vb),
                ComponentSlot::Texcoord => ("Texcoord", hashes.texcoord_vb),
                ComponentSlot::Draw => ("VertexLimitRaise", hashes.draw_vb),
            };
            out.push_str(&format!("[TextureOverride{ch}{label}Split{slot}]\r\n"));
            out.push_str(&format!("hash = {new_hash}\r\n"));
            for line in &sec.lines {
                let trimmed = line.trim();
                if trimmed.is_empty() || trimmed.starts_with(';') || trimmed.starts_with('#') {
                    if !trimmed.is_empty() {
                        out.push_str(line.trim_end());
                        out.push_str("\r\n");
                    }
                    continue;
                }
                if trimmed.to_lowercase().starts_with("hash") {
                    continue;
                }
                let indent: String = line.chars().take_while(|c| c.is_whitespace()).collect();
                let rewritten = match trimmed.split_once('=') {
                    Some((k, _)) => match k.trim().to_lowercase().as_str() {
                        "vb0" if compacting => {
                            Some(format!("vb0 = Resource{ch}{label}SplitPosition"))
                        }
                        "vb1" if compacting => {
                            Some(format!("vb1 = Resource{ch}{label}SplitTexcoord"))
                        }
                        "vb2" => Some(format!("vb2 = Resource{ch}{label}SplitBlend")),
                        "draw" if compacting => Some(format!("draw = {verts},0")),
                        "override_vertex_count" if compacting => {
                            Some(format!("override_vertex_count = {verts}"))
                        }
                        _ => None,
                    },
                    None => None,
                };
                match rewritten {
                    Some(r) => out.push_str(&format!("{indent}{r}\r\n")),
                    None => {
                        out.push_str(line.trim_end());
                        out.push_str("\r\n");
                    }
                }
            }
        }

        let _ = emitted_ib_skip;

        // Suppress the vanilla component one sub-draw at a time, covering exactly the
        // offsets this component's draw sections replace. A blanket `handling = skip`
        // would also delete sub-draws we have no geometry for (vanilla Jane's Hair has
        // two and her Face three), while omitting it entirely leaves the vanilla mesh
        // rendering alongside ours.
        let mut replaced: Vec<i64> = draw_sections
            .iter()
            .enumerate()
            .filter(|(si, sec)| {
                (0..sec.draws.len())
                    .any(|di| verdict.get(&(*si, di)).copied().unwrap_or(true) == is_primary)
            })
            .map(|(_, sec)| {
                let mfi = sec.match_first_index;
                if is_primary && !already_migrated {
                    *subdraw_remap.get(&mfi).unwrap_or(&mfi)
                } else if is_primary {
                    mfi
                } else {
                    0
                }
            })
            .collect();
        replaced.sort_unstable();
        replaced.dedup();

        let known = vanilla_subdraws(hashes.ib);
        match known {
            // We know every offset the game issues, so scope each skip to one we replace.
            Some(all) => {
                for off in all.iter().filter(|o| replaced.contains(o)) {
                    out.push_str(&format!(
                        "[TextureOverride{ch}{label}SplitIB{off}]\r\nhash = {}\r\nmatch_first_index = {off}\r\nhandling = skip\r\n",
                        hashes.ib
                    ));
                }
            }
            // Character not dumped yet: fall back to suppressing the whole component,
            // which is what the mod's own author intended for the slot it replaced.
            None => {
                out.push_str(&format!(
                    "[TextureOverride{ch}{label}SplitIB]\r\nhash = {}\r\nhandling = skip\r\n",
                    hashes.ib
                ));
            }
        }

        // One emitted section per source section, so each distinct `match_first_index`
        // keeps its own section. Merging them would leave a vanilla sub-draw suppressed
        // by `handling = skip` with nothing drawn - see the module docs.
        for (si, sec) in draw_sections.iter().enumerate() {
            let mine: Vec<usize> = (0..sec.draws.len())
                .filter(|di| verdict.get(&(si, *di)).copied().unwrap_or(true) == is_primary)
                .collect();
            if mine.is_empty() {
                continue;
            }
            // The primary component inherits the legacy sub-draw offsets through the
            // database remap; the split-off component starts at the first sub-draw.
            let mfi = sec.match_first_index;
            let target_mfi = if is_primary {
                // An already-migrated mod's offsets are modern; remapping again would move
                // them off the sub-draw they correctly target.
                if already_migrated { mfi } else { *subdraw_remap.get(&mfi).unwrap_or(&mfi) }
            } else if mfi == 0 {
                0
            } else {
                // No mapping is known for the split-off component's later sub-draws;
                // emitting a guessed offset would suppress a vanilla draw we cannot replace.
                continue;
            };

            // Reproduce the body line for line. Only `ib =` and `drawindexed` lines are
            // rewritten; conditions, else branches, comments and per-draw texture rebinds
            // are copied through untouched.
            let mut body = String::new();
            for (li, line) in sec.lines.iter().enumerate() {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                let low = trimmed.to_lowercase();
                if low.starts_with("hash")
                    || low.starts_with("match_first_index")
                    || low.starts_with("run = commandlistskintexture")
                {
                    continue; // re-emitted in the header below
                }
                if let Some((k, v)) = trimmed.split_once('=') {
                    if k.trim().eq_ignore_ascii_case("ib") {
                        let src = v.trim().strip_prefix("Resource").unwrap_or(v.trim()).to_string();
                        body.push_str(&format!("ib = Resource{ch}{label}Split{src}\r\n"));
                        continue;
                    }
                }
                if DRAW_RE.is_match(trimmed) || DRAW_AUTO_RE.is_match(trimmed) {
                    // One source line can carry two draws once a mixed draw has been
                    // partitioned, so pick the one that belongs to this component rather
                    // than the first on the line.
                    let on_line = || sec.draws.iter().enumerate().filter(|(_, d)| d.line_idx == li);
                    match on_line().find(|(di, _)| mine.contains(di)) {
                        Some((di, _)) => {
                            let indent: String =
                                line.chars().take_while(|c| c.is_whitespace()).collect();
                            let off = draw_offsets.get(&(si, di)).copied().unwrap_or(0);
                            // The count is what we actually placed in the rebased buffer,
                            // never the source count: partitioning changed it, and `auto`
                            // never stated one.
                            let count = indices_of.get(&(si, di)).map_or(0, |v| v.len());
                            body.push_str(&format!("{indent}drawindexed = {count}, {off}, 0\r\n"));
                        }
                        None if on_line().next().is_some() => {
                            body.push_str(&format!(
                                "; [ZZZMODMANAGER MOVED TO THE OTHER COMPONENT] {trimmed}\r\n"
                            ));
                        }
                        None => {
                            body.push_str(&format!(
                                "; [ZZZMODMANAGER EXPORTER PLACEHOLDER, DRAWS NOTHING] {trimmed}\r\n"
                            ));
                        }
                    }
                    continue;
                }
                body.push_str(line.trim_end());
                body.push_str("\r\n");
            }

            // Every split draw section runs ZZMI's texture command list, even one that already
            // has `checktextureoverride = ps-tN` lines of its own.
            //
            // Those lines are only half the job. ZZMI restores the texture slots after every
            // legacy draw (`CommandListSkin` ends with `post run = CommandList\SlotFix\CleanUp`),
            // but `CommandListCleanUp` is gated on `$saved_main`, and the only thing that sets
            // it is `CommandListSkinTexture`'s `SaveDefault.All`. A section that binds `ps-tN`
            // without it leaves those textures bound for the draws that follow. That leak is
            // survivable while the component is one draw; a split turns it into three.
            let skin_texture = "run = CommandListSkinTexture\r\n";
            let suffix = if si == 0 { String::new() } else { format!("{}", si + 1) };
            out.push_str(&format!(
                "[TextureOverride{ch}{label}SplitDraw{suffix}]\r\nhash = {}\r\nmatch_first_index = {target_mfi}\r\n{skin_texture}{body}",
                hashes.ib
            ));
        }
    }

    // Resource declarations for everything we generated.
    for is_primary in [true, false] {
        let label = if is_primary { pl } else { sl };
        let decls: &[(&str, usize)] = if compacting {
            &[("Position", pstride), ("Blend", bstride), ("Texcoord", tstride)]
        } else {
            &[("Blend", bstride)]
        };
        for &(suffix, stride) in decls {
            out.push_str(&format!(
                "[Resource{ch}{label}Split{suffix}]\r\ntype = Buffer\r\nstride = {stride}\r\nfilename = .\\{}\r\n",
                join_rel(&format!("{ch}{label}Split{suffix}.buf"))
            ));
        }
    }
    for ib in &ibs {
        out.push_str(&format!(
            "[{}]\r\ntype = Buffer\r\nformat = DXGI_FORMAT_R32_UINT\r\nfilename = .\\{}\r\n",
            ib.res_name, ib.rel
        ));
    }

    Ok(SplitOutput {
        files_written,
        new_ini: out,
        primary_vertices: primary_verts.len(),
        secondary_vertices: secondary_verts.len(),
        source_blend: blend_res.filename.clone(),
    })
}

#[cfg(test)]
#[path = "component_split_tests.rs"]
mod tests;
