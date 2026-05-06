import { useState, useEffect, useRef } from "react";
import * as sessionStore from "./lib/sessionStore";

const MODELS = [
  {
    id: "perplexity", label: "Perplexity", role: "Research", accent: "#20B2AA",
    call: async (messages, key) => {
      const res = await fetch("/api/perplexity", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(key && { "X-API-Key": key }) },
        body: JSON.stringify({ model: "sonar", messages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Perplexity error");
      return data.choices[0].message.content;
    },
  },
  {
    id: "gemini", label: "Gemini", role: "Synthesis", accent: "#4285F4",
    call: async (messages, key) => {
      const contents = messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(key && { "X-API-Key": key }) },
        body: JSON.stringify({ contents }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Gemini error");
      return data.candidates[0].content.parts[0].text;
    },
  },
  {
    id: "chatgpt", label: "ChatGPT", role: "Structure", accent: "#10A37F",
    call: async (messages, key) => {
      const res = await fetch("/api/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(key && { "X-API-Key": key }) },
        body: JSON.stringify({ model: "gpt-4o", messages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "OpenAI error");
      return data.choices[0].message.content;
    },
  },
  {
    id: "claude", label: "Claude", role: "Nuance", accent: "#D4763B",
    call: async (messages, key) => {
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(key && { "X-API-Key": key }) },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Claude error");
      return data.content[0].text;
    },
  },
  {
    id: "grok", label: "Grok", role: "Contrarian", accent: "#E0E0E0",
    call: async (messages, key) => {
      const res = await fetch("/api/grok", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(key && { "X-API-Key": key }) },
        body: JSON.stringify({ model: "grok-3", messages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Grok error");
      return data.choices[0].message.content;
    },
  },
];

const SYNTH_MODES = [
  { id: "disagree", label: "Disagreements", prompt: "Identify where the models disagree, contradict each other, or take meaningfully different angles. What are the fault lines?" },
  { id: "insights", label: "Key Insights", prompt: "Synthesize the key insights across all model responses. Identify the most valuable, non-obvious takeaways. Be concise and direct." },
  { id: "actions", label: "Action Items", prompt: "Extract the most actionable outputs across all responses. What should someone actually do based on this analysis?" },
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

function relativeTime(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

const CopyIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
  </svg>
);

const KeyIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6M15.5 7.5l3 3"/>
  </svg>
);

const Spinner = ({ color }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5"
    style={{ animation: "spin 0.85s linear infinite", flexShrink: 0 }}>
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
  </svg>
);

const DownloadIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
  </svg>
);

const PencilIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/>
  </svg>
);

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
  const [copied, setCopied] = useState({});
  const [hoveredSessionId, setHoveredSessionId] = useState(null);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const transcriptRefs = useRef({});

  useEffect(() => {
    Object.values(transcriptRefs.current).forEach((el) => {
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [turns]);

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

    await Promise.all(
      SYNTH_MODES.map(async (mode) => {
        const synthPrompt = `Original prompt: "${turn.user}"\n\nModel outputs:\n\n${allModelOutputs}\n\n---\n\nYour task: ${mode.prompt}`;
        try {
          const res = await fetch("/api/claude", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(keys.claude && { "X-API-Key": keys.claude }) },
            body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: synthPrompt }] }),
          });
          const data = await res.json();
          const text = res.ok ? data.content[0].text : `Error: ${data.error?.message || "unknown"}`;
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
    await Promise.all(
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
          responses[model.id] = { error: e.message };
          currentTurns = currentTurns.map((t) =>
            t.id === newTurnId
              ? { ...t, responses: { ...t.responses, [model.id]: { error: e.message } } }
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

  const handleDeleteSession = (sessionId, e) => {
    e.stopPropagation();
    sessionStore.remove(sessionId);
    setSessions(sessionStore.list());
    if (activeSessionId === sessionId) handleNewSession();
  };

  const startRename = (sessionId, currentTitle, e) => {
    e.stopPropagation();
    setEditingSessionId(sessionId);
    setEditTitle(currentTitle);
  };

  const commitRename = (sessionId) => {
    if (editTitle.trim()) {
      sessionStore.update(sessionId, { title: editTitle.trim() });
      setSessions(sessionStore.list());
    }
    setEditingSessionId(null);
    setEditTitle("");
  };

  const handleExport = () => {
    if (!activeSessionId) return;
    const session = sessionStore.load(activeSessionId);
    if (!session) return;

    const lastTurn = session.turns[session.turns.length - 1];
    const enabledModelList = MODELS.filter((m) => (session.enabledModels || {})[m.id]);
    const date = new Date(session.createdAt).toISOString().slice(0, 10);
    const fmt = (t) => t || "*Not yet generated*";

    let md = `# ${session.title}\n*${new Date(session.createdAt).toLocaleString()}*\n\n`;
    md += `## Prompt\n${session.turns[0]?.user || ""}\n\n`;
    md += `## Models Run\n${enabledModelList.map((m) => `- ${m.label} (${m.role})`).join("\n")}\n\n`;
    md += `## Disagreements Synthesis\n${fmt(session.synthesis?.disagree)}\n\n`;
    md += `## Key Insights Synthesis\n${fmt(session.synthesis?.insights)}\n\n`;
    md += `## Action Items Synthesis\n${fmt(session.synthesis?.actions)}\n\n`;
    md += `## Individual Model Outputs`;
    enabledModelList.forEach((m) => {
      const out = lastTurn?.responses?.[m.id]?.content;
      if (out) md += `\n\n### ${m.label}\n${out}`;
    });

    const filename = `signal-runner-${sessionStore.slugify(session.title)}-${date}.md`;
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopied((c) => ({ ...c, [id]: true }));
    setTimeout(() => setCopied((c) => ({ ...c, [id]: false })), 1500);
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

      {/* Sidebar */}
      <aside style={{ width: 220, flexShrink: 0, height: "100vh", overflowY: "auto", borderRight: "1px solid #161616", background: "#070707", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 14px 12px", borderBottom: "1px solid #141414" }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#3a3a3a", letterSpacing: "0.2em", marginBottom: 12 }}>SIGNAL RUNNER</div>
          <button className="new-session-btn" onClick={handleNewSession}
            style={{ width: "100%", background: "none", border: "1px solid #1e1e1e", borderRadius: 3, padding: "8px 0", fontSize: 10, fontFamily: "inherit", color: "#555", letterSpacing: "0.12em", cursor: "pointer", transition: "all 0.15s" }}>
            + NEW SESSION
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {sessions.length === 0 && (
            <div style={{ padding: "16px 14px", fontSize: 10, color: "#2a2a2a", letterSpacing: "0.08em" }}>No sessions yet</div>
          )}
          {sessions.map((session) => {
            const isActive = session.id === activeSessionId;
            const isHovered = hoveredSessionId === session.id;
            const isEditing = editingSessionId === session.id;
            return (
              <div key={session.id} className="session-item"
                onClick={() => !isEditing && handleLoadSession(session.id)}
                onMouseEnter={() => setHoveredSessionId(session.id)}
                onMouseLeave={() => setHoveredSessionId(null)}
                style={{ padding: "10px 14px", background: isActive ? "#111" : "none", borderLeft: isActive ? "2px solid #D4763B" : "2px solid transparent", position: "relative" }}>
                {isEditing ? (
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(session.id);
                      if (e.key === "Escape") setEditingSessionId(null);
                    }}
                    onBlur={() => commitRename(session.id)}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    style={{ width: "100%", background: "#1a1a1a", border: "1px solid #333", borderRadius: 2, padding: "4px 6px", color: "#d8d8d8", fontSize: 11, fontFamily: "inherit" }}
                  />
                ) : (
                  <>
                    <div style={{ fontSize: 11, color: isActive ? "#d8d8d8" : "#666", lineHeight: 1.4, marginBottom: 4, paddingRight: isHovered ? 42 : 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {session.title}
                    </div>
                    <div style={{ fontSize: 9, color: "#2a2a2a", letterSpacing: "0.08em" }}>
                      {relativeTime(session.updatedAt)}
                    </div>
                    {isHovered && (
                      <div style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", display: "flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                        <button className="session-edit" onClick={(e) => startRename(session.id, session.title, e)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#3a3a3a", padding: 4, transition: "color 0.15s" }}>
                          <PencilIcon />
                        </button>
                        <button className="session-del" onClick={(e) => handleDeleteSession(session.id, e)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#3a3a3a", padding: 4, transition: "color 0.15s" }}>
                          <TrashIcon />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflowY: "auto", padding: "28px 32px", minWidth: 0 }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>

          {/* Header */}
          <div style={{ marginBottom: 28, borderBottom: "1px solid #1e1e1e", paddingBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 14 }}>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#fff", letterSpacing: "0.06em" }}>SIGNAL RUNNER</h1>
              <span style={{ fontSize: 10, color: "#3a3a3a", letterSpacing: "0.18em" }}>v1.2</span>
              {hasHistory && (
                <span style={{ fontSize: 10, color: "#3a3a3a", letterSpacing: "0.1em" }}>
                  {turns.length} TURN{turns.length > 1 ? "S" : ""}
                </span>
              )}
              {activeSessionId && (
                <button className="export-btn" onClick={handleExport}
                  style={{ marginLeft: "auto", background: "none", border: "1px solid #2a2a2a", borderRadius: 3, padding: "5px 12px", fontSize: 10, fontFamily: "inherit", color: "#3a3a3a", letterSpacing: "0.1em", cursor: "pointer", display: "flex", alignItems: "center", gap: 7, transition: "all 0.15s" }}>
                  <DownloadIcon /> EXPORT
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 10, color: "#3a3a3a", letterSpacing: "0.14em", marginRight: 4 }}>MODELS</span>
              {MODELS.map((m) => {
                const on = enabled[m.id];
                return (
                  <button key={m.id} className="model-toggle" onClick={() => toggleModel(m.id)}
                    style={{ background: on ? "#141414" : "none", border: `1px solid ${on ? m.accent + "80" : "#222"}`, borderRadius: 3, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 7, opacity: on ? 1 : 0.35 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: on ? m.accent : "#333", flexShrink: 0, transition: "background 0.15s" }} />
                    <span style={{ fontSize: 11, color: on ? m.accent : "#444", letterSpacing: "0.06em", fontWeight: on ? 500 : 400 }}>{m.label}</span>
                    <span style={{ fontSize: 9, color: on ? "#444" : "#2a2a2a", letterSpacing: "0.1em" }}>{m.role}</span>
                  </button>
                );
              })}
              <span style={{ fontSize: 10, color: "#2a2a2a", marginLeft: 4 }}>{activeModels.length} active</span>
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

          {/* Prompt input */}
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
            placeholder={hasHistory ? "follow up..." : "enter prompt or signal to analyze..."}
            rows={hasHistory ? 2 : 4}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend(); }}
            style={{ width: "100%", background: "#0f0f0f", border: "1px solid #222", borderRadius: 4, padding: "14px 16px", color: "#d8d8d8", fontSize: 13, fontFamily: "inherit", resize: "vertical", lineHeight: 1.65, letterSpacing: "0.02em", marginBottom: 4 }}
            onFocus={(e) => (e.target.style.borderColor = "#3a3a3a")}
            onBlur={(e) => (e.target.style.borderColor = "#222")} />
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
            <span style={{ fontSize: 10, color: "#2a2a2a", letterSpacing: "0.1em" }}>⌘↵ to send</span>
            {prompt.trim() && <span style={{ fontSize: 10, color: "#2a2a2a" }}>{prompt.length} chars</span>}
          </div>

          {/* Action bar */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 32 }}>
            <button className="run-btn" onClick={handleSend}
              disabled={anyLoading || synthesizing || !prompt.trim()}
              style={{ background: "#d8d8d8", color: "#0a0a0a", border: "none", borderRadius: 3, padding: "10px 30px", fontSize: 11, fontFamily: "inherit", fontWeight: 600, letterSpacing: "0.14em", cursor: "pointer", transition: "all 0.15s" }}>
              {anyLoading
                ? "SENDING..."
                : synthesizing
                ? "SYNTHESIZING..."
                : `SEND TO ${activeModels.length === MODELS.length ? "ALL" : activeModels.length} MODEL${activeModels.length > 1 ? "S" : ""}`}
            </button>
          </div>

          {/* Model output grid */}
          {hasHistory && (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${colCount}, 1fr)`, gap: 12, animation: "fadeUp 0.3s ease" }}>
              {activeModels.map((model) => (
                <div key={model.id} className="result-card"
                  style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderTop: `2px solid ${model.accent}`, borderRadius: 4, padding: 16, display: "flex", flexDirection: "column", maxHeight: 700 }}>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: model.accent, letterSpacing: "0.05em" }}>{model.label}</div>
                    <div style={{ fontSize: 9, color: "#2e2e2e", letterSpacing: "0.14em", marginTop: 3 }}>{model.role.toUpperCase()}</div>
                  </div>
                  <div ref={(el) => (transcriptRefs.current[model.id] = el)} style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
                    {turns.map((turn, idx) => {
                      const resp = turn.responses?.[model.id];
                      const isLatest = turn.id === lastTurn?.id;
                      const isLoading = isLatest && loading[model.id];
                      const respKey = `${turn.id}-${model.id}`;
                      return (
                        <div key={turn.id} style={{ marginBottom: 16, paddingBottom: 14, borderBottom: idx < turns.length - 1 ? "1px solid #161616" : "none" }}>
                          <div style={{ fontSize: 10, color: "#5a5a5a", letterSpacing: "0.08em", marginBottom: 6, textTransform: "uppercase" }}>You</div>
                          <div style={{ fontSize: 11, lineHeight: 1.6, color: "#888", whiteSpace: "pre-wrap", marginBottom: 10, padding: "6px 10px", background: "#101010", borderLeft: "2px solid #2a2a2a", borderRadius: 2 }}>
                            {turn.user}
                          </div>
                          {isLoading && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#2e2e2e", fontSize: 11, paddingTop: 2 }}>
                              <Spinner color={model.accent} />
                              <span style={{ animation: "pulse 1.5s ease infinite" }}>thinking...</span>
                            </div>
                          )}
                          {resp?.error && (
                            <div style={{ fontSize: 11, lineHeight: 1.6, color: "#cc4444", background: "#1a0a0a", border: "1px solid #2a1010", padding: "10px 12px", borderRadius: 3 }}>
                              ⚠ {resp.error}
                            </div>
                          )}
                          {resp?.content && (
                            <div>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                <div style={{ fontSize: 10, color: model.accent, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.7 }}>{model.label}</div>
                                <button className="copy-btn" onClick={() => handleCopy(respKey, resp.content)}
                                  style={{ background: "none", border: "none", cursor: "pointer", color: copied[respKey] ? model.accent : "#2e2e2e", padding: 2, opacity: 0.7, transition: "all 0.15s" }}>
                                  {copied[respKey] ? <span style={{ fontSize: 11 }}>✓</span> : <CopyIcon />}
                                </button>
                              </div>
                              <div style={{ fontSize: 12, lineHeight: 1.75, color: "#b8b8b8", whiteSpace: "pre-wrap", animation: "fadeUp 0.35s ease", letterSpacing: "0.01em" }}>
                                {resp.content}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Synthesis panel */}
          {showSynthPanel && (
            <div style={{ marginTop: 20, animation: "fadeUp 0.4s ease" }}>
              <div style={{ display: "flex", alignItems: "stretch", borderBottom: "1px solid #1e1e1e" }}>
                <span style={{ fontSize: 9, color: "#2a2a2a", letterSpacing: "0.18em", alignSelf: "center", marginRight: 12, paddingBottom: 2 }}>SYNTHESIS</span>
                {SYNTH_MODES.map((mode) => {
                  const isDisagree = mode.id === "disagree";
                  const isActive = activeSynthTab === mode.id;
                  return (
                    <button key={mode.id} className="tab-btn"
                      onClick={() => setActiveSynthTab(mode.id)}
                      style={{
                        background: "none",
                        border: "none",
                        borderBottom: isActive
                          ? `2px solid ${isDisagree ? "#D4763B" : "#555"}`
                          : "2px solid transparent",
                        marginBottom: -1,
                        padding: isDisagree ? "9px 16px" : "9px 13px",
                        fontSize: isDisagree ? 11 : 10,
                        fontWeight: isActive ? (isDisagree ? 600 : 500) : 400,
                        color: isActive
                          ? (isDisagree ? "#D4763B" : "#c8c8c8")
                          : (isDisagree ? "#4a4a4a" : "#3a3a3a"),
                        cursor: "pointer",
                        letterSpacing: "0.12em",
                        fontFamily: "inherit",
                        transition: "all 0.15s",
                      }}>
                      {mode.label.toUpperCase()}
                    </button>
                  );
                })}
              </div>

              <div style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderTop: `2px solid ${activeSynthTab === "disagree" ? "#D4763B" : "#2a2a2a"}`, borderRadius: "0 4px 4px 4px", padding: 20, minHeight: 80 }}>
                {synthesizing && !synthesis[activeSynthTab] && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#2e2e2e", fontSize: 11 }}>
                    <Spinner color="#D4763B" />
                    <span style={{ animation: "pulse 1.5s ease infinite" }}>
                      synthesizing across {activeModels.length} model{activeModels.length > 1 ? "s" : ""}...
                    </span>
                  </div>
                )}
                {synthesis[activeSynthTab] && (
                  <div style={{ animation: "fadeUp 0.3s ease" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#D4763B", letterSpacing: "0.05em" }}>Claude</span>
                        <span style={{ fontSize: 9, color: "#2e2e2e", letterSpacing: "0.14em", marginLeft: 10 }}>
                          {SYNTH_MODES.find((m) => m.id === activeSynthTab)?.label.toUpperCase()} · SYNTHESIS
                        </span>
                      </div>
                      <button className="copy-btn" onClick={() => handleCopy("synth-" + activeSynthTab, synthesis[activeSynthTab])}
                        style={{ background: "none", border: "none", cursor: "pointer", color: copied["synth-" + activeSynthTab] ? "#D4763B" : "#2e2e2e", padding: 2, opacity: 0.8, transition: "all 0.15s" }}>
                        {copied["synth-" + activeSynthTab] ? <span style={{ fontSize: 11 }}>✓</span> : <CopyIcon />}
                      </button>
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.8, color: "#c8c8c8", whiteSpace: "pre-wrap", letterSpacing: "0.01em" }}>
                      {synthesis[activeSynthTab]}
                    </div>
                  </div>
                )}
                {!synthesizing && !synthesis[activeSynthTab] && (
                  <div style={{ fontSize: 10, color: "#2a2a2a", letterSpacing: "0.08em" }}>—</div>
                )}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
