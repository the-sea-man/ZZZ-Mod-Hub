import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModCardNotes } from '../ModCardNotes';

describe('ModCardNotes', () => {
  it('does not crash when initialNotes is null and isEditing is true', () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();

    // When a mod has metadata deserialized from Rust where notes is None, initialNotes is null
    expect(() => {
      render(
        <ModCardNotes
          initialNotes={null as any}
          isEditing={true}
          onSave={onSave}
          onCancel={onCancel}
        />
      );
    }).not.toThrow();

    // Textarea should have empty string and counter should show 0/500
    const counter = screen.getByText('0/500');
    expect(counter).toBeDefined();

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('');
  });

  it('allows editing and saving note when initially null', async () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();

    render(
      <ModCardNotes
        initialNotes={null as any}
        isEditing={true}
        onSave={onSave}
        onCancel={onCancel}
      />
    );

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'My custom mod notes' } });

    expect(screen.getByText('19/500')).toBeDefined();

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    expect(onSave).toHaveBeenCalledWith('My custom mod notes');
  });

  it('does not crash when initialNotes is undefined and isEditing is true', () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();

    expect(() => {
      render(
        <ModCardNotes
          initialNotes={undefined}
          isEditing={true}
          onSave={onSave}
          onCancel={onCancel}
        />
      );
    }).not.toThrow();

    expect(screen.getByText('0/500')).toBeDefined();
  });
});
