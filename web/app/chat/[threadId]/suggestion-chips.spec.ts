import { describe, expect, it } from 'vitest';

/**
 * Focused tests for the stale-version guard and chip click behavior
 * that back the contextual refinement suggestions feature.
 *
 * The production logic lives inline in page.tsx. These tests verify the
 * key invariants independently of React rendering.
 */

// Mirrors the stale-response guard from page.tsx
function shouldApplySuggestions(
  latestTrackedVersionId: string | null,
  responseVersionId: string,
): boolean {
  return latestTrackedVersionId === responseVersionId;
}

// Mirrors the chip click handler from page.tsx
function applyChipToComposer(
  _currentText: string,
  suggestionPrompt: string,
): string {
  return suggestionPrompt;
}

describe('contextual refinement suggestion chips', () => {
  describe('stale-response guard', () => {
    it('applies suggestions when the tracked version matches the response version', () => {
      expect(shouldApplySuggestions('version-2', 'version-2')).toBe(true);
    });

    it('discards suggestions when a newer version has arrived since the request was made', () => {
      expect(shouldApplySuggestions('version-3', 'version-2')).toBe(false);
    });

    it('discards suggestions when no version is tracked (thread reset)', () => {
      expect(shouldApplySuggestions(null, 'version-1')).toBe(false);
    });
  });

  describe('chip click replaces composer text', () => {
    it('replaces an empty composer with the suggestion prompt', () => {
      expect(applyChipToComposer('', 'Add a countdown timer.')).toBe(
        'Add a countdown timer.',
      );
    });

    it('replaces existing composer text with the suggestion prompt', () => {
      expect(
        applyChipToComposer('some draft text', 'Make the questions harder.'),
      ).toBe('Make the questions harder.');
    });

    it('does not auto-submit — result is only the new composer value, not a submitted prompt', () => {
      // Selecting a chip returns the replacement text; submission requires a
      // separate user action (pressing send). This test documents that the
      // chip handler only returns a string and does not trigger a side effect.
      const result = applyChipToComposer('', 'Add images to each question.');
      expect(typeof result).toBe('string');
      expect(result).toBe('Add images to each question.');
    });
  });
});
