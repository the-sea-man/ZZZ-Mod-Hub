//! Predicts what 3DMigoto will bind at each draw the game issues, without launching the game.
//!
//! The question this answers — *given this mod's INIs, what actually ends up bound at the draw
//! the game makes?* — previously needed a game launch, a frame-analysis dump and a human to read
//! it back. Six causes were proposed for one broken mod across that loop and five were disproved;
//! the fixes were cheap, the verification was the entire cost.
//!
//! It is not a renderer and not a reimplementation of 3DMigoto. It evaluates the constructs the
//! mod corpus actually uses — hash matching, `match_first_index`, `handling = skip`, and direct
//! slot assignments — against the measured [`VanillaBaselines`], and reports anything it cannot
//! evaluate as [`Binding::Unresolved`] rather than guessing. Guessing is the failure mode this
//! exists to remove, so an honest "unknown" is the point, not a shortcoming.
//!
//! Known gap, deliberately: bindings that sit behind a mod's own `run = CommandList...` are
//! reported unresolved. Following that indirection needs condition/variant handling and is
//! ticket 007.

use std::collections::BTreeMap;
use std::path::Path;

use serde::Serialize;

use crate::core::vanilla_baseline::{ComponentBaseline, VanillaBaselines};
use crate::services::mod_fixer::{parse_ini_sections, IniSectionData};

/// What ends up in one slot at one draw.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub enum Binding {
    /// The game's own resource: the mod does not touch this slot here.
    Vanilla,
    /// The mod supplies a resource, named as the INI names it.
    Mod(String),
    /// The mod routes this through its own command list, which we do not follow yet.
    Unresolved(String),
}

impl Binding {
    pub fn is_mod(&self) -> bool {
        matches!(self, Binding::Mod(_))
    }
    pub fn is_unresolved(&self) -> bool {
        matches!(self, Binding::Unresolved(_))
    }
}

/// One vanilla draw, and what the mod does to it.
#[derive(Debug, Clone, Serialize)]
pub struct DrawSim {
    pub agent: Option<String>,
    pub component: Option<String>,
    pub ib_hash: String,
    pub first_index: i64,
    pub index_count: i64,
    /// `true` when a mod section suppresses the game's draw here (`handling = skip`).
    pub suppressed: bool,
    /// `true` when a mod section issues its own `drawindexed` for this offset.
    pub replaced: bool,
    pub ib: Binding,
    /// Keyed by buffer role (`position_vb`, `texcoord_vb`, `blend_vb`).
    pub buffers: BTreeMap<String, Binding>,
    /// Keyed by pixel-shader slot (`ps-t3`).
    pub textures: BTreeMap<String, Binding>,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub enum Severity {
    /// Renders wrong in game.
    Error,
    /// Suspicious, or a limit of this simulator rather than of the mod.
    Warning,
}

#[derive(Debug, Clone, Serialize)]
pub struct Finding {
    pub severity: Severity,
    pub code: &'static str,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct BindReport {
    pub mod_name: String,
    /// Agents the mod touches, according to the baseline.
    pub agents: Vec<String>,
    pub draws: Vec<DrawSim>,
    pub findings: Vec<Finding>,
    /// Components present in the baseline that this mod never touches; reported as a count only,
    /// because listing every untouched component of every Agent would drown the signal.
    pub untouched_components: usize,
}

impl BindReport {
    pub fn has_errors(&self) -> bool {
        self.findings.iter().any(|f| f.severity == Severity::Error)
    }
}

fn value_of(sec: &IniSectionData, key: &str) -> Option<String> {
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

fn has_key(sec: &IniSectionData, key: &str) -> bool {
    value_of(sec, key).is_some()
}

/// Does this section put something back in place of the draw it suppressed?
///
/// Not just `drawindexed`. The common ZZMI texture-only override is `handling = skip` plus
/// `draw = from_caller`, which re-issues the caller's own draw with new textures bound - the
/// geometry is untouched. Treating only `drawindexed` as a replacement reported two such mods as
/// losing their entire face, which is both wrong and alarming. Any draw command counts, and the
/// operands may be expressions (`drawindexed = 40*3, first_index, 0`), so only the key matters.
fn issues_a_draw(sec: &IniSectionData) -> bool {
    ["drawindexed", "draw", "drawinstanced", "drawindexedinstanced"]
        .iter()
        .any(|k| has_key(sec, k))
}

/// True when this section hands work to a command list the mod defines itself, so anything we
/// failed to find may simply be hidden inside it.
///
/// The framework's own lists do not count: every ZZMI mod runs those. Twin of
/// `component_split::delegates_to_mod_command_list`, which asks the same question of a whole
/// component; ticket 007 resolves the indirection and should collapse the two.
fn delegates_to_mod_command_list(sec: &IniSectionData) -> Option<String> {
    for line in &sec.lines {
        let clean = line.split(';').next().unwrap_or("").trim().to_lowercase();
        let Some(rest) = clean.strip_prefix("run") else { continue };
        let target = rest.trim().trim_start_matches('=').trim();
        if target.starts_with("commandlist")
            && !target.contains("zzmi")
            && target != "commandlistskintexture"
            && target != "commandlistskin"
        {
            return Some(target.to_string());
        }
    }
    None
}

/// A resource reference as the INI writes it, with any `ref` keyword and namespace path removed.
fn resource_name(raw: &str) -> String {
    let v = raw.trim();
    let v = v.strip_prefix("ref").map(str::trim).unwrap_or(v);
    v.to_string()
}

/// Does this section apply at `offset`? A section with no `match_first_index` applies to every
/// sub-draw of its component — which is exactly how a blanket `handling = skip` deletes the
/// sub-draws a mod never replaces.
fn applies_at(sec: &IniSectionData, offset: i64) -> bool {
    match value_of(sec, "match_first_index") {
        Some(v) => v.trim().parse::<i64>().map(|m| m == offset).unwrap_or(false),
        None => true,
    }
}

/// Simulate a mod using the baseline shipped with the app.
///
/// `Err` when no baseline is available at all, which is a setup problem rather than a finding
/// about the mod - reporting "nothing binds" in that case would be a silent wrong answer.
pub fn simulate_with_shipped_baseline(mod_path: &Path) -> Result<BindReport, String> {
    let baselines = crate::infra::vanilla_baseline::baselines().ok_or_else(|| {
        "no vanilla baseline available - generate src/vanilla_baselines.json with \
         scripts/extract_vanilla_baseline.py, or run from the repository root"
            .to_string()
    })?;
    Ok(simulate(mod_path, baselines))
}

/// Simulate one mod against the baseline.
pub fn simulate(mod_path: &Path, baselines: &VanillaBaselines) -> BindReport {
    let mut ini_files = Vec::new();
    crate::core::utils::find_ini_files(mod_path, &mut ini_files, 0, 10);

    let mut sections: Vec<IniSectionData> = Vec::new();
    for path in &ini_files {
        // 3DMigoto excludes DISABLED* from its recursive include, so those files are inert.
        let name = path.file_name().unwrap_or_default().to_string_lossy().to_uppercase();
        if name.starts_with("DISABLED") {
            continue;
        }
        if let Ok(text) = std::fs::read_to_string(path) {
            sections.extend(parse_ini_sections(&text));
        }
    }

    let mut report = BindReport {
        mod_name: mod_path.file_name().unwrap_or_default().to_string_lossy().to_string(),
        agents: Vec::new(),
        draws: Vec::new(),
        findings: Vec::new(),
        untouched_components: 0,
    };

    let mut components: Vec<&ComponentBaseline> = baselines.components.values().collect();
    // stable output regardless of map order
    components.sort_by(|a, b| {
        (a.agent.as_deref(), a.component.as_deref()).cmp(&(b.agent.as_deref(), b.component.as_deref()))
    });

    for comp in components {
        let touched = simulate_component(comp, &sections, &mut report);
        if !touched {
            report.untouched_components += 1;
        }
    }

    report.agents.sort();
    report.agents.dedup();
    report
}

/// Returns whether the mod touches this component at all.
fn simulate_component(
    comp: &ComponentBaseline,
    sections: &[IniSectionData],
    report: &mut BindReport,
) -> bool {
    let ib_sections: Vec<&IniSectionData> = sections
        .iter()
        .filter(|s| s.get_hash().as_deref().is_some_and(|h| h.eq_ignore_ascii_case(&comp.ib)))
        .collect();

    // Buffer bindings are keyed on their own hashes, in sections of their own.
    let mut buffers: BTreeMap<String, Binding> = BTreeMap::new();
    for (role, slot) in [
        ("position_vb", "vb0"),
        ("texcoord_vb", "vb1"),
        ("blend_vb", "vb2"),
    ] {
        let Some(hash) = comp.buffers.get(role).and_then(|b| b.hash.as_deref()) else { continue };
        let binding = sections
            .iter()
            .filter(|s| s.get_hash().as_deref().is_some_and(|h| h.eq_ignore_ascii_case(hash)))
            .find_map(|s| {
                value_of(s, slot)
                    .map(|v| Binding::Mod(resource_name(&v)))
                    .or_else(|| delegates_to_mod_command_list(s).map(Binding::Unresolved))
            });
        if let Some(b) = binding {
            buffers.insert(role.to_string(), b);
        }
    }

    if ib_sections.is_empty() && buffers.is_empty() {
        return false;
    }
    if let Some(a) = comp.agent.clone() {
        report.agents.push(a);
    }

    let offsets = comp.subdraw_offsets();
    for sub in &comp.subdraws {
        if !offsets.contains(&sub.first_index) {
            continue;
        }
        let applicable: Vec<&&IniSectionData> =
            ib_sections.iter().filter(|s| applies_at(s, sub.first_index)).collect();

        let suppressed = applicable
            .iter()
            .any(|s| value_of(s, "handling").is_some_and(|v| v.trim().eq_ignore_ascii_case("skip")));
        let replaced = applicable.iter().any(|s| issues_a_draw(s));

        let mut ib = Binding::Vanilla;
        let mut textures: BTreeMap<String, Binding> = BTreeMap::new();
        for s in &applicable {
            if let Some(v) = value_of(s, "ib") {
                ib = Binding::Mod(resource_name(&v));
            }
            for line in &s.lines {
                let clean = line.split(';').next().unwrap_or("").trim();
                let Some((k, v)) = clean.split_once('=') else { continue };
                let k = k.trim().to_lowercase();
                if k.starts_with("ps-t") {
                    textures.insert(k, Binding::Mod(resource_name(v)));
                }
            }
            // Only unresolved when this section hides everything: a texture-only override that
            // legitimately leaves `ib` alone must not be reported as unreadable.
            if matches!(ib, Binding::Vanilla) && !issues_a_draw(s) {
                if let Some(target) = delegates_to_mod_command_list(s) {
                    ib = Binding::Unresolved(target.clone());
                }
            }
        }
        // Whatever the mod does not touch stays the game's own.
        for (slot, hash) in &comp.texture_slots {
            textures.entry(slot.to_lowercase()).or_insert(Binding::Vanilla);
            let _ = hash;
        }

        let draw = DrawSim {
            agent: comp.agent.clone(),
            component: comp.component.clone(),
            ib_hash: comp.ib.clone(),
            first_index: sub.first_index,
            index_count: sub.index_count,
            suppressed,
            replaced,
            ib,
            buffers: buffers.clone(),
            textures,
        };

        // The invariant that has bitten hardest: `handling = skip` suppresses every sub-draw of a
        // component, while a mod's draw sections only replace the offsets that mod happens to use.
        //
        // But only claim geometry disappears when the draw is actually readable. If an applicable
        // section routes through the mod's own command list, the replacement may well be in there
        // and we cannot see it - asserting a loss then is the same over-claiming that reported two
        // mods as losing their entire face. An unreadable draw is a warning, never an error.
        let unreadable = applicable
            .iter()
            .any(|s| delegates_to_mod_command_list(s).is_some() && !issues_a_draw(s));
        if draw.suppressed && !draw.replaced && !unreadable {
            report.findings.push(Finding {
                severity: Severity::Error,
                code: "subdraw_suppressed_with_no_replacement",
                message: format!(
                    "{} {} sub-draw at offset {} is suppressed but nothing is drawn in its place \
                     ({} vanilla indices would disappear)",
                    comp.agent.as_deref().unwrap_or("?"),
                    comp.component.as_deref().unwrap_or(&comp.ib),
                    sub.first_index,
                    sub.index_count
                ),
            });
        }
        if draw.ib.is_unresolved() {
            report.findings.push(Finding {
                severity: Severity::Warning,
                code: "binding_behind_mod_command_list",
                message: format!(
                    "{} {} at offset {}: bindings sit behind the mod's own command list, so this \
                     draw could not be evaluated",
                    comp.agent.as_deref().unwrap_or("?"),
                    comp.component.as_deref().unwrap_or(&comp.ib),
                    sub.first_index
                ),
            });
        }
        report.draws.push(draw);
    }

    // A mod that feeds a component's buffers but never draws it renders nothing from them.
    if !buffers.is_empty() && !report.draws.iter().any(|d| d.replaced && d.ib_hash == comp.ib) {
        report.findings.push(Finding {
            severity: Severity::Warning,
            code: "buffers_bound_but_never_drawn",
            message: format!(
                "{} {}: the mod binds {} but issues no draw for this component",
                comp.agent.as_deref().unwrap_or("?"),
                comp.component.as_deref().unwrap_or(&comp.ib),
                buffers.keys().cloned().collect::<Vec<_>>().join(", ")
            ),
        });
    }

    true
}

#[cfg(test)]
#[path = "bind_simulator_tests.rs"]
mod tests;
