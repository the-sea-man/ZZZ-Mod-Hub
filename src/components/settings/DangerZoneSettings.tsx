import { useTranslation } from '../../hooks/useTranslation';
import { confirm } from '@tauri-apps/plugin-dialog';

export function DangerZoneSettings() {
  const { t } = useTranslation();

  const handleReset = async () => {
    const confirmed = await confirm(
      t('danger_reset_confirm', {
        defaultValue:
          'Are you sure you want to factory reset the Mod Manager? This will erase all settings, paths, and local data. Your mods will NOT be deleted from your disk.',
      }),
      {
        title: t('factory_reset', { defaultValue: 'Factory Reset' }),
        kind: 'warning',
      }
    );

    if (confirmed) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="glass-panel border border-red-500/30 rounded-2xl p-6 relative overflow-hidden group mt-12 shadow-xl">
      <div className="absolute inset-0 bg-red-500/10 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-bold text-red-500 mb-2">
            {t('danger_zone', { defaultValue: 'Danger Zone' })}
          </h2>
          <p className="text-red-400/80 text-sm">
            {t('danger_zone_desc', { defaultValue: 'Destructive actions that cannot be undone.' })}
          </p>
        </div>

        <button
          onClick={handleReset}
          className="px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-500 font-semibold rounded-lg transition-all border border-red-500/30 whitespace-nowrap"
        >
          {t('factory_reset', { defaultValue: 'Factory Reset' })}
        </button>
      </div>
    </div>
  );
}
