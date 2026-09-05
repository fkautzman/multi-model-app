// Single source of truth for every configured model string.
//
// Gemini takes its model in the request URL rather than the body, so
// vite.config.js imports this too — the pinned model cannot drift between the
// proxy and the client, and there is exactly one place to change it.
export const MODEL_IDS = {
  perplexity: "sonar",
  gemini: "gemini-3.8-flash",
  chatgpt: "gpt-6-astra",
  claude: "claude-sonnet-5",
  grok: "grok-4.6",
};
