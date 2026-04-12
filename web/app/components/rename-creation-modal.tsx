'use client';

import { LoaderCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { AppModalBackdrop, AppModalRoot } from '@/app/components/app-modal';
import { useAppModalExit } from '@/app/hooks/use-app-modal-exit';

export function RenameCreationModal(input: {
  draft: string;
  onDraftChange: (value: string) => void;
  error: string | null;
  isPending: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { exiting, requestClose, dialogRef } = useAppModalExit({
    onDismiss: input.onCancel,
    dismissBlocked: input.isPending,
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [requestClose]);

  useEffect(() => {
    queueMicrotask(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, []);

  return (
    <AppModalRoot exiting={exiting}>
      <AppModalBackdrop
        ariaLabel="Dismiss"
        disabled={input.isPending || exiting}
        onDismiss={requestClose}
      />
      <div
        ref={dialogRef}
        className="app-modal-dialog rename-creation-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-creation-modal-title"
      >
        <h2 id="rename-creation-modal-title" className="confirm-modal-title">
          Rename creation
        </h2>
        <p className="rename-creation-modal-hint">
          This is the title shown in your library and on the published experience.
        </p>
        <input
          ref={inputRef}
          type="text"
          className="rename-creation-modal-input"
          value={input.draft}
          onChange={(event) => input.onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              input.onSave();
            }
          }}
          disabled={input.isPending || exiting}
          aria-label="Creation title"
        />
        {input.error ? (
          <p className="rename-creation-modal-error" role="status">
            {input.error}
          </p>
        ) : null}
        <div className="confirm-modal-actions">
          <button
            type="button"
            className="confirm-modal-secondary"
            disabled={input.isPending || exiting}
            onClick={requestClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rename-creation-modal-primary"
            disabled={
              input.isPending || exiting || input.draft.trim().length === 0
            }
            onClick={input.onSave}
          >
            {input.isPending ? (
              <LoaderCircle
                className="composer-spinner"
                size={16}
                strokeWidth={2.4}
                aria-hidden
              />
            ) : null}
            <span>Save</span>
          </button>
        </div>
      </div>
    </AppModalRoot>
  );
}
