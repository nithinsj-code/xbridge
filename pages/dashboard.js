
  import { getConversations, deleteConversation, exportAllData } from "../lib/storage.js";

  let allConvs = [];
  let pendingDeleteId = null;
  let pendingDeleteAll = false;

  const list = document.getElementById("conversations-list");
  const searchInput = document.getElementById("search-input");
  const platformFilter = document.getElementById("platform-filter");
  const sortSelect = document.getElementById("sort-select");
  const statTotal = document.getElementById("stat-total");
  const statCompressed = document.getElementById("stat-compressed");
  const statMessages = document.getElementById("stat-messages");
  const confirmModal = document.getElementById("confirm-modal");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");
  const modalCancel = document.getElementById("modal-cancel");
  const modalConfirm = document.getElementById("modal-confirm");

  // ─── Load & Render ─────────────────────────────────────────────────────────

  async function loadConversations() {
    allConvs = await getConversations();
    updateStats();
    renderList();
  }

  function updateStats() {
    statTotal.textContent = allConvs.length;
    statCompressed.textContent = allConvs.filter((c) => c.compressed).length;
    statMessages.textContent = allConvs.reduce((sum, c) => sum + (c.messageCount || 0), 0);
  }

  function filterAndSort() {
    const query = searchInput.value.toLowerCase().trim();
    const platform = platformFilter.value;
    const sort = sortSelect.value;

    let filtered = allConvs.filter((c) => {
      const matchTitle = !query || c.title?.toLowerCase().includes(query);
      const matchPlatform = !platform || c.platform === platform;
      return matchTitle && matchPlatform;
    });

    filtered.sort((a, b) => {
      if (sort === "newest") return (b.capturedAt || 0) - (a.capturedAt || 0);
      if (sort === "oldest") return (a.capturedAt || 0) - (b.capturedAt || 0);
      if (sort === "messages") return (b.messageCount || 0) - (a.messageCount || 0);
      return 0;
    });

    return filtered;
  }

  function renderList() {
    const convs = filterAndSort();

    if (convs.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${allConvs.length === 0 ? "💬" : "🔍"}</div>
          <div class="empty-title">${allConvs.length === 0 ? "No conversations yet" : "No results found"}</div>
          <div class="empty-sub">${
            allConvs.length === 0
              ? "Open ChatGPT, Claude, Gemini, or Perplexity and click the Bridge icon to capture a conversation."
              : "Try adjusting your search or filter."
          }</div>
        </div>`;
      return;
    }

    list.innerHTML = convs.map((c) => {
      const platformClass = (c.platform || "unknown").toLowerCase();
      const dateStr = formatDate(c.capturedAt);
      const hasCompressed = c.compressed ? "✨ " : "";

      return `
        <div class="conv-row" data-id="${c.id}">
          <div>
            <div class="conv-row-title">${hasCompressed}${escHtml(c.title)}</div>
            <div class="conv-row-sub">${c.compressed?.project_title ? escHtml(c.compressed.project_title) : ""}</div>
          </div>
          <div>
            <span class="platform-badge ${platformClass}">${escHtml(c.platform || "Unknown")}</span>
          </div>
          <div class="conv-row-date">${dateStr}</div>
          <div class="conv-row-msgs">${c.messageCount || 0}</div>
          <div class="conv-row-actions">
            <button class="action-icon-btn view-btn" data-id="${c.id}" title="View conversation">👁</button>
            <button class="action-icon-btn delete action-delete-btn" data-id="${c.id}" title="Delete">🗑</button>
          </div>
        </div>`;
    }).join("");

    // Click row → open viewer
    list.querySelectorAll(".conv-row").forEach((row) => {
      row.addEventListener("click", (e) => {
        if (e.target.closest(".action-icon-btn")) return;
        openViewer(row.dataset.id);
      });
    });

    list.querySelectorAll(".view-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openViewer(btn.dataset.id);
      });
    });

    list.querySelectorAll(".action-delete-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const conv = allConvs.find((c) => c.id === btn.dataset.id);
        confirmDelete(btn.dataset.id, conv?.title || "this conversation");
      });
    });
  }

  function openViewer(id) {
    const url = chrome.runtime.getURL(`pages/viewer.html?id=${id}`);
    window.location.href = url;
  }

  // ─── Deletion ───────────────────────────────────────────────────────────────

  function confirmDelete(id, name) {
    pendingDeleteId = id;
    pendingDeleteAll = false;
    modalTitle.textContent = "Delete Conversation?";
    modalBody.textContent = `"${name}" will be permanently deleted.`;
    modalConfirm.textContent = "Delete";
    confirmModal.classList.remove("hidden");
  }

  function confirmDeleteAll() {
    pendingDeleteId = null;
    pendingDeleteAll = true;
    modalTitle.textContent = "Clear All Conversations?";
    modalBody.textContent = "All your saved conversations will be permanently deleted. This cannot be undone.";
    modalConfirm.textContent = "Clear All";
    confirmModal.classList.remove("hidden");
  }

  modalCancel.addEventListener("click", () => {
    confirmModal.classList.add("hidden");
    pendingDeleteId = null;
    pendingDeleteAll = false;
  });

  modalConfirm.addEventListener("click", async () => {
    confirmModal.classList.add("hidden");
    if (pendingDeleteAll) {
      await chrome.storage.local.remove("bridge_conversations");
      showToast("All conversations cleared.", "info");
    } else if (pendingDeleteId) {
      await deleteConversation(pendingDeleteId);
      showToast("Conversation deleted.", "success");
    }
    await loadConversations();
  });

  document.getElementById("delete-all-btn").addEventListener("click", confirmDeleteAll);

  // ─── Export All ─────────────────────────────────────────────────────────────

  document.getElementById("export-json-btn").addEventListener("click", async () => {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bridge-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Backup exported ✓", "success");
  });

  // ─── Filters ────────────────────────────────────────────────────────────────

  searchInput.addEventListener("input", renderList);
  platformFilter.addEventListener("change", renderList);
  sortSelect.addEventListener("change", renderList);

  // ─── Utilities ──────────────────────────────────────────────────────────────

  function formatDate(ts) {
    if (!ts) return "—";
    return new Date(ts).toLocaleString(undefined, {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  }

  function escHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  let toastTimer = null;
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

  // ─── Init ────────────────────────────────────────────────────────────────────
  await loadConversations();

