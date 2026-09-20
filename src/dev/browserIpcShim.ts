/**
 * Browser-mode IPC shim — development only.
 *
 * `npm run tauri dev` renders the app inside a native window, which cannot be
 * inspected with browser tooling or screenshotted by an agent. `npm run dev`
 * serves the same frontend over http, but every `invoke()` then throws
 * (`window.__TAURI_INTERNALS__` does not exist), so the UI dies during startup
 * and view navigation silently fails.
 *
 * This installs a minimal stand-in for the Tauri internals so the interface
 * renders and can be clicked through in an ordinary browser. It is a **UI
 * harness, not a simulator**: commands return empty or inert data, so nothing
 * here proves backend behaviour. Use it to check layout, navigation, i18n and
 * component state; use the real app to verify anything that touches disk.
 *
 * Safety:
 * - Only imported behind `import.meta.env.DEV`, so Vite drops it from builds.
 * - Refuses to install when real Tauri internals are present, so it can never
 *   shadow the backend inside `npm run tauri dev`.
 * - Never writes to disk or the network. Unknown commands resolve to `null`
 *   and are reported once, so gaps are visible rather than silent.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

type InvokeArgs = Record<string, unknown> | undefined;

/** Commands whose shape the UI depends on to finish rendering. */
const RESPONSES: Record<string, (args: InvokeArgs) => unknown> = {
  // Library / scanning
  scan_mods_folder: () => [],
  scan_broken_mods: () => [],
  get_cached_mods_folder: () => '',
  get_mod_metadata: () => ({}),
  get_mod_keybinds: () => [],
  get_mod_toggles: () => [],
  list_mod_backups_command: () => [],

  // Game state
  is_game_running: () => false,
  launch_game: () => null,

  // Database / sync
  sync_database: () => JSON.stringify({ characters: [] }),
  get_cached_database: () => JSON.stringify({ characters: [] }),

  // Diagnostics
  scan_conflicts: () => [],
  start_warnings_scan: () => null,
  get_alteration_history: () => [],
  get_error_logs: () => [],
  list_active_tasks: () => [],

  // GameBanana
  fetch_gb_mods: () => ({ _aRecords: [], _aMetadata: { _nRecordCount: 0, _nPerpage: 15 } }),
  fetch_gb_mods_multi: () => ({ _aRecords: [], _aMetadata: { _nRecordCount: 0, _nPerpage: 15 } }),
  fetch_gb_mod_details: () => ({}),
  check_mod_updates: () => [],

  // One-click installer
  is_one_click_protocol_registered: () => false,
  check_pending_one_click: () => null,

  // Anything that opens something outside the app is inert in the browser.
  open_url: () => null,
  open_folder: () => null,
  open_logs_folder: () => null,

  // Tauri's own plugin channels (event listeners, etc.)
  'plugin:app|version': () => '0.0.0-browser-preview',
  'plugin:fs|exists': () => false,
  'plugin:event|listen': () => 1,
  'plugin:event|unlisten': () => null,
  'plugin:event|emit': () => null,
};

const reported = new Set<string>();

function report(command: string) {
  if (reported.has(command)) return;
  reported.add(command);
  console.info(
    `[browser-ipc-shim] "${command}" has no stub; returning null. ` +
      `Add one in src/dev/browserIpcShim.ts if the UI needs its shape.`
  );
}

export function installBrowserIpcShim(): void {
  const w = globalThis as any;

  // Inside the real Tauri webview these already exist. Never shadow them.
  if (w.__TAURI_INTERNALS__ || w.__TAURI__) return;

  let callbackId = 0;

  w.__TAURI_INTERNALS__ = {
    invoke: async (command: string, args?: InvokeArgs) => {
      const responder = RESPONSES[command];
      if (!responder) {
        report(command);
        return null;
      }
      return responder(args);
    },
    transformCallback: (callback?: (payload: any) => void, _once = false) => {
      const id = ++callbackId;
      w[`_${id}`] = callback ?? (() => {});
      return id;
    },
    convertFileSrc: (path: string) => path,
    processState: () => undefined,
    metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
    plugins: {},
  };

  // @tauri-apps/api/event unregisters through a separate global; without it,
  // every useTauriListener cleanup throws and can tear down the React tree.
  w.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
    unregisterListener: () => Promise.resolve(),
  };

  console.info(
    '[browser-ipc-shim] Tauri IPC stubbed for browser preview. ' +
      'Layout and navigation are real; backend data is not.'
  );
}
