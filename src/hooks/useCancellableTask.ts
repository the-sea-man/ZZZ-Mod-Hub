import { useRef, useEffect, useCallback, useState } from 'react';
import { tauriCommands } from '../services/tauriCommands';

/**
 * Hook to manage the lifecycle of a cancellable backend task.
 *
 * Guarantees:
 * 1. Automatically cancels any active in-flight task when a new task is started (supersedence).
 * 2. Automatically cancels in-flight tasks when the component unmounts.
 * 3. Safely absorbs "Operation cancelled" errors without throwing or logging error toasts.
 */
export function useCancellableTask(domainPrefix: string) {
  const activeTaskIdRef = useRef<string | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (activeTaskIdRef.current) {
        const taskId = activeTaskIdRef.current;
        activeTaskIdRef.current = null;
        tauriCommands.tasks.cancel(taskId).catch(() => {});
      }
    };
  }, []);

  const cancelCurrentTask = useCallback(async () => {
    if (activeTaskIdRef.current) {
      const taskId = activeTaskIdRef.current;
      activeTaskIdRef.current = null;
      if (isMountedRef.current) {
        setIsRunning(false);
      }
      try {
        await tauriCommands.tasks.cancel(taskId);
      } catch {
        // Ignore cancellation errors
      }
    }
  }, []);

  const runTask = useCallback(
    async <T>(taskFn: (taskId: string) => Promise<T>): Promise<T | null> => {
      // 1. Cancel previous in-flight task if any
      if (activeTaskIdRef.current) {
        const prevId = activeTaskIdRef.current;
        tauriCommands.tasks.cancel(prevId).catch(() => {});
      }

      const newTaskId = `${domainPrefix}:${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      activeTaskIdRef.current = newTaskId;
      setIsRunning(true);

      try {
        const result = await taskFn(newTaskId);
        // Only return result if this task wasn't superseded
        if (isMountedRef.current && activeTaskIdRef.current === newTaskId) {
          activeTaskIdRef.current = null;
          setIsRunning(false);
          return result;
        }
        return null;
      } catch (err: unknown) {
        const isCancelled =
          (err instanceof Error && err.message.toLowerCase().includes('cancelled')) ||
          (typeof err === 'string' && err.toLowerCase().includes('cancelled'));

        if (isMountedRef.current && activeTaskIdRef.current === newTaskId) {
          activeTaskIdRef.current = null;
          setIsRunning(false);
        }

        if (isCancelled) {
          return null; // Absorbed gracefully
        }

        throw err;
      }
    },
    [domainPrefix]
  );

  return {
    runTask,
    cancelCurrentTask,
    isRunning,
    currentTaskId: activeTaskIdRef.current,
  };
}
