# gogo-app 任务列表

> 本文档只维护 `gogo-app` 自身的任务。  
> 项目级架构参考：[gogo-project-architecture.md](docs/gogo-project-architecture.md)  
> 应用架构参考：[gogo-app-architecture.md](docs/gogo-app-architecture.md)

**最后更新**: 2026-04-15

## 相关任务文档

跨目录任务已拆分：

- `gogo-client`：[/Users/beiyanliu/Desktop/gogo/gogo-client/TASKS.md](/Users/beiyanliu/Desktop/gogo/gogo-client/TASKS.md)
- `gogo-server`：[/Users/beiyanliu/Desktop/gogo/gogo-server/TASKS.md](/Users/beiyanliu/Desktop/gogo/gogo-server/TASKS.md)
- `knowledge-base`：[/Users/beiyanliu/Desktop/gogo/knowledge-base/TASKS.md](/Users/beiyanliu/Desktop/gogo/knowledge-base/TASKS.md)

## 代码现状

### 已完成功能

#### 后端 (FastAPI)

| 模块 | 文件 | 状态 |
|------|------|------|
| 配置管理 | `app/backend/config.py` | ✅ 基础配置（`KNOWLEDGE_BASE_DIR`, Pi 相关配置） |
| 主入口 | `app/backend/main.py` | ✅ 页面路由、Wiki/Raw API、Chat API |
| Wiki 服务 | `app/backend/wiki_service.py` | ✅ 列表、搜索、详情、树结构 |
| Raw 服务 | `app/backend/raw_service.py` | ✅ 列表、搜索、详情、PDF 预览 |
| Agent 服务 | `app/backend/agent_service.py` | ✅ Pi RPC 主链路、流式聊天 |
| Session 管理 | `app/backend/session_manager.py` | ✅ RPC 会话生命周期、历史恢复、空闲回收 |
| Pi RPC Client | `app/backend/pi_rpc_client.py` | ✅ RPC JSONL 通信与命令封装 |

#### 前端

| 模块 | 文件 | 状态 |
|------|------|------|
| 主页面 | `app/frontend/index.html` | ✅ 单页工作台布局 |
| 工作台控制 | `app/frontend/assets/workbench.js` | ✅ Wiki/Chat 模式切换、浮窗控制 |
| Wiki 浏览 | `app/frontend/assets/wiki.js` | ✅ 列表、搜索、详情、Markdown 渲染 |
| Chat | `app/frontend/assets/chat.js` | ✅ 流式消费、工作日志显示 |
| 样式 | `app/frontend/assets/styles.css` | ✅ 基础样式 |

## gogo-app 任务

### 0. Agent / Session / Model 接入

- [x] 优化 Pi Agent system prompt
- [x] 支持 Session 多会话管理（RPC 持久会话）
- [x] 完成 Agent/Session RPC 重构（F1-F5）

- [ ] 支持 Model Provider 配置
  - [ ] 明确 RPC mode 的 provider/model 能力边界
  - [ ] 新增 `MODEL_NAME` 配置
  - [ ] 将 `MODEL_PROVIDER` 收敛为 provider 选择/约束语义
  - [ ] 更新 `config.py`：读取并校验 provider/model
  - [ ] 更新 RPC 链路：`get_available_models` + `set_model`
  - [ ] 完善错误提示与文档说明

- [x] 评估 `_build_pi_prompt` 中 history 注入是否仍有必要
  - [x] 判断是否可完全依赖 RPC 会话历史
  - [x] 明确无 session 场景的兜底策略
  - 结论：`session_id` 链路已完全依赖 Pi RPC 原生会话历史，前端传入的 `history` 在 `session_manager.py` 中已被忽略；`_build_pi_prompt` 中的 history 注入仅对无 session 的单次聊天链路仍然必要，因为该链路使用 `--no-session`，没有可复用的原生会话上下文。
  - 当前策略：保留 `_build_pi_prompt` 的最近历史注入，作为无 session 模式的兜底；若未来移除无 session 单次聊天入口，再考虑删除这部分 prompt 级 history 拼接。

- [x] 调整固定检索与 `consulted_pages` 注入
  - [x] 评估是否保留 `_collect_context()` 预检索
  - [x] 评估 `consulted_pages` 是否应继续作为 UI 数据返回
  - [x] 如果保留，明确它是应用层功能，而非 knowledge-base 规范
  - 结论：保留 `_collect_context()`，但仅保留在已 deprecated 的无 session 单次聊天链路中，作为兼容性预检索；不把这套固定检索迁入主 session 路径，避免污染 Pi 原生会话历史并与工具检索重复。
  - 结论：保留 `consulted_pages`，但将其明确为应用层 UI 元数据，只表示“后端预检索到并展示给前端的候选页面”，不是 knowledge-base 规范的一部分，也不是主 session 链路的权威 grounding 元数据。
  - 当前策略：主产品路径继续以 session + Pi 原生会话 + 工具调用为主；固定检索与 `consulted_pages` 仅服务于 legacy no-session 兼容路径。

### 1. gogo-app 与外部 knowledge-base 的连接质量

- [x] 明确 `KNOWLEDGE_BASE_DIR` 接入体验
- [x] 提升知识库切换/初始化时的错误提示
- [x] 明确 gogo-app 如何发现并展示当前连接的 knowledge-base 信息
- 结论：后端已支持运行时读取与切换知识库目录，前端设置面板可展示当前知识库名称、路径与最近使用列表；切换失败时会明确提示“目录不存在”“缺少 `wiki/` / `raw/` 子目录”等错误；切换知识库后会按知识库 namespace 隔离 session 存储，避免不同知识库的会话互相混淆。

### 2. 桌面应用封装

- [ ] 评估并实现桌面应用封装（支持原生选择知识库目录）
  - [ ] 明确封装路线：Electron / Tauri / 其他桌面壳
  - [ ] 设计原生“选择本地知识库目录”能力，并将绝对路径安全传给前端设置面板
  - [ ] 保留 Web 版的“手动输入路径 + 最近使用列表”兜底方案
  - [ ] 明确桌面版知识库切换后的 session 隔离与目录迁移策略
  - [ ] 评估桌面版打包、自动更新与跨平台发布成本

### 3. 应用体验

- [ ] 继续优化 Chat / Wiki 工作台体验
- [x] 排查长回复可能被提前中断的问题
  - [x] 确认问题发生在 Pi RPC 流、前端流消费，还是 session/abort 并发链路
  - [x] 复现“明显未输出完就终止”的场景并记录触发条件
  - [x] 明确是后端过早返回 `final/error`，还是前端提前停止渲染
  - 结论：问题主要出在后端 Pi RPC 流的正文聚合与 session/abort 并发链路；当前已补充正文快照兜底，并在实际问答回归中暂未再复现提前截断。
- [x] 排查回复过程中 `PiRpcClient.abort()` 的并发读冲突
  - [x] 复现报错：`RuntimeError: read() called while another coroutine is already waiting for incoming data`
  - [x] 评估 `abort()` 与 `prompt_events()` 共享同一 `StreamReader` 的并发读问题
  - [x] 评估修复方向：单读协程分发、命令串行化，或专门的 abort 处理机制
  - [x] 结合实际工具调用重放一次长回复 + 用户终止场景，确认问题是否与高频工具调用有关
  - 结论：`PiRpcClient` 已重构为“单 reader task + response future 分发 + event queue”结构，`stdout` 不再被多个协程直接读取；用户终止按钮触发的后台 `abort()` 任务也已补上异常回收，当前实测未再出现并发读报错。
- [x] 完善会话列表与历史恢复体验
- [x] 评估是否需要增加 knowledge-base 来源与当前连接状态展示
- [x] 支持在前端切换 Pi 模型
  - [x] 明确模型列表来源与后端配置方式
  - [x] 设计模型切换的前端入口与当前模型显示
  - [x] 打通 session / legacy 路径中的模型参数传递
  - 结论：聊天框左下角已接入模型切换按钮；前端通过 `/api/pi/options` 加载可用模型与默认状态，通过 `/api/sessions/{session_id}/settings` 更新当前会话模型，草稿态设置会用于首条消息创建的新会话。
- [x] 支持在前端切换 Pi 思考水平
  - [x] 复用或扩展现有 `thinking level` 后端能力
  - [x] 设计 chat 工作台中的切换入口与状态持久化
  - [x] 明确切换范围：当前会话、当前请求，还是全局默认
  - 结论：聊天框左下角已接入思考水平切换按钮；草稿态修改会作为新会话默认值，已有会话会即时持久化到 session；当前模型不支持的思考水平会显示提示而不会真正切换。
- [x] 支持上传文件并 ingest 到知识库
  - [x] 明确上传入口、文件类型与大小限制
  - [x] 设计上传后 ingest 的后端流程与状态反馈
  - [x] 明确 ingest 后如何在 Wiki / Chat 中可见与可追踪
  - 结论：聊天框左下角 `+` 按钮已接入文件上传；文件会写入当前知识库的 `inbox/`，并对常见研究文件类型做扩展名校验，单文件大小限制为 50MB。
  - 结论：上传成功后，前端会把一段 ingest 提示词自动填入聊天输入框，提示 Pi 先阅读 `AGENTS.md`、`COMMUNICATION.md` 与 `schemas/ingest.md`，再按 schema 自主完成分类、写回与 `wiki/log.md` 记录。
  - 结论：上传结果会在聊天区明确提示写入的 `inbox/` 路径；真正的 ingest 操作仍由用户把提示词发给 Pi 触发，因此过程和结果都会自然留在对应知识库的隔离会话里，便于追踪。
- [x] 会话管理行为对齐 ChatGPT 网页体验
  - [x] 引入“草稿聊天态（无 session）”与“持久会话态（有 session_id）”双态模型
  - [x] 页面初始化不自动创建会话；仅加载会话列表并恢复最近活跃会话（若存在）
  - [x] 仅在用户发送首条消息时创建新会话（lazy create）
  - [x] 删除当前会话后不自动新建会话：有剩余会话则切换，无剩余会话则回到草稿态
  - [x] 刷新页面不应新增空白会话；修复“刷新即创建会话”问题
  - [x] 支持会话重命名（前端交互 + 后端 API）
  - [x] 新会话标题支持根据首条用户消息自动命名（并允许后续手动修改）
  - [x] 会话列表交互从 `select + 删除按钮` 升级为列表项 + `...` 二级菜单（至少含重命名、删除）
  - [x] 会话删除接口语义收敛：删除失败（不存在等）返回明确错误，前端校验 `success`

### 4. Backlog

- [ ] 评估 gogo-app 是否需要保留应用层检索辅助能力
- [ ] 评估 gogo-app 是否需要暴露更明确的 health / diagnostics 页面

## 不再由 gogo-app 承担的任务

以下任务已迁出本仓职责：

- knowledge-base 写回规范与 lint 规则
- 双层知识库结构规范
- 独立同步客户端
- 多用户公共池聚合

对应任务请见：

- [gogo-client/TASKS.md](/Users/beiyanliu/Desktop/gogo/gogo-client/TASKS.md)
- [gogo-server/TASKS.md](/Users/beiyanliu/Desktop/gogo/gogo-server/TASKS.md)
- [knowledge-base/TASKS.md](/Users/beiyanliu/Desktop/gogo/knowledge-base/TASKS.md)

## 变更日志

| 日期 | 变更 |
|------|------|
| 2026-04-14 | 新增待排查问题：长回复可能被提前中断；`PiRpcClient.abort()` 与流式读取并发时出现 `read() called while another coroutine is already waiting for incoming data` |
| 2026-04-14 | 将无 session 单次聊天迁移到 `/api/legacy/chat` 与 `/api/legacy/chat/stream`，主 `/api/chat*` 收敛为 session-only；完成固定检索与 `consulted_pages` 评估：两者仅保留为 legacy no-session 兼容能力与应用层 UI 元数据 |
| 2026-04-14 | 完成 `_build_pi_prompt` history 注入评估：session 链路完全依赖 RPC 会话历史；无 session 单次聊天继续保留 prompt 级 history 兜底 |
| 2026-04-14 | 完成会话管理对齐 ChatGPT：草稿态 + 懒创建 + 会话列表 `...` 菜单 + 重命名 API + 删除语义收敛 |
| 2026-04-14 | 基于 `gogo-app / gogo-client / gogo-server / knowledge-base` 新划分，重拆任务归属 |
