import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOneClickInstaller } from '../useOneClickInstaller';
import { setMockIpcHandler, clearMockIpcHandlers } from '../../test/mockIpc';
import { useAppStore } from '../../store/useAppStore';
import { useDownloadStore } from '../../store/useDownloadStore';

describe('useOneClickInstaller', () => {
  beforeEach(() => {
    clearMockIpcHandlers();
    vi.clearAllMocks();

    // Reset stores
    useAppStore.setState({
      modsPath: 'C:/ZZMI/Mods',
      winrarPath: 'C:/Program Files/WinRAR/WinRAR.exe',
      activeLibraryTab: 'playable_characters',
      oneClickInstallerEnabled: true,
      oneClickAutoInstall: true,
      alwaysAutoAssign: true,
    });

    useDownloadStore.setState({
      downloads: {},
      history: [],
    });
  });

  it('queries check_pending_one_click on mount and initiates download if payload exists', async () => {
    let checkPendingCalled = false;
    let downloadCalled = false;

    setMockIpcHandler('check_pending_one_click', () => {
      checkPendingCalled = true;
      return {
        download_url: 'https://gamebanana.com/mmdl/1773037',
        item_type: 'Mod',
        item_id: 700143,
        file_id: 1773037,
      };
    });

    setMockIpcHandler('fetch_gb_mod_details', () => ({
      _idRow: 700143,
      _sName: 'Jane Doe Skin',
      _sProfileUrl: 'https://gamebanana.com/mods/700143',
      _aFiles: [
        {
          _idRow: 1773037,
          _sFile: 'JaneDoe.zip',
          _sDownloadUrl: 'https://gamebanana.com/mmdl/1773037',
        },
      ],
    }));

    setMockIpcHandler('download_gb_mod', () => {
      downloadCalled = true;
      return null;
    });

    await act(async () => {
      renderHook(() => useOneClickInstaller());
    });

    expect(checkPendingCalled).toBe(true);
    expect(downloadCalled).toBe(true);
  });

  it('prevents duplicate in-flight downloads for the exact same URL', async () => {
    let downloadCallCount = 0;

    setMockIpcHandler('check_pending_one_click', () => null);
    setMockIpcHandler('download_gb_mod', () => {
      downloadCallCount++;
      return null;
    });

    // Simulate an existing in-flight download
    useDownloadStore.setState({
      downloads: {
        existing_1: {
          download_id: 'existing_1',
          mod_name: 'Existing Mod',
          mod_url: '',
          payload: {
            downloadUrl: 'https://gamebanana.com/mmdl/1773037',
            fileName: 'mod.zip',
            modName: 'Existing Mod',
            modUrl: '',
            modData: null,
            rootPath: 'C:/ZZMI/Mods',
            winrarPath: '',
            targetCategory: null,
          },
          downloaded: 50,
          total: 100,
          status: 'Downloading...',
          is_complete: false,
          is_error: false,
          timestamp: Date.now(),
          speed_bytes_per_sec: 1000,
          eta_seconds: 10,
        },
      },
    });

    setMockIpcHandler('check_pending_one_click', () => ({
      download_url: 'https://gamebanana.com/mmdl/1773037',
      item_type: 'Mod',
      item_id: 700143,
      file_id: 1773037,
    }));

    await act(async () => {
      renderHook(() => useOneClickInstaller());
    });

    // Should NOT have triggered download_gb_mod because it is already downloading
    expect(downloadCallCount).toBe(0);
  });

  it('shows missing mods path toast if mods directory is not configured', async () => {
    useAppStore.setState({ modsPath: '' });

    setMockIpcHandler('check_pending_one_click', () => ({
      download_url: 'https://gamebanana.com/mmdl/1773037',
      item_type: 'Mod',
      item_id: 700143,
      file_id: 1773037,
    }));

    let downloadInvoked = false;
    setMockIpcHandler('download_gb_mod', () => {
      downloadInvoked = true;
      return null;
    });

    await act(async () => {
      renderHook(() => useOneClickInstaller());
    });

    expect(downloadInvoked).toBe(false);
  });

  it('queries check_pending_pair on mount and pairs account with GameBanana credentials', async () => {
    let checkPendingPairCalled = false;
    let pollRemoteQueueCalled = false;

    setMockIpcHandler('check_pending_one_click', () => null);
    setMockIpcHandler('check_pending_pair', () => {
      checkPendingPairCalled = true;
      return {
        member_id: 888777,
        secret_key: 'gb_remote_secret_123',
      };
    });

    setMockIpcHandler('poll_remote_install_queue', (args: any) => {
      pollRemoteQueueCalled = true;
      expect(args.memberId).toBe(888777);
      expect(args.secretKey).toBe('gb_remote_secret_123');
      return [];
    });

    await act(async () => {
      renderHook(() => useOneClickInstaller());
    });

    expect(checkPendingPairCalled).toBe(true);
    expect(useAppStore.getState().remoteInstallMemberId).toBe(888777);
    expect(useAppStore.getState().remoteInstallSecretKey).toBe('gb_remote_secret_123');
    expect(pollRemoteQueueCalled).toBe(true);
  });

  it('polls remote queue on startup when paired and remoteInstallPollOnStartup is enabled', async () => {
    useAppStore.setState({
      remoteInstallEnabled: true,
      remoteInstallPollOnStartup: true,
      remoteInstallMemberId: 555666,
      remoteInstallSecretKey: 'secret_key_abc',
    });

    let pollCalled = false;
    let downloadInitiated = false;

    setMockIpcHandler('check_pending_one_click', () => null);
    setMockIpcHandler('check_pending_pair', () => null);
    setMockIpcHandler('poll_remote_install_queue', () => {
      pollCalled = true;
      return [
        {
          download_url: 'https://gamebanana.com/mmdl/200001',
          item_type: 'Mod',
          item_id: 800001,
          file_id: 200001,
        },
      ];
    });

    setMockIpcHandler('fetch_gb_mod_details', () => ({
      _idRow: 800001,
      _sName: 'Remote Mod',
      _sProfileUrl: 'https://gamebanana.com/mods/800001',
      _aFiles: [
        {
          _idRow: 200001,
          _sFile: 'Remote.zip',
          _sDownloadUrl: 'https://gamebanana.com/mmdl/200001',
        },
      ],
    }));

    setMockIpcHandler('download_gb_mod', () => {
      downloadInitiated = true;
      return null;
    });

    await act(async () => {
      renderHook(() => useOneClickInstaller());
    });

    expect(pollCalled).toBe(true);
    expect(downloadInitiated).toBe(true);
  });
});
