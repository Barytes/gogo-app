const bodyEl = document.body;
const layoutWikiButtonEl = document.querySelector("#layout-mode-wiki");
const layoutChatButtonEl = document.querySelector("#layout-mode-chat");
const hideChatButtonEl = document.querySelector("#hide-chat-panel");
const hideWikiButtonEl = document.querySelector("#hide-wiki-panel");
const hideWikiPanelChatButtonEl = document.querySelector("#hide-wiki-panel-chat");
const showChatButtonEl = document.querySelector("#show-chat-panel");
const showWikiButtonEl = document.querySelector("#show-wiki-panel");
const workbenchWikiPanelEl = document.querySelector(".workbench-wiki");
const unifiedChatPanelEl = document.querySelector(".unified-chat-panel");
const knowledgeBaseNameEl = document.querySelector("#knowledge-base-name");
const openSettingsButtonEl = document.querySelector("#open-settings-panel");
const closeSettingsButtonEl = document.querySelector("#close-settings-panel");
const settingsOverlayEl = document.querySelector("#settings-overlay");
const settingsContentEl = document.querySelector(".settings-content");
const settingsToastViewportEl = document.querySelector("#settings-toast-viewport");
const startupOverlayEl = document.querySelector("#startup-overlay");
const startupTitleEl = document.querySelector("#startup-title");
const startupDescriptionEl = document.querySelector("#startup-description");
const startupHelpEl = document.querySelector(".startup-help");
const startupWizardProgressEl = document.querySelector("#startup-wizard-progress");
const startupWizardPanelEl = document.querySelector("#startup-wizard-panel");
const startupPhaseListEl = document.querySelector("#startup-phase-list");
const startupStatusListEl = document.querySelector("#startup-status-list");
const startupFeedbackEl = document.querySelector("#startup-feedback");
const startupBackButtonEl = document.querySelector("#startup-back-button");
const startupNextButtonEl = document.querySelector("#startup-next-button");
const startupPickKnowledgeBaseButtonEl = document.querySelector("#startup-pick-knowledge-base-button");
const startupInstallPiButtonEl = document.querySelector("#startup-install-pi-button");
const startupConfigureModelButtonEl = document.querySelector("#startup-configure-model-button");
const startupOpenDiagnosticsButtonEl = document.querySelector("#startup-open-diagnostics-button");
const startupRetryButtonEl = document.querySelector("#startup-retry-button");
const startupContinueButtonEl = document.querySelector("#startup-continue-button");
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
const settingsSectionModelProvidersEl = document.querySelector("#settings-section-model-providers");
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
const providerInstallPiButtonEl = document.querySelector("#provider-install-pi-button");
const providerDesktopLoginButtonEl = document.querySelector("#provider-desktop-login-button");
const resetProviderButtonEl = document.querySelector("#reset-provider-button");
const providerFeedbackEl = document.querySelector("#provider-settings-feedback");
const installPiButtonEl = document.querySelector("#install-pi-button");
const refreshDiagnosticsButtonEl = document.querySelector("#refresh-diagnostics-button");
const diagnosticsFeedbackEl = document.querySelector("#diagnostics-feedback");
const diagnosticsStatusChipsEl = document.querySelector("#diagnostics-status-chips");
const diagnosticsKbListEl = document.querySelector("#diagnostics-kb-list");
const diagnosticsPiListEl = document.querySelector("#diagnostics-pi-list");
const diagnosticsSessionListEl = document.querySelector("#diagnostics-session-list");
const diagnosticsProviderListEl = document.querySelector("#diagnostics-provider-list");
const diagnosticsSecurityListEl = document.querySelector("#diagnostics-security-list");
const diagnosticsSecurityEventsEl = document.querySelector("#diagnostics-security-events");
const openDiagnosticsKbButtonEl = document.querySelector("#open-diagnostics-kb-button");
const openDiagnosticsLogButtonEl = document.querySelector("#open-diagnostics-log-button");
const exportDiagnosticsSummaryButtonEl = document.querySelector("#export-diagnostics-summary-button");
const securityModeSelectEl = document.querySelector("#security-mode-select");
const securityModeHelpEl = document.querySelector("#security-mode-help");
const saveSecuritySettingsButtonEl = document.querySelector("#save-security-settings-button");
const openSecurityLogButtonEl = document.querySelector("#open-security-log-button");
const securitySettingsFeedbackEl = document.querySelector("#security-settings-feedback");

const STORAGE_KEY = "research-kb-workbench-layout";
const DESKTOP_PI_LOGIN_POLL_INTERVAL_MS = 2500;
const DESKTOP_PI_LOGIN_TIMEOUT_MS = 120000;

const workbenchState = {
  layout: "wiki",
  chatVisible: false,
  wikiVisible: false,
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
let startupOverlayDismissed = false;
let startupPiInstallPolling = false;
let startupWizardStep = 0;
let startupLoadFailure = "";
const settingsSectionModelProvidersOriginalParent = settingsSectionModelProvidersEl?.parentNode || null;
const settingsSectionModelProvidersOriginalNextSibling = settingsSectionModelProvidersEl?.nextSibling || null;
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

function isFloatingChatOpen() {
  return workbenchState.layout === "wiki" && workbenchState.chatVisible;
}

function isFloatingWikiOpen() {
  return workbenchState.layout === "chat" && workbenchState.wikiVisible;
}

function eventTargetsNode(event, node) {
  if (!node || !event) {
    return false;
  }
  if (typeof event.composedPath === "function") {
    return event.composedPath().includes(node);
  }
  const target = event.target;
  return target instanceof Element ? node.contains(target) : false;
}

function shouldIgnoreFloatingPanelDismiss(target) {
  return Boolean(
    target.closest("#layout-mode-wiki") ||
      target.closest("#layout-mode-chat") ||
      target.closest("#show-chat-panel") ||
      target.closest("#show-wiki-panel") ||
      target.closest("#quote-into-chat") ||
      target.closest("#wiki-insert-ingest")
  );
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
document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element) || shouldIgnoreFloatingPanelDismiss(target)) {
    return;
  }
  if (isFloatingChatOpen() && unifiedChatPanelEl && !eventTargetsNode(event, unifiedChatPanelEl)) {
    hideChat();
  }
  if (isFloatingWikiOpen() && workbenchWikiPanelEl && !eventTargetsNode(event, workbenchWikiPanelEl)) {
    hideWiki();
  }
});
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

function setSecurityFeedback(message, isError = false) {
  setFeedback(securitySettingsFeedbackEl, message, isError);
}

function setCapabilityFeedback(message, isError = false) {
  setFeedback(capabilityFeedbackEl, message, isError);
}

function setStartupFeedback(message, isError = false) {
  setFeedback(startupFeedbackEl, message, isError);
}

function renderKeyValueList(element, items) {
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

function openSettingsSection(section) {
  openSettingsPanel();
  setActiveSettingsSection(section);
}

function pathPayloadReady(item) {
  return Boolean(item && typeof item === "object" && item.exists && item.is_dir);
}

function providerSetupState() {
  const profiles = providerProfiles();
  const defaults = appSettings?.model_providers?.defaults || {};
  const diagnosticsProviders = diagnosticsState.data?.providers || {};
  const piRuntime = diagnosticsState.data?.pi_runtime || {};
  const hasProfiles = profiles.length > 0;
  const hasApiProfile =
    profiles.some((item) => item?.config_kind === "api" && Number(item?.model_count || 0) > 0);
  const hasOauthConnection =
    profiles.some((item) => Boolean(item?.oauth_connected)) ||
    Number(diagnosticsProviders.oauth_connected_count || 0) > 0;
  const hasDefaultProvider = Boolean(String(defaults.provider || "").trim());
  const hasDefaultModel = Boolean(
    String(defaults.model || piRuntime.current_model_id || "").trim()
  );
  const hasRuntimeModels = Number(piRuntime.available_model_count || 0) > 0;
  const ready =
    (hasDefaultProvider && (hasDefaultModel || hasRuntimeModels)) ||
    hasOauthConnection ||
    (hasApiProfile && hasRuntimeModels);

  let label = "尚未配置";
  if (hasDefaultProvider && hasDefaultModel) {
    label = `已选择默认模型：${defaults.provider}/${defaults.model || piRuntime.current_model_id || ""}`;
  } else if (hasOauthConnection) {
    label = "已完成 OAuth 登录，可继续进入工作流";
  } else if (hasProfiles) {
    label = hasRuntimeModels ? "已保存 Provider，可继续选择模型" : "已保存 Provider，仍需确认模型可用";
  }

  return {
    ready,
    hasProfiles,
    hasApiProfile,
    hasOauthConnection,
    hasDefaultProvider,
    hasDefaultModel,
    hasRuntimeModels,
    label,
  };
}

function startupSettings() {
  return appSettings?.startup || {};
}

function startupState() {
  const diagnostics = diagnosticsState.data;
  const piInstall = piInstallStatus();
  const health = diagnostics?.health || {};
  const knowledgeBase = diagnostics?.knowledge_base || {};
  const startup = startupSettings();
  const kbReady = diagnostics
    ? [knowledgeBase.wiki_dir, knowledgeBase.raw_dir, knowledgeBase.inbox_dir].every(pathPayloadReady)
    : Boolean(appSettings?.knowledge_base?.path);
  const model = providerSetupState();
  const runtimeHealthy = diagnostics
    ? Boolean(health.pi_rpc_available) && Boolean(health.runtime_options_ok)
    : false;

  return {
    diagnosticsLoaded: Boolean(diagnostics),
    kbReady,
    kbPath: String(knowledgeBase.path || appSettings?.knowledge_base?.path || "").trim(),
    onboardingPending: Boolean(startup.onboarding_pending),
    defaultKnowledgeBaseDir: String(startup.default_knowledge_base_dir || "").trim(),
    usingDefaultKnowledgeBaseDir: Boolean(startup.using_default_knowledge_base_dir),
    piReady: Boolean(piInstall.installed),
    piInstalling: Boolean(piInstall.install_in_progress),
    installSupported: Boolean(piInstall.install_supported),
    runtimeHealthy,
    model,
    canBrowse: kbReady,
    readyForWorkflow: kbReady && Boolean(piInstall.installed) && model.ready && runtimeHealthy,
  };
}

function startupPhaseMeta(phase) {
  if (phase === "ready") {
    return { label: "已完成", className: "ready" };
  }
  if (phase === "active") {
    return { label: "当前步骤", className: "active" };
  }
  return { label: "待完成", className: "pending" };
}

function renderStartupPhases(items) {
  if (!startupPhaseListEl) {
    return;
  }
  startupPhaseListEl.innerHTML = "";
  items.forEach((item) => {
    const meta = startupPhaseMeta(item.phase);
    const article = document.createElement("article");
    article.className = `startup-phase-card ${meta.className}`;

    const top = document.createElement("div");
    top.className = "startup-phase-top";

    const title = document.createElement("p");
    title.className = "startup-phase-title";
    title.textContent = item.title;

    const badge = document.createElement("span");
    badge.className = `startup-phase-badge ${meta.className}`;
    badge.textContent = meta.label;

    top.appendChild(title);
    top.appendChild(badge);

    const description = document.createElement("p");
    description.className = "startup-phase-detail";
    description.textContent = item.detail;

    article.appendChild(top);
    article.appendChild(description);
    startupPhaseListEl.appendChild(article);
  });
}

function startupWizardSteps() {
  return [
    { id: "welcome", label: "欢迎" },
    { id: "model", label: "模型" },
    { id: "knowledge-base", label: "知识库" },
  ];
}

function clampStartupWizardStep(step) {
  const maxIndex = startupWizardSteps().length - 1;
  return Math.max(0, Math.min(maxIndex, Number(step) || 0));
}

function setStartupWizardStep(step) {
  startupWizardStep = clampStartupWizardStep(step);
  renderStartupOverlay();
}

function restoreEmbeddedModelProviderPane() {
  if (!settingsSectionModelProvidersEl || !settingsSectionModelProvidersOriginalParent) {
    return;
  }
  if (settingsSectionModelProvidersEl.parentNode === settingsSectionModelProvidersOriginalParent) {
    return;
  }
  settingsSectionModelProvidersEl.classList.remove("startup-embedded-pane");
  const anchor = settingsSectionModelProvidersOriginalNextSibling;
  if (anchor && anchor.parentNode === settingsSectionModelProvidersOriginalParent) {
    settingsSectionModelProvidersOriginalParent.insertBefore(settingsSectionModelProvidersEl, anchor);
  } else {
    settingsSectionModelProvidersOriginalParent.appendChild(settingsSectionModelProvidersEl);
  }
}

function mountModelProviderPane(host) {
  if (!host || !settingsSectionModelProvidersEl) {
    return;
  }
  setActiveSettingsSection("model-providers");
  settingsSectionModelProvidersEl.classList.add("startup-embedded-pane");
  if (settingsSectionModelProvidersEl.parentNode !== host) {
    host.appendChild(settingsSectionModelProvidersEl);
  }
}

function renderStartupWizardProgress(currentStep) {
  if (!startupWizardProgressEl) {
    return;
  }
  startupWizardProgressEl.innerHTML = "";
  startupWizardProgressEl.classList.remove("hidden");
  startupWizardSteps().forEach((item, index) => {
    const node = document.createElement("div");
    node.className = "startup-wizard-step";
    node.classList.toggle("active", index === currentStep);
    node.classList.toggle("done", index < currentStep);

    const indexEl = document.createElement("span");
    indexEl.className = "startup-wizard-step-index";
    indexEl.textContent = String(index + 1);

    const labelEl = document.createElement("span");
    labelEl.className = "startup-wizard-step-label";
    labelEl.textContent = item.label;

    node.appendChild(indexEl);
    node.appendChild(labelEl);
    startupWizardProgressEl.appendChild(node);
  });
}

function renderStartupWizardPanel(currentStep, startup, status) {
  if (!startupWizardPanelEl) {
    return;
  }

  startupWizardPanelEl.innerHTML = "";
  startupWizardPanelEl.classList.remove("hidden");

  const section = document.createElement("section");
  section.className = "startup-wizard-section";

  if (currentStep === 0) {
    const message = document.createElement("p");
    message.className = "startup-wizard-lead";
    message.textContent = "欢迎来到 gogo-app。";

    const detail = document.createElement("p");
    detail.className = "startup-wizard-copy";
    detail.textContent = "接下来只需要两步：先配置模型，再确认你的知识库目录。完成后就可以进入主界面。";

    section.appendChild(message);
    section.appendChild(detail);
  } else if (currentStep === 1) {
    section.classList.add("startup-wizard-section-model");

    const detail = document.createElement("p");
    detail.className = "startup-wizard-copy";
    if (!startup.piReady) {
      detail.textContent = status.install_supported
        ? "先安装 Pi，然后在下面直接保存一个 API key provider，或通过 Pi OAuth 完成登录。"
        : "当前还没有可用的 Pi。请先处理 Pi 环境，再继续模型配置。";
    } else if (startup.model.ready) {
      detail.textContent = `当前状态：${startup.model.label}`;
    } else {
      detail.textContent = "请直接在下面完成模型接入。保存成功后，这一步会自动变成可继续。";
    }
    section.appendChild(detail);

    const statusList = document.createElement("div");
    statusList.className = "startup-wizard-inline-meta";
    [
      ["Pi", diagnosticsValue(status.command_source || status.command_path, startup.piReady ? "已安装" : "未就绪")],
      ["模型状态", startup.model.label],
      ["默认模型", diagnosticsValue(appSettings?.model_providers?.defaults?.model, "尚未选择")],
    ].forEach(([label, value]) => {
      const item = document.createElement("span");
      item.className = "startup-wizard-meta-chip";

      const chipLabel = document.createElement("strong");
      chipLabel.textContent = `${label}：`;

      const chipValue = document.createElement("span");
      chipValue.textContent = value;

      item.appendChild(chipLabel);
      item.appendChild(chipValue);
      statusList.appendChild(item);
    });
    section.appendChild(statusList);

    const host = document.createElement("div");
    host.className = "startup-embedded-pane-host";
    section.appendChild(host);
    startupWizardPanelEl.appendChild(section);
    mountModelProviderPane(host);
    return;
  } else {
    const card = document.createElement("div");
    card.className = "startup-wizard-card";

    const title = document.createElement("p");
    title.className = "startup-wizard-card-title";
    title.textContent = "选择你的知识库目录";

    const detail = document.createElement("p");
    detail.className = "startup-wizard-copy";
    detail.textContent = "你可以使用默认位置，也可以选择一个更顺手的目录。之后仍然可以在设置里切换。";

    card.appendChild(title);
    card.appendChild(detail);

    const statusList = document.createElement("dl");
    statusList.className = "startup-wizard-kv";
    [
      ["当前位置", diagnosticsValue(startup.kbPath || startup.defaultKnowledgeBaseDir, "待创建")],
      ["默认位置", diagnosticsValue(startup.defaultKnowledgeBaseDir, "待创建")],
      ["后续可改", "可以"],
    ].forEach(([label, value]) => {
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = value;
      statusList.appendChild(dt);
      statusList.appendChild(dd);
    });
    card.appendChild(statusList);
    section.appendChild(card);
  }

  startupWizardPanelEl.appendChild(section);
}

function shouldShowStartupOverlay() {
  if (!isDesktopRuntime()) {
    return false;
  }
  if (startupLoadFailure) {
    return true;
  }
  if (!appSettings) {
    return false;
  }
  const startup = startupState();
  if (startup.piInstalling) {
    return true;
  }
  if (startup.onboardingPending) {
    return true;
  }
  return false;
}

function renderStartupOverlay() {
  if (!startupOverlayEl) {
    return;
  }

  const show = shouldShowStartupOverlay();
  startupOverlayEl.classList.toggle("hidden", !show);
  if (!show) {
    return;
  }

  if (startupLoadFailure) {
    startupWizardProgressEl?.classList.add("hidden");
    startupWizardPanelEl?.classList.add("hidden");
    startupPhaseListEl?.classList.add("hidden");
    startupStatusListEl?.classList.remove("hidden");
    startupHelpEl?.classList.remove("hidden");
    startupTitleEl && (startupTitleEl.textContent = "启动检查失败");
    startupDescriptionEl &&
      (startupDescriptionEl.textContent =
        "gogo-app 暂时没能读取当前桌面设置。你可以重新检查，或先进入工作台浏览 Wiki。");
    renderKeyValueList(startupStatusListEl, [["错误", startupLoadFailure]]);
    startupBackButtonEl?.classList.add("hidden");
    startupNextButtonEl?.classList.add("hidden");
    startupPickKnowledgeBaseButtonEl?.classList.add("hidden");
    startupInstallPiButtonEl && (startupInstallPiButtonEl.disabled = true);
    startupConfigureModelButtonEl?.classList.add("hidden");
    startupOpenDiagnosticsButtonEl && (startupOpenDiagnosticsButtonEl.disabled = true);
    startupRetryButtonEl?.classList.remove("hidden");
    startupContinueButtonEl?.classList.remove("hidden");
    startupContinueButtonEl && (startupContinueButtonEl.disabled = false);
    setStartupFeedback(startupLoadFailure, true);
    return;
  }

  if (!appSettings) {
    startupWizardProgressEl?.classList.add("hidden");
    startupWizardPanelEl?.classList.add("hidden");
    startupPhaseListEl?.classList.remove("hidden");
    startupStatusListEl?.classList.remove("hidden");
    startupHelpEl?.classList.remove("hidden");
    startupTitleEl && (startupTitleEl.textContent = "正在检查桌面环境");
    startupDescriptionEl &&
      (startupDescriptionEl.textContent =
        "gogo-app 正在确认本地知识库、Pi 运行时和模型配置状态，请稍候。");
    renderStartupPhases([
      {
        title: "读取应用设置",
        detail: "正在读取 companion knowledge-base、Pi 安装状态和上次使用的配置。",
        phase: "active",
      },
      {
        title: "检查环境",
        detail: "确认 raw / wiki / inbox、Pi 命令和模型配置是否已经就绪。",
        phase: "pending",
      },
    ]);
    renderKeyValueList(startupStatusListEl, [["状态", "正在读取当前设置与运行时状态"]]);
    startupBackButtonEl?.classList.add("hidden");
    startupNextButtonEl?.classList.add("hidden");
    startupPickKnowledgeBaseButtonEl?.classList.add("hidden");
    startupInstallPiButtonEl && (startupInstallPiButtonEl.disabled = true);
    startupConfigureModelButtonEl && (startupConfigureModelButtonEl.disabled = true);
    startupOpenDiagnosticsButtonEl && (startupOpenDiagnosticsButtonEl.disabled = true);
    startupRetryButtonEl?.classList.add("hidden");
    startupContinueButtonEl && (startupContinueButtonEl.disabled = true);
    setStartupFeedback("");
    return;
  }

  const status = piInstallStatus();
  const startup = startupState();
  const installSupported = Boolean(status.install_supported);
  const installed = Boolean(status.installed);
  const inProgress = Boolean(status.install_in_progress);
  const model = startup.model;

  if (!startup.onboardingPending || startupWizardStep !== 1) {
    restoreEmbeddedModelProviderPane();
  }

  if (startup.onboardingPending) {
    startupWizardStep = clampStartupWizardStep(startupWizardStep);
    startupPhaseListEl?.classList.add("hidden");
    startupStatusListEl?.classList.add("hidden");
    startupHelpEl?.classList.add("hidden");
    renderStartupWizardProgress(startupWizardStep);
    renderStartupWizardPanel(startupWizardStep, startup, status);

    const isWelcomeStep = startupWizardStep === 0;
    const isModelStep = startupWizardStep === 1;
    const isKnowledgeBaseStep = startupWizardStep === 2;

    if (isWelcomeStep) {
      startupTitleEl && (startupTitleEl.textContent = "欢迎使用 gogo-app");
      startupDescriptionEl && (startupDescriptionEl.textContent = "我们先完成一个很短的首次配置。");
    } else if (isModelStep) {
      startupTitleEl && (startupTitleEl.textContent = "配置模型");
      startupDescriptionEl &&
        (startupDescriptionEl.textContent = "请先把你自己的模型接入 gogo-app。完成后再进入下一步。");
    } else {
      startupTitleEl && (startupTitleEl.textContent = "选择知识库目录");
      startupDescriptionEl &&
        (startupDescriptionEl.textContent = "最后一步：确认 companion knowledge-base 放在哪里。");
    }

    startupBackButtonEl?.classList.toggle("hidden", isWelcomeStep);
    startupBackButtonEl && (startupBackButtonEl.disabled = false);

    startupNextButtonEl?.classList.remove("hidden");
    if (startupNextButtonEl) {
      startupNextButtonEl.textContent = isKnowledgeBaseStep ? "完成并进入 gogo-app" : "下一步";
      startupNextButtonEl.disabled =
        (isModelStep && (!startup.piReady || !model.ready)) || (isKnowledgeBaseStep && !startup.kbReady);
    }

    startupPickKnowledgeBaseButtonEl?.classList.toggle("hidden", !isKnowledgeBaseStep);
    startupPickKnowledgeBaseButtonEl &&
      (startupPickKnowledgeBaseButtonEl.disabled = !isDesktopRuntime() || inProgress);

    startupInstallPiButtonEl?.classList.toggle("hidden", !isModelStep || installed);
    if (startupInstallPiButtonEl) {
      startupInstallPiButtonEl.disabled = inProgress || installed || !installSupported;
      startupInstallPiButtonEl.textContent = inProgress ? "正在安装 Pi..." : "安装 Pi";
    }

    startupConfigureModelButtonEl?.classList.add("hidden");

    startupOpenDiagnosticsButtonEl?.classList.toggle("hidden", !isModelStep);
    startupOpenDiagnosticsButtonEl && (startupOpenDiagnosticsButtonEl.disabled = false);

    startupRetryButtonEl?.classList.add("hidden");
    startupContinueButtonEl?.classList.add("hidden");

    return;
  }

  startupWizardProgressEl?.classList.add("hidden");
  startupWizardPanelEl?.classList.add("hidden");
  startupPhaseListEl?.classList.remove("hidden");
  startupStatusListEl?.classList.remove("hidden");
  startupHelpEl?.classList.remove("hidden");

  const phaseItems = [
    {
      title: "Knowledge Base",
      detail: startup.kbReady
        ? `已就绪：${startup.kbPath || "当前目录"}`
        : startup.diagnosticsLoaded
          ? "当前目录结构还不完整，gogo-app 会继续按 companion knowledge-base 模板补齐。"
          : "正在确认 raw / wiki / inbox 目录。",
      phase: startup.kbReady ? "ready" : "active",
    },
    {
      title: "Pi 运行时",
      detail: installed
        ? `已就绪：${diagnosticsValue(status.command_source, "已安装")}`
        : inProgress
          ? "正在后台安装 Pi，完成后即可继续 `/login`、聊天、ingest 和写回。"
          : installSupported
            ? "尚未检测到 Pi，建议现在安装。"
            : "当前还不能自动安装 Pi，需要先处理 npm / 安装器环境。",
      phase: installed ? "ready" : "active",
    },
    {
      title: "模型配置",
      detail: model.label,
      phase: model.ready ? "ready" : installed ? "active" : "pending",
    },
    {
      title: "进入工作台",
      detail: startup.readyForWorkflow
        ? "环境已齐备，可以继续上传、ingest、聊天和写回。"
        : "如果还没准备好模型，也可以先进入工作台浏览 Wiki。",
      phase: startup.readyForWorkflow ? "ready" : model.ready ? "active" : "pending",
    },
  ];
  renderStartupPhases(phaseItems);

  startupBackButtonEl?.classList.add("hidden");
  startupNextButtonEl?.classList.add("hidden");
  startupContinueButtonEl && (startupContinueButtonEl.disabled = !startup.canBrowse || inProgress);
  startupConfigureModelButtonEl && (startupConfigureModelButtonEl.disabled = false);
  startupOpenDiagnosticsButtonEl && (startupOpenDiagnosticsButtonEl.disabled = false);
  startupPickKnowledgeBaseButtonEl &&
    (startupPickKnowledgeBaseButtonEl.disabled = !isDesktopRuntime() || inProgress);
  startupRetryButtonEl?.classList.toggle("hidden", inProgress);

  if (startup.readyForWorkflow) {
    startupOverlayEl.classList.add("hidden");
    return;
  }

  if (!startup.diagnosticsLoaded) {
    startupTitleEl && (startupTitleEl.textContent = "正在补齐首次启动检查");
    startupDescriptionEl &&
      (startupDescriptionEl.textContent =
        "基础设置已经读到，gogo-app 正在进一步确认知识库结构、Pi RPC 和模型配置状态。");
  } else if (!startup.kbReady) {
    startupTitleEl && (startupTitleEl.textContent = "正在准备 companion knowledge-base");
    startupDescriptionEl &&
      (startupDescriptionEl.textContent =
        "gogo-app 已拿到知识库路径，正在确认里面的 raw、wiki 和 inbox 结构已经就绪。");
  } else if (inProgress) {
    startupTitleEl && (startupTitleEl.textContent = "正在安装 Pi");
    startupDescriptionEl &&
      (startupDescriptionEl.textContent =
        "gogo-app 正在后台准备 Pi 运行时。安装完成后，你就可以继续走 `/login`、聊天、ingest 和写回链路。");
  } else if (!installed && installSupported) {
    startupTitleEl && (startupTitleEl.textContent = "先安装 Pi，再进入完整工作流");
    startupDescriptionEl &&
      (startupDescriptionEl.textContent =
        "检测到当前机器上还没有可用的 `pi`。你可以现在安装，gogo-app 会把它放到自己的托管目录，不会写进你的知识库。");
  } else if (!installed) {
    startupTitleEl && (startupTitleEl.textContent = "当前还不能自动安装 Pi");
    startupDescriptionEl &&
      (startupDescriptionEl.textContent =
        "这台机器上暂时没有检测到可用的 `npm`，所以 gogo-app 现在还没法自动补齐 `pi`。你仍然可以先进入工作台浏览 Wiki。");
  } else if (!model.ready) {
    startupTitleEl && (startupTitleEl.textContent = "再配置一个模型，就能走完整链路");
    startupDescriptionEl &&
      (startupDescriptionEl.textContent =
        "Pi 已可用，下一步请在“模型配置”里保存一个 API key provider，或通过 Pi OAuth 完成登录。你也可以先跳过这一步，先浏览 Wiki。");
  } else if (!startup.runtimeHealthy) {
    startupTitleEl && (startupTitleEl.textContent = "运行时已经启动，但模型状态还没准备好");
    startupDescriptionEl &&
      (startupDescriptionEl.textContent =
        "知识库、Pi 和模型配置已经基本就绪，不过 Pi RPC 还没返回可用模型状态。你可以查看诊断信息，或先进入工作台浏览 Wiki。");
  }

  renderKeyValueList(startupStatusListEl, [
    ["知识库", startup.kbReady ? diagnosticsValue(startup.kbPath, "已就绪") : "目录结构待确认"],
    ["Pi", diagnosticsValue(status.command_path || status.command, "未检测到")],
    ["模型", model.label],
    ["运行时", startup.diagnosticsLoaded ? (startup.runtimeHealthy ? "已连通" : "待确认") : "正在检查"],
    ["日志", diagnosticsValue(status.install_log_path)],
    ["下一步", startup.readyForWorkflow ? "直接进入工作台" : !installed ? "安装 Pi" : !model.ready ? "配置模型" : "查看诊断"],
  ]);

  if (startupInstallPiButtonEl) {
    startupInstallPiButtonEl.classList.remove("hidden");
    startupInstallPiButtonEl.classList.toggle("hidden", installed && !inProgress);
    startupInstallPiButtonEl.disabled = inProgress || installed || !installSupported;
    startupInstallPiButtonEl.textContent = inProgress ? "正在安装 Pi..." : "安装 Pi";
  }
  startupPickKnowledgeBaseButtonEl?.classList.add("hidden");
  if (startupConfigureModelButtonEl) {
    startupConfigureModelButtonEl.classList.remove("hidden");
    startupConfigureModelButtonEl.textContent = model.ready ? "查看模型配置" : "配置模型";
  }
  startupOpenDiagnosticsButtonEl?.classList.remove("hidden");
  if (startupContinueButtonEl) {
    startupContinueButtonEl.textContent = startup.readyForWorkflow ? "进入工作台" : "先浏览 Wiki";
  }
}

function clearSettingsFeedback() {
  setKnowledgeBaseFeedback("");
  setCapabilityFeedback("");
  setProviderFeedback("");
  setDiagnosticsFeedback("");
  setSecurityFeedback("");
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

function diagnosticsPiSourceLabel(status) {
  const source = String(status?.command_source || "").trim();
  if (source === "bundled") {
    return "随 gogo-app 提供";
  }
  if (source === "managed") {
    return "由 gogo-app 安装";
  }
  if (source === "system") {
    return "使用系统环境中的 Pi";
  }
  return diagnosticsValue(source, "未检测到");
}

function diagnosticsPiStatusLabel(runtime, install) {
  if (install?.install_in_progress) {
    return "安装中";
  }
  if (install?.installed && !runtime?.runtime_error) {
    return "可用";
  }
  if (install?.installed) {
    return "已安装，但运行异常";
  }
  return "未就绪";
}

function securitySettings() {
  return diagnosticsState.data?.security || {};
}

function diagnosticsSecurityModeTone(mode) {
  const normalized = String(mode || "").trim().toLowerCase();
  if (normalized === "readonly") {
    return "is-readonly";
  }
  if (normalized === "full-access") {
    return "is-full-access";
  }
  return "is-workspace-write";
}

function diagnosticsSecurityDecisionMeta(item) {
  const decision = String(item?.decision || "").trim().toLowerCase();
  if (decision === "block") {
    return {
      tone: "is-block",
      label: "BLOCK",
      detail: "已拦截",
      description: "该操作被当前安全边界拦截。",
    };
  }
  if (decision === "allow-approved") {
    return {
      tone: "is-allow",
      label: "ALLOW",
      detail: "批准后",
      description: "该操作在你确认后已放行。",
    };
  }
  if (decision === "allow-inline") {
    return {
      tone: "is-allow",
      label: "ALLOW",
      detail: "面板确认",
      description: "该操作在面板中确认后已放行。",
    };
  }
  return {
    tone: "is-allow",
    label: "ALLOW",
    detail: "已放行",
    description: "该操作已通过当前安全边界。",
  };
}

function diagnosticsSecurityTimestamp(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "刚刚";
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }
  try {
    return parsed.toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_error) {
    return raw;
  }
}

function diagnosticsSecurityDisplayPath(value, trustedWorkspaces) {
  const rawPath = String(value || "").trim();
  if (!rawPath) {
    return "";
  }
  const normalizedPath = rawPath.replace(/\\/g, "/");
  const roots = Array.isArray(trustedWorkspaces) ? trustedWorkspaces : [];
  for (const workspace of roots) {
    const rootPath = String(workspace?.path || "").trim().replace(/\\/g, "/");
    if (!rootPath) {
      continue;
    }
    if (normalizedPath === rootPath) {
      return workspace.label || rootPath;
    }
    if (normalizedPath.startsWith(`${rootPath}/`)) {
      const relative = normalizedPath.slice(rootPath.length + 1);
      return workspace.label ? `${workspace.label}/${relative}` : relative;
    }
  }
  return normalizedPath;
}

function diagnosticsSecurityTarget(item, trustedWorkspaces) {
  const command = String(item?.command || "").trim();
  if (command) {
    return command;
  }
  const resolvedPath = String(item?.resolved_path || item?.resolvedPath || item?.path || "").trim();
  return diagnosticsSecurityDisplayPath(resolvedPath, trustedWorkspaces);
}

function diagnosticsSecurityReason(item, meta) {
  const explicitReason = String(item?.reason || "").trim();
  if (explicitReason) {
    return explicitReason;
  }
  return meta.description;
}

function renderSecuritySummary(security) {
  if (!diagnosticsSecurityListEl) {
    return;
  }

  const workspaces = Array.isArray(security?.trusted_workspaces) ? security.trusted_workspaces : [];
  diagnosticsSecurityListEl.innerHTML = "";

  const hero = document.createElement("section");
  hero.className = `settings-security-hero ${diagnosticsSecurityModeTone(security?.mode)}`.trim();

  const heroTop = document.createElement("div");
  heroTop.className = "settings-security-mode-row";

  const modePill = document.createElement("span");
  modePill.className = `settings-security-mode-pill ${diagnosticsSecurityModeTone(security?.mode)}`.trim();
  modePill.textContent = diagnosticsValue(security?.mode_label, "未设置");
  heroTop.appendChild(modePill);

  const supportPill = document.createElement("span");
  supportPill.className = "settings-security-inline-pill";
  supportPill.textContent = security?.supports_interactive_approval ? "支持交互式确认" : "仅按模式执行";
  heroTop.appendChild(supportPill);

  hero.appendChild(heroTop);

  const description = document.createElement("p");
  description.className = "settings-security-description";
  description.textContent =
    diagnosticsValue(security?.mode_description, "当前是应用层最小安全约束，不是容器级强沙箱。");
  hero.appendChild(description);

  if (security?.boundary_note) {
    const note = document.createElement("p");
    note.className = "settings-security-note";
    note.textContent = security.boundary_note;
    hero.appendChild(note);
  }

  diagnosticsSecurityListEl.appendChild(hero);

  const metaGrid = document.createElement("div");
  metaGrid.className = "settings-security-meta-grid";

  const buildMetaCard = (label, bodyBuilder) => {
    const card = document.createElement("section");
    card.className = "settings-security-meta-card";

    const heading = document.createElement("p");
    heading.className = "settings-security-meta-label";
    heading.textContent = label;
    card.appendChild(heading);

    bodyBuilder(card);
    metaGrid.appendChild(card);
  };

  buildMetaCard("受信任工作区", (card) => {
    if (!workspaces.length) {
      const empty = document.createElement("p");
      empty.className = "settings-security-meta-value";
      empty.textContent = "当前还没有受信任工作区。";
      card.appendChild(empty);
      return;
    }
    const list = document.createElement("div");
    list.className = "settings-security-workspaces";
    workspaces.forEach((item) => {
      const entry = document.createElement("div");
      entry.className = "settings-security-workspace-item";

      const labelEl = document.createElement("strong");
      labelEl.className = "settings-security-workspace-label";
      labelEl.textContent = diagnosticsValue(item?.label, "未命名工作区");
      entry.appendChild(labelEl);

      const pathEl = document.createElement("p");
      pathEl.className = "settings-security-workspace-path";
      pathEl.textContent = diagnosticsValue(item?.path);
      entry.appendChild(pathEl);

      list.appendChild(entry);
    });
    card.appendChild(list);
  });

  buildMetaCard("托管扩展", (card) => {
    const value = document.createElement("p");
    value.className = "settings-security-meta-value settings-security-monospace";
    value.textContent = diagnosticsValue(security?.managed_extension_path);
    card.appendChild(value);
  });

  buildMetaCard("安全日志", (card) => {
    const value = document.createElement("p");
    value.className = "settings-security-meta-value settings-security-monospace";
    value.textContent = diagnosticsValue(security?.log_path);
    card.appendChild(value);
  });

  buildMetaCard("审批缓存", (card) => {
    const value = document.createElement("p");
    value.className = "settings-security-meta-value settings-security-monospace";
    value.textContent = diagnosticsValue(security?.approvals_path);
    card.appendChild(value);
  });

  diagnosticsSecurityListEl.appendChild(metaGrid);
}

function renderSecurityControls() {
  const security = securitySettings();
  const availableModes = Array.isArray(security.available_modes) ? security.available_modes : [];

  if (securityModeSelectEl) {
    const previousValue = String(securityModeSelectEl.value || "").trim();
    securityModeSelectEl.innerHTML = "";
    availableModes.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.id || "";
      option.textContent = item.label || item.id || "";
      securityModeSelectEl.appendChild(option);
    });
    securityModeSelectEl.value = security.mode || previousValue || availableModes[0]?.id || "";
  }

  const selectedMode =
    availableModes.find((item) => item.id === String(securityModeSelectEl?.value || security.mode || "")) ||
    availableModes[0] ||
    {};

  if (securityModeHelpEl) {
    const helpParts = [];
    if (selectedMode.description) {
      helpParts.push(selectedMode.description);
    }
    if (security.boundary_note) {
      helpParts.push(security.boundary_note);
    }
    securityModeHelpEl.textContent =
      helpParts.join(" ") || "当前是应用层最小安全约束，不是容器级强沙箱。";
  }
}

function renderSecurityEvents(events, security) {
  if (!diagnosticsSecurityEventsEl) {
    return;
  }
  diagnosticsSecurityEventsEl.innerHTML = "";
  const items = Array.isArray(events) ? events : [];
  const header = document.createElement("div");
  header.className = "settings-security-events-header";

  const title = document.createElement("h4");
  title.className = "settings-security-events-title";
  title.textContent = "最近审计记录";
  header.appendChild(title);

  const count = document.createElement("span");
  count.className = "settings-security-events-count";
  count.textContent = items.length ? `最近 ${items.length} 条` : "暂无记录";
  header.appendChild(count);

  diagnosticsSecurityEventsEl.appendChild(header);

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "settings-security-empty";
    empty.textContent = "最近还没有 bash / write / edit 审计记录。";
    diagnosticsSecurityEventsEl.appendChild(empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "settings-security-event-list";

  items.forEach((item) => {
    const meta = diagnosticsSecurityDecisionMeta(item);
    const eventCard = document.createElement("article");
    eventCard.className = `settings-security-event ${meta.tone}`.trim();

    const top = document.createElement("div");
    top.className = "settings-security-event-top";

    const tags = document.createElement("div");
    tags.className = "settings-security-event-tags";

    const decisionBadge = document.createElement("span");
    decisionBadge.className = `settings-security-event-badge ${meta.tone}`.trim();
    decisionBadge.textContent = meta.label;
    tags.appendChild(decisionBadge);

    const toolBadge = document.createElement("span");
    toolBadge.className = "settings-security-event-badge is-tool";
    toolBadge.textContent = diagnosticsValue(item?.tool, "tool");
    tags.appendChild(toolBadge);

    const detailBadge = document.createElement("span");
    detailBadge.className = "settings-security-event-badge is-detail";
    detailBadge.textContent = meta.detail;
    tags.appendChild(detailBadge);

    const modeLabel = String(item?.current_mode_label || security?.mode_label || "").trim();
    if (modeLabel) {
      const modeBadge = document.createElement("span");
      modeBadge.className = "settings-security-event-badge is-mode";
      modeBadge.textContent = modeLabel;
      tags.appendChild(modeBadge);
    }

    top.appendChild(tags);

    const time = document.createElement("time");
    time.className = "settings-security-event-time";
    if (item?.timestamp) {
      time.dateTime = String(item.timestamp);
    }
    time.textContent = diagnosticsSecurityTimestamp(item?.timestamp);
    top.appendChild(time);

    eventCard.appendChild(top);

    const target = document.createElement("p");
    target.className = "settings-security-event-target";
    target.textContent =
      diagnosticsSecurityTarget(item, security?.trusted_workspaces) || "未提供目标路径";
    eventCard.appendChild(target);

    const resolvedPath = String(item?.resolved_path || item?.resolvedPath || item?.path || "").trim();
    if (item?.command && resolvedPath) {
      const secondary = document.createElement("p");
      secondary.className = "settings-security-event-subtarget";
      secondary.textContent = `目标：${diagnosticsSecurityDisplayPath(
        resolvedPath,
        security?.trusted_workspaces
      )}`;
      eventCard.appendChild(secondary);
    }

    const reason = document.createElement("p");
    reason.className = "settings-security-event-reason";
    reason.textContent = diagnosticsSecurityReason(item, meta);
    eventCard.appendChild(reason);

    list.appendChild(eventCard);
  });

  diagnosticsSecurityEventsEl.appendChild(list);
}

function renderDiagnostics() {
  const payload = diagnosticsState.data;
  const health = payload?.health || {};
  const knowledgeBase = payload?.knowledge_base || {};
  const sessions = payload?.sessions || {};
  const providers = payload?.providers || {};
  const defaults = providers.defaults || {};
  const piRuntime = payload?.pi_runtime || {};
  const piInstall = payload?.pi_install || piInstallStatus();
  const security = payload?.security || {};

  if (diagnosticsStatusChipsEl) {
    diagnosticsStatusChipsEl.innerHTML = "";
    const chips = [
      `运行时：${diagnosticsValue(health.runtime)}`,
      `Pi RPC：${health.pi_rpc_available ? "可用" : "不可用"}`,
      `Pi 状态：${health.runtime_options_ok ? "已连通" : "拉取失败"}`,
      `Pi 安装：${piInstall.install_in_progress ? "安装中" : piInstall.installed ? "已安装" : "待安装"}`,
      `知识库：${diagnosticsValue(knowledgeBase.name)}`,
      `安全模式：${diagnosticsValue(security.mode_label)}`,
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
    ["Pi 状态", diagnosticsPiStatusLabel(piRuntime, piInstall)],
    ["Pi 来源", diagnosticsPiSourceLabel(piInstall)],
    ["工作目录", diagnosticsValue(piRuntime.workdir)],
    ["当前模型", diagnosticsValue(piRuntime.current_provider && piRuntime.current_model_id ? `${piRuntime.current_provider}/${piRuntime.current_model_id}` : "")],
    ["当前思考", diagnosticsValue(piRuntime.current_thinking_level)],
    ["可用模型数", diagnosticsValue(piRuntime.available_model_count)],
    ["可用 Provider 数", diagnosticsValue(piRuntime.available_provider_count)],
    ["登录/安装说明", diagnosticsValue(piInstall.detail)],
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
  renderSecuritySummary(security);
  renderSecurityControls();
  renderSecurityEvents(security.recent_events, security);
  renderDiagnosticsActions();
}

function renderDiagnosticsActions() {
  const payload = diagnosticsState.data;
  const knowledgeBasePath = String(payload?.knowledge_base?.path || appSettings?.knowledge_base?.path || "").trim();
  const logPath = String(payload?.pi_install?.install_log_path || "").trim();
  const securityLogPath = String(payload?.security?.log_path || "").trim();

  if (openDiagnosticsKbButtonEl) {
    openDiagnosticsKbButtonEl.disabled = !knowledgeBasePath;
  }
  if (openDiagnosticsLogButtonEl) {
    openDiagnosticsLogButtonEl.disabled = !logPath;
  }
  if (saveSecuritySettingsButtonEl) {
    saveSecuritySettingsButtonEl.disabled = diagnosticsState.loading || !securityModeSelectEl;
  }
  if (openSecurityLogButtonEl) {
    openSecurityLogButtonEl.disabled = !securityLogPath;
  }
  if (exportDiagnosticsSummaryButtonEl) {
    exportDiagnosticsSummaryButtonEl.disabled = diagnosticsState.loading || !payload;
  }
}

async function loadDiagnostics(force = false) {
  if (diagnosticsState.loading) {
    return;
  }
  if (!force && diagnosticsState.data) {
    renderDiagnostics();
    renderStartupOverlay();
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
  } catch (error) {
    setDiagnosticsFeedback(`刷新失败：${error.message}`, true);
  } finally {
    diagnosticsState.loading = false;
    refreshDiagnosticsButtonEl && (refreshDiagnosticsButtonEl.disabled = false);
    renderDiagnosticsActions();
    renderStartupOverlay();
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

function piInstallStatus() {
  return appSettings?.pi_install || {};
}

function piInstalled() {
  return Boolean(piInstallStatus().installed);
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
  const installStatus = piInstallStatus();
  if (providerAuthMode === "manual-tokens") {
    providerAuthModeHelpEl.textContent =
      "当前会把 access / refresh token 直接写入 Pi 的 auth.json，适合作为 Web 版兼容方案，或给自定义 OAuth Provider 临时接入。";
    return;
  }
  if (desktopReady && installStatus.install_in_progress) {
    providerAuthModeHelpEl.textContent =
      "Pi 正在后台安装中。安装完成后，直接点击“打开终端 Pi 登录”即可继续 `/login`。";
    return;
  }
  if (desktopReady && !installStatus.installed) {
    providerAuthModeHelpEl.textContent =
      "当前还没有检测到可用的 Pi。可以先点击“安装 Pi”，gogo-app 会优先把 Pi 安装到自己的托管目录，再继续 `/login`。";
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

function renderPiInstallActions() {
  const status = piInstallStatus();
  const installed = Boolean(status.installed);
  const inProgress = Boolean(status.install_in_progress);
  const installSupported = Boolean(status.install_supported);
  const canInstallInApp = isDesktopRuntime() && (installSupported || installed || inProgress);

  if (providerInstallPiButtonEl) {
    providerInstallPiButtonEl.disabled = !canInstallInApp || inProgress || installed;
    providerInstallPiButtonEl.textContent = inProgress ? "正在安装 Pi..." : installed ? "Pi 已安装" : "安装 Pi";
  }

  if (installPiButtonEl) {
    installPiButtonEl.disabled = !canInstallInApp || inProgress || installed;
    installPiButtonEl.textContent = inProgress ? "正在安装 Pi..." : installed ? "Pi 已安装" : "安装 Pi";
  }

  if (providerDesktopLoginButtonEl) {
    providerDesktopLoginButtonEl.disabled = !installed || inProgress;
  }
}

function renderModelProviderSettings() {
  renderApiTypeOptions();
  renderOauthPresetOptions();
  renderOauthAuthModeOptions();
  renderProviderProfiles();
  applyProviderMode(providerFormMode);
  renderPiInstallActions();
}

function renderSettings() {
  renderKnowledgeBaseSettings();
  renderCapabilitySettings();
  renderModelProviderSettings();
  renderDiagnosticsActions();
  renderStartupOverlay();
}

async function loadAppSettings() {
  startupLoadFailure = "";
  const response = await fetch("/api/settings");
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  appSettings = await response.json();
  renderSettings();
  if (isDesktopRuntime() && !diagnosticsState.data && !diagnosticsState.loading) {
    void loadDiagnostics(true).catch((error) => {
      console.error("Failed to load startup diagnostics:", error);
      renderStartupOverlay();
    });
  }
  if (piInstallStatus().install_in_progress && !startupPiInstallPolling) {
    void pollPiInstallUntilSettled();
  }
}

function openSettingsPanel() {
  restoreEmbeddedModelProviderPane();
  settingsOverlayEl?.classList.remove("hidden");
  setActiveSettingsSection(activeSettingsSection);
  clearSettingsFeedback();
}

function buildDiagnosticsSummary() {
  const payload = diagnosticsState.data;
  if (!payload) {
    return "";
  }
  const knowledgeBase = payload.knowledge_base || {};
  const health = payload.health || {};
  const piRuntime = payload.pi_runtime || {};
  const piInstall = payload.pi_install || {};
  const providers = payload.providers || {};
  const defaults = providers.defaults || {};
  const security = payload.security || {};
  return [
    `生成时间: ${diagnosticsValue(payload.generated_at)}`,
    "",
    `[健康状态]`,
    `运行时: ${diagnosticsValue(health.runtime)}`,
    `桌面运行时: ${diagnosticsValue(health.desktop_runtime)}`,
    `Pi RPC: ${diagnosticsValue(health.pi_rpc_available)}`,
    `Pi 状态拉取: ${diagnosticsValue(health.runtime_options_ok)}`,
    "",
    `[知识库]`,
    `名称: ${diagnosticsValue(knowledgeBase.name)}`,
    `路径: ${diagnosticsValue(knowledgeBase.path)}`,
    `Wiki: ${diagnosticsValue(knowledgeBase.wiki_dir?.path)}`,
    `Raw: ${diagnosticsValue(knowledgeBase.raw_dir?.path)}`,
    `Inbox: ${diagnosticsValue(knowledgeBase.inbox_dir?.path)}`,
    "",
    `[Pi]`,
    `命令路径: ${diagnosticsValue(piRuntime.command_path || piRuntime.command)}`,
    `命令来源: ${diagnosticsValue(piInstall.command_source)}`,
    `安装日志: ${diagnosticsValue(piInstall.install_log_path)}`,
    `运行时错误: ${diagnosticsValue(piRuntime.runtime_error, "无")}`,
    "",
    `[模型]`,
    `默认 Provider: ${diagnosticsValue(defaults.provider)}`,
    `默认模型: ${diagnosticsValue(defaults.model)}`,
    `Profile 数: ${diagnosticsValue(providers.profile_count)}`,
    `OAuth 已连通: ${diagnosticsValue(providers.oauth_connected_count)}`,
    "",
    `[安全]`,
    `安全模式: ${diagnosticsValue(security.mode_label || security.mode)}`,
    `受信任工作区: ${diagnosticsValue(Array.isArray(security.trusted_workspaces) ? security.trusted_workspaces.map((item) => item.path).join(" | ") : "")}`,
    `安全日志: ${diagnosticsValue(security.log_path)}`,
    `说明: ${diagnosticsValue(security.boundary_note)}`,
  ].join("\n");
}

function downloadTextFile(filename, text) {
  const blob = new Blob([String(text || "")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function openDesktopPath(targetPath, label) {
  const safePath = String(targetPath || "").trim();
  if (!safePath) {
    throw new Error(`${label}路径为空。`);
  }
  if (!isDesktopRuntime() || !desktopBridge?.openPath) {
    throw new Error("当前不是桌面版运行时，无法直接打开本地路径。");
  }
  await desktopBridge.openPath(safePath);
}

async function exportDiagnosticsSummary() {
  if (!diagnosticsState.data) {
    await loadDiagnostics(true);
  }
  const text = buildDiagnosticsSummary();
  if (!text) {
    setDiagnosticsFeedback("当前还没有可导出的诊断信息。", true);
    return;
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  downloadTextFile(`gogo-diagnostics-${timestamp}.txt`, text);
  setDiagnosticsFeedback("");
  showSettingsToast("诊断摘要已导出到本地下载目录。");
}

async function saveSecuritySettings() {
  const mode = String(securityModeSelectEl?.value || "").trim();
  if (!mode) {
    setSecurityFeedback("请选择一个安全模式。", true);
    return;
  }
  if (saveSecuritySettingsButtonEl) {
    saveSecuritySettingsButtonEl.disabled = true;
  }
  setSecurityFeedback("正在保存 Pi 安全模式...");
  try {
    const response = await fetch("/api/settings/security", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.detail || `HTTP ${response.status}`);
    }
    setSecurityFeedback(payload?.detail || "Pi 安全模式已更新。");
    await loadDiagnostics(true);
  } catch (error) {
    setSecurityFeedback(`保存失败：${error.message}`, true);
  } finally {
    renderDiagnosticsActions();
  }
}

function cancelDesktopPiLoginPolling() {
  desktopPiLoginPollToken += 1;
}

function closeSettingsPanel() {
  cancelDesktopPiLoginPolling();
  settingsOverlayEl?.classList.add("hidden");
  clearSettingsFeedback();
}

async function applyKnowledgeBasePath(pathOverride = "", options = {}) {
  const shouldReload = options.reload !== false;
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
    appSettings = {
      ...(appSettings || {}),
      knowledge_base: payload.knowledge_base || appSettings?.knowledge_base || {},
      startup: payload.startup || appSettings?.startup || {},
    };
    renderSettings();
    if (shouldReload) {
      setKnowledgeBaseFeedback("知识库已切换，正在刷新页面...");
      window.setTimeout(() => window.location.reload(), 250);
    } else {
      setKnowledgeBaseFeedback("知识库位置已更新。");
      setStartupFeedback("");
      await loadDiagnostics(true);
    }
  } catch (error) {
    setKnowledgeBaseFeedback(`切换失败：${error.message}`, true);
  } finally {
    applyKnowledgeBasePathButtonEl.disabled = false;
    if (pickKnowledgeBasePathButtonEl) {
      pickKnowledgeBasePathButtonEl.disabled = false;
    }
  }
}

async function pickKnowledgeBasePath(options = {}) {
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
    await applyKnowledgeBasePath(nextPath, options);
  } catch (error) {
    setKnowledgeBaseFeedback(`选择目录失败：${error.message}`, true);
    setStartupFeedback(`选择目录失败：${error.message}`, true);
  } finally {
    if (pickKnowledgeBasePathButtonEl) {
      pickKnowledgeBasePathButtonEl.disabled = false;
    }
  }
}

async function completeStartupOnboarding() {
  const response = await fetch("/api/settings/startup/complete", {
    method: "POST",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.detail || `HTTP ${response.status}`);
  }
  appSettings = {
    ...(appSettings || {}),
    startup: payload.startup || {},
  };
  renderSettings();
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

async function pollPiInstallUntilSettled() {
  startupPiInstallPolling = true;
  const deadline = Date.now() + 3 * 60 * 1000;
  while (Date.now() < deadline) {
    await sleep(2500);
    await loadAppSettings();
    await loadDiagnostics(true);
    const status = piInstallStatus();
    if (!status.install_in_progress) {
      if (status.installed) {
        setProviderFeedback("");
        setDiagnosticsFeedback("");
        setStartupFeedback("");
        showSettingsToast("Pi 已安装完成，可以继续打开终端完成 `/login`。");
      } else {
        const detail = String(status.detail || "Pi 安装未完成，请查看诊断信息。");
        setProviderFeedback(detail, true);
        setDiagnosticsFeedback(detail, true);
        setStartupFeedback(detail, true);
      }
      renderStartupOverlay();
      startupPiInstallPolling = false;
      return;
    }
  }

  const timeoutMessage = "Pi 仍在后台安装中；如果等待较久，请刷新诊断信息并查看安装日志路径。";
  setProviderFeedback(timeoutMessage);
  setDiagnosticsFeedback(timeoutMessage);
  setStartupFeedback(timeoutMessage);
  renderStartupOverlay();
  startupPiInstallPolling = false;
}

async function triggerPiInstall() {
  startupOverlayDismissed = false;
  renderPiInstallActions();
  renderStartupOverlay();
  setProviderFeedback("正在后台安装 Pi...");
  setDiagnosticsFeedback("正在后台安装 Pi...");
  setStartupFeedback("正在后台安装 Pi...");
  try {
    const response = await fetch("/api/settings/pi-install", {
      method: "POST",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.detail || `HTTP ${response.status}`);
    }
    appSettings = {
      ...(appSettings || {}),
      pi_install: data.pi_install || {},
    };
    renderSettings();
    await loadDiagnostics(true);
    showSettingsToast(data.detail || "Pi 安装流程已启动。");
    if (piInstallStatus().install_in_progress && !startupPiInstallPolling) {
      await pollPiInstallUntilSettled();
    }
  } catch (error) {
    const message = `安装 Pi 失败：${error.message}`;
    setProviderFeedback(message, true);
    setDiagnosticsFeedback(message, true);
    setStartupFeedback(message, true);
  } finally {
    renderPiInstallActions();
    renderStartupOverlay();
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
providerInstallPiButtonEl?.addEventListener("click", async () => {
  await triggerPiInstall();
});
startupInstallPiButtonEl?.addEventListener("click", async () => {
  await triggerPiInstall();
});
startupPickKnowledgeBaseButtonEl?.addEventListener("click", async () => {
  await pickKnowledgeBasePath({ reload: false });
});
startupOpenDiagnosticsButtonEl?.addEventListener("click", async () => {
  setStartupFeedback("诊断面板已打开。查看完成后关闭设置窗口即可回到当前步骤。");
  openSettingsSection("diagnostics");
  await loadDiagnostics(true);
});
startupBackButtonEl?.addEventListener("click", () => {
  setStartupWizardStep(startupWizardStep - 1);
});
startupNextButtonEl?.addEventListener("click", () => {
  void (async () => {
    try {
      if (!startupState().onboardingPending) {
        return;
      }
      if (startupWizardStep < startupWizardSteps().length - 1) {
        setStartupWizardStep(startupWizardStep + 1);
        return;
      }
      await completeStartupOnboarding();
      startupOverlayDismissed = true;
      renderStartupOverlay();
      setStartupFeedback("");
    } catch (error) {
      setStartupFeedback(`无法完成首次配置：${error.message}`, true);
    }
  })();
});
startupRetryButtonEl?.addEventListener("click", async () => {
  startupOverlayDismissed = false;
  setStartupFeedback("");
  try {
    await loadAppSettings();
    await loadDiagnostics(true);
  } catch (error) {
    setStartupFeedback(`重新检查失败：${error.message}`, true);
  }
});
startupContinueButtonEl?.addEventListener("click", () => {
  void (async () => {
    try {
      if (startupState().onboardingPending) {
        await completeStartupOnboarding();
        startupOverlayDismissed = true;
        renderStartupOverlay();
      } else {
        startupOverlayDismissed = true;
        renderStartupOverlay();
      }
      setStartupFeedback("");
    } catch (error) {
      setStartupFeedback(`无法继续：${error.message}`, true);
    }
  })();
});
providerDesktopLoginButtonEl?.addEventListener("click", async () => {
  await triggerDesktopPiLogin(String(providerKeyInputEl?.value || "").trim());
});
installPiButtonEl?.addEventListener("click", async () => {
  await triggerPiInstall();
});
resetProviderButtonEl?.addEventListener("click", () => resetProviderForm(providerFormMode));
refreshDiagnosticsButtonEl?.addEventListener("click", async () => {
  await loadDiagnostics(true);
});
openDiagnosticsKbButtonEl?.addEventListener("click", async () => {
  try {
    await openDesktopPath(
      diagnosticsState.data?.knowledge_base?.path || appSettings?.knowledge_base?.path || "",
      "知识库"
    );
    setDiagnosticsFeedback("");
  } catch (error) {
    setDiagnosticsFeedback(`打开失败：${error.message}`, true);
  }
});
openDiagnosticsLogButtonEl?.addEventListener("click", async () => {
  try {
    await openDesktopPath(diagnosticsState.data?.pi_install?.install_log_path || "", "日志");
    setDiagnosticsFeedback("");
  } catch (error) {
    setDiagnosticsFeedback(`打开失败：${error.message}`, true);
  }
});
securityModeSelectEl?.addEventListener("change", () => {
  renderSecurityControls();
  setSecurityFeedback("");
});
saveSecuritySettingsButtonEl?.addEventListener("click", async () => {
  await saveSecuritySettings();
});
openSecurityLogButtonEl?.addEventListener("click", async () => {
  try {
    await openDesktopPath(diagnosticsState.data?.security?.log_path || "", "安全日志");
    setSecurityFeedback("");
  } catch (error) {
    setSecurityFeedback(`打开失败：${error.message}`, true);
  }
});
exportDiagnosticsSummaryButtonEl?.addEventListener("click", async () => {
  await exportDiagnosticsSummary();
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

renderStartupOverlay();

void loadAppSettings().catch((error) => {
  console.error("Failed to load app settings:", error);
  startupLoadFailure = String(error.message || error);
  if (knowledgeBaseNameEl) {
    knowledgeBaseNameEl.textContent = "Knowledge Base";
  }
  renderStartupOverlay();
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
