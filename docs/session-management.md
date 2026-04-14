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
- 会话列表（可折叠侧边栏 + 列表项 `...` 菜单）、pending 控制、流式事件渲染
- 会话双态：
  - 草稿态（无 `session_id`，仅输入窗口）
  - 持久会话态（有 `session_id`，可切换/重命名/删除）
- 首条消息懒创建会话（lazy create），页面加载与刷新不自动创建会话
- assistant 回复支持基础 Markdown 渲染（标题、列表、代码块、引用、链接等）
- assistant 回复中的内部 Markdown 链接若指向 wiki/raw 页面，会直接在右侧 Wiki 面板内打开，而不是新开外部页面
- 当前页内切换会话时，会保留已渲染的流式回复与“思考过程”视图；切回进行中的会话可继续看到实时进度

### 后端 API

- `POST /api/chat`：session-only 同步聊天
- `POST /api/chat/stream`：session-only 流式聊天
- `POST /api/sessions`：创建会话
- `GET /api/sessions`：列出会话
- `PATCH /api/sessions/{id}`：重命名会话
- `DELETE /api/sessions/{id}`：删除会话
- `GET /api/sessions/{id}/history`：会话历史恢复
- `POST /api/sessions/{id}/chat/stream`：按会话 ID 的兼容流式入口
- `POST /api/legacy/chat`：deprecated，无 session 单次聊天
- `POST /api/legacy/chat/stream`：deprecated，无 session 流式聊天
- 说明：
  - `POST /api/chat` 与 `POST /api/chat/stream` 现在都要求 `session_id`
  - `POST /api/sessions/{id}/chat/stream` 已收敛为只接收 `message + request_id`
  - 无 session 单次聊天已迁移到 `/api/legacy/...`，并在 OpenAPI 中标记为 deprecated

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

### 前端静态资源分发

- `index.html` 中前端资源使用带版本号的 `/assets/*.js`、`/assets/*.css`
- `main.py` 对页面与 `/assets/*` 都返回 no-cache/no-store 响应头，避免浏览器继续执行旧版会话脚本

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
- `DELETE /api/sessions/{id}`：若会话不存在，返回 `404`
- 空闲清理：按 `idle_timeout` 回收非 pending 会话

---

## 8. 前端会话行为（对齐 ChatGPT）

- 页面初始只加载会话列表，不自动创建会话
- 若存在历史会话：优先恢复最近活跃会话（支持 localStorage 记忆）
- 若无历史会话：进入草稿态，显示 “Hi，聊点什么？”
- 草稿态发送首条消息时：
  - 先 `POST /api/sessions` 创建会话
  - 会话标题默认取首条用户消息摘要
  - 再用该 `session_id` 发送流式聊天请求
  - 因此前端当前不会暴露“无 session 单次聊天”入口
- 输入框交互：
  - `Enter` 发送消息
  - `Shift+Enter` 插入换行
- 当当前会话正在流式回复时：
  - 输入框保持可编辑，用户可以继续起草下一条消息
  - 发送按钮切换为“终止”按钮，用于中断当前回复
  - 当前回复未结束前，不允许再次发送到同一会话
- 消息区在流式回复期间仅在用户停留底部时自动吸底；手动上滑查看历史时不再强制抢回到底部
- 前端不主动设置聊天请求超时；若请求结束，通常由后端/RPC 链路自行返回结果或超时错误
- 删除当前会话时：
  - 有剩余会话：切换到相邻会话
  - 无剩余会话：回到草稿态
- 会话操作入口：每个会话项的 `...` 菜单（重命名、删除）

---

## 9. 配置项（Session 相关）

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `PI_COMMAND` | `pi` | RPC 命令 |
| `PI_RPC_SESSION_DIR` | `../.gogo/pi-rpc-sessions` | RPC 会话与 registry 目录 |
| `PI_TIMEOUT_SECONDS` | `disabled` | RPC 读超时；留空、`0`、`off` 表示禁用，正整数表示秒数 |
| `PI_THINKING_LEVEL` | `medium` | 会话默认 thinking level |

---

## 10. 参考文件

- `app/backend/session_manager.py`
- `app/backend/pi_rpc_client.py`
- `app/backend/main.py`
- `app/frontend/assets/chat.js`
