import { useState } from "react";

const MODELS = [
  {
    id: "perplexity", label: "Perplexity", role: "Research", accent: "#20B2AA",
    call: async (prompt, key) => {
      const res = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: "sonar", messages: [{ role: "user", content: prompt }] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Perplexity error");
      return data.choices[0].message.content;
    },
  },
  {
    id: "gemini", label: "Gemini", role: "Synthesis", accent: "#4285F4",
    call: async (prompt, key) => {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Gemini error");
      return data.candidates[0].content.parts[0].text;
    },
  },
  {
    id: "chatgpt", label: "ChatGPT", role: "Structure", accent: "#10A37F",
    call: async (prompt, key) => {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "OpenAI error");
      return data.choices[0].message.content;
    },
  },
  {
    id: "claude", label: "Claude", role: "Nuance", accent: "#D4763B",
    call: async (prompt) => {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Claude error");
      return data.content[0].text;
    },
  },
  {
    id: "grok", label: "Grok", role: "Contrarian", accent: "#E0E0E0",
    call: async (prompt, key) => {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: "grok-3", messages: [{ role: "user", content: prompt }] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Grok error");
      return data.choices[0].message.content;
    },
  },
];

const SYNTH_MODES = [
  { id: "insights", label: "Key Insights", prompt: "Synthesize the key insights across all model responses. Identify the most valuable, non-obvious takeaways. Be concise and direct." },
  { id: "disagree", label: "Disagreements", prompt: "Identify where the models disagree, contradict each other, or take meaningfully different angles. What are the fault lines?" },
  { id: "actions", label: "Action Items", prompt: "Extract the most actionable outputs across all responses. What should someone actually do based on this analysis?" },
];

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

export default function SignalRunner() {
  const [prompt, setPrompt] = useState("");
  const [keys, setKeys] = useState({
    perplexity: import.meta.env.VITE_PERPLEXITY_KEY || "",
    gemini: import.meta.env.VITE_GEMINI_KEY || "",
    chatgpt: import.meta.env.VITE_OPENAI_KEY || "",
    grok: import.meta.env.VITE_GROK_KEY || "",
  });
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState({});
  const [errors, setErrors] = useState({});
  const [showKeys, setShowKeys] = useState(false);
  const [copied, setCopied] = useState({});
  const [ran, setRan] = useState(false);
  const [synthesis, setSynthesis] = useState("");
  const [synthesizing, setSynthesizing] = useState(false);
  const [synthMode, setSynthMode] = useState("insights");
  const [enabled, setEnabled] = useState(() => Object.fromEntries(MODELS.map((m) => [m.id, true])));

  const toggleModel = (id) => {
    setEnabled((e) => {
      const active = Object.values(e).filter(Boolean).length;
      if (e[id] && active <= 1) return e;
      return { ...e, [id]: !e[id] };
    });
  };

  const activeModels = MODELS.filter((m) => enabled[m.id]);

  const handleRun = async () => {
    if (!prompt.trim()) return;
    setRan(true);
    setResults({});
    setErrors({});
    setSynthesis("");
    const init = {};
    activeModels.forEach((m) => (init[m.id] = true));
    setLoading(init);
    await Promise.all(
      activeModels.map(async (model) => {
        try {
          const result = await model.call(prompt, keys[model.id] || "");
          setResults((r) => ({ ...r, [model.id]: result }));
        } catch (e) {
          setErrors((r) => ({ ...r, [model.id]: e.message }));
        } finally {
          setLoading((l) => ({ ...l, [model.id]: false }));
        }
      })
    );
  };

  const handleSynthesize = async () => {
    setSynthesizing(true);
    setSynthesis("");
    const mode = SYNTH_MODES.find((m) => m.id === synthMode);
    const modelOutputs = activeModels
      .map((m) => results[m.id] ? `## ${m.label} (${m.role})\n${results[m.id]}` : null)
      .filter(Boolean).join("\n\n---\n\n");
    const synthPrompt = `Original prompt: "${prompt}"\n\nModel outputs:\n\n${modelOutputs}\n\n---\n\nYour task: ${mode.prompt}`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: synthPrompt }] }),
      });
      const data = await res.json();
      setSynthesis(data.content[0].text);
    } catch (e) {
      setSynthesis("Synthesis error: " + e.message);
    } finally {
      setSynthesizing(false);
    }
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopied((c) => ({ ...c, [id]: true }));
    setTimeout(() => setCopied((c) => ({ ...c, [id]: false })), 1500);
  };

  const anyLoading = Object.values(loading).some(Boolean);
  const allDone = ran && !anyLoading && activeModels.some((m) => results[m.id]);
  const colCount = activeModels.length;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#d8d8d8", fontFamily: "'IBM Plex Mono', 'Courier New', monospace", padding: "28px 24px" }}>
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
        .mode-btn:hover { border-color: #d8d8d8 !important; color: #d8d8d8 !important; }
        .synth-run:hover:not(:disabled) { background: #D4763B !important; border-color: #D4763B !important; color: #fff !important; }
        .result-card { transition: border-color 0.25s; }
        .model-toggle { transition: all 0.15s; }
        .model-toggle:hover { opacity: 1 !important; }
      `}</style>

      <div style={{ maxWidth: 1500, margin: "0 auto" }}>
        <div style={{ marginBottom: 28, borderBottom: "1px solid #1e1e1e", paddingBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 14 }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#fff", letterSpacing: "0.06em" }}>SIGNAL RUNNER</h1>
            <span style={{ fontSize: 10, color: "#3a3a3a", letterSpacing: "0.18em" }}>v1.0</span>
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
                  <input type="password" placeholder={m.id === "claude" ? "native — no key needed" : `${m.id} api key`}
                    value={keys[m.id] || ""} onChange={(e) => setKeys((k) => ({ ...k, [m.id]: e.target.value }))} disabled={m.id === "claude"}
                    style={{ width: "100%", background: "#0f0f0f", border: `1px solid ${m.id === "claude" ? "#1a1a1a" : "#2a2a2a"}`, borderRadius: 3, padding: "8px 11px", color: m.id === "claude" ? "#2a2a2a" : "#aaa", fontSize: 11, fontFamily: "inherit", letterSpacing: "0.04em" }} />
                </div>
              ))}
            </div>
          )}
        </div>

        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
          placeholder="enter prompt or signal to analyze..." rows={4}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleRun(); }}
          style={{ width: "100%", background: "#0f0f0f", border: "1px solid #222", borderRadius: 4, padding: "14px 16px", color: "#d8d8d8", fontSize: 13, fontFamily: "inherit", resize: "vertical", lineHeight: 1.65, letterSpacing: "0.02em", marginBottom: 4 }}
          onFocus={(e) => (e.target.style.borderColor = "#3a3a3a")}
          onBlur={(e) => (e.target.style.borderColor = "#222")} />
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
          <span style={{ fontSize: 10, color: "#2a2a2a", letterSpacing: "0.1em" }}>⌘↵ to run</span>
          {prompt.trim() && <span style={{ fontSize: 10, color: "#2a2a2a" }}>{prompt.length} chars</span>}
        </div>

        <button className="run-btn" onClick={handleRun} disabled={anyLoading || !prompt.trim()}
          style={{ background: "#d8d8d8", color: "#0a0a0a", border: "none", borderRadius: 3, padding: "10px 30px", fontSize: 11, fontFamily: "inherit", fontWeight: 600, letterSpacing: "0.14em", cursor: "pointer", marginBottom: 32, transition: "all 0.15s" }}>
          {anyLoading ? "RUNNING..." : `RUN ${activeModels.length === MODELS.length ? "ALL" : activeModels.length} MODEL${activeModels.length > 1 ? "S" : ""}`}
        </button>

        {ran && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${colCount}, 1fr)`, gap: 12, animation: "fadeUp 0.3s ease" }}>
            {activeModels.map((model) => (
              <div key={model.id} className="result-card"
                style={{ background: "#0d0d0d", border: `1px solid ${loading[model.id] ? model.accent + "35" : "#1e1e1e"}`, borderTop: `2px solid ${model.accent}`, borderRadius: 4, padding: 16, minHeight: 280, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: model.accent, letterSpacing: "0.05em" }}>{model.label}</div>
                    <div style={{ fontSize: 9, color: "#2e2e2e", letterSpacing: "0.14em", marginTop: 3 }}>{model.role.toUpperCase()}</div>
                  </div>
                  {results[model.id] && (
                    <button className="copy-btn" onClick={() => handleCopy(model.id, results[model.id])}
                      style={{ background: "none", border: "none", cursor: "pointer", color: copied[model.id] ? model.accent : "#2e2e2e", padding: 2, opacity: 0.8, transition: "all 0.15s" }}>
                      {copied[model.id] ? <span style={{ fontSize: 11 }}>✓</span> : <CopyIcon />}
                    </button>
                  )}
                </div>
                <div style={{ flex: 1, overflowY: "auto", maxHeight: 500 }}>
                  {loading[model.id] && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#2e2e2e", fontSize: 11, paddingTop: 2 }}>
                      <Spinner color={model.accent} />
                      <span style={{ animation: "pulse 1.5s ease infinite" }}>thinking...</span>
                    </div>
                  )}
                  {errors[model.id] && (
                    <div style={{ fontSize: 11, lineHeight: 1.6, color: "#cc4444", background: "#1a0a0a", border: "1px solid #2a1010", padding: "10px 12px", borderRadius: 3 }}>
                      ⚠ {errors[model.id]}
                    </div>
                  )}
                  {results[model.id] && (
                    <div style={{ fontSize: 12, lineHeight: 1.75, color: "#b8b8b8", whiteSpace: "pre-wrap", animation: "fadeUp 0.35s ease", letterSpacing: "0.01em" }}>
                      {results[model.id]}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {allDone && (
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid #1a1a1a", animation: "fadeUp 0.4s ease" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, color: "#3a3a3a", letterSpacing: "0.16em", marginRight: 4 }}>SYNTHESIZE</span>
              {SYNTH_MODES.map((mode) => (
                <button key={mode.id} className="mode-btn" onClick={() => setSynthMode(mode.id)}
                  style={{ background: synthMode === mode.id ? "#1e1e1e" : "none", color: synthMode === mode.id ? "#d8d8d8" : "#3a3a3a", border: `1px solid ${synthMode === mode.id ? "#3a3a3a" : "#1e1e1e"}`, borderRadius: 3, padding: "5px 13px", fontSize: 10, fontFamily: "inherit", letterSpacing: "0.1em", cursor: "pointer", transition: "all 0.15s" }}>
                  {mode.label.toUpperCase()}
                </button>
              ))}
              <button className="synth-run" onClick={handleSynthesize} disabled={synthesizing}
                style={{ background: "none", color: "#D4763B", border: "1px solid #D4763B55", borderRadius: 3, padding: "5px 18px", fontSize: 10, fontFamily: "inherit", fontWeight: 600, letterSpacing: "0.12em", cursor: synthesizing ? "not-allowed" : "pointer", transition: "all 0.15s", opacity: synthesizing ? 0.5 : 1 }}>
                {synthesizing ? "RUNNING..." : "↳ RUN"}
              </button>
            </div>
            {(synthesis || synthesizing) && (
              <div style={{ marginTop: 14, background: "#0d0d0d", border: "1px solid #1e1e1e", borderTop: "2px solid #D4763B", borderRadius: 4, padding: 20, animation: "fadeUp 0.3s ease" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#D4763B", letterSpacing: "0.05em" }}>Claude</span>
                    <span style={{ fontSize: 9, color: "#2e2e2e", letterSpacing: "0.14em", marginLeft: 10 }}>
                      {SYNTH_MODES.find((m) => m.id === synthMode)?.label.toUpperCase()} · SYNTHESIS
                    </span>
                  </div>
                  {synthesis && (
                    <button className="copy-btn" onClick={() => handleCopy("synth", synthesis)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: copied["synth"] ? "#D4763B" : "#2e2e2e", padding: 2, opacity: 0.8, transition: "all 0.15s" }}>
                      {copied["synth"] ? <span style={{ fontSize: 11 }}>✓</span> : <CopyIcon />}
                    </button>
                  )}
                </div>
                {synthesizing && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#2e2e2e", fontSize: 11 }}>
                    <Spinner color="#D4763B" />
                    <span style={{ animation: "pulse 1.5s ease infinite" }}>synthesizing across {activeModels.length} models...</span>
                  </div>
                )}
                {synthesis && (
                  <div style={{ fontSize: 13, lineHeight: 1.8, color: "#c8c8c8", whiteSpace: "pre-wrap", animation: "fadeUp 0.35s ease", letterSpacing: "0.01em" }}>
                    {synthesis}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
