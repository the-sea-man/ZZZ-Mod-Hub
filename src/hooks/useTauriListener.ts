import { useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/**
 * Safely subscribes to a Tauri event inside a React component.
 *
 * Handles the async gap between calling `listen()` and the returned
 * `UnlistenFn` — if the component unmounts before the promise resolves,
 * the listener is immediately torn down, preventing ghost handlers.
 *
 * @param event  - The Tauri event name (e.g. "download-progress")
 * @param handler - Callback that receives the event payload
 * @param deps   - React dependency array (re-subscribes when deps change)
 *
 * @example
 * useTauriListener<DownloadProgressPayload>("download-progress", (payload) => {
 *   useDownloadStore.getState().addOrUpdateProgress(payload);
 * });
 */
export function useTauriListener<T = unknown>(
  event: string,
  handler: (payload: T) => void,
  deps: React.DependencyList = []
) {
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    let isCleaningUp = false;

    listen<T>(event, (e) => handler(e.payload)).then((fn: UnlistenFn) => {
      if (isCleaningUp) {
        // Component unmounted before the promise resolved — tear down immediately
        fn();
      } else {
        unlisten = fn;
      }
    });

    return () => {
      isCleaningUp = true;
      if (unlisten) unlisten();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
