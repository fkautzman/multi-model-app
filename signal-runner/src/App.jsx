import { useState } from "react";
import * as sessionStore from "./lib/sessionStore";
import { SYNTH_MODES } from "./lib/constants";
import { callProvider, openAIShape, geminiShape, claudeShape } from "./lib/providers";
import { buildFullSessionExport, generateFilename, triggerDownload } from "./lib/exportUtils";
import { KeyIcon, DownloadIcon } from "./components/Icons";
import Sidebar from "./components/Sidebar";
import ModelOutput from "./components/ModelOutput";
import SynthesisTabs from "./components/SynthesisTabs";
import PromptInput from "./components/PromptInput";

const MODELS = [
  {
    id: "perplexity", label: "Perplexity", role: "Research", accent: "#20B2AA",
    call: (messages, key) => callProvider({
      id: "perplexity", label: "Perplexity", url: "/api/perplexity", key,
      body: { model: "sonar", max_tokens: 4000, messages },
      extract: openAIShape,
    }),
  },
  {
    id: "gemini", label: "Gemini", role: "Synthesis", accent: "#4285F4",
    call: (messages, key) => callProvider({
      id: "gemini", label: "Gemini", url: "/api/gemini", key,
      body: {
        contents: messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: { maxOutputTokens: 4000 },
      },
      extract: geminiShape,
    }),
  },
  {
    id: "chatgpt", label: "ChatGPT", role: "Structure", accent: "#10A37F",
    // 16000, not 4000: reasoning tokens share this budget and expanded to fill
    // 4000/8000/12000 on heavy prompts, returning an empty message. Mitigation,
    // not a guarantee — callProvider surfaces it if the model still starves.
    call: (messages, key) => callProvider({
      id: "chatgpt", label: "ChatGPT", url: "/api/openai", key,
      body: { model: "gpt-6-astra", max_completion_tokens: 16000, reasoning_effort: "low", messages },
      extract: openAIShape,
    }),
  },
  {
    id: "claude", label: "Claude", role: "Nuance", accent: "#D4763B",
    call: (messages, key) => callProvider({
      id: "claude", label: "Claude", url: "/api/claude", key,
      body: { model: "claude-sonnet-5", max_tokens: 4000, thinking: { type: "disabled" }, messages },
      extract: claudeShape,
    }),
  },
  {
    id: "grok", label: "Grok", role: "Contrarian", accent: "#E0E0E0",
    call: (messages, key) => callProvider({
      id: "grok", label: "Grok", url: "/api/grok", key,
      body: { model: "grok-4.6", max_tokens: 4000, messages },
      extract: openAIShape,
    }),
  },
];

function buildMessagesForModel(modelId, turns, currentPrompt) {
  const messages = [];
  const pending = [];
  for (const turn of turns) {
    const resp = turn.responses?.[modelId];
    if (resp && resp.content) {
      const userContent = pending.length ? [...pending, turn.user].join("\n\n") : turn.user;
      messages.push({ role: "user", content: userContent });
      messages.push({ role: "assistant", content: resp.content });
      pending.length = 0;
    } else {
      pending.push(turn.user);
    }
  }
  const finalUser = pending.length ? [...pending, currentPrompt].join("\n\n") : currentPrompt;
  messages.push({ role: "user", content: finalUser });
  return messages;
}

export default function SignalRunner() {
  const [sessions, setSessions] = useState(() => sessionStore.list());
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [turns, setTurns] = useState([]);
  const [enabled, setEnabled] = useState(() => Object.fromEntries(MODELS.map((m) => [m.id, true])));
  const [synthesis, setSynthesis] = useState({ insights: null, disagree: null, actions: null });
  const [synthesizing, setSynthesizing] = useState(false);
  const [activeSynthTab, setActiveSynthTab] = useState("disagree");
  const [loading, setLoading] = useState({});
  const [keys, setKeys] = useState({
    perplexity: import.meta.env.VITE_PERPLEXITY_KEY || "",
    gemini: import.meta.env.VITE_GEMINI_KEY || "",
    chatgpt: import.meta.env.VITE_OPENAI_KEY || "",
    claude: import.meta.env.VITE_CLAUDE_KEY || "",
    grok: import.meta.env.VITE_GROK_KEY || "",
  });
  const [showKeys, setShowKeys] = useState(false);

  const toggleModel = (id) => {
    setEnabled((e) => {
      const active = Object.values(e).filter(Boolean).length;
      if (e[id] && active <= 1) return e;
      return { ...e, [id]: !e[id] };
    });
  };

  const activeModels = MODELS.filter((m) => enabled[m.id]);

  const runAllSynthesis = async (turn, sessionId) => {
    if (!turn) return;
    const hasContent = Object.values(turn.responses).some((r) => r?.content);
    if (!hasContent) return;

    setSynthesizing(true);
    setSynthesis({ insights: null, disagree: null, actions: null });

    const allModelOutputs = MODELS
      .filter((m) => turn.responses[m.id]?.content)
      .map((m) => `## ${m.label} (${m.role})\n${turn.responses[m.id].content}`)
      .join("\n\n---\n\n");

    const synthResults = {};

    await Promise.allSettled(
      SYNTH_MODES.map(async (mode) => {
        const synthPrompt = `Original prompt: "${turn.user}"\n\nModel outputs:\n\n${allModelOutputs}\n\n---\n\nYour task: ${mode.prompt}`;
        try {
          const text = await callProvider({
            id: `claude:synth:${mode.id}`, label: "Claude", url: "/api/claude", key: keys.claude,
            body: {
              model: "claude-opus-5", max_tokens: 8000,
              messages: [{ role: "user", content: synthPrompt }],
            },
            extract: claudeShape,
          });
          synthResults[mode.id] = text;
          setSynthesis((s) => ({ ...s, [mode.id]: text }));
        } catch (e) {
          synthResults[mode.id] = `Error: ${e.message}`;
          setSynthesis((s) => ({ ...s, [mode.id]: `Error: ${e.message}` }));
        }
      })
    );

    if (sessionId) {
      sessionStore.update(sessionId, { synthesis: synthResults });
      setSessions(sessionStore.list());
    }

    setSynthesizing(false);
  };

  const handleSend = async () => {
    if (!prompt.trim() || anyLoading || synthesizing) return;
    const promptText = prompt.trim();
    const now = Date.now();

    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = String(now);
      sessionStore.save({
        id: sessionId,
        title: sessionStore.generateTitle(promptText),
        createdAt: now,
        updatedAt: now,
        enabledModels: { ...enabled },
        turns: [],
        synthesis: { insights: null, disagree: null, actions: null },
      });
      setActiveSessionId(sessionId);
      setSessions(sessionStore.list());
    }

    const newTurnId = now;
    const perModelMessages = {};
    activeModels.forEach((m) => {
      perModelMessages[m.id] = buildMessagesForModel(m.id, turns, promptText);
    });

    const newTurn = { id: newTurnId, user: promptText, responses: {} };
    let currentTurns = [...turns, newTurn];
    setTurns(currentTurns);
    setPrompt("");
    setSynthesis({ insights: null, disagree: null, actions: null });

    const init = {};
    activeModels.forEach((m) => (init[m.id] = true));
    setLoading(init);

    const responses = {};
    await Promise.allSettled(
      activeModels.map(async (model) => {
        try {
          const result = await model.call(perModelMessages[model.id], keys[model.id] || "");
          responses[model.id] = { content: result };
          currentTurns = currentTurns.map((t) =>
            t.id === newTurnId
              ? { ...t, responses: { ...t.responses, [model.id]: { content: result } } }
              : t
          );
          setTurns(currentTurns);
          sessionStore.update(sessionId, { turns: currentTurns });
        } catch (e) {
          const errorMsg = `${model.label} failed: ${e.message}`;
          responses[model.id] = { error: errorMsg };
          currentTurns = currentTurns.map((t) =>
            t.id === newTurnId
              ? { ...t, responses: { ...t.responses, [model.id]: { error: errorMsg } } }
              : t
          );
          setTurns(currentTurns);
          sessionStore.update(sessionId, { turns: currentTurns });
        } finally {
          setLoading((l) => ({ ...l, [model.id]: false }));
        }
      })
    );

    const turnForSynth = { id: newTurnId, user: promptText, responses };
    await runAllSynthesis(turnForSynth, sessionId);
  };

  const handleNewSession = () => {
    setActiveSessionId(null);
    setTurns([]);
    setSynthesis({ insights: null, disagree: null, actions: null });
    setPrompt("");
    setLoading({});
    setSynthesizing(false);
  };

  const handleLoadSession = (sessionId) => {
    const session = sessionStore.load(sessionId);
    if (!session) return;
    setActiveSessionId(sessionId);
    setTurns(session.turns || []);
    setSynthesis(session.synthesis || { insights: null, disagree: null, actions: null });
    setEnabled(session.enabledModels || Object.fromEntries(MODELS.map((m) => [m.id, true])));
    setPrompt("");
    setLoading({});
    setSynthesizing(false);
  };

  const handleDeleteSession = (sessionId) => {
    sessionStore.remove(sessionId);
    setSessions(sessionStore.list());
    if (activeSessionId === sessionId) handleNewSession();
  };

  const handleRenameSession = (sessionId, newTitle) => {
    sessionStore.update(sessionId, { title: newTitle });
    setSessions(sessionStore.list());
  };

  const handleExportAll = () => {
    if (!activeSessionId) return;
    const session = sessionStore.load(activeSessionId);
    if (!session) return;
    const content = buildFullSessionExport(session, MODELS);
    const filename = generateFilename(session.turns[0]?.user || session.title);
    triggerDownload(content, filename);
  };

  const anyLoading = Object.values(loading).some(Boolean);
  const hasHistory = turns.length > 0;
  const lastTurn = turns[turns.length - 1];
  const lastTurnDone = lastTurn && !anyLoading && activeModels.some((m) => lastTurn.responses?.[m.id]?.content);
  const colCount = activeModels.length;
  const showSynthPanel = hasHistory && (lastTurnDone || synthesizing || Object.values(synthesis).some(Boolean));

  return (
    <div style={{ height: "100vh", display: "flex", overflow: "hidden", background: "#0a0a0a", color: "#d8d8d8", fontFamily: "'IBM Plex Mono', 'Courier New', monospace" }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        * { box-sizing: border-box; }
        textarea:focus, input:focus { outline: none; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }
        .run-btn:hover:not(:disabled) { background: #fff !important; color: #000 !important; }
        .run-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .key-toggle:hover { color: #d8d8d8 !important; }
        .copy-btn:hover { opacity: 1 !important; }
        .model-toggle { transition: all 0.15s; }
        .model-toggle:hover { opacity: 1 !important; }
        .result-card { transition: border-color 0.25s; }
        .tab-btn:hover { color: #d8d8d8 !important; }
        .export-btn:hover { border-color: #555 !important; color: #d8d8d8 !important; }
        .new-session-btn:hover { background: #161616 !important; color: #888 !important; }
        .session-item { cursor: pointer; transition: background 0.1s; }
        .session-del:hover { color: #cc4444 !important; }
        .session-edit:hover { color: #d8d8d8 !important; }
      `}</style>

      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onNewSession={handleNewSession}
        onLoadSession={handleLoadSession}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
      />

      <main style={{ flex: 1, overflowY: "auto", padding: "28px 32px", minWidth: 0 }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>

          {/* Header */}
          <div style={{ marginBottom: 20, borderBottom: "1px solid #1e1e1e", paddingBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#fff", letterSpacing: "0.06em" }}>SIGNAL RUNNER</h1>
              <span style={{ fontSize: 10, color: "#3a3a3a", letterSpacing: "0.18em" }}>v1.2</span>
              {hasHistory && (
                <span style={{ fontSize: 10, color: "#3a3a3a", letterSpacing: "0.1em" }}>
                  {turns.length} TURN{turns.length > 1 ? "S" : ""}
                </span>
              )}
              {activeSessionId && (
                <button className="export-btn" onClick={handleExportAll}
                  style={{ marginLeft: "auto", background: "none", border: "1px solid #2a2a2a", borderRadius: 3, padding: "5px 12px", fontSize: 10, fontFamily: "inherit", color: "#3a3a3a", letterSpacing: "0.1em", cursor: "pointer", display: "flex", alignItems: "center", gap: 7, transition: "all 0.15s" }}>
                  <DownloadIcon /> EXPORT ALL
                </button>
              )}
            </div>
          </div>

          {/* API Keys */}
          <div style={{ marginBottom: 18 }}>
            <button className="key-toggle" onClick={() => setShowKeys(!showKeys)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#3a3a3a", fontSize: 11, fontFamily: "inherit", letterSpacing: "0.1em", padding: 0, display: "flex", alignItems: "center", gap: 7, transition: "color 0.15s" }}>
              <KeyIcon /> {showKeys ? "— HIDE KEYS" : "+ CONFIGURE KEYS"}
            </button>
            {showKeys && (
              <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 10, animation: "fadeUp 0.2s ease" }}>
                {MODELS.map((m) => (
                  <div key={m.id}>
                    <label style={{ display: "block", fontSize: 10, color: m.accent, letterSpacing: "0.12em", marginBottom: 5 }}>{m.label.toUpperCase()}</label>
                    <input type="password" placeholder={`${m.id} api key`}
                      value={keys[m.id] || ""} onChange={(e) => setKeys((k) => ({ ...k, [m.id]: e.target.value }))}
                      style={{ width: "100%", background: "#0f0f0f", border: "1px solid #2a2a2a", borderRadius: 3, padding: "8px 11px", color: "#aaa", fontSize: 11, fontFamily: "inherit", letterSpacing: "0.04em" }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <PromptInput
            prompt={prompt}
            setPrompt={setPrompt}
            models={MODELS}
            enabled={enabled}
            toggleModel={toggleModel}
            anyLoading={anyLoading}
            synthesizing={synthesizing}
            hasHistory={hasHistory}
            onSend={handleSend}
          />

          {/* Model output grid */}
          {hasHistory && (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${colCount}, 1fr)`, gap: 12, animation: "fadeUp 0.3s ease" }}>
              {activeModels.map((model) => (
                <ModelOutput
                  key={model.id}
                  model={model}
                  turns={turns}
                  loading={loading}
                  lastTurn={lastTurn}
                />
              ))}
            </div>
          )}

          {/* Synthesis panel */}
          {showSynthPanel && (
            <SynthesisTabs
              synthesis={synthesis}
              synthesizing={synthesizing}
              activeSynthTab={activeSynthTab}
              setActiveSynthTab={setActiveSynthTab}
              activeModelCount={activeModels.length}
              originalPrompt={turns[0]?.user || ""}
            />
          )}

        </div>
      </main>
    </div>
  );
}
