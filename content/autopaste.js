/**
 * autopaste.js — Content script that auto-pastes Bridge context into AI chat inputs.
 * Runs on all 4 supported AI platforms on page load.
 *
 * NOTE: Content scripts cannot use ES module imports. All storage access is direct.
 */

(function () {
  "use strict";

  // Prevent double-injection
  if (window.__bridge_autopaste_loaded) return;
  window.__bridge_autopaste_loaded = true;

  const TIMEOUT_MS = 10000; // 10s max wait for textarea

  // ─── Platform-specific textarea selectors ────────────────────────────────

  const TEXTAREA_SELECTORS = [
    // ChatGPT
    "#prompt-textarea",
    "textarea[data-id='root']",
    // Claude
    '[contenteditable="true"][class*="ProseMirror"]',
    'div[contenteditable="true"]',
    // Gemini
    "rich-textarea .ql-editor",
    ".ql-editor[contenteditable='true']",
    // Perplexity
    "textarea[placeholder]",
    // Generic fallback
    "textarea",
    '[contenteditable="true"]'
  ];

  /**
   * Try to find the active chat input element.
   * @returns {Element|null}
   */
  function findChatInput() {
    for (const selector of TEXTAREA_SELECTORS) {
      const el = document.querySelector(selector);
      if (el && isVisible(el)) return el;
    }
    return null;
  }

  /**
   * Check if an element is visible.
   * @param {Element} el
   * @returns {boolean}
   */
  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      getComputedStyle(el).display !== "none" &&
      getComputedStyle(el).visibility !== "hidden"
    );
  }

  /**
   * Set value on a textarea or contenteditable element and dispatch events
   * so React/Vue/web-component state management picks up the change.
   * @param {Element} el
   * @param {string} text
   */
  function setInputValue(el, text) {
    el.focus();

    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      // Standard textarea approach
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(el, text);
      } else {
        el.value = text;
      }
    } else if (el.isContentEditable) {
      // contenteditable (Claude, Gemini rich editor)
      el.textContent = text;
      // Place cursor at end
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    // Fire events so the platform's JS framework registers the value
    ["input", "change", "keyup"].forEach((eventType) => {
      el.dispatchEvent(new Event(eventType, { bubbles: true }));
    });
    // Also fire a React-style synthetic input event
    el.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        inputType: "insertText",
        data: text
      })
    );
  }

  /**
   * Show a toast notification on the page.
   * @param {string} message
   * @param {string} type
   * @param {string|null} fallbackText - If provided, add a copy button
   */
  function showToast(message, type = "info", fallbackText = null) {
    const existing = document.getElementById("bridge-autopaste-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "bridge-autopaste-toast";

    const colors = {
      success: "#1D9E75",
      error: "#ef4444",
      info: "#534AB7"
    };

    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483647;
      padding: 14px 18px;
      border-radius: 12px;
      background: ${colors[type] || colors.info};
      color: white;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      max-width: 360px;
      line-height: 1.5;
    `;

    let inner = `<div style="margin-bottom:${fallbackText ? "10px" : "0"}">${message}</div>`;

    if (fallbackText) {
      inner += `
        <button id="bridge-copy-btn" style="
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.4);
          color: white;
          padding: 6px 14px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          width: 100%;
          text-align: center;
        ">📋 Copy context to clipboard</button>
      `;
    }

    inner += `
      <div id="bridge-close-btn" style="
        position: absolute;
        top: 8px; right: 12px;
        cursor: pointer;
        font-size: 16px;
        opacity: 0.7;
      ">×</div>
    `;

    toast.innerHTML = inner;
    toast.style.position = "fixed"; // Ensure positioning
    document.body.appendChild(toast);

    // Close button
    document.getElementById("bridge-close-btn")?.addEventListener("click", () => {
      toast.remove();
    });

    // Copy button (fallback when autopaste fails)
    if (fallbackText) {
      document.getElementById("bridge-copy-btn")?.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(fallbackText);
          const btn = document.getElementById("bridge-copy-btn");
          if (btn) {
            btn.textContent = "✓ Copied!";
            btn.style.background = "rgba(255,255,255,0.35)";
          }
          setTimeout(() => toast.remove(), 1500);
        } catch {
          // Clipboard API may require user gesture — inform user
          const btn = document.getElementById("bridge-copy-btn");
          if (btn) btn.textContent = "⚠ Click the page first, then try again";
        }
      });
    } else {
      // Auto-dismiss info toasts after 5s
      setTimeout(() => toast?.remove(), 5000);
    }
  }

  /**
   * Wait for a chat input to appear using MutationObserver.
   * @param {number} timeoutMs
   * @returns {Promise<Element|null>}
   */
  function waitForChatInput(timeoutMs) {
    return new Promise((resolve) => {
      // Check immediately first
      const immediate = findChatInput();
      if (immediate) {
        resolve(immediate);
        return;
      }

      let resolved = false;
      const timer = setTimeout(() => {
        observer.disconnect();
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      }, timeoutMs);

      const observer = new MutationObserver(() => {
        const el = findChatInput();
        if (el && !resolved) {
          resolved = true;
          clearTimeout(timer);
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["contenteditable", "disabled", "style"]
      });
    });
  }

  // ─── Main Auto-paste Logic ────────────────────────────────────────────────

  async function runAutoPaste() {
    // Check for pending paste in storage
    const result = await new Promise((resolve) => {
      chrome.storage.local.get("pending_paste", resolve);
    });

    const pendingText = result?.pending_paste;
    if (!pendingText) return; // Nothing to paste — exit silently

    // Clear it immediately (one-time use) to prevent re-paste on reload
    await new Promise((resolve) => {
      chrome.storage.local.remove("pending_paste", resolve);
    });

    // Wait a short moment for the page to stabilize after navigation
    await new Promise((r) => setTimeout(r, 800));

    // Wait for chat input to appear
    const inputEl = await waitForChatInput(TIMEOUT_MS);

    if (!inputEl) {
      // Timeout — show manual fallback with copy button
      showToast(
        "⚠ Bridge couldn't find the chat input automatically.<br>Use the button below to copy your context.",
        "error",
        pendingText
      );
      return;
    }

    // Paste the context
    try {
      setInputValue(inputEl, pendingText);
      showToast("Bridge context loaded. Review and send ↑", "success");
    } catch (err) {
      console.error("[Bridge] Autopaste failed:", err);
      showToast(
        "⚠ Bridge context ready — couldn't auto-paste.<br>Copy it manually:",
        "error",
        pendingText
      );
    }
  }

  // Run on page load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runAutoPaste);
  } else {
    runAutoPaste();
  }

  console.log("[Bridge] Autopaste script loaded.");
})();
