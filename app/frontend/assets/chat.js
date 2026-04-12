const messagesEl = document.querySelector("#messages");
const formEl = document.querySelector("#chat-form");
const inputEl = document.querySelector("#chat-input");
const suggestionsEl = document.querySelector("#suggestions");
const runtimeLabelEl = document.querySelector("#agent-runtime-label");
const runtimeHelperEl = document.querySelector("#agent-runtime-helper");
const runtimeBehaviorEl = document.querySelector("#agent-runtime-behavior");
const submitButtonEl = formEl?.querySelector("button[type='submit']");

const history = [];

function scrollMessagesToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
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
  if (inputEl) {
    inputEl.disabled = isPending;
  }
  if (submitButtonEl) {
    submitButtonEl.disabled = isPending;
  }
}

window.ChatWorkbench = {
  focusInput: focusChatInput,
  injectPrompt,
};

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
  const parts = trimmed.split("/").filter(Boolean);
  if (!parts.length) {
    return trimmed;
  }
  return parts[parts.length - 1];
}

function describeToolAction(item) {
  const action = item.action || "tool";
  const path = formatShortPath(item.path || "");

  if (action === "explore") {
    return {
      headline: "Explored 1 location",
      detail: path ? `Listed ${path}` : "Listed repository contents",
    };
  }

  if (action === "read") {
    return {
      headline: "Read 1 file",
      detail: path ? `Read ${path}` : `Read ${item.tool_label || "a file"}`,
    };
  }

  if (action === "search") {
    return {
      headline: "Searched 1 target",
      detail: path ? `Searched ${path}` : (item.tool_label || item.title || "Searched"),
    };
  }

  return {
    headline: "Used 1 tool",
    detail: item.tool_label ? `Used ${item.tool_label}` : (item.title || "Used a tool"),
  };
}

function describeToolGroup(items) {
  const first = items[0] || {};
  const action = first.action || "tool";

  if (action === "explore") {
    return { headline: `Explored ${items.length} locations` };
  }
  if (action === "read") {
    return { headline: `Read ${items.length} file${items.length > 1 ? "s" : ""}` };
  }
  if (action === "search") {
    return { headline: `Searched ${items.length} target${items.length > 1 ? "s" : ""}` };
  }
  return { headline: `Used ${items.length} tool${items.length > 1 ? "s" : ""}` };
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
    parts.push(`Pi 过程 ${trace.length} 条`);
  }
  if (Array.isArray(warnings) && warnings.length) {
    parts.push(`warning ${warnings.length}`);
  }
  summary.textContent = parts.join(" · ") || "Pi 过程";
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
    warningTitle.textContent = "Warnings";
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

function appendMessage(role, content, consultedPages = [], trace = [], warnings = []) {
  const wrapper = document.createElement("article");
  wrapper.className = `message message-${role}`;

  if (role === "assistant") {
    renderTrace(wrapper, trace, warnings);
  }

  const meta = createConsultedPagesMeta(consultedPages);

  const text = document.createElement("p");
  text.textContent = content;
  wrapper.appendChild(text);

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
  summaryEl.textContent = "工作日志";
  detailsEl.appendChild(summaryEl);

  const worklogEl = document.createElement("div");
  worklogEl.className = "trace-worklog";
  detailsEl.appendChild(worklogEl);

  const warningsBlockEl = document.createElement("div");
  warningsBlockEl.className = "trace-warnings";
  warningsBlockEl.hidden = true;

  const warningsTitleEl = document.createElement("p");
  warningsTitleEl.className = "trace-section-label";
  warningsTitleEl.textContent = "Warnings";
  warningsBlockEl.appendChild(warningsTitleEl);

  const warningsListEl = document.createElement("ul");
  warningsListEl.className = "trace-warning-list";
  warningsBlockEl.appendChild(warningsListEl);

  detailsEl.appendChild(warningsBlockEl);
  wrapper.appendChild(detailsEl);

  const textEl = document.createElement("p");
  textEl.textContent = initialText;
  wrapper.appendChild(textEl);

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

  function updateTraceSummary() {
    const parts = [];
    if (traceCount) {
      parts.push(`工作日志 ${traceCount} 条`);
    }
    if (warningCount) {
      parts.push(`warning ${warningCount}`);
    }
    summaryEl.textContent = parts.join(" · ") || "工作日志";
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
    setContent(text) {
      hasActualText = true;
      textEl.textContent = text || "";
      scrollMessagesToBottom();
    },
    appendDelta(delta) {
      if (!delta) {
        return;
      }
      if (!hasActualText) {
        textEl.textContent = "";
        hasActualText = true;
      }
      textEl.textContent += delta;
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
      if (finalMessage && (!hasActualText || finalMessage !== textEl.textContent)) {
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
      return textEl.textContent || "";
    },
  };
}

function setSuggestions(items) {
  suggestionsEl.innerHTML = "";
  items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.textContent = item;
    button.addEventListener("click", () => {
      injectPrompt(item, true);
    });
    suggestionsEl.appendChild(button);
  });
}

function describeRuntime() {
  return {
    label: "Pi SDK Runtime",
    helper: "当前由 Pi SDK 驱动，并以本地知识库目录作为只读工作区。",
    behavior: "`/api/chat/stream` 会流式返回 Pi 的文本增量、过程事件和最终结果。",
    welcome: "这里是 Agent 工作台。当前后端是 Pi SDK，会优先结合本地知识库来回答。",
    pending: "Pi 正在生成答复...",
  };
}

function setRuntimeSummary(extraHelper = "") {
  const runtime = describeRuntime();
  if (runtimeLabelEl) {
    runtimeLabelEl.textContent = runtime.label;
  }
  if (runtimeHelperEl) {
    runtimeHelperEl.textContent = extraHelper ? `${runtime.helper} ${extraHelper}` : runtime.helper;
  }
  if (runtimeBehaviorEl) {
    runtimeBehaviorEl.innerHTML = `<code>/api/chat/stream</code> ${runtime.behavior.replace(/^`\/api\/chat\/stream`\s*/, "")}`;
  }
  return runtime;
}

async function loadRuntimeStatus() {
  try {
    const response = await fetch("/api/health");
    const data = await response.json();
    if (data.agent_status?.pi_available === false) {
      return setRuntimeSummary("当前运行环境里还缺少 Node 或 Pi bridge。");
    }
    return setRuntimeSummary();
  } catch (error) {
    return setRuntimeSummary("当前无法读取后端状态。");
  }
}

async function loadSuggestions() {
  try {
    const response = await fetch("/api/chat/suggestions");
    const data = await response.json();
    setSuggestions(data.items || []);
  } catch (error) {
    setSuggestions([
      "这个方向有哪些值得做的 gap？",
      "帮我理解 wiki 的结构。",
    ]);
  }
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

async function sendMessage(message) {
  appendMessage("user", message);
  history.push({ role: "user", content: message });

  const runtime = describeRuntime();
  const liveMessage = createStreamingAssistantMessage(runtime.pending);
  let finalPayload = null;

  setChatPending(true);

  try {
    const response = await fetch("/api/chat/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        history,
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
        if (Array.isArray(event.suggested_prompts) && event.suggested_prompts.length) {
          setSuggestions(event.suggested_prompts);
        }
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

    history.push({ role: "assistant", content: assistantMessage });
  } catch (error) {
    liveMessage.finalize({
      message: "后端暂时没有返回结果。当前页面已经接好了流式调用链路，但服务可能还没启动。",
      warnings: [String(error?.message || error || "Unknown streaming error.")],
    });
    history.push({
      role: "assistant",
      content: "后端暂时没有返回结果。当前页面已经接好了流式调用链路，但服务可能还没启动。",
    });
  } finally {
    setChatPending(false);
  }
}

formEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = inputEl.value.trim();
  if (!message) {
    return;
  }
  inputEl.value = "";
  await sendMessage(message);
});

async function bootstrapChat() {
  const runtime = await loadRuntimeStatus();
  appendMessage("assistant", runtime.welcome, [], [
    {
      kind: "status",
      title: "工作日志已启用",
      detail: "现在会把 Pi 的过程整理成更像 Codex 的工作日志，而不是原始事件列表。",
    },
  ]);
  loadSuggestions();
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
