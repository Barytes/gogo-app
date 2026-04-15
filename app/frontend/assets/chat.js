const messagesEl = document.querySelector("#messages");
const formEl = document.querySelector("#chat-form");
const inputEl = document.querySelector("#chat-input");
const submitButtonEl = formEl?.querySelector("button[type='submit']");
const submitIconEl = submitButtonEl?.querySelector(".chat-submit-icon");
const uploadButtonEl = document.querySelector("#chat-upload-button");
const uploadInputEl = document.querySelector("#chat-upload-input");
const modelButtonEl = document.querySelector("#chat-model-button");
const modelMenuEl = document.querySelector("#chat-model-menu");
const thinkingButtonEl = document.querySelector("#chat-thinking-button");
const thinkingMenuEl = document.querySelector("#chat-thinking-menu");
const settingsHintEl = document.querySelector("#chat-settings-hint");
const sessionListEl = document.querySelector("#session-list");
const sessionListEmptyEl = document.querySelector("#session-list-empty");
const newSessionButtonEl = document.querySelector("#new-session-button");
const toggleSessionSidebarButtonEl = document.querySelector("#toggle-session-sidebar");
const toggleSessionSidebarMainButtonEl = document.querySelector("#toggle-session-sidebar-main");
const CHAT_UI_VERSION = "2026-04-15.2";
const SESSION_SIDEBAR_STORAGE_KEY = "gogo:session-sidebar-collapsed";
const DRAFT_VIEW_KEY = "__draft__";
const AUTO_SCROLL_BOTTOM_THRESHOLD_PX = 96;
const BARE_WIKI_PATH_PATTERN =
  /(^|[\s(>（【「『"'“”‘’,，。；：;:、])(wiki\/.+?\.md)(?=$|[\s)<\]】」』"'“”‘’,，。；：;:、!?！？])/g;

console.log("Chat elements:", {
  version: CHAT_UI_VERSION,
  messagesEl: !!messagesEl,
  formEl: !!formEl,
  inputEl: !!inputEl,
  sessionListEl: !!sessionListEl,
  sessionListEmptyEl: !!sessionListEmptyEl,
  newSessionButtonEl: !!newSessionButtonEl,
  toggleSessionSidebarButtonEl: !!toggleSessionSidebarButtonEl,
  toggleSessionSidebarMainButtonEl: !!toggleSessionSidebarMainButtonEl,
});

let currentSessionId = null;
let sessions = [];
let openSessionMenuId = null;
const draftHistory = [];
const sessionHistories = new Map(); // 每个 session 的聊天记录缓存
const sessionViewNodes = new Map(); // 每个 session 的已渲染消息节点缓存（含思考过程）
let history = draftHistory; // 当前会话的历史（始终指向当前 session 的数组引用）
let currentStreamingMessage = null; // 跟踪正在流式接收的 AI 消息
let currentStreamingSessionId = null; // 当前流式消息所属的 session
const pendingSessionIds = new Set(); // 记录仍在等待回复的 session
const abortingSessionIds = new Set(); // 记录正在发送终止请求的 session
const hydratedSessionIds = new Set(); // 已从后端事件存储回放过的 session
const LAST_ACTIVE_SESSION_KEY = "gogo:last-active-session-id";
const THINKING_LEVEL_LABELS = {
  off: "思考关闭",
  minimal: "最少思考",
  low: "低思考",
  medium: "中等思考",
  high: "高思考",
  xhigh: "超高思考",
};
let shouldAutoScrollMessages = true;
let syncingProgrammaticMessageScroll = false;
let availableModels = [];
let availableThinkingLevels = ["off", "minimal", "low", "medium", "high", "xhigh"];
let draftChatSettings = {
  model_provider: "",
  model_id: "",
  model_label: "默认模型",
  thinking_level: "medium",
};
let openChatControlMenu = null;
let settingsHintTimer = null;
let isUploadingInboxFile = false;

function applySessionSidebarState(collapsed) {
  document.body.classList.toggle("session-sidebar-collapsed", Boolean(collapsed));
  toggleSessionSidebarButtonEl?.setAttribute("aria-expanded", String(!collapsed));
  toggleSessionSidebarMainButtonEl?.setAttribute("aria-expanded", String(!collapsed));
}

function loadSessionSidebarState() {
  try {
    return window.localStorage.getItem(SESSION_SIDEBAR_STORAGE_KEY) === "1";
  } catch (_error) {
    return false;
  }
}

function saveSessionSidebarState(collapsed) {
  try {
    if (collapsed) {
      window.localStorage.setItem(SESSION_SIDEBAR_STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(SESSION_SIDEBAR_STORAGE_KEY);
    }
  } catch (_error) {
    // ignore localStorage failures
  }
}

function createRequestId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeModelRecord(model) {
  if (!model || typeof model !== "object") {
    return null;
  }
  const provider = String(model.provider || "").trim();
  const modelId = String(model.id || model.modelId || "").trim();
  const name = String(model.name || "").trim();
  if (!provider || !modelId) {
    return null;
  }
  return {
    provider,
    model_id: modelId,
    label: provider && (name || modelId) ? `${provider}/${name || modelId}` : (name || modelId),
    raw: model,
  };
}

function sessionRecord(sessionId) {
  return sessions.find((item) => item.session_id === sessionId) || null;
}

function currentChatSettings() {
  if (!currentSessionId) {
    return draftChatSettings;
  }
  const session = sessionRecord(currentSessionId);
  return {
    model_provider: String(session?.model_provider || "").trim(),
    model_id: String(session?.model_id || "").trim(),
    model_label: String(session?.model_label || "").trim() || "默认模型",
    thinking_level: String(session?.thinking_level || draftChatSettings.thinking_level || "medium").trim().toLowerCase(),
  };
}

function currentModelButtonText() {
  const settings = currentChatSettings();
  return settings.model_label || "默认模型";
}

function currentThinkingButtonText() {
  const settings = currentChatSettings();
  return THINKING_LEVEL_LABELS[settings.thinking_level] || settings.thinking_level || "思考水平";
}

function currentModelRecord() {
  const settings = currentChatSettings();
  return (
    availableModels.find(
      (item) => item.provider === settings.model_provider && item.model_id === settings.model_id
    ) || null
  );
}

function supportedThinkingLevelsForModel(model) {
  if (!model?.raw || typeof model.raw !== "object") {
    return new Set(availableThinkingLevels);
  }
  if (!model.raw.reasoning) {
    return new Set(["off"]);
  }

  const supported = new Set(["off", "minimal", "low", "medium", "high"]);
  const compat = model.raw.compat && typeof model.raw.compat === "object" ? model.raw.compat : {};
  const effortMap =
    compat.reasoningEffortMap && typeof compat.reasoningEffortMap === "object"
      ? compat.reasoningEffortMap
      : null;

  if (effortMap && effortMap.xhigh) {
    supported.add("xhigh");
  } else if (
    model.provider === "openai" &&
    /codex-max/i.test(model.model_id)
  ) {
    supported.add("xhigh");
  }
  return supported;
}

function isThinkingLevelSupported(level) {
  const model = currentModelRecord();
  return supportedThinkingLevelsForModel(model).has(level);
}

function showSettingsHint(message) {
  if (!settingsHintEl) {
    return;
  }
  settingsHintEl.textContent = message;
  settingsHintEl.classList.remove("hidden");
  if (settingsHintTimer) {
    window.clearTimeout(settingsHintTimer);
  }
  settingsHintTimer = window.setTimeout(() => {
    settingsHintEl.classList.add("hidden");
    settingsHintTimer = null;
  }, 3200);
}

function refreshSettingsHintState() {
  const settings = currentChatSettings();
  if (settings.thinking_level && !isThinkingLevelSupported(settings.thinking_level)) {
    showSettingsHint(`当前模型不支持“${currentThinkingButtonText()}”。`);
    return;
  }
  if (settingsHintEl) {
    settingsHintEl.classList.add("hidden");
  }
  if (settingsHintTimer) {
    window.clearTimeout(settingsHintTimer);
    settingsHintTimer = null;
  }
}

function closeChatControlMenus() {
  openChatControlMenu = null;
  modelMenuEl?.classList.add("hidden");
  thinkingMenuEl?.classList.add("hidden");
  modelButtonEl?.setAttribute("aria-expanded", "false");
  thinkingButtonEl?.setAttribute("aria-expanded", "false");
}

function renderChatControlMenus() {
  const current = currentChatSettings();

  if (modelMenuEl) {
    modelMenuEl.innerHTML = "";
    for (const model of availableModels) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "chat-control-menu-item";
      if (model.provider === current.model_provider && model.model_id === current.model_id) {
        item.classList.add("active");
      }
      item.textContent = model.label;
      item.dataset.provider = model.provider;
      item.dataset.modelId = model.model_id;
      item.addEventListener("click", async () => {
        closeChatControlMenus();
        await applyModelSelection(model);
      });
      modelMenuEl.appendChild(item);
    }
  }

  if (thinkingMenuEl) {
    thinkingMenuEl.innerHTML = "";
    for (const level of availableThinkingLevels) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "chat-control-menu-item";
      if (level === current.thinking_level) {
        item.classList.add("active");
      }
      if (!isThinkingLevelSupported(level)) {
        item.classList.add("unsupported");
      }
      item.textContent = THINKING_LEVEL_LABELS[level] || level;
      item.dataset.level = level;
      item.addEventListener("click", async () => {
        closeChatControlMenus();
        if (!isThinkingLevelSupported(level)) {
          showSettingsHint(`当前模型不支持“${THINKING_LEVEL_LABELS[level] || level}”。`);
          return;
        }
        await applyThinkingSelection(level);
      });
      thinkingMenuEl.appendChild(item);
    }
  }
}

function refreshChatControls() {
  const isPendingForCurrent = Boolean(currentSessionId && pendingSessionIds.has(currentSessionId));
  const isAbortingCurrent = Boolean(currentSessionId && abortingSessionIds.has(currentSessionId));
  const disabled = isPendingForCurrent || isAbortingCurrent;

  if (modelButtonEl) {
    modelButtonEl.textContent = currentModelButtonText();
    modelButtonEl.title = currentModelButtonText();
    modelButtonEl.setAttribute("aria-label", `当前模型：${currentModelButtonText()}`);
    modelButtonEl.disabled = disabled || availableModels.length === 0;
  }
  if (thinkingButtonEl) {
    thinkingButtonEl.textContent = currentThinkingButtonText();
    thinkingButtonEl.title = currentThinkingButtonText();
    thinkingButtonEl.setAttribute("aria-label", `当前思考水平：${currentThinkingButtonText()}`);
    thinkingButtonEl.disabled = disabled || availableThinkingLevels.length === 0;
  }
  if (uploadButtonEl) {
    uploadButtonEl.disabled = disabled || isUploadingInboxFile;
  }

  renderChatControlMenus();
  refreshSettingsHintState();
}

function toggleChatControlMenu(name) {
  const nextMenu = openChatControlMenu === name ? null : name;
  openChatControlMenu = nextMenu;
  modelMenuEl?.classList.toggle("hidden", nextMenu !== "model");
  thinkingMenuEl?.classList.toggle("hidden", nextMenu !== "thinking");
  modelButtonEl?.setAttribute("aria-expanded", String(nextMenu === "model"));
  thinkingButtonEl?.setAttribute("aria-expanded", String(nextMenu === "thinking"));
  if (nextMenu) {
    renderChatControlMenus();
  }
}

function getViewKey(sessionId) {
  return sessionId || DRAFT_VIEW_KEY;
}

function resolveWikiLinkTarget(rawHref) {
  const href = String(rawHref || "").trim();
  if (!href || href.startsWith("#")) {
    return null;
  }

  let candidate = href;
  try {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) {
      return null;
    }
    const page = url.searchParams.get("page");
    if (page) {
      return { source: "wiki", path: page };
    }
    const raw = url.searchParams.get("raw");
    if (raw) {
      return { source: "raw", path: raw };
    }
    candidate = `${url.pathname}${url.search}${url.hash}`;
  } catch (_error) {
    candidate = href;
  }

  if (/^(https?:|mailto:|tel:|data:|javascript:)/i.test(candidate)) {
    return null;
  }

  let normalized = candidate
    .replace(window.location.origin, "")
    .replace(/^\/+/, "")
    .replace(/^\.\//, "");

  while (normalized.startsWith("../")) {
    normalized = normalized.slice(3);
  }

  try {
    normalized = decodeURIComponent(normalized);
  } catch (_error) {
    // keep original text when href contains malformed escape sequences
  }

  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("?")) {
    const params = new URLSearchParams(normalized.slice(1));
    const page = params.get("page");
    if (page) {
      return { source: "wiki", path: page };
    }
    const raw = params.get("raw");
    if (raw) {
      return { source: "raw", path: raw };
    }
    return null;
  }

  if (normalized.startsWith("raw/")) {
    return { source: "raw", path: normalized.slice(4) };
  }

  if (normalized.startsWith("wiki/")) {
    return { source: "wiki", path: normalized.slice(5) };
  }

  if (
    normalized.startsWith("knowledge/") ||
    normalized.startsWith("insights/") ||
    normalized === "index.md" ||
    normalized === "README.md" ||
    normalized === "log.md"
  ) {
    return { source: "wiki", path: normalized };
  }

  if (normalized.endsWith(".md")) {
    return { source: "wiki", path: normalized };
  }

  return null;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function stashHtmlFragment(store, html) {
  const token = `%%GOGO_HTML_${store.length}%%`;
  store.push({ token, html });
  return token;
}

function restoreHtmlFragments(text, store) {
  return store.reduce((result, fragment) => result.replaceAll(fragment.token, fragment.html), text);
}

function buildInlineWikiAnchor(label, href, { codeStyle = false } = {}) {
  const safeLabel = escapeHtml(label);
  const content = codeStyle ? `<code>${safeLabel}</code>` : safeLabel;
  const className = codeStyle ? ' class="inline-wiki-path"' : "";
  return `<a${className} href="${href}" target="_blank" rel="noreferrer">${content}</a>`;
}

function renderInlineMarkdown(text) {
  const fragments = [];
  let rendered = escapeHtml(text);
  rendered = rendered.replace(
    /`([^`]+)`/g,
    (_match, code) => {
      const destination = resolveWikiLinkTarget(code);
      if (destination) {
        return stashHtmlFragment(
          fragments,
          buildInlineWikiAnchor(code, `/${destination.source}/${destination.path}`, { codeStyle: true })
        );
      }
      return stashHtmlFragment(fragments, `<code>${code}</code>`);
    }
  );
  rendered = rendered.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, label, href) => stashHtmlFragment(
      fragments,
      `<a href="${href}" target="_blank" rel="noreferrer">${label}</a>`
    )
  );
  rendered = rendered.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  rendered = rendered.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  rendered = rendered.replace(
    BARE_WIKI_PATH_PATTERN,
    (_match, prefix, wikiPath) =>
      `${prefix}${buildInlineWikiAnchor(wikiPath, `/${wikiPath}`)}`
  );
  return restoreHtmlFragments(rendered, fragments);
}

function markdownToHtml(markdown) {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let inList = false;
  let inOrderedList = false;
  let inCodeBlock = false;
  let codeBuffer = [];

  const closeLists = () => {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
    if (inOrderedList) {
      html.push("</ol>");
      inOrderedList = false;
    }
  };

  const closeCode = () => {
    if (!inCodeBlock) {
      return;
    }
    html.push(`<pre><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`);
    inCodeBlock = false;
    codeBuffer = [];
  };

  lines.forEach((line) => {
    if (line.trim().startsWith("```")) {
      closeLists();
      if (inCodeBlock) {
        closeCode();
      } else {
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      closeLists();
      html.push("");
      return;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      closeLists();
      const level = headingMatch[1].length;
      html.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
      return;
    }

    if (trimmed.startsWith("> ")) {
      closeLists();
      html.push(`<blockquote>${renderInlineMarkdown(trimmed.slice(2))}</blockquote>`);
      return;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      if (inOrderedList) {
        html.push("</ol>");
        inOrderedList = false;
      }
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${renderInlineMarkdown(trimmed.slice(2))}</li>`);
      return;
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      if (!inOrderedList) {
        html.push("<ol>");
        inOrderedList = true;
      }
      html.push(`<li>${renderInlineMarkdown(orderedMatch[1])}</li>`);
      return;
    }

    closeLists();
    html.push(`<p>${renderInlineMarkdown(trimmed)}</p>`);
  });

  closeLists();
  closeCode();
  return html.join("\n");
}

function getRememberedSessionId() {
  try {
    return window.localStorage.getItem(LAST_ACTIVE_SESSION_KEY);
  } catch (_error) {
    return null;
  }
}

function rememberSessionId(sessionId) {
  try {
    if (sessionId) {
      window.localStorage.setItem(LAST_ACTIVE_SESSION_KEY, sessionId);
    } else {
      window.localStorage.removeItem(LAST_ACTIVE_SESSION_KEY);
    }
  } catch (_error) {
    // ignore localStorage failures
  }
}

function ensureSessionHistory(sessionId) {
  if (!sessionId) {
    return draftHistory;
  }

  const existingHistory = sessionHistories.get(sessionId);
  if (existingHistory) {
    return existingHistory;
  }

  const newHistory = [];
  sessionHistories.set(sessionId, newHistory);
  return newHistory;
}

function upsertAssistantTurn(targetHistory, content) {
  const aiContent = String(content || "").trim();
  if (!aiContent) {
    return;
  }

  const lastMsg = targetHistory[targetHistory.length - 1];
  if (lastMsg && lastMsg.role === "assistant") {
    lastMsg.content = aiContent;
    return;
  }

  targetHistory.push({ role: "assistant", content: aiContent });
}

function clearMessages() {
  if (!messagesEl) {
    return;
  }
  messagesEl.innerHTML = "";
}

function storeCurrentSessionView() {
  if (!messagesEl) {
    return;
  }
  sessionViewNodes.set(getViewKey(currentSessionId), Array.from(messagesEl.childNodes));
}

function restoreSessionView(sessionId) {
  if (!messagesEl) {
    return false;
  }
  const nodes = sessionViewNodes.get(getViewKey(sessionId));
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return false;
  }
  clearMessages();
  messagesEl.append(...nodes);
  scrollMessagesToBottom(true);
  return true;
}

function renderHistory(messages) {
  if (!Array.isArray(messages) || !messages.length) {
    return;
  }
  for (const msg of messages) {
    appendMessage(msg.role, msg.content);
  }
  scrollMessagesToBottom(true);
  storeCurrentSessionView();
}

function saveCurrentHistory() {
  if (!currentSessionId) {
    history = draftHistory;
    return;
  }

  const targetHistory = ensureSessionHistory(currentSessionId);

  // 如果有正在进行的流式消息，先保存它的当前内容
  if (currentStreamingMessage && currentStreamingSessionId === currentSessionId) {
    const aiContent = currentStreamingMessage.getContent().trim();
    if (aiContent && aiContent !== "Pi 正在生成答复...") {
      upsertAssistantTurn(targetHistory, aiContent);
    }
  }

  sessionHistories.set(currentSessionId, targetHistory);
  history = targetHistory;
}

function loadSessionHistory(sessionId) {
  return ensureSessionHistory(sessionId);
}

async function hydrateSessionHistoryFromStore(sessionId) {
  if (!sessionId) {
    return ensureSessionHistory(sessionId);
  }

  const targetHistory = ensureSessionHistory(sessionId);
  if (targetHistory.length > 0 || hydratedSessionIds.has(sessionId)) {
    return targetHistory;
  }

  try {
    const safeSessionId = encodeURIComponent(sessionId);
    const response = await fetch(`/api/sessions/${safeSessionId}/history?limit=200`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    const replayed = Array.isArray(data.history) ? data.history : [];
    if (replayed.length > 0) {
      targetHistory.length = 0;
      replayed.forEach((item) => {
        if (!item || typeof item !== "object") {
          return;
        }
        const role = item.role === "assistant" ? "assistant" : "user";
        const content = String(item.content || "");
        if (!content.trim()) {
          return;
        }
        targetHistory.push({ role, content });
      });
      sessionHistories.set(sessionId, targetHistory);
    }
    hydratedSessionIds.add(sessionId);
  } catch (error) {
    console.warn("Failed to hydrate session history:", sessionId, error);
  }

  return targetHistory;
}

function isMessagesNearBottom() {
  if (!messagesEl) {
    return true;
  }
  const distanceToBottom =
    messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight;
  return distanceToBottom <= AUTO_SCROLL_BOTTOM_THRESHOLD_PX;
}

function scrollMessagesToBottom(force = false) {
  if (!messagesEl) {
    return;
  }
  if (!force && !shouldAutoScrollMessages) {
    return;
  }
  syncingProgrammaticMessageScroll = true;
  messagesEl.scrollTop = messagesEl.scrollHeight;
  shouldAutoScrollMessages = true;
  window.requestAnimationFrame(() => {
    syncingProgrammaticMessageScroll = false;
  });
}

function focusChatInput() {
  if (!inputEl) {
    return;
  }
  window.WorkbenchUI?.ensureChatVisible?.();
  inputEl.focus();
}

function injectPrompt(text, replace = false) {
  if (!inputEl || !text) {
    return;
  }

  const nextValue = replace || !inputEl.value.trim()
    ? text
    : `${inputEl.value.trim()}\n\n${text}`;
  inputEl.value = nextValue;
  focusChatInput();
}

function setChatPending(isPending) {
  void isPending;
  const isPendingForCurrent = Boolean(currentSessionId && pendingSessionIds.has(currentSessionId));
  const isAbortingCurrent = Boolean(currentSessionId && abortingSessionIds.has(currentSessionId));
  const hasDraft = Boolean(inputEl?.value.trim());

  if (submitButtonEl) {
    submitButtonEl.dataset.mode = isPendingForCurrent ? "stop" : "send";
    submitButtonEl.disabled = isPendingForCurrent ? isAbortingCurrent : !hasDraft;
    submitButtonEl.setAttribute("aria-label", isPendingForCurrent ? "终止" : "发送");
    submitButtonEl.title = isPendingForCurrent ? "终止当前回复" : "发送消息";
  }

  if (submitIconEl) {
    submitIconEl.textContent = isPendingForCurrent ? "■" : "↑";
  }
}

function refreshChatPendingState() {
  setChatPending(Boolean(currentSessionId && pendingSessionIds.has(currentSessionId)));
  refreshChatControls();
}

function collapseSessionSidebarForWikiLayout() {
  const layout = window.WorkbenchUI?.getState?.().layout;
  if (layout !== "wiki" || document.body.classList.contains("session-sidebar-collapsed")) {
    return;
  }
  applySessionSidebarState(true);
  saveSessionSidebarState(true);
}

async function abortCurrentReply() {
  const sessionId = currentSessionId;
  if (!sessionId || !pendingSessionIds.has(sessionId) || abortingSessionIds.has(sessionId)) {
    return;
  }

  abortingSessionIds.add(sessionId);
  refreshChatPendingState();

  try {
    const safeSessionId = encodeURIComponent(sessionId);
    const response = await fetch(`/api/sessions/${safeSessionId}/abort`, {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(await extractErrorMessage(response));
    }
  } catch (error) {
    abortingSessionIds.delete(sessionId);
    refreshChatPendingState();
    appendMessage("assistant", `终止回复失败：${error.message}`);
  }
}

window.ChatWorkbench = {
  focusInput: focusChatInput,
  injectPrompt,
};

messagesEl?.addEventListener("scroll", () => {
  if (syncingProgrammaticMessageScroll) {
    return;
  }
  shouldAutoScrollMessages = isMessagesNearBottom();
});

messagesEl?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  const link = target.closest(".message-assistant .message-body a");
  if (!(link instanceof HTMLAnchorElement)) {
    return;
  }
  const destination = resolveWikiLinkTarget(link.getAttribute("href"));
  if (!destination || !window.WikiWorkbench?.openPage) {
    return;
  }
  event.preventDefault();
  await window.WikiWorkbench.openPage(destination.path, destination.source);
});

function createConsultedPagesMeta(pages = []) {
  if (!Array.isArray(pages) || !pages.length) {
    return null;
  }

  const meta = document.createElement("div");
  meta.className = "message-meta";

  pages.forEach((page) => {
    const link = document.createElement("button");
    link.className = "message-link";
    link.type = "button";
    link.textContent = page.title;
    link.addEventListener("click", () => {
      if (window.WikiWorkbench?.openPage) {
        window.WikiWorkbench.openPage(page.path, page.source || "wiki");
      } else {
        window.location.href = `/?page=${encodeURIComponent(page.path)}`;
      }
    });
    meta.appendChild(link);
  });

  return meta;
}

function createTraceItem(item) {
  const badgeLabels = {
    status: "状态",
    tool: "工具",
    thinking: "思考",
  };

  const row = document.createElement("li");
  row.className = "trace-item";

  const header = document.createElement("div");
  header.className = "trace-item-header";

  const badge = document.createElement("span");
  badge.className = `trace-badge trace-${item.kind || "status"}`;
  badge.textContent = badgeLabels[item.kind] || "状态";

  const title = document.createElement("strong");
  title.textContent = item.title || "Pi event";

  header.appendChild(badge);
  header.appendChild(title);
  row.appendChild(header);

  if (item.detail) {
    const detail = document.createElement("p");
    detail.textContent = item.detail;
    row.appendChild(detail);
  }

  return row;
}

function formatShortPath(value = "") {
  if (!value) {
    return "";
  }
  const trimmed = String(value).trim();
  if (!trimmed || trimmed === ".") {
    return "repository root";
  }
  return trimmed;
}

function summarizeInlineText(value, maxLength = 140) {
  const normalized = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return "";
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

function getTraceArgs(item) {
  if (!item || typeof item !== "object") {
    return {};
  }
  return item.args && typeof item.args === "object" ? item.args : {};
}

function describeToolAction(item) {
  const action = item.action || item.tool_name || "tool";
  const args = getTraceArgs(item);
  const path = formatShortPath(item.path || args.path || args.filePath || args.cwd || args.dir || "");
  const pattern = summarizeInlineText(
    args.pattern || args.query || args.search || args.text || args.needle || ""
  );
  const command = summarizeInlineText(args.command || args.cmd || "");

  if (action === "explore") {
    return {
      headline: "查看了 1 个位置",
      detail: path ? `查看 ${path}` : "查看仓库内容",
    };
  }

  if (action === "read") {
    return {
      headline: "读取了 1 个文件",
      detail: path ? `读取 ${path}` : "读取文件",
    };
  }

  if (action === "search") {
    if (path && pattern) {
      return {
        headline: "搜索了 1 个目标",
        detail: `在 ${path} 中搜索“${pattern}”`,
      };
    }
    if (pattern) {
      return {
        headline: "搜索了 1 个目标",
        detail: `搜索“${pattern}”`,
      };
    }
    return {
      headline: "搜索了 1 个目标",
      detail: path ? `搜索 ${path}` : (item.detail || item.title || "搜索内容"),
    };
  }

  if (action === "bash") {
    return {
      headline: "执行了 1 条命令",
      detail: command ? `执行命令：${command}` : (item.detail || "执行命令"),
    };
  }

  if (action === "write" || action === "edit") {
    return {
      headline: "修改了 1 个文件",
      detail: path ? `修改 ${path}` : (item.detail || "修改文件"),
    };
  }

  return {
    headline: "调用了 1 个工具",
    detail: item.detail || item.title || "调用工具",
  };
}

function describeToolGroup(items) {
  const first = items[0] || {};
  const action = first.action || "tool";

  if (action === "explore") {
    return { headline: `查看了 ${items.length} 个位置` };
  }
  if (action === "read") {
    return { headline: `读取了 ${items.length} 个文件` };
  }
  if (action === "search") {
    return { headline: `搜索了 ${items.length} 个目标` };
  }
  if (action === "bash") {
    return { headline: `执行了 ${items.length} 条命令` };
  }
  if (action === "write" || action === "edit") {
    return { headline: `修改了 ${items.length} 个文件` };
  }
  return { headline: `调用了 ${items.length} 个工具` };
}

function createWorklogGroup(item) {
  const container = document.createElement("section");
  container.className = "trace-worklog-group";
  container.dataset.groupType = item.action || "tool";

  const title = document.createElement("p");
  title.className = "trace-worklog-title";
  container.appendChild(title);

  const list = document.createElement("ul");
  list.className = "trace-worklog-list";
  container.appendChild(list);

  const entries = [];

  function sync() {
    const groupSummary = describeToolGroup(entries);
    title.textContent = groupSummary.headline;
  }

  return {
    element: container,
    kind: "tool-group",
    action: item.action || "tool",
    add(nextItem) {
      entries.push(nextItem);
      const description = describeToolAction(nextItem);
      const row = document.createElement("li");
      row.textContent = description.detail;
      list.appendChild(row);
      sync();
    },
  };
}

function createWorklogNote(item) {
  const article = document.createElement("article");
  article.className = "trace-worklog-note";

  const body = document.createElement("p");
  body.textContent = item.detail || item.title || "Pi 正在整理当前步骤。";
  article.appendChild(body);

  return {
    element: article,
    kind: "note",
  };
}

function createStreamingThinkingNote() {
  const article = document.createElement("article");
  article.className = "trace-worklog-note trace-worklog-thinking";

  const body = document.createElement("p");
  body.textContent = "";
  article.appendChild(body);

  return {
    element: article,
    kind: "thinking-stream",
    append(delta) {
      body.textContent += delta;
    },
    hasContent() {
      return body.textContent.trim().length > 0;
    },
  };
}

function createWorklogStatus(item) {
  const row = document.createElement("p");
  row.className = "trace-worklog-status";
  row.textContent = item.title || "Pi 状态";

  return {
    element: row,
    kind: "status",
  };
}

function renderTrace(wrapper, trace = [], warnings = []) {
  if ((!Array.isArray(trace) || !trace.length) && (!Array.isArray(warnings) || !warnings.length)) {
    return;
  }

  const details = document.createElement("details");
  details.className = "message-trace";

  const summary = document.createElement("summary");
  const parts = [];
  if (Array.isArray(trace) && trace.length) {
    parts.push(`思考过程 ${trace.length} 条`);
  }
  if (Array.isArray(warnings) && warnings.length) {
    parts.push(`警告 ${warnings.length}`);
  }
  summary.textContent = parts.join(" · ") || "思考过程";
  details.appendChild(summary);

  if (Array.isArray(trace) && trace.length) {
    const list = document.createElement("ol");
    list.className = "trace-list";
    trace.forEach((item) => {
      list.appendChild(createTraceItem(item));
    });
    details.appendChild(list);
  }

  if (Array.isArray(warnings) && warnings.length) {
    const warningBlock = document.createElement("div");
    warningBlock.className = "trace-warnings";

    const warningTitle = document.createElement("p");
    warningTitle.className = "trace-section-label";
    warningTitle.textContent = "警告";
    warningBlock.appendChild(warningTitle);

    const warningList = document.createElement("ul");
    warningList.className = "trace-warning-list";
    warnings.forEach((item) => {
      const row = document.createElement("li");
      row.textContent = item;
      warningList.appendChild(row);
    });
    warningBlock.appendChild(warningList);
    details.appendChild(warningBlock);
  }

  wrapper.appendChild(details);
}

function renderMessageBody(container, role, content) {
  if (!container) {
    return;
  }
  if (role === "assistant") {
    container.innerHTML = markdownToHtml(content || "");
    return;
  }
  container.textContent = content || "";
}

function appendMessage(role, content, consultedPages = [], trace = [], warnings = []) {
  if (!messagesEl) {
    console.warn("messagesEl not found, cannot append message");
    return;
  }

  const wrapper = document.createElement("article");
  wrapper.className = `message message-${role}`;

  if (role === "assistant") {
    renderTrace(wrapper, trace, warnings);
  }

  const meta = createConsultedPagesMeta(consultedPages);

  const body = document.createElement("div");
  body.className = "message-body";
  renderMessageBody(body, role, content);
  wrapper.appendChild(body);

  if (meta) {
    wrapper.appendChild(meta);
  }

  messagesEl.appendChild(wrapper);
  scrollMessagesToBottom();
}

function createStreamingAssistantMessage(initialText) {
  const wrapper = document.createElement("article");
  wrapper.className = "message message-assistant";

  const detailsEl = document.createElement("details");
  detailsEl.className = "message-trace";
  detailsEl.hidden = true;

  const summaryEl = document.createElement("summary");
  summaryEl.textContent = "思考过程";
  detailsEl.appendChild(summaryEl);

  const worklogEl = document.createElement("div");
  worklogEl.className = "trace-worklog";
  detailsEl.appendChild(worklogEl);

  const warningsBlockEl = document.createElement("div");
  warningsBlockEl.className = "trace-warnings";
  warningsBlockEl.hidden = true;

  const warningsTitleEl = document.createElement("p");
  warningsTitleEl.className = "trace-section-label";
  warningsTitleEl.textContent = "警告";
  warningsBlockEl.appendChild(warningsTitleEl);

  const warningsListEl = document.createElement("ul");
  warningsListEl.className = "trace-warning-list";
  warningsBlockEl.appendChild(warningsListEl);

  detailsEl.appendChild(warningsBlockEl);
  wrapper.appendChild(detailsEl);

  const bodyEl = document.createElement("div");
  bodyEl.className = "message-body";
  renderMessageBody(bodyEl, "assistant", initialText);
  wrapper.appendChild(bodyEl);

  const metaHost = document.createElement("div");
  metaHost.hidden = true;
  wrapper.appendChild(metaHost);

  messagesEl.appendChild(wrapper);
  scrollMessagesToBottom();

  let traceCount = 0;
  let warningCount = 0;
  let hasActualText = false;
  let lastWorklogEntry = null;
  let thinkingStreamNote = null;
  let rawContent = String(initialText || "");

  function updateTraceSummary() {
    const parts = [];
    if (traceCount) {
      parts.push(`思考过程 ${traceCount} 条`);
    }
    if (warningCount) {
      parts.push(`警告 ${warningCount}`);
    }
    summaryEl.textContent = parts.join(" · ") || "思考过程";
    detailsEl.hidden = !traceCount && !warningCount;
  }

  function setConsultedPages(pages = []) {
    metaHost.innerHTML = "";
    const meta = createConsultedPagesMeta(pages);
    if (meta) {
      metaHost.appendChild(meta);
      metaHost.hidden = false;
    } else {
      metaHost.hidden = true;
    }
    scrollMessagesToBottom();
  }

  function setWarnings(warnings = []) {
    warningsListEl.innerHTML = "";
    warningCount = Array.isArray(warnings) ? warnings.length : 0;
    if (warningCount) {
      warnings.forEach((item) => {
        const row = document.createElement("li");
        row.textContent = item;
        warningsListEl.appendChild(row);
      });
      warningsBlockEl.hidden = false;
    } else {
      warningsBlockEl.hidden = true;
    }
    updateTraceSummary();
    scrollMessagesToBottom();
  }

  return {
    element: wrapper,
    setContent(text) {
      rawContent = String(text || "");
      hasActualText = true;
      renderMessageBody(bodyEl, "assistant", rawContent);
      scrollMessagesToBottom();
    },
    appendDelta(delta) {
      if (!delta) {
        return;
      }
      if (!hasActualText) {
        rawContent = "";
        hasActualText = true;
      }
      rawContent += delta;
      renderMessageBody(bodyEl, "assistant", rawContent);
      scrollMessagesToBottom();
    },
    appendThinkingDelta(delta) {
      if (!delta) {
        return;
      }
      if (!thinkingStreamNote) {
        thinkingStreamNote = createStreamingThinkingNote();
        worklogEl.prepend(thinkingStreamNote.element);
        traceCount += 1;
        updateTraceSummary();
      }
      thinkingStreamNote.append(delta);
      scrollMessagesToBottom();
    },
    setConsultedPages,
    addTrace(item) {
      if (!item || typeof item !== "object") {
        return;
      }

      if (item.kind === "thinking") {
        const note = createWorklogNote(item);
        worklogEl.appendChild(note.element);
        lastWorklogEntry = note;
      } else if (item.kind === "tool") {
        const shouldReuseGroup =
          lastWorklogEntry &&
          lastWorklogEntry.kind === "tool-group" &&
          lastWorklogEntry.action === (item.action || "tool");

        if (shouldReuseGroup) {
          lastWorklogEntry.add(item);
        } else {
          const group = createWorklogGroup(item);
          group.add(item);
          worklogEl.appendChild(group.element);
          lastWorklogEntry = group;
        }
      } else {
        const status = createWorklogStatus(item);
        worklogEl.appendChild(status.element);
        lastWorklogEntry = status;
      }

      traceCount += 1;
      updateTraceSummary();
      scrollMessagesToBottom();
    },
    setWarnings,
    finalize(payload = {}) {
      const finalMessage = typeof payload.message === "string" ? payload.message : "";
      if (finalMessage && (!hasActualText || finalMessage !== rawContent)) {
        this.setContent(finalMessage);
      }
      if (Array.isArray(payload.consulted_pages)) {
        setConsultedPages(payload.consulted_pages);
      }
      if (Array.isArray(payload.warnings)) {
        setWarnings(payload.warnings);
      }
    },
    getContent() {
      return rawContent;
    },
  };
}

function setSuggestions(_items) {
  // Suggestions UI removed.
}

function describeRuntime() {
  return {
    pending: "Pi 正在生成答复...",
  };
}

async function loadRuntimeStatus() {
  // Runtime status UI removed.
}

async function loadSuggestions() {
  // Suggestions UI removed.
}

async function consumeNdjsonStream(response, onEvent) {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  if (!response.body) {
    throw new Error("ReadableStream not available.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line) {
        onEvent(JSON.parse(line));
      }
      newlineIndex = buffer.indexOf("\n");
    }

    if (done) {
      const tail = buffer.trim();
      if (tail) {
        onEvent(JSON.parse(tail));
      }
      break;
    }
  }
}

function buildAutoSessionTitle(message) {
  const normalized = String(message || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return `新对话 ${new Date().toLocaleTimeString()}`;
  }
  const maxLength = 30;
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength).trim()}…`;
}

function sessionTitle(session) {
  if (!session || typeof session !== "object") {
    return "未命名会话";
  }
  return session.title || `会话 ${String(session.session_id || "").slice(0, 8)}`;
}

function renderDraftStateHint() {
  clearMessages();
  appendMessage("assistant", "Hi，聊点什么？");
}

async function extractErrorMessage(response) {
  try {
    const payload = await response.json();
    if (payload && typeof payload === "object" && payload.detail) {
      return String(payload.detail);
    }
  } catch (_error) {
    // ignore parsing error
  }
  return `HTTP ${response.status}`;
}

async function uploadInboxFile(file) {
  if (!file) {
    return;
  }

  isUploadingInboxFile = true;
  refreshChatControls();

  try {
    const response = await fetch("/api/knowledge-base/inbox/upload", {
      method: "POST",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "X-Gogo-Filename": encodeURIComponent(file.name || "upload.bin"),
      },
      body: file,
    });
    if (!response.ok) {
      throw new Error(await extractErrorMessage(response));
    }

    const payload = await response.json();
    const filePath = String(payload?.file?.path || file.name || "inbox/未命名文件");
    const prompt = String(payload?.ingest_prompt || "").trim();
    if (prompt) {
      injectPrompt(prompt, false);
    }
    appendMessage(
      "assistant",
      `文件已上传到 \`${filePath}\`。我已经把 ingest 提示词放进输入框里，你确认后发送给 Pi 就可以开始按 schema ingest。`
    );
    showSettingsHint(`已上传到 ${filePath}`);
  } catch (error) {
    console.error("Failed to upload inbox file:", error);
    appendMessage("assistant", `上传文件失败：${error.message}`);
  } finally {
    isUploadingInboxFile = false;
    if (uploadInputEl) {
      uploadInputEl.value = "";
    }
    refreshChatControls();
  }
}

function renderSessionList() {
  if (!sessionListEl) {
    return;
  }

  sessionListEl.innerHTML = "";

  if (sessionListEmptyEl) {
    sessionListEmptyEl.classList.toggle("hidden", sessions.length > 0);
  }

  sessions.forEach((session) => {
    const sid = String(session.session_id || "");
    if (!sid) {
      return;
    }

    const item = document.createElement("li");
    item.className = "session-item";

    const row = document.createElement("div");
    row.className = "session-item-row";

    const mainButton = document.createElement("button");
    mainButton.type = "button";
    mainButton.className = "session-item-main";
    if (sid === currentSessionId) {
      mainButton.classList.add("active");
    }
    if (pendingSessionIds.has(sid)) {
      mainButton.classList.add("pending");
    }

    const titleEl = document.createElement("span");
    titleEl.className = "session-item-title";
    titleEl.textContent = sessionTitle(session);
    mainButton.appendChild(titleEl);
    mainButton.addEventListener("click", async () => {
      openSessionMenuId = null;
      await switchToSession(sid);
      collapseSessionSidebarForWikiLayout();
    });

    const menuButton = document.createElement("button");
    menuButton.type = "button";
    menuButton.className = "session-item-more";
    menuButton.textContent = "…";
    menuButton.setAttribute("aria-label", "会话操作");
    const menuExpanded = openSessionMenuId === sid;
    menuButton.setAttribute("aria-expanded", menuExpanded ? "true" : "false");
    menuButton.addEventListener("click", (event) => {
      event.stopPropagation();
      openSessionMenuId = openSessionMenuId === sid ? null : sid;
      renderSessionList();
    });

    row.appendChild(mainButton);
    row.appendChild(menuButton);
    item.appendChild(row);

    const menu = document.createElement("div");
    menu.className = "session-item-menu";
    if (openSessionMenuId !== sid) {
      menu.classList.add("hidden");
    }

    const renameButton = document.createElement("button");
    renameButton.type = "button";
    renameButton.textContent = "重命名";
    renameButton.addEventListener("click", async () => {
      await renameSession(sid);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "删除";
    deleteButton.addEventListener("click", async () => {
      await deleteSession(sid);
    });

    menu.appendChild(renameButton);
    menu.appendChild(deleteButton);
    item.appendChild(menu);

    sessionListEl.appendChild(item);
  });
}

function enterDraftState({ skipSave = false, showHint = true } = {}) {
  if (!skipSave) {
    saveCurrentHistory();
    storeCurrentSessionView();
  }
  currentSessionId = null;
  history = draftHistory;
  draftHistory.length = 0;
  rememberSessionId(null);
  if (restoreSessionView(null)) {
    refreshChatPendingState();
    renderSessionList();
    return;
  }
  if (showHint) {
    renderDraftStateHint();
    storeCurrentSessionView();
  }
  refreshChatPendingState();
  renderSessionList();
}

async function switchToSession(sessionId, { skipSave = false } = {}) {
  if (!sessionId) {
    enterDraftState({ skipSave });
    return;
  }

  if (!skipSave) {
    saveCurrentHistory();
    storeCurrentSessionView();
  }

  currentSessionId = sessionId;
  history = loadSessionHistory(currentSessionId);
  rememberSessionId(currentSessionId);
  try {
    const session = await fetchSessionDetail(sessionId);
    if (session) {
      mergeSessionIntoCache(session);
    }
  } catch (error) {
    console.warn("Failed to refresh current session detail:", error);
  }
  if (restoreSessionView(sessionId)) {
    refreshChatPendingState();
    renderSessionList();
    return;
  }

  clearMessages();

  await hydrateSessionHistoryFromStore(sessionId);
  if (currentSessionId !== sessionId) {
    return;
  }

  const sessHistory = loadSessionHistory(sessionId);
  if (sessHistory.length > 0) {
    renderHistory(sessHistory);
  } else {
    appendMessage("assistant", "这是会话的开始。");
  }

  refreshChatPendingState();
  renderSessionList();
}

async function fetchSessions() {
  const response = await fetch("/api/sessions");
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }
  const data = await response.json();
  return Array.isArray(data.sessions) ? data.sessions : [];
}

async function fetchPiOptions() {
  const response = await fetch("/api/pi/options");
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }
  return response.json();
}

function applyPiOptions(payload) {
  const models = Array.isArray(payload?.models) ? payload.models.map(normalizeModelRecord).filter(Boolean) : [];
  availableModels = models;

  const levels = Array.isArray(payload?.thinking_levels) ? payload.thinking_levels : [];
  availableThinkingLevels = levels.length ? levels.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean) : availableThinkingLevels;

  const state = payload?.state && typeof payload.state === "object" ? payload.state : {};
  const draftModel = normalizeModelRecord(state.model);
  if (draftModel) {
    draftChatSettings.model_provider = draftModel.provider;
    draftChatSettings.model_id = draftModel.model_id;
    draftChatSettings.model_label = draftModel.label;
  } else if (!draftChatSettings.model_label && models[0]) {
    draftChatSettings.model_provider = models[0].provider;
    draftChatSettings.model_id = models[0].model_id;
    draftChatSettings.model_label = models[0].label;
  }
  const draftThinkingLevel = String(state.thinkingLevel || draftChatSettings.thinking_level || "medium").trim().toLowerCase();
  if (draftThinkingLevel) {
    draftChatSettings.thinking_level = draftThinkingLevel;
  }
}

function mergeSessionIntoCache(sessionPayload) {
  if (!sessionPayload?.session_id) {
    return;
  }
  const index = sessions.findIndex((item) => item.session_id === sessionPayload.session_id);
  if (index >= 0) {
    sessions[index] = { ...sessions[index], ...sessionPayload };
  } else {
    sessions.unshift(sessionPayload);
  }
}

async function fetchSessionDetail(sessionId) {
  const safeSessionId = encodeURIComponent(sessionId);
  const response = await fetch(`/api/sessions/${safeSessionId}`);
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }
  const payload = await response.json();
  return payload?.session || null;
}

async function applyModelSelection(model) {
  if (!model) {
    return;
  }
  if (!currentSessionId) {
    draftChatSettings = {
      ...draftChatSettings,
      model_provider: model.provider,
      model_id: model.model_id,
      model_label: model.label,
    };
    refreshChatControls();
    return;
  }

  try {
    const safeSessionId = encodeURIComponent(currentSessionId);
    const response = await fetch(`/api/sessions/${safeSessionId}/settings`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model_provider: model.provider,
        model_id: model.model_id,
      }),
    });
    if (!response.ok) {
      throw new Error(await extractErrorMessage(response));
    }
    const payload = await response.json();
    mergeSessionIntoCache(payload?.session || null);
    renderSessionList();
    refreshChatControls();
  } catch (error) {
    console.error("Failed to switch model:", error);
    appendMessage("assistant", `切换模型失败：${error.message}`);
  }
}

async function applyThinkingSelection(level) {
  if (!level) {
    return;
  }
  if (!currentSessionId) {
    draftChatSettings = {
      ...draftChatSettings,
      thinking_level: level,
    };
    refreshChatControls();
    return;
  }

  try {
    const safeSessionId = encodeURIComponent(currentSessionId);
    const response = await fetch(`/api/sessions/${safeSessionId}/settings`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        thinking_level: level,
      }),
    });
    if (!response.ok) {
      throw new Error(await extractErrorMessage(response));
    }
    const payload = await response.json();
    mergeSessionIntoCache(payload?.session || null);
    renderSessionList();
    refreshChatControls();
  } catch (error) {
    console.error("Failed to switch thinking level:", error);
    appendMessage("assistant", `切换思考水平失败：${error.message}`);
  }
}

async function reloadSessions() {
  try {
    sessions = await fetchSessions();
    if (openSessionMenuId && !sessions.some((item) => item.session_id === openSessionMenuId)) {
      openSessionMenuId = null;
    }
    renderSessionList();
    refreshChatControls();
  } catch (error) {
    console.error("Failed to load sessions:", error);
    appendMessage("assistant", `加载会话列表失败：${error.message}`);
  }
}

async function createSessionForFirstMessage(message) {
  const response = await fetch("/api/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: buildAutoSessionTitle(message),
      system_prompt: "",
      thinking_level: draftChatSettings.thinking_level,
      model_provider: draftChatSettings.model_provider,
      model_id: draftChatSettings.model_id,
    }),
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  const data = await response.json();
  const sid = String(data.session_id || "");
  if (!sid) {
    throw new Error("后端未返回有效 session_id");
  }

  currentSessionId = sid;
  history = ensureSessionHistory(sid);
  hydratedSessionIds.add(sid);
  rememberSessionId(sid);
  mergeSessionIntoCache(data.session || null);
  await reloadSessions();
  return sid;
}

async function renameSession(sessionId) {
  const session = sessions.find((item) => item.session_id === sessionId);
  if (!session) {
    return;
  }

  const nextName = window.prompt("输入新的会话名称：", sessionTitle(session));
  if (nextName === null) {
    return;
  }
  const title = nextName.trim();
  if (!title) {
    appendMessage("assistant", "会话名称不能为空。");
    return;
  }

  try {
    const safeSessionId = encodeURIComponent(sessionId);
    const response = await fetch(`/api/sessions/${safeSessionId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title }),
    });
    if (!response.ok) {
      throw new Error(await extractErrorMessage(response));
    }
    const payload = await response.json();
    if (!payload.success) {
      throw new Error("后端未确认重命名成功。");
    }
    openSessionMenuId = null;
    await reloadSessions();
  } catch (error) {
    console.error("Failed to rename session:", error);
    appendMessage("assistant", `重命名会话失败：${error.message}`);
  }
}

async function deleteSession(sessionId) {
  if (!sessionId) {
    return;
  }
  if (pendingSessionIds.has(sessionId)) {
    appendMessage("assistant", "该会话仍在回复中，暂时无法删除。");
    return;
  }
  if (!window.confirm("确认删除该会话吗？删除后不可恢复。")) {
    return;
  }

  const deletingCurrent = sessionId === currentSessionId;
  const previousIndex = sessions.findIndex((item) => item.session_id === sessionId);

  try {
    const safeSessionId = encodeURIComponent(sessionId);
    const response = await fetch(`/api/sessions/${safeSessionId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(await extractErrorMessage(response));
    }
    const payload = await response.json();
    if (!payload.success) {
      throw new Error("后端未确认删除成功。");
    }

    sessionHistories.delete(sessionId);
    sessionViewNodes.delete(getViewKey(sessionId));
    hydratedSessionIds.delete(sessionId);
    pendingSessionIds.delete(sessionId);
    if (currentStreamingSessionId === sessionId) {
      currentStreamingSessionId = null;
      currentStreamingMessage = null;
    }

    openSessionMenuId = null;
    await reloadSessions();

    if (deletingCurrent) {
      if (sessions.length > 0) {
        const fallbackIndex = Math.max(0, Math.min(previousIndex, sessions.length - 1));
        const fallbackSession = sessions[fallbackIndex];
        await switchToSession(fallbackSession.session_id, { skipSave: true });
      } else {
        enterDraftState({ skipSave: true });
      }
    }
  } catch (error) {
    console.error("Failed to delete session:", error);
    appendMessage("assistant", `删除会话失败：${error.message}`);
  }
}

async function sendMessage(message) {
  saveCurrentHistory();

  let requestSessionId = currentSessionId;
  try {
    if (!requestSessionId) {
      requestSessionId = await createSessionForFirstMessage(message);
    }
  } catch (error) {
    appendMessage("assistant", `创建会话失败：${error.message}`);
    return;
  }

  const requestHistory = ensureSessionHistory(requestSessionId);
  currentSessionId = requestSessionId;
  history = requestHistory;
  rememberSessionId(requestSessionId);

  appendMessage("user", message);
  requestHistory.push({ role: "user", content: message });

  const runtime = describeRuntime();
  const liveMessage = createStreamingAssistantMessage(runtime.pending);
  upsertAssistantTurn(requestHistory, runtime.pending);
  sessionHistories.set(requestSessionId, requestHistory);
  currentStreamingMessage = liveMessage;
  currentStreamingSessionId = requestSessionId;
  pendingSessionIds.add(requestSessionId);
  storeCurrentSessionView();
  refreshChatPendingState();
  renderSessionList();

  const requestId = createRequestId();
  let finalPayload = null;

  try {
    const response = await fetch("/api/chat/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        session_id: requestSessionId,
        request_id: requestId,
      }),
    });

    await consumeNdjsonStream(response, (event) => {
      const type = event?.type;

      if (type === "context") {
        liveMessage.setConsultedPages(event.consulted_pages || []);
        return;
      }

      if (type === "trace") {
        liveMessage.addTrace(event.item || {});
        return;
      }

      if (type === "thinking_delta") {
        liveMessage.appendThinkingDelta(event.delta || "");
        return;
      }

      if (type === "text_delta") {
        liveMessage.appendDelta(event.delta || "");
        return;
      }

      if (type === "text_replace") {
        liveMessage.setContent(event.text || "");
        return;
      }

      if (type === "final") {
        finalPayload = event;
        liveMessage.finalize(event);
        return;
      }

      if (type === "error") {
        finalPayload = event;
        liveMessage.finalize(event);
      }
    });

    const assistantMessage =
      typeof finalPayload?.message === "string" && finalPayload.message
        ? finalPayload.message
        : liveMessage.getContent().trim() || "Pi 没有返回最终结果。";

    upsertAssistantTurn(requestHistory, assistantMessage);
    sessionHistories.set(requestSessionId, requestHistory);
    if (requestSessionId === currentSessionId && !messagesEl.contains(liveMessage.element)) {
      clearMessages();
      renderHistory(requestHistory);
    } else if (requestSessionId === currentSessionId) {
      storeCurrentSessionView();
    }
    if (currentStreamingMessage === liveMessage) {
      currentStreamingMessage = null;
      currentStreamingSessionId = null;
    }
  } catch (error) {
    const fallbackMessage = "后端暂时没有返回结果。当前页面已经接好了流式调用链路，但服务可能还没启动。";
    const warnings = [String(error?.message || error || "Unknown streaming error.")];
    liveMessage.finalize({
      message: fallbackMessage,
      warnings,
    });
    upsertAssistantTurn(requestHistory, fallbackMessage);
    sessionHistories.set(requestSessionId, requestHistory);
    if (requestSessionId === currentSessionId) {
      storeCurrentSessionView();
    }
    if (currentStreamingMessage === liveMessage) {
      currentStreamingMessage = null;
      currentStreamingSessionId = null;
    }
  } finally {
    abortingSessionIds.delete(requestSessionId);
    pendingSessionIds.delete(requestSessionId);
    refreshChatPendingState();
    renderSessionList();
  }
}

async function submitCurrentMessage() {
  if (currentSessionId && pendingSessionIds.has(currentSessionId)) {
    return;
  }
  if (submitButtonEl?.disabled) {
    return;
  }
  const message = inputEl?.value.trim();
  if (!message) {
    return;
  }
  shouldAutoScrollMessages = true;
  inputEl.value = "";
  await sendMessage(message);
}

formEl?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (currentSessionId && pendingSessionIds.has(currentSessionId)) {
    await abortCurrentReply();
    return;
  }
  await submitCurrentMessage();
});

inputEl?.addEventListener("keydown", async (event) => {
  if (currentSessionId && pendingSessionIds.has(currentSessionId)) {
    return;
  }
  if (
    event.key !== "Enter" ||
    event.shiftKey ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.isComposing
  ) {
    return;
  }
  event.preventDefault();
  await submitCurrentMessage();
});

inputEl?.addEventListener("input", () => {
  refreshChatPendingState();
});

newSessionButtonEl?.addEventListener("click", () => {
  openSessionMenuId = null;
  enterDraftState();
  focusChatInput();
});

toggleSessionSidebarButtonEl?.addEventListener("click", () => {
  const nextCollapsed = !document.body.classList.contains("session-sidebar-collapsed");
  applySessionSidebarState(nextCollapsed);
  saveSessionSidebarState(nextCollapsed);
});

toggleSessionSidebarMainButtonEl?.addEventListener("click", () => {
  const nextCollapsed = !document.body.classList.contains("session-sidebar-collapsed");
  applySessionSidebarState(nextCollapsed);
  saveSessionSidebarState(nextCollapsed);
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  if (!target.closest(".chat-control-menu-shell")) {
    closeChatControlMenus();
  }
  if (target.closest(".session-item")) {
    return;
  }
  if (openSessionMenuId) {
    openSessionMenuId = null;
    renderSessionList();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }
  closeChatControlMenus();
  if (openSessionMenuId) {
    openSessionMenuId = null;
    renderSessionList();
  }
});

uploadButtonEl?.addEventListener("click", () => {
  if (uploadButtonEl.disabled || !uploadInputEl) {
    return;
  }
  uploadInputEl.value = "";
  uploadInputEl.click();
});

uploadInputEl?.addEventListener("change", async () => {
  const file = uploadInputEl.files?.[0];
  if (!file) {
    return;
  }
  await uploadInboxFile(file);
});

modelButtonEl?.addEventListener("click", () => {
  if (modelButtonEl.disabled) {
    return;
  }
  toggleChatControlMenu("model");
});

thinkingButtonEl?.addEventListener("click", () => {
  if (thinkingButtonEl.disabled) {
    return;
  }
  toggleChatControlMenu("thinking");
});

async function bootstrapChat() {
  applySessionSidebarState(loadSessionSidebarState());
  try {
    applyPiOptions(await fetchPiOptions());
  } catch (error) {
    console.error("Failed to load Pi options:", error);
    appendMessage("assistant", `加载模型与思考水平选项失败：${error.message}`);
  }
  await reloadSessions();

  const rememberedSessionId = getRememberedSessionId();
  const rememberedExists = rememberedSessionId
    ? sessions.some((session) => session.session_id === rememberedSessionId)
    : false;
  const initialSessionId = rememberedExists
    ? rememberedSessionId
    : (sessions[0]?.session_id || null);

  if (initialSessionId) {
    await switchToSession(initialSessionId, { skipSave: true });
  } else {
    enterDraftState({ skipSave: true });
  }
  refreshChatControls();
}

bootstrapChat();

window.addEventListener("wiki:quote", (event) => {
  const detail = event.detail || {};
  if (!detail.path || !detail.title) {
    return;
  }

  injectPrompt(
    `请结合这个 wiki 页面继续分析：${detail.title}（${detail.path}）`,
    false
  );
});
