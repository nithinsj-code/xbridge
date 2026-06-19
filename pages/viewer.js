
  import { getConversationById } from "../lib/storage.js";

  const container = document.getElementById("main-container");
  const headerTitle = document.getElementById("header-title");
  const exportToggle = document.getElementById("export-toggle");
  const exportMenuEl = document.getElementById("export-menu");

  // ─── Load Conversation ──────────────────────────────────────────────────────

  const params = new URLSearchParams(window.location.search);
  const convId = params.get("id");
  const shouldPrint = params.get("print") === "1";

  if (!convId) {
    container.innerHTML = `<div class="error-block">⚠ No conversation ID specified.</div>`;
  } else {
    const conv = await getConversationById(convId);
    if (!conv) {
      container.innerHTML = `<div class="error-block">⚠ Conversation not found. It may have been deleted.</div>`;
    } else {
      renderConversation(conv);
      if (shouldPrint) {
        setTimeout(() => window.print(), 800);
      }
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  function renderConversation(conv) {
    headerTitle.textContent = conv.title;
    document.title = `Bridge — ${conv.title}`;

    const platformClass = (conv.platform || "unknown").toLowerCase();
    const dateStr = new Date(conv.capturedAt).toLocaleString(undefined, {
      month: "long", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });

    let summaryHTML = "";
    if (conv.compressed) {
      const c = conv.compressed;
      const goals = (c.goals || []).map((g) => `<li>${escHtml(g)}</li>`).join("");
      const pending = (c.pending_tasks || []).map((t) => `<li>${escHtml(t)}</li>`).join("");
      const completed = (c.completed_tasks || []).map((t) => `<li>${escHtml(t)}</li>`).join("");
      const tech = (c.tech_stack || []).map((t) => `<span class="tag">${escHtml(t)}</span>`).join("");

      summaryHTML = `
        <div class="summary-block">
          <h3>✨ AI Summary</h3>
          <div class="summary-text">${escHtml(c.summary || "")}</div>
          <div class="summary-meta-grid">
            ${goals ? `
              <div class="summary-meta-item">
                <h4>Goals</h4>
                <ul class="task-list-inline">${goals}</ul>
              </div>` : ""}
            ${tech ? `
              <div class="summary-meta-item">
                <h4>Tech Stack</h4>
                <div class="tag-list">${tech}</div>
              </div>` : ""}
            ${completed ? `
              <div class="summary-meta-item">
                <h4>✅ Completed</h4>
                <ul class="task-list-inline">${completed}</ul>
              </div>` : ""}
            ${pending ? `
              <div class="summary-meta-item">
                <h4>◻ Pending</h4>
                <ul class="task-list-inline">${pending}</ul>
              </div>` : ""}
          </div>
        </div>`;
    }

    const messagesHTML = (conv.messages || []).map((msg) => {
      const isUser = msg.role === "user";
      const avatar = isUser ? "👤" : "🤖";
      const label = isUser ? "You" : (conv.platform || "Assistant");
      const ts = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

      // Format content: detect code blocks and render them
      const formattedContent = formatMessageContent(msg.content || "");

      return `
        <div class="message-bubble ${isUser ? "user" : "assistant"}">
          <div class="bubble-avatar ${isUser ? "user" : "assistant"}">${avatar}</div>
          <div class="bubble-body">
            <div class="bubble-label">${escHtml(label)}</div>
            <div class="bubble-content">${formattedContent}</div>
            ${ts ? `<div class="bubble-timestamp">${ts}</div>` : ""}
          </div>
        </div>`;
    }).join("");

    container.innerHTML = `
      <div class="conv-info-card">
        <div class="conv-info-main">
          <div class="conv-info-title">${escHtml(conv.title)}</div>
          <div class="conv-info-meta">
            <span class="platform-badge ${platformClass}">${escHtml(conv.platform || "Unknown")}</span>
            <span class="meta-chip">📅 ${dateStr}</span>
            <span class="meta-chip">💬 ${conv.messageCount || conv.messages?.length || 0} messages</span>
            ${conv.compressed ? '<span class="meta-chip">✨ Compressed</span>' : ""}
          </div>
        </div>
      </div>

      ${summaryHTML}

      <div class="messages-header">
        Conversation
        <span class="msg-count-badge">${conv.messages?.length || 0} messages</span>
      </div>
      <div class="messages-list">
        ${messagesHTML || '<div style="text-align:center;color:var(--text-muted);padding:20px">No messages found.</div>'}
      </div>
    `;
  }

  /**
   * Format message content: detect triple-backtick code blocks and render them styled.
   */
  function formatMessageContent(text) {
    // Escape HTML first
    const escaped = escHtml(text);

    // Replace code blocks: ```lang\n...\n```
    return escaped.replace(
      /```(\w*)\n?([\s\S]*?)```/g,
      (_, lang, code) => `<pre style="
        background: #1e1b2e;
        color: #a8f0c6;
        border-radius: 8px;
        padding: 14px;
        overflow-x: auto;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        line-height: 1.6;
        margin: 8px 0;
        border: 1px solid rgba(168,240,198,0.1);
      "><code>${lang ? `<span style="color:#9d8fe0;font-size:10px;display:block;margin-bottom:6px">${lang}</span>` : ""}${code}</code></pre>`
    );
  }

  // ─── Export ─────────────────────────────────────────────────────────────────

  let exportOpen = false;

  exportToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    exportOpen = !exportOpen;
    exportMenuEl.classList.toggle("hidden", !exportOpen);
  });

  document.addEventListener("click", () => {
    exportOpen = false;
    exportMenuEl.classList.add("hidden");
  });

  document.getElementById("export-pdf").addEventListener("click", () => {
    exportMenuEl.classList.add("hidden");
    window.print();
  });

  document.getElementById("export-md").addEventListener("click", async () => {
    exportMenuEl.classList.add("hidden");
    const conv = await getConversationById(convId);
    if (!conv) return;
    const content = buildMarkdown(conv);
    download(`bridge-${slugify(conv.title)}.md`, content, "text/markdown");
    showToast("Exported as Markdown ✓", "success");
  });

  document.getElementById("export-txt").addEventListener("click", async () => {
    exportMenuEl.classList.add("hidden");
    const conv = await getConversationById(convId);
    if (!conv) return;
    const content = buildPlainText(conv);
    download(`bridge-${slugify(conv.title)}.txt`, content, "text/plain");
    showToast("Exported as Plain Text ✓", "success");
  });

  function buildMarkdown(conv) {
    let out = `# ${conv.title}\n\n`;
    out += `**Platform:** ${conv.platform}  \n`;
    out += `**Captured:** ${new Date(conv.capturedAt).toLocaleString()}  \n`;
    out += `**Messages:** ${conv.messages?.length || 0}\n\n`;

    if (conv.compressed) {
      const c = conv.compressed;
      out += `## Summary\n\n${c.summary}\n\n`;
      if (c.goals?.length) out += `## Goals\n${c.goals.map((g) => `- ${g}`).join("\n")}\n\n`;
      if (c.tech_stack?.length) out += `## Tech Stack\n${c.tech_stack.join(", ")}\n\n`;
      if (c.completed_tasks?.length) out += `## Completed\n${c.completed_tasks.map((t) => `- [x] ${t}`).join("\n")}\n\n`;
      if (c.pending_tasks?.length) out += `## Pending\n${c.pending_tasks.map((t) => `- [ ] ${t}`).join("\n")}\n\n`;
    }

    out += `---\n\n## Conversation\n\n`;
    (conv.messages || []).forEach((m) => {
      const heading = m.role === "user" ? "### 👤 User" : `### 🤖 ${conv.platform || "Assistant"}`;
      out += `${heading}\n\n${m.content}\n\n`;
    });
    return out;
  }

  function buildPlainText(conv) {
    let out = `${conv.title}\n${"=".repeat(Math.min(conv.title.length, 60))}\n\n`;
    out += `Platform: ${conv.platform}\n`;
    out += `Captured: ${new Date(conv.capturedAt).toLocaleString()}\n\n`;
    (conv.messages || []).forEach((m) => {
      const label = m.role === "user" ? "USER:" : "ASSISTANT:";
      out += `${label}\n${m.content}\n\n${"─".repeat(50)}\n\n`;
    });
    return out;
  }

  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Utilities ───────────────────────────────────────────────────────────────

  function escHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function slugify(str) {
    return String(str).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  }

  let toastTimer;
  function showToast(msg, type = "info") {
    const toast = document.getElementById("toast");
    toast.textContent = msg;
    toast.className = `show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.className = type;
      setTimeout(() => { toast.className = ""; }, 300);
    }, 2800);
  }

