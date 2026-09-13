import { invoke } from '@tauri-apps/api/core';
import type { CategoryInfo, InstallResult, UpdateAvailable } from '../types';
import type {
  ToggledModResult,
  HashAnalysisResult,
  SplitGroupPreview,
  ModUpdateCheckRequest,
  KeybindInfo,
  ModToggleInfo,
  KeybindConflict,
  CapturedHashEntry,
  TaskInfo,
  ViewerPayload,
} from '../types/ipc';

/**
 * Type-Safe Tauri IPC Service Layer
 *
 * Guarantees compile-time parameter and return type validation for all
 * backend commands, eliminating raw string literal invoke() calls across UI code.
 */
export const tauriCommands = {
  mods: {
    scan: (rootPath: string, taskId?: string) =>
      invoke<CategoryInfo[]>('scan_mods_folder', { rootPath, taskId: taskId ?? null }),

    getCached: (path: string) => invoke<CategoryInfo[]>('get_cached_mods_folder', { path }),

    loadCachedLibrary: (rootPath: string) =>
      invoke<CategoryInfo[]>('load_cached_library', { rootPath }),

    delete: (modPath: string) => invoke<void>('delete_mod', { modPath }),

    rename: (modPath: string, newName: string) => invoke<void>('rename_mod', { modPath, newName }),

    moveToCategory: (modPath: string, targetCategory: string, rootPath: string) =>
      invoke<void>('move_mod_to_category', { modPath, targetCategory, rootPath }),

    moveToUnassigned: (modPath: string, rootPath: string) =>
      invoke<void>('move_to_unassigned', { modPath, rootPath }),

    setCategoryMapping: (
      categoryName: string,
      characterId: string,
      skinId?: string,
      rootPath?: string
    ) => invoke<void>('set_category_mapping', { categoryName, characterId, skinId, rootPath }),

    setNote: (modPath: string, note: string) => invoke<void>('set_mod_note', { modPath, note }),

    setTags: (modPath: string, tags: string[]) => invoke<void>('set_mod_tags', { modPath, tags }),

    autoTag: (modPath: string) => invoke<string[]>('auto_tag_mod', { modPath }),

    autoTagAll: (rootPath: string) => invoke<number>('auto_tag_all_library_mods', { rootPath }),

    savePreviewBase64: (modPath: string, base64Data: string) =>
      invoke<string>('save_mod_preview_base64', { modPath, base64Data }),

    setPreviewImage: (modPath: string, imagePath: string) =>
      invoke<string>('set_mod_preview_image', { modPath, imagePath }),

    getMetadata: (modPath: string) => invoke<any>('get_mod_metadata', { modPath }),

    getKeybinds: (modPath: string) => invoke<KeybindInfo[]>('get_mod_keybinds', { modPath }),

    setKeybind: (
      modPath: string,
      iniFile: string,
      section: string,
      keyType: 'key' | 'back',
      oldKey: string,
      newKey: string,
      createBackup?: boolean
    ) =>
      invoke<string>('set_mod_keybind', {
        modPath,
        iniFile,
        section,
        keyType,
        oldKey,
        newKey,
        createBackup: !!createBackup,
      }),

    getToggles: (modPath: string) => invoke<ModToggleInfo[]>('get_mod_toggles', { modPath }),

    setToggleState: (
      modPath: string,
      iniFile: string,
      variable: string,
      value: number,
      createBackup?: boolean
    ) =>
      invoke<void>('set_mod_toggle_state', {
        modPath,
        iniFile,
        variable,
        value,
        createBackup: !!createBackup,
      }),

    detectKeybindConflicts: (modsPath: string) =>
      invoke<KeybindConflict[]>('detect_keybind_conflicts', { modsPath }),
  },

  game: {
    toggle: (modPath: string, enable: boolean) =>
      invoke<ToggledModResult>('toggle_mod', { modPath, enable }),

    bulkToggle: (modPaths: string[], enable: boolean) =>
      invoke<void>('bulk_toggle_mods', { modPaths, enable }),

    randomize: (
      categoryMods: Record<string, string[]>,
      rootPath: string,
      weights?: Record<string, number>,
      whitelist?: string[]
    ) => invoke<void>('randomize_mods', { categoryMods, rootPath, weights, whitelist }),

    disableAll: (rootPath: string) => invoke<string[]>('disable_all_mods', { rootPath }),

    restoreState: (modPaths: string[]) => invoke<void>('restore_mods_state', { modPaths }),

    launch: (gamePath: string) => invoke<void>('launch_game', { gamePath }),

    isRunning: (gamePath: string) => invoke<boolean>('is_game_running', { gamePath }),

    generateInGameUi: (rootPath: string, hudKey: string, menuMode?: string) =>
      invoke<void>('generate_in_game_ui', { rootPath, hudKey, menuMode }),

    disableInGameUi: (rootPath: string) => invoke<void>('disable_in_game_ui', { rootPath }),
  },

  install: {
    installArchives: (
      archivePaths: string[],
      rootPath: string,
      winrarPath?: string,
      gbModId?: number | null
    ) =>
      invoke<InstallResult[]>('install_mods', {
        archivePaths,
        rootPath,
        winrarPath,
        gbModId: gbModId ?? null,
      }),

    generateFolders: (
      rootPath: string,
      folders: { folder_name: string; character_id: string; skin_id?: string }[]
    ) => invoke<string[]>('generate_character_folders', { rootPath, folders }),

    autoAssign: (rootPath: string) => invoke<string[]>('auto_assign_mods', { rootPath }),
  },

  diagnostics: {
    analyzeHashes: (modsPath: string, activeOnly: boolean) =>
      invoke<HashAnalysisResult>('analyze_mod_hashes', { modsPath, activeOnly }),

    startWarningsScan: (modsDir: string) => invoke<void>('start_warnings_scan', { modsDir }),

    autoFixModScript: (filePath: string, ruleId: string) =>
      invoke<void>('auto_fix_mod_script', { filePath, ruleId }),

    checkModFixable: (modPath: string) => invoke<any>('check_mod_fixable', { modPath }),

    fixMod: (modPath: string) => invoke<any>('fix_mod', { modPath }),

    batchScanFixableMods: (rootPath: string) =>
      invoke<any>('batch_scan_fixable_mods', { rootPath }),

    batchFixMods: (modPaths: string[], taskId?: string) =>
      invoke<any>('batch_fix_mods', { modPaths, taskId: taskId ?? null }),

    restoreModBackup: (backupPath: string) =>
      invoke<void>('restore_mod_backup_command', { backupPath }),

    resolveConflict: (
      modPath: string,
      action: 'replace' | 'rename' | 'delete',
      newName?: string | null,
      targetCategory?: string,
      rootPath?: string
    ) =>
      invoke<void>('resolve_conflict', {
        modPath,
        action,
        newName: newName ?? null,
        targetCategory,
        rootPath,
      }),

    checkModUpdates: (mods: ModUpdateCheckRequest[]) =>
      invoke<UpdateAvailable[]>('check_mod_updates', { mods }),

    fetchModUpdatesV13: (gbModId: number) => invoke<any>('fetch_mod_updates_v13', { gbModId }),
  },

  splitter: {
    preview: (modPath: string, mode: 'component' | 'character' | 'break') =>
      invoke<SplitGroupPreview[]>('preview_split_mod', { modPath, mode }),

    split: (modPath: string, mode: 'component' | 'character' | 'break') =>
      invoke<string[]>('split_mod', { modPath, mode }),
  },

  gamebanana: {
    fetchMods: (params: any) => invoke<any>('fetch_gb_mods', params),

    fetchModsMulti: (params: any) => invoke<any>('fetch_gb_mods_multi', params),

    fetchDetails: (itemType: string, itemId: number) =>
      invoke<any>('fetch_gb_mod_details', { itemType, itemId }),

    downloadMod: (url: string, modId: number, downloadId: string, filename?: string) =>
      invoke<void>('download_gb_mod', { url, modId, downloadId, filename }),

    cancelDownload: (downloadId: string) => invoke<void>('cancel_gb_mod_download', { downloadId }),
  },

  system: {
    expandPath: (path: string) => invoke<string>('expand_env_path', { path }),

    openFolder: (path: string) => invoke<void>('open_folder', { path }),

    openLogsFolder: () => invoke<void>('open_logs_folder'),

    openUrl: (url: string) => invoke<void>('open_url', { url }),

    startFolderWatch: (modsPath: string) => invoke<void>('start_folder_watch', { modsPath }),

    setHotreload: (enabled: boolean) => invoke<void>('set_hotreload', { enabled }),

    focusAndSendF10: () => invoke<void>('focus_and_send_f10'),

    takeAndCropScreenshot: (x: number, y: number, w: number, h: number) =>
      invoke<string>('take_and_crop_screenshot', { x, y, w, h }),

    translateQuery: (query: string, targetLang: string) =>
      invoke<string>('translate_query', { query, targetLang }),

    syncDatabase: (dbUrl?: string) => invoke<any>('sync_database', { dbUrl }),

    getCachedDatabase: () => invoke<any>('get_cached_database'),

    getHuntingModeStatus: (modsPath: string) =>
      invoke<boolean>('get_hunting_mode_status', { modsPath }),

    setHuntingMode: (modsPath: string, enabled: boolean) =>
      invoke<boolean>('set_hunting_mode', { modsPath, enabled }),

    readHuntingLog: (modsPath: string) =>
      invoke<CapturedHashEntry[]>('read_hunting_log', { modsPath }),
  },

  viewer: {
    parseMod: (
      modPath: string,
      baseModelFolder?: string | null,
      quality?: string | null,
      taskId?: string | null
    ) =>
      invoke<ViewerPayload>('parse_mod_for_viewer', {
        modPath,
        baseModelFolder: baseModelFolder ?? null,
        quality: quality ?? null,
        taskId: taskId ?? null,
      }),

    previewGameBanana: (
      downloadUrl: string,
      fileName: string,
      winrarPath: string,
      taskId?: string | null
    ) =>
      invoke<ViewerPayload>('preview_gamebanana_mod', {
        downloadUrl,
        fileName,
        winrarPath,
        taskId: taskId ?? null,
      }),

    discardPreview: (tempPath: string) => invoke<void>('discard_gamebanana_preview', { tempPath }),

    commitPreview: (params: {
      tempPath: string;
      archiveFileName: string;
      rootPath: string;
      winrarPath: string;
      targetCategory?: string;
      gbModId?: number;
      author?: string;
      sourceUrl?: string;
    }) => invoke<InstallResult[]>('commit_gamebanana_preview', params),
  },

  tasks: {
    cancel: (taskId: string) => invoke<boolean>('cancel_task', { taskId }),

    cancelByPrefix: (prefix: string) => invoke<number>('cancel_tasks_by_prefix', { prefix }),

    listActive: () => invoke<TaskInfo[]>('list_active_tasks'),
  },
};
