import { useAppStore } from '../../store/useAppStore';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

export function ConflictSettings() {
  const { t } = useTranslation();
  const { conflictWarningLevel, setConflictWarningLevel, enabledWarningRules, toggleWarningRule } =
    useAppStore();

  const rules = [
    {
      id: 'conflict',
      title: t('rule_conflict', 'Hash Conflicts'),
      desc: t(
        'rule_conflict_desc',
        'Warns when two active mods override identical 3DMigoto hash/index targets.'
      ),
      level: 'conflict',
    },
    {
      id: 'multi_character',
      title: t('rule_multi_character', 'Multi-Character Hashes'),
      desc: t(
        'rule_multi_character_desc',
        'Warns when a mod contains texture hashes belonging to multiple different characters.'
      ),
      level: 'warning',
    },
    {
      id: 'rogue_hud',
      title: t('rule_rogue_hud', 'Rogue HUD Manipulations'),
      desc: t(
        'rule_rogue_hud_desc',
        "Detects scripts that erase in-game HUD menus ('Help = null') without active character guards."
      ),
      level: 'ini_issue',
    },
    {
      id: 'standalone_help',
      title: t('rule_standalone_help', 'Standalone help.ini'),
      desc: t(
        'rule_standalone_help_desc',
        'Detects template help.ini files that inject un-namespaced rendering loops.'
      ),
      level: 'ini_issue',
    },
    {
      id: 'unconditional_key',
      title: t('rule_unconditional_key', 'Unconditional Keybinds'),
      desc: t(
        'rule_unconditional_key_desc',
        "Warns when keybinds lack a '$active == 1' condition guard, triggering across all characters."
      ),
      level: 'ini_issue',
    },
    {
      id: 'missing_vertex_limit_override',
      title: t('rule_missing_vertex_limit_override', 'Missing Vertex Limit Override'),
      desc: t(
        'rule_missing_vertex_limit_override_desc',
        'Detects incomplete VertexLimitRaise sections that cause vertex buffer overflow and mesh explosion.'
      ),
      level: 'ini_issue',
    },
    {
      id: 'missing_resource_definition',
      title: t('rule_missing_resource_definition', 'Missing Resource Definitions'),
      desc: t(
        'rule_missing_resource_definition_desc',
        'Detects undefined buffer resources that cause immediate DirectX crash to desktop.'
      ),
      level: 'crash_risk',
    },
    {
      id: 'duplicate_section',
      title: t('rule_duplicate_section', 'Duplicate Section Headers'),
      desc: t(
        'rule_duplicate_section_desc',
        'Detects duplicate section headers in INI files which trigger 3DMigoto runtime parser errors.'
      ),
      level: 'ini_issue',
    },
    {
      id: 'missing_resource_ref',
      title: t('rule_missing_resource_ref', "Missing Resource 'ref' Syntax"),
      desc: t(
        'rule_missing_resource_ref_desc',
        "Detects ZZMI texture and buffer slot assignments missing the 'ref' keyword (e.g. 'Resource\\ZZMI\\... = Resource...')."
      ),
      level: 'ini_issue',
    },
    {
      id: 'unconditional_texture_override',
      title: t('rule_unconditional_texture_override', 'Unconditional Texture Overrides'),
      desc: t(
        'rule_unconditional_texture_override_desc',
        'Detects texture re-assignments after draw calls outside conditional blocks that cause texture flickering and Z-fighting.'
      ),
      level: 'ini_issue',
    },
    {
      id: 'outdated_version',
      title: t('rule_outdated_version', 'Outdated Game Version (1.0 -> 3.1)'),
      desc: t(
        'rule_outdated_version_desc',
        'Warns when mod hashes target older game patches and need remapping.'
      ),
      level: 'outdated_version',
    },
  ];

  return (
    <div className="glass-panel p-6 rounded-2xl border border-textMain/5 shadow-xl space-y-8">
      <div className="space-y-6">
        <div className="flex items-center gap-3 border-b border-textMain/5 pb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-textMain">{t('conflict_detection_title')}</h2>
            <p className="text-sm text-textMuted">{t('conflict_detection_desc')}</p>
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-sm font-bold text-textMain block">{t('warning_level')}</label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setConflictWarningLevel('light')}
              className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
                conflictWarningLevel === 'light'
                  ? 'border-primary bg-primary/10 shadow-lg'
                  : 'border-textMain/10 bg-textMain/5 hover:border-textMain/20'
              }`}
            >
              <div className="font-bold text-textMain mb-1">{t('warning_level_light')}</div>
            </button>

            <button
              type="button"
              onClick={() => setConflictWarningLevel('heavy')}
              className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
                conflictWarningLevel === 'heavy'
                  ? 'border-amber-500 bg-amber-500/10 shadow-lg'
                  : 'border-textMain/10 bg-textMain/5 hover:border-textMain/20'
              }`}
            >
              <div className="font-bold text-textMain mb-1">{t('warning_level_heavy')}</div>
            </button>
          </div>
        </div>
      </div>

      {/* Warning Rules Configuration */}
      <div className="space-y-4 pt-4 border-t border-textMain/5">
        <div>
          <h3 className="text-lg font-bold text-textMain">
            {t('warning_rules_title', 'Script & Mod Warning Rules')}
          </h3>
          <p className="text-xs text-textMuted mt-0.5">
            {t(
              'warning_rules_desc',
              'Configure which INI script integrity checks and conflict alerts appear on mod cards.'
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rules.map((rule) => {
            const isEnabled = enabledWarningRules[rule.id] !== false;
            const isConf = rule.level === 'conflict';
            const isMC = rule.level === 'warning';
            const isCrash = rule.level === 'crash_risk';
            const isOutdated = rule.level === 'outdated_version';
            return (
              <div
                key={rule.id}
                onClick={() => toggleWarningRule(rule.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                  isEnabled
                    ? 'bg-surface/50 border-white/10 hover:border-primary/50'
                    : 'bg-surface/20 border-white/5 opacity-60 hover:opacity-80'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={() => {}}
                  className="mt-1 rounded border-textMain/20 bg-background text-primary focus:ring-primary h-4 w-4"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm text-textMain">{rule.title}</span>
                    <span
                      className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                        isCrash
                          ? 'bg-rose-500/20 text-rose-400'
                          : isConf
                            ? 'bg-red-500/20 text-red-400'
                            : isMC
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : isOutdated
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-sky-500/20 text-sky-400'
                      }`}
                    >
                      {isCrash
                        ? t('severity_crash_risk', 'Crash Risk')
                        : isConf
                          ? t('severity_conflict', 'Hash Conflict')
                          : isMC
                            ? t('severity_multi_character', 'Multi-Character')
                            : isOutdated
                              ? t('severity_outdated_version', 'Outdated Version')
                              : t('severity_ini_issue', 'INI Script Issue')}
                    </span>
                  </div>
                  <p className="text-xs text-textMuted leading-relaxed">{rule.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
