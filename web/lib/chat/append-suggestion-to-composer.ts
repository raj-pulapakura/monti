/**
 * Adds a suggestion to the composer. If there is already text, appends after
 * a blank line so each block stays readable.
 */
export function appendSuggestionToComposer(
  currentText: string,
  suggestionPrompt: string,
): string {
  const trimmedEnd = currentText.replace(/\s+$/, '');
  if (trimmedEnd.length === 0) {
    return suggestionPrompt;
  }
  return `${trimmedEnd}\n\n${suggestionPrompt}`;
}
