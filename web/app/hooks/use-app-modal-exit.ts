'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Slightly longer than dialog exit (~280ms) for reduced-motion or missing `animationend`. */
const APP_MODAL_EXIT_FALLBACK_MS = 320;

export function useAppModalExit(input: {
  onDismiss: () => void;
  /** When true, `requestClose` does nothing (e.g. async action in flight). */
  dismissBlocked?: boolean;
}) {
  const [exiting, setExiting] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const exitDoneRef = useRef(false);

  const finishExit = useCallback(() => {
    if (exitDoneRef.current) {
      return;
    }
    exitDoneRef.current = true;
    input.onDismiss();
  }, [input.onDismiss]);

  const requestClose = useCallback(() => {
    if (input.dismissBlocked || exiting) {
      return;
    }
    exitDoneRef.current = false;
    setExiting(true);
  }, [input.dismissBlocked, exiting]);

  useEffect(() => {
    if (!exiting) {
      return;
    }

    const node = dialogRef.current;
    const timer = window.setTimeout(finishExit, APP_MODAL_EXIT_FALLBACK_MS);

    const onAnimEnd = (e: AnimationEvent) => {
      if (e.target !== node) {
        return;
      }
      window.clearTimeout(timer);
      finishExit();
    };

    node?.addEventListener('animationend', onAnimEnd);
    return () => {
      window.clearTimeout(timer);
      node?.removeEventListener('animationend', onAnimEnd);
    };
  }, [exiting, finishExit]);

  return { exiting, requestClose, dialogRef };
}
