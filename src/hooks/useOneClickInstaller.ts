import { useEffect, useCallback, useRef } from 'react';
import { useTauriListener } from './useTauriListener';
import { useAppStore } from '../store/useAppStore';
import { useDownloadStore } from '../store/useDownloadStore';
import { tauriCommands } from '../services/tauriCommands';
import { useTranslation } from './useTranslation';
import { getActiveModsPath } from '../types';
import type { OneClickPayload, RemotePairPayload } from '../types/ipc';

/**
 * Global lifecycle hook managing GameBanana 1-Click Mod Installer (`zzzmm://`)
 * and Remote Install pairing/queue events.
 *
 * Handles:
 * 1. Hot forward: Primary running instance receives `one-click-install-requested` or `one-click-pair-requested`.
 * 2. Cold start: App launched by browser protocol click; retrieves queued payload/pair on mount.
 * 3. Remote queue: Optionally polls remote install queue once on startup if paired and enabled.
 */
export function useOneClickInstaller() {
  const { t } = useTranslation();
  const recentlyTriggeredRef = useRef<Map<string, number>>(new Map());
  const hasPolledStartupRef = useRef(false);

  const handleOneClickPayload = useCallback(
    async (payload: OneClickPayload) => {
      const now = Date.now();
      const lastTriggered = recentlyTriggeredRef.current.get(payload.download_url) || 0;
      if (now - lastTriggered < 3000) {
        return;
      }
      recentlyTriggeredRef.current.set(payload.download_url, now);

      const {
        modsPath,
        winrarPath,
        activeLibraryTab,
        oneClickAutoInstall,
        alwaysAutoAssign,
        showToast,
        setActiveModPreview,
        incrementStat,
      } = useAppStore.getState();

      if (!modsPath) {
        showToast(t('one_click_missing_mods_path'));
        return;
      }

      let modDetails: any = null;
      let targetFile: any = null;

      // 1. If item_id is provided, try fetching rich metadata from GameBanana API
      if (payload.item_id) {
        try {
          modDetails = await tauriCommands.gamebanana.fetchDetails(
            payload.item_id,
            payload.item_type || 'Mod'
          );

          if (modDetails?._aFiles && Array.isArray(modDetails._aFiles)) {
            // Find the specific file matching file_id or download_url
            if (payload.file_id) {
              targetFile = modDetails._aFiles.find(
                (f: any) =>
                  f._idRow === payload.file_id || String(f._idRow) === String(payload.file_id)
              );
            }
            if (!targetFile) {
              targetFile = modDetails._aFiles.find(
                (f: any) => f._sDownloadUrl === payload.download_url
              );
            }
            if (!targetFile && modDetails._aFiles.length > 0) {
              targetFile = modDetails._aFiles[0];
            }
          }
        } catch (err) {
          console.warn('[1-Click] Failed to fetch mod details from GameBanana:', err);
        }
      }

      // 2. Resolve filenames and titles with sensible fallbacks
      let fallbackFileName =
        payload.download_url.split('/').pop()?.split('?')[0] || 'mod_download.zip';
      if (!fallbackFileName.includes('.')) {
        fallbackFileName = `${fallbackFileName}.zip`;
      }
      const fileName = targetFile?._sFile || fallbackFileName;
      const modName = modDetails?._sName || fileName.replace(/\.[^/.]+$/, '');
      const downloadUrl = payload.download_url || targetFile?._sDownloadUrl;
      const modUrl =
        modDetails?._sProfileUrl ||
        (payload.item_id ? `https://gamebanana.com/mods/${payload.item_id}` : payload.download_url);

      // 3. Prevent duplicate simultaneous downloads for the same file/URL
      const activeDownloads = Object.values(useDownloadStore.getState().downloads);
      const isAlreadyDownloading = activeDownloads.some(
        (d) => !d.is_complete && !d.is_error && d.payload.downloadUrl === downloadUrl
      );
      if (isAlreadyDownloading) {
        showToast(t('one_click_already_downloading', { modName }));
        return;
      }

      // 4. Routing: Auto-start or Open Modal
      const shouldAutoInstall = oneClickAutoInstall !== false && alwaysAutoAssign !== false;

      if (shouldAutoInstall) {
        showToast(t('one_click_download_starting', { modName }));

        useDownloadStore.getState().startDownload({
          downloadUrl,
          fileName,
          modName,
          modUrl,
          modData: modDetails,
          gbModId: payload.item_id ?? undefined,
          rootPath: getActiveModsPath(modsPath, activeLibraryTab),
          winrarPath,
          targetCategory: null, // Triggers smart auto-assignment
        });

        incrementStat('smartDownloadsUsed');
      } else {
        // Open modal for preview or manual category confirmation
        if (modDetails) {
          setActiveModPreview(modDetails);
        } else {
          // Synthetic mod object if API lookup was unavailable
          setActiveModPreview({
            _idRow: payload.item_id || 0,
            _sName: modName,
            _sProfileUrl: modUrl,
            _aFiles: [
              {
                _idRow: payload.file_id || 0,
                _sFile: fileName,
                _sDownloadUrl: downloadUrl,
                _nFilesize: 0,
              },
            ],
          });
        }
      }
    },
    [t]
  );

  const handlePairPayload = useCallback(
    async (pair: RemotePairPayload) => {
      const { setRemoteInstallCredentials, showToast } = useAppStore.getState();
      setRemoteInstallCredentials(pair.member_id, pair.secret_key);
      showToast(t('remote_install_paired_success', { memberId: pair.member_id }));

      try {
        const alias = useAppStore.getState().remoteInstallAlias;
        const queue = await tauriCommands.oneClick.pollRemoteQueue(
          pair.member_id,
          pair.secret_key,
          alias
        );
        if (queue && queue.length > 0) {
          showToast(t('remote_install_queue_items_found', { count: queue.length }));
          for (const item of queue) {
            await handleOneClickPayload(item);
          }
        }
      } catch (err) {
        console.warn('[Remote Install] Failed initial queue check after pairing:', err);
      }
    },
    [handleOneClickPayload, t]
  );

  // Hot instance event listeners
  useTauriListener<OneClickPayload>('one-click-install-requested', (payload) => {
    handleOneClickPayload(payload).catch((err) => {
      console.error('[1-Click] Error handling deep-link event:', err);
    });
  });

  useTauriListener<RemotePairPayload>('one-click-pair-requested', (payload) => {
    handlePairPayload(payload).catch((err) => {
      console.error('[Remote Install] Error handling pairing event:', err);
    });
  });

  // Cold start query check on mount
  useEffect(() => {
    tauriCommands.oneClick
      .checkPending()
      .then((pending) => {
        if (pending) {
          handleOneClickPayload(pending).catch((err) => {
            console.error('[1-Click] Error handling pending cold-start link:', err);
          });
        }
      })
      .catch((err) => {
        console.error('[1-Click] Error checking pending link:', err);
      });

    tauriCommands.oneClick
      .checkPendingPair()
      .then((pendingPair) => {
        if (pendingPair) {
          handlePairPayload(pendingPair).catch((err) => {
            console.error('[Remote Install] Error handling pending cold-start pair:', err);
          });
        }
      })
      .catch((err) => {
        console.error('[Remote Install] Error checking pending pair:', err);
      });
  }, [handleOneClickPayload, handlePairPayload]);

  // Startup remote install queue check (Rule 13: runs once on mount if enabled and paired)
  useEffect(() => {
    if (hasPolledStartupRef.current) return;
    hasPolledStartupRef.current = true;

    const {
      remoteInstallEnabled,
      remoteInstallPollOnStartup,
      remoteInstallMemberId,
      remoteInstallSecretKey,
      remoteInstallAlias,
      showToast,
    } = useAppStore.getState();

    if (
      remoteInstallEnabled &&
      remoteInstallPollOnStartup &&
      remoteInstallMemberId &&
      remoteInstallSecretKey
    ) {
      tauriCommands.oneClick
        .pollRemoteQueue(remoteInstallMemberId, remoteInstallSecretKey, remoteInstallAlias)
        .then(async (queue) => {
          if (queue && queue.length > 0) {
            showToast(t('remote_install_queue_items_found', { count: queue.length }));
            for (const item of queue) {
              await handleOneClickPayload(item);
            }
          }
        })
        .catch((err) => {
          console.warn('[Remote Install] Startup queue check error:', err);
        });
    }
  }, [handleOneClickPayload, t]);
}
