import { useState, useRef } from 'react';
import { Download, Upload, ShieldCheck } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { exportFullBackup, importFullBackup } from '../../utils/storage';
import { useAppStore } from '../../store/useAppStore';
import { confirm, message } from '@tauri-apps/plugin-dialog';

export function BackupSettings() {
  const { t } = useTranslation();
  const { showToast, highlightTargetId } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleExport = () => {
    try {
      setIsExporting(true);
      const json = exportFullBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `zzz_mod_hub_backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      useAppStore.getState().incrementStat('backupsExported');
      showToast(
        t('backup_exported_success', { defaultValue: 'Settings backup exported successfully!' })
      );
    } catch (e) {
      console.error(e);
      showToast(t('backup_export_failed', { defaultValue: 'Failed to export settings backup.' }));
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmed = await confirm(
      t('backup_import_confirm', {
        defaultValue:
          'Importing this backup will overwrite your current settings and profiles. Do you want to proceed?',
      }),
      {
        title: t('backup_import_title', { defaultValue: 'Restore Settings Backup' }),
        kind: 'warning',
      }
    );

    if (!confirmed) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      setIsImporting(true);
      const text = await file.text();
      const success = importFullBackup(text);
      if (success) {
        await message(
          t('backup_import_success_msg', {
            defaultValue:
              'Backup restored successfully! The application will now reload to apply all settings.',
          }),
          { title: t('success', { defaultValue: 'Success' }), kind: 'info' }
        );
        window.location.reload();
      } else {
        await message(
          t('backup_import_invalid', {
            defaultValue: 'Invalid or corrupted backup file. No changes were made.',
          }),
          { title: t('error', { defaultValue: 'Error' }), kind: 'error' }
        );
      }
    } catch (err) {
      console.error(err);
      await message(
        t('backup_import_error', {
          defaultValue: 'An error occurred while reading the backup file.',
        }),
        { title: t('error', { defaultValue: 'Error' }), kind: 'error' }
      );
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div
      data-highlight-id="backup_settings"
      className={`glass-panel rounded-2xl p-6 border border-white/5 space-y-6 shadow-xl transition-all ${
        highlightTargetId === 'backup_settings' ? 'highlight-target' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
          <ShieldCheck size={22} />
        </div>
        <div>
          <h2 className="text-xl font-black text-textMain tracking-tight">
            {t('backup_restore_title', { defaultValue: 'Backup & Restore Settings' })}
          </h2>
          <p className="text-sm text-textMuted">
            {t('backup_restore_desc', {
              defaultValue:
                'Export your complete configuration, custom themes, hotkeys, and mod profiles to a file or restore them on another PC.',
            })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Export Card */}
        <div className="p-4 rounded-xl glass-panel-bg border border-white/5 flex flex-col justify-between gap-4">
          <div>
            <div className="font-bold text-textMain flex items-center gap-2">
              <Download size={16} className="text-primary" />
              {t('export_backup', { defaultValue: 'Export Settings Backup' })}
            </div>
            <p className="text-xs text-textMuted mt-1 leading-relaxed">
              {t('export_backup_desc', {
                defaultValue:
                  'Saves paths, custom hotkeys, warning rules, theme preferences, and all mod profiles into a portable .json file.',
              })}
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full py-2.5 px-4 rounded-xl bg-primary text-white font-bold hover:bg-primary/80 transition-all flex items-center justify-center gap-2 text-sm shadow-md shadow-primary/20"
          >
            <Download size={16} />
            {t('export_backup_btn', { defaultValue: 'Export Backup (.json)' })}
          </button>
        </div>

        {/* Import Card */}
        <div className="p-4 rounded-xl glass-panel-bg border border-white/5 flex flex-col justify-between gap-4">
          <div>
            <div className="font-bold text-textMain flex items-center gap-2">
              <Upload size={16} className="text-primary" />
              {t('import_backup', { defaultValue: 'Restore Settings Backup' })}
            </div>
            <p className="text-xs text-textMuted mt-1 leading-relaxed">
              {t('import_backup_desc', {
                defaultValue:
                  'Loads configuration from a previously exported .json backup and seamlessly updates your setup.',
              })}
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFileChange}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="w-full py-2.5 px-4 rounded-xl bg-surface hover:bg-white/10 text-textMain border border-white/10 font-bold transition-all flex items-center justify-center gap-2 text-sm"
          >
            <Upload size={16} />
            {t('import_backup_btn', { defaultValue: 'Select Backup File...' })}
          </button>
        </div>
      </div>
    </div>
  );
}
