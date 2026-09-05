# Signal Runner

Local React app that runs prompts across Perplexity, Gemini, ChatGPT, Claude, and Grok in parallel, then synthesizes results through a dedicated Claude synthesis layer. Built for rapid multi-model signal comparison — see where models agree, diverge, and what actions they collectively surface.

---

## Architecture

- **Framework:** Vite + React (no TypeScript, inline styles, no CSS framework)
- **Panes:** Perplexity (Research), Gemini (Synthesis), ChatGPT (Structure), Claude (Nuance), Grok (Contrarian)
- **Synthesis:** Three Claude Opus 5 synthesis modes run in parallel after each prompt turn — Disagreements, Key Insights, Action Items
- **API layer:** Vite dev-server proxy middleware forwards requests to model APIs (see `vite.config.js`). Each `/api/<provider>` route binds to exactly one endpoint; there is no fallback or cross-vendor routing
- **Model strings:** Declared once in `src/lib/models.js` and imported by both the client and the proxy, so the configured model cannot drift between them
- **Provider calls:** Every pane goes through `callProvider()` in `src/lib/providers.js`, which treats an HTTP 200 with no usable text as an error
- **Sessions:** Stored in `localStorage` under key `signal-runner-sessions-v2` via `src/lib/sessionStore.js`
- **Keys:** Loaded from `.env.local` via `import.meta.env`; overridable at runtime via the in-app key panel

---

## Setup

```bash
git clone <repo>
cd signal-runner
npm install

# Create your env file (never committed)
cp .env.example .env.local
# Edit .env.local and fill in your API keys

npm run dev
# Open http://localhost:5173
```

---

## Environment Variables

Required in `.env.local`:

```bash
VITE_PERPLEXITY_KEY=   # pplx-... from console.perplexity.ai
VITE_GEMINI_KEY=       # AIza... from Google AI Studio
VITE_OPENAI_KEY=       # sk-... from platform.openai.com
VITE_CLAUDE_KEY=       # sk-ant-... from console.anthropic.com
VITE_GROK_KEY=         # xai-... from console.x.ai
```

All five are prefixed with `VITE_` so Vite exposes them client-side. A key entered in the in-app key panel overrides the env value for that provider. If neither is set, the proxy returns a 401 and the pane shows `No API key for <provider>` — it does not fall through to any other auth.

---

## Models and Output Ceilings

| Pane | Configured model | Output ceiling | Notes |
|---|---|---|---|
| Perplexity | `sonar` | 16,000 | |
| Gemini | `gemini-3.8-flash` | 16,000 | Thinking tokens count against this ceiling, so the visible share is lower |
| ChatGPT | `gpt-6-astra` | 16,000 | `reasoning_effort: low`; reasoning tokens share this budget |
| Claude | `claude-sonnet-5` | 16,000 | Thinking disabled on the pane call |
| Grok | `grok-4.6` | 4,000 | |
| Synthesis | `claude-opus-5` | 8,000 | Thinking on |

Change a model string in `src/lib/models.js` only. Ceilings live on each pane's request body in `src/App.jsx`.

---

## Key Features

- **Model toggles** — enable/disable any model per-session; at least one must stay active
- **Multi-turn conversations** — follow-up prompts build context per-model; models that skipped a turn get their prior messages collapsed
- **Parallel synthesis** — all three synthesis modes run simultaneously after each turn via `Promise.allSettled`
- **Sessions** — auto-saved to localStorage with auto-generated titles; rename, delete, and reload from sidebar
- **Provenance stamp** — every pane header and export section shows `model_configured` (from `models.js`) and `model_reported` (the provider's own version field: Gemini `modelVersion`, OpenAI and Claude `model`). The header renders `model_reported` in amber when it differs from the configured string. Never trust a model's self-description in prose — they routinely name the wrong vendor and version
- **JSON mode** — when the prompt contains `Return JSON only`, Gemini gets `responseMimeType: application/json` and ChatGPT gets `response_format: json_object`. Every pane's response is then parsed; on failure the pane content gets `JSON_INVALID: <parser error>` appended so the export flags it. One wrapping markdown code fence is stripped before parsing
- **Error surfacing** — a provider failure of any kind (HTTP error, non-JSON body, or an HTTP 200 carrying no text) shows in the pane as `<Model> failed: <reason>` and logs status, finish reason, usage, and the full response body to the browser console as it happens

---

## Markdown Export

Two export paths, both in `src/lib/exportUtils.js`:

- **Per-pane export** (download button on a pane) — that model's output across every turn
- **Full session export** (header button) — prompt, every pane, and all three synthesis results

Every pane writes a section on every export — one of the output, the verbatim error text, or `NO_RESPONSE (recorded <timestamp>)`. Each section carries `model_configured` and `model_reported`. The section list is the union of enabled models and any model with recorded output, so toggling a pane off after a run does not drop its results.

---

## File Structure

```
src/
├── App.jsx                  # State orchestration, MODELS definitions, send logic, synthesis
├── main.jsx                 # React entry point
├── components/
│   ├── Icons.jsx            # Shared SVG icon components
│   ├── ModelOutput.jsx      # Single pane: header with provenance, transcript, export
│   ├── PromptInput.jsx      # Textarea + send button + model toggle strip
│   ├── Sidebar.jsx          # Session list, new/rename/delete actions
│   └── SynthesisTabs.jsx    # Three-tab synthesis UI
└── lib/
    ├── constants.js         # SYNTH_MODES shared between App and SynthesisTabs
    ├── exportUtils.js       # Markdown export builders and download helper
    ├── jsonCheck.js         # JSON-only prompt detection and response validation
    ├── models.js            # MODEL_IDS — single source for every model string
    ├── providers.js         # callProvider() and per-provider response extractors
    └── sessionStore.js      # localStorage CRUD for sessions
vite.config.js               # Dev-server proxy; imports models.js for the Gemini URL
```
