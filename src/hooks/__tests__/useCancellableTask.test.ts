import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCancellableTask } from '../useCancellableTask';
import { setMockIpcHandler, clearMockIpcHandlers } from '../../test/mockIpc';

describe('useCancellableTask', () => {
  let cancelledTasks: string[] = [];

  beforeEach(() => {
    clearMockIpcHandlers();
    cancelledTasks = [];
    setMockIpcHandler('cancel_task', (args: { taskId: string }) => {
      cancelledTasks.push(args.taskId);
      return true;
    });
  });

  it('runs a task and returns its resolved result', async () => {
    const { result } = renderHook(() => useCancellableTask('viewer'));

    let executedTaskId = '';
    let out: string | null = null;

    await act(async () => {
      out = await result.current.runTask(async (taskId) => {
        executedTaskId = taskId;
        return 'success_payload';
      });
    });

    expect(out).toBe('success_payload');
    expect(executedTaskId).toMatch(/^viewer:\d+_/);
    expect(result.current.isRunning).toBe(false);
    expect(cancelledTasks).toHaveLength(0);
  });

  it('automatically cancels previous task when a new task is started (supersedence)', async () => {
    const { result } = renderHook(() => useCancellableTask('viewer'));

    let firstTaskId = '';
    let resolveFirst: (v: string) => void;
    const firstPromise = new Promise<string>((res) => {
      resolveFirst = res;
    });

    act(() => {
      result.current.runTask(async (taskId) => {
        firstTaskId = taskId;
        return firstPromise;
      });
    });

    expect(result.current.isRunning).toBe(true);
    expect(firstTaskId).toMatch(/^viewer:/);

    // Start a second task before the first one completes
    let out2: string | null = null;
    await act(async () => {
      out2 = await result.current.runTask(async () => {
        return 'second_finished';
      });
    });

    // Verify first task was cancelled
    expect(cancelledTasks).toContain(firstTaskId);
    expect(out2).toBe('second_finished');

    // Complete the superseded first promise; its result should be ignored
    await act(async () => {
      resolveFirst('first_finished_late');
    });

    expect(result.current.isRunning).toBe(false);
  });

  it('cancels active task on unmount', () => {
    const { result, unmount } = renderHook(() => useCancellableTask('viewer'));

    let taskStartedId = '';
    act(() => {
      result.current.runTask(async (taskId) => {
        taskStartedId = taskId;
        return new Promise(() => {}); // Never finishes
      });
    });

    expect(taskStartedId).toMatch(/^viewer:/);
    expect(cancelledTasks).toHaveLength(0);

    unmount();

    expect(cancelledTasks).toContain(taskStartedId);
  });

  it('absorbs "Operation cancelled" errors gracefully without re-throwing', async () => {
    const { result } = renderHook(() => useCancellableTask('viewer'));

    let out: string | null = 'not_null';
    await act(async () => {
      out = await result.current.runTask(async () => {
        throw new Error('Operation cancelled');
      });
    });

    expect(out).toBeNull();
    expect(result.current.isRunning).toBe(false);
  });

  it('manually cancels current task via cancelCurrentTask', async () => {
    const { result } = renderHook(() => useCancellableTask('fix'));

    let fixTaskId = '';
    act(() => {
      result.current.runTask(async (taskId) => {
        fixTaskId = taskId;
        return new Promise(() => {});
      });
    });

    expect(result.current.isRunning).toBe(true);

    await act(async () => {
      await result.current.cancelCurrentTask();
    });

    expect(cancelledTasks).toContain(fixTaskId);
    expect(result.current.isRunning).toBe(false);
  });
});
