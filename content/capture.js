/**
 * capture.js — Content script injected into ChatGPT, Claude, Gemini, Perplexity.
 * Extracts conversation messages and saves them via chrome.storage.local.
 *
 * NOTE: Content scripts cannot use ES module imports. All logic is self-contained
 * and storage is accessed directly via chrome.storage.local.
 */

(function () {
  "use strict";

  // Prevent double-injection
  if (window.__bridge_capture_loaded) return;
  window.__bridge_capture_loaded = true;

  // ─── Platform Detection ──────────────────────────────────────────────────

  const hostname = window.location.hostname;

  const PLATFORM_MAP = {
    "chatgpt.com": "ChatGPT",
    "claude.ai": "Claude",
    "gemini.google.com": "Gemini",
    "www.perplexity.ai": "Perplexity"
  };

  const CURRENT_PLATFORM = PLATFORM_MAP[hostname] || "Unknown";

  // ─── Per-Platform Message Selectors ──────────────────────────────────────

  /**
   * Extract messages from ChatGPT (chat.openai.com / chatgpt.com).
   * Uses data-message-author-role attribute to identify messages.
   */
  function extractChatGPT() {
    const elements = document.querySelectorAll("[data-message-author-role]");
    return Array.from(elements).map((el) => {
      const role = el.getAttribute("data-message-author-role"); // "user" or "assistant"
      const content = extractTextWithCodeBlocks(el);
      return { role, content, links: extractLinks(el), timestamp: Date.now() };
    });
  }

  /**
   * Extract messages from Claude (claude.ai).
   */
  function extractClaude() {
    // 2026 modern Claude selectors
    const userNodes = document.querySelectorAll(
      '[data-testid="user-message"], .font-user-message, [class*="user-message"], [class*="HumanMessage"], [data-message-role="user"]'
    );
    const aiNodes = document.querySelectorAll(
      '[data-testid="ai-message"], .font-claude-message, [class*="claude"], [class*="Claude"], .prose, .markdown, [class*="markdown"], [class*="assistant"], [class*="Assistant"], [data-author="claude"], [data-is-bot], [class*="response"], [class*="reply"]'
    );

    let all = [
      ...Array.from(userNodes).map((el) => ({ el, role: "user" })),
      ...Array.from(aiNodes).map((el) => ({ el, role: "assistant" }))
    ];

    // If aiNodes completely failed to match, use DOM sibling fallback
    if (aiNodes.length === 0 && userNodes.length > 0) {
      all = [];
      userNodes.forEach(el => {
        all.push({ el, role: "user" });
        let next = el.nextElementSibling || (el.parentElement && el.parentElement.nextElementSibling);
        if (next) all.push({ el: next, role: "assistant" });
      });
    }

    // Elegant deduplication: KEEP the innermost elements.
    // If 'item' contains 'other', then 'item' is an outer wrapper, so we REMOVE 'item'.
    all = all.filter(item => {
      return !all.some(other => other.el !== item.el && item.el.contains(other.el));
    });

    // Sort by DOM position
    all.sort((a, b) => {
      const pos = a.el.compareDocumentPosition(b.el);
      return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });

    return all.map(({ el, role }) => ({
      role,
      content: extractTextWithCodeBlocks(el),
      links: extractLinks(el),
      timestamp: Date.now()
    })).filter(m => m.content.trim().length > 0);
  }

  /**
   * Extract messages from Gemini (gemini.google.com).
   */
  function extractGemini() {
    const userNodes = document.querySelectorAll(
      "user-query, [class*='user-query'], [class*='query-text'], [data-test-id='user-query']"
    );
    const aiNodes = document.querySelectorAll(
      "model-response, [class*='model-response'], ms-chat-turn[isaichatturn], [class*='message-content'], response-text"
    );

    let all = [
      ...Array.from(userNodes).map((el) => ({ el, role: "user" })),
      ...Array.from(aiNodes).map((el) => ({ el, role: "assistant" }))
    ];

    // Elegant deduplication: KEEP the innermost elements
    all = all.filter(item => {
      return !all.some(other => other.el !== item.el && item.el.contains(other.el));
    });

    all.sort((a, b) => {
      const pos = a.el.compareDocumentPosition(b.el);
      return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });

    return all.map(({ el, role }) => ({
      role,
      content: extractTextWithCodeBlocks(el),
      links: extractLinks(el),
      timestamp: Date.now()
    })).filter(m => m.content.trim().length > 0);
  }

  /**
   * Extract messages from Perplexity (perplexity.ai).
   */
  function extractPerplexity() {
    // Perplexity uses very generic utility classes, but wraps turns in distinct blocks
    const userNodes = document.querySelectorAll(
      "[class*='query'], [class*='user-message'], [class*='UserMessage']"
    );
    const aiNodes = document.querySelectorAll(
      ".prose, [class*='answer'], [class*='Answer']"
    );

    let all = [
      ...Array.from(userNodes).map((el) => ({ el, role: "user" })),
      ...Array.from(aiNodes).map((el) => ({ el, role: "assistant" }))
    ];

    // Elegant deduplication: KEEP the innermost elements
    all = all.filter(item => {
      return !all.some(other => other.el !== item.el && item.el.contains(other.el));
    });

    all.sort((a, b) => {
      const pos = a.el.compareDocumentPosition(b.el);
      return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });

    return all.map(({ el, role }) => ({
      role,
      content: extractTextWithCodeBlocks(el),
      links: extractLinks(el),
      timestamp: Date.now()
    })).filter(m => m.content.trim().length > 0);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Extract text from an element, preserving code blocks with language tags.
   * @param {Element} el
   * @returns {string}
   */
  function extractTextWithCodeBlocks(el) {
    // Clone to avoid modifying the DOM
    const clone = el.cloneNode(true);

    // Convert <code> blocks to markdown-style fences
    clone.querySelectorAll("pre code, pre").forEach((codeEl) => {
      // Try to get the language from class like "language-js"
      const langMatch = (codeEl.className || "").match(/language-(\w+)/);
      const lang = langMatch ? langMatch[1] : "";
      const codeText = codeEl.textContent || "";
      const fence = `\n\`\`\`${lang}\n${codeText}\n\`\`\`\n`;
      codeEl.replaceWith(fence);
    });

    // Get cleaned text
    return (clone.textContent || clone.innerText || "").trim();
  }

  /**
   * Extract all href links from an element.
   * @param {Element} el
   * @returns {string[]}
   */
  function extractLinks(el) {
    const anchors = el.querySelectorAll("a[href]");
    const links = [];
    anchors.forEach((a) => {
      const href = a.getAttribute("href");
      if (href && href.startsWith("http")) {
        links.push(href);
      }
    });
    return [...new Set(links)]; // deduplicate
  }

  /**
   * Generate a conversation title from the first user message.
   * @param {object[]} messages
   * @returns {string}
   */
  function generateTitle(messages) {
    const firstUser = messages.find((m) => m.role === "user");
    if (!firstUser) return "Untitled Conversation";
    const text = firstUser.content.replace(/\n+/g, " ").trim();
    return text.length > 60 ? text.slice(0, 57) + "..." : text;
  }

  // ─── Main Capture Logic ───────────────────────────────────────────────────

  /**
   * Extract messages based on current platform.
   * @returns {object[]}
   */
  function extractMessages() {
    switch (CURRENT_PLATFORM) {
      case "ChatGPT":
        return extractChatGPT();
      case "Claude":
        return extractClaude();
      case "Gemini":
        return extractGemini();
      case "Perplexity":
        return extractPerplexity();
      default:
        return [];
    }
  }

  /**
   * Show a brief toast notification on the page.
   * @param {string} message
   * @param {"success"|"error"|"info"} type
   */
  function showToast(message, type = "success") {
    // Remove existing toast
    const existing = document.getElementById("bridge-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "bridge-toast";

    const colors = {
      success: "linear-gradient(135deg, #1D9E75, #16a34a)",
      error: "linear-gradient(135deg, #ef4444, #dc2626)",
      info: "linear-gradient(135deg, #534AB7, #6d5ce7)"
    };

    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483647;
      padding: 12px 20px;
      border-radius: 10px;
      background: ${colors[type] || colors.success};
      color: white;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 8px 32px rgba(0,0,0,0.25);
      display: flex;
      align-items: center;
      gap: 8px;
      animation: bridge-slide-in 0.3s ease;
      max-width: 340px;
      line-height: 1.4;
    `;

    // Inject keyframes once
    if (!document.getElementById("bridge-toast-styles")) {
      const style = document.createElement("style");
      style.id = "bridge-toast-styles";
      style.textContent = `
        @keyframes bridge-slide-in {
          from { transform: translateX(120%); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
        @keyframes bridge-slide-out {
          from { transform: translateX(0);   opacity: 1; }
          to   { transform: translateX(120%); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    toast.innerHTML = `
      <span style="font-size:18px">${type === "success" ? "✓" : type === "error" ? "✕" : "⟳"}</span>
      <span>${message}</span>
    `;
    document.body.appendChild(toast);

    // Auto-dismiss after 3.5 seconds
    setTimeout(() => {
      toast.style.animation = "bridge-slide-out 0.3s ease forwards";
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  /**
   * Save conversation to chrome.storage.local directly (no module imports in content scripts).
   * @param {object} conv
   */
  async function saveConversationDirect(conv) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get("bridge_conversations", (result) => {
        const existing = result.bridge_conversations || [];
        const idx = existing.findIndex((c) => c.id === conv.id);
        if (idx !== -1) {
          existing[idx] = conv;
        } else {
          existing.unshift(conv);
        }
        chrome.storage.local.set({ bridge_conversations: existing }, () => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve();
        });
      });
    });
  }

  // ─── Expose capture function to be called from popup via chrome.tabs.sendMessage ─

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "CAPTURE_CONVERSATION") {
      (async () => {
        try {
          const messages = extractMessages();

          if (messages.length === 0) {
            sendResponse({
              ok: false,
              error: "No conversation found on this page."
            });
            return;
          }

          const title = generateTitle(messages);
          const id = crypto.randomUUID();

          const conv = {
            id,
            title,
            platform: CURRENT_PLATFORM,
            messages,
            compressed: null,
            tasks: null,
            capturedAt: Date.now(),
            messageCount: messages.length
          };

          await saveConversationDirect(conv);
          showToast("Captured by XBridge ✓");

          sendResponse({ ok: true, conv });
        } catch (err) {
          console.error("[XBridge] Capture error:", err);
          showToast(err.message || "Capture failed.", "error");
          sendResponse({ ok: false, error: err.message });
        }
      })();

      return true; // Keep channel open for async response
    }

    if (message.type === "PING") {
      sendResponse({ ok: true, platform: CURRENT_PLATFORM });
      return false;
    }
  });

  console.log(`[XBridge] Capture script loaded on ${CURRENT_PLATFORM}`);
})();
