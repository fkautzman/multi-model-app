const STORAGE_KEY = "signal-runner-sessions-v2";

function _read() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function _write(sessions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {}
}

export function list() {
  return _read();
}

export function save(session) {
  const sessions = _read();
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    sessions[idx] = session;
  } else {
    sessions.unshift(session);
  }
  _write(sessions);
  return session;
}

export function load(sessionId) {
  return _read().find((s) => s.id === sessionId) ?? null;
}

export function remove(sessionId) {
  _write(_read().filter((s) => s.id !== sessionId));
}

export function update(sessionId, partial) {
  const sessions = _read();
  const idx = sessions.findIndex((s) => s.id === sessionId);
  if (idx < 0) return null;
  sessions[idx] = { ...sessions[idx], ...partial, updatedAt: Date.now() };
  _write(sessions);
  return sessions[idx];
}

export function generateTitle(prompt) {
  const text = prompt.trim().replace(/\s+/g, " ");
  return text.length > 50 ? text.slice(0, 47) + "…" : text;
}

export function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
