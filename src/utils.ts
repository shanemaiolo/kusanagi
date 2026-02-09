/**
 * Strips markdown code fences from the given text, returning only the inner content.
 *
 * Matches a code fence block (``` ... ```), requiring the closing fence to appear
 * on its own line so that inline backticks within the code (e.g. regex literals)
 * are not mistaken for the closing fence. If no code fence is found, returns the
 * trimmed input as-is.
 *
 * @param text - The raw text that may be wrapped in markdown code fences.
 * @returns The unwrapped code content, or the trimmed original text if no fences are present.
 */
export function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  // Match a code fence, requiring the closing ``` on its own line so that
  // inline backticks within the code (e.g. regex literals) are not mistaken
  // for the closing fence.
  const match = trimmed.match(/^```[^\n]*\n([\s\S]*)\n```/);
  if (match) {
    return match[1].trimEnd();
  }
  return trimmed;
}
