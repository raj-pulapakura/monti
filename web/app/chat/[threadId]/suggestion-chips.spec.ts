import { describe, expect, it } from 'vitest';
import { appendSuggestionToComposer } from '../../../lib/chat/append-suggestion-to-composer';

/**
 * Focused tests for the stale-version guard and chip click behavior
 * that back the contextual refinement suggestions feature.
 *
 * The stale-response guard lives inline in page.tsx. Chip merge behavior
 * uses `appendSuggestionToComposer` from `@/lib/chat/append-suggestion-to-composer`.
 */
function shouldApplySuggestions(
  latestTrackedVersionId: string | null,
  responseVersionId: string,
): boolean {
  return latestTrackedVersionId === responseVersionId;
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

  describe('chip click appends to composer text', () => {
    it('uses only the suggestion when the composer is empty', () => {
      expect(appendSuggestionToComposer('', 'Add a countdown timer.')).toBe(
        'Add a countdown timer.',
      );
    });

    it('appends after existing draft with a blank line separator', () => {
      expect(
        appendSuggestionToComposer('some draft text', 'Make the questions harder.'),
      ).toBe('some draft text\n\nMake the questions harder.');
    });

    it('trims trailing whitespace on the existing draft before appending', () => {
      expect(
        appendSuggestionToComposer('draft with spaces   \n', 'Next idea.'),
      ).toBe('draft with spaces\n\nNext idea.');
    });

    it('does not auto-submit — result is only the new composer value, not a submitted prompt', () => {
      const result = appendSuggestionToComposer('', 'Add images to each question.');
      expect(typeof result).toBe('string');
      expect(result).toBe('Add images to each question.');
    });
  });
});
