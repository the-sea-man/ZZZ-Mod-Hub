/**
 * Shared TypeScript interfaces for Tauri IPC event payloads.
 *
 * These types mirror the Rust structs in `src-tauri/src/models.rs` and `gamebanana.rs`.
 * The Rust side serializes with snake_case (the serde default).
 *
 * IMPORTANT: If you change a field name in Rust, update it here too.
 * If you add a new event, add its payload type here.
 */

// ── Shared Models (from models.rs) ───────────────────────────────────

export interface ModMeta {
  gb_mod_id?: number;
  downloaded_at?: string;
  source_url?: string;
  gb_last_updated?: number;
  author?: string;
  original_file_name?: string;
  notes?: string | null;
  tags?: string[] | null;
}

export interface ModInfo {
  name: string;
  full_path: string;
  is_enabled: boolean;
  preview_url?: string;
  thumbnail_url?: string;
  meta?: ModMeta;
  /** Total disk size of the mod folder in bytes, populated by scan_mods_folder. */
  total_size_bytes?: number;
  /** Whether any backup files (.bak / .disabled.bak) exist in this mod folder. */
  has_backup?: boolean;
}

export interface CategoryInfo {
  category_name: string;
  character_id?: string;
  skin_id?: string;
  mods: ModInfo[];
}

export interface ToggledModResult {
  old_path: string;
  new_path: string;
  is_enabled: boolean;
}

export interface HashTarget {
  category_name: string;
  character_id: string;
  skin_id: string;
}

export interface KeybindInfo {
  ini_file: string;
  section: string;
  keys: string[];
  back_keys: string[];
  bind_type: string;
  condition: string;
  variables: string[];
}

export interface ModToggleInfo {
  id: string;
  ini_file: string;
  section: string;
  variable: string;
  display_name: string;
  key?: string | null;
  back_key?: string | null;
  bind_type: string;
  condition?: string | null;
  current_value: number;
  values: number[];
  labels: string[];
}

export interface InstallResult {
  original_zip: string;
  extracted_folder_name: string;
  category: string;
  full_path: string;
  is_conflict: boolean;
  downloaded_at?: string;
  gb_mod_id?: number;
}

export interface HashOverride {
  file: string;
  section: string;
  hash: string;
  first_index: number;
  component_name: string;
}

export interface ModConflict {
  hash: string;
  first_index: number;
  affected_component: string;
  conflicting_mods: string[];
  is_fatal: boolean;
}

export interface ModUpdateCheckRequest {
  mod_path: string;
  gb_mod_id: number;
  downloaded_at: number;
}

export interface UpdateAvailable {
  mod_path: string;
  gb_mod_id: number;
  mod_name: string;
  new_timestamp: number;
}

export interface HashAnalysisResult {
  conflicts: ModConflict[];
  mod_hashes: Record<string, HashOverride[]>;
}

export interface KeybindConflict {
  key: string;
  mods: string[];
}

export interface BrokenModEntry {
  category: string;
  mod_path: string;
  file?: string;
  hash: string;
  component?: string;
  reason: string;
  current_hash?: string;
  version_gap?: string;
}

// ── Download Events (from gamebanana.rs) ─────────────────────────────

/**
 * Mirrors `DownloadProgressPayload` in gamebanana.rs
 * Event name: "download-progress"
 */
export interface DownloadProgressEvent {
  download_id: string;
  mod_name: string;
  downloaded: number;
  total: number;
  status: string;
  speed_bytes_per_sec: number;
}

/**
 * Mirrors `DownloadCompletePayload` in gamebanana.rs
 * Event name: "download-complete"
 */
export interface DownloadCompleteEvent {
  download_id: string;
  status: string;
  results?: InstallResult[];
  error?: string;
}

export interface ModProfile {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  tab: string;
  enabledModRelativePaths: string[];
}

export interface ModWarning {
  rule_id: string;
  level:
    'critical' | 'warning' | 'info' | 'ini_issue' | 'conflict' | 'outdated_version' | 'crash_risk';
  message: string;
  details?: string;
}

// ── Mod Fixer (from mod_fixer.rs) ───────────────────────────────────

export interface HashFixDetail {
  old_hash: string;
  new_hash: string;
  character: string;
  description: string;
  version_from: string;
  version_to: string;
}

export interface MultiResFixDetail {
  source_hash: string;
  target_hash: string;
  section_title: string;
}

export interface BufferFixDetail {
  buffer_filename: string;
  fix_type: string;
  old_format: string;
  new_format: string;
}

export interface IndexFixDetail {
  hash: string;
  section: string;
  old_index: number;
  new_index: number;
  old_count?: number;
  new_count?: number;
  character: string;
  description: string;
}

export interface ModFixAnalysis {
  mod_path: string;
  mod_name: string;
  is_fixable: boolean;
  detected_character: string | null;
  detected_skin: string | null;
  available_skins: string[];
  detected_version_from: string | null;
  detected_version_to: string | null;
  hash_fixes: HashFixDetail[];
  multi_res_fixes: MultiResFixDetail[];
  buffer_fixes: BufferFixDetail[];
  index_fixes: IndexFixDetail[];
  total_fixes: number;
  has_backup: boolean;
}

export interface ModFixResult {
  mod_path: string;
  success: boolean;
  backup_created: string | null;
  modified_ini_files: string[];
  modified_buf_files: string[];
  hashes_updated: number;
  sections_added: number;
  buffers_remapped: number;
  indices_remapped: number;
  actions_summary: string[];
  error: string | null;
}

// ── 3D Mod Viewer (from mod_viewer.rs) ───────────────────────────────

export interface ViewerMeshData {
  name: string;
  /** Base64-encoded little-endian Float32Array: [x,y,z, x,y,z, ...] */
  positions: string;
  /** Base64-encoded little-endian Float32Array: [u,v, u,v, ...] */
  uvs: string | null;
  /** Base64-encoded little-endian Uint32Array: [i0,i1,i2, ...] */
  indices: string;
  /** Key into ViewerPayload.textures */
  tex_key: string | null;
  /** Key into ViewerPayload.textures for normal map */
  normal_key?: string | null;
  /** Key into ViewerPayload.textures for light map */
  light_key?: string | null;
  /** Key into ViewerPayload.textures for material map */
  material_key?: string | null;
  /** Component name from INI section */
  component: string | null;
  /** INI condition expression (e.g. "$cloth == 1") */
  condition?: string | null;
}

export interface ViewerToggle {
  id: string;
  name: string;
  key?: string | null;
  variable: string;
  current_value: number;
  values: number[];
  labels?: string[] | null;
}

export interface BaseModelCandidate {
  folder_name: string;
  display_name: string;
  confidence: 'exact' | 'partial' | 'low';
  matched_buffers_count: number;
  total_required_buffers: number;
  match_details: string;
}

export interface ViewerPayload {
  meshes: ViewerMeshData[];
  /** tex_key → base64 PNG data URI */
  textures: Record<string, string>;
  /** True if the mod folder did not contain its own 3D model geometry (.buf/.ib) */
  is_retexture?: boolean;
  /** Sibling mod folder name where the base 3D model was loaded from, if any */
  base_model_source?: string | null;
  /** Extracted clues regarding the required base model */
  clues?: string[];
  /** All candidate base mesh folders found for this character */
  base_model_candidates?: BaseModelCandidate[];
  /** Interactive outfit toggles and variation cycles */
  toggles?: ViewerToggle[];
  /** Auto-detected heuristic tags (e.g. #Outfit, #Weapon, #Toggle, #Retexture) */
  suggested_tags?: string[];
  /** Temporary extract directory for GameBanana pre-download previews */
  temp_install_path?: string | null;
  /** Original archive file name for GameBanana pre-download previews */
  archive_file_name?: string | null;
}

export interface SplitGroupPreview {
  group_name: string;
  target_folder_name: string;
  override_count: number;
  resource_count: number;
  asset_files: string[];
  is_monolithic?: boolean | null;
  warning?: string | null;
}

export interface CapturedHashEntry {
  hash_type: string;
  hash: string;
  ib: string | null;
  vb0: string | null;
  vertex_count: number | null;
  stride: number | null;
  is_known: boolean;
  matched_entity: string | null;
  line_snippet: string;
}

// ── Universal Task Cancellation Engine (from task_manager.rs) ────────────────────────

export interface TaskInfo {
  task_id: string;
  task_type: string;
  started_at: number;
}

// ── Dual-Track Logging & Operation Rollback Engine (from logger.rs) ───────────────────

export interface AlterationEntry {
  id: string;
  timestamp: string;
  action_type:
    | 'mod_fix'
    | 'mod_split'
    | 'keybind_change'
    | 'script_fix'
    | 'toggle'
    | 'restore'
    | 'install'
    | 'delete'
    | 'move'
    | 'rename'
    | string;
  target_name: string;
  target_path: string;
  details: string;
  backup_path?: string | null;
  can_undo: boolean;
}

export interface ErrorLogEntry {
  id: string;
  timestamp: string;
  subsystem: string;
  error_message: string;
  context?: string | null;
}

export interface RollbackResult {
  success: boolean;
  restored_count: number;
  message: string;
}

// ── Custom Folder Management & Essential System Folders ─────────────────────────────

export interface CreateFolderPayload {
  rootPath: string;
  folderName: string;
  characterId?: string | null;
  skinId?: string | null;
}

export interface RenameFolderPayload {
  rootPath: string;
  oldName: string;
  newName: string;
}

export interface DeleteFolderPayload {
  rootPath: string;
  folderName: string;
  force: boolean;
}

export interface GenerateEssentialFoldersPayload {
  rootPath: string;
  folders?: string[] | null;
}

// ── Mod Backup Inspection & Selective Rollback ──────────────────────────────────────

export interface ModBackupInfo {
  backup_path: string;
  backup_file_name: string;
  target_file_name: string;
  target_path: string;
  created_at?: number | null;
  backup_size_bytes: number;
  target_size_bytes?: number | null;
  target_exists: boolean;
}

export interface RestoreBackupResult {
  success: boolean;
  restored_files: string[];
  remaining_backups_count: number;
  error?: string | null;
}

// ── GameBanana 1-Click Installer ──────────────────────────────────────────────

export interface OneClickPayload {
  download_url: string;
  item_type: string;
  item_id?: number | null;
  file_id?: number | null;
}

export interface RemotePairPayload {
  member_id: number;
  secret_key: string;
}

// ── External Mod Importer ──────────────────────────────────────────────────

export interface DepthAnalysis {
  depth: number;
  candidate_count: number;
  valid_mod_count: number;
  shallow_warning_count: number;
  deep_warning_count: number;
  sample_path: string;
}

export interface DiscoveredCandidateMod {
  source_path: string;
  folder_name: string;
  relative_path: string;
  depth: number;
  ini_count: number;
  buf_count: number;
  dds_count: number;
  total_size_bytes: number;
  has_subdirs_with_mods: boolean;
  is_likely_subcomponent: boolean;
}

export interface ExternalFolderScanResult {
  root_path: string;
  recommended_depth: number;
  depth_analyses: DepthAnalysis[];
  candidates: DiscoveredCandidateMod[];
}

export interface ExecuteImportRequest {
  candidate_paths: string[];
  destination_root: string;
  copy_mode: boolean;
}

export interface ImportExecutionResult {
  total_requested: number;
  success_count: number;
  failure_count: number;
  conflict_count: number;
  details: string[];
}
