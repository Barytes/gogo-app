const bodyEl = document.body;
const layoutWikiButtonEl = document.querySelector("#layout-mode-wiki");
const layoutChatButtonEl = document.querySelector("#layout-mode-chat");
const hideChatButtonEl = document.querySelector("#hide-chat-panel");
const hideWikiButtonEl = document.querySelector("#hide-wiki-panel");
const showChatButtonEl = document.querySelector("#show-chat-panel");
const showWikiButtonEl = document.querySelector("#show-wiki-panel");

const STORAGE_KEY = "research-kb-workbench-layout";

const workbenchState = {
  layout: "wiki",
  chatVisible: true,
  wikiVisible: true,
};

function saveWorkbenchState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workbenchState));
  } catch (error) {
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
  } catch (error) {
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
showChatButtonEl?.addEventListener("click", showChat);
showWikiButtonEl?.addEventListener("click", showWiki);

window.WorkbenchUI = {
  getState: () => ({ ...workbenchState }),
  setLayout,
  showChat,
  hideChat,
  showWiki,
  hideWiki,
  ensureChatVisible: showChat,
  ensureWikiVisible: showWiki,
};
