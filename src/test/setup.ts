import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';
import './mockIpc';

// Polyfill Web Audio API for procedural audio synthesis (src/utils/audio.ts)
class MockAudioNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockAudioParam {
  value = 1;
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}

class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam();
}

class MockOscillatorNode extends MockAudioNode {
  type = 'sine';
  frequency = new MockAudioParam();
  start = vi.fn();
  stop = vi.fn();
}

class MockAudioContext {
  state = 'running';
  currentTime = 0;
  destination = new MockAudioNode();
  createGain = vi.fn(() => new MockGainNode());
  createOscillator = vi.fn(() => new MockOscillatorNode());
  close = vi.fn().mockResolvedValue(undefined);
  resume = vi.fn().mockResolvedValue(undefined);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).AudioContext = MockAudioContext;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).webkitAudioContext = MockAudioContext;

// Polyfill window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Polyfill Tauri v2 window.__TAURI_INTERNALS__
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).__TAURI_INTERNALS__ = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  invoke: vi.fn(async (cmd: string, args?: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (globalThis as any).__mockIpcHandlers?.get(cmd);
    if (handler) {
      return handler(args);
    }
    if (cmd === 'scan_mods_folder' || cmd === 'get_cached_mods_folder') return [];
    if (cmd === 'toggle_mod') return 'C:/ZZMI/Mods/Mock/Toggled';
    if (cmd === 'is_game_running') return false;
    return null;
  }),
};

// Clean up between tests
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
