/**
 * popup.js — Bridge popup controller.
 * Exported as default init function, called by popup.html after dynamic import.
 */

import {
  getApiKey, saveApiKey, clearApiKey,
  getConversations, deleteConversation, updateConversation,
  setPendingPaste, getTaskStates, saveTaskStates
} from "../lib/storage.js";
import { validateApiKey } from "../lib/gemini.js";
import {
  compressConversation,
  buildContinueContext,
  buildRawContext
} from "../lib/compressor.js";
import { extractTasks } from "../lib/extractor.js";

// ─── State ────────────────────────────────────────────────────────────────────
let currentConvId = null;
let selectedConv = null;
let currentPlatform = null;
let currentTabId = null;
let exportMenuOpen = false;
let settingsOpen = false;
let taskStates = {};

const AI_HOSTS = {
  "chatgpt.com": "ChatGPT",
  "claude.ai": "Claude",
  "gemini.google.com": "Gemini",
  "www.perplexity.ai": "Perplexity"
};

// ─── DOM helpers ─────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const show = (el) => el?.classList.remove("hidden");
const hide = (el) => el?.classList.add("hidden");

// ─── Main init ────────────────────────────────────────────────────────────────
async function init() {
  // Hide boot screen
  hide($("boot-screen"));

  try {
    const apiKey = await getApiKey();
    if (!apiKey) {
      showScreen("onboarding");
    } else {
      showScreen("main");
      maskAndShowKey(apiKey);
      await detectTabAndRender();
    }
  } catch (err) {
    console.error("[Bridge] init error:", err);
    showScreen("onboarding"); // Fall back to onboarding on any error
  }

  attachEventListeners();
}

// ─── Screen management ────────────────────────────────────────────────────────
function showScreen(screen) {
  hide($("onboarding"));
  hide($("main-popup"));
  hide($("boot-screen"));
  if (screen === "onboarding") show($("onboarding"));
  else show($("main-popup"));
}

function showState(state) {
  hide($("state-b"));
  hide($("state-c"));
  hide($("state-d"));
  if (state === "B") show($("state-b"));
  else if (state === "C") show($("state-c"));
  else show($("state-d"));
}

// ─── Tab detection ────────────────────────────────────────────────────────────
async function detectTabAndRender() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTabId = tab?.id;
    const url = tab?.url || "";
    let host = "";
    try { host = new URL(url).hostname; } catch {}
    currentPlatform = AI_HOSTS[host] || null;

    const badge = $("current-platform-badge");
    if (currentPlatform) {
      badge.textContent = currentPlatform;
      show(badge);
    } else {
      hide(badge);
    }
  } catch {
    currentPlatform = null;
  }

  await renderRecentConversations();

  if (currentPlatform) {
    $("state-b-platform").textContent = `${currentPlatform} detected`;
    showState("B");
  } else {
    showState("D");
  }
}

// ─── Recent conversations ─────────────────────────────────────────────────────
async function renderRecentConversations() {
  const convs = await getConversations();
  const recent = convs.slice(0, 5);
  const list = $("recent-conversations-list");

  if (recent.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">💬</span>
        <div class="empty-state-text">No conversations yet.<br>Capture your first one!</div>
      </div>`;
    return;
  }

  list.innerHTML = recent.map((c) => `
    <div class="conv-card" data-id="${c.id}" id="card-${c.id}">
      <div class="conv-card-info">
        <div class="conv-title">${escHtml(c.title)}</div>
        <div class="conv-meta">
          <span class="platform-badge ${(c.platform || "").toLowerCase()}">${escHtml(c.platform || "Unknown")}</span>
          <span class="conv-date">${formatDate(c.capturedAt)}</span>
          <span class="conv-msg-count">${c.messageCount || 0} msgs</span>
        </div>
      </div>
      <div class="conv-card-actions">
        <button class="conv-action-btn delete" data-id="${c.id}" title="Delete">🗑</button>
      </div>
    </div>`).join("");

  list.querySelectorAll(".conv-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".conv-action-btn")) return;
      selectConversation(card.dataset.id);
    });
  });

  list.querySelectorAll(".conv-action-btn.delete").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (btn.dataset.id === currentConvId) {
        currentConvId = null; selectedConv = null;
        show($("recent-conversations-section"));
        showState(currentPlatform ? "B" : "D");
      }
      await deleteConversation(btn.dataset.id);
      await renderRecentConversations();
      showToast("Deleted", "info");
    });
  });
}

// ─── Select conversation ──────────────────────────────────────────────────────
async function selectConversation(id) {
  const convs = await getConversations();
  const conv = convs.find((c) => c.id === id);
  if (!conv) return;

  currentConvId = id;
  selectedConv = conv;
  taskStates = await getTaskStates(id);

  $("sc-title").textContent = conv.title;
  $("sc-badge").textContent = conv.platform || "Unknown";
  $("sc-badge").className = `platform-badge ${(conv.platform || "").toLowerCase()}`;
  $("sc-msg-count").textContent = `${conv.messageCount || conv.messages?.length || 0} messages`;

  const compressBtn = $("compress-btn");
  if (conv.compressed) {
    renderSummary(conv.compressed);
    hide(compressBtn);
    show($("token-savings"));
  } else {
    hide($("summary-card"));
    hide($("token-savings"));
    show(compressBtn);
    $("compress-label").textContent = "Compress & Summarize";
    hide($("compress-spinner"));
  }

  if (conv.tasks) renderTasks(conv.tasks);
  else $("task-list").innerHTML = "";

  showState("C");
  hide($("recent-conversations-section"));

  document.querySelectorAll(".conv-card").forEach((c) => c.classList.remove("active"));
  $(`card-${id}`)?.classList.add("active");
}

function renderSummary(compressed) {
  show($("summary-card"));
  $("summary-text").textContent = compressed.summary || "";
  if (Array.isArray(compressed.tech_stack) && compressed.tech_stack.length) {
    show($("tech-stack-row"));
    $("tech-tags").innerHTML = compressed.tech_stack.map((t) => `<span class="tag">${escHtml(t)}</span>`).join("");
  } else {
    hide($("tech-stack-row"));
  }
}

function renderTasks(tasks) {
  const { completed = [], pending = [], next_steps = [] } = tasks;
  const list = $("task-list");

  if (!completed.length && !pending.length && !next_steps.length) {
    list.innerHTML = `<div style="font-size:12px;color:var(--text-muted);padding:4px">No tasks extracted.</div>`;
    return;
  }

  let html = "";
  completed.forEach((t) => {
    html += `<div class="task-item completed"><span class="task-icon">✅</span><span class="task-text">${escHtml(t)}</span></div>`;
  });
  pending.forEach((t, i) => {
    const checked = taskStates[`p_${i}`] ? "checked" : "";
    html += `<label class="task-item pending" style="cursor:pointer">
      <input type="checkbox" class="task-checkbox" data-key="p_${i}" ${checked} />
      <span class="task-text">${escHtml(t)}</span>
    </label>`;
  });
  next_steps.forEach((t) => {
    html += `<div class="task-item next-step"><span class="task-icon" style="color:var(--primary)">→</span><span class="task-text">${escHtml(t)}</span></div>`;
  });
  list.innerHTML = html;

  list.querySelectorAll(".task-checkbox").forEach((cb) => {
    cb.addEventListener("change", async () => {
      taskStates[cb.dataset.key] = cb.checked;
      await saveTaskStates(currentConvId, taskStates);
      const txt = cb.closest(".task-item")?.querySelector(".task-text");
      if (txt) txt.style.textDecoration = cb.checked ? "line-through" : "none";
    });
  });
}

// ─── Event Listeners ─────────────────────────────────────────────────────────
function attachEventListeners() {

  // ── Onboarding ──
  $("aistudio-link").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: "https://aistudio.google.com/apikey" });
  });

  $("api-key-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("save-key-btn").click();
  });

  $("save-key-btn").addEventListener("click", async () => {
    const key = $("api-key-input").value.trim();
    const msgEl = $("key-validation-msg");
    if (!key) { showInlineMsg(msgEl, "Please paste your API key.", "error"); return; }

    setLoading($("save-key-label"), $("save-key-spinner"), true, "Verifying...");
    $("save-key-btn").disabled = true;
    hide(msgEl);

    const result = await validateApiKey(key);
    if (result.valid) {
      await saveApiKey(key);
      showInlineMsg(msgEl, "✓ Key verified!", "success");
      await new Promise((r) => setTimeout(r, 700));
      maskAndShowKey(key);
      showScreen("main");
      await detectTabAndRender();
    } else {
      showInlineMsg(msgEl, result.reason || "Invalid key. Check and try again.", "error");
    }
    setLoading($("save-key-label"), $("save-key-spinner"), false, "Save & Start Using Bridge");
    $("save-key-btn").disabled = false;
  });

  // ── Settings ──
  $("settings-toggle-btn").addEventListener("click", () => {
    settingsOpen = !settingsOpen;
    settingsOpen ? show($("settings-panel")) : hide($("settings-panel"));
    if (settingsOpen) hide($("change-key-form"));
  });

  $("change-key-btn").addEventListener("click", () => {
    show($("change-key-form"));
    hide($("new-key-msg"));
    $("new-key-input").value = "";
    $("new-key-input").focus();
  });

  $("cancel-change-key-btn").addEventListener("click", () => hide($("change-key-form")));

  $("clear-key-btn").addEventListener("click", async () => {
    if (!confirm("Clear your API key? You'll need to re-enter it.")) return;
    await clearApiKey();
    showScreen("onboarding");
  });

  $("new-key-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("save-new-key-btn").click();
  });

  $("save-new-key-btn").addEventListener("click", async () => {
    const key = $("new-key-input").value.trim();
    if (!key) { showInlineMsg($("new-key-msg"), "Please enter a key.", "error"); return; }
    setLoading($("save-new-key-label"), $("save-new-key-spinner"), true, "Verifying...");
    $("save-new-key-btn").disabled = true;
    const result = await validateApiKey(key);
    if (result.valid) {
      await saveApiKey(key);
      maskAndShowKey(key);
      hide($("change-key-form"));
      hide($("settings-panel"));
      settingsOpen = false;
      showToast("Key updated ✓", "success");
    } else {
      showInlineMsg($("new-key-msg"), result.reason || "Invalid key.", "error");
    }
    setLoading($("save-new-key-label"), $("save-new-key-spinner"), false, "Verify & Save");
    $("save-new-key-btn").disabled = false;
  });

  // ── Capture ──
  $("capture-btn").addEventListener("click", async () => {
    if (!currentTabId) { showToast("No active tab", "error"); return; }
    setLoading($("capture-label"), $("capture-spinner"), true, "Capturing...");
    $("capture-btn").disabled = true;
    try {
      const resp = await chrome.tabs.sendMessage(currentTabId, { type: "CAPTURE_CONVERSATION" });
      if (resp?.ok) {
        showToast("Captured ✓", "success");
        await renderRecentConversations();
        if (resp.conv?.id) await selectConversation(resp.conv.id);
      } else {
        showToast(resp?.error || "No conversation found on this page.", "error");
      }
    } catch {
      showToast("Couldn't reach the page. Refresh and try again.", "error");
    }
    setLoading($("capture-label"), $("capture-spinner"), false, "Capture This Conversation");
    $("capture-btn").disabled = false;
  });

  // ── Back ──
  $("back-to-list-btn").addEventListener("click", () => {
    currentConvId = null; selectedConv = null;
    show($("recent-conversations-section"));
    showState(currentPlatform ? "B" : "D");
  });

  // ── Compress ──
  $("compress-btn").addEventListener("click", async () => {
    if (!selectedConv) return;
    setLoading($("compress-label"), $("compress-spinner"), true, "Compressing...");
    $("compress-btn").disabled = true;
    try {
      const { compressed, tokenSavings } = await compressConversation(selectedConv.messages);
      await updateConversation(currentConvId, { compressed });
      const convs = await getConversations();
      selectedConv = convs.find((c) => c.id === currentConvId);
      renderSummary(compressed);
      hide($("compress-btn"));
      show($("token-savings"));
      $("token-savings-text").textContent = `Saved ~${tokenSavings.saved.toLocaleString()} tokens (${tokenSavings.percent}% reduction)`;
      showToast("Compressed ✓", "success");
    } catch (err) {
      handleApiError(err);
    }
    setLoading($("compress-label"), $("compress-spinner"), false, "Compress & Summarize");
    $("compress-btn").disabled = false;
  });

  // ── Extract tasks ──
  $("extract-tasks-btn").addEventListener("click", async () => {
    if (!selectedConv) return;
    setLoading($("extract-label"), $("extract-spinner"), true, "Extracting...");
    $("extract-tasks-btn").disabled = true;
    try {
      const tasks = await extractTasks(selectedConv.messages);
      await updateConversation(currentConvId, { tasks });
      const convs = await getConversations();
      selectedConv = convs.find((c) => c.id === currentConvId);
      renderTasks(tasks);
      showToast("Tasks extracted ✓", "success");
    } catch (err) {
      handleApiError(err);
    }
    setLoading($("extract-label"), $("extract-spinner"), false, "Extract Tasks");
    $("extract-tasks-btn").disabled = false;
  });

  // ── Continue In ──
  document.querySelectorAll(".continue-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!selectedConv) return;
      const ctx = selectedConv.compressed
        ? buildContinueContext(selectedConv.compressed, selectedConv.platform)
        : buildRawContext(selectedConv.messages, selectedConv.title, selectedConv.platform);
      await setPendingPaste(ctx);
      chrome.tabs.create({ url: btn.dataset.url });
      window.close();
    });
  });

  // ── Export ──
  $("export-toggle-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    exportMenuOpen = !exportMenuOpen;
    exportMenuOpen ? show($("export-menu")) : hide($("export-menu"));
  });
  document.addEventListener("click", () => {
    if (exportMenuOpen) { exportMenuOpen = false; hide($("export-menu")); }
  });
  $("export-md").addEventListener("click",  () => exportConversation("md"));
  $("export-txt").addEventListener("click", () => exportConversation("txt"));
  $("export-pdf").addEventListener("click", () => exportConversation("pdf"));

  // ── Dashboard ──
  $("open-dashboard-link").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL("pages/dashboard.html") });
    window.close();
  });
}

// ─── Export ───────────────────────────────────────────────────────────────────
function exportConversation(format) {
  if (!selectedConv) return;
  hide($("export-menu")); exportMenuOpen = false;

  if (format === "pdf") {
    chrome.tabs.create({ url: chrome.runtime.getURL(`pages/viewer.html?id=${currentConvId}&print=1`) });
    return;
  }

  const { title, platform, messages = [], compressed, capturedAt } = selectedConv;
  const dateStr = new Date(capturedAt).toLocaleString();
  let content = "";

  if (format === "md") {
    content = `# ${title}\n\n**Platform:** ${platform}  \n**Captured:** ${dateStr}\n\n`;
    if (compressed?.summary) content += `## Summary\n\n${compressed.summary}\n\n---\n\n`;
    messages.forEach((m) => {
      content += `## ${m.role === "user" ? "👤 User" : "🤖 Assistant"}\n\n${m.content}\n\n`;
    });
  } else {
    content = `${title}\n${"=".repeat(Math.min(title.length, 60))}\nPlatform: ${platform}\nCaptured: ${dateStr}\n\n`;
    messages.forEach((m) => {
      content += `${m.role === "user" ? "USER:" : "ASSISTANT:"}\n${m.content}\n\n${"─".repeat(40)}\n\n`;
    });
  }

  const ext = format === "md" ? "md" : "txt";
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `bridge-${slugify(title)}.${ext}`;
  a.click(); URL.revokeObjectURL(url);
  showToast(`Exported as .${ext} ✓`, "success");
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function handleApiError(err) {
  const msg = err?.message || "Unknown error";
  if (msg.includes("NO_API_KEY")) showScreen("onboarding");
  else if (msg.includes("RATE_LIMIT")) showToast("Rate limit reached. Try in 1 minute.", "error");
  else if (msg.includes("INVALID_KEY")) { showToast("API key invalid. Update in settings.", "error"); }
  else showToast(msg.slice(0, 80), "error");
}

function setLoading(labelEl, spinnerEl, loading, text) {
  labelEl.textContent = text;
  loading ? spinnerEl?.classList.remove("hidden") : spinnerEl?.classList.add("hidden");
}

function showToast(message, type = "info") {
  document.querySelector(".toast")?.remove();
  const t = document.createElement("div");
  t.className = `toast toast-${type}`;
  t.textContent = message;
  $("app").appendChild(t);
  setTimeout(() => {
    t.style.transition = "all 0.3s ease";
    t.style.opacity = "0";
    t.style.transform = "translateX(-50%) translateY(16px)";
    setTimeout(() => t.remove(), 300);
  }, 2800);
}

function showInlineMsg(el, text, type) {
  el.textContent = text;
  el.style.color = type === "error" ? "var(--danger)" : "var(--accent)";
  el?.classList.remove("hidden");
}

function maskAndShowKey(key) {
  const last4 = key.slice(-4);
  const el = $("key-masked-display");
  if (el) el.textContent = `AIza••••••••${last4}`;
}

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatDate(ts) {
  if (!ts) return "";
  const d = Date.now() - ts, m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function slugify(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

// ─── Default export so popup.html can import it ───────────────────────────────
export default init;

// Run immediately (also works if imported as a regular module)
init();
