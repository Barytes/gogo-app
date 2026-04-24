const listEl = document.querySelector("#wiki-list");
const searchEl = document.querySelector("#wiki-search");
const titleEl = document.querySelector("#wiki-title");
const categoryEl = document.querySelector("#wiki-category");
const contentEl = document.querySelector("#wiki-content");
const editorEl = document.querySelector("#wiki-editor");
const editorFeedbackEl = document.querySelector("#wiki-editor-feedback");
const quoteIntoChatEl = document.querySelector("#quote-into-chat");
const historyBackEl = document.querySelector("#wiki-history-back");
const historyForwardEl = document.querySelector("#wiki-history-forward");
const editEl = document.querySelector("#wiki-edit");
const deleteEl = document.querySelector("#wiki-delete");
const createMdEl = document.querySelector("#wiki-create-md");
const saveEl = document.querySelector("#wiki-save");
const cancelEl = document.querySelector("#wiki-cancel");
const insertIngestEl = document.querySelector("#wiki-insert-ingest");
const modeWikiEl = document.querySelector("#mode-wiki");
const modeInboxEl = document.querySelector("#mode-inbox");
const modeRawEl = document.querySelector("#mode-raw");
const markdownCreateOverlayEl = document.querySelector("#markdown-create-overlay");
const markdownCreateRootLabelEl = document.querySelector("#markdown-create-root-label");
const markdownCreatePathEl = document.querySelector("#markdown-create-path");
const markdownCreateFeedbackEl = document.querySelector("#markdown-create-feedback");
const markdownCreateSubmitEl = document.querySelector("#markdown-create-submit");
const markdownCreateCancelEl = document.querySelector("#markdown-create-cancel");
const markdownCreateCloseEl = document.querySelector("#markdown-create-close");

let allPages = [];
let activePath = "";
let activePage = null;
let activeMode = "wiki";
let activeRenderMode = "markdown";
let wikiEditing = false;
let wikiSaving = false;
let wikiEditorOriginalContent = "";
let markdownCreateMode = "wiki";
const wikiBackHistory = [];
const wikiForwardHistory = [];

function isMarkdownWorkbenchMode(mode) {
  return ["wiki", "raw", "inbox"].includes(String(mode || "").trim());
}

function setWikiEditorFeedback(message = "", isError = false) {
  if (!editorFeedbackEl) {
    return;
  }
  const text = String(message || "").trim();
  editorFeedbackEl.textContent = text;
  editorFeedbackEl.classList.toggle("hidden", !text);
  editorFeedbackEl.classList.toggle("is-error", Boolean(text) && isError);
}

function currentEditorContent() {
  return String(editorEl?.value || "").replace(/\r\n/g, "\n");
}

function hasUnsavedWikiChanges() {
  return wikiEditing && currentEditorContent() !== wikiEditorOriginalContent;
}

function confirmDiscardWikiEdits() {
  if (!hasUnsavedWikiChanges()) {
    return true;
  }
  return window.confirm("当前页面有未保存的修改，确定放弃吗？");
}

function canEditCurrentPage() {
  return isMarkdownWorkbenchMode(activeMode) && activeRenderMode === "markdown" && Boolean(activePage?.path);
}

function canCreateWikiPage() {
  return isMarkdownWorkbenchMode(activeMode) && !wikiEditing;
}

function canDeleteCurrentPage() {
  return isMarkdownWorkbenchMode(activeMode) && activeRenderMode === "markdown" && Boolean(activePage?.path) && !wikiEditing;
}

function canInsertIngestPrompt() {
  return activeMode === "inbox" && Boolean(activePage?.path) && !wikiEditing;
}

function setMarkdownCreateFeedback(message = "", isError = false) {
  if (!markdownCreateFeedbackEl) {
    return;
  }
  const text = String(message || "").trim();
  markdownCreateFeedbackEl.textContent = text;
  markdownCreateFeedbackEl.classList.toggle("hidden", !text);
  markdownCreateFeedbackEl.style.color = text ? (isError ? "#b1532f" : "#185c52") : "";
}

function syncWikiEditorActions() {
  const editable = canEditCurrentPage();
  const showDelete = canDeleteCurrentPage();
  const showInsertIngest = canInsertIngestPrompt();
  editEl?.classList.toggle("hidden", !editable || wikiEditing);
  deleteEl?.classList.toggle("hidden", !showDelete);
  createMdEl?.classList.toggle("hidden", !canCreateWikiPage());
  saveEl?.classList.toggle("hidden", !wikiEditing);
  cancelEl?.classList.toggle("hidden", !wikiEditing);
  insertIngestEl?.classList.toggle("hidden", !showInsertIngest);
  if (editEl) {
    editEl.disabled = wikiSaving;
  }
  if (deleteEl) {
    deleteEl.disabled = wikiSaving;
  }
  if (createMdEl) {
    createMdEl.disabled = wikiSaving;
  }
  if (saveEl) {
    saveEl.disabled = wikiSaving;
    saveEl.textContent = wikiSaving ? "保存中..." : "保存";
  }
  if (cancelEl) {
    cancelEl.disabled = wikiSaving;
  }
  if (insertIngestEl) {
    insertIngestEl.disabled = wikiSaving || !canInsertIngestPrompt();
  }
  contentEl?.classList.toggle("hidden", wikiEditing);
  editorEl?.classList.toggle("hidden", !wikiEditing);
  quoteIntoChatEl?.classList.toggle("hidden", wikiEditing);
  if (markdownCreateSubmitEl) {
    markdownCreateSubmitEl.disabled = wikiSaving;
    markdownCreateSubmitEl.textContent = wikiSaving ? "创建中..." : "创建并编辑";
  }
  if (markdownCreateCancelEl) {
    markdownCreateCancelEl.disabled = wikiSaving;
  }
  if (markdownCreateCloseEl) {
    markdownCreateCloseEl.disabled = wikiSaving;
  }
}

function setWikiEditing(editing) {
  wikiEditing = Boolean(editing) && canEditCurrentPage();
  if (editorEl && wikiEditing) {
    editorEl.value = wikiEditorOriginalContent;
  }
  setWikiEditorFeedback("");
  syncWikiEditorActions();
  if (wikiEditing) {
    editorEl?.focus();
    editorEl?.setSelectionRange(editorEl.value.length, editorEl.value.length);
  }
}

function currentMarkdownRootLabel(mode = activeMode) {
  const normalizedMode = isMarkdownWorkbenchMode(mode) ? mode : "wiki";
  return `knowledge-base/${normalizedMode}/`;
}

function normalizeFsPath(path) {
  return String(path || "").trim().replace(/\\/g, "/").replace(/\/+$/, "");
}

function currentMarkdownRootAbsolutePath(mode = activeMode) {
  const kbPath = normalizeFsPath(window.WorkbenchUI?.getAppSettings?.()?.knowledge_base?.path || "");
  if (!kbPath) {
    return "";
  }
  const normalizedMode = isMarkdownWorkbenchMode(mode) ? mode : "wiki";
  return `${kbPath}/${normalizedMode}`;
}

function relativePathFromSelectedFile(selectedPath, rootPath) {
  const normalizedSelected = normalizeFsPath(selectedPath);
  const normalizedRoot = normalizeFsPath(rootPath);
  if (!normalizedSelected || !normalizedRoot) {
    throw new Error("系统选择器没有返回有效路径。");
  }
  const lowerSelected = normalizedSelected.toLowerCase();
  const lowerRoot = normalizedRoot.toLowerCase();
  if (!lowerSelected.startsWith(`${lowerRoot}/`)) {
    throw new Error(`请把文件保存在 ${currentMarkdownRootLabel(markdownCreateMode)} 下。`);
  }
  return normalizedSelected.slice(normalizedRoot.length + 1);
}

function buildInboxIngestPrompt(page = activePage) {
  const title = String(page?.title || "").trim() || stripSourcePrefix(page?.path || "", "inbox") || "当前文件";
  return `请ingest inbox中的《${title}》这页。`;
}

function beginWikiMutation() {
  wikiSaving = true;
  syncWikiEditorActions();
}

function finishWikiMutation() {
  wikiSaving = false;
  syncWikiEditorActions();
}

function closeCreateMarkdownDialog() {
  if (!markdownCreateOverlayEl || wikiSaving) {
    return;
  }
  markdownCreateOverlayEl.classList.add("hidden");
  setMarkdownCreateFeedback("");
}

function openCreateMarkdownDialog() {
  if (!markdownCreateOverlayEl || !markdownCreatePathEl || !canCreateWikiPage()) {
    return;
  }
  markdownCreateMode = isMarkdownWorkbenchMode(activeMode) ? activeMode : "wiki";
  if (markdownCreateRootLabelEl) {
    markdownCreateRootLabelEl.textContent = currentMarkdownRootLabel(markdownCreateMode);
  }
  markdownCreatePathEl.value = defaultNewWikiPath(markdownCreateMode);
  markdownCreateOverlayEl.classList.remove("hidden");
  setMarkdownCreateFeedback("");
  markdownCreatePathEl.focus();
  markdownCreatePathEl.setSelectionRange(markdownCreatePathEl.value.length, markdownCreatePathEl.value.length);
}

async function openCreateMarkdownFlow() {
  if (!canCreateWikiPage()) {
    return;
  }

  markdownCreateMode = isMarkdownWorkbenchMode(activeMode) ? activeMode : "wiki";
  const desktopBridge = window.GogoDesktop;
  const rootPath = currentMarkdownRootAbsolutePath(markdownCreateMode);

  if (desktopBridge?.isDesktopRuntime?.() && typeof desktopBridge.selectMarkdownSavePath === "function" && rootPath) {
    try {
      const result = await desktopBridge.selectMarkdownSavePath(rootPath, defaultNewWikiPath(markdownCreateMode));
      if (result?.canceled) {
        return;
      }
      const relativePath = normalizeNewWikiPath(relativePathFromSelectedFile(result?.path || "", rootPath));
      await createMarkdownFile(markdownCreateMode, relativePath, { viaPicker: true });
      return;
    } catch (error) {
      const message = String(error?.message || error);
      setWikiEditorFeedback(message, true);
      window.WorkbenchUI?.showToast?.(message);
      return;
    }
  }

  openCreateMarkdownDialog();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeHtmlAttribute(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function sanitizeMarkdownHref(value) {
  const href = String(value || "")
    .trim()
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
  if (!href) {
    return "";
  }

  const normalized = href.replace(/[\u0000-\u001f\u007f\s]+/g, "").toLowerCase();
  if (
    normalized.startsWith("javascript:") ||
    normalized.startsWith("data:") ||
    normalized.startsWith("vbscript:")
  ) {
    return "";
  }

  return href;
}

function isExternalWebHref(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

async function openExternalMarkdownLink(href) {
  const safeHref = sanitizeMarkdownHref(href);
  if (!safeHref) {
    return;
  }

  if (window.GogoDesktop?.isDesktopRuntime?.() && typeof window.GogoDesktop.openPath === "function") {
    await window.GogoDesktop.openPath(safeHref);
    return;
  }

  window.open(safeHref, "_blank", "noopener,noreferrer");
}

function buildMarkdownLink(label, href) {
  const safeHref = sanitizeMarkdownHref(href);
  if (!safeHref) {
    return label;
  }

  const attributes = [`href="${escapeHtmlAttribute(safeHref)}"`];
  if (isExternalWebHref(safeHref)) {
    attributes.push('target="_blank"', 'rel="noreferrer noopener"', 'data-external-link="true"');
  }

  return `<a ${attributes.join(" ")}>${label}</a>`;
}

function renderInline(text) {
  let rendered = escapeHtml(text);
  rendered = rendered.replace(/`([^`]+)`/g, "<code>$1</code>");
  rendered = rendered.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) =>
    buildMarkdownLink(label, href)
  );
  return rendered;
}

function decodeUriComponentSafe(value) {
  try {
    return decodeURIComponent(String(value || ""));
  } catch (_error) {
    return String(value || "");
  }
}

function formatPageLocationLabel(mode, path = "", category = "") {
  const modeLabel = String(mode || "").trim() || "wiki";
  let normalizedPath = String(path || "").trim().replace(/^\/+/, "");
  const normalizedCategory = String(category || "").trim();

  if (modeLabel === "inbox" && normalizedPath.startsWith("inbox/")) {
    normalizedPath = normalizedPath.slice("inbox/".length);
  }

  if (normalizedPath) {
    return `${modeLabel} / ${normalizedPath}`;
  }
  if (normalizedCategory && normalizedCategory !== "root") {
    return `${modeLabel} / ${normalizedCategory}`;
  }
  return modeLabel;
}

function stripSourcePrefix(path, source = activeMode) {
  const normalizedPath = String(path || "").trim().replace(/^\/+/, "");
  const normalizedSource = String(source || "").trim();
  if (normalizedSource === "inbox" && normalizedPath.startsWith("inbox/")) {
    return normalizedPath.slice("inbox/".length);
  }
  if (normalizedSource === "raw" && normalizedPath.startsWith("raw/")) {
    return normalizedPath.slice("raw/".length);
  }
  if (normalizedSource === "wiki" && normalizedPath.startsWith("wiki/")) {
    return normalizedPath.slice("wiki/".length);
  }
  return normalizedPath;
}

async function extractErrorMessage(response) {
  const payload = await response.json().catch(() => ({}));
  return String(payload?.detail || `HTTP ${response.status}`);
}

function formatBytes(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return "—";
  }
  if (number < 1024) {
    return `${number} B`;
  }
  if (number < 1024 * 1024) {
    return `${(number / 1024).toFixed(1)} KB`;
  }
  return `${(number / (1024 * 1024)).toFixed(1)} MB`;
}

function formatModifiedAtLabel(rawValue) {
  const text = String(rawValue || "").trim();
  if (!text) {
    return "—";
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return text;
  }
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function humanizePageName(filename) {
  const base = String(filename || "").trim().replace(/\.md$/i, "");
  if (!base) {
    return "Untitled";
  }
  return base
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function normalizePathSegments(segments) {
  const normalized = [];
  segments.forEach((segment) => {
    const part = String(segment || "").trim();
    if (!part || part === ".") {
      return;
    }
    if (part === "..") {
      normalized.pop();
      return;
    }
    normalized.push(part);
  });
  return normalized;
}

function getCurrentLocation() {
  if (!activePath) {
    return null;
  }
  return {
    path: activePath,
    source: activeMode,
  };
}

function isSameLocation(left, right) {
  if (!left || !right) {
    return false;
  }
  return left.path === right.path && left.source === right.source;
}

function updateWikiHistoryButtons() {
  if (historyBackEl) {
    historyBackEl.disabled = wikiBackHistory.length === 0;
  }
  if (historyForwardEl) {
    historyForwardEl.disabled = wikiForwardHistory.length === 0;
  }
}

function resolveWorkbenchTarget(href, currentPath = "", currentSource = "wiki") {
  const rawHref = String(href || "").trim();
  if (!rawHref || rawHref.startsWith("#")) {
    return null;
  }

  let candidate = rawHref;
  try {
    const url = new URL(rawHref, window.location.origin);
    if (url.origin !== window.location.origin) {
      return null;
    }
    const page = url.searchParams.get("page");
    if (page) {
      return { source: "wiki", path: decodeUriComponentSafe(page) };
    }
    const inbox = url.searchParams.get("inbox");
    if (inbox) {
      return { source: "inbox", path: decodeUriComponentSafe(inbox) };
    }
    const raw = url.searchParams.get("raw");
    if (raw) {
      return { source: "raw", path: decodeUriComponentSafe(raw) };
    }
    candidate = `${url.pathname}${url.search}${url.hash}`;
  } catch (_error) {
    candidate = rawHref;
  }

  if (/^(https?:|mailto:|tel:|data:|javascript:)/i.test(candidate)) {
    return null;
  }

  let normalized = decodeUriComponentSafe(candidate)
    .replace(window.location.origin, "")
    .replace(/^\/+/, "");

  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("?")) {
    const params = new URLSearchParams(normalized.slice(1));
    const page = params.get("page");
    if (page) {
      return { source: "wiki", path: decodeUriComponentSafe(page) };
    }
    const inbox = params.get("inbox");
    if (inbox) {
      return { source: "inbox", path: decodeUriComponentSafe(inbox) };
    }
    const raw = params.get("raw");
    if (raw) {
      return { source: "raw", path: decodeUriComponentSafe(raw) };
    }
    return null;
  }

  if (normalized.startsWith("wiki/")) {
    return { source: "wiki", path: normalized.slice(5) };
  }

  if (normalized.startsWith("raw/")) {
    return { source: "raw", path: normalized.slice(4) };
  }

  if (normalized.startsWith("inbox/")) {
    return { source: "inbox", path: normalized };
  }

  const looksLikeRootWikiPath =
    normalized.startsWith("knowledge/") ||
    normalized.startsWith("insights/") ||
    normalized === "index.md" ||
    normalized === "README.md" ||
    normalized === "log.md";

  if (looksLikeRootWikiPath) {
    return { source: "wiki", path: normalized };
  }

  const baseSegments = currentPath
    ? currentPath.split("/").filter(Boolean).slice(0, -1)
    : [];
  const targetSegments = normalizePathSegments([
    ...(normalized.startsWith("/") ? [] : baseSegments),
    ...normalized.split("/"),
  ]);
  const targetPath = targetSegments.join("/");
  if (!targetPath) {
    return null;
  }

  if (currentSource === "raw") {
    return { source: "raw", path: targetPath };
  }
  if (currentSource === "inbox") {
    return { source: "inbox", path: targetPath.startsWith("inbox/") ? targetPath : `inbox/${targetPath}` };
  }
  if (targetPath.startsWith("raw/")) {
    return { source: "raw", path: targetPath.slice(4) };
  }
  return { source: "wiki", path: targetPath };
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
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
      html.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`);
      return;
    }

    if (trimmed.startsWith("> ")) {
      closeLists();
      html.push(`<blockquote>${renderInline(trimmed.slice(2))}</blockquote>`);
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
      html.push(`<li>${renderInline(trimmed.slice(2))}</li>`);
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
      html.push(`<li>${renderInline(orderedMatch[1])}</li>`);
      return;
    }

    closeLists();
    html.push(`<p>${renderInline(trimmed)}</p>`);
  });

  closeLists();
  closeCode();
  return html.join("\n");
}

function groupPages(pages) {
  const groups = {};
  pages.forEach((page) => {
    const key = page.section || "root";
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(page);
  });
  return groups;
}

function renderList(pages) {
  listEl.innerHTML = "";

  if (!pages.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "没有匹配到页面。";
    listEl.appendChild(empty);
    return;
  }

  const groups = groupPages(pages);
  Object.keys(groups)
    .sort()
    .forEach((groupName) => {
      const section = document.createElement("section");
      section.className = "wiki-list-section";

      const heading = document.createElement("h3");
      heading.textContent = groupName;
      section.appendChild(heading);

      const ul = document.createElement("ul");
      groups[groupName].forEach((page) => {
        const li = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "wiki-list-item";
        if (page.path === activePath && String(page.source || activeMode) === activeMode) {
          button.classList.add("active");
        }
        button.innerHTML = `<strong>${escapeHtml(String(page.title || ""))}</strong><small>${escapeHtml(String(page.summary || ""))}</small>`;
        button.addEventListener("click", async () => {
          await navigateToPage(page.path, page.source || activeMode, { recordHistory: true });
        });
        li.appendChild(button);
        ul.appendChild(li);
      });
      section.appendChild(ul);
      listEl.appendChild(section);
    });
}

function setMode(mode) {
  activeMode = mode;
  modeWikiEl?.classList.toggle("active", mode === "wiki");
  modeInboxEl?.classList.toggle("active", mode === "inbox");
  modeRawEl?.classList.toggle("active", mode === "raw");
}

function currentListEndpoint(query = "") {
  if (activeMode === "raw") {
    return query
      ? `/api/raw/search?q=${encodeURIComponent(query)}`
      : "/api/raw/files";
  }

  if (activeMode === "inbox") {
    return query
      ? `/api/inbox/search?q=${encodeURIComponent(query)}`
      : "/api/inbox/files";
  }

  return query
    ? `/api/wiki/search?q=${encodeURIComponent(query)}`
    : "/api/wiki/pages";
}

function listEndpointForMode(mode, query = "") {
  if (mode === "raw") {
    return query
      ? `/api/raw/search?q=${encodeURIComponent(query)}`
      : "/api/raw/files";
  }
  if (mode === "inbox") {
    return query
      ? `/api/inbox/search?q=${encodeURIComponent(query)}`
      : "/api/inbox/files";
  }
  return query
    ? `/api/wiki/search?q=${encodeURIComponent(query)}`
    : "/api/wiki/pages";
}

function resolveIndexedPath(path, source = "wiki") {
  const normalizedPath = String(path || "").trim().replace(/^\/+/, "");
  if (!normalizedPath) {
    return "";
  }
  if (source !== "wiki") {
    return normalizedPath;
  }
  if (normalizedPath.includes("/")) {
    return normalizedPath;
  }

  const exactMatch = allPages.find((page) => page?.path === normalizedPath);
  if (exactMatch?.path) {
    return exactMatch.path;
  }

  const basenameMatches = allPages.filter((page) => {
    const pagePath = String(page?.path || "").trim();
    return pagePath && pagePath.split("/").pop() === normalizedPath;
  });
  if (basenameMatches.length === 1) {
    return basenameMatches[0].path;
  }

  return normalizedPath;
}

function currentDetailEndpoint(path) {
  if (activeMode === "raw") {
    return `/api/raw/file?path=${encodeURIComponent(path)}`;
  }
  if (activeMode === "inbox") {
    return `/api/inbox/file?path=${encodeURIComponent(path)}`;
  }
  return `/api/wiki/page?path=${encodeURIComponent(path)}`;
}

async function fetchPages(query = "") {
  const url = currentListEndpoint(query);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }
  const data = await response.json();
  return data.items || [];
}

async function fetchPagesForMode(mode, query = "") {
  const url = listEndpointForMode(mode, query);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }
  const data = await response.json();
  return data.items || [];
}

function renderInboxMetaSummary(data) {
  const fields = [
    ["路径", String(data.path || "").replace(/^inbox\//, "") || "—"],
    ["类型", String(data.type_label || data.content_type || "—")],
    ["状态", String(data.status_label || "—")],
    ["大小", formatBytes(data.size_bytes ?? data.size)],
    ["更新于", formatModifiedAtLabel(data.modified_at)],
  ];

  const rows = fields
    .map(([label, value]) => `<div class="summary-meta-row"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`)
    .join("");
  return `
    <div class="summary-box inbox-detail-summary">
      <p>当前正在浏览知识库 Inbox 中的文件。</p>
      <div class="summary-meta-grid">
        ${rows}
      </div>
    </div>
  `;
}

function renderModeEmptyState(mode, query = "") {
  const modeLabel = mode === "inbox" ? "Inbox" : mode === "raw" ? "Raw" : "Wiki";
  const hasQuery = Boolean(String(query || "").trim());

  activePath = "";
  activePage = null;
  activeRenderMode = mode === "wiki" ? "markdown" : "binary";
  wikiSaving = false;
  wikiEditing = false;
  wikiEditorOriginalContent = "";

  categoryEl.textContent = modeLabel;
  titleEl.textContent = hasQuery ? `没有匹配到 ${modeLabel} 内容` : `${modeLabel} 里还没有内容`;
  contentEl.innerHTML = `<p class="empty-state">${escapeHtml(
    hasQuery ? "试试换个关键词。" : (mode === "inbox" ? "当前知识库的 inbox 里还没有文件。" : "当前视图还没有可显示的内容。")
  )}</p>`;
  if (editorEl) {
    editorEl.value = "";
  }
  setWikiEditorFeedback("");
  syncWikiEditorActions();
  renderList(allPages);
}

function renderPageData(data) {
  activePath = data.path;
  activePage = data;
  activeRenderMode = data.render_mode || (activeMode === "wiki" ? "markdown" : "binary");
  wikiEditorOriginalContent = activeRenderMode === "markdown" ? String(data.content || "").replace(/\r\n/g, "\n") : "";
  wikiSaving = false;
  wikiEditing = false;

  categoryEl.textContent = formatPageLocationLabel(activeMode, data.path, data.category);
  titleEl.textContent = data.title;

  const inboxSummary = "";

  if (activeRenderMode === "markdown") {
    contentEl.innerHTML = `${inboxSummary}${markdownToHtml(data.content || "")}`;
    window.GogoMath?.renderElement?.(contentEl);
    contentEl.querySelectorAll("a").forEach((a) => {
      const href = a.getAttribute("href") || "";
      if (a.dataset.externalLink === "true" || isExternalWebHref(href)) {
        a.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            await openExternalMarkdownLink(href);
          } catch (error) {
            const message = String(error?.message || error || "打开链接失败。");
            window.WorkbenchUI?.showToast?.(message);
          }
        });
        return;
      }
      const destination = resolveWorkbenchTarget(href, data.path, activeMode);
      if (!destination) {
        return;
      }
      a.addEventListener("click", async (e) => {
        e.preventDefault();
        await window.WikiWorkbench?.openPage?.(destination.path, destination.source);
      });
    });
  } else if (activeRenderMode === "text") {
    contentEl.innerHTML = `${inboxSummary}<pre><code>${escapeHtml(data.content || "")}</code></pre>`;
  } else if (activeRenderMode === "pdf") {
    contentEl.innerHTML = `
      ${inboxSummary}
      <div class="pdf-preview-shell">
        <iframe
          class="pdf-preview-frame"
          src="${escapeHtml(data.preview_url || data.download_url || "#")}"
          title="${escapeHtml(data.title || "PDF Preview")}"
        ></iframe>
      </div>
    `;
  } else if (activeRenderMode === "image") {
    contentEl.innerHTML = `
      ${inboxSummary}
      <div class="pdf-preview-shell">
        <img
          class="pdf-preview-frame"
          src="${escapeHtml(data.preview_url || data.download_url || "#")}"
          alt="${escapeHtml(data.title || "Image Preview")}"
        />
      </div>
    `;
  } else {
    contentEl.innerHTML = `
      ${inboxSummary}
      <div class="summary-box">
        <p>这个文件不是文本内容，当前页面不直接内嵌全文展示。</p>
        <p>文件类型：${escapeHtml(data.content_type || "unknown")}</p>
        <p>文件大小：${escapeHtml(formatBytes(data.size ?? data.size_bytes))}</p>
      </div>
    `;
  }

  if (editorEl) {
    editorEl.value = wikiEditorOriginalContent;
  }

  setWikiEditorFeedback("");
  syncWikiEditorActions();
  renderList(allPages);

  const params = new URLSearchParams(window.location.search);
  if (activeMode === "raw") {
    params.set("raw", data.path);
    params.delete("page");
    params.delete("inbox");
  } else if (activeMode === "inbox") {
    params.set("inbox", data.path);
    params.delete("page");
    params.delete("raw");
  } else {
    params.set("page", data.path);
    params.delete("raw");
    params.delete("inbox");
  }
  window.history.replaceState({}, "", `/${params.toString() ? `?${params.toString()}` : ""}`);
}

async function loadPage(path) {
  const response = await fetch(currentDetailEndpoint(path));
  const data = await response.json();
  if (!response.ok) {
    throw new Error(String(data?.detail || `HTTP ${response.status}`));
  }
  if (!data || typeof data !== "object" || !data.path || !data.title) {
    throw new Error("Wiki API returned an invalid page payload.");
  }
  renderPageData(data);
}

async function navigateToPage(path, source = "wiki", options = {}) {
  const { recordHistory = false, historyDirection = null } = options;
  const resolvedPath = resolveIndexedPath(path, source);
  const currentLocation = getCurrentLocation();
  const targetLocation = { path: resolvedPath, source };
  const previousMode = activeMode;
  const previousPages = allPages;
  const previousSearch = searchEl?.value || "";

  if (wikiEditing && !confirmDiscardWikiEdits()) {
    updateWikiHistoryButtons();
    return false;
  }

  if (!resolvedPath) {
    setMode(source);
    allPages = await fetchPagesForMode(source, "");
    renderModeEmptyState(source);
    updateWikiHistoryButtons();
    return false;
  }

  try {
    if (source !== activeMode) {
      setMode(source);
      if (searchEl) {
        searchEl.value = "";
      }
      allPages = await fetchPages();
    }
    renderList(allPages);
    await loadPage(resolvedPath);
  } catch (error) {
    if (source !== previousMode) {
      setMode(previousMode);
      allPages = previousPages;
      if (searchEl) {
        searchEl.value = previousSearch;
      }
      renderList(allPages);
    }
    categoryEl.textContent = formatPageLocationLabel(source, resolvedPath, "unavailable");
    titleEl.textContent = "暂时无法读取内容";
    contentEl.innerHTML = `<p class="empty-state">${escapeHtml(String(error?.message || "跳转失败。"))}</p>`;
    if (editorEl) {
      editorEl.value = "";
    }
    wikiSaving = false;
    wikiEditing = false;
    setWikiEditorFeedback("");
    syncWikiEditorActions();
    updateWikiHistoryButtons();
    return false;
  }

  if (historyDirection === "back") {
    if (currentLocation && !isSameLocation(currentLocation, targetLocation)) {
      wikiForwardHistory.push(currentLocation);
    }
  } else if (historyDirection === "forward") {
    if (currentLocation && !isSameLocation(currentLocation, targetLocation)) {
      wikiBackHistory.push(currentLocation);
    }
  } else if (recordHistory) {
    if (currentLocation && !isSameLocation(currentLocation, targetLocation)) {
      wikiBackHistory.push(currentLocation);
      wikiForwardHistory.length = 0;
    }
  }

  updateWikiHistoryButtons();
  if (document.body.classList.contains("layout-chat")) {
    setSidebarVisibility(false);
  }
  return true;
}

function defaultPathForMode(mode, pages = []) {
  if (!Array.isArray(pages) || !pages.length) {
    return "";
  }
  if (mode === "wiki") {
    return pages.find((page) => String(page?.path || "") === "index.md")?.path || pages[0]?.path || "";
  }
  return pages[0]?.path || "";
}

async function bootstrap() {
  try {
    const params = new URLSearchParams(window.location.search);
    const initialInbox = params.get("inbox");
    const initialRaw = params.get("raw");
    const initialPage = params.get("page");
    const initialMode = initialInbox ? "inbox" : initialRaw ? "raw" : "wiki";
    setMode(initialMode);

    allPages = await fetchPages();
    renderList(allPages);

    const initialPath = initialInbox || initialRaw || initialPage || defaultPathForMode(initialMode, allPages);
    if (initialPath) {
      await navigateToPage(initialPath, initialMode, { recordHistory: false });
    } else {
      renderModeEmptyState(initialMode);
      updateWikiHistoryButtons();
    }
  } catch (error) {
    categoryEl.textContent = "unavailable";
    titleEl.textContent = "暂时无法读取内容";
    contentEl.innerHTML = `<p class="empty-state">${escapeHtml(String(error?.message || "当前页面已经接好数据结构，但接口还没有返回内容。"))}</p>`;
    syncWikiEditorActions();
  }
}

async function saveCurrentWikiPage() {
  if (!canEditCurrentPage() || !activePage?.path || wikiSaving) {
    return;
  }

  beginWikiMutation();
  setWikiEditorFeedback("正在保存...");

  try {
    const response = await fetch("/api/markdown-file", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: activeMode,
        path: activePage.path,
        content: currentEditorContent(),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(String(data?.detail || `HTTP ${response.status}`));
    }

    const currentQuery = searchEl?.value.trim() || "";
    allPages = await fetchPagesForMode(activeMode, currentQuery);
    renderPageData(data);
    setWikiEditorFeedback("");
    window.WorkbenchUI?.showToast?.("已保存。");
  } catch (error) {
    finishWikiMutation();
    setWikiEditorFeedback(`保存失败：${String(error?.message || error)}`, true);
  }
}

async function deleteCurrentWikiPage() {
  if (!canDeleteCurrentPage() || !activePage?.path || wikiSaving) {
    return;
  }

  const title = String(activePage?.title || activePage?.path || "当前页面").trim();
  if (!window.confirm(`确定删除《${title}》吗？这个操作无法撤销。`)) {
    return;
  }

  beginWikiMutation();
  setWikiEditorFeedback("正在删除...");

  try {
    const response = await fetch(
      `/api/markdown-file?source=${encodeURIComponent(activeMode)}&path=${encodeURIComponent(activePage.path)}`,
      {
        method: "DELETE",
      }
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(String(payload?.detail || `HTTP ${response.status}`));
    }

    const currentMode = activeMode;
    allPages = await fetchPagesForMode(currentMode, "");
    const nextPath = defaultPathForMode(currentMode, allPages);
    if (nextPath) {
      await navigateToPage(nextPath, currentMode, { recordHistory: false });
    } else {
      setMode(currentMode);
      renderModeEmptyState(currentMode);
      updateWikiHistoryButtons();
    }
    window.WorkbenchUI?.showToast?.("已删除 Markdown。");
  } catch (error) {
    finishWikiMutation();
    setWikiEditorFeedback(`删除失败：${String(error?.message || error)}`, true);
  }
}

function defaultNewWikiPath(mode = activeMode) {
  const currentPath = stripSourcePrefix(activePage?.path || "", mode);
  const segments = currentPath.split("/").filter(Boolean);
  const shouldReuseCurrentDirectory = mode === activeMode && segments.length > 1;
  const directory = shouldReuseCurrentDirectory ? segments.slice(0, -1).join("/") : "";
  return directory ? `${directory}/untitled.md` : "untitled.md";
}

function normalizeNewWikiPath(rawValue) {
  const candidate = String(rawValue || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!candidate) {
    throw new Error("请输入 Markdown 文件路径。");
  }

  const rawSegments = candidate.split("/");
  if (rawSegments.some((segment) => !segment.trim())) {
    throw new Error("路径里不能包含空的目录层级。");
  }
  if (rawSegments.some((segment) => segment === "." || segment === "..")) {
    throw new Error("路径里不能包含 . 或 ..。");
  }

  const segments = rawSegments.map((segment) => segment.trim());
  if (segments.some((segment) => segment.startsWith("."))) {
    throw new Error("文件名或目录名不能以 . 开头。");
  }
  if (segments.some((segment) => /[<>:"|?*]/.test(segment))) {
    throw new Error("文件路径里包含不支持的字符。");
  }

  const normalized = segments.join("/");
  if (!normalized.toLowerCase().endsWith(".md")) {
    throw new Error("只支持创建 .md 文件。");
  }
  return normalized;
}

function defaultNewWikiContent(path) {
  const filename = String(path || "").split("/").pop() || "untitled.md";
  return `# ${humanizePageName(filename)}\n\n`;
}

async function createMarkdownFile(source, relativePath, options = {}) {
  const { viaPicker = false } = options;

  beginWikiMutation();
  setWikiEditorFeedback("");
  setMarkdownCreateFeedback(viaPicker ? "" : "正在创建...");

  try {
    const normalizedSource = isMarkdownWorkbenchMode(source) ? source : "wiki";
    const newPath = stripSourcePrefix(relativePath, normalizedSource);
    const navigationPath = normalizedSource === "inbox" ? `inbox/${newPath}` : newPath;
    const response = await fetch("/api/markdown-file", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: normalizedSource,
        path: newPath,
        content: defaultNewWikiContent(newPath),
      }),
    });
    const payload = await response.json().catch(() => ({}));

    if (searchEl) {
      searchEl.value = "";
    }
    if (normalizedSource === activeMode) {
      allPages = await fetchPagesForMode(normalizedSource, "");
      renderList(allPages);
    }

    if (response.status === 409) {
      const opened = await navigateToPage(navigationPath, normalizedSource, { recordHistory: true });
      if (opened) {
        closeCreateMarkdownDialog();
        setWikiEditing(true);
      } else {
        finishWikiMutation();
        if (!viaPicker) {
          setMarkdownCreateFeedback("Markdown 已存在，但暂时没能打开它。", true);
        }
        return;
      }
      window.WorkbenchUI?.showToast?.("Markdown 已存在，已打开现有文件。");
      return;
    }

    if (!response.ok) {
      throw new Error(String(payload?.detail || `HTTP ${response.status}`));
    }

    const opened = await navigateToPage(navigationPath, normalizedSource, { recordHistory: true });
    if (opened) {
      closeCreateMarkdownDialog();
      setWikiEditing(true);
    } else {
      finishWikiMutation();
      if (!viaPicker) {
        setMarkdownCreateFeedback("文件已经创建成功，但暂时没能打开它。", true);
      }
      return;
    }
    window.WorkbenchUI?.showToast?.("已创建 Markdown。");
  } catch (error) {
    finishWikiMutation();
    const message = `创建失败：${String(error?.message || error)}`;
    if (!viaPicker) {
      setMarkdownCreateFeedback(message, true);
    }
    throw error instanceof Error ? error : new Error(message);
  }
}

async function createCurrentWikiPage() {
  if (!canCreateWikiPage() || wikiSaving || !markdownCreatePathEl) {
    return;
  }

  let newPath = "";
  try {
    newPath = normalizeNewWikiPath(markdownCreatePathEl.value);
  } catch (error) {
    const message = String(error?.message || error);
    setMarkdownCreateFeedback(message, true);
    markdownCreatePathEl.focus();
    return;
  }

  try {
    await createMarkdownFile(markdownCreateMode, newPath, { viaPicker: false });
  } catch (_error) {
    // Feedback is already handled by createMarkdownFile.
  }
}

searchEl.addEventListener("input", async (event) => {
  const query = event.target.value.trim();
  allPages = await fetchPages(query);
  renderList(allPages);
});

modeWikiEl?.addEventListener("click", async () => {
  if (activeMode === "wiki") {
    return;
  }
  const wikiPages = await fetchPagesForMode("wiki", "");
  const path = defaultPathForMode("wiki", wikiPages);
  if (path) {
    await navigateToPage(path, "wiki", { recordHistory: true });
    return;
  }
  await navigateToPage("", "wiki", { recordHistory: true });
});

modeInboxEl?.addEventListener("click", async () => {
  if (activeMode === "inbox") {
    return;
  }
  const inboxPages = await fetchPagesForMode("inbox", "");
  const path = defaultPathForMode("inbox", inboxPages);
  if (path) {
    await navigateToPage(path, "inbox", { recordHistory: true });
    return;
  }
  await navigateToPage("", "inbox", { recordHistory: true });
});

modeRawEl?.addEventListener("click", async () => {
  if (activeMode === "raw") {
    return;
  }
  const rawPages = await fetchPagesForMode("raw", "");
  const path = defaultPathForMode("raw", rawPages);
  if (path) {
    await navigateToPage(path, "raw", { recordHistory: true });
    return;
  }
  await navigateToPage("", "raw", { recordHistory: true });
});

editEl?.addEventListener("click", () => {
  if (!canEditCurrentPage()) {
    return;
  }
  setWikiEditing(true);
});

cancelEl?.addEventListener("click", () => {
  if (!wikiEditing) {
    return;
  }
  if (!confirmDiscardWikiEdits()) {
    return;
  }
  setWikiEditing(false);
});

saveEl?.addEventListener("click", async () => {
  await saveCurrentWikiPage();
});

deleteEl?.addEventListener("click", async () => {
  await deleteCurrentWikiPage();
});

createMdEl?.addEventListener("click", async () => {
  await openCreateMarkdownFlow();
});

editorEl?.addEventListener("input", () => {
  if (!wikiEditing) {
    return;
  }
  setWikiEditorFeedback("");
});

insertIngestEl?.addEventListener("click", () => {
  if (!canInsertIngestPrompt()) {
    return;
  }
  window.WorkbenchUI?.ensureChatVisible?.();
  window.ChatWorkbench?.injectPrompt?.(buildInboxIngestPrompt(activePage), false);
  window.ChatWorkbench?.focusInput?.();
});

markdownCreateCancelEl?.addEventListener("click", () => {
  closeCreateMarkdownDialog();
});

markdownCreateCloseEl?.addEventListener("click", () => {
  closeCreateMarkdownDialog();
});

markdownCreateOverlayEl?.addEventListener("click", (event) => {
  if (event.target === markdownCreateOverlayEl) {
    closeCreateMarkdownDialog();
  }
});

markdownCreatePathEl?.addEventListener("keydown", async (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    await createCurrentWikiPage();
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    closeCreateMarkdownDialog();
  }
});

markdownCreatePathEl?.addEventListener("input", () => {
  setMarkdownCreateFeedback("");
});

markdownCreateSubmitEl?.addEventListener("click", async () => {
  await createCurrentWikiPage();
});

if (quoteIntoChatEl) {
  quoteIntoChatEl.addEventListener("click", () => {
    if (!activePage) {
      return;
    }

    window.WorkbenchUI?.ensureChatVisible?.();

    window.dispatchEvent(
      new CustomEvent("wiki:quote", {
        detail: {
          path: activePage.path,
          title: activePage.title,
          source: activeMode,
        },
      })
    );

    if (window.ChatWorkbench?.focusInput) {
      window.ChatWorkbench.focusInput();
    }
  });
}

function setSidebarVisibility(visible) {
  const sidebarEl = document.querySelector(".wiki-sidebar");
  const panelEl = document.querySelector(".workbench-wiki");
  const openBtn = document.querySelector("#toggle-wiki-sidebar-open");
  const closeBtn = document.querySelector("#toggle-wiki-sidebar-close");
  const shouldShow = Boolean(visible);
  if (!sidebarEl || !panelEl) {
    return;
  }

  sidebarEl.classList.toggle("wiki-sidebar-visible", shouldShow);
  panelEl.classList.toggle("wiki-sidebar-only", shouldShow && document.body.classList.contains("layout-chat"));

  if (openBtn) {
    openBtn.classList.toggle("hidden", shouldShow);
  }
  if (closeBtn) {
    closeBtn.classList.toggle("hidden", !shouldShow);
  }
}

window.WikiWorkbench = {
  openPage: async (path, source = "wiki") => {
    window.WorkbenchUI?.ensureWikiVisible?.();
    return navigateToPage(path, source, { recordHistory: true });
  },
  showSidebar: () => {
    setSidebarVisibility(true);
  },
  hideSidebar: () => {
    setSidebarVisibility(false);
  },
};

// Toggle sidebar buttons
const toggleSidebarOpenBtn = document.querySelector("#toggle-wiki-sidebar-open");
toggleSidebarOpenBtn?.addEventListener("click", () => {
  setSidebarVisibility(true);
});

const toggleSidebarCloseBtn = document.querySelector("#toggle-wiki-sidebar-close");
toggleSidebarCloseBtn?.addEventListener("click", () => {
  setSidebarVisibility(false);
});

// Hide wiki panel button (Chat mode)
const hideWikiPanelChatBtn = document.querySelector("#hide-wiki-panel-chat");
hideWikiPanelChatBtn?.addEventListener("click", () => {
  window.WorkbenchUI?.hideWiki?.();
});

window.addEventListener("beforeunload", (event) => {
  if (!hasUnsavedWikiChanges()) {
    return;
  }
  event.preventDefault();
  event.returnValue = "";
});

historyBackEl?.addEventListener("click", async () => {
  const destination = wikiBackHistory.pop();
  if (!destination) {
    updateWikiHistoryButtons();
    return;
  }
  const succeeded = await navigateToPage(destination.path, destination.source, {
    historyDirection: "back",
  });
  if (!succeeded) {
    wikiBackHistory.push(destination);
  }
  updateWikiHistoryButtons();
});

historyForwardEl?.addEventListener("click", async () => {
  const destination = wikiForwardHistory.pop();
  if (!destination) {
    updateWikiHistoryButtons();
    return;
  }
  const succeeded = await navigateToPage(destination.path, destination.source, {
    historyDirection: "forward",
  });
  if (!succeeded) {
    wikiForwardHistory.push(destination);
  }
  updateWikiHistoryButtons();
});

updateWikiHistoryButtons();
syncWikiEditorActions();
bootstrap();
