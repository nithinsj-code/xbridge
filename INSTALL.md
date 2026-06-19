# 🌉 BRIDGE — Installation Guide

> **Continue any AI conversation anywhere, without losing context.**

---

## Prerequisites

- Google Chrome (or any Chromium browser: Edge, Brave, Arc)
- A free Gemini API key from [aistudio.google.com](https://aistudio.google.com/apikey)

---

## Step 1 — Get a Free Gemini API Key

Bridge uses Google's Gemini 1.5 Flash model to compress conversations and extract tasks. The free tier is generous enough for daily use.

1. Go to **[aistudio.google.com/apikey](https://aistudio.google.com/apikey)**
2. Sign in with your Google account
3. Click **"Create API key"**
4. Copy the key — it starts with `AIza...`

> **Your key is stored only on your device** (`chrome.storage.local`). It is never sent anywhere except directly to Google's Generative Language API.

---

## Step 2 — Load the Extension in Chrome

1. Open Chrome and navigate to: **`chrome://extensions`**
2. Toggle **"Developer mode"** ON (top-right corner)
3. Click **"Load unpacked"**
4. Select the **`bridge/`** folder (the one containing `manifest.json`)
5. The Bridge extension icon (🌉) will appear in your toolbar

> **Tip:** Pin the extension by clicking the puzzle piece icon in Chrome's toolbar and clicking the pin next to Bridge.

---

## Step 3 — Enter Your API Key

1. Click the Bridge icon in your toolbar
2. The **onboarding screen** will appear
3. Paste your Gemini API key into the input field
4. Click **"Save & Start Using Bridge"**
5. Bridge will verify the key with a test call — you'll see a green ✓ on success

---

## How to Use Bridge

### 📸 Capture a Conversation

1. Navigate to **ChatGPT**, **Claude**, **Gemini**, or **Perplexity**
2. Have a conversation you want to save
3. Click the Bridge icon → click **"Capture This Conversation"**
4. A green toast "Captured by Bridge ✓" will appear on the page

### ✨ Compress & Summarize

After capturing, click **"Compress & Summarize"** to:
- Generate a structured summary (goals, tech stack, decisions, pending tasks)
- See estimated token savings (e.g., "Saved ~3,200 tokens — 78% reduction")

### ✅ Extract Tasks

Click **"Extract Tasks"** to get an AI-generated task list:
- ✅ Completed tasks (strikethrough)
- ◻ Pending tasks (interactive checkboxes — state is saved)
- → Next steps (highlighted in blue)

### 🚀 Continue In Another LLM

After capturing (and optionally compressing), click any of the **"Continue In"** buttons:
- **Continue in Claude** → opens claude.ai/new
- **Continue in Gemini** → opens gemini.google.com
- **Continue in ChatGPT** → opens chatgpt.com
- **Continue in Perplexity** → opens perplexity.ai

Bridge automatically pastes your compressed context into the new chat's input box. Just review it and hit Send!

### 📋 Dashboard

Click **"Open Dashboard →"** at the bottom of the popup to see all your saved conversations. Features:
- Search by title
- Filter by platform
- Sort by date or message count
- Export all as JSON backup
- Delete individual or all conversations

### 📄 Export Conversations

From either the popup (State C) or the Viewer page:
- **Markdown (.md)** — formatted with headers, code blocks
- **Plain Text (.txt)** — clean, readable
- **PDF** — uses browser's built-in print dialog (File → Save as PDF)

---

## Supported Platforms

| Platform | URL | Capture | Auto-Paste |
|----------|-----|---------|------------|
| ChatGPT | chatgpt.com | ✅ | ✅ |
| Claude | claude.ai | ✅ | ✅ |
| Gemini | gemini.google.com | ✅ | ✅ |
| Perplexity | perplexity.ai | ✅ | ✅ |

---

## Project Structure

```
bridge/
├── manifest.json              ← MV3 manifest
├── background/
│   └── service-worker.js      ← Tab/notification handler
├── content/
│   ├── capture.js             ← Conversation extractor (injected into AI pages)
│   └── autopaste.js           ← Auto-inserts context on target pages
├── popup/
│   ├── popup.html             ← Extension popup UI
│   ├── popup.js               ← Popup logic (all 4 states)
│   └── popup.css              ← Styles + dark mode
├── pages/
│   ├── dashboard.html         ← All conversations list
│   └── viewer.html            ← Single conversation viewer + export
├── lib/
│   ├── gemini.js              ← Gemini API wrapper
│   ├── compressor.js          ← Context compression + context builder
│   ├── extractor.js           ← Task extraction
│   └── storage.js             ← chrome.storage.local helpers
├── icons/
│   └── icon128.png
└── INSTALL.md                 ← This file
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "No conversation found on this page" | Scroll through the conversation first so messages are rendered in the DOM, then capture |
| "Could not reach the page. Refresh and try again." | Refresh the AI platform tab, then click Capture again |
| Auto-paste didn't work | The fallback **"Copy context to clipboard"** button appears — click it, then manually paste into the chat |
| API key validation fails | Make sure you copied the full key (starts with `AIza`). Check [aistudio.google.com](https://aistudio.google.com/apikey) for quota |
| "Free tier limit reached" | Wait ~1 minute. Gemini free tier has per-minute limits |
| Extension doesn't appear after loading | Make sure you selected the folder containing `manifest.json`, not a parent folder |

---

## Privacy & Security

- ✅ **No backend server** — all logic runs inside the extension
- ✅ **No OAuth** — no Google account login required
- ✅ **Local storage only** — conversations stored in `chrome.storage.local` on your device
- ✅ **API key never leaves your device** — used only in direct calls to `generativelanguage.googleapis.com`
- ✅ **No analytics or tracking** of any kind

---

## Updating the Extension

Since Bridge is loaded unpacked, updates require:
1. Replace the extension files with the new version
2. Go to `chrome://extensions`
3. Click the **reload icon** (↻) on the Bridge card

---

## License

MIT — free to use, modify, and distribute.

---

*Made with 💜 — Bridge v1.0.0*
