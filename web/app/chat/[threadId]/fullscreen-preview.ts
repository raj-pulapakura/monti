export type PreviewFullscreenAction = 'enter' | 'exit';

type FullscreenDocumentLike = Pick<Document, 'fullscreenElement' | 'fullscreenEnabled'>;

export function isPreviewFullscreenSupported(
  documentLike: FullscreenDocumentLike | null | undefined,
): boolean {
  return documentLike?.fullscreenEnabled === true;
}

export function isPreviewStageFullscreen(
  previewStageElement: Element | null,
  fullscreenElement: Element | null | undefined,
): boolean {
  return previewStageElement !== null && fullscreenElement === previewStageElement;
}

export function toPreviewFullscreenErrorMessage(
  action: PreviewFullscreenAction,
  error: unknown,
): string {
  if (hasErrorName(error, 'NotAllowedError')) {
    return action === 'enter'
      ? 'Fullscreen was blocked by the browser. Try again from the preview button.'
      : 'Fullscreen exit was blocked by the browser. Press Esc to leave the preview.';
  }

  return action === 'enter'
    ? 'Fullscreen could not start. Keep using the inline preview and try again.'
    : 'Fullscreen could not be exited cleanly. Press Esc or try the close button again.';
}

function hasErrorName(error: unknown, expectedName: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === expectedName
  );
}
