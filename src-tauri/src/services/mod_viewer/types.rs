//! Shared types and data structures for 3D Mod Viewer.

use serde::Serialize;
use std::path::PathBuf;

pub const DEFAULT_POSITION_STRIDE: usize = 40;
pub const DEFAULT_POSITION_OFFSET: usize = 0;
pub const DEFAULT_UV_OFFSET: usize = 4;
pub const INDEX_SIZE_U32: usize = 4;
pub const INDEX_SIZE_U16: usize = 2;
pub const MAX_BUFFER_FILE_BYTES: u64 = 512 * 1024 * 1024;

#[derive(Debug, Serialize, Clone)]
pub struct BaseModelCandidate {
    pub folder_name: String,
    pub display_name: String,
    pub confidence: String,
    pub matched_buffers_count: usize,
    pub total_required_buffers: usize,
    pub match_details: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct ViewerToggle {
    pub id: String,
    pub name: String,
    pub key: Option<String>,
    pub variable: String,
    pub current_value: i32,
    pub values: Vec<i32>,
    pub labels: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
pub struct ViewerPayload {
    pub meshes: Vec<MeshData>,
    pub textures: std::collections::HashMap<String, String>,
    pub is_retexture: bool,
    pub base_model_source: Option<String>,
    pub clues: Vec<String>,
    pub base_model_candidates: Vec<BaseModelCandidate>,
    pub toggles: Vec<ViewerToggle>,
    pub suggested_tags: Vec<String>,
    pub temp_install_path: Option<String>,
    pub archive_file_name: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct MeshData {
    pub name: String,
    pub positions: String,
    pub uvs: Option<String>,
    pub indices: String,
    pub tex_key: Option<String>,
    pub normal_key: Option<String>,
    pub light_key: Option<String>,
    pub material_key: Option<String>,
    pub component: Option<String>,
    pub condition: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ResourceRecord {
    #[allow(dead_code)]
    pub name: String,
    #[allow(dead_code)]
    pub filename: String,
    pub full_path: PathBuf,
    pub stride: Option<usize>,
    pub format: Option<String>,
}

#[derive(Debug, Clone)]
pub struct IniEntry {
    pub key: String,
    pub val: String,
    pub condition: Option<String>,
}

#[derive(Debug, Clone)]
pub struct IniSection {
    pub name: String,
    pub entries: Vec<IniEntry>,
    pub ini_dir: PathBuf,
}

#[derive(Debug, Clone)]
pub struct DrawGroup {
    pub name: String,
    pub position_file: PathBuf,
    pub texcoord_file: Option<PathBuf>,
    pub ib_file: PathBuf,
    pub position_stride: usize,
    pub texcoord_stride: usize,
    pub index_size: usize,
    pub diffuse_file: Option<PathBuf>,
    pub normal_file: Option<PathBuf>,
    pub light_file: Option<PathBuf>,
    pub material_file: Option<PathBuf>,
    pub draws: Vec<DrawIndexed>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct DrawIndexed {
    pub count: usize,
    pub start: usize,
    pub base: i32,
    pub condition: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum UvFormat {
    Float16,
    Float32,
}
