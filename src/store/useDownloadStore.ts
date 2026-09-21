import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from './useAppStore';
import { playInstallSuccessSound } from '../utils/audio';
import { getGbPreviewUrl } from '../utils/gbPreviewUrl';
import type { DownloadProgressEvent, DownloadCompleteEvent, InstallResult } from '../types/ipc';

export interface DownloadPayload {
  downloadUrl: string;
  fileName: string;
  modName: string;
  modUrl: string;
  modData: any;
  rootPath: string;
  winrarPath: string;

  targetCategory: string | null;
  gbModId?: number;
}

export interface DownloadState {
  download_id: string;
  mod_name: string;
  mod_url: string;
  payload: DownloadPayload;
  downloaded: number;
  total: number;
  status: string;
  is_complete: boolean;
  is_error: boolean;
  error_msg?: string;
  install_paths?: string[];
  install_results?: InstallResult[];
  timestamp: number;
  speed_bytes_per_sec: number;
  eta_seconds: number;
}

interface DownloadManagerStore {
  downloads: Record<string, DownloadState>;
  history: DownloadState[];
  startDownload: (payload: DownloadPayload) => void;
  retryDownload: (download_id: string) => void;
  addOrUpdateProgress: (eventPayload: DownloadProgressEvent) => void;
  setComplete: (eventPayload: DownloadCompleteEvent) => void;
  clearHistory: () => void;
  cancelDownload: (download_id: string) => void;
}

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

export const useDownloadStore = create<DownloadManagerStore>((set, get) => ({
  downloads: {},
  history: [],

  cancelDownload: async (download_id: string) => {
    await invoke('cancel_gb_mod_download', { downloadId: download_id });
  },

  startDownload: async (payload: DownloadPayload) => {
    const download_id = generateId();

    // 1. Register in active downloads
    set((state) => ({
      downloads: {
        ...state.downloads,
        [download_id]: {
          download_id,
          mod_name: payload.modName,
          mod_url: payload.modUrl,
          payload,
          downloaded: 0,
          total: 100,
          status: 'Starting...',
          is_complete: false,
          is_error: false,
          timestamp: Date.now(),
          speed_bytes_per_sec: 0,
          eta_seconds: 0,
        },
      },
    }));

    // Seed GameBanana preview image cache if modData has image
    const gbModId = payload.gbModId ?? payload.modData?._idRow;
    if (gbModId && payload.modData) {
      // The mod page is already in hand, so seeding here saves the library a
      // GameBanana round trip for every freshly downloaded mod.
      const onlineImageUrl = getGbPreviewUrl(payload.modData);
      if (onlineImageUrl) {
        useAppStore.getState().setGbPreviewUrls({ [gbModId]: onlineImageUrl });
      }
    }

    // 2. Invoke Rust backend
    const { maxDownloadAttempts, downloadRetryInterval } = useAppStore.getState();
    try {
      await invoke('download_gb_mod', {
        downloadId: download_id,
        maxAttempts: maxDownloadAttempts,
        retryInterval: downloadRetryInterval,
        gbModId: payload.gbModId ?? payload.modData?._idRow ?? null,
        downloadUrl: payload.downloadUrl,
        fileName: payload.fileName,
        author: payload.modData?._aSubmitter?._sName || null,
        sourceUrl:
          payload.modUrl ||
          (payload.gbModId || payload.modData?._idRow
            ? `https://gamebanana.com/mods/${payload.gbModId || payload.modData?._idRow}`
            : null),
        gbLastUpdated: payload.modData?._tsDateUpdated || null,
        rootPath: payload.rootPath,
        winrarPath: payload.winrarPath,
        targetCategory: payload.targetCategory,
      });
    } catch (e: any) {
      // Immediate failure
      set((state) => {
        const dl = state.downloads[download_id];
        if (!dl) return state;
        const newDl = { ...dl, is_error: true, is_complete: true, error_msg: e.toString() };
        const newDownloads = { ...state.downloads };
        delete newDownloads[download_id];

        return {
          downloads: newDownloads,
          history: [newDl, ...state.history].slice(0, 10),
        };
      });
    }
  },

  retryDownload: (download_id: string) => {
    const { history, startDownload } = get();
    const item = history.find((h) => h.download_id === download_id);
    if (item) {
      startDownload(item.payload);
    }
  },

  addOrUpdateProgress: (payload) =>
    set((state) => {
      if (!state.downloads[payload.download_id]) return state;

      const eta =
        payload.speed_bytes_per_sec > 0
          ? (payload.total - payload.downloaded) / payload.speed_bytes_per_sec
          : 0;

      return {
        downloads: {
          ...state.downloads,
          [payload.download_id]: {
            ...state.downloads[payload.download_id],
            downloaded: payload.downloaded,
            total: payload.total,
            status: payload.status,
            speed_bytes_per_sec: payload.speed_bytes_per_sec,
            eta_seconds: eta,
          },
        },
      };
    }),

  setComplete: (eventPayload) =>
    set((state) => {
      const dl = state.downloads[eventPayload.download_id];
      if (!dl) return state;

      // Parse results to get paths if successful
      const install_paths =
        eventPayload.results?.map((r) => r.full_path).filter((p) => p !== undefined) ?? [];

      const newDl = {
        ...dl,
        is_complete: true,
        is_error: !!eventPayload.error,
        status: eventPayload.error ? 'Failed' : 'Completed',
        error_msg: eventPayload.error,
        install_paths: install_paths.length > 0 ? install_paths : undefined,
        install_results: eventPayload.results,
      };

      if (!eventPayload.error) {
        useAppStore.getState().incrementStat('modsInstalledGB');
        playInstallSuccessSound();
      }

      const newDownloads = { ...state.downloads };
      delete newDownloads[eventPayload.download_id];

      return {
        downloads: newDownloads,
        history: [newDl, ...state.history].slice(0, 10),
      };
    }),

  clearHistory: () => set({ history: [] }),
}));
