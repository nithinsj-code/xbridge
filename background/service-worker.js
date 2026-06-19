/**
 * service-worker.js — Bridge MV3 background service worker.
 * Handles tab events and message routing between popup/content scripts.
 */

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "OPEN_TAB") {
    // Open a new tab and respond with the tab id
    chrome.tabs.create({ url: message.url }, (tab) => {
      sendResponse({ tabId: tab.id });
    });
    return true; // Keep channel open for async response
  }

  if (message.type === "GET_CURRENT_TAB_URL") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ url: tabs[0]?.url || "" });
    });
    return true;
  }

  if (message.type === "CAPTURE_CONVERSATION_SELF" && sender.tab) {
    // Forward from bridge-ui.js to capture.js in the same tab
    chrome.tabs.sendMessage(sender.tab.id, { type: "CAPTURE_CONVERSATION" }, (response) => {
      sendResponse(response);
    });
    return true; // Keep channel open
  }

  if (message.type === "SHOW_NOTIFICATION") {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "../icons/icon128.png",
      title: message.title || "Bridge",
      message: message.message || ""
    });
    sendResponse({ ok: true });
    return false;
  }
});

// On install: set default settings
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("[Bridge] Extension installed. Welcome!");
    // No special setup needed — user will enter API key on first popup open
  }
});
