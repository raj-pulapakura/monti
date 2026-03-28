import { describe, expect, it } from 'vitest';

import {
  isPreviewFullscreenSupported,
  isPreviewStageFullscreen,
  toPreviewFullscreenErrorMessage,
} from './fullscreen-preview';

describe('fullscreen-preview helpers', () => {
  it('detects browser fullscreen support from the document capability flag', () => {
    expect(isPreviewFullscreenSupported({ fullscreenEnabled: true, fullscreenElement: null })).toBe(
      true,
    );
    expect(
      isPreviewFullscreenSupported({ fullscreenEnabled: false, fullscreenElement: null }),
    ).toBe(false);
    expect(isPreviewFullscreenSupported(null)).toBe(false);
  });

  it('treats fullscreen as active only when the preview stage is the fullscreen element', () => {
    const previewStage = {} as Element;
    const otherElement = {} as Element;

    expect(isPreviewStageFullscreen(previewStage, previewStage)).toBe(true);
    expect(isPreviewStageFullscreen(previewStage, otherElement)).toBe(false);
    expect(isPreviewStageFullscreen(null, otherElement)).toBe(false);
  });

  it('returns specific messaging for browser-blocked fullscreen entry', () => {
    expect(
      toPreviewFullscreenErrorMessage('enter', { name: 'NotAllowedError' }),
    ).toBe('Fullscreen was blocked by the browser. Try again from the preview button.');
  });

  it('returns the generic exit fallback for other fullscreen failures', () => {
    expect(toPreviewFullscreenErrorMessage('exit', new Error('boom'))).toBe(
      'Fullscreen could not be exited cleanly. Press Esc or try the close button again.',
    );
  });
});
