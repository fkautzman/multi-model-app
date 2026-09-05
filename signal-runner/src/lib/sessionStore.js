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

/**
 * Returns all sessions, most-recent first.
 * @returns {Array<Object>} Array of session objects.
 */
export function list() {
  return _read();
}

/**
 * Upserts a session — inserts at front if new, replaces in-place if existing.
 * @param {Object} session - Full session object with at minimum an `id` field.
 * @returns {Object} The saved session.
 */
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

/**
 * Loads a single session by id.
 * @param {string} sessionId
 * @returns {Object|null} The session, or null if not found.
 */
export function load(sessionId) {
  return _read().find((s) => s.id === sessionId) ?? null;
}

/**
 * Deletes a session by id. No-op if not found.
 * @param {string} sessionId
 */
export function remove(sessionId) {
  _write(_read().filter((s) => s.id !== sessionId));
}

/**
 * Merges partial fields into an existing session and updates `updatedAt`.
 * @param {string} sessionId
 * @param {Object} partial - Fields to merge (e.g. `{ title, turns, synthesis }`).
 * @returns {Object|null} The updated session, or null if not found.
 */
export function update(sessionId, partial) {
  const sessions = _read();
  const idx = sessions.findIndex((s) => s.id === sessionId);
  if (idx < 0) return null;
  sessions[idx] = { ...sessions[idx], ...partial, updatedAt: Date.now() };
  _write(sessions);
  return sessions[idx];
}

/**
 * Generates a display title from the first 50 chars of a prompt.
 * @param {string} prompt
 * @returns {string}
 */
export function generateTitle(prompt) {
  const text = prompt.trim().replace(/\s+/g, " ");
  return text.length > 50 ? text.slice(0, 47) + "…" : text;
}

/**
 * Converts a title into a URL/filename-safe slug (max 60 chars).
 * @param {string} title
 * @returns {string}
 */
export function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
