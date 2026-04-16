const bodyEl = document.body;
const layoutWikiButtonEl = document.querySelector("#layout-mode-wiki");
const layoutChatButtonEl = document.querySelector("#layout-mode-chat");
const hideChatButtonEl = document.querySelector("#hide-chat-panel");
const hideWikiButtonEl = document.querySelector("#hide-wiki-panel");
const hideWikiPanelChatButtonEl = document.querySelector("#hide-wiki-panel-chat");
const showChatButtonEl = document.querySelector("#show-chat-panel");
const showWikiButtonEl = document.querySelector("#show-wiki-panel");
const knowledgeBaseNameEl = document.querySelector("#knowledge-base-name");
const openSettingsButtonEl = document.querySelector("#open-settings-panel");
const closeSettingsButtonEl = document.querySelector("#close-settings-panel");
const settingsOverlayEl = document.querySelector("#settings-overlay");
const settingsToastViewportEl = document.querySelector("#settings-toast-viewport");
const settingsNavButtonEls = Array.from(document.querySelectorAll("[data-settings-section]"));
const settingsSectionPaneEls = Array.from(document.querySelectorAll("[data-settings-section-pane]"));
const knowledgeBasePathInputEl = document.querySelector("#knowledge-base-path-input");
const knowledgeBaseRecentListEl = document.querySelector("#knowledge-base-recent-list");
const knowledgeBaseFeedbackEl = document.querySelector("#knowledge-base-settings-feedback");
const applyKnowledgeBasePathButtonEl = document.querySelector("#apply-knowledge-base-path");
const pickKnowledgeBasePathButtonEl = document.querySelector("#pick-knowledge-base-path");
const capabilitySummaryChipsEl = document.querySelector("#capability-summary-chips");
const capabilityListEl = document.querySelector("#capability-list");
const capabilityEmptyEl = document.querySelector("#capability-empty");
const capabilityEditorTitleEl = document.querySelector("#capability-editor-title");
const capabilityEditorPathEl = document.querySelector("#capability-editor-path");
const capabilityEditorInputEl = document.querySelector("#capability-editor-input");
const capabilityFeedbackEl = document.querySelector("#capability-settings-feedback");
const capabilityAgentsGuidanceEl = document.querySelector("#capability-agents-guidance");
const capabilityAgentsGuidanceTextEl = document.querySelector("#capability-agents-guidance-text");
const capabilityAgentsGuidanceSnippetEl = document.querySelector("#capability-agents-guidance-snippet");
const copyCapabilityAgentsSnippetButtonEl = document.querySelector("#copy-capability-agents-snippet");
const openCapabilityAgentsButtonEl = document.querySelector("#open-capability-agents-button");
const refreshCapabilityListButtonEl = document.querySelector("#refresh-capability-list");
const deleteCapabilityButtonEl = document.querySelector("#delete-capability-button");
const resetCapabilityButtonEl = document.querySelector("#reset-capability-button");
const saveCapabilityButtonEl = document.querySelector("#save-capability-button");
const createSkillButtonEl = document.querySelector("#create-skill-button");
const createSchemaButtonEl = document.querySelector("#create-schema-button");
const capabilityCreateNameInputEl = document.querySelector("#capability-create-name-input");

const providerProfileListEl = document.querySelector("#provider-profile-list");
const providerProfileEmptyEl = document.querySelector("#provider-profile-empty");
const providerModeApiButtonEl = document.querySelector("#provider-mode-api");
const providerModeOauthButtonEl = document.querySelector("#provider-mode-oauth");
const providerSharedFieldsEl = document.querySelector("#provider-shared-fields");
const providerKeyInputEl = document.querySelector("#provider-key-input");
const providerDisplayNameInputEl = document.querySelector("#provider-display-name-input");
const providerOauthPresetShellEl = document.querySelector("#provider-oauth-preset-shell");
const providerOauthPresetSelectEl = document.querySelector("#provider-oauth-preset-select");
const providerAuthModeShellEl = document.querySelector("#provider-auth-mode-shell");
const providerAuthModeSelectEl = document.querySelector("#provider-auth-mode-select");
const providerAuthModeHelpEl = document.querySelector("#provider-auth-mode-help");
const providerBaseUrlInputEl = document.querySelector("#provider-base-url-input");
const providerApiFieldsEl = document.querySelector("#provider-api-fields");
const providerApiTypeSelectEl = document.querySelector("#provider-api-type-select");
const providerAuthHeaderShellEl = document.querySelector("#provider-auth-header-shell");
const providerAuthHeaderInputEl = document.querySelector("#provider-auth-header-input");
const providerApiSecretShellEl = document.querySelector("#provider-api-secret-shell");
const providerApiKeyInputEl = document.querySelector("#provider-api-key-input");
const providerOauthTokenShellEl = document.querySelector("#provider-oauth-token-shell");
const providerAccessTokenInputEl = document.querySelector("#provider-access-token-input");
const providerRefreshTokenInputEl = document.querySelector("#provider-refresh-token-input");
const providerOauthExpiresInputEl = document.querySelector("#provider-oauth-expires-input");
const providerOauthAccountInputEl = document.querySelector("#provider-oauth-account-input");
const providerModelsShellEl = document.querySelector("#provider-models-shell");
const providerModelsTextEl = document.querySelector("#provider-models-text");
const providerOauthIntroShellEl = document.querySelector("#provider-oauth-intro-shell");
const providerApiActionsEl = document.querySelector("#provider-api-actions");
const importProviderJsonButtonEl = document.querySelector("#import-provider-json-button");
const saveProviderButtonEl = document.querySelector("#save-provider-button");
const providerDesktopLoginButtonEl = document.querySelector("#provider-desktop-login-button");
const resetProviderButtonEl = document.querySelector("#reset-provider-button");
const providerFeedbackEl = document.querySelector("#provider-settings-feedback");
const refreshDiagnosticsButtonEl = document.querySelector("#refresh-diagnostics-button");
const diagnosticsFeedbackEl = document.querySelector("#diagnostics-feedback");
const diagnosticsStatusChipsEl = document.querySelector("#diagnostics-status-chips");
const diagnosticsKbListEl = document.querySelector("#diagnostics-kb-list");
const diagnosticsPiListEl = document.querySelector("#diagnostics-pi-list");
const diagnosticsSessionListEl = document.querySelector("#diagnostics-session-list");
const diagnosticsProviderListEl = document.querySelector("#diagnostics-provider-list");

const STORAGE_KEY = "research-kb-workbench-layout";
const DESKTOP_PI_LOGIN_POLL_INTERVAL_MS = 2500;
const DESKTOP_PI_LOGIN_TIMEOUT_MS = 120000;

const workbenchState = {
  layout: "wiki",
  chatVisible: true,
  wikiVisible: true,
};
let appSettings = null;
let providerFormMode = "api";
let editingProviderKey = "";
let providerAuthMode = "desktop-pi-login";
let activeSettingsSection = "knowledge-base";
const diagnosticsState = {
  loading: false,
  loadedAt: 0,
  data: null,
};
const capabilityState = {
  loading: false,
  loaded: false,
  fileLoading: false,
  saving: false,
  items: [],
  selectedPath: "",
  savedContent: "",
};
const capabilityAgentsGuidanceState = {
  active: false,
  path: "",
  snippet: "",
  text: "",
};
let desktopPiLoginPollToken = 0;
const desktopBridge =
  typeof window !== "undefined" &&
  window.GogoDesktop &&
  typeof window.GogoDesktop.isDesktopRuntime === "function"
    ? window.GogoDesktop
    : null;

function isDesktopRuntime() {
  try {
    return Boolean(desktopBridge?.isDesktopRuntime?.());
  } catch (_error) {
    return false;
  }
}

function saveWorkbenchState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workbenchState));
  } catch (_error) {
    // Ignore localStorage failures.
  }
}

function loadWorkbenchState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw);
    if (parsed.layout === "chat" || parsed.layout === "wiki") {
      workbenchState.layout = parsed.layout;
    }
    if (typeof parsed.chatVisible === "boolean") {
      workbenchState.chatVisible = parsed.chatVisible;
    }
    if (typeof parsed.wikiVisible === "boolean") {
      workbenchState.wikiVisible = parsed.wikiVisible;
    }
  } catch (_error) {
    // Ignore malformed local state.
  }
}

function applyWorkbenchState() {
  bodyEl.classList.toggle("layout-wiki", workbenchState.layout === "wiki");
  bodyEl.classList.toggle("layout-chat", workbenchState.layout === "chat");
  bodyEl.classList.toggle("chat-hidden", !workbenchState.chatVisible);
  bodyEl.classList.toggle("wiki-hidden", !workbenchState.wikiVisible);

  layoutWikiButtonEl?.classList.toggle("active", workbenchState.layout === "wiki");
  layoutChatButtonEl?.classList.toggle("active", workbenchState.layout === "chat");
  layoutWikiButtonEl?.setAttribute("aria-pressed", String(workbenchState.layout === "wiki"));
  layoutChatButtonEl?.setAttribute("aria-pressed", String(workbenchState.layout === "chat"));

  showChatButtonEl?.classList.toggle(
    "hidden",
    !(workbenchState.layout === "wiki" && !workbenchState.chatVisible)
  );
  showWikiButtonEl?.classList.toggle(
    "hidden",
    !(workbenchState.layout === "chat" && !workbenchState.wikiVisible)
  );

  hideChatButtonEl?.classList.toggle("hidden", workbenchState.layout !== "wiki");
  hideWikiButtonEl?.classList.toggle("hidden", workbenchState.layout !== "chat");
  hideWikiPanelChatButtonEl?.classList.toggle("hidden", workbenchState.layout !== "chat");
}

function setLayout(layout) {
  workbenchState.layout = layout === "chat" ? "chat" : "wiki";
  if (workbenchState.layout === "wiki") {
    workbenchState.wikiVisible = true;
  } else {
    workbenchState.chatVisible = true;
  }
  applyWorkbenchState();
  saveWorkbenchState();
}

function hideChat() {
  if (workbenchState.layout !== "wiki") {
    return;
  }
  workbenchState.chatVisible = false;
  applyWorkbenchState();
  saveWorkbenchState();
}

function showChat() {
  workbenchState.chatVisible = true;
  applyWorkbenchState();
  saveWorkbenchState();
}

function hideWiki() {
  if (workbenchState.layout !== "chat") {
    return;
  }
  workbenchState.wikiVisible = false;
  applyWorkbenchState();
  saveWorkbenchState();
}

function showWiki() {
  workbenchState.wikiVisible = true;
  applyWorkbenchState();
  saveWorkbenchState();
}

loadWorkbenchState();
applyWorkbenchState();

layoutWikiButtonEl?.addEventListener("click", () => setLayout("wiki"));
layoutChatButtonEl?.addEventListener("click", () => setLayout("chat"));
hideChatButtonEl?.addEventListener("click", hideChat);
hideWikiButtonEl?.addEventListener("click", hideWiki);
hideWikiPanelChatButtonEl?.addEventListener("click", hideWiki);
showChatButtonEl?.addEventListener("click", showChat);
showWikiButtonEl?.addEventListener("click", showWiki);
settingsNavButtonEls.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveSettingsSection(button.dataset.settingsSection || "knowledge-base");
  });
});

function setFeedback(element, message, isError = false) {
  if (!element) {
    return;
  }
  if (!message) {
    element.textContent = "";
    element.classList.add("hidden");
    element.style.color = "";
    return;
  }
  element.textContent = message;
  element.classList.remove("hidden");
  element.style.color = isError ? "#b1532f" : "#185c52";
}

function showSettingsToast(message, variant = "success", duration = 2800) {
  if (!message || !settingsToastViewportEl) {
    return;
  }
  const toast = document.createElement("div");
  toast.className = `settings-toast ${variant === "error" ? "error" : "success"}`;
  toast.textContent = String(message);
  settingsToastViewportEl.appendChild(toast);
  window.setTimeout(() => {
    toast.remove();
  }, duration);
}

async function copyTextToClipboard(text) {
  const value = String(text || "");
  if (!value.trim()) {
    return false;
  }
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch (_error) {
    // Fall through to textarea copy fallback.
  }
  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "readonly");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  textArea.style.pointerEvents = "none";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch (_error) {
    copied = false;
  }
  textArea.remove();
  return copied;
}

function setKnowledgeBaseFeedback(message, isError = false) {
  setFeedback(knowledgeBaseFeedbackEl, message, isError);
}

function setProviderFeedback(message, isError = false) {
  setFeedback(providerFeedbackEl, message, isError);
}

function setDiagnosticsFeedback(message, isError = false) {
  setFeedback(diagnosticsFeedbackEl, message, isError);
}

function setCapabilityFeedback(message, isError = false) {
  setFeedback(capabilityFeedbackEl, message, isError);
}

function clearSettingsFeedback() {
  setKnowledgeBaseFeedback("");
  setCapabilityFeedback("");
  setProviderFeedback("");
  setDiagnosticsFeedback("");
}

function capabilityItems() {
  return Array.isArray(capabilityState.items) ? capabilityState.items : [];
}

function groupedCapabilityItems() {
  const groups = new Map();
  capabilityItems().forEach((item) => {
    const label = String(item?.group || "Other").trim() || "Other";
    if (!groups.has(label)) {
      groups.set(label, []);
    }
    groups.get(label).push(item);
  });
  return Array.from(groups.entries());
}

function capabilityByPath(path) {
  const target = String(path || "").trim();
  return capabilityItems().find((item) => String(item?.path || "").trim() === target) || null;
}

function capabilityHasUnsavedChanges() {
  if (!capabilityEditorInputEl || !capabilityState.selectedPath) {
    return false;
  }
  return capabilityEditorInputEl.value !== capabilityState.savedContent;
}

function buildAgentsSnippet(item) {
  if (!item) {
    return "";
  }
  const path = String(item.path || "").trim();
  if (!path) {
    return "";
  }
  if (item.source === "skill") {
    const name = String(item.name || item.command || path).trim();
    return `- 如需使用技能“${name}”，请先阅读 \`${path}\` 并按其中流程执行。`;
  }
  if (item.source === "schema") {
    const name = String(item.name || item.command || path).trim();
    return `- 如需按结构化格式使用“${name}”，请先阅读 \`${path}\` 并严格遵循其中定义。`;
  }
  return "";
}

function showCapabilityAgentsGuidance(item) {
  const snippet = buildAgentsSnippet(item);
  if (!snippet) {
    capabilityAgentsGuidanceState.active = false;
    capabilityAgentsGuidanceState.path = "";
    capabilityAgentsGuidanceState.snippet = "";
    capabilityAgentsGuidanceState.text = "";
    renderCapabilityAgentsGuidance();
    return;
  }
  capabilityAgentsGuidanceState.active = true;
  capabilityAgentsGuidanceState.path = String(item.path || "");
  capabilityAgentsGuidanceState.snippet = snippet;
  capabilityAgentsGuidanceState.text =
    "请把下面片段补充到知识库根目录的 `AGENTS.md`。更新后需要在新会话中生效，已有会话不会自动获得这项能力。";
  renderCapabilityAgentsGuidance();
}

function hideCapabilityAgentsGuidance() {
  capabilityAgentsGuidanceState.active = false;
  capabilityAgentsGuidanceState.path = "";
  capabilityAgentsGuidanceState.snippet = "";
  capabilityAgentsGuidanceState.text = "";
  renderCapabilityAgentsGuidance();
}

function renderCapabilityAgentsGuidance() {
  if (!capabilityAgentsGuidanceEl || !capabilityAgentsGuidanceSnippetEl || !capabilityAgentsGuidanceTextEl) {
    return;
  }
  const shouldShow = capabilityAgentsGuidanceState.active && capabilityAgentsGuidanceState.snippet;
  capabilityAgentsGuidanceEl.classList.toggle("hidden", !shouldShow);
  capabilityAgentsGuidanceTextEl.innerHTML = shouldShow
    ? "请把下面片段补充到知识库根目录的 <code>AGENTS.md</code>。更新后需要在新会话中生效，已有会话不会自动获得这项能力。"
    : "";
  capabilityAgentsGuidanceSnippetEl.value = shouldShow ? capabilityAgentsGuidanceState.snippet : "";
  if (copyCapabilityAgentsSnippetButtonEl) {
    copyCapabilityAgentsSnippetButtonEl.disabled = !shouldShow;
  }
  if (openCapabilityAgentsButtonEl) {
    openCapabilityAgentsButtonEl.disabled = !shouldShow || !capabilityByPath("AGENTS.md");
  }
}

function ensureCapabilitySwitchAllowed() {
  if (!capabilityHasUnsavedChanges()) {
    return true;
  }
  return window.confirm("当前能力定义有未保存修改，确认放弃这些修改并切换吗？");
}

function renderCapabilitySummary() {
  if (!capabilitySummaryChipsEl) {
    return;
  }
  capabilitySummaryChipsEl.innerHTML = "";
  const items = capabilityItems();
  const skills = items.filter((item) => item.source === "skill").length;
  const schemas = items.filter((item) => item.source === "schema").length;
  const supportDocs = items.filter((item) => String(item.source || "").includes("doc")).length;
  [
    `总数：${items.length}`,
    `Skills：${skills}`,
    `Schemas：${schemas}`,
    `支持文件：${supportDocs}`,
  ].forEach((label) => {
    const chip = document.createElement("span");
    chip.className = "settings-chip";
    chip.textContent = label;
    capabilitySummaryChipsEl.appendChild(chip);
  });
}

function renderCapabilityEditor() {
  const item = capabilityByPath(capabilityState.selectedPath);
  if (capabilityEditorTitleEl) {
    capabilityEditorTitleEl.textContent = item?.name || "选择一个 skill 或 schema";
  }
  if (capabilityEditorPathEl) {
    capabilityEditorPathEl.textContent = item
      ? `${item.group || (item.source === "schema" ? "Schemas" : "Skills")} · ${item.path}`
      : "将在这里显示当前能力定义的路径与类型。";
  }
  if (capabilityEditorInputEl) {
    if (!item) {
      capabilityEditorInputEl.value = "";
    } else if (!capabilityHasUnsavedChanges()) {
      capabilityEditorInputEl.value = capabilityState.savedContent;
    }
    capabilityEditorInputEl.disabled = !item || capabilityState.fileLoading || capabilityState.saving;
    capabilityEditorInputEl.placeholder = item
      ? "在这里编辑原始定义，保存后会直接写回当前知识库。"
      : "选择左侧条目后即可查看和编辑原始定义。";
  }
  if (resetCapabilityButtonEl) {
    resetCapabilityButtonEl.disabled = !item || capabilityState.fileLoading || capabilityState.saving || !capabilityHasUnsavedChanges();
  }
  if (deleteCapabilityButtonEl) {
    deleteCapabilityButtonEl.disabled =
      !item || capabilityState.fileLoading || capabilityState.saving || item.deletable === false;
  }
  if (saveCapabilityButtonEl) {
    saveCapabilityButtonEl.disabled = !item || capabilityState.fileLoading || capabilityState.saving || !capabilityHasUnsavedChanges();
  }
  renderCapabilityAgentsGuidance();
}

function renderCapabilityList() {
  if (!capabilityListEl || !capabilityEmptyEl) {
    return;
  }
  const items = capabilityItems();
  capabilityListEl.innerHTML = "";
  capabilityEmptyEl.classList.toggle("hidden", items.length > 0);

  const groups = groupedCapabilityItems();

  groups.forEach(([label, groupItems]) => {
    if (!groupItems.length) {
      return;
    }
    const section = document.createElement("section");
    section.className = "settings-capability-group";

    const title = document.createElement("p");
    title.className = "settings-capability-group-title";
    title.textContent = label;
    section.appendChild(title);

    groupItems.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "settings-capability-item";
      button.classList.toggle("active", item.path === capabilityState.selectedPath);

      const name = document.createElement("p");
      name.className = "settings-capability-item-name";
      name.textContent = item.name || item.command || item.path;

      const meta = document.createElement("div");
      meta.className = "settings-capability-item-meta";

      const source = document.createElement("span");
      const sourceKind = item.source === "schema" || item.source === "schema-doc"
        ? "schema"
        : item.source === "skill" || item.source === "skill-doc"
          ? "skill"
          : "";
      source.className = `settings-capability-badge${sourceKind ? ` ${sourceKind}` : ""}`;
      source.textContent = (() => {
        switch (item.source) {
          case "schema":
            return "Schema";
          case "schema-doc":
            return "Schema Doc";
          case "skill-doc":
            return "Skill Doc";
          case "knowledge-base-doc":
            return "KB Doc";
          default:
            return "Skill";
        }
      })();
      meta.appendChild(source);

      if (item.command) {
        const command = document.createElement("span");
        command.className = "settings-capability-badge";
        command.textContent = `/${item.command}`;
        meta.appendChild(command);
      }

      const path = document.createElement("p");
      path.className = "settings-capability-item-path";
      path.textContent = item.path || "";

      button.appendChild(name);
      button.appendChild(meta);
      button.appendChild(path);
      button.addEventListener("click", () => {
        if (item.path === capabilityState.selectedPath) {
          return;
        }
        if (!ensureCapabilitySwitchAllowed()) {
          return;
        }
        void loadCapabilityFile(item.path, { preserveUnsaved: true });
      });
      section.appendChild(button);
    });

    capabilityListEl.appendChild(section);
  });
}

function renderCapabilitySettings() {
  renderCapabilitySummary();
  renderCapabilityList();
  renderCapabilityEditor();
  if (refreshCapabilityListButtonEl) {
    refreshCapabilityListButtonEl.disabled = capabilityState.loading || capabilityState.fileLoading || capabilityState.saving;
  }
  if (createSkillButtonEl) {
    createSkillButtonEl.disabled = capabilityState.loading || capabilityState.fileLoading || capabilityState.saving;
  }
  if (createSchemaButtonEl) {
    createSchemaButtonEl.disabled = capabilityState.loading || capabilityState.fileLoading || capabilityState.saving;
  }
  if (capabilityCreateNameInputEl) {
    capabilityCreateNameInputEl.disabled = capabilityState.loading || capabilityState.fileLoading || capabilityState.saving;
  }
}

async function refreshSlashCommandsAfterCapabilityChange() {
  try {
    await window.ChatWorkbench?.reloadSlashCommands?.();
  } catch (error) {
    console.error("Failed to refresh slash commands after capability change:", error);
  }
}

async function loadCapabilityFile(path, { preserveUnsaved = false } = {}) {
  const nextPath = String(path || "").trim();
  if (!nextPath) {
    capabilityState.selectedPath = "";
    capabilityState.savedContent = "";
    hideCapabilityAgentsGuidance();
    renderCapabilitySettings();
    return;
  }
  if (!preserveUnsaved && !ensureCapabilitySwitchAllowed()) {
    return;
  }
  capabilityState.fileLoading = true;
  capabilityState.selectedPath = nextPath;
  renderCapabilitySettings();
  setCapabilityFeedback("正在加载能力定义...");
  try {
    const url = `/api/knowledge-base/capability-file?path=${encodeURIComponent(nextPath)}`;
    const response = await fetch(url);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.detail || `HTTP ${response.status}`);
    }
    capabilityState.savedContent = String(payload.content || "");
    if (capabilityEditorInputEl) {
      capabilityEditorInputEl.value = capabilityState.savedContent;
    }
    const selectedItem = capabilityByPath(nextPath);
    if (!selectedItem || !["skill", "schema"].includes(String(selectedItem.source || ""))) {
      hideCapabilityAgentsGuidance();
    }
    setCapabilityFeedback("");
  } catch (error) {
    capabilityState.savedContent = "";
    if (capabilityEditorInputEl) {
      capabilityEditorInputEl.value = "";
    }
    hideCapabilityAgentsGuidance();
    setCapabilityFeedback(`加载失败：${error.message}`, true);
  } finally {
    capabilityState.fileLoading = false;
    renderCapabilitySettings();
  }
}

async function loadCapabilities(force = false) {
  if (capabilityState.loading) {
    return;
  }
  if (!force && capabilityState.loaded) {
    renderCapabilitySettings();
    return;
  }
  capabilityState.loading = true;
  renderCapabilitySettings();
  setCapabilityFeedback("正在读取当前知识库的 skills 与 schemas...");
  try {
    const response = await fetch("/api/knowledge-base/capabilities");
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.detail || `HTTP ${response.status}`);
    }
    capabilityState.items = Array.isArray(payload?.items) ? payload.items : [];
    capabilityState.loaded = true;
    const hasSelected = capabilityByPath(capabilityState.selectedPath);
    const nextSelection = hasSelected?.path || capabilityItems()[0]?.path || "";
    setCapabilityFeedback("");
    renderCapabilitySettings();
    if (nextSelection) {
      await loadCapabilityFile(nextSelection, { preserveUnsaved: true });
    } else {
      capabilityState.selectedPath = "";
      capabilityState.savedContent = "";
      if (capabilityEditorInputEl) {
        capabilityEditorInputEl.value = "";
      }
      renderCapabilitySettings();
    }
  } catch (error) {
    setCapabilityFeedback(`加载失败：${error.message}`, true);
  } finally {
    capabilityState.loading = false;
    renderCapabilitySettings();
  }
}

function resetCapabilityEditor() {
  if (!capabilityEditorInputEl) {
    return;
  }
  capabilityEditorInputEl.value = capabilityState.savedContent;
  setCapabilityFeedback("");
  renderCapabilitySettings();
}

async function saveCapabilityFile() {
  const item = capabilityByPath(capabilityState.selectedPath);
  if (!item || !capabilityEditorInputEl) {
    return;
  }
  capabilityState.saving = true;
  renderCapabilitySettings();
  setCapabilityFeedback("正在保存能力定义...");
  try {
    const response = await fetch("/api/knowledge-base/capability-file", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: item.path,
        content: capabilityEditorInputEl.value,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.detail || `HTTP ${response.status}`);
    }
    capabilityState.savedContent = String(payload.content || capabilityEditorInputEl.value || "");
    capabilityState.loaded = false;
    setCapabilityFeedback("");
    showSettingsToast(payload?.detail || "能力定义已保存。");
    if (["skill", "schema"].includes(String(item.source || ""))) {
      showCapabilityAgentsGuidance(item);
    } else {
      hideCapabilityAgentsGuidance();
    }
    await loadCapabilities(true);
    await refreshSlashCommandsAfterCapabilityChange();
  } catch (error) {
    setCapabilityFeedback(`保存失败：${error.message}`, true);
  } finally {
    capabilityState.saving = false;
    renderCapabilitySettings();
  }
}

async function deleteCapability() {
  const item = capabilityByPath(capabilityState.selectedPath);
  if (!item) {
    return;
  }
  const label = (() => {
    switch (item.source) {
      case "schema":
        return "Schema";
      case "schema-doc":
        return "Schema 文档";
      case "skill-doc":
        return "Skill 文档";
      case "knowledge-base-doc":
        return "知识库文档";
      default:
        return "Skill";
    }
  })();
  const targetName = item.name || item.command || item.path;
  if (!window.confirm(`确认删除 ${label} “${targetName}” 吗？`)) {
    return;
  }
  capabilityState.saving = true;
  renderCapabilitySettings();
  setCapabilityFeedback(`正在删除 ${label}...`);
  try {
    const response = await fetch(`/api/knowledge-base/capability-file?path=${encodeURIComponent(item.path)}`, {
      method: "DELETE",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.detail || `HTTP ${response.status}`);
    }
    capabilityState.loaded = false;
    capabilityState.selectedPath = "";
    capabilityState.savedContent = "";
    if (capabilityEditorInputEl) {
      capabilityEditorInputEl.value = "";
    }
    hideCapabilityAgentsGuidance();
    setCapabilityFeedback("");
    showSettingsToast(payload?.detail || "能力定义已删除。");
    await loadCapabilities(true);
    await refreshSlashCommandsAfterCapabilityChange();
  } catch (error) {
    setCapabilityFeedback(`删除失败：${error.message}`, true);
  } finally {
    capabilityState.saving = false;
    renderCapabilitySettings();
  }
}

async function createCapability(source) {
  const sourceLabel = source === "schema" ? "Schema" : "Skill";
  const nextName = String(capabilityCreateNameInputEl?.value || "").trim();
  if (!nextName) {
    setCapabilityFeedback(`请先输入 ${sourceLabel} 名称。`, true);
    capabilityCreateNameInputEl?.focus();
    return;
  }
  if (!ensureCapabilitySwitchAllowed()) {
    return;
  }
  capabilityState.saving = true;
  renderCapabilitySettings();
  setCapabilityFeedback(`正在创建 ${sourceLabel}...`);
  try {
    const response = await fetch("/api/knowledge-base/capability-file", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source,
        name: nextName,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.detail || `HTTP ${response.status}`);
    }
    capabilityState.loaded = false;
    setCapabilityFeedback("");
    showSettingsToast(payload?.detail || `${sourceLabel} 已创建。`);
    if (capabilityCreateNameInputEl) {
      capabilityCreateNameInputEl.value = "";
    }
    await loadCapabilities(true);
    await refreshSlashCommandsAfterCapabilityChange();
    if (payload?.path) {
      await loadCapabilityFile(String(payload.path), { preserveUnsaved: true });
      const createdItem = capabilityByPath(String(payload.path));
      if (createdItem) {
        showCapabilityAgentsGuidance(createdItem);
      }
    }
  } catch (error) {
    setCapabilityFeedback(`创建失败：${error.message}`, true);
  } finally {
    capabilityState.saving = false;
    renderCapabilitySettings();
  }
}

function renderDiagnosticsList(element, items) {
  if (!element) {
    return;
  }
  element.innerHTML = "";
  items.forEach(([label, value]) => {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    element.appendChild(dt);
    element.appendChild(dd);
  });
}

function diagnosticsPathLabel(item) {
  if (!item || !item.path) {
    return "—";
  }
  const parts = [item.path];
  parts.push(item.exists ? "存在" : "不存在");
  if (item.exists) {
    parts.push(item.is_dir ? "目录" : "文件");
  }
  return parts.join(" · ");
}

function diagnosticsValue(value, fallback = "—") {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value ? "是" : "否";
  }
  const text = String(value).trim();
  return text || fallback;
}

function renderDiagnostics() {
  const payload = diagnosticsState.data;
  const health = payload?.health || {};
  const knowledgeBase = payload?.knowledge_base || {};
  const sessions = payload?.sessions || {};
  const providers = payload?.providers || {};
  const defaults = providers.defaults || {};
  const piRuntime = payload?.pi_runtime || {};

  if (diagnosticsStatusChipsEl) {
    diagnosticsStatusChipsEl.innerHTML = "";
    const chips = [
      `运行时：${diagnosticsValue(health.runtime)}`,
      `Pi RPC：${health.pi_rpc_available ? "可用" : "不可用"}`,
      `Pi 状态：${health.runtime_options_ok ? "已连通" : "拉取失败"}`,
      `知识库：${diagnosticsValue(knowledgeBase.name)}`,
    ];
    chips.forEach((label) => {
      const chip = document.createElement("span");
      chip.className = "settings-chip";
      chip.textContent = label;
      diagnosticsStatusChipsEl.appendChild(chip);
    });
  }

  renderDiagnosticsList(diagnosticsKbListEl, [
    ["名称", diagnosticsValue(knowledgeBase.name)],
    ["路径", diagnosticsValue(knowledgeBase.path)],
    ["Session Namespace", diagnosticsValue(knowledgeBase.session_namespace)],
    ["Wiki 目录", diagnosticsPathLabel(knowledgeBase.wiki_dir)],
    ["Raw 目录", diagnosticsPathLabel(knowledgeBase.raw_dir)],
    ["Inbox 目录", diagnosticsPathLabel(knowledgeBase.inbox_dir)],
  ]);

  renderDiagnosticsList(diagnosticsPiListEl, [
    ["命令", diagnosticsValue(piRuntime.command)],
    ["命令路径", diagnosticsValue(piRuntime.command_path)],
    ["超时", diagnosticsValue(piRuntime.timeout_seconds, "已关闭")],
    ["工作目录", diagnosticsValue(piRuntime.workdir)],
    ["默认思考", diagnosticsValue(piRuntime.default_thinking_level)],
    ["当前模型", diagnosticsValue(piRuntime.current_provider && piRuntime.current_model_id ? `${piRuntime.current_provider}/${piRuntime.current_model_id}` : "")],
    ["当前思考", diagnosticsValue(piRuntime.current_thinking_level)],
    ["可用模型数", diagnosticsValue(piRuntime.available_model_count)],
    ["可用 Provider 数", diagnosticsValue(piRuntime.available_provider_count)],
    ["Extension", Array.isArray(providers.extension_paths) && providers.extension_paths.length ? providers.extension_paths.join("\n") : "未加载"],
    ["Pi 错误", diagnosticsValue(piRuntime.runtime_error, "无")],
  ]);

  renderDiagnosticsList(diagnosticsSessionListEl, [
    ["活跃会话数", diagnosticsValue(sessions.pool_count)],
    ["Session 目录", diagnosticsPathLabel(sessions.session_dir)],
    ["Agent 模式", diagnosticsValue(health.agent_mode)],
    ["Pi 后端", diagnosticsValue(health.pi_backend_mode)],
    ["桌面运行时", diagnosticsValue(health.desktop_runtime)],
    ["刷新时间", diagnosticsValue(payload?.generated_at)],
  ]);

  renderDiagnosticsList(diagnosticsProviderListEl, [
    ["默认 Provider", diagnosticsValue(defaults.provider)],
    ["默认模型", diagnosticsValue(defaults.model)],
    ["默认思考", diagnosticsValue(defaults.thinking_level)],
    ["Profile 数", diagnosticsValue(providers.profile_count)],
    ["gogo 管理数", diagnosticsValue(providers.managed_count)],
    ["已连 OAuth", diagnosticsValue(providers.oauth_connected_count)],
  ]);
}

async function loadDiagnostics(force = false) {
  if (diagnosticsState.loading) {
    return;
  }
  if (!force && diagnosticsState.data) {
    renderDiagnostics();
    return;
  }
  diagnosticsState.loading = true;
  refreshDiagnosticsButtonEl && (refreshDiagnosticsButtonEl.disabled = true);
  setDiagnosticsFeedback("正在刷新诊断信息...");
  try {
    const response = await fetch("/api/settings/diagnostics");
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.detail || `HTTP ${response.status}`);
    }
    diagnosticsState.data = payload;
    diagnosticsState.loadedAt = Date.now();
    renderDiagnostics();
    setDiagnosticsFeedback("");
    showSettingsToast(`诊断信息已刷新：${diagnosticsValue(payload.generated_at)}`);
  } catch (error) {
    setDiagnosticsFeedback(`刷新失败：${error.message}`, true);
  } finally {
    diagnosticsState.loading = false;
    refreshDiagnosticsButtonEl && (refreshDiagnosticsButtonEl.disabled = false);
  }
}

function setActiveSettingsSection(section) {
  const nextSection =
    section === "current-skills" || section === "model-providers" || section === "diagnostics"
      ? section
      : "knowledge-base";
  if (nextSection !== activeSettingsSection) {
    clearSettingsFeedback();
  }
  activeSettingsSection =
    nextSection;
  settingsNavButtonEls.forEach((button) => {
    const isActive = button.dataset.settingsSection === activeSettingsSection;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  settingsSectionPaneEls.forEach((pane) => {
    pane.classList.toggle("active", pane.dataset.settingsSectionPane === activeSettingsSection);
  });
  if (activeSettingsSection === "current-skills") {
    void loadCapabilities();
  }
  if (activeSettingsSection === "diagnostics") {
    void loadDiagnostics();
  }
}

function renderKnowledgeBaseSettings() {
  const knowledgeBase = appSettings?.knowledge_base || null;
  if (knowledgeBaseNameEl) {
    knowledgeBaseNameEl.textContent = knowledgeBase?.name || "Knowledge Base";
    knowledgeBaseNameEl.title = knowledgeBase?.path || knowledgeBase?.name || "Knowledge Base";
  }
  if (knowledgeBasePathInputEl) {
    knowledgeBasePathInputEl.value = knowledgeBase?.path || "";
  }
  if (pickKnowledgeBasePathButtonEl) {
    pickKnowledgeBasePathButtonEl.classList.toggle("hidden", !isDesktopRuntime());
  }
  if (!knowledgeBaseRecentListEl) {
    return;
  }
  knowledgeBaseRecentListEl.innerHTML = "";
  const recent = Array.isArray(knowledgeBase?.recent) ? knowledgeBase.recent : [];
  recent.forEach((item) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "settings-chip";
    chip.textContent = item.name || item.path;
    chip.title = item.path || item.name || "";
    chip.addEventListener("click", () => {
      if (knowledgeBasePathInputEl) {
        knowledgeBasePathInputEl.value = item.path || "";
        knowledgeBasePathInputEl.focus();
        knowledgeBasePathInputEl.select();
      }
    });
    knowledgeBaseRecentListEl.appendChild(chip);
  });
}

function providerProfiles() {
  return Array.isArray(appSettings?.model_providers?.profiles) ? appSettings.model_providers.profiles : [];
}

function providerProfileByKey(providerKey, source = appSettings) {
  const profiles = Array.isArray(source?.model_providers?.profiles) ? source.model_providers.profiles : [];
  const targetKey = String(providerKey || "").trim().toLowerCase();
  return (
    profiles.find(
      (item) => String(item?.provider_key || "").trim().toLowerCase() === targetKey
    ) || null
  );
}

function providerDesktopLoginFingerprint(profile) {
  if (!profile || typeof profile !== "object") {
    return "";
  }
  return JSON.stringify({
    oauth_connected: Boolean(profile.oauth_connected),
    oauth_expires_at: Number(profile.oauth_expires_at || 0),
    oauth_account_id: String(profile.oauth_account_id || ""),
    oauth_email: String(profile.oauth_email || ""),
    oauth_project_id: String(profile.oauth_project_id || ""),
  });
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function providerApiTypes() {
  return Array.isArray(appSettings?.model_providers?.api_types) ? appSettings.model_providers.api_types : [];
}

function providerOauthPresets() {
  return Array.isArray(appSettings?.model_providers?.oauth_presets)
    ? appSettings.model_providers.oauth_presets
    : [];
}

function providerOauthAuthModes() {
  return Array.isArray(appSettings?.model_providers?.oauth_auth_modes)
    ? appSettings.model_providers.oauth_auth_modes
    : [];
}

function providerCapabilities() {
  return appSettings?.model_providers?.capabilities || {};
}

function formatMsToLocalInput(rawValue) {
  const value = Number(rawValue || 0);
  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }
  const date = new Date(value);
  const pad = (num) => String(num).padStart(2, "0");
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}

function parseLocalInputToMs(rawValue) {
  const text = String(rawValue || "").trim();
  if (!text) {
    return null;
  }
  const parsed = new Date(text);
  const time = parsed.getTime();
  return Number.isFinite(time) ? time : null;
}

function normalizeImportedModelItem(rawItem) {
  if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) {
    return null;
  }
  const modelId = String(rawItem.id || "").trim();
  if (!modelId) {
    return null;
  }
  const item = { id: modelId };
  const name = String(rawItem.name || "").trim();
  if (name) {
    item.name = name;
  }
  if (Object.prototype.hasOwnProperty.call(rawItem, "reasoning")) {
    item.reasoning = Boolean(rawItem.reasoning);
  }
  if (Array.isArray(rawItem.input)) {
    const normalizedInput = rawItem.input
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean);
    if (normalizedInput.length) {
      item.input = normalizedInput;
    }
  }
  ["cost", "compat"].forEach((key) => {
    if (rawItem[key] && typeof rawItem[key] === "object" && !Array.isArray(rawItem[key])) {
      item[key] = rawItem[key];
    }
  });
  ["contextWindow", "maxTokens"].forEach((key) => {
    const value = Number(rawItem[key]);
    if (Number.isFinite(value) && value > 0) {
      item[key] = value;
    }
  });
  Object.entries(rawItem).forEach(([key, value]) => {
    if (key in item || ["id", "name", "reasoning", "input", "cost", "compat", "contextWindow", "maxTokens"].includes(key)) {
      return;
    }
    if (
      typeof value === "string" ||
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))
    ) {
      item[key] = value;
      return;
    }
    if (value && typeof value === "object") {
      item[key] = value;
    }
  });
  return item;
}

function pickImportedProviderConfig(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return null;
  }

  const directModels = Array.isArray(source.models) ? source.models : null;
  if (directModels) {
    return {
      providerKey: String(source.provider || source.providerKey || "").trim(),
      displayName: String(source.name || source.displayName || "").trim(),
      config: source,
      rawModels: directModels,
    };
  }

  const nestedModels = source.models;
  if (nestedModels && typeof nestedModels === "object" && !Array.isArray(nestedModels)) {
    if (Array.isArray(nestedModels.models)) {
      return {
        providerKey: String(nestedModels.provider || nestedModels.providerKey || "").trim(),
        displayName: String(nestedModels.name || nestedModels.displayName || "").trim(),
        config: nestedModels,
        rawModels: nestedModels.models,
      };
    }

    const providers = nestedModels.providers;
    if (providers && typeof providers === "object" && !Array.isArray(providers)) {
      const preferredKey = String(providerKeyInputEl?.value || "").trim();
      const entries = Object.entries(providers).filter(
        ([, value]) => value && typeof value === "object" && !Array.isArray(value) && Array.isArray(value.models)
      );
      if (!entries.length) {
        return null;
      }
      const matched =
        entries.find(([key]) => key === preferredKey) ||
        entries.find(([key]) => key.toLowerCase() === preferredKey.toLowerCase()) ||
        entries[0];
      const [providerKey, providerConfig] = matched;
      return {
        providerKey: String(providerKey || "").trim(),
        displayName: String(providerConfig.name || providerConfig.displayName || providerKey || "").trim(),
        config: providerConfig,
        rawModels: providerConfig.models,
      };
    }
  }

  return null;
}

function normalizeImportJsonText(rawValue) {
  const text = String(rawValue || "").trim();
  if (!text) {
    return "";
  }
  if (text.startsWith("{") || text.startsWith("[")) {
    return text;
  }
  if (/^"(?:[^"\\]|\\.)+"\s*:/.test(text)) {
    return `{${text}}`;
  }
  return text;
}

function parseProviderImportPayload(rawValue) {
  const text = normalizeImportJsonText(rawValue);
  if (!text || (!text.startsWith("{") && !text.startsWith("["))) {
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`模型配置 JSON 解析失败：${error.message}`);
  }

  if (Array.isArray(parsed)) {
    const models = parsed.map(normalizeImportedModelItem).filter(Boolean);
    if (!models.length) {
      return null;
    }
    return {
      providerKey: "",
      displayName: "",
      models,
      baseUrl: "",
      apiKey: "",
      apiType: "",
    };
  }

  const source =
    parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  const importedProvider = pickImportedProviderConfig(source);
  const rawModels = importedProvider?.rawModels;
  if (!Array.isArray(rawModels)) {
    return null;
  }

  const models = rawModels.map(normalizeImportedModelItem).filter(Boolean);
  if (!models.length) {
    return null;
  }

  return {
    providerKey: String(importedProvider?.providerKey || "").trim(),
    displayName: String(importedProvider?.displayName || "").trim(),
    models,
    baseUrl: String(importedProvider?.config?.baseUrl || importedProvider?.config?.base_url || source.baseUrl || source.base_url || "").trim(),
    apiKey: String(importedProvider?.config?.apiKey || importedProvider?.config?.api_key || source.apiKey || source.api_key || "").trim(),
    apiType: String(importedProvider?.config?.api || importedProvider?.config?.apiType || importedProvider?.config?.api_type || source.api || source.apiType || source.api_type || "").trim(),
  };
}

function applyProviderImportPayload(payload) {
  if (!payload || !Array.isArray(payload.models) || !payload.models.length) {
    return false;
  }
  if (payload.providerKey && providerKeyInputEl && !String(providerKeyInputEl.value || "").trim()) {
    providerKeyInputEl.value = payload.providerKey;
  }
  if (payload.displayName && providerDisplayNameInputEl && !String(providerDisplayNameInputEl.value || "").trim()) {
    providerDisplayNameInputEl.value = payload.displayName;
  }
  if (providerModelsTextEl) {
    providerModelsTextEl.value = JSON.stringify({ models: payload.models }, null, 2);
  }
  if (payload.baseUrl && providerBaseUrlInputEl) {
    providerBaseUrlInputEl.value = payload.baseUrl;
  }
  if (payload.apiKey && providerApiKeyInputEl) {
    providerApiKeyInputEl.value = payload.apiKey;
  }
  if (payload.apiType && providerApiTypeSelectEl) {
    const nextApiType = payload.apiType;
    const hasOption = providerApiTypes().includes(nextApiType);
    if (!hasOption) {
      const option = document.createElement("option");
      option.value = nextApiType;
      option.textContent = nextApiType;
      providerApiTypeSelectEl.appendChild(option);
    }
    providerApiTypeSelectEl.value = nextApiType;
  }
  return true;
}

function tryImportProviderConfigFromModelsText({ silent = false } = {}) {
  if (providerFormMode !== "api" || !providerModelsTextEl) {
    return false;
  }
  const text = normalizeImportJsonText(providerModelsTextEl.value);
  if (!text || (!text.startsWith("{") && !text.startsWith("["))) {
    return false;
  }
  try {
    const payload = parseProviderImportPayload(text);
    if (!payload) {
      return false;
    }
    const applied = applyProviderImportPayload(payload);
    if (applied && !silent) {
      setProviderFeedback("");
      showSettingsToast("已从 JSON 中识别并填充 API 配置与模型列表。");
    }
    return applied;
  } catch (error) {
    if (!silent) {
      setProviderFeedback(String(error.message || error), true);
    }
    return false;
  }
}

function importProviderConfigFromModelsText() {
  const text = String(providerModelsTextEl?.value || "").trim();
  if (!text) {
    setProviderFeedback("请先粘贴厂商提供的 JSON 配置。", true);
    return;
  }
  const imported = tryImportProviderConfigFromModelsText({ silent: false });
  if (!imported) {
    setProviderFeedback("没有识别到可导入的模型 JSON，请确认配置里包含 `models` 数组。", true);
  }
}

function renderApiTypeOptions() {
  if (!providerApiTypeSelectEl) {
    return;
  }
  const current = providerApiTypeSelectEl.value;
  providerApiTypeSelectEl.innerHTML = "";
  providerApiTypes().forEach((apiType) => {
    const option = document.createElement("option");
    option.value = apiType;
    option.textContent = apiType;
    providerApiTypeSelectEl.appendChild(option);
  });
  if (current && providerApiTypes().includes(current)) {
    providerApiTypeSelectEl.value = current;
  } else if (!providerApiTypeSelectEl.value && providerApiTypes()[0]) {
    providerApiTypeSelectEl.value = providerApiTypes()[0];
  }
}

function renderOauthPresetOptions() {
  if (!providerOauthPresetSelectEl) {
    return;
  }
  const current = providerOauthPresetSelectEl.value;
  providerOauthPresetSelectEl.innerHTML = "";

  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "自定义 / 已存在的 Provider Key";
  providerOauthPresetSelectEl.appendChild(blank);

  providerOauthPresets().forEach((preset) => {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = preset.label || preset.id;
    providerOauthPresetSelectEl.appendChild(option);
  });
  providerOauthPresetSelectEl.value = current || "";
}

function renderOauthAuthModeOptions() {
  if (!providerAuthModeSelectEl) {
    return;
  }
  const current = providerAuthModeSelectEl.value || providerAuthMode;
  providerAuthModeSelectEl.innerHTML = "";
  providerOauthAuthModes().forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.label || item.id;
    providerAuthModeSelectEl.appendChild(option);
  });
  const available = providerOauthAuthModes().map((item) => item.id);
  providerAuthMode = available.includes(current) ? current : available[0] || "desktop-pi-login";
  providerAuthModeSelectEl.value = providerAuthMode;
}

function updateProviderAuthModeHelp() {
  if (!providerAuthModeHelpEl) {
    return;
  }
  const desktopReady = Boolean(providerCapabilities().desktop_cli_login);
  if (providerAuthMode === "manual-tokens") {
    providerAuthModeHelpEl.textContent =
      "当前会把 access / refresh token 直接写入 Pi 的 auth.json，适合作为 Web 版兼容方案，或给自定义 OAuth Provider 临时接入。";
    return;
  }
  providerAuthModeHelpEl.textContent = desktopReady
    ? "桌面版会打开 Pi CLI 并触发原生 `/login`；gogo-app 只负责展示状态和刷新结果。"
    : "当前还是 Web 版，这里先保存“未来由 Pi CLI 登录”的 provider 定义；真正的 `/login` 触发会在桌面版接上。";
}

function applyProviderAuthMode(mode) {
  providerAuthMode = mode === "manual-tokens" ? "manual-tokens" : "desktop-pi-login";
  if (providerAuthModeSelectEl) {
    providerAuthModeSelectEl.value = providerAuthMode;
  }
  providerOauthTokenShellEl?.classList.add("hidden");
  updateProviderAuthModeHelp();
}

function applyProviderMode(mode) {
  providerFormMode = mode === "oauth" ? "oauth" : "api";
  providerModeApiButtonEl?.classList.toggle("active", providerFormMode === "api");
  providerModeOauthButtonEl?.classList.toggle("active", providerFormMode === "oauth");
  providerModeApiButtonEl?.setAttribute("aria-pressed", String(providerFormMode === "api"));
  providerModeOauthButtonEl?.setAttribute("aria-pressed", String(providerFormMode === "oauth"));
  const isApiMode = providerFormMode === "api";
  providerSharedFieldsEl?.classList.toggle("hidden", !isApiMode);
  providerApiFieldsEl?.classList.toggle("hidden", !isApiMode);
  providerAuthHeaderShellEl?.classList.toggle("hidden", !isApiMode);
  providerApiSecretShellEl?.classList.toggle("hidden", !isApiMode);
  providerModelsShellEl?.classList.toggle("hidden", !isApiMode);
  providerApiActionsEl?.classList.toggle("hidden", !isApiMode);
  providerOauthIntroShellEl?.classList.toggle("hidden", isApiMode);
  providerOauthPresetShellEl?.classList.add("hidden");
  providerAuthModeShellEl?.classList.add("hidden");
  providerOauthTokenShellEl?.classList.add("hidden");
  if (providerAuthHeaderInputEl) {
    providerAuthHeaderInputEl.disabled = !isApiMode;
  }
  if (saveProviderButtonEl) {
    saveProviderButtonEl.textContent = editingProviderKey ? "更新 Provider" : "保存 Provider";
  }
  applyProviderAuthMode(providerAuthMode);
}

function resetProviderForm(mode = providerFormMode) {
  editingProviderKey = "";
  providerAuthMode = "desktop-pi-login";
  providerKeyInputEl && (providerKeyInputEl.value = "");
  providerDisplayNameInputEl && (providerDisplayNameInputEl.value = "");
  providerOauthPresetSelectEl && (providerOauthPresetSelectEl.value = "");
  providerAuthModeSelectEl && (providerAuthModeSelectEl.value = providerAuthMode);
  providerBaseUrlInputEl && (providerBaseUrlInputEl.value = "");
  providerAuthHeaderInputEl && (providerAuthHeaderInputEl.checked = false);
  providerApiKeyInputEl && (providerApiKeyInputEl.value = "");
  providerAccessTokenInputEl && (providerAccessTokenInputEl.value = "");
  providerRefreshTokenInputEl && (providerRefreshTokenInputEl.value = "");
  providerOauthExpiresInputEl && (providerOauthExpiresInputEl.value = "");
  providerOauthAccountInputEl && (providerOauthAccountInputEl.value = "");
  providerModelsTextEl && (providerModelsTextEl.value = "");
  renderApiTypeOptions();
  renderOauthAuthModeOptions();
  applyProviderMode(mode);
}

function providerSummary(profile) {
  if (profile.config_kind === "oauth") {
    return "OAuth";
  }
  return "API";
}

function canTriggerDesktopPiLogin(profile) {
  return profile?.config_kind === "oauth" && profile?.auth_mode === "desktop-pi-login";
}

function populateProviderForm(profile) {
  if (!profile) {
    resetProviderForm(providerFormMode);
    return;
  }
  setActiveSettingsSection("model-providers");
  editingProviderKey = String(profile.provider_key || "");
  applyProviderMode(profile.config_kind === "oauth" ? "oauth" : "api");
  if (providerKeyInputEl) {
    providerKeyInputEl.value = profile.provider_key || "";
  }
  if (providerDisplayNameInputEl) {
    providerDisplayNameInputEl.value = profile.display_name || "";
  }
  if (providerOauthPresetSelectEl) {
    const matchedPreset = providerOauthPresets().find((item) => item.id === profile.provider_key);
    providerOauthPresetSelectEl.value = matchedPreset ? matchedPreset.id : "";
  }
  providerAuthMode = profile.auth_mode === "manual-tokens" ? "manual-tokens" : "desktop-pi-login";
  renderOauthAuthModeOptions();
  if (providerBaseUrlInputEl) {
    providerBaseUrlInputEl.value = profile.base_url || "";
  }
  renderApiTypeOptions();
  if (providerApiTypeSelectEl && profile.api_type) {
    providerApiTypeSelectEl.value = profile.api_type;
  }
  if (providerAuthHeaderInputEl) {
    providerAuthHeaderInputEl.checked = Boolean(profile.auth_header);
  }
  if (providerApiKeyInputEl) {
    providerApiKeyInputEl.value = "";
  }
  if (providerAccessTokenInputEl) {
    providerAccessTokenInputEl.value = "";
  }
  if (providerRefreshTokenInputEl) {
    providerRefreshTokenInputEl.value = "";
  }
  if (providerOauthExpiresInputEl) {
    providerOauthExpiresInputEl.value = formatMsToLocalInput(profile.oauth_expires_at);
  }
  if (providerOauthAccountInputEl) {
    providerOauthAccountInputEl.value =
      profile.oauth_email || profile.oauth_account_id || profile.oauth_project_id || "";
  }
  if (providerModelsTextEl) {
    providerModelsTextEl.value = profile.models_text || "";
  }
  applyProviderAuthMode(providerAuthMode);
  setProviderFeedback(`正在编辑 ${profile.display_name || profile.provider_key}`);
}

function renderProviderProfiles() {
  if (!providerProfileListEl || !providerProfileEmptyEl) {
    return;
  }
  const profiles = providerProfiles();
  providerProfileListEl.innerHTML = "";
  providerProfileEmptyEl.classList.toggle("hidden", profiles.length > 0);

  profiles.forEach((profile) => {
    const card = document.createElement("article");
    card.className = "settings-provider-card";

    const top = document.createElement("div");
    top.className = "settings-provider-top";

    const identity = document.createElement("div");
    const title = document.createElement("p");
    title.className = "settings-provider-title";
    title.textContent = profile.display_name || profile.provider_key || "未命名 Provider";
    identity.appendChild(title);

    const actions = document.createElement("div");
    actions.className = "settings-provider-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "button button-secondary";
    editButton.textContent = "编辑";
    editButton.addEventListener("click", () => populateProviderForm(profile));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "button button-danger-subtle";
    deleteButton.textContent = "删除";
    deleteButton.addEventListener("click", async () => {
      if (!window.confirm(`确认删除 ${profile.provider_key} 吗？`)) {
        return;
      }
      await deleteProviderProfile(profile.provider_key);
    });

    actions.appendChild(editButton);
    actions.appendChild(deleteButton);
    top.appendChild(identity);
    top.appendChild(actions);
    card.appendChild(top);

    const meta = document.createElement("div");
    meta.className = "settings-provider-meta";
    [providerSummary(profile)].filter(Boolean).forEach((label) => {
      const chip = document.createElement("span");
      chip.className = "settings-provider-chip";
      chip.textContent = label;
      meta.appendChild(chip);
    });
    card.appendChild(meta);
    providerProfileListEl.appendChild(card);
  });
}

function renderModelProviderSettings() {
  renderApiTypeOptions();
  renderOauthPresetOptions();
  renderOauthAuthModeOptions();
  renderProviderProfiles();
  applyProviderMode(providerFormMode);
}

function renderSettings() {
  renderKnowledgeBaseSettings();
  renderCapabilitySettings();
  renderModelProviderSettings();
}

async function loadAppSettings() {
  const response = await fetch("/api/settings");
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  appSettings = await response.json();
  renderSettings();
}

function openSettingsPanel() {
  settingsOverlayEl?.classList.remove("hidden");
  setActiveSettingsSection(activeSettingsSection);
  clearSettingsFeedback();
}

function cancelDesktopPiLoginPolling() {
  desktopPiLoginPollToken += 1;
}

function closeSettingsPanel() {
  cancelDesktopPiLoginPolling();
  settingsOverlayEl?.classList.add("hidden");
  clearSettingsFeedback();
}

async function applyKnowledgeBasePath(pathOverride = "") {
  const nextPath = String(pathOverride || knowledgeBasePathInputEl?.value || "").trim();
  if (!nextPath) {
    setKnowledgeBaseFeedback("请输入知识库路径。", true);
    return;
  }
  if (knowledgeBasePathInputEl) {
    knowledgeBasePathInputEl.value = nextPath;
  }
  if (!applyKnowledgeBasePathButtonEl) {
    return;
  }
  applyKnowledgeBasePathButtonEl.disabled = true;
  if (pickKnowledgeBasePathButtonEl) {
    pickKnowledgeBasePathButtonEl.disabled = true;
  }
  setKnowledgeBaseFeedback("正在切换知识库...");
  try {
    const response = await fetch("/api/settings/knowledge-base", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path: nextPath }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.detail || `HTTP ${response.status}`);
    }
    setKnowledgeBaseFeedback("知识库已切换，正在刷新页面...");
    window.setTimeout(() => window.location.reload(), 250);
  } catch (error) {
    setKnowledgeBaseFeedback(`切换失败：${error.message}`, true);
  } finally {
    applyKnowledgeBasePathButtonEl.disabled = false;
    if (pickKnowledgeBasePathButtonEl) {
      pickKnowledgeBasePathButtonEl.disabled = false;
    }
  }
}

async function pickKnowledgeBasePath() {
  if (!isDesktopRuntime() || !desktopBridge?.selectKnowledgeBaseDirectory) {
    setKnowledgeBaseFeedback("当前不是桌面版运行时，暂时不能直接调用系统目录选择器。", true);
    return;
  }
  if (pickKnowledgeBasePathButtonEl) {
    pickKnowledgeBasePathButtonEl.disabled = true;
  }
  setKnowledgeBaseFeedback("正在打开系统目录选择器...");
  try {
    const result = await desktopBridge.selectKnowledgeBaseDirectory();
    if (result?.canceled) {
      setKnowledgeBaseFeedback("");
      return;
    }
    const nextPath = String(result?.path || "").trim();
    if (!nextPath) {
      throw new Error("目录选择器没有返回有效路径。");
    }
    await applyKnowledgeBasePath(nextPath);
  } catch (error) {
    setKnowledgeBaseFeedback(`选择目录失败：${error.message}`, true);
  } finally {
    if (pickKnowledgeBasePathButtonEl) {
      pickKnowledgeBasePathButtonEl.disabled = false;
    }
  }
}

function providerSavePayload() {
  const configKind = providerFormMode;
  const providerKey = String(providerKeyInputEl?.value || "").trim();
  const accountHint = String(providerOauthAccountInputEl?.value || "").trim();
  return {
    config_kind: configKind,
    auth_mode: configKind === "oauth" ? providerAuthMode : "",
    provider_key: providerKey,
    display_name: String(providerDisplayNameInputEl?.value || "").trim(),
    base_url: String(providerBaseUrlInputEl?.value || "").trim(),
    api_type: String(providerApiTypeSelectEl?.value || "").trim(),
    models_text: String(providerModelsTextEl?.value || "").trim(),
    auth_header: Boolean(providerAuthHeaderInputEl?.checked),
    api_key: String(providerApiKeyInputEl?.value || "").trim(),
    clear_secret: false,
    access_token: String(providerAccessTokenInputEl?.value || "").trim(),
    refresh_token: String(providerRefreshTokenInputEl?.value || "").trim(),
    expires_at: parseLocalInputToMs(providerOauthExpiresInputEl?.value),
    account_id: configKind === "oauth" ? accountHint : "",
    email: configKind === "oauth" && accountHint.includes("@") ? accountHint : "",
    project_id: "",
  };
}

async function refreshPiOptionsAfterProviderChange() {
  try {
    await window.ChatWorkbench?.reloadPiOptions?.();
  } catch (error) {
    console.error("Failed to refresh Pi options after provider change:", error);
  }
}

async function triggerDesktopPiLogin(providerKey) {
  const pollToken = ++desktopPiLoginPollToken;
  const watchedProviderKey = String(providerKey || "").trim();
  const previousProfile = watchedProviderKey ? providerProfileByKey(watchedProviderKey) : null;
  const previousFingerprint = providerDesktopLoginFingerprint(previousProfile);
  setProviderFeedback("正在打开 Pi 登录终端...");
  try {
    const response = await fetch("/api/settings/pi-login", {
      method: "POST",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.detail || `HTTP ${response.status}`);
    }
    setProviderFeedback("");
    showSettingsToast(data.detail || "Pi 终端已打开，请在终端中手动输入 `/login`。");

    const deadline = Date.now() + DESKTOP_PI_LOGIN_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await sleep(DESKTOP_PI_LOGIN_POLL_INTERVAL_MS);
      if (pollToken !== desktopPiLoginPollToken || settingsOverlayEl?.classList.contains("hidden")) {
        return;
      }
      await loadAppSettings();
      await refreshPiOptionsAfterProviderChange();
      if (pollToken !== desktopPiLoginPollToken || settingsOverlayEl?.classList.contains("hidden")) {
        return;
      }
      if (watchedProviderKey) {
        const latestProfile = providerProfileByKey(watchedProviderKey);
        if (!latestProfile) {
          continue;
        }
        const latestFingerprint = providerDesktopLoginFingerprint(latestProfile);
        if (latestFingerprint !== previousFingerprint && latestProfile.oauth_connected) {
          setProviderFeedback("");
          showSettingsToast(`Pi 登录已完成，${watchedProviderKey} 的 Provider 状态和模型列表已自动刷新。`);
          return;
        }
      }
    }

    setProviderFeedback("");
    showSettingsToast(
      "Pi 终端已经打开；如果你还在登录中，请在终端中手动输入 `/login`。如果已经登录成功但状态未刷新，重新打开设置面板即可看到最新状态。"
    );
  } catch (error) {
    if (pollToken === desktopPiLoginPollToken) {
      setProviderFeedback(String(error.message || error), true);
    }
  }
}

async function saveProviderProfile() {
  tryImportProviderConfigFromModelsText({ silent: true });
  const payload = providerSavePayload();
  if (!payload.provider_key) {
    setProviderFeedback("请先填写 Provider Key。", true);
    return;
  }
  if (!saveProviderButtonEl) {
    return;
  }
  saveProviderButtonEl.disabled = true;
  setProviderFeedback("正在保存 Provider...");
  try {
    const response = await fetch("/api/settings/model-providers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.detail || `HTTP ${response.status}`);
    }
    appSettings = {
      ...(appSettings || {}),
      model_providers: data.model_providers || {},
    };
    renderModelProviderSettings();
    await refreshPiOptionsAfterProviderChange();
    resetProviderForm(providerFormMode);
    setProviderFeedback("");
    showSettingsToast(data.detail || "Provider 已保存。");
  } catch (error) {
    setProviderFeedback(`保存失败：${error.message}`, true);
  } finally {
    saveProviderButtonEl.disabled = false;
  }
}

async function deleteProviderProfile(providerKey) {
  setProviderFeedback(`正在删除 ${providerKey}...`);
  try {
    const safeKey = encodeURIComponent(providerKey);
    const response = await fetch(`/api/settings/model-providers/${safeKey}`, {
      method: "DELETE",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.detail || `HTTP ${response.status}`);
    }
    appSettings = {
      ...(appSettings || {}),
      model_providers: data.model_providers || {},
    };
    if (editingProviderKey === providerKey) {
      resetProviderForm(providerFormMode);
    }
    renderModelProviderSettings();
    await refreshPiOptionsAfterProviderChange();
    setProviderFeedback("");
    showSettingsToast(data.detail || "Provider 已删除。");
  } catch (error) {
    setProviderFeedback(`删除失败：${error.message}`, true);
  }
}

openSettingsButtonEl?.addEventListener("click", openSettingsPanel);
closeSettingsButtonEl?.addEventListener("click", closeSettingsPanel);
applyKnowledgeBasePathButtonEl?.addEventListener("click", () => {
  void applyKnowledgeBasePath();
});
pickKnowledgeBasePathButtonEl?.addEventListener("click", () => {
  void pickKnowledgeBasePath();
});
providerModeApiButtonEl?.addEventListener("click", () => applyProviderMode("api"));
providerModeOauthButtonEl?.addEventListener("click", () => applyProviderMode("oauth"));
providerAuthModeSelectEl?.addEventListener("change", () => {
  applyProviderAuthMode(String(providerAuthModeSelectEl.value || "desktop-pi-login"));
});
saveProviderButtonEl?.addEventListener("click", saveProviderProfile);
importProviderJsonButtonEl?.addEventListener("click", importProviderConfigFromModelsText);
providerDesktopLoginButtonEl?.addEventListener("click", async () => {
  await triggerDesktopPiLogin(String(providerKeyInputEl?.value || "").trim());
});
resetProviderButtonEl?.addEventListener("click", () => resetProviderForm(providerFormMode));
refreshDiagnosticsButtonEl?.addEventListener("click", async () => {
  await loadDiagnostics(true);
});
refreshCapabilityListButtonEl?.addEventListener("click", async () => {
  await loadCapabilities(true);
});
createSkillButtonEl?.addEventListener("click", async () => {
  await createCapability("skill");
});
createSchemaButtonEl?.addEventListener("click", async () => {
  await createCapability("schema");
});
capabilityCreateNameInputEl?.addEventListener("keydown", async (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    await createCapability("skill");
  }
});
deleteCapabilityButtonEl?.addEventListener("click", async () => {
  await deleteCapability();
});
resetCapabilityButtonEl?.addEventListener("click", resetCapabilityEditor);
saveCapabilityButtonEl?.addEventListener("click", async () => {
  await saveCapabilityFile();
});
capabilityEditorInputEl?.addEventListener("input", () => {
  renderCapabilitySettings();
});
copyCapabilityAgentsSnippetButtonEl?.addEventListener("click", async () => {
  const copied = await copyTextToClipboard(capabilityAgentsGuidanceState.snippet);
  if (copied) {
    showSettingsToast("已复制 AGENTS 片段。");
  } else {
    setCapabilityFeedback("复制失败，请手动复制上面的片段。", true);
  }
});
openCapabilityAgentsButtonEl?.addEventListener("click", async () => {
  setActiveSettingsSection("current-skills");
  if (!capabilityByPath("AGENTS.md")) {
    setCapabilityFeedback("当前知识库根目录下未找到 AGENTS.md。", true);
    return;
  }
  if (!ensureCapabilitySwitchAllowed()) {
    return;
  }
  await loadCapabilityFile("AGENTS.md");
});

knowledgeBasePathInputEl?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    void applyKnowledgeBasePath();
  }
});

providerOauthPresetSelectEl?.addEventListener("change", () => {
  const presetId = String(providerOauthPresetSelectEl.value || "").trim();
  if (!presetId) {
    return;
  }
  const preset = providerOauthPresets().find((item) => item.id === presetId);
  if (!preset) {
    return;
  }
  if (providerKeyInputEl) {
    providerKeyInputEl.value = preset.id;
  }
  if (providerDisplayNameInputEl && !providerDisplayNameInputEl.value.trim()) {
    providerDisplayNameInputEl.value = preset.label || preset.id;
  }
  applyProviderAuthMode("desktop-pi-login");
});

providerModelsTextEl?.addEventListener("blur", () => {
  void tryImportProviderConfigFromModelsText();
});

providerModelsTextEl?.addEventListener("paste", () => {
  window.setTimeout(() => {
    void tryImportProviderConfigFromModelsText({ silent: true });
  }, 0);
});

settingsOverlayEl?.addEventListener("click", (event) => {
  if (event.target === settingsOverlayEl) {
    closeSettingsPanel();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && settingsOverlayEl && !settingsOverlayEl.classList.contains("hidden")) {
    closeSettingsPanel();
  }
});

void loadAppSettings().catch((error) => {
  console.error("Failed to load app settings:", error);
  if (knowledgeBaseNameEl) {
    knowledgeBaseNameEl.textContent = "Knowledge Base";
  }
});

resetProviderForm("api");
setActiveSettingsSection("knowledge-base");

window.WorkbenchUI = {
  getState: () => ({ ...workbenchState }),
  setLayout,
  showChat,
  hideChat,
  showWiki,
  hideWiki,
  ensureChatVisible: showChat,
  ensureWikiVisible: showWiki,
  getAppSettings: () => appSettings,
  showToast: showSettingsToast,
};
