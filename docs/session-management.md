# Session 管理机制文档（与当前代码一致）

> 适用代码：`app/frontend/assets/chat.js`、`app/backend/main.py`、`app/backend/session_manager.py`、`app/backend/pi_sdk_bridge.mjs`

**更新时间**: 2026-04-14

---

## 1. 目标与边界

当前 Session 机制用于支持：

- 同一页面内多会话并行切换
- 每个会话对应独立 Pi 长连接进程上下文
- 流式事件（`thinking_delta/text_delta/trace/final/error`）实时展示
- 会话级 pending 控制（避免“一个会话在回复，所有会话都锁住”）
- 基于本地 JSONL 事件存储做会话历史回放（页面刷新后可恢复文本对话）

不包含（当前未实现）：

- 服务重启后恢复 Pi 进程内上下文（当前只恢复文本历史，不恢复 SDK 内部树状态）

---

## 2. 核心组件

### 前端

- `app/frontend/assets/chat.js`
- 职责：当前会话选择、会话历史缓存、流式渲染、请求超时、pending 状态管理

### 后端

- `app/backend/main.py`
- 职责：Session API（创建/删除/列表）和聊天路由（`/api/chat/stream`）

- `app/backend/session_manager.py`
- 职责：Session 进程池管理、stdin 写入、stdout 流式读取、超时/退出错误兜底

- `app/backend/session_event_store.py`
- 职责：本地 append-only JSONL 事件存储（按会话文件 + 全局事件文件）

- `app/backend/pi_sdk_bridge.mjs`
- 职责：桥接 Pi SDK，会话初始化、事件转发、long-running 请求循环

---

## 3. 前端状态模型（`chat.js`）

```js
let currentSessionId = null;
const sessionHistories = new Map();      // session_id -> history array（引用）
let history = [];                        // 始终指向 currentSessionId 的数组
let currentStreamingMessage = null;      // 当前可见流式消息 DOM 包装
let currentStreamingSessionId = null;    // 当前流式消息所属 session_id
const pendingSessionIds = new Set();     // 正在等待回复的 session_id
const hydratedSessionIds = new Set();    // 已从后端 JSONL 回放过的 session_id
const STREAM_REQUEST_TIMEOUT_MS = 90000; // 前端 fetch 超时（90s）
// sendMessage() 每次请求会生成 request_id 并随请求发送
```

关键点：

- `history` 不是全局共享副本，而是“当前会话历史数组引用”
- `pending` 按 session 计算：只有当前会话在 `pendingSessionIds` 中才禁用输入框
- 发送消息时会先写入 assistant 占位文案（`Pi 正在生成答复...`），避免切换会话后“看起来消息消失”
- 切换会话时若本地缓存为空，会调用 `/api/sessions/{session_id}/history` 回放历史

---

## 4. 后端状态模型（`session_manager.py`）

### `SessionInfo`

- `session_id`
- `created_at`
- `last_used_at`
- `message_count`
- `title`

### `SessionProcess`

- `process`: Node 子进程（运行 `pi_sdk_bridge.mjs`）
- `lock`: 进程终止保护
- `_stdin_lock`: 单 session 下 stdin 写入串行化

### `SessionPool`

- `_sessions: dict[session_id, SessionProcess]`
- `max_sessions=10`，超出时 LRU 回收最老 session
- `idle_timeout=3600`（已在 FastAPI lifespan 中启动 cleanup loop）
- 内置 `SessionEventStore`，将会话事件写入本地 JSONL

### 本地事件存储

- 根目录：`/Users/beiyanliu/Desktop/gogo/.gogo-sessions`
- 会话文件：`.gogo-sessions/sessions/{session_id}.jsonl`
- 全局文件：`.gogo-sessions/events.jsonl`
- 事件模式：append-only（一行一个 JSON 事件）
- 回放来源：`SessionPool.replay_history()` 读取会话 JSONL 重建 `user/assistant` 文本历史

---

## 5. 关键调用链

## 5.1 页面加载自动建会话

1. `chat.js: bootstrapChat()`
2. `createNewSessionOnLoad() -> POST /api/sessions`
3. `main.py:create_session() -> SessionPool.create_session()`
4. `SessionPool._start_session_process()` 启动 bridge 子进程并写入初始化 JSON：
   - `mode: "long_running"`
   - `cwd/thinking_level/system_prompt`

## 5.2 流式聊天（主路径）

1. `chat.js: sendMessage()`
2. `POST /api/chat/stream`，body 包含：
   - `message`
   - `history`（当前会话历史）
   - `session_id`
   - `request_id`
3. `main.py: chat_stream()` 有 `session_id` 时走 `stream_session_chat()`
4. `agent_service.py: stream_session_chat()` 转发到 `SessionPool.send_message_async()`
5. `SessionPool.send_message_async()`：
   - 写入 payload（含 `request_id`）到目标 session 子进程 stdin
   - 循环读取 stdout NDJSON
   - 命中 `final/error` 结束
   - 全量追加到本地 JSONL 事件存储
6. 前端 `consumeNdjsonStream()` 分发事件并更新消息 UI

## 5.3 会话切换

1. `saveCurrentHistory()` 先保存当前会话历史
2. 更新 `currentSessionId`
3. `history = loadSessionHistory(currentSessionId)`
4. 若该会话尚未缓存，调用 `GET /api/sessions/{session_id}/history` 回放
5. 清空消息区域并 `renderHistory()`
6. `refreshChatPendingState()` 按目标会话 pending 状态启用/禁用输入框

## 5.4 删除会话

1. `DELETE /api/sessions/{id}`
2. 后端销毁子进程并移除池内条目
3. 前端删除缓存并自动新建会话

---

## 6. Bridge 协议（`pi_sdk_bridge.mjs`）

### long-running 模式的当前正确行为

1. `readline` 读取首条非空 JSON 作为初始化 payload
2. 若 `mode === "long_running"`：
   - `initSession(payload)`
   - 发 `ready` 事件
   - `for await (const line of rl)` 持续逐行处理后续 prompt 请求

### 事件输出

- `trace`
- `thinking_delta`
- `text_delta`
- `text_replace`
- `final`
- `error`

### 历史 bug（已修）

- 旧版本使用“等待 stdin 结束后再 parse”的方式，不兼容长连接
- 已修为“首行初始化 + 持续逐行消费”

---

## 7. 超时与错误处理

### 前端

- `fetch` 采用 `AbortController`，90 秒超时
- 超时时将 assistant 消息置为：
  - `Pi 回复超时，本次请求已自动停止。你可以重试，或切换会话继续提问。`
- 每次请求生成 `request_id` 并透传到后端

### 后端

- `send_message_async()` 读取 stdout 时使用 `asyncio.wait_for(...)`
- 超时返回 `error` 事件：
  - `Session 响应超时（>Xs），请重试。`
- 若子进程已退出，返回 `error` 并附带 `return code` 和可用 stderr 文本
- `main.py` 为每次请求补齐 `request_id`，并在流式事件中回传 `request_id`
- `SessionPool` 将 `request_started/stream_event/request_completed` 按 JSONL 追加落盘
- `SessionPool.replay_history()` 从 JSONL 读取并按 `request_id` 重建文本历史

---

## 8. API 一览（Session 相关）

- `GET /api/sessions`：列出活跃会话
- `POST /api/sessions`：创建会话
- `GET /api/sessions/{session_id}`：会话详情
- `GET /api/sessions/{session_id}/history`：从本地 JSONL 回放会话文本历史
- `DELETE /api/sessions/{session_id}`：删除会话
- `POST /api/chat/stream`：统一聊天入口（带 `session_id` 时使用 Session 池）
- `POST /api/sessions/{session_id}/chat/stream`：直接按会话 ID 流式聊天（兼容接口）
- `POST /api/chat` 与 `POST /api/chat/stream` 请求体均支持可选 `request_id`

---

## 9. 当前限制与后续建议

当前限制：

- 当前回放的是“文本对话层”历史，不包含完整 tool/thinking 原始事件 UI 重建
- Session 池本身仍是内存态，服务重启后 Pi 进程级上下文会丢失

建议：

1. 基于 `request_id` 增加端到端调试视图（前端可检索某次请求全链路事件）
2. 如果希望复用 Pi 原生会话文件，需要将 `pi_sdk_bridge.mjs` 从 `SessionManager.inMemory()` 切换为文件型 SessionManager（当前代码未启用）

---

## 10. 参考文件

- `app/frontend/assets/chat.js`
- `app/backend/main.py`
- `app/backend/session_manager.py`
- `app/backend/session_event_store.py`
- `app/backend/pi_sdk_bridge.mjs`
- `app/backend/agent_service.py`
