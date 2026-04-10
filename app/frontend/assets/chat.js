const messagesEl = document.querySelector("#messages");
const formEl = document.querySelector("#chat-form");
const inputEl = document.querySelector("#chat-input");
const suggestionsEl = document.querySelector("#suggestions");
const runtimeLabelEl = document.querySelector("#agent-runtime-label");
const runtimeHelperEl = document.querySelector("#agent-runtime-helper");
const runtimeBehaviorEl = document.querySelector("#agent-runtime-behavior");

const history = [];

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

window.ChatWorkbench = {
  focusInput: focusChatInput,
  injectPrompt,
};

function appendMessage(role, content, consultedPages = []) {
  const wrapper = document.createElement("article");
  wrapper.className = `message message-${role}`;

  const text = document.createElement("p");
  text.textContent = content;
  wrapper.appendChild(text);

  if (consultedPages.length) {
    const meta = document.createElement("div");
    meta.className = "message-meta";
    consultedPages.forEach((page) => {
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
    wrapper.appendChild(meta);
  }

  messagesEl.appendChild(wrapper);
  messagesEl.scrollTop = messagesEl.scrollHeight;
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
    behavior: "`/api/chat` 会调用 Pi SDK，会话前会先附上本地 wiki 和 raw 的检索上下文。",
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
    runtimeBehaviorEl.innerHTML = `<code>/api/chat</code> ${runtime.behavior.replace(/^`\/api\/chat`\s*/, "")}`;
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

async function sendMessage(message) {
  appendMessage("user", message);
  history.push({ role: "user", content: message });

  const runtime = describeRuntime();
  const pending = document.createElement("article");
  pending.className = "message message-assistant";
  pending.dataset.pending = "true";
  pending.innerHTML = `<p>${runtime.pending}</p>`;
  messagesEl.appendChild(pending);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        history,
      }),
    });
    const data = await response.json();

    pending.remove();
    appendMessage("assistant", data.message, data.consulted_pages || []);
    history.push({ role: "assistant", content: data.message });

    if (Array.isArray(data.suggested_prompts) && data.suggested_prompts.length) {
      setSuggestions(data.suggested_prompts);
    }
  } catch (error) {
    pending.remove();
    appendMessage(
      "assistant",
      "后端暂时没有返回结果。当前页面已经接好了调用链路，但服务可能还没启动。"
    );
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
  appendMessage("assistant", runtime.welcome);
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
