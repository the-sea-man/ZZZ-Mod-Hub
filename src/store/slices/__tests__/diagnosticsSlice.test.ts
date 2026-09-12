import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../useAppStore';
import type { ModWarning } from '../../../types/ipc';

describe('diagnosticsSlice', () => {
  beforeEach(() => {
    useAppStore.setState({
      modWarnings: {},
      staleHashes: {},
    });
  });

  it('removes specific rule warning and clears stale hashes with removeModWarning', () => {
    const rawPath = 'C:\\Mods\\Anby\\ThickAnby';
    const normPath = 'C:/Mods/Anby/ThickAnby';

    const warnings: ModWarning[] = [
      {
        rule_id: 'outdated_version',
        level: 'outdated_version',
        message: 'Mod is outdated',
      },
      {
        rule_id: 'missing_resource_definition',
        level: 'crash_risk',
        message: 'Resource missing',
      },
    ];

    useAppStore.getState().setModWarnings({
      [rawPath]: warnings,
    });
    useAppStore.setState({
      staleHashes: { [rawPath]: ['12345678'] },
    });

    expect(useAppStore.getState().getFilteredWarnings(normPath)).toHaveLength(2);
    expect(useAppStore.getState().staleHashes[rawPath]).toBeDefined();

    // Remove only outdated_version
    useAppStore.getState().removeModWarning(rawPath, 'outdated_version');

    const remaining = useAppStore.getState().getFilteredWarnings(normPath);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].rule_id).toBe('missing_resource_definition');
    expect(useAppStore.getState().staleHashes[rawPath]).toBeUndefined();

    // Calling removeModWarning without ruleId clears all remaining warnings for this mod
    useAppStore.getState().removeModWarning(normPath);
    expect(useAppStore.getState().getFilteredWarnings(rawPath)).toHaveLength(0);
  });
});
