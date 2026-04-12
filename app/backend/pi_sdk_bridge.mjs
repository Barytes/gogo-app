import process from "node:process";

import {
  AuthStorage,
  ModelRegistry,
  SessionManager,
  createAgentSession,
  createReadOnlyTools,
} from "@mariozechner/pi-coding-agent";

const MAX_TRACE_ITEMS = 64;
const MAX_TRACE_DETAIL_LENGTH = 280;

function readStdin() {
  return new Promise((resolve, reject) => {
    let raw = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      raw += chunk;
    });
    process.stdin.on("end", () => resolve(raw));
    process.stdin.on("error", reject);
  });
}

function buildPrompt(systemPrompt, prompt) {
  const sections = [];

  if (systemPrompt) {
    sections.push("System instructions:");
    sections.push(systemPrompt.trim());
  }

  sections.push("User request:");
  sections.push((prompt || "").trim());

  return sections.join("\n\n");
}

function truncateText(value, maxLength = MAX_TRACE_DETAIL_LENGTH) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    return "";
  }
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1)}...`;
}

function firstNonEmptyString(candidates) {
  for (const candidate of candidates) {
    const text = truncateText(candidate);
    if (text) {
      return text;
    }
  }
  return "";
}

function stringifyValue(value) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value.includes(" ") ? `"${value}"` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return truncateText(JSON.stringify(value));
}

function formatArgsDetail(rawArgs) {
  if (!rawArgs || typeof rawArgs !== "object" || Array.isArray(rawArgs)) {
    return "";
  }

  const entries = Object.entries(rawArgs).filter(([, value]) => {
    if (value === null || value === undefined) {
      return false;
    }
    if (typeof value === "string") {
      return value.trim().length > 0;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === "object") {
      return Object.keys(value).length > 0;
    }
    return true;
  });

  if (!entries.length) {
    return "";
  }

  return truncateText(
    entries.map(([key, value]) => `${key}=${stringifyValue(value)}`).join(" · ")
  );
}

function formatToolName(toolName) {
  const normalized = String(toolName || "").trim();
  if (!normalized) {
    return "";
  }

  const knownNames = {
    ls: "列出目录",
    read: "读取文件",
    glob: "搜索文件",
    grep: "搜索内容",
  };

  return knownNames[normalized] || normalized;
}

function inferToolAction(toolName) {
  const normalized = String(toolName || "").trim();
  if (normalized === "ls") {
    return "explore";
  }
  if (normalized === "read") {
    return "read";
  }
  if (normalized === "glob" || normalized === "grep") {
    return "search";
  }
  return "tool";
}

function extractPrimaryPath(rawArgs) {
  if (!rawArgs || typeof rawArgs !== "object" || Array.isArray(rawArgs)) {
    return "";
  }

  const pathValue = rawArgs.path || rawArgs.file || rawArgs.pattern || "";
  return typeof pathValue === "string" ? pathValue.trim() : "";
}

function formatPathForDisplay(path) {
  const normalized = String(path || "").trim();
  if (!normalized || normalized === ".") {
    return "仓库根目录";
  }
  return normalized;
}


function buildThinkingTrace(thinkingText) {
  const detail = truncateText(thinkingText, 4000);
  if (!detail) {
    return null;
  }

  return {
    kind: "thinking",
    title: "Pi 原始思考",
    detail,
    action: "thinking",
    event_type: "message_update",
    assistant_type: "thinking_delta",
  };
}

function buildToolStartTrace(event) {
  if (event?.type !== "tool_execution_start") {
    return null;
  }

  const toolName = firstNonEmptyString([
    event.toolName,
    event.tool?.name,
    event.name,
  ]);
  const toolLabel = formatToolName(toolName);
  const toolAction = inferToolAction(toolName);
  const rawArgs =
    event.args && typeof event.args === "object" && !Array.isArray(event.args)
      ? event.args
      : {};
  const toolPath = extractPrimaryPath(rawArgs);
  const toolArgs = formatArgsDetail(rawArgs);

  if (!toolName && !toolPath && !toolArgs) {
    return null;
  }

  return {
    kind: "tool",
    title: toolLabel ? `调用工具：${toolLabel}` : "调用工具",
    detail:
      toolPath
        ? `${toolLabel || "工具"} -> ${formatPathForDisplay(toolPath)}`
        : toolArgs || `${toolLabel || "工具"} 已调用`,
    action: toolAction,
    tool_name: toolName || undefined,
    tool_label: toolLabel || undefined,
    path: toolPath || undefined,
    event_type: event.type,
  };
}

function buildToolErrorTrace(event) {
  if (event?.type !== "tool_execution_end" || !event.isError) {
    return null;
  }

  const toolName = firstNonEmptyString([
    event.toolName,
    event.tool?.name,
    event.name,
  ]);
  const toolLabel = formatToolName(toolName);
  const detail = firstNonEmptyString([
    typeof event.error === "string" ? event.error : "",
    typeof event.result === "string" ? event.result : "",
    typeof event.message === "string" ? event.message : "",
  ]);

  return {
    kind: "status",
    title: toolLabel ? `工具出错：${toolLabel}` : "工具出错",
    detail: detail || "工具执行失败，但没有返回更多错误信息。",
    action: "status",
    event_type: event.type,
    tool_name: toolName || undefined,
    tool_label: toolLabel || undefined,
  };
}

function addTraceEntry(trace, entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const title = truncateText(entry.title, 120);
  const detail = truncateText(entry.detail);
  if (!title && !detail) {
    return null;
  }

  const normalized = {
    kind: typeof entry.kind === "string" ? entry.kind : "status",
    title: title || "Pi event",
    detail,
    event_type:
      typeof entry.event_type === "string" ? entry.event_type : undefined,
    assistant_type:
      typeof entry.assistant_type === "string" ? entry.assistant_type : undefined,
    action:
      typeof entry.action === "string" ? entry.action : undefined,
    tool_name:
      typeof entry.tool_name === "string" ? entry.tool_name : undefined,
    tool_label:
      typeof entry.tool_label === "string" ? entry.tool_label : undefined,
    path: typeof entry.path === "string" ? entry.path : undefined,
  };

  const last = trace[trace.length - 1];
  if (
    last &&
    last.kind === normalized.kind &&
    last.title === normalized.title &&
    last.detail === normalized.detail &&
    last.event_type === normalized.event_type &&
    last.assistant_type === normalized.assistant_type
  ) {
    return null;
  }

  trace.push(normalized);
  if (trace.length > MAX_TRACE_ITEMS) {
    trace.splice(0, trace.length - MAX_TRACE_ITEMS);
  }
  return normalized;
}

function summarizePiEvent(event) {
  if (!event || typeof event !== "object") {
    return null;
  }

  const thinkingTrace = buildThinkingTrace(event);
  if (thinkingTrace) {
    return thinkingTrace;
  }

  const toolStartTrace = buildToolStartTrace(event);
  if (toolStartTrace) {
    return toolStartTrace;
  }

  return buildToolErrorTrace(event);
}

function stringifyMessageContent(content) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (!item || typeof item !== "object") {
          return "";
        }
        if (typeof item.text === "string") {
          return item.text;
        }
        if (item.type === "text" && typeof item.content === "string") {
          return item.content;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function findLatestAssistantText(tree) {
  if (!tree) {
    return "";
  }

  const queue = Array.isArray(tree) ? [...tree] : [tree];
  let latest = "";

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node || typeof node !== "object") {
      continue;
    }

    const role = node.role || node.message?.role || node.entry?.message?.role;
    const content =
      node.content ?? node.message?.content ?? node.entry?.message?.content;

    if (role === "assistant") {
      const text = stringifyMessageContent(content).trim();
      if (text) {
        latest = text;
      }
    }

    const children = node.children || node.entries || node.nodes;
    if (Array.isArray(children)) {
      queue.push(...children);
    }
  }

  return latest;
}

function emitEvent(event) {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

let bridgeStreaming = false;

async function main() {
  try {
    const raw = await readStdin();
    const payload = raw.trim() ? JSON.parse(raw) : {};

    const cwd =
      typeof payload.cwd === "string" && payload.cwd.trim()
        ? payload.cwd.trim()
        : process.cwd();
    const prompt = buildPrompt(payload.system_prompt, payload.prompt);
    const streaming = payload.stream === true;
    const thinkingLevel =
      typeof payload.thinking_level === "string" && payload.thinking_level.trim()
        ? payload.thinking_level.trim()
        : "medium";
    bridgeStreaming = streaming;
    const trace = [];

    const authStorage = AuthStorage.create();
    const modelRegistry = new ModelRegistry(authStorage);
    const { session, modelFallbackMessage } = await createAgentSession({
      cwd,
      authStorage,
      modelRegistry,
      thinkingLevel,
      sessionManager: SessionManager.inMemory(),
      tools: createReadOnlyTools(cwd),
    });

    let assistantText = "";
    let thinkingText = "";
    session.subscribe((event) => {
      const summarizedEvent = summarizePiEvent(event);
      const traceEntry = addTraceEntry(trace, summarizedEvent);
      if (streaming && traceEntry) {
        emitEvent({ type: "trace", item: traceEntry });
      }

      if (event?.type !== "message_update") {
        return;
      }

      const assistantEvent = event.assistantMessageEvent;
      if (!assistantEvent || typeof assistantEvent !== "object") {
        return;
      }

      if (
        assistantEvent.type === "thinking_delta" &&
        typeof assistantEvent.delta === "string"
      ) {
        thinkingText += assistantEvent.delta;
        if (streaming) {
          emitEvent({ type: "thinking_delta", delta: assistantEvent.delta });
        }
      }

      if (
        assistantEvent.type === "text_delta" &&
        typeof assistantEvent.delta === "string"
      ) {
        assistantText += assistantEvent.delta;
        if (streaming) {
          emitEvent({ type: "text_delta", delta: assistantEvent.delta });
        }
      }

      if (
        assistantEvent.type === "text_replace" &&
        typeof assistantEvent.text === "string"
      ) {
        assistantText = assistantEvent.text;
        if (streaming) {
          emitEvent({ type: "text_replace", text: assistantEvent.text });
        }
      }
    });

    await session.prompt(prompt);

    addTraceEntry(trace, buildThinkingTrace(thinkingText));

    if (!assistantText.trim() && typeof session.getTree === "function") {
      assistantText = findLatestAssistantText(session.getTree());
    }

    const warnings = [];
    if (modelFallbackMessage) {
      warnings.push(String(modelFallbackMessage));
    }

    const finalPayload = {
      ok: true,
      message: assistantText.trim(),
      warnings,
      trace,
    };

    if (streaming) {
      emitEvent({
        type: "final",
        message: finalPayload.message,
        warnings: finalPayload.warnings,
        trace: finalPayload.trace,
      });
      return;
    }

    process.stdout.write(JSON.stringify(finalPayload));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : `Unknown Pi SDK error: ${String(error)}`;

    if (bridgeStreaming) {
      emitEvent({ type: "error", message, warnings: [message], trace: [] });
    } else {
      process.stdout.write(JSON.stringify({ ok: false, error: message }));
    }
    process.exitCode = 1;
  }
}

await main();
