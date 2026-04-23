from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import re
from typing import Any
import uuid

from .config import APP_SETTINGS_FILE, APP_STATE_DIR, PI_EXTENSION_DIR, get_knowledge_base_dir


SECURITY_SETTINGS_KEY = "pi_security"
SECURITY_MODE_READONLY = "readonly"
SECURITY_MODE_WORKSPACE_WRITE = "workspace-write"
SECURITY_MODE_FULL_ACCESS = "full-access"
DEFAULT_SECURITY_MODE = SECURITY_MODE_WORKSPACE_WRITE
PI_MANAGED_SECURITY_EXTENSION = PI_EXTENSION_DIR / "managed-security.ts"
PI_SECURITY_LOG_FILE = APP_STATE_DIR / "logs" / "pi-security-events.jsonl"
PI_SECURITY_APPROVALS_FILE = APP_STATE_DIR / "pi-security-approvals.json"
PI_SECURITY_APPROVAL_TTL_MINUTES = 10
PI_SECURITY_INLINE_DIALOG_TIMEOUT_MS = 5 * 60 * 1000
PROTECTED_BASENAMES = [
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    ".bashrc",
    ".zshrc",
    ".gitconfig",
]
PROTECTED_SEGMENTS = [
    ".git",
    "node_modules",
    ".ssh",
]

SECURITY_MODES = [
    {
        "id": SECURITY_MODE_READONLY,
        "label": "只读模式",
        "description": "允许聊天、读文件和搜索，禁止 bash / write / edit。",
    },
    {
        "id": SECURITY_MODE_WORKSPACE_WRITE,
        "label": "允许写文件",
        "description": "允许在当前 knowledge-base 内 write / edit，默认禁止 bash。",
    },
    {
        "id": SECURITY_MODE_FULL_ACCESS,
        "label": "允许执行命令",
        "description": "允许 bash / write / edit，但仍会阻断明显危险命令。",
    },
]

_DANGEROUS_BASH_RULES = [
    {
        "id": "sudo",
        "pattern": r"\bsudo\b",
        "flags": "i",
        "reason": "已阻止包含 sudo 的命令，避免 Pi 直接请求提升宿主机权限。",
    },
    {
        "id": "su",
        "pattern": r"(^|\s)su(\s|$)",
        "flags": "i",
        "reason": "已阻止切换用户命令，避免 Pi 脱离当前用户边界。",
    },
    {
        "id": "rm-root",
        "pattern": r"\brm\s+-[^\n]*r[^\n]*f[^\n]*\s+/(?:\s|$)",
        "flags": "i",
        "reason": "已阻止删除根目录的命令。",
    },
    {
        "id": "rm-home",
        "pattern": r"\brm\s+-[^\n]*r[^\n]*f[^\n]*\s+(~|\$HOME)(?:/|\s|$)",
        "flags": "i",
        "reason": "已阻止删除用户家目录的命令。",
    },
    {
        "id": "mkfs",
        "pattern": r"\bmkfs(?:\.[a-z0-9_-]+)?\b",
        "flags": "i",
        "reason": "已阻止格式化磁盘相关命令。",
    },
    {
        "id": "dd-dev",
        "pattern": r"\bdd\b[^\n]*\bof=/dev/",
        "flags": "i",
        "reason": "已阻止直接向 /dev 写入的命令。",
    },
    {
        "id": "shutdown",
        "pattern": r"\b(shutdown|reboot|halt|poweroff)\b",
        "flags": "i",
        "reason": "已阻止关机或重启宿主机的命令。",
    },
    {
        "id": "diskutil",
        "pattern": r"\bdiskutil\b",
        "flags": "i",
        "reason": "已阻止磁盘工具相关命令。",
    },
    {
        "id": "launchctl",
        "pattern": r"\blaunchctl\b",
        "flags": "i",
        "reason": "已阻止系统服务管理命令。",
    },
]


def _load_app_settings() -> dict[str, Any]:
    if not APP_SETTINGS_FILE.exists():
        return {}
    try:
        raw = json.loads(APP_SETTINGS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return raw if isinstance(raw, dict) else {}


def _save_app_settings(data: dict[str, Any]) -> None:
    APP_SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    APP_SETTINGS_FILE.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _normalize_security_mode(raw_value: Any) -> str:
    normalized = str(raw_value or "").strip().lower()
    allowed = {item["id"] for item in SECURITY_MODES}
    if normalized in allowed:
        return normalized
    return DEFAULT_SECURITY_MODE


def _security_mode_meta(mode: str) -> dict[str, str]:
    normalized = _normalize_security_mode(mode)
    for item in SECURITY_MODES:
        if item["id"] == normalized:
            return {
                "id": item["id"],
                "label": str(item["label"]),
                "description": str(item["description"]),
            }
    return {
        "id": DEFAULT_SECURITY_MODE,
        "label": "允许写文件",
        "description": "允许在当前 knowledge-base 内 write / edit，默认禁止 bash。",
    }


def _current_security_mode() -> str:
    settings = _load_app_settings()
    raw = settings.get(SECURITY_SETTINGS_KEY)
    if isinstance(raw, dict):
        return _normalize_security_mode(raw.get("mode"))
    return DEFAULT_SECURITY_MODE


def _trusted_workspace_items() -> list[dict[str, str]]:
    knowledge_base_dir = get_knowledge_base_dir()
    return [
        {
            "path": str(knowledge_base_dir),
            "label": "当前 knowledge-base",
            "scope": "knowledge-base",
        }
    ]


def _render_ts_string(value: str) -> str:
    return json.dumps(str(value), ensure_ascii=False)


def _render_ts_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2)


def _normalize_host_path(value: Path | str) -> str:
    resolved = Path(value).expanduser().resolve()
    normalized = str(resolved)
    return normalized.lower() if os.name == "nt" else normalized


def _is_within_trusted_roots(target_path: Path | str) -> bool:
    normalized_target = _normalize_host_path(target_path)
    for item in _trusted_workspace_items():
        root = str(item.get("path") or "").strip()
        if not root:
            continue
        normalized_root = _normalize_host_path(root)
        if normalized_target == normalized_root or normalized_target.startswith(normalized_root + os.sep):
            return True
    return False


def _detect_protected_path(target_path: Path | str) -> str:
    resolved = Path(target_path).expanduser().resolve()
    basename = resolved.name.lower()
    if basename in PROTECTED_BASENAMES:
        return f"已阻止修改敏感文件：{resolved}"
    segments = [
        segment.lower()
        for segment in resolved.parts
        if segment and segment not in {resolved.anchor, os.sep, "\\"}
    ]
    if any(segment in PROTECTED_SEGMENTS for segment in segments):
        return f"已阻止修改敏感目录：{resolved}"
    return ""


def _regex_flags_from_string(raw_flags: Any) -> int:
    flags = 0
    normalized = str(raw_flags or "").lower()
    if "i" in normalized:
        flags |= re.IGNORECASE
    if "m" in normalized:
        flags |= re.MULTILINE
    if "s" in normalized:
        flags |= re.DOTALL
    return flags


def _find_dangerous_bash_rule(command: str) -> dict[str, Any] | None:
    normalized = str(command or "").strip()
    if not normalized:
        return None
    for rule in _DANGEROUS_BASH_RULES:
        pattern = str(rule.get("pattern") or "").strip()
        if not pattern:
            continue
        if re.search(pattern, normalized, _regex_flags_from_string(rule.get("flags"))):
            return rule
    return None


def _load_security_approvals() -> list[dict[str, Any]]:
    if not PI_SECURITY_APPROVALS_FILE.exists():
        return []
    try:
        raw = json.loads(PI_SECURITY_APPROVALS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []
    if not isinstance(raw, list):
        return []
    return [item for item in raw if isinstance(item, dict)]


def _save_security_approvals(items: list[dict[str, Any]]) -> None:
    PI_SECURITY_APPROVALS_FILE.parent.mkdir(parents=True, exist_ok=True)
    PI_SECURITY_APPROVALS_FILE.write_text(
        json.dumps(items, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _parse_approval_datetime(raw_value: Any) -> datetime | None:
    text = str(raw_value or "").strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def _approval_is_expired(item: dict[str, Any], *, now: datetime | None = None) -> bool:
    now = now or datetime.now(timezone.utc)
    expires_at = _parse_approval_datetime(item.get("expires_at"))
    if not expires_at:
        return True
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at <= now


def _prune_security_approvals(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    now = datetime.now(timezone.utc)
    return [item for item in items if not _approval_is_expired(item, now=now)]


def create_pi_security_approval(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = payload if isinstance(payload, dict) else {}
    tool_name = str(payload.get("tool_name") or "").strip().lower()
    if tool_name not in {"bash", "write", "edit"}:
        raise ValueError("只支持为 bash / write / edit 创建单次安全放行。")

    created_at = datetime.now(timezone.utc)
    expires_at = created_at + timedelta(minutes=PI_SECURITY_APPROVAL_TTL_MINUTES)
    record: dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "tool_name": tool_name,
        "created_at": created_at.isoformat(),
        "expires_at": expires_at.isoformat(),
    }

    if tool_name == "bash":
        command = str(payload.get("command") or "").strip()
        if not command:
            raise ValueError("缺少需要放行的 bash 命令。")
        blocked_rule = _find_dangerous_bash_rule(command)
        if blocked_rule:
            raise ValueError(str(blocked_rule.get("reason") or "该命令属于硬阻断规则，不能单次放行。"))
        record["command"] = command
    else:
        raw_path = str(payload.get("path") or "").strip()
        resolved_path_text = str(payload.get("resolved_path") or "").strip()
        if not raw_path and not resolved_path_text:
            raise ValueError("缺少需要放行的文件路径。")
        if resolved_path_text:
            resolved_path = Path(resolved_path_text).expanduser().resolve()
        else:
            raw_candidate = Path(raw_path).expanduser()
            resolved_path = (
                raw_candidate.resolve()
                if raw_candidate.is_absolute()
                else (get_knowledge_base_dir() / raw_candidate).resolve()
            )
        if not _is_within_trusted_roots(resolved_path):
            raise ValueError("只支持对当前 knowledge-base 内的文件做单次放行。")
        protected_reason = _detect_protected_path(resolved_path)
        if protected_reason:
            raise ValueError(protected_reason)
        record["path"] = raw_path or str(resolved_path)
        record["resolved_path"] = str(resolved_path)

    approvals = _prune_security_approvals(_load_security_approvals())
    approvals.append(record)
    _save_security_approvals(approvals)
    return record


def _build_security_extension_source() -> str:
    meta = _security_mode_meta(_current_security_mode())
    trusted_roots = [item["path"] for item in _trusted_workspace_items()]
    lines = [
        'import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";',
        'import path from "node:path";',
        'import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";',
        "",
        f"const SECURITY_MODE = {_render_ts_string(meta['id'])};",
        f"const SECURITY_MODE_LABEL = {_render_ts_string(meta['label'])};",
        f"const SECURITY_DIALOG_TIMEOUT_MS = {int(PI_SECURITY_INLINE_DIALOG_TIMEOUT_MS)};",
        "const SECURITY_UI_PREFIX = '__gogo_security_ui__';",
        f"const TRUSTED_ROOTS = {_render_ts_json(trusted_roots)};",
        f"const LOG_PATH = {_render_ts_string(str(PI_SECURITY_LOG_FILE))};",
        f"const APPROVALS_PATH = {_render_ts_string(str(PI_SECURITY_APPROVALS_FILE))};",
        f"const PROTECTED_BASENAMES = {_render_ts_json(PROTECTED_BASENAMES)};",
        f"const PROTECTED_SEGMENTS = {_render_ts_json(PROTECTED_SEGMENTS)};",
        f"const DANGEROUS_BASH_RULES = {_render_ts_json(_DANGEROUS_BASH_RULES)}.map((item) => ({{",
        "  ...item,",
        "  regex: new RegExp(item.pattern, item.flags || ''),",
        "}));",
        "",
        "type ApprovalRecord = {",
        "  id?: string;",
        "  tool_name?: string;",
        "  command?: string;",
        "  path?: string;",
        "  resolved_path?: string;",
        "  expires_at?: string;",
        "};",
        "",
        "function normalizePath(value: string): string {",
        "  const resolved = path.resolve(String(value || '.'));",
        "  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;",
        "}",
        "",
        "const NORMALIZED_TRUSTED_ROOTS = TRUSTED_ROOTS.map((item) => normalizePath(item));",
        "",
        "function isWithinTrustedRoots(targetPath: string): boolean {",
        "  const normalizedTarget = normalizePath(targetPath);",
        "  return NORMALIZED_TRUSTED_ROOTS.some((root) => normalizedTarget === root || normalizedTarget.startsWith(root + path.sep));",
        "}",
        "",
        "function detectProtectedPath(targetPath: string): string {",
        "  const resolved = path.resolve(targetPath);",
        "  const normalized = normalizePath(resolved);",
        "  const basename = path.basename(resolved).toLowerCase();",
        "  if (PROTECTED_BASENAMES.includes(basename)) {",
        "    return `已阻止修改敏感文件：${resolved}`;",
        "  }",
        "  const segments = normalized.split(path.sep).filter(Boolean);",
        "  if (segments.some((segment) => PROTECTED_SEGMENTS.includes(segment.toLowerCase()))) {",
        "    return `已阻止修改敏感目录：${resolved}`;",
        "  }",
        "  return '';",
        "}",
        "",
        "function summarize(value: string, maxLength = 220): string {",
        "  const normalized = String(value || '').replace(/\\s+/g, ' ').trim();",
        "  if (!normalized) return '';",
        "  if (normalized.length <= maxLength) return normalized;",
        "  return `${normalized.slice(0, maxLength - 1).trim()}…`;",
        "}",
        "",
        "function sessionLabel(ctx: any): string {",
        "  try {",
        "    const sessionFile = ctx?.sessionManager?.getSessionFile?.();",
        "    return sessionFile ? path.basename(String(sessionFile)) : 'ephemeral';",
        "  } catch (_error) {",
        "    return 'unknown';",
        "  }",
        "}",
        "",
        "async function recordEvent(entry: Record<string, unknown>): Promise<void> {",
        "  try {",
        "    await mkdir(path.dirname(LOG_PATH), { recursive: true });",
        "    await appendFile(LOG_PATH, `${JSON.stringify(entry)}\\n`, 'utf8');",
        "  } catch (_error) {",
        "    // Best-effort local audit log only.",
        "  }",
        "}",
        "",
        "function approvalExpired(item: ApprovalRecord): boolean {",
        "  const expiresAt = Date.parse(String(item?.expires_at || ''));",
        "  return !Number.isFinite(expiresAt) || expiresAt <= Date.now();",
        "}",
        "",
        "async function loadApprovals(): Promise<ApprovalRecord[]> {",
        "  try {",
        "    const raw = await readFile(APPROVALS_PATH, 'utf8');",
        "    const parsed = JSON.parse(raw);",
        "    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === 'object') : [];",
        "  } catch (_error) {",
        "    return [];",
        "  }",
        "}",
        "",
        "async function saveApprovals(items: ApprovalRecord[]): Promise<void> {",
        "  try {",
        "    await mkdir(path.dirname(APPROVALS_PATH), { recursive: true });",
        "    await writeFile(APPROVALS_PATH, JSON.stringify(items, null, 2), 'utf8');",
        "  } catch (_error) {",
        "    // Best-effort local approval cache only.",
        "  }",
        "}",
        "",
        "async function consumeApproval(matcher: (item: ApprovalRecord) => boolean): Promise<ApprovalRecord | null> {",
        "  const loaded = (await loadApprovals()).filter((item) => !approvalExpired(item));",
        "  let matched: ApprovalRecord | null = null;",
        "  const remaining: ApprovalRecord[] = [];",
        "  for (const item of loaded) {",
        "    if (!matched && matcher(item)) {",
        "      matched = item;",
        "      continue;",
        "    }",
        "    remaining.push(item);",
        "  }",
        "  if (matched || remaining.length !== loaded.length) {",
        "    await saveApprovals(remaining);",
        "  }",
        "  return matched;",
        "}",
        "",
        "async function maybeConsumeApproval(toolName: string, detail: Record<string, unknown>): Promise<ApprovalRecord | null> {",
        "  if (toolName === 'bash') {",
        "    const command = String(detail.command || '').trim();",
        "    if (!command) {",
        "      return null;",
        "    }",
        "    return consumeApproval((item) => String(item?.tool_name || '') === 'bash' && String(item?.command || '').trim() === command);",
        "  }",
        "  const resolvedPath = String(detail.resolved_path || detail.resolvedPath || '').trim();",
        "  const rawPath = String(detail.path || '').trim();",
        "  if (!resolvedPath && !rawPath) {",
        "    return null;",
        "  }",
        "  const normalizedResolvedPath = resolvedPath ? normalizePath(resolvedPath) : '';",
        "  const normalizedRawPath = rawPath ? normalizePath(rawPath) : '';",
        "  return consumeApproval((item) => {",
        "    if (!item || typeof item !== 'object') {",
        "      return false;",
        "    }",
        "    if (String(item.tool_name || '') !== toolName) {",
        "      return false;",
        "    }",
        "    const normalizedApprovalResolved = item.resolved_path ? normalizePath(String(item.resolved_path)) : '';",
        "    const normalizedApprovalPath = item.path ? normalizePath(String(item.path)) : '';",
        "    return Boolean(",
        "      (normalizedResolvedPath && (normalizedResolvedPath === normalizedApprovalResolved || normalizedResolvedPath === normalizedApprovalPath)) ||",
        "      (normalizedRawPath && (normalizedRawPath === normalizedApprovalResolved || normalizedRawPath === normalizedApprovalPath))",
        "    );",
        "  });",
        "}",
        "",
        "function encodeSecurityUiTitle(kind: string, payload: Record<string, unknown>): string {",
        "  return `${SECURITY_UI_PREFIX}:${kind}:${JSON.stringify(payload)}`;",
        "}",
        "",
        "function appendUserSteerReason(reason: string, userReason: string): string {",
        "  const clean = summarize(userReason, 240);",
        "  if (!clean) {",
        "    return reason;",
        "  }",
        "  return `${reason} 用户补充：${clean}`;",
        "}",
        "",
        "async function requestModeDecision(",
        "  ctx: any,",
        "  toolName: string,",
        "  detail: Record<string, unknown>,",
        "  reason: string,",
        "  extra: Record<string, unknown> = {},",
        "): Promise<{ allowed: boolean; denyReason: string }> {",
        "  const payload = {",
        "    message: reason,",
        "    tool_name: toolName,",
        "    ...detail,",
        "    ...extra,",
        "    current_mode: SECURITY_MODE,",
        "    current_mode_label: SECURITY_MODE_LABEL,",
        "  };",
        "  if (!ctx?.hasUI || !ctx.ui?.select || !ctx.ui?.input) {",
        "    return { allowed: false, denyReason: '' };",
        "  }",
        "  const decision = await ctx.ui.select(",
        "    encodeSecurityUiTitle('decision', payload),",
        "    ['allow_once', 'deny_with_reason'],",
        "    { timeout: SECURITY_DIALOG_TIMEOUT_MS },",
        "  );",
        "  if (decision === 'allow_once') {",
        "    return { allowed: true, denyReason: '' };",
        "  }",
        "  if (decision !== 'deny_with_reason') {",
        "    return { allowed: false, denyReason: '' };",
        "  }",
        "  const rawReason = await ctx.ui.input(",
        "    encodeSecurityUiTitle('deny_reason', payload),",
        "    '请输入禁止理由，告诉 Pi 接下来该怎么继续。',",
        "    { timeout: SECURITY_DIALOG_TIMEOUT_MS },",
        "  );",
        "  return { allowed: false, denyReason: String(rawReason || '').trim() };",
        "}",
        "",
        "async function block(",
        "  ctx: any,",
        "  toolName: string,",
        "  detail: Record<string, unknown>,",
        "  reason: string,",
        "  extra: Record<string, unknown> = {},",
        "): Promise<{ block: true; reason: string }> {",
        "  const payload = {",
        "    message: reason,",
        "    tool_name: toolName,",
        "    ...detail,",
        "    ...extra,",
        "  };",
        "  const cleanReason = `[gogo-security] ${JSON.stringify(payload)}`;",
        "  await recordEvent({",
        "    timestamp: new Date().toISOString(),",
        "    session: sessionLabel(ctx),",
        "    mode: SECURITY_MODE,",
        "    tool: toolName,",
        "    decision: 'block',",
        "    reason,",
        "    ...detail,",
        "    ...extra,",
        "  });",
        "  if (ctx?.hasUI) {",
        "    ctx.ui.notify(reason, 'warning');",
        "  }",
        "  return { block: true, reason: cleanReason };",
        "}",
        "",
        "function allow(ctx: any, toolName: string, detail: Record<string, unknown>, extra: Record<string, unknown> = {}): void {",
        "  void recordEvent({",
        "    timestamp: new Date().toISOString(),",
        "    session: sessionLabel(ctx),",
        "    mode: SECURITY_MODE,",
        "    tool: toolName,",
        "    decision: extra.approval_id ? 'allow-approved' : (extra.inline_approval ? 'allow-inline' : 'allow'),",
        "    ...detail,",
        "    ...extra,",
        "  });",
        "}",
        "",
        "export default function (pi: ExtensionAPI) {",
        "  pi.on('tool_call', async (event, ctx) => {",
        "    const toolName = String(event.toolName || '');",
        "    if (toolName !== 'bash' && toolName !== 'write' && toolName !== 'edit') {",
        "      return undefined;",
        "    }",
        "",
        "    if (toolName === 'bash') {",
        "      const command = String((event.input as any)?.command || '').trim();",
        "      const detail = { command };",
        "      for (const rule of DANGEROUS_BASH_RULES) {",
        "        if (rule.regex.test(command)) {",
        "          return block(ctx, toolName, detail, String(rule.reason || '命令已被安全规则阻止。'), {",
        "            block_category: 'dangerous-command',",
        "            can_request_approval: false,",
        "            rule_id: rule.id,",
        "          });",
        "        }",
        "      }",
        "      if (SECURITY_MODE !== 'full-access') {",
        "        const decision = await requestModeDecision(",
        "          ctx,",
        "          toolName,",
        "          detail,",
        "          `当前安全模式为“${SECURITY_MODE_LABEL}”，已禁止 Pi 执行 bash 命令。`,",
        "          {",
        "            block_category: 'mode',",
        "            can_request_approval: true,",
        "          },",
        "        );",
        "        if (decision.allowed) {",
        "          allow(ctx, toolName, detail, {",
        "            inline_approval: true,",
        "            block_category: 'mode',",
        "            current_mode: SECURITY_MODE,",
        "            current_mode_label: SECURITY_MODE_LABEL,",
        "          });",
        "          return undefined;",
        "        }",
        "        return block(ctx, toolName, detail, appendUserSteerReason(`当前安全模式为“${SECURITY_MODE_LABEL}”，已禁止 Pi 执行 bash 命令。`, decision.denyReason), {",
        "          block_category: 'mode',",
        "          can_request_approval: true,",
        "          current_mode: SECURITY_MODE,",
        "          current_mode_label: SECURITY_MODE_LABEL,",
        "          user_steer_reason: decision.denyReason,",
        "        });",
        "      }",
        "      allow(ctx, toolName, detail);",
        "      return undefined;",
        "    }",
        "",
        "    const rawPath = String((event.input as any)?.path || '').trim();",
        "    const resolvedPath = path.resolve(String(ctx?.cwd || process.cwd()), rawPath || '.');",
        "    const detail = { path: rawPath, resolved_path: resolvedPath };",
        "    if (!rawPath) {",
        "      return block(ctx, toolName, detail, '写文件工具没有提供目标路径，已阻止执行。', {",
        "        block_category: 'missing-path',",
        "        can_request_approval: false,",
        "      });",
        "    }",
        "    if (!isWithinTrustedRoots(resolvedPath)) {",
        "      return block(ctx, toolName, detail, `只允许在受信任工作区内写入，目标路径超出当前 knowledge-base：${resolvedPath}`, {",
        "        block_category: 'untrusted-path',",
        "        can_request_approval: false,",
        "      });",
        "    }",
        "    const protectedReason = detectProtectedPath(resolvedPath);",
        "    if (protectedReason) {",
        "      return block(ctx, toolName, detail, protectedReason, {",
        "        block_category: 'protected-path',",
        "        can_request_approval: false,",
        "      });",
        "    }",
        "    if (SECURITY_MODE === 'readonly') {",
        "      const decision = await requestModeDecision(",
        "        ctx,",
        "        toolName,",
        "        detail,",
        "        `当前安全模式为“${SECURITY_MODE_LABEL}”，已禁止 Pi 修改文件。`,",
        "        {",
        "          block_category: 'mode',",
        "          can_request_approval: true,",
        "        },",
        "      );",
        "      if (decision.allowed) {",
        "        allow(ctx, toolName, detail, {",
        "          inline_approval: true,",
        "          block_category: 'mode',",
        "          current_mode: SECURITY_MODE,",
        "          current_mode_label: SECURITY_MODE_LABEL,",
        "        });",
        "        return undefined;",
        "      }",
        "      return block(ctx, toolName, detail, appendUserSteerReason(`当前安全模式为“${SECURITY_MODE_LABEL}”，已禁止 Pi 修改文件。`, decision.denyReason), {",
        "        block_category: 'mode',",
        "        can_request_approval: true,",
        "        current_mode: SECURITY_MODE,",
        "        current_mode_label: SECURITY_MODE_LABEL,",
        "        user_steer_reason: decision.denyReason,",
        "      });",
        "    }",
        "    allow(ctx, toolName, detail);",
        "    return undefined;",
        "  });",
        "}",
        "",
    ]
    return "\n".join(lines)


def _ensure_security_extension() -> Path:
    content = _build_security_extension_source()
    PI_EXTENSION_DIR.mkdir(parents=True, exist_ok=True)
    PI_MANAGED_SECURITY_EXTENSION.write_text(content, encoding="utf-8")
    return PI_MANAGED_SECURITY_EXTENSION


def get_pi_security_extension_paths() -> list[Path]:
    path = _ensure_security_extension()
    return [path] if path.exists() else []


def get_pi_security_extension_args() -> list[str]:
    args: list[str] = []
    for path in get_pi_security_extension_paths():
        args.extend(["--extension", str(path)])
    return args


def _read_recent_jsonl(path: Path, *, limit: int = 20) -> list[dict[str, Any]]:
    if limit <= 0 or not path.exists():
        return []
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except Exception:
        return []

    items: list[dict[str, Any]] = []
    for line in reversed(lines[-limit:]):
        raw = line.strip()
        if not raw:
            continue
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            items.append(parsed)
    return items


def get_pi_security_settings() -> dict[str, Any]:
    meta = _security_mode_meta(_current_security_mode())
    extension_path = _ensure_security_extension()
    return {
        "mode": meta["id"],
        "mode_label": meta["label"],
        "mode_description": meta["description"],
        "available_modes": SECURITY_MODES,
        "trusted_workspaces": _trusted_workspace_items(),
        "managed_extension_path": str(extension_path),
        "log_path": str(PI_SECURITY_LOG_FILE),
        "recent_events": _read_recent_jsonl(PI_SECURITY_LOG_FILE, limit=12),
        "approvals_path": str(PI_SECURITY_APPROVALS_FILE),
        "supports_interactive_approval": True,
        "supports_extension_ui_confirm": True,
        "boundary_note": "当前是应用层最小安全约束，不是容器级强沙箱。",
    }


def update_pi_security_settings(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = payload if isinstance(payload, dict) else {}
    raw_mode = str(payload.get("mode") or "").strip().lower()
    allowed_modes = {item["id"] for item in SECURITY_MODES}
    if raw_mode and raw_mode not in allowed_modes:
        raise ValueError(f"不支持的安全模式：{raw_mode}")
    settings = _load_app_settings()
    settings[SECURITY_SETTINGS_KEY] = {
        "mode": _normalize_security_mode(raw_mode),
    }
    _save_app_settings(settings)
    _ensure_security_extension()
    return get_pi_security_settings()
