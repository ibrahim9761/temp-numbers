(() => {
  "use strict";

  const POLL_MS = 6000;

  const el = {
    linesState: document.getElementById("linesState"),
    linesList: document.getElementById("linesList"),
    refreshBtn: document.getElementById("refreshNumbers"),

    inboxEmpty: document.getElementById("inboxEmpty"),
    inboxActive: document.getElementById("inboxActive"),
    activeNumber: document.getElementById("activeNumber"),
    copyBtn: document.getElementById("copyNumber"),
    liveBadge: document.getElementById("liveBadge"),

    inboxLoading: document.getElementById("inboxLoading"),
    inboxWaiting: document.getElementById("inboxWaiting"),
    messageList: document.getElementById("messageList"),
    inboxError: document.getElementById("inboxError"),
  };

  let selectedNumber = null;
  let pollTimer = null;
  let knownMessageKeys = new Set();

  function fmtTime(t) {
    if (!t) return "";
    const d = new Date(t);
    if (isNaN(d.getTime())) return String(t);
    return d.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" });
  }

  async function loadNumbers() {
    el.linesState.hidden = false;
    el.linesList.hidden = true;
    el.refreshBtn.classList.add("spin");
    try {
      const res = await fetch("/api/numbers");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Could not load numbers");
      renderNumbers(json.numbers || []);
    } catch (err) {
      el.linesState.innerHTML = `<p style="color:var(--danger)">Couldn't load open lines.<br>${escapeHtml(err.message)}</p>`;
    } finally {
      setTimeout(() => el.refreshBtn.classList.remove("spin"), 400);
    }
  }

  function renderNumbers(numbers) {
    if (!numbers.length) {
      el.linesState.innerHTML = `<p>No open lines right now. Try refreshing in a moment.</p>`;
      el.linesState.hidden = false;
      el.linesList.hidden = true;
      return;
    }
    el.linesState.hidden = true;
    el.linesList.hidden = false;
    el.linesList.innerHTML = "";

    numbers.forEach((item) => {
      const li = document.createElement("li");
      li.className = "line-item" + (item.number === selectedNumber ? " active" : "");
      li.setAttribute("role", "button");
      li.setAttribute("tabindex", "0");
      li.innerHTML = `
        <div>
          <div class="line-number">${escapeHtml(item.number)}</div>
          <div class="line-meta">${escapeHtml(item.country || item.provider || "Open line")}</div>
        </div>
        <span class="line-select">${item.number === selectedNumber ? "Selected" : "Select →"}</span>
      `;
      const pick = () => selectNumber(item.number);
      li.addEventListener("click", pick);
      li.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); }
      });
      el.linesList.appendChild(li);
    });
  }

  function selectNumber(number) {
    selectedNumber = number;
    knownMessageKeys = new Set();

    el.inboxEmpty.hidden = true;
    el.inboxActive.hidden = false;
    el.activeNumber.textContent = number;
    el.messageList.hidden = true;
    el.messageList.innerHTML = "";
    el.inboxWaiting.hidden = true;
    el.inboxError.hidden = true;

    // reflect selection in the list without a full re-render
    document.querySelectorAll(".line-item").forEach((li) => {
      const isThis = li.querySelector(".line-number").textContent === number;
      li.classList.toggle("active", isThis);
      li.querySelector(".line-select").textContent = isThis ? "Selected" : "Select →";
    });

    document.getElementById("dashboard").scrollIntoView({ behavior: "smooth", block: "nearest" });

    stopPolling();
    checkInbox(true);
    pollTimer = setInterval(() => checkInbox(false), POLL_MS);
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    el.liveBadge.hidden = true;
  }

  async function checkInbox(isFirstLoad) {
    if (!selectedNumber) return;
    el.liveBadge.hidden = false;
    if (isFirstLoad) el.inboxLoading.hidden = false;
    el.inboxError.hidden = true;

    try {
      const res = await fetch(`/api/inbox?number=${encodeURIComponent(selectedNumber)}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Could not load inbox");

      const messages = json.messages || [];
      el.inboxLoading.hidden = true;

      if (!messages.length) {
        el.inboxWaiting.hidden = false;
        el.messageList.hidden = true;
        return;
      }

      el.inboxWaiting.hidden = true;
      el.messageList.hidden = false;
      renderMessages(messages);
    } catch (err) {
      el.inboxLoading.hidden = true;
      el.inboxError.hidden = false;
      el.inboxError.textContent = err.message;
    }
  }

  function renderMessages(messages) {
    // newest-looking first if we can infer order; otherwise keep as returned, reversed
    const ordered = [...messages].reverse();
    el.messageList.innerHTML = "";
    ordered.forEach((m) => {
      const key = `${m.from}|${m.text}|${m.time}`;
      const li = document.createElement("li");
      li.className = "message-item";
      if (!knownMessageKeys.has(key)) knownMessageKeys.add(key);
      li.innerHTML = `
        <div class="message-from">${escapeHtml(m.from || "Unknown sender")}</div>
        <div class="message-text">${escapeHtml(m.text || "")}</div>
        ${m.time ? `<div class="message-time">${escapeHtml(fmtTime(m.time))}</div>` : ""}
      `;
      el.messageList.appendChild(li);
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  el.refreshBtn.addEventListener("click", loadNumbers);

  el.copyBtn.addEventListener("click", async () => {
    if (!selectedNumber) return;
    try {
      await navigator.clipboard.writeText(selectedNumber);
      const original = el.copyBtn.textContent;
      el.copyBtn.textContent = "Copied";
      setTimeout(() => (el.copyBtn.textContent = original), 1200);
    } catch {
      // clipboard API unavailable — fail silently, number is already visible/selectable
    }
  });

  loadNumbers();
})();
