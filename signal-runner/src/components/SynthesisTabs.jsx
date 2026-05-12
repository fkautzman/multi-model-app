import { useState } from "react";
import { SYNTH_MODES } from "../lib/constants";
import { CopyIcon, DownloadIcon, Spinner } from "./Icons";
import { buildSynthesisExport, generateFilename, triggerDownload } from "../lib/exportUtils";

export default function SynthesisTabs({ synthesis, synthesizing, activeSynthTab, setActiveSynthTab, activeModelCount, originalPrompt }) {
  const [copied, setCopied] = useState({});

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopied((c) => ({ ...c, [id]: true }));
    setTimeout(() => setCopied((c) => ({ ...c, [id]: false })), 1500);
  };

  const handleExportSynth = (modeId) => {
    const mode = SYNTH_MODES.find((m) => m.id === modeId);
    const content = buildSynthesisExport(mode?.label || modeId, synthesis[modeId], originalPrompt || "");
    const filename = generateFilename(originalPrompt || modeId);
    triggerDownload(content, filename);
  };

  return (
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
              synthesizing across {activeModelCount} model{activeModelCount > 1 ? "s" : ""}...
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
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button className="export-btn" onClick={() => handleExportSynth(activeSynthTab)}
                  style={{ background: "none", border: "1px solid #1e1e1e", borderRadius: 3, padding: "3px 7px", fontSize: 9, fontFamily: "inherit", color: "#3a3a3a", letterSpacing: "0.1em", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s" }}>
                  <DownloadIcon /> EXPORT
                </button>
                <button className="copy-btn" onClick={() => handleCopy("synth-" + activeSynthTab, synthesis[activeSynthTab])}
                  style={{ background: "none", border: "none", cursor: "pointer", color: copied["synth-" + activeSynthTab] ? "#D4763B" : "#2e2e2e", padding: 2, opacity: 0.8, transition: "all 0.15s" }}>
                  {copied["synth-" + activeSynthTab] ? <span style={{ fontSize: 11 }}>✓</span> : <CopyIcon />}
                </button>
              </div>
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
  );
}
