// Shared request + diagnostics layer for every model panel.
//
// The rule this enforces: an HTTP 200 carrying no usable text is an ERROR, not
// an empty panel. Reasoning models can spend their whole token budget thinking
// and return an empty message with a truncation finish reason — the request
// "succeeded", so a naive !res.ok check passes it through and the panel renders
// blank with nothing in the console. Every provider goes through callProvider
// so that failure surfaces the same way everywhere.

/** Response shape for OpenAI-compatible APIs (OpenAI, Perplexity, Grok). */
export const openAIShape = (d) => ({
  text: d.choices?.[0]?.message?.content,
  finish: d.choices?.[0]?.finish_reason,
  usage: d.usage,
});

/** Response shape for Gemini generateContent. */
export const geminiShape = (d) => {
  const candidate = d.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  return {
    text: parts.map((p) => p.text).filter(Boolean).join(""),
    finish: candidate?.finishReason,
    usage: d.usageMetadata,
  };
};

/** Response shape for the Anthropic Messages API. Text is not always block 0. */
export const claudeShape = (d) => ({
  text: d.content?.find((b) => b.type === "text")?.text,
  finish: d.stop_reason,
  usage: d.usage,
});

/**
 * POST to a provider proxy and return its text, or throw with a reason.
 * Logs the full response body to the console on every failure path.
 */
export async function callProvider({ id, label, url, body, key, extract }) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(key && { "X-API-Key": key }) },
    body: JSON.stringify(body),
  });

  const raw = await res.text();

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    console.error(`[${id}] non-JSON response`, { status: res.status, body: raw });
    throw new Error(`returned non-JSON (status ${res.status})`);
  }

  if (!res.ok) {
    console.error(`[${id}] HTTP error`, { status: res.status, body: data });
    throw new Error(data.error?.message || `${label} error (status ${res.status})`);
  }

  const { text, finish, usage } = extract(data);

  if (!text) {
    console.error(`[${id}] HTTP 200 with no usable text`, {
      status: res.status,
      finish,
      usage,
      body: data,
    });
    throw new Error(
      finish
        ? `truncated before any output — finish_reason: ${finish}`
        : "empty response — no text returned"
    );
  }

  return text;
}
