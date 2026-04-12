'use client';

import { LoaderCircle } from 'lucide-react';
import { useEffect } from 'react';
import { AppModalBackdrop, AppModalRoot } from '@/app/components/app-modal';
import { useAppModalExit } from '@/app/hooks/use-app-modal-exit';

export function ConfirmModal(input: {
  title: string;
  message: string;
  confirmLabel?: string;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmLabel = input.confirmLabel ?? 'Delete';

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

  return (
    <AppModalRoot exiting={exiting}>
      <AppModalBackdrop
        ariaLabel="Dismiss"
        disabled={input.isPending || exiting}
        onDismiss={requestClose}
      />
      <div
        ref={dialogRef}
        className="app-modal-dialog confirm-modal-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <h2 id="confirm-modal-title" className="confirm-modal-title">
          {input.title}
        </h2>
        <p className="confirm-modal-message">{input.message}</p>
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
            className="confirm-modal-primary-destructive"
            disabled={input.isPending || exiting}
            onClick={input.onConfirm}
          >
            {input.isPending ? (
              <LoaderCircle
                className="composer-spinner"
                size={16}
                strokeWidth={2.4}
                aria-hidden
              />
            ) : null}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </AppModalRoot>
  );
}
