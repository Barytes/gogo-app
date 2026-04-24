# Agent 服务架构

> 本文档描述当前 `gogo-app` 中 Agent 后端的真实实现。
>
> 上层产品/应用架构见 [gogo-app-architecture.md](gogo-app-architecture.md)。

**最后更新**: 2026-04-18

---

## 1. 架构结论

当前 Agent 后端已经稳定在这条结构上：

- 主产品聊天：`session_manager.py` 直连 Pi 原生会话
- legacy 单次聊天：`agent_service.py` 走 `pi --mode rpc --no-session`
- Pi RPC 通讯：统一由 `pi_rpc_client.py` 负责
- Provider 扩展：由 `config.py` 生成托管 extension，并在每次 RPC 启动时通过 `--extension` 注入
- 安全扩展：由 `security_service.py` 生成托管 `managed-security.ts`，在每次 RPC 启动时和 Provider extension 一起注入

换句话说，`gogo-app` 现在的 Agent 层更像：

- 一个会话与运行时编排层
- 一个本地知识库与 Pi 之间的应用壳

而不是自己维护另一套完整的 Agent 状态机。

---

## 2. 主调用链路

### 2.1 session 主链路

```text
chat.js
  -> POST /api/chat/stream
  -> main.py
  -> session_manager.py
  -> pi_rpc_client.py
  -> pi --mode rpc
```

### 2.2 legacy no-session 链路

```text
chat request
  -> POST /api/legacy/chat or /api/legacy/chat/stream
  -> main.py
  -> agent_service.py
  -> pi --mode rpc --no-session
```

### 2.3 runtime 设置链路

```text
workbench.js / chat.js
  -> /api/settings / /api/settings/model-providers / /api/pi/options
  -> main.py
  -> config.py / session_manager.py
  -> pi_rpc_client.py
  -> pi --mode rpc --extension .gogo/pi-extensions/managed-providers.ts --extension .gogo/pi-extensions/managed-security.ts
```

---

## 3. 核心模块

### `app/backend/agent_service.py`

职责：

- legacy no-session 单次问答
- 构建 `_collect_context()` 预检索上下文
- 构建 `_build_pi_prompt(...)`
- 把 RPC 事件映射为：
  - `thinking_delta`
  - `text_delta`
  - `trace`
  - `final`
  - `error`
- 在长回复场景里补充正文快照兜底，避免只依赖 `text_delta`

这层现在不是主产品链路，而是兼容层。

### `app/backend/session_manager.py`

职责：

- Session 生命周期管理
- Session registry 持久化
- 会话级模型 / 思考设置切换
- 富历史持久化和恢复
- 会话级 busy 保护
- 当前流式请求与 abort 的协作

### `app/backend/pi_rpc_client.py`

职责：

- 启动 `pi --mode rpc`
- 负责 LF JSONL framing
- 维护单 reader task 读取 `stdout`
- 将 command response 按 `id` 分发到 future
- 将 prompt 事件分发到 queue

这是当前并发稳定性的关键基础。

### `app/backend/config.py`

职责：

- 运行时知识库目录与 namespace 计算
- Pi command / workdir / timeout 配置
- Model Provider profile 管理
- 写入 Pi `auth.json`
- 生成 `.gogo/pi-extensions/managed-providers.ts`
- 返回 settings / diagnostics 所需配置数据

### `app/backend/security_service.py`

职责：

- 管理 `pi_security` 应用设置
- 生成 `.gogo/pi-extensions/managed-security.ts`
- 定义安全模式、受信任工作区和危险命令规则
- 返回 diagnostics 所需的安全边界和本地审计日志信息

### `app/backend/main.py`

职责：

- 暴露页面与 API
- 把 settings、chat、session、inbox、diagnostics 这些产品接口串起来
- 区分主 session API 与 deprecated legacy API

---

## 4. Pi RPC 客户端模型

`PiRpcClient` 当前采用：

- **单 reader task**
- **response future**
- **event queue**

### 为什么这样设计

之前的问题是：

- `prompt_events()` 在读 `stdout`
- `abort()` 也想读 `stdout`
- 多个协程同时读同一个 `StreamReader`
- 触发 `read() called while another coroutine is already waiting for incoming data`

现在的结构中：

- 只有 reader task 直接读 `stdout`
- `get_state` / `set_model` / `set_thinking_level` 等命令只等自己的 response future
- `prompt_events()` 只消费事件队列
- `abort()` 只发送命令，不再同步抢读 response

因此这类并发读问题从架构上被消除了。

---

## 5. Session 与 legacy 的职责分界

### 5.1 session 链路

特点：

- 主产品路径
- 完全依赖 Pi 原生会话上下文
- 每个会话都能独立持久化模型、思考水平、标题和历史
- 前端当前默认只走这条路

### 5.2 legacy no-session 链路

特点：

- 只保留兼容能力
- 继续使用 `_build_pi_prompt(...)` 注入最近 history
- 继续允许 `_collect_context()` 做应用层预检索
- 在 OpenAPI 中已标记 deprecated

---

## 6. history 注入结论

- `session_id` 链路不需要 `_build_pi_prompt(...)` 里的 history 注入
- 原因：真正上下文由 `switch_session(...)` 后的 Pi 原生 session 提供

- `POST /api/legacy/chat` 与 `POST /api/legacy/chat/stream` 仍需要 history 注入
- 原因：`--no-session` 模式没有原生会话上下文，多轮追问会退化成单轮问答

当前策略：

- session 路径保持干净，不重复把历史再拼进 prompt
- legacy 路径保留 prompt 级 history 兜底

---

## 7. 固定检索与 `consulted_pages`

`_collect_context()` 当前仍存在，但只服务于 legacy no-session 路径。

### 保留原因

- 这条链路没有 Pi 原生 session 语义兜底
- 作为兼容层，应用级预检索仍能提供一个最小可用的上下文提示

### 不迁入主 session 路径的原因

- session 路径已经有 Pi 原生会话历史
- Pi 可以在会话里继续使用工具做按需检索
- 每轮固定拼接检索结果会污染长期会话上下文

### `consulted_pages` 的定位

- 继续保留
- 但只是应用层 UI 元数据
- 不是 knowledge-base 规范的一部分
- 也不是主 session 链路里的权威 grounding 记录

---

## 8. Model Provider 与认证

当前采用“两层拆分”：

### 8.1 Provider 定义层

由 `gogo-app` 托管：

- Provider profile 存在 `.gogo/app-settings.json`
- 由 `config.py` 生成 `.gogo/pi-extensions/managed-providers.ts`
- Pi RPC 进程启动时自动追加 `--extension <managed-providers.ts>`

### 8.2 认证层

尽量交给 Pi 自己管理：

- API key / OAuth token 写入 `~/.pi/agent/auth.json`
- OAuth profile 支持：
  - `desktop-pi-login`
  - `manual-tokens`

桌面版目标路径：

- 通过 `POST /api/settings/pi-login`
- 接到桌面壳桥接层
- 拉起交互式 Pi CLI，并触发原生 `/login`
- 若开发态桌面桥不可用，Python 后端会在 macOS / Windows 上直接打开本机终端作为兜底登录入口；Windows 下优先直接启动 PowerShell，避免 Windows Terminal 二次解析命令行

---

## 9. 运行时模型与 diagnostics

后端当前已经支持：

- `GET /api/pi/options`
  返回当前 runtime state、可用模型列表、thinking levels
- `PATCH /api/sessions/{id}/settings`
  在已有会话上切换模型和思考水平
- `GET /api/settings/diagnostics`
  返回知识库、session、provider、Pi runtime 的诊断信息

这使得前端不只是“发消息”，还具备了：

- 运行时模型切换
- 思考水平切换
- 安全模式切换（只读 / 允许写文件 / 允许执行命令）

## 10. 首发前最小安全边界

当前所有 `PiRpcClient` 启动参数都会自动追加 gogo-app 托管的 `managed-security.ts`。

这层最小安全约束当前负责：

- 默认把 `bash` 禁用在“只读模式”和“允许写文件”模式下
- 只允许 `write/edit` 写入当前 knowledge-base 目录
- 阻断明显危险命令，例如 `sudo`、`rm -rf /`、`rm -rf ~`、`mkfs`、`dd of=/dev/*`
- 把 `bash/write/edit` 的 allow / block 决策写入本地审计日志，并通过 diagnostics 暴露给前端

当前明确不是强沙箱：

- 不承诺容器级隔离
- 已接入 RPC extension UI 子协议，用于当前 `tool_call` 的 inline 安全确认
- “允许执行命令”模式仍以默认阻断明显危险命令为主，而不是把所有宿主机能力都无条件放开
- diagnostics 展示
- 桌面版演进所需的运行时信息基础

---

## 10. 当前实现边界

已实现：

- RPC-only 主后端
- session-only 主聊天链路
- 单 reader task 的稳定 RPC 客户端
- 按知识库隔离的 session 目录
- Model Provider profile + 托管 extension
- settings / diagnostics / inbox / runtime options API
- 桌面版 Pi CLI 登录桥与 macOS / Windows 开发态直连兜底

未实现：

- 桌面版 Wiki Markdown 编辑
- 桌面版 slash 命令桥接

---

## 11. 相关文件

- `app/backend/agent_service.py`
- `app/backend/session_manager.py`
- `app/backend/pi_rpc_client.py`
- `app/backend/main.py`
- `app/backend/config.py`
- `docs/session-management.md`
