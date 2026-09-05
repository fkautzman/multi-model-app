import { useState } from "react";
import { PencilIcon, TrashIcon } from "./Icons";

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

export default function Sidebar({ sessions, activeSessionId, onNewSession, onLoadSession, onDeleteSession, onRenameSession }) {
  const [hoveredSessionId, setHoveredSessionId] = useState(null);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editTitle, setEditTitle] = useState("");

  const startRename = (sessionId, currentTitle, e) => {
    e.stopPropagation();
    setEditingSessionId(sessionId);
    setEditTitle(currentTitle);
  };

  const commitRename = (sessionId) => {
    if (editTitle.trim()) onRenameSession(sessionId, editTitle.trim());
    setEditingSessionId(null);
    setEditTitle("");
  };

  return (
    <aside style={{ width: 220, flexShrink: 0, height: "100vh", overflowY: "auto", borderRight: "1px solid #161616", background: "#070707", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "18px 14px 12px", borderBottom: "1px solid #141414" }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#3a3a3a", letterSpacing: "0.2em", marginBottom: 12 }}>SIGNAL RUNNER</div>
        <button className="new-session-btn" onClick={onNewSession}
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
              onClick={() => !isEditing && onLoadSession(session.id)}
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
                      <button className="session-del" onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
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
  );
}
