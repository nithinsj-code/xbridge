/**
 * bridge-ui.js — Injects a floating Bridge button into AI chat pages.
 * Appears near the chat input, allowing users to capture & continue conversations
 * without opening the extension popup.
 *
 * Self-contained: no ES module imports. All storage is direct chrome.storage.local.
 */

(function () {
  "use strict";

  if (window.__bridge_ui_loaded) return;
  window.__bridge_ui_loaded = true;

  // ─── Platform detection ───────────────────────────────────────────────────
  const PLATFORM_MAP = {
    "chatgpt.com": "ChatGPT",
    "claude.ai": "Claude",
    "gemini.google.com": "Gemini",
    "www.perplexity.ai": "Perplexity"
  };
  const PLATFORM = PLATFORM_MAP[location.hostname] || "Unknown";

  const PLATFORM_COLORS = {
    ChatGPT: "#10a37f",
    Claude: "#d28552",
    Gemini: "#4285f4",
    Perplexity: "#20b2aa"
  };

  // ─── STYLES moved to bridge-ui.css and injected via manifest.json ────────

  // ─── Build FAB + Panel (Pure DOM to bypass TrustedTypes) ─────────────────
  const fab = document.createElement("div");
  fab.id = "bridge-fab";

  const panel = document.createElement("div");
  panel.id = "bridge-panel";
  panel.style.display = "none";
  fab.appendChild(panel);

  const fabBtn = document.createElement("button");
  fabBtn.id = "bridge-fab-btn";
  fabBtn.title = "XBridge — Capture or continue conversation";

  const bridgeLogo = document.createElement("img");
  bridgeLogo.className = "bridge-emoji";
  bridgeLogo.src = chrome.runtime.getURL("icons/icon48.png");
  bridgeLogo.style.width = "24px";
  bridgeLogo.style.height = "24px";
  bridgeLogo.style.borderRadius = "4px";
  fabBtn.appendChild(bridgeLogo);

  const fabLabel = document.createElement("span");
  fabLabel.id = "bridge-fab-label";
  fabLabel.textContent = "XBridge";
  fabBtn.appendChild(fabLabel);

  fab.appendChild(fabBtn);
  document.body.appendChild(fab);

  let panelOpen = false;

  // ─── Toggle panel ─────────────────────────────────────────────────────────
  fabBtn.addEventListener("click", async () => {
    try {
      panelOpen = !panelOpen;
      if (panelOpen) {
        await renderPanel();
        panel.style.display = "block";
      } else {
        panel.style.display = "none";
      }
    } catch (err) {
      console.error("[XBridge] Panel render error:", err);
      showInlineToast("Error opening panel: " + err.message, "#ef4444");
      panelOpen = false;
    }
  });

  // Close panel on outside click
  document.addEventListener("click", (e) => {
    if (panelOpen && !fab.contains(e.target)) {
      panel.style.display = "none";
      panelOpen = false;
    }
  }, true);

  // Helper for pure DOM creation
  function el(tag, className, textContent) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (textContent) element.textContent = textContent;
    return element;
  }

  // ─── Render Panel Content ─────────────────────────────────────────────────
  async function renderPanel() {
    const apiKey = await getStorageItem("gemini_api_key");
    let convs = await getStorageItem("bridge_conversations");
    if (!Array.isArray(convs)) convs = [];
    const recent = convs.slice(0, 4);

    panel.textContent = ""; // Safe clear without innerHTML

    // Header
    const header = el("div", "bp-header");
    const headerLeft = el("div", "bp-header-left");

    const logoContainer = el("div", "bp-logo-icon");
    const logoImg = document.createElement("img");
    logoImg.src = chrome.runtime.getURL("icons/icon16.png");
    logoImg.style.cssText = "width:20px;height:20px;object-fit:contain;filter:brightness(10)";
    logoContainer.appendChild(logoImg);

    const headerText = el("div", "bp-header-text");
    const title = el("div", "bp-title", "XBRIDGE");
    const subtitle = el("div", "bp-subtitle", "on " + PLATFORM);

    headerText.appendChild(title);
    headerText.appendChild(subtitle);
    headerLeft.appendChild(logoContainer);
    headerLeft.appendChild(headerText);
    header.appendChild(headerLeft);

    const closeBtn = el("button", "bp-close", "✕");
    closeBtn.id = "bp-close-btn";
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Body
    const body = el("div", "bp-body");

    if (!apiKey) {
      const note = el("div");
      note.style.cssText = "font-size:11px;color:#f59e0b;padding:6px 10px;background:rgba(245,158,11,0.08);border-radius:8px;border:1px solid rgba(245,158,11,0.2)";
      note.textContent = "⚠ No API key set. Open the XBridge popup to add your Gemini key.";
      body.appendChild(note);
    }

    const captureBtn = el("button", "bp-capture-btn");
    captureBtn.id = "bp-capture-btn";
    const capIcon = el("span", "", "📸");
    const capLabel = el("span", "", "Capture This Conversation");
    capLabel.id = "bp-capture-label";
    captureBtn.appendChild(capIcon);
    captureBtn.appendChild(capLabel);
    body.appendChild(captureBtn);

    const secLabel = el("div", "bp-section-label", "Continue from saved");
    body.appendChild(secLabel);

    if (recent.length === 0) {
      const empty = el("div", "bp-empty");
      empty.textContent = "No saved conversations yet. Capture your first one above! 👆";
      body.appendChild(empty);
    } else {
      const convList = el("div", "bp-conv-list");
      recent.forEach(c => {
        const platClass = (c.platform || "unknown").toLowerCase();
        const item = el("div", "bp-conv-item");

        const info = el("div", "bp-conv-info");
        const ctitle = el("div", "bp-conv-title", c.title);
        ctitle.title = c.title;
        const meta = el("div", "bp-conv-meta");
        const badge = el("span", "bp-badge " + platClass, c.platform || "Unknown");
        const date = el("span", "bp-conv-date", relativeDate(c.capturedAt));

        meta.appendChild(badge);
        meta.appendChild(date);
        info.appendChild(ctitle);
        info.appendChild(meta);

        const cBtn = el("button", "bp-continue-here-btn", "Continue →");
        cBtn.dataset.id = c.id;
        cBtn.dataset.title = c.title;
        cBtn.dataset.platform = c.platform;

        item.appendChild(info);
        item.appendChild(cBtn);
        convList.appendChild(item);
      });
      body.appendChild(convList);
    }
    panel.appendChild(body);

    // Footer
    const footer = el("div", "bp-footer");
    const dashBtn = el("button", "bp-dashboard-link", "📋 Open Dashboard →");
    dashBtn.id = "bp-dashboard-btn";
    footer.appendChild(dashBtn);
    panel.appendChild(footer);

    // Events
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      panel.style.display = "none";
      panelOpen = false;
    });

    captureBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await doCaptureFromPanel(captureBtn);
    });

    panel.querySelectorAll(".bp-continue-here-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await doContinueHere(btn.dataset.id, btn.dataset.platform, btn.dataset.title);
      });
    });

    dashBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({
        type: "OPEN_TAB",
        url: chrome.runtime.getURL("pages/dashboard.html")
      }).catch(err => console.log("Dashboard opened", err));
    });
  }

  // ─── Capture from panel ───────────────────────────────────────────────────
  async function doCaptureFromPanel(captureBtn) {
    const label = document.getElementById("bp-capture-label");
    captureBtn.disabled = true;
    label.textContent = "Capturing...";

    try {
      const response = await chrome.runtime.sendMessage({ type: "CAPTURE_CONVERSATION_SELF" });

      if (response?.ok) {
        showInlineToast("Captured by XBridge ✓");
        panel.style.display = "none";
        panelOpen = false;
      } else {
        label.textContent = response?.error || "No conversation found";
        captureBtn.style.background = "linear-gradient(135deg,#ef4444,#f87171)";
        setTimeout(() => {
          captureBtn.disabled = false;
          captureBtn.style.background = "";
          label.textContent = "Capture This Conversation";
        }, 2500);
        return;
      }
    } catch {
      // Fallback: trigger capture via the already-loaded capture.js listener
      label.textContent = "✕ Error — refresh & try";
      setTimeout(() => {
        captureBtn.disabled = false;
        label.textContent = "Capture This Conversation";
      }, 2000);
      return;
    }

    captureBtn.disabled = false;
    label.textContent = "Capture This Conversation";
  }

  // ─── Continue a saved conversation here ──────────────────────────────────
  async function doContinueHere(id, platform, title) {
    const convs = await getStorageItem("bridge_conversations") || [];
    const conv = convs.find((c) => c.id === id);
    if (!conv) return;

    let contextText = buildContext(conv);
    await setStorageItem("pending_paste", contextText);

    showInlineToast("XBridge context loading into this chat... ↑");
    panel.style.display = "none";
    panelOpen = false;

    // Small delay then trigger autopaste manually on this page
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("bridge-paste-now", { detail: { text: contextText } }));
      tryPasteNow(contextText);
    }, 400);
  }

  // ─── Try to paste context into the current page's chat input ─────────────
  function tryPasteNow(text) {
    const SELECTORS = [
      "#prompt-textarea",
      "textarea[data-id='root']",
      '[contenteditable="true"][class*="ProseMirror"]',
      'div[contenteditable="true"]',
      ".ql-editor[contenteditable='true']",
      "textarea[placeholder]",
      "textarea",
      '[contenteditable="true"]'
    ];

    for (const sel of SELECTORS) {
      const el = document.querySelector(sel);
      if (el && isVisible(el)) {
        el.focus();
        if (el.tagName === "TEXTAREA") {
          const setter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, "value"
          )?.set;
          setter ? setter.call(el, text) : (el.value = text);
        } else if (el.isContentEditable) {
          el.textContent = text;
        }
        ["input", "change"].forEach((ev) => el.dispatchEvent(new Event(ev, { bubbles: true })));
        el.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, data: text }));
        return true;
      }
    }
    return false;
  }

  // ─── Build context string from conversation ──────────────────────────────
  function buildContext(conv) {
    if (conv.compressed) {
      const c = conv.compressed;
      const goals = (c.goals || []).map((g) => `• ${g}`).join("\n") || "• (none)";
      const tech = (c.tech_stack || []).join(", ") || "(none)";
      const completed = (c.completed_tasks || []).map((t) => `✓ ${t}`).join("\n") || "  (none)";
      const pending = (c.pending_tasks || []).map((t) => `◻ ${t}`).join("\n") || "  (none)";
      const recent = (c.recent_messages || []).join("\n") || "(none)";
      return `[XBRIDGE CONTEXT — Continuing from ${conv.platform}]

Project: ${c.project_title || conv.title}
Summary: ${c.summary || ""}

Goals:
${goals}

Tech Stack: ${tech}

Completed:
${completed}

Pending:
${pending}

Recent context:
${recent}

Please continue helping with this project.`;
    }

    // Raw fallback — last 15 messages
    const recent = (conv.messages || []).slice(-15);
    const transcript = recent.map((m) =>
      `[${m.role === "user" ? "User" : "Assistant"}]\n${m.content}`
    ).join("\n\n");
    return `[BRIDGE CONTEXT — Continuing from ${conv.platform}]\n\nProject: ${conv.title}\n\n${transcript}\n\nPlease continue helping with this project.`;
  }

  // ─── Storage helpers (no imports) ────────────────────────────────────────
  function getStorageItem(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (res) => resolve(res[key] || null));
    });
  }
  function setStorageItem(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  }

  // ─── Utilities ────────────────────────────────────────────────────────────
  function esc(str) {
    return String(str || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function isVisible(el) {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
  }

  function relativeDate(ts) {
    if (!ts) return "";
    const diff = Math.floor((Date.now() - ts) / 60000);
    if (diff < 1) return "just now";
    if (diff < 60) return `${diff}m ago`;
    const h = Math.floor(diff / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  function showInlineToast(msg, color = "#1D9E75") {
    const existing = document.getElementById("bridge-inline-toast");
    if (existing) existing.remove();
    const toast = document.createElement("div");
    toast.id = "bridge-inline-toast";
    toast.textContent = msg;
    toast.style.background = `linear-gradient(135deg, ${color}, ${color}dd)`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = "opacity 0.4s, transform 0.4s";
      toast.style.opacity = "0";
      toast.style.transform = "translateX(-50%) translateY(16px)";
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  }

  // End of bridge-ui.js
  console.log(`[XBridge UI] Floating button injected on ${PLATFORM}`);
})();
