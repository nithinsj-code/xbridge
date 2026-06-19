<div align="center">

<img src="icons/icon128.png" alt="XBridge Logo" width="80" height="80" />

# XBridge

**Continue any AI conversation anywhere — without losing context.**

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-black?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![License: MIT](https://img.shields.io/badge/License-MIT-black?style=flat-square)](LICENSE)

[⬇️ Download ZIP](../../archive/refs/heads/main.zip) &nbsp;|&nbsp;
[🐛 Report a Bug](../../issues) &nbsp;|&nbsp;
[💡 Request a Feature](../../issues)

---

![XBridge Demo Screenshot](icons/icon128.png)

</div>

---

## 🔗 What is XBridge?

**XBridge** is a Chrome extension that acts as a universal bridge between AI chatbots. Capture a conversation from one AI platform, compress it into a smart summary, and seamlessly continue it on any other platform — all with one click.

**Supported Platforms:**
| Platform | Capture | Continue |
|----------|---------|----------|
| 🟢 ChatGPT | ✅ | ✅ |
| 🟠 Claude | ✅ | ✅ |
| 🔵 Gemini | ✅ | ✅ |
| 🔷 Perplexity | ✅ | ✅ |

---

## ✨ Features

- 📸 **One-Click Capture** — Instantly save any AI conversation from ChatGPT, Claude, Gemini, or Perplexity
- 🤖 **AI Compression** — Uses Gemini API to compress long conversations into smart context summaries
- 🌉 **Cross-Platform Continuation** — Pick up any saved conversation on a different AI platform
- 🎯 **Floating Button** — An unobtrusive floating button appears on every supported AI site
- 📋 **Dashboard** — View, search, filter, and manage all your saved conversations
- 📤 **Export** — Export conversations as Markdown or plain text
- 🖤 **Monochromatic Design** — Clean black and white UI that blends with any platform

---

## ⬇️ Installation

### Option 1: Download & Install (Recommended for Most Users)

1. **Download the extension**

   👉 **[Click here to download XBridge.zip](../../archive/refs/heads/main.zip)**

2. **Unzip the file**

   Extract the downloaded `.zip` to a folder on your computer (e.g., `XBridge/`).

3. **Open Chrome Extensions page**

   Type this in your Chrome address bar and press Enter:
   ```
   chrome://extensions
   ```

4. **Enable Developer Mode**

   Toggle the **"Developer mode"** switch in the **top-right corner** of the Extensions page.

   > ⚠️ This is required to install extensions from your local machine.

5. **Load the extension**

   Click the **"Load unpacked"** button (top-left), then select the unzipped `XBridge` folder.

6. **Pin the extension** *(optional but recommended)*

   Click the 🧩 puzzle icon in Chrome's toolbar → click the 📌 pin next to **XBridge**.

---

### Option 2: Clone with Git

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Navigate into the project folder
cd YOUR_REPO_NAME
```

Then follow **Steps 3–6** from Option 1 above, selecting this cloned folder.

---

## 🔑 Setup: Get Your Gemini API Key

XBridge uses the **Google Gemini API** (free tier) to compress conversations. You need a free API key.

**Step 1:** Go to [aistudio.google.com](https://aistudio.google.com)

**Step 2:** Click **"Get API Key"** → **"Create API key"**

**Step 3:** Copy your key (starts with `AIza...`)

**Step 4:** Click the **XBridge icon** in your Chrome toolbar and paste the key when prompted → Click **"Save & Start Using XBridge"**

> 🔒 Your API key is stored **only on your device** in Chrome's local storage. It is never sent anywhere except Google's official API endpoint.

---

## 🚀 How to Use

### Capturing a Conversation

1. Open **ChatGPT, Claude, Gemini, or Perplexity** in your browser
2. Have a conversation you want to save
3. Click the **floating XBridge button** (bottom-right of the page) or the **toolbar icon**
4. Click **"📸 Capture This Conversation"**
5. XBridge saves it instantly ✅

### Continuing on Another Platform

**Method 1 — From the Floating Button:**
1. Click the floating XBridge button on any supported AI page
2. Your recent conversations appear in the panel
3. Click **"Continue →"** next to any conversation
4. XBridge pastes the context directly into the chat input

**Method 2 — From the Popup:**
1. Click the XBridge icon in the Chrome toolbar
2. Select a saved conversation
3. Click **"Compress & Summarize"** to create an AI summary (optional)
4. Choose which platform to open (Claude, ChatGPT, Gemini, Perplexity)
5. The context is automatically pasted and ready

### Using the Dashboard

Click **"📋 Open Dashboard"** from the popup or floating panel to:
- View all saved conversations in a table
- Search by keyword
- Filter by platform
- Export as JSON, Markdown, or plain text
- Delete conversations

---

## 📁 Project Structure

```
XBridge/
├── manifest.json              # Extension configuration (Manifest V3)
├── icons/
│   ├── icon16.png             # Extension icon (16×16)
│   ├── icon48.png             # Extension icon (48×48)
│   └── icon128.png            # Extension icon (128×128)
├── background/
│   └── service-worker.js      # Background script — message routing, tab management
├── content/
│   ├── capture.js             # Extracts conversations from AI platforms
│   ├── autopaste.js           # Pastes context into chat inputs
│   ├── bridge-ui.js           # Injects floating button into AI pages
│   └── bridge-ui.css          # Styles for the floating button & panel
├── popup/
│   ├── popup.html             # Extension popup UI
│   ├── popup.css              # Popup styles
│   └── popup.js               # Popup logic
└── pages/
    ├── dashboard.html         # Full conversation dashboard
    ├── dashboard.js           # Dashboard logic
    ├── viewer.html            # Single conversation viewer
    └── viewer.js              # Viewer logic
```

---

## 🛠️ Permissions Explained

| Permission | Why It's Needed |
|------------|----------------|
| `storage` | Save your conversations and API key locally |
| `activeTab` | Read the current AI chat page to capture conversations |
| `tabs` | Open new tabs on target AI platforms |
| `scripting` | Inject the context-paste script into AI pages |
| `notifications` | Show capture success notifications |

---

## 🤝 Contributing

Contributions are welcome! Feel free to:

1. Fork this repository
2. Create a branch: `git checkout -b feature/my-feature`
3. Commit: `git commit -m "Add my feature"`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

---

## ⚠️ Troubleshooting

**The floating button doesn't appear?**
- Make sure the extension is enabled on `chrome://extensions`
- Refresh the AI page after installing/updating

**"No conversation found" error?**
- Scroll through the full conversation first so all messages are loaded in the DOM
- Try clicking Capture again

**Compression fails?**
- Double-check your Gemini API key in Settings (⚙ in the popup)
- Make sure the key starts with `AIza` and has no extra spaces

**Errors in `chrome://extensions`?**
- Click "Clear all" on the error badge
- Click the reload (↻) icon on XBridge
- Refresh your AI tab

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Made with ☕ and 🖤

**[⬆ Back to Top](#-xbridge)**

</div>
