import { vi } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IpcHandler = (args: any) => any | Promise<any>;

// Global map stored on globalThis so setup.ts and mockIpc.ts share the exact same instance
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalHandlers: Map<string, IpcHandler> = ((globalThis as any).__mockIpcHandlers ??= new Map<
  string,
  IpcHandler
>());

export function setMockIpcHandler(command: string, handler: IpcHandler): void {
  globalHandlers.set(command, handler);
}

export function clearMockIpcHandlers(): void {
  globalHandlers.clear();
}

export function resetMockIpc(): void {
  globalHandlers.clear();
}

// Global mock for @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  invoke: vi.fn(async (cmd: string, args?: any) => {
    const handler = globalHandlers.get(cmd);
    if (handler) {
      return handler(args);
    }
    if (cmd === 'scan_mods_folder' || cmd === 'get_cached_mods_folder') return [];
    if (cmd === 'toggle_mod') return 'C:/ZZMI/Mods/Mock/Toggled';
    if (cmd === 'is_game_running') return false;
    return null;
  }),
}));

// Global mock for @tauri-apps/plugin-dialog
vi.mock('@tauri-apps/plugin-dialog', () => ({
  message: vi.fn().mockResolvedValue(undefined),
  confirm: vi.fn().mockResolvedValue(true),
  open: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockResolvedValue(null),
}));

// Global mock for @tauri-apps/api/event
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn().mockResolvedValue(undefined),
}));
