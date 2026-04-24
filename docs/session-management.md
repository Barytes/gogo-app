# Session 管理机制文档（与当前代码一致）

> 适用代码：`app/frontend/assets/chat.js`、`app/backend/main.py`、`app/backend/session_manager.py`、`app/backend/pi_rpc_client.py`、`app/backend/config.py`
>
> 上层产品/应用架构见 [gogo-app-architecture.md](gogo-app-architecture.md)。

**更新时间**: 2026-04-18

---

## 1. 当前结论

Session 主链路已收敛为 **RPC-only + session-only chat API**：

- 正常聊天全部基于 Pi 原生会话
- 主入口是 `POST /api/chat` 与 `POST /api/chat/stream`
- 无 session 单次聊天仅保留在 `/api/legacy/...` 兼容路径
- 会话恢复不再只依赖 Pi 原生 `get_messages()`，而是优先保留应用层的“富历史”

---

## 2. 核心组件

### 前端

- `app/frontend/assets/chat.js`
- 负责：
  - 草稿态 / 持久会话态切换
  - 首条消息懒创建会话
  - 流式消息渲染
  - “思考过程”渲染
  - 会话切换、重命名、删除
  - 会话视图缓存与刷新恢复
  - 聊天区安全模式切换
  - 安全阻断弹窗与“允许一次 / 禁止并继续 steer”交互

### 后端 API

- `POST /api/sessions`
- `GET /api/sessions`
- `PATCH /api/sessions/{id}`
- `DELETE /api/sessions/{id}`
- `GET /api/sessions/{id}/history`
- `PATCH /api/sessions/{id}/settings`
- `POST /api/sessions/{id}/abort`
- `POST /api/chat`
- `POST /api/chat/stream`
- `POST /api/sessions/{id}/chat/stream`（兼容入口）
- `PATCH /api/settings/security`
- `POST /api/settings/security/approval`
- `POST /api/legacy/chat` / `POST /api/legacy/chat/stream`（deprecated）

### Session 管理器

- `app/backend/session_manager.py`
- 负责：
  - Session 生命周期管理
  - registry 持久化
  - 会话级并发互斥
  - 富历史持久化与恢复
  - 流式事件到前端事件的映射

### RPC 通讯层

- `app/backend/pi_rpc_client.py`
- 负责：
  - JSONL LF framing
  - 单 reader task 读取 `stdout`
  - response future 分发
  - prompt 事件队列

补充说明：

- `session_manager.py` 启动 Pi RPC 进程时，除了 Provider extension，也会自动注入 gogo-app 托管的 `managed-security.ts`
- 因此会话级 `write/edit/bash` 能力始终受当前安全模式约束，而不是直接裸连宿主机

---

## 3. 会话数据持久化

主持久化目录：

- `PI_RPC_SESSION_DIR`
- 实际路径会按当前知识库 namespace 隔离，例如：
  `.gogo/pi-rpc-sessions/<knowledge-base-namespace>/`

其中包含：

- Pi 原生 session JSONL 文件
- `gogo-session-registry.json`
- `gogo-session-turns/*.jsonl`

### 3.1 registry 字段

`gogo-session-registry.json` 记录：

- `session_id`
- `session_file`
- `workdir`
- `thinking_level`
- `model_provider`
- `model_id`
- `model_label`
- `title`
- `created_at`
- `last_used_at`
- `message_count`

当前 registry 写盘策略是：

- 创建会话、更新设置、请求开始/结束、进程重置这类结构性变化会立即落盘
- `get_session()` 触发的 `last_used_at` 更新时间只做节流写盘，避免每次读会话都重写整个 registry

### 3.2 app turn 富历史

`gogo-session-turns/<session_id>.jsonl` 是应用层补充历史，用来持久化前端真正需要恢复的内容：

- `role`
- `content`
- `consulted_pages`
- `trace`
- `warnings`
- `stopped`

这份历史的目的不是替代 Pi 原生 session，而是补足：

- 完整“思考过程”
- 工具调用摘要
- warnings
- 用户主动终止后的状态

---

## 4. 请求与并发模型

### 4.1 单会话互斥

每个会话有一个 `session.lock`：

- 同一会话同时只能有一个进行中的请求
- 第二个请求会返回 busy / 409 语义错误

### 4.2 流式请求流程

1. `switch_session(session_file)`
2. `prompt_events(message)`
3. `Pi managed security extension` 在 `tool_call` 阶段先做安全预检
4. 后端把 RPC 事件映射成前端事件：
   - `thinking_delta`
   - `text_delta`
   - `trace`
   - `extension_ui_request`
   - `final`
   - `error`

补充：

- 当 `managed-security.ts` 命中“模式阻断”时，它不会立刻结束当前工具调用，而是先发出 `extension_ui_request`
- 前端收到后会在聊天输入框上方打开小型安全确认框，用户的选择再通过 `POST /api/sessions/{id}/extension-ui-response` 回写给当前 Pi RPC 请求
- 如果用户允许，当前 `tool_call` 会直接继续执行；如果用户禁止并填写理由，extension 会在同一轮里把理由变成这次阻断的最终原因
- 对于危险命令、knowledge-base 外写入、敏感路径这类硬阻断，`session_manager.py` 仍会从错误字符串里提取结构化安全 payload，并挂进 trace item 的 `security` 字段

### 4.3 终止请求

用户点击终止按钮时：

1. 前端调用 `POST /api/sessions/{id}/abort`
2. `session_manager.py` 标记 `abort_requested`
3. 后台对当前活跃 `PiRpcClient` 发送 `abort`

当前实现中：

- `abort()` 只负责发送命令，不再同步抢读 response
- `PiRpcClient` 只有一个 reader task 读 `stdout`
- 因此不会再出现多个协程并发读同一 `StreamReader` 的问题

### 4.4 安全模式更新

当前 `PATCH /api/settings/security` 保存后，会重置 `SessionPool`，让后续请求按新的 `managed-security.ts` 重新启动 Pi RPC 进程。这个入口现在由聊天输入框控制区触发，而不是 diagnostics 面板。

这意味着：

- 规则变更会对后续请求立即生效
- 已持久化的会话历史仍保留
- 当前安全模式和受信任工作区仍可在 diagnostics 中看到

### 4.5 Inline 安全确认

当前聊天主链路的安全确认不再通过“补发 prompt”实现，而是直接复用 Pi RPC extension UI 子协议：

- `POST /api/sessions/{id}/extension-ui-response`

作用：

- 把前端对当前 `extension_ui_request` 的回答发回正在执行的 Pi RPC 请求
- 让同一个 `tool_call` 在当前轮里恢复执行或保持阻断
- 避免为了“允许这一次”再补发一个新的 user turn

前端交互链路是：

1. 流式事件收到 `extension_ui_request`
2. 打开安全确认弹窗
3. 用户选择：
   - `允许这一次`
     前端把 `allow_once` 回写给当前 request，当前 `tool_call` 直接继续
   - `禁止并告知 Pi`
     前端先回写“保持禁止”，随后把输入的理由自动响应给 extension 的后续 `input` 请求；extension 再把这段理由作为本次阻断原因返回给 Pi

兼容性说明：

- `POST /api/settings/security/approval`
- `.gogo/pi-security-approvals.json`

这套“预先写一次性审批文件”的机制仍保留，但已经不是聊天区安全确认的主路径。

---

## 5. 历史恢复优先级

`replay_history(session_id)` 当前恢复顺序是：

1. 先加载应用层 `gogo-session-turns/*.jsonl`
2. 如果当前会话不在 pending 回复中，且应用层富历史已存在，则直接返回它作为历史恢复快路径
3. 否则再尝试通过 RPC `get_messages()` 获取 Pi 原生历史
4. 如果 RPC 不可用，再离线读取 Pi 原生 session JSONL
5. 若应用层富历史和 Pi 历史可对齐，则用应用层版本覆盖对应区段，优先保留 `trace / warnings / consulted_pages`

这里的“可对齐”分两层：

- 第一层：尾部回合对齐  
  不再要求 assistant 文本逐字一致；只要尾部回合的 `role` 顺序一致，且用户消息能对齐，就允许用应用层富历史覆盖对应 assistant 回合。
- 第二层：用户回合对齐  
  如果 Pi `get_messages()` 把中间 assistant 状态消息也展开返回，导致两份历史的 assistant 条目数不同，就退回到“按用户消息序列”对齐。只要用户回合顺序和内容一致，就用应用层富历史替换该段最终问答。

这样可以避免 Pi 原生历史里那些“我来查一下……”“让我再看看……”之类的中间 assistant 消息，把真正需要恢复的结构化 `trace` 挤掉，最终又退化成“只有零散文本、没有完整思考过程”的纯消息视图。

这意味着：

- 刷新、切换会话后，前端优先恢复“带思考过程”的历史
- 不再退化成只有零碎 assistant 文本的纯消息视图
- 常见会话打开路径不再总是为了恢复历史额外走一轮 Pi RPC，从而减少启动和切换时的卡顿
- 对超长会话，app-turns 历史恢复也不再总是从头扫完整个 JSONL；若只需要最近 `N` 条，会优先从文件尾部反向提取最后几行

### 5.1 历史接口的窗口语义

`GET /api/sessions/{id}/history` 当前支持：

- `limit`：本次最多返回多少条 turn
- `offset`：从最新历史开始，先向前跳过多少条 turn

这意味着前端可以按“从最新往前分页”的方式恢复长会话：

- 首次只取最近一页
- 用户再按需加载更早历史

当前 UI 第一版里：

- 聊天区首屏默认只渲染最近一页历史
- 如果后端返回 `has_more=true`，前端会显示“加载更早消息”

---

## 6. 重启恢复

`SessionPool` 启动时会读取：

- `gogo-session-registry.json`
- 当前知识库 namespace 下的 session 目录

效果：

- 后端重启后，`/api/sessions` 仍可恢复历史会话元数据
- `/api/sessions/{id}/history` 仍能恢复带 trace 的富历史

---

## 7. 前端会话行为

### 7.1 草稿态与持久态

- 页面初始不自动创建会话
- 若无会话，进入草稿态
- 首条消息发送时才调用 `POST /api/sessions`

### 7.2 输入框与发送

- `Enter` 发送
- `Shift+Enter` 换行
- 当前回复进行中仍允许继续编辑草稿
- 发送按钮会切换成终止按钮

### 7.3 流式视图缓存

前端为每个 session 维护两层状态：

- `sessionHistories`
  结构化消息历史
- `sessionViewNodes`
  当前已经渲染出来的 DOM 节点缓存

效果：

- 切换会话再切回进行中的会话时，可优先恢复当前实时视图
- 刷新后若没有本地 DOM 缓存，则通过 `/api/sessions/{id}/history` 重建富历史

### 7.4 自动滚动

- 用户停留底部时，流式消息自动吸底
- 用户手动上滑查看历史时，不再被强制拉回到底部

---

## 8. 会话设置与运行时模型

### 8.1 草稿态设置

前端会先通过 `/api/pi/options` 读取：

- 可用模型列表
- 当前 runtime 状态
- 支持的 thinking levels

草稿态下的模型 / 思考设置会保存在前端内存中，用于创建新会话。

### 8.2 已有会话设置

已有会话通过：

- `PATCH /api/sessions/{id}/settings`

即时修改：

- `model_provider`
- `model_id`
- `thinking_level`

修改后会同步写回 registry。

---

## 9. 删除与清理

- 删除会话时：
  - 从内存移除
  - 从 registry 移除
  - 尝试删除 Pi 原生 session 文件
  - 删除对应 `gogo-session-turns/<session_id>.jsonl`

- 空闲清理：
  - 当前桌面版默认不自动回收已持久化会话，避免用户重启应用后发现历史会话消失

---

## 10. 配置项（Session 相关）

| 配置 | 实际行为 |
|---|---|
| `PI_COMMAND` | Pi RPC 命令，默认 `pi` |
| `PI_TIMEOUT_SECONDS` | RPC 读超时；留空、`0`、`off` 表示禁用 |
| `PI_THINKING_LEVEL` | 会话默认思考水平 |
| `PI_WORKDIR` | 未显式设置时，默认跟随当前知识库目录 |
| `PI_RPC_SESSION_DIR` | Session 根目录；实际运行时还会再拼接知识库 namespace |

桌面开发态下，`POST /api/settings/pi-login` 若无法连接 Tauri 桥，会由 Python 后端直接打开 macOS Terminal 或 Windows 终端作为 Pi `/login` 兜底入口；Windows 下优先直接启动 PowerShell，这不改变 session RPC 的持久化目录语义。

---

## 11. 当前边界

已完成：

- session-only 主聊天链路
- 富历史恢复
- 终止回复
- 会话级模型 / 思考设置
- 按知识库隔离 session 目录

仍保留但已降级：

- `/api/legacy/chat`
- `/api/legacy/chat/stream`

---

## 12. 参考文件

- `app/backend/session_manager.py`
- `app/backend/pi_rpc_client.py`
- `app/backend/main.py`
- `app/frontend/assets/chat.js`
- `docs/agent-architecture.md`
