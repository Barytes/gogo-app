# Session 管理机制文档（与当前代码一致）

> 适用代码：`app/frontend/assets/chat.js`、`app/backend/main.py`、`app/backend/session_manager.py`、`app/backend/pi_rpc_client.py`
>
> 上层产品/应用架构见 [gogo-app-architecture.md](gogo-app-architecture.md)。

**更新时间**: 2026-04-14

---

## 1. 当前结论（F5 后）

Session 主链路已收敛为 **RPC-only**：

- 会话创建/切换/命名/历史都基于 Pi RPC 与原生 session JSONL
- 旧链路文件 `pi_sdk_bridge.mjs` 与 `session_event_store.py` 已删除

---

## 2. 核心组件

### 前端

- `app/frontend/assets/chat.js`
- 会话选择、pending 控制、流式事件渲染

### 后端 API

- `POST /api/sessions`：创建会话
- `GET /api/sessions`：列出会话
- `DELETE /api/sessions/{id}`：删除会话
- `GET /api/sessions/{id}/history`：会话历史恢复
- `POST /api/chat/stream`（含 `session_id`）：会话流式聊天
- `POST /api/sessions/{id}/chat/stream`：按会话 ID 的兼容流式入口

### Session 管理器（主实现）

- `app/backend/session_manager.py`
- 内部使用：
  - `new_session`
  - `switch_session`
  - `set_session_name`
  - `get_state`
  - `prompt_events`
  - `get_messages`
- 说明：`create_session(..., system_prompt=...)` 当前会忽略 `system_prompt`（RPC 链路暂不支持 per-session system prompt）

### RPC 通讯层

- `app/backend/pi_rpc_client.py`
- 负责 JSONL LF framing、命令响应关联（`id`）

---

## 3. 会话数据持久化

主持久化目录：

- `PI_RPC_SESSION_DIR`（默认：`../.gogo/pi-rpc-sessions`）

其中包含：

- Pi 原生 session JSONL 文件（由 Pi 管理）
- `gogo-session-registry.json`（gogo 的会话元数据索引）

索引记录字段：

- `session_id`
- `session_file`
- `workdir`
- `thinking_level`
- `title`
- `created_at` / `last_used_at`
- `message_count`

---

## 4. 请求与并发模型

每个会话一个互斥锁（`session.lock`）：

- 同一会话同时只能有一个进行中的请求
- 并发第二请求立即返回 error（busy）

流式请求流程：

1. `switch_session` 切换到目标 `session_file`
2. `prompt_events` 读取流式事件
3. 映射成前端事件：
   - `text_delta`
   - `thinking_delta`
   - `trace`
   - `final`
   - `error`

---

## 5. 历史恢复优先级（F4/F5）

`replay_history(session_id)` 的顺序：

1. 在线优先：RPC `get_messages`
2. 离线兜底：直接解析 Pi 原生 session JSONL

因此默认运行不依赖旧事件存储目录作为主历史源。

---

## 6. 重启恢复

`SessionPool` 启动时会读取 `gogo-session-registry.json` 并恢复会话元数据。

效果：

- 后端重启后，`/api/sessions` 仍能看到既有会话
- `/api/sessions/{id}/history` 可继续恢复历史（优先 Pi 原生）

---

## 7. 删除与清理

- 删除会话：从内存与 registry 移除，并尝试删除对应原生 `session_file`
- 空闲清理：按 `idle_timeout` 回收非 pending 会话

---

## 8. 配置项（Session 相关）

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `PI_COMMAND` | `pi` | RPC 命令 |
| `PI_RPC_SESSION_DIR` | `../.gogo/pi-rpc-sessions` | RPC 会话与 registry 目录 |
| `PI_TIMEOUT_SECONDS` | `180` | RPC 读超时 |
| `PI_THINKING_LEVEL` | `medium` | 会话默认 thinking level |

---

## 9. 参考文件

- `app/backend/session_manager.py`
- `app/backend/pi_rpc_client.py`
- `app/backend/main.py`
- `app/frontend/assets/chat.js`
