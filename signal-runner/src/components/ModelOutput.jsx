import { useRef, useEffect, useState } from "react";
import { CopyIcon, DownloadIcon, Spinner } from "./Icons";
import { buildModelExport, generateFilename, triggerDownload } from "../lib/exportUtils";

export default function ModelOutput({ model, turns, loading, lastTurn }) {
  const [copied, setCopied] = useState({});
  const transcriptRef = useRef(null);

  useEffect(() => {
    if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [turns]);

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopied((c) => ({ ...c, [id]: true }));
    setTimeout(() => setCopied((c) => ({ ...c, [id]: false })), 1500);
  };

  const hasContent = turns.some((t) => t.responses?.[model.id]?.content);

  // Authoritative version from the provider's own field — never the model's
  // self-description in prose. Latest turn that reported one wins.
  const reported = [...turns]
    .reverse()
    .map((t) => t.responses?.[model.id]?.model_reported)
    .find(Boolean);

  const handleExport = () => {
    const content = buildModelExport(model, turns);
    const filename = generateFilename(turns[0]?.user || model.label);
    triggerDownload(content, filename);
  };

  return (
    <div className="result-card"
      style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderTop: `2px solid ${model.accent}`, borderRadius: 4, padding: 16, display: "flex", flexDirection: "column", maxHeight: 700 }}>
      <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: model.accent, letterSpacing: "0.05em" }}>{model.label}</div>
          <div style={{ fontSize: 9, color: "#2e2e2e", letterSpacing: "0.14em", marginTop: 3 }}>{model.role.toUpperCase()}</div>
          <div style={{ fontSize: 9, color: "#3a3a3a", marginTop: 5, lineHeight: 1.5 }}>
            <div><span style={{ color: "#2e2e2e" }}>cfg </span>{model.model}</div>
            <div>
              <span style={{ color: "#2e2e2e" }}>api </span>
              {reported
                ? <span style={{ color: reported === model.model ? "#3a3a3a" : "#8a6d3b" }}>{reported}</span>
                : <span style={{ color: "#2e2e2e" }}>—</span>}
            </div>
          </div>
        </div>
        {hasContent && (
          <button className="export-btn" onClick={handleExport}
            style={{ background: "none", border: "1px solid #1e1e1e", borderRadius: 3, padding: "3px 7px", fontSize: 9, fontFamily: "inherit", color: "#3a3a3a", letterSpacing: "0.1em", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s" }}>
            <DownloadIcon /> EXPORT
          </button>
        )}
      </div>
      <div ref={transcriptRef} style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
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
  );
}
