/**
 * storage.js — Chrome storage helpers for Bridge extension.
 * All data is stored in chrome.storage.local (device-only, no sync).
 */

const KEYS = {
  API_KEY: "gemini_api_key",
  CONVERSATIONS: "bridge_conversations",
  PENDING_PASTE: "pending_paste",
  SETTINGS: "bridge_settings",
  TASK_STATES: "bridge_task_states"
};

// ─── API Key ────────────────────────────────────────────────────────────────

/**
 * Save the user's Gemini API key to local storage.
 * @param {string} key
 */
export async function saveApiKey(key) {
  return chrome.storage.local.set({ [KEYS.API_KEY]: key });
}

/**
 * Retrieve the stored Gemini API key.
 * @returns {Promise<string|null>}
 */
export async function getApiKey() {
  const result = await chrome.storage.local.get(KEYS.API_KEY);
  return result[KEYS.API_KEY] || null;
}

/**
 * Remove the stored API key (forces re-onboarding).
 */
export async function clearApiKey() {
  return chrome.storage.local.remove(KEYS.API_KEY);
}

// ─── Conversations ───────────────────────────────────────────────────────────

/**
 * Save a new conversation (appends to list).
 * Conversation shape:
 * {
 *   id: string (UUID),
 *   title: string,
 *   platform: string,
 *   messages: [{role, content, links, timestamp}],
 *   compressed: object|null,
 *   tasks: object|null,
 *   capturedAt: number (timestamp),
 *   messageCount: number
 * }
 * @param {object} conv
 */
export async function saveConversation(conv) {
  const existing = await getConversations();
  // Replace if same id already exists, otherwise prepend (newest first)
  const idx = existing.findIndex((c) => c.id === conv.id);
  if (idx !== -1) {
    existing[idx] = conv;
  } else {
    existing.unshift(conv);
  }
  return chrome.storage.local.set({ [KEYS.CONVERSATIONS]: existing });
}

/**
 * Get all stored conversations (newest first).
 * @returns {Promise<object[]>}
 */
export async function getConversations() {
  const result = await chrome.storage.local.get(KEYS.CONVERSATIONS);
  return result[KEYS.CONVERSATIONS] || [];
}

/**
 * Get a single conversation by id.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getConversationById(id) {
  const convs = await getConversations();
  return convs.find((c) => c.id === id) || null;
}

/**
 * Delete a conversation by id.
 * @param {string} id
 */
export async function deleteConversation(id) {
  const existing = await getConversations();
  const filtered = existing.filter((c) => c.id !== id);
  return chrome.storage.local.set({ [KEYS.CONVERSATIONS]: filtered });
}

/**
 * Update a specific field on a conversation.
 * @param {string} id
 * @param {object} updates - partial object to merge
 */
export async function updateConversation(id, updates) {
  const conv = await getConversationById(id);
  if (!conv) return;
  const updated = { ...conv, ...updates };
  return saveConversation(updated);
}

// ─── Pending Paste ───────────────────────────────────────────────────────────

/**
 * Store context string to be auto-pasted on the next AI platform page load.
 * @param {string} text
 */
export async function setPendingPaste(text) {
  return chrome.storage.local.set({ [KEYS.PENDING_PASTE]: text });
}

/**
 * Retrieve and immediately clear pending paste (one-time use).
 * @returns {Promise<string|null>}
 */
export async function consumePendingPaste() {
  const result = await chrome.storage.local.get(KEYS.PENDING_PASTE);
  const value = result[KEYS.PENDING_PASTE] || null;
  if (value) {
    await chrome.storage.local.remove(KEYS.PENDING_PASTE);
  }
  return value;
}

// ─── Task Checkbox States ─────────────────────────────────────────────────────

/**
 * Save per-conversation task checkbox states.
 * @param {string} convId
 * @param {object} states - { taskIndex: boolean }
 */
export async function saveTaskStates(convId, states) {
  const result = await chrome.storage.local.get(KEYS.TASK_STATES);
  const all = result[KEYS.TASK_STATES] || {};
  all[convId] = states;
  return chrome.storage.local.set({ [KEYS.TASK_STATES]: all });
}

/**
 * Get task checkbox states for a conversation.
 * @param {string} convId
 * @returns {Promise<object>}
 */
export async function getTaskStates(convId) {
  const result = await chrome.storage.local.get(KEYS.TASK_STATES);
  const all = result[KEYS.TASK_STATES] || {};
  return all[convId] || {};
}

// ─── Settings ─────────────────────────────────────────────────────────────────

/**
 * Save user settings object (merged with existing).
 * @param {object} settings
 */
export async function saveSettings(settings) {
  const existing = await getSettings();
  return chrome.storage.local.set({
    [KEYS.SETTINGS]: { ...existing, ...settings }
  });
}

/**
 * Get current settings.
 * @returns {Promise<object>}
 */
export async function getSettings() {
  const result = await chrome.storage.local.get(KEYS.SETTINGS);
  return result[KEYS.SETTINGS] || {};
}

// ─── Export All ───────────────────────────────────────────────────────────────

/**
 * Export all Bridge data as a JSON backup object.
 * @returns {Promise<object>}
 */
export async function exportAllData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (data) => {
      resolve({
        exportedAt: new Date().toISOString(),
        version: "1.0.0",
        conversations: data[KEYS.CONVERSATIONS] || [],
        settings: data[KEYS.SETTINGS] || {}
      });
    });
  });
}
