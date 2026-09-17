import { useState, useEffect, memo } from 'react';
import { useTranslation } from '../../hooks/useTranslation';

export interface ModCardNotesProps {
  initialNotes?: string | null;
  isEditing: boolean;
  onSave: (note: string) => Promise<void>;
  onCancel: () => void;
}

export const ModCardNotes = memo(function ModCardNotes({
  initialNotes = '',
  isEditing,
  onSave,
  onCancel,
}: ModCardNotesProps) {
  const { t } = useTranslation();
  const safeInitialNotes = initialNotes ?? '';
  const [noteText, setNoteText] = useState(safeInitialNotes);
  const [isCollapsed, setIsCollapsed] = useState(true);

  useEffect(() => {
    setNoteText(initialNotes ?? '');
  }, [initialNotes]);

  if (isEditing) {
    return (
      <div
        className="flex flex-col gap-2 bg-black/40 p-2.5 rounded-xl border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <textarea
          value={noteText ?? ''}
          onChange={(e) => setNoteText(e.target.value)}
          maxLength={500}
          placeholder={t('notes_placeholder')}
          className="w-full bg-transparent text-xs text-textMain placeholder-textMuted/50 focus:outline-none resize-none h-16 custom-scrollbar"
        />
        <div className="flex justify-between items-center text-[10px] text-textMuted">
          <span>{(noteText || '').length}/500</span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => {
                setNoteText(safeInitialNotes);
                onCancel();
              }}
              className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-textMuted transition-colors font-semibold cursor-pointer"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="button"
              onClick={() => onSave((noteText || '').trim())}
              className="px-2.5 py-1 rounded bg-primary text-white hover:bg-primary/80 transition-colors font-semibold shadow-sm cursor-pointer"
            >
              {t('save', 'Save')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!initialNotes) return null;

  return (
    <div className="flex flex-col gap-1">
      <p
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`text-xs text-textMuted/80 italic cursor-pointer hover:text-textMain transition-colors ${
          isCollapsed ? 'line-clamp-2' : ''
        }`}
        title={isCollapsed ? 'Click to expand notes' : 'Click to collapse notes'}
      >
        "{initialNotes}"
      </p>
    </div>
  );
});
