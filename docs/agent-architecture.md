# Agent 服务架构

> 本文档描述当前（F5 后）Agent 后端真实实现。
>
> 上层产品/应用架构见 [gogo-app-architecture.md](gogo-app-architecture.md)。

**最后更新**: 2026-04-14

---

## 1. 架构结论

当前 Agent 后端已收敛为 **RPC-only**：

- 单次聊天：`agent_service.py` 直接走 `pi --mode rpc`
- 多会话聊天：`session_manager.py` 使用 Pi 原生会话命令（`new/switch/get_messages`）
- 旧链路文件 `pi_sdk_bridge.mjs` 与 `session_event_store.py` 已删除

---

## 2. 主调用链路

```
chat.js
  -> POST /api/chat or /api/chat/stream
  -> main.py
  -> agent_service.py (single chat) / session_manager.py (session chat)
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
```

---

## 3. 核心模块

### `app/backend/agent_service.py`

职责：

- 构建上下文（wiki + raw 检索）
- 单次问答 RPC 调用（同步/流式）
- RPC 事件映射：`thinking_delta/text_delta/trace/final/error`

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
| `PI_TIMEOUT_SECONDS` | `PI_TIMEOUT_SECONDS` | `180` | 超时（秒） |
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

## 6. 相关文件

- `app/backend/agent_service.py`
- `app/backend/session_manager.py`
- `app/backend/pi_rpc_client.py`
- `app/backend/main.py`
- `app/backend/config.py`
- `docs/session-management.md`
- `docs/agent-session-refactor-assessment.md`
