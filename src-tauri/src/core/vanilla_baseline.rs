//! What the unmodded game does with each character component, measured from frame-analysis
//! dumps by `scripts/extract_vanilla_baseline.py`.
//!
//! A mod's own files cannot tell us any of this, and the fixer has to match it:
//!
//! - **sub-draw offsets** — `handling = skip` suppresses *every* sub-draw of a component, while a
//!   mod's draw sections only replace the offsets that mod happens to use. Skip more than you
//!   replace and geometry vanishes; skip less and the vanilla mesh renders alongside the mod's.
//! - **buffer strides and vertex layouts** — the game reads a fixed number of bytes per vertex. A
//!   mod whose texcoord buffer is narrower than that layout has no room for a UV set the shader
//!   samples.
//! - **the `ps-tN` slot each texture sits in** — comparing a modded dump against this separates
//!   "the override applied" from "the override was ignored", which no amount of INI reading can.
//! - **bone palette size** — `joints x 48` bytes of skinning matrices, the input for deriving a
//!   legacy -> modern bone mapping instead of transcribing one by hand.
//!
//! This module is pure: it parses and answers questions. Loading the file from disk belongs in
//! `infra`.

use std::collections::HashMap;

use serde::Deserialize;

/// One vertex buffer as the game binds it.
#[derive(Debug, Clone, Deserialize)]
pub struct BufferLayout {
    pub hash: Option<String>,
    pub stride: Option<u32>,
    pub vertex_count: Option<u32>,
    #[serde(default)]
    pub elements: Vec<VertexElement>,
}

impl BufferLayout {
    /// The lowest stride that still contains every attribute the game reads, i.e. the end of the
    /// last element. A buffer narrower than this is missing an attribute outright, which is a
    /// different and worse problem than merely disagreeing with the game's stride.
    pub fn minimum_stride(&self) -> Option<u32> {
        self.elements
            .iter()
            .map(|e| e.byte_offset + e.format_bytes())
            .max()
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct VertexElement {
    pub semantic: String,
    #[serde(default)]
    pub semantic_index: u32,
    pub format: String,
    pub byte_offset: u32,
}

impl VertexElement {
    /// Width of this element's DXGI format in bytes.
    ///
    /// Summed from the channel prefix (`R32G32B32` -> 12), which is why only the part before the
    /// first `_` is read: counting `R`/`G`/`B`/`A` across the whole name also counts the `A` in
    /// `FLOAT`, which made every float format come out one channel too wide.
    pub fn format_bytes(&self) -> u32 {
        let f = self.format.to_uppercase();
        let prefix = f.split('_').next().unwrap_or("");
        let mut bits = 0u32;
        let mut chars = prefix.chars().peekable();
        while let Some(c) = chars.next() {
            if !matches!(c, 'R' | 'G' | 'B' | 'A' | 'D' | 'S' | 'X') {
                continue;
            }
            let mut n = String::new();
            while chars.peek().is_some_and(|d| d.is_ascii_digit()) {
                n.push(chars.next().unwrap_or('0'));
            }
            bits += n.parse::<u32>().unwrap_or(0);
        }
        bits / 8
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct SubDraw {
    pub first_index: i64,
    pub index_count: i64,
    #[serde(default)]
    pub passes: u32,
}

/// Everything measured for one component of one Agent.
#[derive(Debug, Clone, Deserialize)]
pub struct ComponentBaseline {
    pub agent: Option<String>,
    pub skin: Option<String>,
    pub component: Option<String>,
    pub ib: String,
    pub index_format: Option<String>,
    pub vertex_count: Option<u32>,
    #[serde(default)]
    pub subdraws: Vec<SubDraw>,
    #[serde(default)]
    pub buffers: HashMap<String, BufferLayout>,
    /// `ps-t3` -> texture hash, as the game bound it.
    #[serde(default)]
    pub texture_slots: HashMap<String, String>,
    /// `Diffuse` -> texture hash, from the character database.
    #[serde(default)]
    pub texture_roles: HashMap<String, String>,
    pub bone_palette_joints: Option<u32>,
}

impl ComponentBaseline {
    /// The offsets the game issues for this component, in ascending order.
    pub fn subdraw_offsets(&self) -> Vec<i64> {
        let mut v: Vec<i64> = self.subdraws.iter().map(|s| s.first_index).collect();
        v.sort_unstable();
        v.dedup();
        v
    }

    /// Stride of one of the component's buffers, by role (`position_vb`, `texcoord_vb`,
    /// `blend_vb`, `draw_vb`).
    pub fn stride(&self, role: &str) -> Option<u32> {
        self.buffers.get(role).and_then(|b| b.stride)
    }

    /// Which `ps-tN` slot a texture hash occupies, if the game bound it.
    pub fn slot_of_texture(&self, hash: &str) -> Option<u32> {
        self.texture_slots.iter().find_map(|(slot, h)| {
            h.eq_ignore_ascii_case(hash)
                .then(|| slot.trim_start_matches("ps-t").parse().ok())
                .flatten()
        })
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct VanillaBaselines {
    /// Keyed `"<Agent>|<Component>"`, e.g. `"Jane Doe|Hair"`.
    #[serde(default)]
    pub components: HashMap<String, ComponentBaseline>,
}

impl VanillaBaselines {
    pub fn parse(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }

    /// The component that owns this index buffer.
    pub fn by_ib(&self, ib: &str) -> Option<&ComponentBaseline> {
        self.components
            .values()
            .find(|c| c.ib.eq_ignore_ascii_case(ib))
    }

    pub fn by_agent_component(&self, agent: &str, component: &str) -> Option<&ComponentBaseline> {
        self.components.values().find(|c| {
            c.agent.as_deref().is_some_and(|a| a.eq_ignore_ascii_case(agent))
                && c.component.as_deref().is_some_and(|k| k.eq_ignore_ascii_case(component))
        })
    }

    pub fn len(&self) -> usize {
        self.components.len()
    }

    pub fn is_empty(&self) -> bool {
        self.components.is_empty()
    }
}

#[cfg(test)]
#[path = "vanilla_baseline_tests.rs"]
mod tests;
