const messagesEl = document.querySelector("#messages");
const chatScrollBottomButtonEl = document.querySelector("#chat-scroll-bottom-button");
const chatQuestionNavEl = document.querySelector("#chat-question-nav");
const chatQuestionTrackEl = document.querySelector("#chat-question-track");
const chatQuestionListEl = document.querySelector("#chat-question-list");
const chatQuestionPopoverEl = document.querySelector("#chat-question-popover");
const formEl = document.querySelector("#chat-form");
const inputEl = document.querySelector("#chat-input");
const submitButtonEl = formEl?.querySelector("button[type='submit']");
const submitIconEl = submitButtonEl?.querySelector(".chat-submit-icon");
const uploadButtonEl = document.querySelector("#chat-upload-button");
const uploadInputEl = document.querySelector("#chat-upload-input");
const toggleInboxPanelButtonEl = document.querySelector("#toggle-inbox-panel");
const inboxCountBadgeEl = document.querySelector("#inbox-count-badge");
const inboxPanelEl = document.querySelector("#inbox-panel");
const closeInboxPanelButtonEl = document.querySelector("#close-inbox-panel");
const refreshInboxPanelButtonEl = document.querySelector("#refresh-inbox-panel");
const ingestInboxPanelButtonEl = document.querySelector("#ingest-inbox-panel");
const inboxPanelFeedbackEl = document.querySelector("#inbox-panel-feedback");
const inboxFileListEl = document.querySelector("#inbox-file-list");
const inboxFileEmptyEl = document.querySelector("#inbox-file-empty");
const modelButtonEl = document.querySelector("#chat-model-button");
const modelMenuEl = document.querySelector("#chat-model-menu");
const thinkingButtonEl = document.querySelector("#chat-thinking-button");
const thinkingMenuEl = document.querySelector("#chat-thinking-menu");
const securityButtonEl = document.querySelector("#chat-security-button");
const securityMenuEl = document.querySelector("#chat-security-menu");
const contextShellEl = document.querySelector("#chat-context-shell");
const contextButtonEl = document.querySelector("#chat-context-button");
const contextRingEl = document.querySelector("#chat-context-ring");
const contextPopoverEl = document.querySelector("#chat-context-popover");
const contextPercentEl = document.querySelector("#chat-context-percent");
const contextTokensEl = document.querySelector("#chat-context-tokens");
const contextHelpEl = document.querySelector("#chat-context-help");
const contextCompactButtonEl = document.querySelector("#chat-context-compact-button");
const slashButtonEl = document.querySelector("#chat-slash-button");
const slashPanelEl = document.querySelector("#chat-slash-panel");
const slashListEl = document.querySelector("#chat-slash-list");
const settingsHintEl = document.querySelector("#chat-settings-hint");
const securityModalEl = document.querySelector("#chat-security-modal");
const securityModalTitleEl = document.querySelector("#chat-security-modal-title");
const securityModalModeEl = document.querySelector("#chat-security-modal-mode");
const securityModalApprovalEl = document.querySelector("#chat-security-modal-approval");
const securityModalCommandEl = document.querySelector("#chat-security-modal-command");
const securityModalReasonEl = document.querySelector("#chat-security-modal-reason");
const securitySteerInputEl = document.querySelector("#chat-security-steer-input");
const securityModalFeedbackEl = document.querySelector("#chat-security-modal-feedback");
const securityApproveButtonEl = document.querySelector("#chat-security-approve-button");
const securityDenyButtonEl = document.querySelector("#chat-security-deny-button");
const securityCloseButtonEl = document.querySelector("#chat-security-close-button");
const sessionListEl = document.querySelector("#session-list");
const sessionListEmptyEl = document.querySelector("#session-list-empty");
const newSessionButtonEl = document.querySelector("#new-session-button");
const toggleSessionSidebarButtonEl = document.querySelector("#toggle-session-sidebar");
const toggleSessionSidebarMainButtonEl = document.querySelector("#toggle-session-sidebar-main");
const loadOlderButtonEl = document.querySelector("#chat-load-older-button");
const CHAT_UI_VERSION = "2026-04-18.1";
const SESSION_SIDEBAR_STORAGE_KEY = "gogo:session-sidebar-collapsed";
const DRAFT_VIEW_KEY = "__draft__";
const AUTO_SCROLL_BOTTOM_THRESHOLD_PX = 96;
const SESSION_HISTORY_RENDER_BATCH_SIZE = 12;
const SESSION_INITIAL_RENDER_LIMIT = 60;
const SESSION_LOAD_OLDER_BATCH_SIZE = 60;
const SECURITY_UI_TITLE_PREFIX = "__gogo_security_ui__:";
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
const THINKING_LEVEL_DESCRIPTIONS = {
  off: "直接回答，适合简单查询和快速确认。",
  minimal: "保留极少思考，优先降低延迟。",
  low: "做轻量推理，适合多数日常问题。",
  medium: "兼顾速度和推理深度，适合作为默认值。",
  high: "做更充分的推理，适合复杂任务。",
  xhigh: "最大化推理深度，适合最难的问题。",
};
const SECURITY_MODE_SHORT_LABELS = {
  readonly: "只读",
  "workspace-write": "写文件",
  "full-access": "命令",
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
let securitySettingsState = {
  loading: false,
  mode: "",
  mode_label: "",
  mode_description: "",
  available_modes: [],
  boundary_note: "",
};
let openChatControlMenu = null;
let settingsHintTimer = null;
let isUploadingInboxFile = false;
let isLoadingOlderHistory = false;
let inboxFiles = [];
let inboxPanelOpen = false;
let inboxLoading = false;
let highlightedInboxPath = "";
const inboxDeletingPaths = new Set();
const INBOX_INGEST_PROMPT = "请ingest一下inbox的内容。";
let availableSlashCommands = [];
let slashPanelVisible = false;
let slashPanelManual = false;
let slashPanelActiveIndex = 0;
let contextPopoverHideTimer = null;
let activeQuestionIndex = -1;
let chatQuestionPopoverHideTimer = null;
let questionAnchorsCache = [];
let questionMarkerEls = [];
let questionItemEls = [];
const sessionHistoryHasOlder = new Map();
const securityInterventionQueue = [];
let activeSecurityIntervention = null;
let securityDecisionSubmitting = false;
const pendingSecurityDenyReasons = new Map();

function clearChatQuestionPopoverHideTimer() {
  if (chatQuestionPopoverHideTimer) {
    window.clearTimeout(chatQuestionPopoverHideTimer);
    chatQuestionPopoverHideTimer = null;
  }
}

function openChatQuestionPopover() {
  clearChatQuestionPopoverHideTimer();
  chatQuestionNavEl?.classList.add("is-open");
}

function scheduleChatQuestionPopoverHide(delay = 500) {
  clearChatQuestionPopoverHideTimer();
  chatQuestionPopoverHideTimer = window.setTimeout(() => {
    chatQuestionNavEl?.classList.remove("is-open");
    chatQuestionPopoverHideTimer = null;
  }, delay);
}

function clearContextPopoverHideTimer() {
  if (contextPopoverHideTimer) {
    window.clearTimeout(contextPopoverHideTimer);
    contextPopoverHideTimer = null;
  }
}

function openContextPopover() {
  clearContextPopoverHideTimer();
  contextShellEl?.classList.add("is-open");
  contextButtonEl?.setAttribute("aria-expanded", "true");
}

function scheduleContextPopoverHide(delay = 400) {
  clearContextPopoverHideTimer();
  contextPopoverHideTimer = window.setTimeout(() => {
    contextShellEl?.classList.remove("is-open");
    contextButtonEl?.setAttribute("aria-expanded", "false");
    contextPopoverHideTimer = null;
  }, delay);
}

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

function nextAnimationFrame() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
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

function currentSecurityModeText() {
  const mode = String(securitySettingsState.mode || "").trim();
  if (!mode) {
    return "安全模式";
  }
  const fallbackLabel = SECURITY_MODE_SHORT_LABELS[mode] || mode;
  return `安全: ${fallbackLabel}`;
}

function currentModelRecord() {
  const settings = currentChatSettings();
  return (
    availableModels.find(
      (item) => item.provider === settings.model_provider && item.model_id === settings.model_id
    ) || null
  );
}

function currentSessionContextUsage() {
  if (!currentSessionId) {
    return null;
  }
  const session = sessionRecord(currentSessionId);
  return session?.context_usage && typeof session.context_usage === "object"
    ? session.context_usage
    : null;
}

function currentSessionContextWindow() {
  const usage = currentSessionContextUsage();
  const fromUsage = Number(usage?.contextWindow);
  if (Number.isFinite(fromUsage) && fromUsage > 0) {
    return Math.max(0, Math.round(fromUsage));
  }
  const fromModel = Number(currentModelRecord()?.raw?.contextWindow);
  if (Number.isFinite(fromModel) && fromModel > 0) {
    return Math.max(0, Math.round(fromModel));
  }
  return null;
}

function currentSessionContextTokens() {
  const usage = currentSessionContextUsage();
  const tokens = Number(usage?.tokens);
  if (!Number.isFinite(tokens) || tokens < 0) {
    return null;
  }
  return Math.max(0, Math.round(tokens));
}

function currentSessionContextPercent() {
  const usage = currentSessionContextUsage();
  const percent = Number(usage?.percent);
  if (Number.isFinite(percent) && percent >= 0) {
    return Math.min(100, Math.max(0, percent));
  }
  const tokens = currentSessionContextTokens();
  const contextWindow = currentSessionContextWindow();
  if (tokens === null || !contextWindow) {
    return null;
  }
  return Math.min(100, Math.max(0, (tokens / contextWindow) * 100));
}

function formatTokenCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return "—";
  }
  return Math.round(number).toLocaleString("en-US");
}

function createMenuItemText(labelText, detailText = "") {
  const fragment = document.createDocumentFragment();

  const label = document.createElement("span");
  label.className = "chat-control-menu-item-label";
  label.textContent = String(labelText || "").trim();
  fragment.appendChild(label);

  const detail = String(detailText || "").trim();
  if (detail) {
    const detailEl = document.createElement("span");
    detailEl.className = "chat-control-menu-item-detail";
    detailEl.textContent = detail;
    fragment.appendChild(detailEl);
  }

  return fragment;
}

function modelMenuDetail(model) {
  if (!model || typeof model !== "object") {
    return "";
  }
  const provider = String(model.provider || "").trim();
  const modelId = String(model.model_id || "").trim();
  const contextWindow = Number(model.raw?.contextWindow);
  const parts = [];
  if (provider && modelId) {
    parts.push(`${provider}/${modelId}`);
  } else if (modelId) {
    parts.push(modelId);
  }
  if (Number.isFinite(contextWindow) && contextWindow > 0) {
    parts.push(`${formatTokenCount(contextWindow)} tokens`);
  }
  return parts.join(" · ");
}

function formatContextPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return "—";
  }
  const rounded = Math.round(number * 10) / 10;
  if (Number.isInteger(rounded)) {
    return `${rounded}%`;
  }
  return `${rounded.toFixed(1)}%`;
}

function contextRingColor(percent) {
  if (!Number.isFinite(percent)) {
    return "rgba(24, 92, 82, 0.32)";
  }
  if (percent >= 90) {
    return "#b1532f";
  }
  if (percent >= 75) {
    return "#c3812d";
  }
  return "var(--brand)";
}

function refreshChatContextIndicator() {
  const hasSession = Boolean(currentSessionId);
  const isPendingForCurrent = Boolean(currentSessionId && pendingSessionIds.has(currentSessionId));
  const tokens = currentSessionContextTokens();
  const contextWindow = currentSessionContextWindow();
  const percent = currentSessionContextPercent();
  const shouldShow = hasSession;

  contextShellEl?.classList.toggle("hidden", !shouldShow);
  if (!shouldShow) {
    clearContextPopoverHideTimer();
    contextShellEl?.classList.remove("is-open");
    contextButtonEl?.setAttribute("aria-expanded", "false");
    return;
  }

  const progressPercent = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  const progressDeg = `${(progressPercent / 100) * 360}deg`;
  const ringColor = contextRingColor(percent);
  const percentText = Number.isFinite(percent) ? `${formatContextPercent(percent)} 已使用` : "等待统计";
  const tokensText = `${formatTokenCount(tokens)} / ${formatTokenCount(contextWindow)} tokens`;
  const helpText =
    tokens === null && !contextWindow
      ? "当前模型或会话还没有返回 context window 统计；一旦 Pi 提供数据，这里会自动刷新。"
      : tokens === null
        ? "刚完成 compact 或还没有最新回复时，Pi 可能暂时拿不到精确 token 统计。"
        : "当上下文变长时，你可以用 /compact 压缩当前会话的 context window。";

  if (contextRingEl) {
    contextRingEl.style.setProperty("--context-progress", progressDeg);
    contextRingEl.style.setProperty("--context-ring-color", ringColor);
    contextRingEl.classList.toggle("is-empty", !Number.isFinite(percent));
  }
  if (contextButtonEl) {
    contextButtonEl.disabled = isPendingForCurrent;
    contextButtonEl.setAttribute("aria-expanded", "false");
    contextButtonEl.title = Number.isFinite(percent)
      ? `当前 context window 使用 ${formatContextPercent(percent)}`
      : "当前 context window 使用情况";
    contextButtonEl.setAttribute(
      "aria-label",
      Number.isFinite(percent)
        ? `当前 context window 使用 ${formatContextPercent(percent)}，${tokensText}`
        : `当前 context window 使用情况，${tokensText}`
    );
  }
  if (contextPercentEl) {
    contextPercentEl.textContent = percentText;
  }
  if (contextTokensEl) {
    contextTokensEl.textContent = tokensText;
  }
  if (contextHelpEl) {
    contextHelpEl.textContent = helpText;
  }
  if (contextCompactButtonEl) {
    contextCompactButtonEl.disabled = !currentSessionId || isPendingForCurrent;
    contextCompactButtonEl.title = "发送 /compact 压缩当前上下文";
  }
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

function setSecurityModalFeedback(message, isError = true) {
  if (!securityModalFeedbackEl) {
    return;
  }
  if (!message) {
    securityModalFeedbackEl.textContent = "";
    securityModalFeedbackEl.classList.add("hidden");
    securityModalFeedbackEl.style.color = "";
    return;
  }
  securityModalFeedbackEl.textContent = message;
  securityModalFeedbackEl.classList.remove("hidden");
  securityModalFeedbackEl.style.color = isError ? "#b1532f" : "#185c52";
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

function applySecuritySettingsState(security) {
  const availableModes = Array.isArray(security?.available_modes)
    ? security.available_modes
        .filter((item) => item && typeof item === "object" && item.id)
        .map((item) => ({
          id: String(item.id || "").trim(),
          label: String(item.label || item.id || "").trim(),
          description: String(item.description || "").trim(),
        }))
    : securitySettingsState.available_modes;
  const nextMode = String(security?.mode || securitySettingsState.mode || availableModes[0]?.id || "").trim();
  const activeMode =
    availableModes.find((item) => item.id === nextMode) ||
    availableModes.find((item) => item.id === securitySettingsState.mode) ||
    null;

  securitySettingsState = {
    ...securitySettingsState,
    mode: nextMode,
    mode_label: String(security?.mode_label || activeMode?.label || securitySettingsState.mode_label || "").trim(),
    mode_description: String(
      security?.mode_description || activeMode?.description || securitySettingsState.mode_description || ""
    ).trim(),
    available_modes: availableModes,
    boundary_note: String(security?.boundary_note || securitySettingsState.boundary_note || "").trim(),
  };
}

async function fetchSecuritySettings() {
  const response = await fetch("/api/settings/diagnostics");
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }
  const payload = await response.json();
  return payload?.security && typeof payload.security === "object" ? payload.security : {};
}

async function reloadSecuritySettings({ silent = false } = {}) {
  securitySettingsState.loading = true;
  refreshChatControls();
  try {
    const security = await fetchSecuritySettings();
    applySecuritySettingsState(security);
    refreshChatControls();
    return security;
  } catch (error) {
    if (!silent) {
      showSettingsHint(`加载安全模式失败：${error.message}`);
    }
    throw error;
  } finally {
    securitySettingsState.loading = false;
    refreshChatControls();
  }
}

async function applySecuritySelection(mode) {
  const nextMode = String(mode || "").trim();
  if (!nextMode || nextMode === securitySettingsState.mode) {
    return;
  }
  try {
    const response = await fetch("/api/settings/security", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: nextMode,
      }),
    });
    if (!response.ok) {
      throw new Error(await extractErrorMessage(response));
    }
    const payload = await response.json();
    applySecuritySettingsState(payload?.security || {});
    refreshChatControls();
    showSettingsHint(`安全模式已切到“${securitySettingsState.mode_label || nextMode}”。`);
  } catch (error) {
    console.error("Failed to switch security mode:", error);
    showSettingsHint(`切换安全模式失败：${error.message}`);
  }
}

function normalizeSlashCommandItem(item) {
  if (!item || typeof item !== "object") {
    return null;
  }
  const command = String(item.command || "").trim().replace(/^\/+/, "");
  if (!command) {
    return null;
  }
  return {
    command,
    name: String(item.name || command).trim() || command,
    description: String(item.description || "").trim(),
    path: String(item.path || "").trim(),
    source: String(item.source || "skill").trim() || "skill",
  };
}

async function loadSlashCommands() {
  const response = await fetch("/api/knowledge-base/slash-commands");
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.detail || `HTTP ${response.status}`);
  }
  availableSlashCommands = Array.isArray(payload?.items)
    ? payload.items.map(normalizeSlashCommandItem).filter(Boolean)
    : [];
}

function closeSlashPanel() {
  slashPanelVisible = false;
  slashPanelManual = false;
  slashPanelActiveIndex = 0;
  slashPanelEl?.classList.add("hidden");
  if (slashListEl) {
    slashListEl.innerHTML = "";
  }
  slashButtonEl?.setAttribute("aria-expanded", "false");
}

function getSlashContext() {
  if (!inputEl) {
    return null;
  }
  const selectionStart = Number(inputEl.selectionStart ?? inputEl.value.length);
  const textBeforeCursor = inputEl.value.slice(0, selectionStart);
  const match = textBeforeCursor.match(/(^|\s)\/([a-z0-9-]*)$/i);
  if (!match) {
    return null;
  }
  const query = String(match[2] || "").toLowerCase();
  return {
    query,
    replaceFrom: selectionStart - query.length - 1,
    replaceTo: selectionStart,
  };
}

function filteredSlashCommands() {
  const context = getSlashContext();
  const query = slashPanelManual ? (context?.query || "") : (context?.query || "");
  if (!query) {
    return availableSlashCommands;
  }
  return availableSlashCommands.filter((item) => {
    const haystacks = [
      item.command,
      item.name,
      item.description,
    ].map((value) => String(value || "").toLowerCase());
    return haystacks.some((value) => value.includes(query));
  });
}

function groupedSlashCommands(items) {
  return [
    ["Skills", items.filter((item) => item.source !== "schema")],
    ["Schemas", items.filter((item) => item.source === "schema")],
  ].filter(([, groupItems]) => groupItems.length);
}

function renderSlashPanel() {
  if (!slashPanelEl || !slashListEl) {
    return;
  }
  const items = filteredSlashCommands();
  slashListEl.innerHTML = "";

  if (!slashPanelVisible) {
    slashPanelEl.classList.add("hidden");
    slashButtonEl?.setAttribute("aria-expanded", "false");
    return;
  }

  slashPanelEl.classList.remove("hidden");
  slashButtonEl?.setAttribute("aria-expanded", "true");

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "chat-slash-empty";
    empty.textContent = availableSlashCommands.length
      ? "没有匹配到 slash 命令。"
      : "当前知识库还没有可用的 skills 或 schemas。";
    slashListEl.appendChild(empty);
    return;
  }

  slashPanelActiveIndex = Math.max(0, Math.min(slashPanelActiveIndex, items.length - 1));

  let absoluteIndex = 0;
  groupedSlashCommands(items).forEach(([label, groupItems]) => {
    const groupLabel = document.createElement("div");
    groupLabel.className = "chat-slash-group-label";
    groupLabel.textContent = label;
    slashListEl.appendChild(groupLabel);

    groupItems.forEach((item) => {
      const index = absoluteIndex;
      absoluteIndex += 1;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "chat-slash-item";
      button.classList.toggle("active", index === slashPanelActiveIndex);
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(index === slashPanelActiveIndex));

      const command = document.createElement("div");
      command.className = "chat-slash-item-command";

      const badge = document.createElement("span");
      badge.className = `chat-slash-badge ${item.source === "schema" ? "schema" : "skill"}`;
      badge.textContent = item.source === "schema" ? "Schema" : "Skill";

      const commandText = document.createElement("span");
      commandText.textContent = `/${item.command}`;

      const description = document.createElement("div");
      description.className = "chat-slash-item-description";
      description.textContent = item.description || item.path || item.name;

      command.appendChild(badge);
      command.appendChild(commandText);
      button.appendChild(command);
      button.appendChild(description);
      button.addEventListener("mousedown", (event) => {
        event.preventDefault();
      });
      button.addEventListener("click", () => {
        applySlashCommand(item);
      });
      slashListEl.appendChild(button);
    });
  });

  const activeItem = slashListEl.querySelector(".chat-slash-item.active");
  if (activeItem instanceof HTMLElement) {
    activeItem.scrollIntoView({ block: "nearest" });
  }
}

function openSlashPanel({ manual = false } = {}) {
  slashPanelVisible = true;
  slashPanelManual = Boolean(manual);
  slashPanelActiveIndex = 0;
  renderSlashPanel();
}

function refreshSlashPanelFromInput() {
  const hasContext = Boolean(getSlashContext());
  if (hasContext) {
    slashPanelVisible = true;
    slashPanelManual = false;
    slashPanelActiveIndex = 0;
    renderSlashPanel();
    return;
  }
  if (slashPanelManual && slashPanelVisible) {
    renderSlashPanel();
    return;
  }
  closeSlashPanel();
}

function insertTextAtCursor(text) {
  if (!inputEl) {
    return;
  }
  const start = Number(inputEl.selectionStart ?? inputEl.value.length);
  const end = Number(inputEl.selectionEnd ?? start);
  inputEl.setRangeText(text, start, end, "end");
  inputEl.dispatchEvent(new Event("input", { bubbles: true }));
  refreshChatPendingState();
  focusChatInput();
}

function applySlashCommand(item) {
  if (!inputEl || !item) {
    return;
  }
  const text = `/${item.command} `;
  const context = getSlashContext();
  if (context) {
    inputEl.setRangeText(text, context.replaceFrom, context.replaceTo, "end");
    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    refreshChatPendingState();
    closeSlashPanel();
    focusChatInput();
    return;
  }
  insertTextAtCursor(text);
  closeSlashPanel();
}

function handleSlashPanelKeydown(event) {
  if (!slashPanelVisible) {
    return false;
  }
  const items = filteredSlashCommands();
  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (items.length) {
      slashPanelActiveIndex = (slashPanelActiveIndex + 1) % items.length;
      renderSlashPanel();
    }
    return true;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    if (items.length) {
      slashPanelActiveIndex = (slashPanelActiveIndex - 1 + items.length) % items.length;
      renderSlashPanel();
    }
    return true;
  }
  if ((event.key === "Enter" || event.key === "Tab") && items.length) {
    event.preventDefault();
    applySlashCommand(items[slashPanelActiveIndex] || items[0]);
    return true;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    closeSlashPanel();
    return true;
  }
  return false;
}

function formatInboxFileSize(sizeBytes) {
  const size = Number(sizeBytes || 0);
  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(size >= 10 * 1024 ? 0 : 1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function formatInboxModifiedAt(rawValue) {
  const text = String(rawValue || "").trim();
  if (!text) {
    return "";
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return text;
  }
  return date.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function setInboxFeedback(message, isError = false) {
  if (!inboxPanelFeedbackEl) {
    return;
  }
  if (!message) {
    inboxPanelFeedbackEl.textContent = "";
    inboxPanelFeedbackEl.classList.add("hidden");
    inboxPanelFeedbackEl.style.color = "";
    return;
  }
  inboxPanelFeedbackEl.textContent = message;
  inboxPanelFeedbackEl.classList.remove("hidden");
  inboxPanelFeedbackEl.style.color = isError ? "#b1532f" : "#185c52";
}

function inboxStatusLabel(file) {
  if (inboxDeletingPaths.has(file.path)) {
    return "删除中";
  }
  return String(file.status_label || "待 ingest");
}

function renderInboxPanel() {
  if (toggleInboxPanelButtonEl) {
    toggleInboxPanelButtonEl.setAttribute("aria-expanded", String(inboxPanelOpen));
  }
  if (inboxPanelEl) {
    inboxPanelEl.classList.toggle("hidden", !inboxPanelOpen);
  }
  if (inboxCountBadgeEl) {
    inboxCountBadgeEl.textContent = String(inboxFiles.length);
  }
  if (refreshInboxPanelButtonEl) {
    refreshInboxPanelButtonEl.disabled = inboxLoading || isUploadingInboxFile;
  }
  if (ingestInboxPanelButtonEl) {
    ingestInboxPanelButtonEl.disabled = inboxLoading || isUploadingInboxFile || inboxFiles.length === 0;
  }
  if (!inboxFileListEl || !inboxFileEmptyEl) {
    return;
  }

  inboxFileListEl.innerHTML = "";
  if (inboxLoading) {
    const loading = document.createElement("p");
    loading.className = "inbox-file-empty";
    loading.textContent = "正在读取当前知识库的 inbox...";
    inboxFileListEl.appendChild(loading);
    inboxFileEmptyEl.classList.add("hidden");
    return;
  }

  if (!inboxFiles.length) {
    inboxFileEmptyEl.classList.remove("hidden");
    return;
  }
  inboxFileEmptyEl.classList.add("hidden");

  inboxFiles.forEach((file) => {
    const card = document.createElement("article");
    card.className = "inbox-file-card";
    if (highlightedInboxPath && highlightedInboxPath === file.path) {
      card.classList.add("is-highlighted");
    }

    const main = document.createElement("div");
    main.className = "inbox-file-main";

    const top = document.createElement("div");
    top.className = "inbox-file-top";

    const name = document.createElement("p");
    name.className = "inbox-file-name";
    name.textContent = file.name || file.path || "未命名文件";

    const status = document.createElement("span");
    status.className = "inbox-file-status";
    status.textContent = inboxStatusLabel(file);

    top.appendChild(name);
    top.appendChild(status);
    main.appendChild(top);

    const meta = document.createElement("div");
    meta.className = "inbox-file-meta";
    [file.type_label, formatInboxFileSize(file.size_bytes), formatInboxModifiedAt(file.modified_at)]
      .filter(Boolean)
      .forEach((label) => {
        const chip = document.createElement("span");
        chip.className = "inbox-file-chip";
        chip.textContent = label;
        meta.appendChild(chip);
      });
    main.appendChild(meta);

    const path = document.createElement("p");
    path.className = "inbox-file-path";
    path.textContent = file.path || "";
    main.appendChild(path);

    const actions = document.createElement("div");
    actions.className = "inbox-file-actions";

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "button button-danger-subtle";
    deleteButton.textContent = inboxDeletingPaths.has(file.path) ? "删除中..." : "删除";
    deleteButton.disabled = inboxDeletingPaths.has(file.path);
    deleteButton.addEventListener("click", async () => {
      await deleteInboxFile(file);
    });

    actions.appendChild(deleteButton);
    card.appendChild(main);
    card.appendChild(actions);
    inboxFileListEl.appendChild(card);
  });
}

function openInboxPanel() {
  inboxPanelOpen = true;
  renderInboxPanel();
}

function closeInboxPanel() {
  inboxPanelOpen = false;
  renderInboxPanel();
}

function shouldIgnoreInboxOutsideDismiss(target) {
  return Boolean(
    target.closest("#inbox-panel") ||
      target.closest("#toggle-inbox-panel")
  );
}

async function fetchInboxFiles() {
  const response = await fetch("/api/knowledge-base/inbox/files");
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }
  return response.json();
}

async function refreshInboxFiles({ open = false, highlightPath = "" } = {}) {
  inboxLoading = true;
  if (highlightPath) {
    highlightedInboxPath = highlightPath;
  }
  if (open) {
    inboxPanelOpen = true;
  }
  renderInboxPanel();

  try {
    const payload = await fetchInboxFiles();
    inboxFiles = Array.isArray(payload?.items) ? payload.items : [];
    setInboxFeedback("");
  } catch (error) {
    console.error("Failed to load inbox files:", error);
    setInboxFeedback(`Inbox 读取失败：${error.message}`, true);
  } finally {
    inboxLoading = false;
    renderInboxPanel();
  }
}

function canUploadInboxFiles() {
  const isPendingForCurrent = Boolean(currentSessionId && pendingSessionIds.has(currentSessionId));
  const isAbortingCurrent = Boolean(currentSessionId && abortingSessionIds.has(currentSessionId));
  return !isUploadingInboxFile && !isPendingForCurrent && !isAbortingCurrent;
}

function getDroppedFiles(fileList) {
  return Array.from(fileList || []).filter((file) => file && typeof file.name === "string");
}

async function uploadInboxFiles(fileList) {
  const files = getDroppedFiles(fileList);
  if (!files.length) {
    return;
  }
  if (!canUploadInboxFiles()) {
    openInboxPanel();
    setInboxFeedback("当前状态下暂时不能上传文件，请等本轮回复结束后再试。", true);
    showSettingsHint("当前暂时不能上传文件");
    return;
  }

  isUploadingInboxFile = true;
  inboxPanelOpen = true;
  renderInboxPanel();
  refreshChatControls();

  const uploadedPaths = [];
  const failedFiles = [];

  try {
    for (const [index, file] of files.entries()) {
      setInboxFeedback(`正在上传 ${index + 1}/${files.length}：${file.name}`);
      try {
        const payload = await postInboxUpload(file);
        const filePath = String(payload?.file?.path || file.name || "inbox/未命名文件");
        uploadedPaths.push(filePath);
      } catch (error) {
        console.error("Failed to upload inbox file:", error);
        failedFiles.push(`${file.name}：${error.message}`);
      }
    }

    highlightedInboxPath = uploadedPaths[uploadedPaths.length - 1] || "";
    await refreshInboxFiles({ open: true, highlightPath: highlightedInboxPath });
    const successCount = uploadedPaths.length;
    if (failedFiles.length) {
      const failureSummary = `失败 ${failedFiles.length} 个。`;
      const detail = ` ${failedFiles.join("；")}`;
      setInboxFeedback(`${failureSummary}${detail}`.trim(), true);
      showSettingsHint("上传失败，请查看 Inbox 面板");
    } else if (successCount > 0) {
      setInboxFeedback("");
    }
  } catch (error) {
    console.error("Failed to upload inbox file batch:", error);
    openInboxPanel();
    setInboxFeedback(`上传文件失败：${error.message}`, true);
    showSettingsHint("上传失败，请查看 Inbox 面板");
  } finally {
    isUploadingInboxFile = false;
    if (uploadInputEl) {
      uploadInputEl.value = "";
    }
    refreshChatControls();
    renderInboxPanel();
  }
}

async function postInboxUpload(file) {
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
  return response.json();
}

async function deleteInboxFile(file) {
  const filePath = String(file?.path || "").trim();
  if (!filePath || inboxDeletingPaths.has(filePath)) {
    return;
  }
  if (!window.confirm(`确认从 inbox 删除 ${filePath} 吗？`)) {
    return;
  }

  inboxDeletingPaths.add(filePath);
  renderInboxPanel();
  setInboxFeedback(`正在删除 ${filePath}...`);

  try {
    const url = new URL("/api/knowledge-base/inbox/files", window.location.origin);
    url.searchParams.set("path", filePath);
    const response = await fetch(url.toString(), {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(await extractErrorMessage(response));
    }

    if (highlightedInboxPath === filePath) {
      highlightedInboxPath = "";
    }
    inboxFiles = inboxFiles.filter((item) => item.path !== filePath);
    setInboxFeedback("");
  } catch (error) {
    console.error("Failed to delete inbox file:", error);
    setInboxFeedback(`删除失败：${error.message}`, true);
  } finally {
    inboxDeletingPaths.delete(filePath);
    renderInboxPanel();
  }
}

function closeChatControlMenus() {
  openChatControlMenu = null;
  modelMenuEl?.classList.add("hidden");
  thinkingMenuEl?.classList.add("hidden");
  securityMenuEl?.classList.add("hidden");
  modelButtonEl?.parentElement?.classList.remove("is-open");
  thinkingButtonEl?.parentElement?.classList.remove("is-open");
  securityButtonEl?.parentElement?.classList.remove("is-open");
  modelButtonEl?.setAttribute("aria-expanded", "false");
  thinkingButtonEl?.setAttribute("aria-expanded", "false");
  securityButtonEl?.setAttribute("aria-expanded", "false");
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
      item.appendChild(createMenuItemText(model.label, modelMenuDetail(model)));
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
      const levelLabel = THINKING_LEVEL_LABELS[level] || level;
      const detailParts = [THINKING_LEVEL_DESCRIPTIONS[level] || ""];
      if (!isThinkingLevelSupported(level)) {
        detailParts.push("当前模型暂不支持。");
      }
      item.appendChild(createMenuItemText(levelLabel, detailParts.filter(Boolean).join(" ")));
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

  if (securityMenuEl) {
    securityMenuEl.innerHTML = "";
    const modes = Array.isArray(securitySettingsState.available_modes) ? securitySettingsState.available_modes : [];
    modes.forEach((mode) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "chat-control-menu-item";
      if (mode.id === securitySettingsState.mode) {
        item.classList.add("active");
      }
      item.appendChild(createMenuItemText(mode.label, mode.description));

      item.addEventListener("click", async () => {
        closeChatControlMenus();
        await applySecuritySelection(mode.id);
      });
      securityMenuEl.appendChild(item);
    });
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
  if (securityButtonEl) {
    const buttonText = currentSecurityModeText();
    const modeDescription = securitySettingsState.mode_description || securitySettingsState.boundary_note || "切换当前 Pi 安全模式";
    securityButtonEl.textContent = buttonText;
    securityButtonEl.title = modeDescription;
    securityButtonEl.setAttribute(
      "aria-label",
      securitySettingsState.mode_label
        ? `当前安全模式：${securitySettingsState.mode_label}`
        : "当前安全模式"
    );
    securityButtonEl.disabled =
      disabled ||
      securitySettingsState.loading ||
      !Array.isArray(securitySettingsState.available_modes) ||
      securitySettingsState.available_modes.length === 0;
  }
  if (uploadButtonEl) {
    uploadButtonEl.disabled = disabled || isUploadingInboxFile;
  }

  renderChatControlMenus();
  refreshChatContextIndicator();
  refreshSettingsHintState();
}

function toggleChatControlMenu(name) {
  const nextMenu = openChatControlMenu === name ? null : name;
  openChatControlMenu = nextMenu;
  modelMenuEl?.classList.toggle("hidden", nextMenu !== "model");
  thinkingMenuEl?.classList.toggle("hidden", nextMenu !== "thinking");
  securityMenuEl?.classList.toggle("hidden", nextMenu !== "security");
  modelButtonEl?.parentElement?.classList.toggle("is-open", nextMenu === "model");
  thinkingButtonEl?.parentElement?.classList.toggle("is-open", nextMenu === "thinking");
  securityButtonEl?.parentElement?.classList.toggle("is-open", nextMenu === "security");
  modelButtonEl?.setAttribute("aria-expanded", String(nextMenu === "model"));
  thinkingButtonEl?.setAttribute("aria-expanded", String(nextMenu === "thinking"));
  securityButtonEl?.setAttribute("aria-expanded", String(nextMenu === "security"));
  if (nextMenu) {
    renderChatControlMenus();
  }
}

function setSecurityDecisionSubmittingState(isSubmitting) {
  securityDecisionSubmitting = Boolean(isSubmitting);
  if (securityApproveButtonEl) {
    securityApproveButtonEl.disabled =
      securityDecisionSubmitting || !activeSecurityIntervention?.canRequestApproval;
  }
  if (securityDenyButtonEl) {
    securityDenyButtonEl.disabled = securityDecisionSubmitting;
  }
  if (securityCloseButtonEl) {
    securityCloseButtonEl.disabled = securityDecisionSubmitting;
  }
  if (securitySteerInputEl) {
    securitySteerInputEl.disabled = securityDecisionSubmitting;
  }
}

function parseSecurityUiDescriptor(rawTitle) {
  const title = String(rawTitle || "").trim();
  if (!title.startsWith(SECURITY_UI_TITLE_PREFIX)) {
    return null;
  }
  const body = title.slice(SECURITY_UI_TITLE_PREFIX.length);
  const separatorIndex = body.indexOf(":");
  if (separatorIndex <= 0) {
    return null;
  }
  const phase = body.slice(0, separatorIndex).trim();
  const payloadText = body.slice(separatorIndex + 1).trim();
  if (!phase || !payloadText) {
    return null;
  }
  try {
    const payload = JSON.parse(payloadText);
    return payload && typeof payload === "object"
      ? { phase, payload }
      : null;
  } catch (_error) {
    return null;
  }
}

function buildSecurityInterventionFromUiRequest(request, sessionId = "") {
  if (!request || typeof request !== "object") {
    return null;
  }
  const parsed = parseSecurityUiDescriptor(request.title);
  if (!parsed) {
    return null;
  }
  const payload = parsed.payload && typeof parsed.payload === "object" ? parsed.payload : {};
  const toolName = String(payload.tool_name || "").trim().toLowerCase() || "tool";
  const command = String(payload.command || "").trim();
  const rawPath = String(payload.path || "").trim();
  const resolvedPath = String(payload.resolved_path || payload.resolvedPath || "").trim();
  const preview =
    toolName === "bash"
      ? (command || "Pi 准备执行一条 bash 命令。")
      : (resolvedPath || rawPath || "Pi 准备修改一个文件。");
  const canRequestApproval = parsed.phase === "decision";
  const modeLabel = String(
    payload.current_mode_label || securitySettingsState.mode_label || securitySettingsState.mode || "当前安全模式"
  ).trim();
  const reason = String(payload.message || "该操作已被安全限制阻止。").trim();
  const requestId = String(request.id || "").trim();
  if (!reason || !requestId) {
    return null;
  }

  return {
    id: `${String(sessionId || "").trim()}:${requestId}:${parsed.phase}`,
    sessionId: String(sessionId || currentStreamingSessionId || currentSessionId || "").trim(),
    requestId,
    requestMethod: String(request.method || "").trim(),
    phase: parsed.phase,
    toolName,
    command,
    path: rawPath,
    resolvedPath,
    preview,
    reason,
    modeLabel,
    canRequestApproval,
    blockCategory: String(payload.block_category || "").trim(),
  };
}

function renderSecurityInterventionModal() {
  const intervention = activeSecurityIntervention;
  const isDecisionPhase = intervention?.phase === "decision";
  const canApprove = Boolean(isDecisionPhase && intervention?.canRequestApproval);
  if (!intervention || !securityModalEl) {
    securityModalEl?.classList.add("hidden");
    securityModalEl?.setAttribute("aria-hidden", "true");
    return;
  }

  if (securityModalTitleEl) {
    securityModalTitleEl.textContent = isDecisionPhase
      ? "这次操作被当前安全模式拦住了"
      : "告诉 Pi 为什么不能这样做";
  }
  securityModalModeEl && (securityModalModeEl.textContent = intervention.modeLabel || "当前安全模式");
  securityModalApprovalEl &&
    (securityModalApprovalEl.textContent = canApprove ? "会放行当前这次调用" : "这次会保持禁止");
  securityModalCommandEl && (securityModalCommandEl.textContent = intervention.preview || "—");
  securityModalReasonEl && (securityModalReasonEl.textContent = intervention.reason || "—");
  if (securitySteerInputEl) {
    if (!securityDecisionSubmitting) {
      securitySteerInputEl.value = "";
    }
  }
  if (securityApproveButtonEl) {
    securityApproveButtonEl.hidden = !canApprove;
    securityApproveButtonEl.textContent = "允许这一次";
    securityApproveButtonEl.disabled = !canApprove || securityDecisionSubmitting;
  }
  if (securityDenyButtonEl) {
    securityDenyButtonEl.textContent = isDecisionPhase ? "禁止并告知 Pi" : "发送理由并保持禁止";
  }
  setSecurityModalFeedback("");
  setSecurityDecisionSubmittingState(false);
  securityModalEl.classList.remove("hidden");
  securityModalEl.setAttribute("aria-hidden", "false");
  window.setTimeout(() => {
    if (canApprove) {
      securityApproveButtonEl?.focus();
      return;
    }
    securitySteerInputEl?.focus();
  }, 0);
}

function openNextSecurityIntervention() {
  if (activeSecurityIntervention || !securityInterventionQueue.length) {
    return;
  }
  activeSecurityIntervention = securityInterventionQueue.shift() || null;
  renderSecurityInterventionModal();
}

function discardQueuedSecurityInterventions(sessionId) {
  if (!sessionId) {
    return;
  }
  pendingSecurityDenyReasons.delete(sessionId);
  for (let index = securityInterventionQueue.length - 1; index >= 0; index -= 1) {
    if (securityInterventionQueue[index]?.sessionId === sessionId) {
      securityInterventionQueue.splice(index, 1);
    }
  }
}

function closeActiveSecurityIntervention({ openNext = true } = {}) {
  activeSecurityIntervention = null;
  setSecurityModalFeedback("");
  setSecurityDecisionSubmittingState(false);
  securityModalEl?.classList.add("hidden");
  securityModalEl?.setAttribute("aria-hidden", "true");
  if (openNext) {
    openNextSecurityIntervention();
  }
}

function enqueueSecurityIntervention(request, sessionId = "") {
  const intervention = buildSecurityInterventionFromUiRequest(request, sessionId);
  if (!intervention) {
    return;
  }
  const duplicated =
    activeSecurityIntervention?.id === intervention.id ||
    securityInterventionQueue.some((queued) => queued?.id === intervention.id);
  if (duplicated) {
    return;
  }
  securityInterventionQueue.push(intervention);
  openNextSecurityIntervention();
}

async function sendSessionExtensionUiResponse(sessionId, payload) {
  const targetSessionId = String(sessionId || "").trim();
  if (!targetSessionId) {
    throw new Error("缺少当前会话 ID，无法回写 Pi 交互结果。");
  }
  const response = await fetch(`/api/sessions/${encodeURIComponent(targetSessionId)}/extension-ui-response`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }
  return response.json();
}

async function handleIncomingExtensionUiRequest(request, sessionId = "") {
  const targetSessionId = String(sessionId || currentStreamingSessionId || currentSessionId || "").trim();
  const intervention = buildSecurityInterventionFromUiRequest(request, targetSessionId);
  if (!intervention) {
    if (targetSessionId && request?.id) {
      try {
        await sendSessionExtensionUiResponse(targetSessionId, {
          id: String(request.id || "").trim(),
          cancelled: true,
        });
      } catch (error) {
        console.error("Failed to auto-cancel unsupported extension UI request:", error);
      }
    }
    showSettingsHint("收到暂不支持的 Pi 交互请求，已自动取消。");
    return;
  }

  if (intervention.phase === "deny_reason") {
    const cachedReason = String(pendingSecurityDenyReasons.get(targetSessionId) || "").trim();
    if (cachedReason) {
      pendingSecurityDenyReasons.delete(targetSessionId);
      try {
        await sendSessionExtensionUiResponse(targetSessionId, {
          id: intervention.requestId,
          value: cachedReason,
        });
        if (
          activeSecurityIntervention?.sessionId === targetSessionId &&
          activeSecurityIntervention?.phase === "decision"
        ) {
          closeActiveSecurityIntervention();
        }
        return;
      } catch (error) {
        console.error("Failed to auto-submit security deny reason:", error);
        pendingSecurityDenyReasons.set(targetSessionId, cachedReason);
        if (
          activeSecurityIntervention?.sessionId === targetSessionId &&
          activeSecurityIntervention?.phase === "decision"
        ) {
          setSecurityDecisionSubmittingState(false);
          setSecurityModalFeedback(`发送禁止理由失败：${error.message}`);
        } else {
          showSettingsHint(`发送禁止理由失败：${error.message}`);
        }
      }
    }
  }

  enqueueSecurityIntervention(request, targetSessionId);
}

async function dismissActiveSecurityIntervention() {
  const intervention = activeSecurityIntervention;
  if (!intervention || securityDecisionSubmitting) {
    return;
  }
  setSecurityDecisionSubmittingState(true);
  setSecurityModalFeedback("正在取消这次安全确认。", false);
  try {
    pendingSecurityDenyReasons.delete(intervention.sessionId);
    await sendSessionExtensionUiResponse(intervention.sessionId, {
      id: intervention.requestId,
      cancelled: true,
    });
    closeActiveSecurityIntervention();
  } catch (error) {
    console.error("Failed to cancel security intervention:", error);
    if (activeSecurityIntervention?.id === intervention.id) {
      setSecurityDecisionSubmittingState(false);
      setSecurityModalFeedback(`取消失败：${error.message}`);
    } else {
      showSettingsHint(`取消失败：${error.message}`);
    }
  }
}

async function handleSecurityApproval() {
  const intervention = activeSecurityIntervention;
  if (!intervention || intervention.phase !== "decision" || !intervention.canRequestApproval || securityDecisionSubmitting) {
    return;
  }
  setSecurityDecisionSubmittingState(true);
  setSecurityModalFeedback("正在允许当前工具调用继续。", false);
  try {
    pendingSecurityDenyReasons.delete(intervention.sessionId);
    await sendSessionExtensionUiResponse(intervention.sessionId, {
      id: intervention.requestId,
      value: "allow_once",
    });
    discardQueuedSecurityInterventions(intervention.sessionId);
    closeActiveSecurityIntervention();
  } catch (error) {
    console.error("Failed to approve inline security request:", error);
    if (activeSecurityIntervention?.id === intervention.id) {
      setSecurityDecisionSubmittingState(false);
      setSecurityModalFeedback(`允许失败：${error.message}`);
    } else {
      showSettingsHint(`允许失败：${error.message}`);
    }
  }
}

async function handleSecurityDeny() {
  const intervention = activeSecurityIntervention;
  if (!intervention || securityDecisionSubmitting) {
    return;
  }
  const steerReason = String(securitySteerInputEl?.value || "").trim();
  if (!steerReason) {
    setSecurityModalFeedback("请输入禁止原因，我会把它直接转成对 Pi 的约束。");
    securitySteerInputEl?.focus();
    return;
  }
  setSecurityDecisionSubmittingState(true);
  setSecurityModalFeedback("正在把禁止理由发给 Pi。", false);
  try {
    if (intervention.phase === "decision") {
      pendingSecurityDenyReasons.set(intervention.sessionId, steerReason);
      await sendSessionExtensionUiResponse(intervention.sessionId, {
        id: intervention.requestId,
        value: "deny_with_reason",
      });
      return;
    }
    await sendSessionExtensionUiResponse(intervention.sessionId, {
      id: intervention.requestId,
      value: steerReason,
    });
    pendingSecurityDenyReasons.delete(intervention.sessionId);
    discardQueuedSecurityInterventions(intervention.sessionId);
    closeActiveSecurityIntervention();
  } catch (error) {
    console.error("Failed to deny inline security request:", error);
    pendingSecurityDenyReasons.delete(intervention.sessionId);
    if (activeSecurityIntervention?.id === intervention.id) {
      setSecurityDecisionSubmittingState(false);
      setSecurityModalFeedback(`禁止失败：${error.message}`);
    } else {
      showSettingsHint(`禁止失败：${error.message}`);
    }
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

function normalizeHistoryTurn(item) {
  const role = item?.role === "assistant" ? "assistant" : "user";
  const normalized = {
    role,
    content: String(item?.content || ""),
  };
  if (Array.isArray(item?.consulted_pages)) {
    normalized.consulted_pages = item.consulted_pages
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => ({
        title: String(entry.title || entry.path || "").trim(),
        path: String(entry.path || "").trim(),
        source: String(entry.source || "wiki").trim() || "wiki",
      }))
      .filter((entry) => entry.path);
  }
  if (Array.isArray(item?.trace)) {
    normalized.trace = item.trace.filter((entry) => entry && typeof entry === "object");
  }
  if (Array.isArray(item?.warnings)) {
    normalized.warnings = item.warnings
      .map((entry) => String(entry || "").trim())
      .filter(Boolean);
  }
  if (item?.stopped) {
    normalized.stopped = true;
  }
  return normalized;
}

function upsertAssistantTurn(targetHistory, content, extras = {}) {
  const aiContent = String(content || "").trim();
  if (!aiContent) {
    return;
  }

  const lastMsg = targetHistory[targetHistory.length - 1];
  if (lastMsg && lastMsg.role === "assistant") {
    lastMsg.content = aiContent;
    lastMsg.consulted_pages = Array.isArray(extras.consulted_pages) ? extras.consulted_pages : [];
    lastMsg.trace = Array.isArray(extras.trace) ? extras.trace : [];
    lastMsg.warnings = Array.isArray(extras.warnings) ? extras.warnings : [];
    lastMsg.stopped = Boolean(extras.stopped);
    return;
  }

  targetHistory.push(
    normalizeHistoryTurn({
      role: "assistant",
      content: aiContent,
      consulted_pages: extras.consulted_pages,
      trace: extras.trace,
      warnings: extras.warnings,
      stopped: extras.stopped,
    })
  );
}

function clearMessages({ refreshNavigation = true } = {}) {
  if (!messagesEl) {
    return;
  }
  messagesEl.innerHTML = "";
  questionAnchorsCache = [];
  questionMarkerEls = [];
  questionItemEls = [];
  if (refreshNavigation) {
    refreshChatNavigation({ structureChanged: true });
  }
}

function setSessionHasOlderHistory(sessionId, hasOlder) {
  if (!sessionId) {
    return;
  }
  sessionHistoryHasOlder.set(sessionId, Boolean(hasOlder));
}

function currentSessionHasOlderHistory() {
  if (!currentSessionId) {
    return false;
  }
  return Boolean(sessionHistoryHasOlder.get(currentSessionId));
}

function refreshLoadOlderButton() {
  if (!loadOlderButtonEl) {
    return;
  }
  const visible = Boolean(currentSessionId) && currentSessionHasOlderHistory();
  loadOlderButtonEl.classList.toggle("hidden", !visible);
  loadOlderButtonEl.disabled = !visible || isLoadingOlderHistory;
  loadOlderButtonEl.textContent = isLoadingOlderHistory ? "正在加载更早消息…" : "加载更早消息";
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
  clearMessages({ refreshNavigation: false });
  messagesEl.append(...nodes);
  rebuildQuestionAnchorsFromDom();
  scrollMessagesToBottom(true);
  refreshChatNavigation({ structureChanged: true });
  return true;
}

function createMessageElement(role, content, consultedPages = [], trace = [], warnings = []) {
  const wrapper = document.createElement("article");
  wrapper.className = `message message-${role}`;
  if (role === "user") {
    wrapper.dataset.questionAnchor = "true";
    wrapper.dataset.questionLabel = summarizeQuestionLabel(content);
  }

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

  if (role === "assistant") {
    wrapper.appendChild(createAssistantActions(() => content));
  }

  return wrapper;
}

async function renderHistory(messages) {
  if (!messagesEl || !Array.isArray(messages) || !messages.length) {
    return;
  }

  const renderedQuestionAnchors = [];
  for (let index = 0; index < messages.length; index += SESSION_HISTORY_RENDER_BATCH_SIZE) {
    const fragment = document.createDocumentFragment();
    const chunk = messages.slice(index, index + SESSION_HISTORY_RENDER_BATCH_SIZE);
    chunk.forEach((msg) => {
      const element = createMessageElement(
        msg.role,
        msg.content,
        msg.consulted_pages || [],
        msg.trace || [],
        msg.warnings || []
      );
      if (msg.role === "user") {
        renderedQuestionAnchors.push(element);
      }
      fragment.appendChild(element);
    });
    messagesEl.appendChild(fragment);
    if (index + SESSION_HISTORY_RENDER_BATCH_SIZE < messages.length) {
      await nextAnimationFrame();
    }
  }
  setQuestionAnchors(renderedQuestionAnchors);
  scrollMessagesToBottom(true);
  storeCurrentSessionView();
  refreshChatNavigation({ structureChanged: true });
}

async function prependHistory(messages) {
  if (!messagesEl || !Array.isArray(messages) || !messages.length) {
    return;
  }

  const previousScrollTop = messagesEl.scrollTop;
  const previousScrollHeight = messagesEl.scrollHeight;
  const fragment = document.createDocumentFragment();
  messages.forEach((msg) => {
    fragment.appendChild(
      createMessageElement(
        msg.role,
        msg.content,
        msg.consulted_pages || [],
        msg.trace || [],
        msg.warnings || []
      )
    );
  });
  messagesEl.prepend(fragment);
  rebuildQuestionAnchorsFromDom();
  refreshChatNavigation({ structureChanged: true });
  const nextScrollHeight = messagesEl.scrollHeight;
  messagesEl.scrollTop = previousScrollTop + (nextScrollHeight - previousScrollHeight);
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
      upsertAssistantTurn(targetHistory, aiContent, {
        consulted_pages: currentStreamingMessage.getConsultedPages?.() || [],
        trace: currentStreamingMessage.getTraceSnapshot?.() || [],
        warnings: currentStreamingMessage.getWarnings?.() || [],
      });
    }
  }

  sessionHistories.set(currentSessionId, targetHistory);
  history = targetHistory;
}

function loadSessionHistory(sessionId) {
  return ensureSessionHistory(sessionId);
}

async function hydrateSessionHistoryFromStore(sessionId) {
  return hydrateSessionHistoryPage(sessionId, {
    limit: SESSION_INITIAL_RENDER_LIMIT,
    offset: 0,
    prepend: false,
  });
}

async function fetchSessionHistoryPage(sessionId, { limit, offset = 0 } = {}) {
  const safeSessionId = encodeURIComponent(sessionId);
  const response = await fetch(`/api/sessions/${safeSessionId}/history?limit=${limit}&offset=${offset}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function hydrateSessionHistoryPage(
  sessionId,
  {
    limit = SESSION_INITIAL_RENDER_LIMIT,
    offset = 0,
    prepend = false,
  } = {}
) {
  if (!sessionId) {
    return ensureSessionHistory(sessionId);
  }

  const targetHistory = ensureSessionHistory(sessionId);
  if (!prepend && (targetHistory.length > 0 || hydratedSessionIds.has(sessionId))) {
    return targetHistory;
  }

  try {
    const data = await fetchSessionHistoryPage(sessionId, { limit, offset });
    const replayed = Array.isArray(data.history) ? data.history : [];
    const pageTurns = [];
    if (replayed.length > 0) {
      replayed.forEach((item) => {
        if (!item || typeof item !== "object") {
          return;
        }
        const turn = normalizeHistoryTurn(item);
        if (!turn.content.trim()) {
          return;
        }
        pageTurns.push(turn);
      });
      if (prepend) {
        targetHistory.unshift(...pageTurns);
      } else {
        targetHistory.length = 0;
        targetHistory.push(...pageTurns);
      }
      sessionHistories.set(sessionId, targetHistory);
    }
    setSessionHasOlderHistory(sessionId, Boolean(data?.has_more));
    if (!prepend) {
      hydratedSessionIds.add(sessionId);
    }
  } catch (error) {
    console.warn("Failed to hydrate session history:", sessionId, error);
  }

  return targetHistory;
}

async function loadOlderHistoryForCurrentSession() {
  if (!currentSessionId || isLoadingOlderHistory) {
    return;
  }
  const sessionId = currentSessionId;
  const targetHistory = loadSessionHistory(sessionId);
  if (!targetHistory.length) {
    return;
  }
  isLoadingOlderHistory = true;
  refreshLoadOlderButton();
  try {
    const beforeLength = targetHistory.length;
    await hydrateSessionHistoryPage(sessionId, {
      limit: SESSION_LOAD_OLDER_BATCH_SIZE,
      offset: beforeLength,
      prepend: true,
    });
    if (currentSessionId !== sessionId) {
      return;
    }
    const prependedCount = loadSessionHistory(sessionId).length - beforeLength;
    if (prependedCount > 0) {
      const olderTurns = loadSessionHistory(sessionId).slice(0, prependedCount);
      await prependHistory(olderTurns);
    }
  } catch (error) {
    console.warn("Failed to load older history:", error);
  } finally {
    isLoadingOlderHistory = false;
    refreshLoadOlderButton();
  }
}

function isMessagesNearBottom() {
  if (!messagesEl) {
    return true;
  }
  const distanceToBottom =
    messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight;
  return distanceToBottom <= AUTO_SCROLL_BOTTOM_THRESHOLD_PX;
}

function summarizeQuestionLabel(value, maxLength = 48) {
  const normalized = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return "未命名问题";
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

function prepareQuestionAnchor(element, index) {
  if (!(element instanceof Element)) {
    return null;
  }
  const label = summarizeQuestionLabel(
    element.querySelector(".message-body")?.textContent || element.textContent || ""
  );
  element.dataset.questionIndex = String(index);
  element.dataset.questionLabel = label;
  return element;
}

function rebuildQuestionAnchorsFromDom() {
  if (!messagesEl) {
    questionAnchorsCache = [];
    return questionAnchorsCache;
  }
  questionAnchorsCache = Array.from(messagesEl.querySelectorAll(".message-user"))
    .map((element, index) => prepareQuestionAnchor(element, index))
    .filter(Boolean);
  return questionAnchorsCache;
}

function setQuestionAnchors(elements) {
  questionAnchorsCache = Array.isArray(elements)
    ? elements.map((element, index) => prepareQuestionAnchor(element, index)).filter(Boolean)
    : [];
  return questionAnchorsCache;
}

function appendQuestionAnchor(element) {
  if (!(element instanceof Element) || !element.classList.contains("message-user")) {
    return;
  }
  questionAnchorsCache.push(element);
  prepareQuestionAnchor(element, questionAnchorsCache.length - 1);
}

function currentQuestionAnchors() {
  if (!questionAnchorsCache.length && messagesEl?.querySelector(".message-user")) {
    return rebuildQuestionAnchorsFromDom();
  }
  return questionAnchorsCache;
}

function currentQuestionIndexFromScroll(anchors) {
  if (!messagesEl || !anchors.length) {
    return -1;
  }
  const threshold = messagesEl.scrollTop + Math.max(messagesEl.clientHeight * 0.3, 80);
  let currentIndex = 0;
  anchors.forEach((element, index) => {
    if (element.offsetTop <= threshold) {
      currentIndex = index;
    }
  });
  return currentIndex;
}

function scrollToQuestion(index) {
  if (!messagesEl) {
    return;
  }
  const anchors = currentQuestionAnchors();
  const target = anchors[index];
  if (!target) {
    return;
  }
  syncingProgrammaticMessageScroll = true;
  messagesEl.scrollTo({
    top: Math.max(target.offsetTop - 12, 0),
    behavior: "smooth",
  });
  shouldAutoScrollMessages = false;
  window.setTimeout(() => {
    syncingProgrammaticMessageScroll = false;
    updateChatScrollAffordances();
  }, 220);
}

function rebuildQuestionNavigator(anchors) {
  if (!chatQuestionTrackEl || !chatQuestionListEl || !chatQuestionNavEl) {
    return;
  }

  chatQuestionTrackEl.innerHTML = "";
  chatQuestionListEl.innerHTML = "";
  questionMarkerEls = [];
  questionItemEls = [];

  if (!anchors.length) {
    chatQuestionNavEl.classList.add("hidden");
    activeQuestionIndex = -1;
    return;
  }

  chatQuestionNavEl.classList.remove("hidden");

  anchors.forEach((element, index) => {
    const label = element.dataset.questionLabel || `问题 ${index + 1}`;

    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = "chat-question-marker";
    marker.title = label;
    marker.setAttribute("aria-label", `跳转到第 ${index + 1} 个问题：${label}`);
    marker.addEventListener("click", () => {
      scrollToQuestion(index);
    });
    chatQuestionTrackEl.appendChild(marker);
    questionMarkerEls.push(marker);

    const item = document.createElement("button");
    item.type = "button";
    item.className = "chat-question-item";
    item.title = label;
    item.addEventListener("click", () => {
      scrollToQuestion(index);
    });

    const itemLabel = document.createElement("span");
    itemLabel.className = "chat-question-item-label";
    itemLabel.textContent = label;

    const itemIndex = document.createElement("span");
    itemIndex.className = "chat-question-item-index";
    itemIndex.textContent = String(index + 1).padStart(2, "0");

    item.appendChild(itemLabel);
    item.appendChild(itemIndex);
    chatQuestionListEl.appendChild(item);
    questionItemEls.push(item);
  });
}

function syncQuestionNavigatorActiveState() {
  questionMarkerEls.forEach((element, index) => {
    element.classList.toggle("active", index === activeQuestionIndex);
  });
  questionItemEls.forEach((element, index) => {
    element.classList.toggle("active", index === activeQuestionIndex);
  });
}

function updateChatScrollAffordances({ structureChanged = false } = {}) {
  const anchors = currentQuestionAnchors();
  if (structureChanged) {
    rebuildQuestionNavigator(anchors);
  }
  activeQuestionIndex = currentQuestionIndexFromScroll(anchors);
  syncQuestionNavigatorActiveState();
  if (chatScrollBottomButtonEl) {
    chatScrollBottomButtonEl.classList.toggle("hidden", isMessagesNearBottom());
  }
}

function refreshChatNavigation({ structureChanged = false } = {}) {
  window.requestAnimationFrame(() => {
    updateChatScrollAffordances({ structureChanged });
  });
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
    updateChatScrollAffordances();
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
  inputEl.dispatchEvent(new Event("input", { bubbles: true }));
  refreshChatPendingState();
  focusChatInput();
}

async function sendCompactCommand() {
  if (!contextCompactButtonEl || contextCompactButtonEl.disabled) {
    return;
  }
  if (!currentSessionId) {
    showSettingsHint("先开始一轮对话，再使用 /compact 压缩当前上下文。");
    return;
  }
  if (pendingSessionIds.has(currentSessionId)) {
    return;
  }
  const sessionId = currentSessionId;
  contextCompactButtonEl.disabled = true;
  try {
    const safeSessionId = encodeURIComponent(sessionId);
    const response = await fetch(`/api/sessions/${safeSessionId}/compact`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        custom_instructions: "",
      }),
    });
    if (!response.ok) {
      throw new Error(await extractErrorMessage(response));
    }
    const payload = await response.json().catch(() => ({}));
    const session = sessionRecord(sessionId);
    if (session) {
      session.context_usage = payload?.context_usage || null;
      session.token_usage = payload?.token_usage || null;
    }
    refreshChatControls();
    void refreshCurrentSessionDetailInBackground(sessionId);
    showSettingsHint("已请求 Pi compact 当前会话。");
  } catch (error) {
    console.error("Failed to compact session:", error);
    showSettingsHint(`Compact 失败：${error.message}`);
  } finally {
    refreshChatControls();
  }
}

function buildWritebackPrompt() {
  return "请将上述回答写回wiki页面";
}

function createAssistantActions(getContent) {
  const actions = document.createElement("div");
  actions.className = "message-actions";

  const writebackButton = document.createElement("button");
  writebackButton.type = "button";
  writebackButton.className = "message-action-button";
  writebackButton.textContent = "写回";
  writebackButton.addEventListener("click", () => {
    const content = typeof getContent === "function" ? String(getContent() || "").trim() : "";
    if (!content) {
      return;
    }
    injectPrompt(buildWritebackPrompt(), false);
  });

  actions.appendChild(writebackButton);
  return actions;
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

async function abortSessionReply(sessionId) {
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
    throw error;
  }
}

async function abortCurrentReply() {
  const sessionId = currentSessionId;
  if (!sessionId) {
    return;
  }
  try {
    await abortSessionReply(sessionId);
  } catch (error) {
    appendMessage("assistant", `终止回复失败：${error.message}`);
  }
}

window.ChatWorkbench = {
  focusInput: focusChatInput,
  injectPrompt,
  openInbox: async (highlightPath = "") => {
    openInboxPanel();
    await refreshInboxFiles({ open: true, highlightPath });
  },
  reloadPiOptions,
  reloadSecuritySettings,
  reloadSlashCommands: async () => {
    await loadSlashCommands();
    refreshSlashPanelFromInput();
  },
};

messagesEl?.addEventListener("scroll", () => {
  if (syncingProgrammaticMessageScroll) {
    return;
  }
  shouldAutoScrollMessages = isMessagesNearBottom();
  updateChatScrollAffordances();
});

chatScrollBottomButtonEl?.addEventListener("click", () => {
  scrollMessagesToBottom(true);
});

chatQuestionNavEl?.addEventListener("mouseenter", () => {
  openChatQuestionPopover();
});

chatQuestionNavEl?.addEventListener("mouseleave", () => {
  scheduleChatQuestionPopoverHide();
});

chatQuestionNavEl?.addEventListener("focusin", () => {
  openChatQuestionPopover();
});

chatQuestionNavEl?.addEventListener("focusout", () => {
  scheduleChatQuestionPopoverHide(1800);
});

chatQuestionPopoverEl?.addEventListener("mouseenter", () => {
  openChatQuestionPopover();
});

chatQuestionPopoverEl?.addEventListener("mouseleave", () => {
  scheduleChatQuestionPopoverHide();
});

contextShellEl?.addEventListener("mouseenter", () => {
  openContextPopover();
});

contextShellEl?.addEventListener("mouseleave", () => {
  scheduleContextPopoverHide();
});

contextShellEl?.addEventListener("focusin", () => {
  openContextPopover();
});

contextShellEl?.addEventListener("focusout", () => {
  window.setTimeout(() => {
    if (!contextShellEl?.contains(document.activeElement)) {
      scheduleContextPopoverHide();
    }
  }, 0);
});

contextPopoverEl?.addEventListener("mouseenter", () => {
  openContextPopover();
});

contextPopoverEl?.addEventListener("mouseleave", () => {
  scheduleContextPopoverHide();
});

contextCompactButtonEl?.addEventListener("click", async () => {
  await sendCompactCommand();
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

function createWorklogStatus(item) {
  const row = document.createElement("p");
  row.className = "trace-worklog-status";
  row.textContent = item.detail ? `${item.title || "Pi 状态"}：${item.detail}` : (item.title || "Pi 状态");

  return {
    element: row,
    kind: "status",
  };
}

function formatTraceSummary(traceCount = 0, warningCount = 0) {
  const parts = [];
  if (traceCount) {
    parts.push(`思考过程 ${traceCount} 条`);
  }
  if (warningCount) {
    parts.push(`警告 ${warningCount}`);
  }
  return parts.join(" · ") || "思考过程";
}

function buildHistoryTraceContent(trace = [], warnings = []) {
  const fragment = document.createDocumentFragment();

  if (Array.isArray(trace) && trace.length) {
    const list = document.createElement("ol");
    list.className = "trace-list";
    trace.forEach((item) => {
      list.appendChild(createTraceItem(item));
    });
    fragment.appendChild(list);
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
    fragment.appendChild(warningBlock);
  }

  return fragment;
}

function buildStreamingTraceContent(trace = [], warnings = []) {
  const fragment = document.createDocumentFragment();

  if (Array.isArray(trace) && trace.length) {
    const worklogEl = document.createElement("div");
    worklogEl.className = "trace-worklog";
    let lastWorklogEntry = null;

    trace.forEach((item) => {
      if (!item || typeof item !== "object") {
        return;
      }

      if (item.kind === "thinking") {
        const note = createWorklogNote(item);
        note.element.classList.add("trace-worklog-thinking");
        worklogEl.appendChild(note.element);
        lastWorklogEntry = note;
        return;
      }

      if (item.kind === "tool") {
        const shouldReuseGroup =
          lastWorklogEntry &&
          lastWorklogEntry.kind === "tool-group" &&
          lastWorklogEntry.action === (item.action || "tool");

        if (shouldReuseGroup) {
          lastWorklogEntry.add(item);
          return;
        }

        const group = createWorklogGroup(item);
        group.add(item);
        worklogEl.appendChild(group.element);
        lastWorklogEntry = group;
        return;
      }

      const status = createWorklogStatus(item);
      worklogEl.appendChild(status.element);
      lastWorklogEntry = status;
    });

    fragment.appendChild(worklogEl);
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
    fragment.appendChild(warningBlock);
  }

  return fragment;
}

function renderTrace(wrapper, trace = [], warnings = []) {
  if ((!Array.isArray(trace) || !trace.length) && (!Array.isArray(warnings) || !warnings.length)) {
    return;
  }

  const details = document.createElement("details");
  details.className = "message-trace";

  const summary = document.createElement("summary");
  summary.textContent = formatTraceSummary(
    Array.isArray(trace) ? trace.length : 0,
    Array.isArray(warnings) ? warnings.length : 0
  );
  details.appendChild(summary);

  let hasRenderedContent = false;
  details.addEventListener("toggle", () => {
    if (!details.open || hasRenderedContent) {
      return;
    }
    details.appendChild(buildHistoryTraceContent(trace, warnings));
    hasRenderedContent = true;
  });

  wrapper.appendChild(details);
}

function renderMessageBody(container, role, content) {
  if (!container) {
    return;
  }
  if (role === "assistant") {
    container.innerHTML = markdownToHtml(content || "");
    window.GogoMath?.renderElement?.(container);
    return;
  }
  container.textContent = content || "";
}

function appendMessage(role, content, consultedPages = [], trace = [], warnings = []) {
  if (!messagesEl) {
    console.warn("messagesEl not found, cannot append message");
    return;
  }
  const wrapper = createMessageElement(role, content, consultedPages, trace, warnings);
  messagesEl.appendChild(wrapper);
  if (role === "user") {
    appendQuestionAnchor(wrapper);
  }
  scrollMessagesToBottom();
  refreshChatNavigation({ structureChanged: role === "user" });
}

function createStreamingAssistantMessage(initialText, options = {}) {
  const wrapper = document.createElement("article");
  wrapper.className = "message message-assistant";

  const detailsEl = document.createElement("details");
  detailsEl.className = "message-trace";
  detailsEl.hidden = true;

  const summaryEl = document.createElement("summary");
  summaryEl.textContent = "思考过程";
  detailsEl.appendChild(summaryEl);
  const traceBodyHostEl = document.createElement("div");
  detailsEl.appendChild(traceBodyHostEl);
  wrapper.appendChild(detailsEl);

  const bodyEl = document.createElement("div");
  bodyEl.className = "message-body";
  renderMessageBody(bodyEl, "assistant", initialText);
  wrapper.appendChild(bodyEl);

  const metaHost = document.createElement("div");
  metaHost.hidden = true;
  wrapper.appendChild(metaHost);

  const actionsEl = createAssistantActions(() => rawContent);
  actionsEl.hidden = !String(initialText || "").trim() || String(initialText || "").includes("Pi 正在生成答复");
  wrapper.appendChild(actionsEl);

  messagesEl.appendChild(wrapper);
  scrollMessagesToBottom();
  refreshChatNavigation();

  let traceCount = 0;
  let warningCount = 0;
  let hasActualText = false;
  let rawContent = String(initialText || "");
  let consultedPagesState = [];
  let warningState = [];
  const traceState = [];
  let thinkingTraceItem = null;
  let bodyRenderFrameId = 0;
  let traceRenderFrameId = 0;
  let traceBodyDirty = true;

  function updateTraceSummary() {
    summaryEl.textContent = formatTraceSummary(traceCount, warningCount);
    detailsEl.hidden = !traceCount && !warningCount;
    scheduleTraceBodyRender();
  }

  function setConsultedPages(pages = []) {
    consultedPagesState = Array.isArray(pages)
      ? pages.filter((item) => item && typeof item === "object").map((item) => ({ ...item }))
      : [];
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
    warningCount = Array.isArray(warnings) ? warnings.length : 0;
    warningState = Array.isArray(warnings) ? warnings.map((item) => String(item || "")) : [];
    updateTraceSummary();
    scrollMessagesToBottom();
  }

  function flushBodyRender() {
    if (bodyRenderFrameId) {
      window.cancelAnimationFrame(bodyRenderFrameId);
      bodyRenderFrameId = 0;
    }
    renderMessageBody(bodyEl, "assistant", rawContent);
    actionsEl.hidden = !rawContent.trim();
    scrollMessagesToBottom();
  }

  function scheduleBodyRender({ immediate = false } = {}) {
    if (immediate) {
      flushBodyRender();
      return;
    }
    if (bodyRenderFrameId) {
      return;
    }
    bodyRenderFrameId = window.requestAnimationFrame(() => {
      bodyRenderFrameId = 0;
      renderMessageBody(bodyEl, "assistant", rawContent);
      actionsEl.hidden = !rawContent.trim();
      scrollMessagesToBottom();
    });
  }

  function flushTraceBodyRender() {
    if (traceRenderFrameId) {
      window.cancelAnimationFrame(traceRenderFrameId);
      traceRenderFrameId = 0;
    }
    if (!detailsEl.open) {
      traceBodyDirty = true;
      return;
    }
    traceBodyHostEl.innerHTML = "";
    traceBodyHostEl.appendChild(buildStreamingTraceContent(traceState, warningState));
    traceBodyDirty = false;
    scrollMessagesToBottom();
  }

  function scheduleTraceBodyRender({ immediate = false } = {}) {
    if (!detailsEl.open) {
      traceBodyDirty = true;
      return;
    }
    if (immediate) {
      flushTraceBodyRender();
      return;
    }
    if (traceRenderFrameId) {
      return;
    }
    traceRenderFrameId = window.requestAnimationFrame(() => {
      traceRenderFrameId = 0;
      flushTraceBodyRender();
    });
  }

  detailsEl.addEventListener("toggle", () => {
    if (!detailsEl.open || !traceBodyDirty) {
      return;
    }
    scheduleTraceBodyRender({ immediate: true });
  });

  return {
    element: wrapper,
    setContent(text) {
      rawContent = String(text || "");
      hasActualText = true;
      scheduleBodyRender();
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
      scheduleBodyRender();
    },
    appendThinkingDelta(delta) {
      if (!delta) {
        return;
      }
      if (!thinkingTraceItem) {
        thinkingTraceItem = {
          kind: "thinking",
          title: "思考记录",
          detail: "",
          action: "thinking",
          event_type: "thinking_delta",
        };
        traceState.push(thinkingTraceItem);
        traceCount += 1;
        updateTraceSummary();
      }
      thinkingTraceItem.detail += delta;
      scheduleTraceBodyRender();
      scrollMessagesToBottom();
    },
    setConsultedPages,
    addTrace(item) {
      if (!item || typeof item !== "object") {
        return;
      }
      traceState.push({ ...item });
      if (typeof options.onTrace === "function") {
        options.onTrace({ ...item }, traceState.map((entry) => ({ ...entry })));
      }

      traceCount += 1;
      updateTraceSummary();
      scheduleTraceBodyRender();
      scrollMessagesToBottom();
    },
    setWarnings,
    finalize(payload = {}) {
      const finalMessage = typeof payload.message === "string" ? payload.message : "";
      if (finalMessage && (!hasActualText || finalMessage !== rawContent)) {
        rawContent = finalMessage;
        hasActualText = true;
      }
      flushBodyRender();
      if (Array.isArray(payload.consulted_pages)) {
        setConsultedPages(payload.consulted_pages);
      }
      if (Array.isArray(payload.warnings)) {
        setWarnings(payload.warnings);
      }
      scheduleTraceBodyRender();
      actionsEl.hidden = !rawContent.trim();
    },
    getContent() {
      return rawContent;
    },
    getTraceSnapshot() {
      return traceState.map((item) => ({ ...item }));
    },
    getWarnings() {
      return [...warningState];
    },
    getConsultedPages() {
      return consultedPagesState.map((item) => ({ ...item }));
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
    refreshLoadOlderButton();
    return;
  }
  if (showHint) {
    renderDraftStateHint();
    storeCurrentSessionView();
  }
  refreshChatPendingState();
  renderSessionList();
  refreshLoadOlderButton();
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
  refreshLoadOlderButton();
  void refreshCurrentSessionDetailInBackground(sessionId);
  if (restoreSessionView(sessionId)) {
    refreshChatPendingState();
    renderSessionList();
    refreshLoadOlderButton();
    return;
  }

  clearMessages({ refreshNavigation: false });

  await hydrateSessionHistoryFromStore(sessionId);
  if (currentSessionId !== sessionId) {
    return;
  }

  const sessHistory = loadSessionHistory(sessionId);
  if (sessHistory.length > 0) {
    await renderHistory(sessHistory);
  } else {
    appendMessage("assistant", "这是会话的开始。");
  }

  refreshChatPendingState();
  renderSessionList();
  refreshLoadOlderButton();
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

async function reloadPiOptions() {
  const payload = await fetchPiOptions();
  applyPiOptions(payload);
  refreshChatControls();
  return payload;
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
  const [detailResponse, statsResponse] = await Promise.all([
    fetch(`/api/sessions/${safeSessionId}`),
    fetch(`/api/sessions/${safeSessionId}/stats`),
  ]);
  if (!detailResponse.ok) {
    throw new Error(await extractErrorMessage(detailResponse));
  }
  const detailPayload = await detailResponse.json();
  const session = detailPayload?.session || null;
  if (!session) {
    return null;
  }
  if (statsResponse.ok) {
    const statsPayload = await statsResponse.json().catch(() => ({}));
    session.context_usage = statsPayload?.context_usage || null;
    session.token_usage = statsPayload?.token_usage || null;
  }
  return session;
}

async function refreshCurrentSessionDetailInBackground(sessionId) {
  try {
    const session = await fetchSessionDetail(sessionId);
    if (!session) {
      return;
    }
    mergeSessionIntoCache(session);
    if (currentSessionId === sessionId) {
      renderSessionList();
      refreshChatControls();
    }
  } catch (error) {
    console.warn("Failed to refresh current session detail:", error);
  }
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
    sessionHistoryHasOlder.delete(sessionId);
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

async function sendMessage(message, options = {}) {
  saveCurrentHistory();

  let requestSessionId = String(options?.sessionId || currentSessionId || "").trim() || currentSessionId;
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
  requestHistory.push(
    normalizeHistoryTurn({
      role: "user",
      content: message,
    })
  );

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

      if (type === "extension_ui_request") {
        void handleIncomingExtensionUiRequest(event.request || {}, event.session_id || requestSessionId);
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

    upsertAssistantTurn(requestHistory, assistantMessage, {
      consulted_pages: Array.isArray(finalPayload?.consulted_pages)
        ? finalPayload.consulted_pages
        : liveMessage.getConsultedPages(),
      trace: Array.isArray(finalPayload?.trace)
        ? finalPayload.trace
        : liveMessage.getTraceSnapshot(),
      warnings: Array.isArray(finalPayload?.warnings)
        ? finalPayload.warnings
        : liveMessage.getWarnings(),
      stopped: Boolean(finalPayload?.stopped),
    });
    sessionHistories.set(requestSessionId, requestHistory);
    if (requestSessionId === currentSessionId && !messagesEl.contains(liveMessage.element)) {
      clearMessages({ refreshNavigation: false });
      await renderHistory(requestHistory);
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
    upsertAssistantTurn(requestHistory, fallbackMessage, {
      consulted_pages: liveMessage.getConsultedPages(),
      trace: liveMessage.getTraceSnapshot(),
      warnings,
    });
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
    pendingSecurityDenyReasons.delete(requestSessionId);
    discardQueuedSecurityInterventions(requestSessionId);
    if (activeSecurityIntervention?.sessionId === requestSessionId) {
      closeActiveSecurityIntervention();
    }
    refreshChatPendingState();
    renderSessionList();
    void refreshCurrentSessionDetailInBackground(requestSessionId);
    if (inboxFiles.length > 0 || /ingest|inbox/i.test(message)) {
      void refreshInboxFiles({ open: inboxPanelOpen, highlightPath: highlightedInboxPath });
    }
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
  closeSlashPanel();
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
  if (handleSlashPanelKeydown(event)) {
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
  refreshSlashPanelFromInput();
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
  if (inboxPanelOpen && !shouldIgnoreInboxOutsideDismiss(target)) {
    closeInboxPanel();
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
  if (!target.closest("#chat-slash-panel") && !target.closest("#chat-slash-button") && target !== inputEl) {
    closeSlashPanel();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented) {
    return;
  }
  if (activeSecurityIntervention && event.key === "Escape") {
    event.preventDefault();
    void dismissActiveSecurityIntervention();
    return;
  }
  if (slashPanelVisible && event.target !== inputEl && handleSlashPanelKeydown(event)) {
    return;
  }
  if (event.key !== "Escape") {
    return;
  }
  closeChatControlMenus();
  if (inboxPanelOpen) {
    closeInboxPanel();
  }
  if (openSessionMenuId) {
    openSessionMenuId = null;
    renderSessionList();
  }
  closeSlashPanel();
});

slashPanelEl?.addEventListener("mouseenter", () => {
  inputEl?.focus({ preventScroll: true });
});

slashButtonEl?.addEventListener("click", async () => {
  if (slashPanelVisible && slashPanelManual) {
    closeSlashPanel();
    return;
  }
  try {
    if (!availableSlashCommands.length) {
      await loadSlashCommands();
    }
  } catch (error) {
    showSettingsHint(`加载 slash 命令失败：${error.message}`);
    return;
  }
  openSlashPanel({ manual: true });
  focusChatInput();
});

loadOlderButtonEl?.addEventListener("click", async () => {
  await loadOlderHistoryForCurrentSession();
});

uploadButtonEl?.addEventListener("click", () => {
  if (uploadButtonEl.disabled || !uploadInputEl) {
    return;
  }
  uploadInputEl.value = "";
  uploadInputEl.click();
});

uploadInputEl?.addEventListener("change", async () => {
  const files = uploadInputEl.files;
  if (!files?.length) {
    return;
  }
  await uploadInboxFiles(files);
});

toggleInboxPanelButtonEl?.addEventListener("click", async () => {
  if (inboxPanelOpen) {
    closeInboxPanel();
    return;
  }
  openInboxPanel();
  await refreshInboxFiles({ open: true });
});

closeInboxPanelButtonEl?.addEventListener("click", closeInboxPanel);
refreshInboxPanelButtonEl?.addEventListener("click", async () => {
  await refreshInboxFiles({ open: true });
});
ingestInboxPanelButtonEl?.addEventListener("click", () => {
  if (!inboxFiles.length) {
    setInboxFeedback("Inbox 里还没有文件，先上传一些内容吧。", true);
    return;
  }
  injectPrompt(INBOX_INGEST_PROMPT, false);
  setInboxFeedback("已把“ingest inbox”提示词插入输入框。");
  showSettingsHint("ingest 提示词已插入输入框");
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

securityButtonEl?.addEventListener("click", () => {
  if (securityButtonEl.disabled) {
    return;
  }
  toggleChatControlMenu("security");
});

securityCloseButtonEl?.addEventListener("click", async () => {
  await dismissActiveSecurityIntervention();
});

securityApproveButtonEl?.addEventListener("click", async () => {
  await handleSecurityApproval();
});

securityDenyButtonEl?.addEventListener("click", async () => {
  await handleSecurityDeny();
});

securitySteerInputEl?.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter" || (!event.metaKey && !event.ctrlKey)) {
    return;
  }
  event.preventDefault();
  await handleSecurityDeny();
});

async function bootstrapChat() {
  applySessionSidebarState(loadSessionSidebarState());
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

  await nextAnimationFrame();
  void warmStartupDataInBackground();
}

async function warmStartupDataInBackground() {
  const startupTasks = await Promise.allSettled([
    reloadPiOptions(),
    reloadSecuritySettings({ silent: true }),
    loadSlashCommands(),
    refreshInboxFiles(),
  ]);
  const [piOptionsResult, securityResult, slashCommandsResult, inboxResult] = startupTasks;

  if (piOptionsResult?.status === "rejected") {
    console.error("Failed to load Pi options:", piOptionsResult.reason);
    showSettingsHint(`加载模型与思考水平选项失败：${piOptionsResult.reason?.message || piOptionsResult.reason}`);
  }
  if (securityResult?.status === "rejected") {
    console.error("Failed to load security settings:", securityResult.reason);
    showSettingsHint(`加载安全模式失败：${securityResult.reason?.message || securityResult.reason}`);
  }
  if (slashCommandsResult?.status === "rejected") {
    console.error("Failed to load slash commands:", slashCommandsResult.reason);
  }
  if (inboxResult?.status === "rejected") {
    console.error("Failed to load inbox files:", inboxResult.reason);
  }
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
