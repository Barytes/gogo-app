# Agent 服务架构

> 本文档描述当前（F5 后）Agent 后端真实实现。
>
> 上层产品/应用架构见 [gogo-app-architecture.md](gogo-app-architecture.md)。

**最后更新**: 2026-04-14

---

## 1. 架构结论

当前 Agent 后端已收敛为 **RPC-only**：

- 主产品聊天：`session_manager.py` 直接走 Pi 原生会话
- legacy 单次聊天：`agent_service.py` 直接走 `pi --mode rpc --no-session`
- 多会话聊天：`session_manager.py` 使用 Pi 原生会话命令（`new/switch/get_messages`）
- 旧链路文件 `pi_sdk_bridge.mjs` 与 `session_event_store.py` 已删除

---

## 2. 主调用链路

```
chat.js
  -> POST /api/chat/stream
  -> main.py
  -> session_manager.py (session chat)
  -> pi_rpc_client.py
  -> pi --mode rpc
```

会话链路：

```
POST /api/sessions -> SessionPool.create_session()
  -> new_session + set_thinking_level + set_session_name + get_state(sessionFile)

POST /api/chat/stream (with session_id) -> SessionPool.send_message_async()
  -> switch_session(sessionFile) + prompt_events()

POST /api/sessions/{id}/chat/stream -> SessionPool.send_message_async()
  -> switch_session(sessionFile) + prompt_events()

POST /api/legacy/chat or /api/legacy/chat/stream
  -> agent_service.py
  -> pi --mode rpc --no-session
```

---

## 3. 核心模块

### `app/backend/agent_service.py`

职责：

- 构建上下文（wiki + raw 检索）
- 单次问答 RPC 调用（同步/流式）
- RPC 事件映射：`thinking_delta/text_delta/trace/final/error`
- 在无 session 单次聊天链路中，把最近对话历史拼进 `_build_pi_prompt(...)`，作为 `--no-session` 模式下的连续对话兜底

主要公开函数：

- `get_agent_backend_status()`
- `run_agent_chat(...)`
- `stream_agent_chat(...)`
- `run_session_chat(...)`
- `stream_session_chat(...)`

### `app/backend/session_manager.py`

职责：

- Session 生命周期管理（创建、列表、删除、空闲回收）
- 单会话并发互斥（busy 保护）
- 会话元数据持久化（`PI_RPC_SESSION_DIR/gogo-session-registry.json`）
- 历史恢复优先级：
  1. RPC `get_messages`
  2. Pi 原生 session JSONL 离线读取
- 每会话单飞互斥：同一 session 并发请求会返回 busy 错误
- Session 聊天请求完全依赖 Pi 原生会话上下文；请求体传入的 `history` 目前会被显式忽略

### `app/backend/pi_rpc_client.py`

职责：

- 启动 `pi --mode rpc`
- 严格 LF JSONL framing
- `id` 关联命令响应
- 提供命令：
  - `get_state`
  - `prompt_events`
  - `abort`
  - `new_session`
  - `switch_session`
  - `set_session_name`
  - `set_thinking_level`
  - `get_messages`

---

## 4. 配置项

| 配置 | 环境变量 | 默认值 | 说明 |
|---|---|---|---|
| `KNOWLEDGE_BASE_DIR` | `KNOWLEDGE_BASE_DIR` | `../knowledge-base` | 知识库目录 |
| `PI_WORKDIR` | `PI_WORKDIR` | `KNOWLEDGE_BASE_DIR` | Pi 工作目录 |
| `PI_COMMAND` | `PI_COMMAND` | `pi` | RPC 命令 |
| `PI_RPC_SESSION_DIR` | `PI_RPC_SESSION_DIR` | `../.gogo/pi-rpc-sessions` | RPC 会话与 registry 目录 |
| `PI_TIMEOUT_SECONDS` | `PI_TIMEOUT_SECONDS` | `disabled` | RPC 读超时；留空、`0`、`off` 表示禁用，正整数表示秒数 |
| `PI_THINKING_LEVEL` | `PI_THINKING_LEVEL` | `medium` | thinking 级别 |

---

## 5. 当前状态（F1-F5）

| 里程碑 | 状态 | 结果 |
|---|---|---|
| F1 | ✅ | RPC 基座接入（JSONL + id correlation） |
| F2 | ✅ | `/api/chat` 与 `/api/chat/stream` 切到 RPC 主链路 |
| F3 | ✅ | `/api/sessions*` 切到 RPC 会话机制 |
| F4 | ✅ | 历史恢复切到 Pi 原生会话链路 |
| F5 | ✅ | 旧链路下线，架构收敛为 RPC-only |

---

## 6. history 注入结论

- `POST /api/legacy/chat` 与 `POST /api/legacy/chat/stream` 的无 session 单次聊天链路，仍然需要 `_build_pi_prompt(...)` 中的最近 history 注入。
- 原因：这条链路使用 `pi --mode rpc --no-session`，Pi 不会自动携带上一轮上下文；如果不拼 history，多轮连续提问会退化成单轮问答。
- `session_id` 链路不再需要这类 prompt 级 history 注入。
- 原因：`session_manager.py` 在发送消息前会 `switch_session(...)` 到原生会话文件，真实上下文由 Pi 的 session 负责；因此传入的 `history` 已在 `send_message()` / `send_message_async()` 中被忽略。
- 当前建议：保持现状，不要为了“统一”而把 session 历史再额外重复拼进 prompt，避免上下文冗余与重复指令。

---

## 7. 固定检索与 `consulted_pages`

- `_collect_context()` 仍然保留，但只服务于 deprecated 的无 session 单次聊天链路。
- 保留原因：legacy no-session 路径没有 Pi 原生会话上下文，也没有主产品路径那样稳定的 session/tool 语义，应用层预检索仍能提供一个最小可用的本地知识库提示。
- 不迁入 session 主路径的原因：
  - session 路径已经有 Pi 原生会话历史
  - Pi 可在会话中继续使用工具做按需检索
  - 若把固定检索结果每轮都拼进消息，会污染长期会话历史并放大上下文冗余
- `consulted_pages` 继续保留，但应理解为应用层 UI 元数据，不是 knowledge-base 规范，也不是主 session 链路中的权威 grounding 记录。
- 当前前端主路径（懒创建 session 后再聊天）默认不会依赖这套 `consulted_pages` 注入。

---

## 8. 相关文件

- `app/backend/agent_service.py`
- `app/backend/session_manager.py`
- `app/backend/pi_rpc_client.py`
- `app/backend/main.py`
- `app/backend/config.py`
- `docs/session-management.md`
- `docs/agent-session-refactor-assessment.md`
