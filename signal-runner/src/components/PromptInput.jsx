export default function PromptInput({ prompt, setPrompt, models, enabled, toggleModel, anyLoading, synthesizing, hasHistory, onSend }) {
  const activeCount = models.filter((m) => enabled[m.id]).length;

  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontSize: 10, color: "#3a3a3a", letterSpacing: "0.14em", marginRight: 4 }}>MODELS</span>
        {models.map((m) => {
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
        <span style={{ fontSize: 10, color: "#2a2a2a", marginLeft: 4 }}>{activeCount} active</span>
      </div>

      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
        placeholder={hasHistory ? "follow up..." : "enter prompt or signal to analyze..."}
        rows={hasHistory ? 2 : 4}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSend(); }}
        style={{ width: "100%", background: "#0f0f0f", border: "1px solid #222", borderRadius: 4, padding: "14px 16px", color: "#d8d8d8", fontSize: 13, fontFamily: "inherit", resize: "vertical", lineHeight: 1.65, letterSpacing: "0.02em", marginBottom: 4 }}
        onFocus={(e) => (e.target.style.borderColor = "#3a3a3a")}
        onBlur={(e) => (e.target.style.borderColor = "#222")} />
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
        <span style={{ fontSize: 10, color: "#2a2a2a", letterSpacing: "0.1em" }}>⌘↵ to send</span>
        {prompt.trim() && <span style={{ fontSize: 10, color: "#2a2a2a" }}>{prompt.length} chars</span>}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 32 }}>
        <button className="run-btn" onClick={onSend}
          disabled={anyLoading || synthesizing || !prompt.trim()}
          style={{ background: "#d8d8d8", color: "#0a0a0a", border: "none", borderRadius: 3, padding: "10px 30px", fontSize: 11, fontFamily: "inherit", fontWeight: 600, letterSpacing: "0.14em", cursor: "pointer", transition: "all 0.15s" }}>
          {anyLoading
            ? "SENDING..."
            : synthesizing
            ? "SYNTHESIZING..."
            : `SEND TO ${activeCount === models.length ? "ALL" : activeCount} MODEL${activeCount > 1 ? "S" : ""}`}
        </button>
      </div>
    </>
  );
}
