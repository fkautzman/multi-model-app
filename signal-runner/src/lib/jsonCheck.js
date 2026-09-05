// JSON-mode detection and response validation.

/** True when the prompt asks for JSON-only output. */
export function isJsonOnlyPrompt(text) {
  return /return json only/i.test(text || "");
}

/**
 * Strip a single wrapping markdown code fence, if present.
 * Providers without a native JSON mode routinely wrap valid JSON in ```json
 * fences; that is a formatting wrapper, not malformed JSON, so it is removed
 * before validating rather than reported as a parse failure.
 */
function unfence(text) {
  const t = text.trim();
  const m = t.match(/^```(?:json)?\s*\r?\n([\s\S]*?)\r?\n?```$/);
  return m ? m[1].trim() : t;
}

/**
 * Returns null when the text parses as JSON, otherwise the parser's error
 * message. Tries the raw text first, then the unfenced form.
 */
export function jsonParseError(text) {
  if (typeof text !== "string" || !text.trim()) return "empty response";
  const trimmed = text.trim();
  try {
    JSON.parse(trimmed);
    return null;
  } catch (rawErr) {
    const stripped = unfence(trimmed);
    if (stripped === trimmed) return rawErr.message;
    try {
      JSON.parse(stripped);
      return null;
    } catch (fencedErr) {
      return fencedErr.message;
    }
  }
}
