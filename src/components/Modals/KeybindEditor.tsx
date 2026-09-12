import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { ModInfo, KeybindInfo } from '../../types';
import type { ModToggleInfo } from '../../types/ipc';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { tauriCommands } from '../../services/tauriCommands';

interface KeybindEditorProps {
  mod: ModInfo | null;
  onClose: () => void;
}

export function KeybindEditor({ mod, onClose }: KeybindEditorProps) {
  const { t } = useTranslation();
  const { modsPath, incrementStat } = useAppStore();
  const [keybinds, setKeybinds] = useState<KeybindInfo[]>([]);
  const [toggles, setToggles] = useState<ModToggleInfo[]>([]);
  const [conflicts, setConflicts] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [savingToggleId, setSavingToggleId] = useState<string | null>(null);
  const [savedToggleId, setSavedToggleId] = useState<string | null>(null);

  useEffect(() => {
    if (mod) {
      setLoading(true);
      Promise.all([
        tauriCommands.mods.getKeybinds(mod.full_path),
        tauriCommands.mods.getToggles(mod.full_path),
        modsPath ? tauriCommands.mods.detectKeybindConflicts(modsPath) : Promise.resolve([]),
      ])
        .then(([binds, toggleList, conflictList]) => {
          setKeybinds(binds);
          setToggles(toggleList);
          const conflictMap: Record<string, string[]> = {};
          for (const c of conflictList) {
            conflictMap[c.key.toLowerCase()] = c.mods;
          }
          setConflicts(conflictMap);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [mod, modsPath]);

  const saveKeybind = async (
    iniFile: string,
    section: string,
    keyType: 'key' | 'back',
    oldKey: string,
    newKey: string
  ) => {
    if (!mod) return;
    try {
      const createBackup = localStorage.getItem('hud_backup_enabled') === 'true';
      await tauriCommands.mods.setKeybind(
        mod.full_path,
        iniFile,
        section,
        keyType,
        oldKey,
        newKey,
        createBackup
      );
      // Refresh keybinds & toggles
      const [updatedBinds, updatedToggles] = await Promise.all([
        tauriCommands.mods.getKeybinds(mod.full_path),
        tauriCommands.mods.getToggles(mod.full_path),
      ]);
      setKeybinds(updatedBinds);
      setToggles(updatedToggles);
      incrementStat('keybindsChanged');
    } catch (e: unknown) {
      console.error(e);
      alert(`Failed to save keybind: ${String(e)}`);
    }
  };

  const handleToggleStateChange = async (toggle: ModToggleInfo, val: number) => {
    if (!mod) return;
    if (toggle.current_value === val) return;
    const oldVal = toggle.current_value;

    // Optimistic UI update
    setToggles((prev) =>
      prev.map((item) => (item.id === toggle.id ? { ...item, current_value: val } : item))
    );
    setSavingToggleId(toggle.id);

    try {
      const createBackup = localStorage.getItem('hud_backup_enabled') === 'true';
      await tauriCommands.mods.setToggleState(
        mod.full_path,
        toggle.ini_file,
        toggle.variable,
        val,
        createBackup
      );
      setSavedToggleId(toggle.id);
      setTimeout(() => {
        setSavedToggleId((cur) => (cur === toggle.id ? null : cur));
      }, 2500);
    } catch (e: unknown) {
      console.error('Failed to change toggle state:', e);
      // Revert optimistic update
      setToggles((prev) =>
        prev.map((item) => (item.id === toggle.id ? { ...item, current_value: oldVal } : item))
      );
      alert(t('state_change_failed', { error: String(e) }));
    } finally {
      setSavingToggleId(null);
    }
  };

  // Keyboard: Escape to close
  useEffect(() => {
    if (!mod) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mod, onClose]);

  if (!mod) return null;

  // Filter out keybinds that are already represented as toggles
  const toggleSections = new Set(toggles.map((t) => `${t.ini_file}::${t.section.toLowerCase()}`));
  const standaloneKeybinds = keybinds.filter(
    (bind) => !toggleSections.has(`${bind.ini_file}::${bind.section.toLowerCase()}`)
  );

  const hasContent = toggles.length > 0 || keybinds.length > 0;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 app-blur z-[100] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border border-textMain/10 rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl"
      >
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-textMain">
              {t('edit_toggles_and_keybinds')}: <span className="text-primary">{mod.name}</span>
            </h2>
            <p className="text-xs text-textMuted mt-1">
              {t(
                'toggle_modal_subtitle',
                'Select the active outfit style or customize the hotkeys.'
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-textMuted hover:text-textMain text-2xl leading-none"
            aria-label={t('close')}
          >
            &times;
          </button>
        </div>

        <div className="overflow-y-auto flex-1 pr-2 custom-scrollbar flex flex-col gap-4">
          {loading ? (
            <div className="text-center text-textMuted py-12 flex flex-col items-center gap-3">
              <Loader2 size={24} className="animate-spin text-primary" />
              <span>{t('checking')}</span>
            </div>
          ) : !hasContent ? (
            <div className="text-center text-textMuted py-12">{t('no_toggles_or_keybinds')}</div>
          ) : (
            <>
              {/* Toggles List */}
              {toggles.map((toggle) => (
                <div
                  key={toggle.id}
                  className="bg-background/50 border border-textMain/10 rounded-xl p-4.5 flex flex-col gap-3.5 shadow-sm"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-textMain text-base">{toggle.display_name}</h3>
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                          {toggle.variable}
                        </span>
                      </div>
                      <p className="text-xs text-textMuted font-mono mt-1">
                        {toggle.ini_file} &middot; [{toggle.section}]
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {savedToggleId === toggle.id && (
                        <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 animate-fadeIn">
                          <Check size={12} /> {t('toggle_state_saved')}
                        </span>
                      )}
                      {savingToggleId === toggle.id && (
                        <span className="text-xs text-primary font-semibold flex items-center gap-1">
                          <Loader2 size={12} className="animate-spin" /> {t('saving')}
                        </span>
                      )}
                      <span className="text-xs bg-surface border border-textMain/10 px-2 py-1 rounded text-textMuted">
                        Type: {toggle.bind_type}
                      </span>
                    </div>
                  </div>

                  {/* Manual State Selector */}
                  <div className="bg-surface/50 border border-textMain/5 rounded-xl p-3 flex flex-col gap-2">
                    <span className="text-xs font-bold text-textMuted uppercase tracking-wider">
                      {t('toggle_active_state')}:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {toggle.values.map((val, idx) => {
                        const isCurrent = toggle.current_value === val;
                        const label = toggle.labels[idx] || `Value ${val}`;
                        return (
                          <button
                            key={`${toggle.id}-val-${val}`}
                            type="button"
                            onClick={() => handleToggleStateChange(toggle, val)}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                              isCurrent
                                ? 'bg-primary text-white border border-primary shadow-md shadow-primary/20 ring-1 ring-primary/40'
                                : 'bg-surface hover:bg-textMain/10 text-textMuted hover:text-textMain border border-textMain/10'
                            }`}
                          >
                            {isCurrent && <Check size={13} className="shrink-0" />}
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Keybinds */}
                  {(toggle.key || toggle.back_key) && (
                    <div className="space-y-2 pt-1 border-t border-textMain/5">
                      {toggle.key && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-textMuted w-20">Key:</span>
                            <input
                              type="text"
                              defaultValue={toggle.key}
                              onBlur={(e) => {
                                if (e.target.value !== toggle.key) {
                                  saveKeybind(
                                    toggle.ini_file,
                                    toggle.section,
                                    'key',
                                    toggle.key || '',
                                    e.target.value
                                  );
                                }
                              }}
                              className="flex-1 bg-surface border border-textMain/10 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                            />
                          </div>
                          {toggle.key.trim().toLowerCase() &&
                            conflicts[toggle.key.trim().toLowerCase()] && (
                              <div className="flex items-center gap-1.5 text-xs text-amber-400 pl-24">
                                <AlertTriangle size={13} className="shrink-0" />
                                <span>
                                  {t('key_conflict_warning', 'Also used by: {{mods}}', {
                                    mods: conflicts[toggle.key.trim().toLowerCase()]
                                      .filter((m) => !mod.full_path.includes(m) && mod.name !== m)
                                      .join(', '),
                                  })}
                                </span>
                              </div>
                            )}
                        </div>
                      )}

                      {toggle.back_key && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-textMuted w-20">Back Key:</span>
                            <input
                              type="text"
                              defaultValue={toggle.back_key}
                              onBlur={(e) => {
                                if (e.target.value !== toggle.back_key) {
                                  saveKeybind(
                                    toggle.ini_file,
                                    toggle.section,
                                    'back',
                                    toggle.back_key || '',
                                    e.target.value
                                  );
                                }
                              }}
                              className="flex-1 bg-surface border border-textMain/10 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {toggle.condition && (
                    <div className="text-xs text-textMuted font-mono">
                      <span className="opacity-50">Condition:</span> {toggle.condition}
                    </div>
                  )}
                </div>
              ))}

              {/* Standalone Keybinds (without toggle variables) */}
              {standaloneKeybinds.map((bind, i) => (
                <div
                  key={`standalone-${i}`}
                  className="bg-background/50 border border-textMain/5 rounded-xl p-4"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-primary">{bind.section}</h3>
                      <p className="text-xs text-textMuted font-mono mt-1">{bind.ini_file}</p>
                    </div>
                    <span className="text-xs bg-surface border border-textMain/10 px-2 py-1 rounded text-textMuted">
                      Type: {bind.bind_type}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {bind.keys.map((k, j) => {
                      const cleanK = k.trim().toLowerCase();
                      const conflictingMods =
                        cleanK && conflicts[cleanK]
                          ? conflicts[cleanK].filter(
                              (m) => !mod.full_path.includes(m) && mod.name !== m
                            )
                          : [];

                      return (
                        <div key={`key-${j}`} className="space-y-1">
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-textMuted w-20">Key:</span>
                            <input
                              type="text"
                              defaultValue={k}
                              onBlur={(e) => {
                                if (e.target.value !== k) {
                                  saveKeybind(
                                    bind.ini_file,
                                    bind.section,
                                    'key',
                                    k,
                                    e.target.value
                                  );
                                }
                              }}
                              className="flex-1 bg-surface border border-textMain/10 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                            />
                          </div>
                          {conflictingMods.length > 0 && (
                            <div className="flex items-center gap-1.5 text-xs text-amber-400 pl-24">
                              <AlertTriangle size={13} className="shrink-0" />
                              <span>
                                {t('key_conflict_warning', 'Also used by: {{mods}}', {
                                  mods: conflictingMods.join(', '),
                                })}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {bind.back_keys.map((k, j) => {
                      return (
                        <div key={`back-${j}`} className="space-y-1">
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-textMuted w-20">Back Key:</span>
                            <input
                              type="text"
                              defaultValue={k}
                              onBlur={(e) => {
                                if (e.target.value !== k) {
                                  saveKeybind(
                                    bind.ini_file,
                                    bind.section,
                                    'back',
                                    k,
                                    e.target.value
                                  );
                                }
                              }}
                              className="flex-1 bg-surface border border-textMain/10 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {bind.condition && (
                    <div className="mt-3 text-xs text-textMuted font-mono">
                      <span className="opacity-50">Condition:</span> {bind.condition}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
