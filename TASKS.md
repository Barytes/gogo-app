# gogo-app 任务列表

> 本文档只维护 `gogo-app` 自身的任务。  
> 项目级架构参考：[gogo-project-architecture.md](docs/gogo-project-architecture.md)  
> 应用架构参考：[gogo-app-architecture.md](docs/gogo-app-architecture.md)

**最后更新**: 2026-04-16

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

#### 桌面化状态

- 当前桌面版基于 Tauri
- 桌面开发入口：`npm run desktop:dev`
- 当前桌面化方案与边界见 `docs/tauri-migration-plan.md`

## gogo-app 任务

### 0. Agent / Session / Model 接入

- [x] 优化 Pi Agent system prompt
- [x] 支持 Session 多会话管理（RPC 持久会话）
- [x] 完成 Agent/Session RPC 重构（F1-F5）

- [x] 支持 Model Provider 配置
  - [x] 明确 RPC mode 的 provider/model 能力边界
  - [x] 新增设置面板中的 Provider 配置入口，支持 API / OAuth 两种模式
  - [x] 将 Provider 定义改为由 gogo-app 生成并管理 extension，而不是直接写入 Pi 的 `models.json`
  - [x] 更新 `config.py`：管理 Provider profile、Pi `auth.json` 与 extension 产物
  - [x] 更新 RPC 链路：Pi RPC 进程启动时自动追加 `--extension <managed-providers.ts>`
  - [x] 打通前端设置面板保存/删除后对聊天模型菜单的即时刷新
  - 结论：Provider 定义现在由 gogo-app 生成到 `.gogo/pi-extensions/managed-providers.ts`，并在每次 Pi RPC 启动时通过 `--extension` 自动加载；API key / OAuth token 继续写入 Pi 自己的 `auth.json`，避免把凭证硬编码进 extension。
  - 结论：extension 不必放在 `~/.pi/agent/extensions/` 下，当前实现选择放在 gogo-app 自己的状态目录 `.gogo/pi-extensions/` 中，属于应用托管资源；这样更便于隔离、回收和后续桌面应用封装。
  - 结论：Provider 架构已调整为“Provider 定义”和“认证流程”分离。当前推荐边界是：API key / 自定义 API 由 gogo-app 负责配置；OAuth / subscription 登录统一交给 Pi CLI `/login`。
  - 结论：Web 版不承担 OAuth 登录职责；桌面版只需要提供“打开终端进入 Pi”的入口，并在用户完成 `/login` 后刷新认证状态与模型列表。

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

- [x] 从 Electron 迁移到 Tauri 桌面壳
  - [x] 移除 Electron 可执行代码与旧安装链
  - [x] 清理旧 Electron 历史文档与仓库内说明引用
  - [x] 在 `TASKS.md` 中补充 Tauri 迁移任务和当前边界
  - [x] 新增 `src-tauri/` 基础目录、`Cargo.toml`、`tauri.conf.json`、capability 与构建脚本
  - [x] 用 Tauri 主进程替代原 Electron 壳，并在启动时托管本地 FastAPI 子进程
  - [x] 启动后探活 `/api/health`，再创建原生窗口并加载本地工作台页面
  - [x] 通过 Tauri command 恢复桌面运行时 bridge，而不是让前端直接依赖 Node API
  - [x] 恢复原生“选择本地知识库目录”能力，并保留 Web 版“手动输入路径 + 最近使用列表”兜底方案
  - [x] 更新 README / docs / code-doc-mapping，明确后续桌面化路线已经转为 Tauri
  - 结论：仓库已新增 `src-tauri/src/main.rs`、`src-tauri/src/backend.rs`、`src-tauri/src/commands.rs` 与基础 `tauri.conf.json`；Tauri 启动时会自动拉起本地 FastAPI、探活 `/api/health` 并加载本地服务页面。
  - 结论：前端知识库设置区已重新接回桌面版原生目录选择器；桥接来源从 Electron preload 改为 `app/frontend/assets/desktop-bridge.js + Tauri invoke`。
- [x] 收敛桌面版 OAuth 登录路径为“打开终端进入 Pi，再由用户 `/login`”
  - [x] 将当前桌面登录入口调整为“打开终端并运行 `pi`”，不再尝试 provider-specific 的自动输入或自动指定模型
  - [x] 将统一登录接口 `POST /api/settings/pi-login` 的语义收敛为“提供进入 Pi CLI 的入口”，而不是替用户完成 provider-specific OAuth 流
  - [x] 登录完成后继续刷新 Provider 状态、模型列表与默认模型信息
  - [x] 在 UI 中明确提示：API key 在应用内配置，OAuth 登录请在终端中的 Pi CLI 执行 `/login`
  - [x] 仅把 Web 版的“手动导入 token”保留为兼容兜底，不再作为长期主路径
  - 结论：桌面版对外登录接口已统一为 `POST /api/settings/pi-login`；它现在只负责打开系统终端中的 `pi`，并尝试输入固定的 `/login`，不再带入任何 provider-specific 参数或模型信息。
  - 结论：前端仍会在登录入口被触发后刷新 Provider 状态和模型列表；如果用户是从某个具体 Provider 卡片进入登录，前端会优先观察该 Provider 的状态变化，但底层登录命令本身始终是统一的 `/login`。
- [x] 桌面版中支持 Wiki Markdown 编辑模式
  - [x] 明确编辑入口：Wiki 页面顶部按钮、只读/编辑双态、保存/取消交互
  - [x] 明确编辑范围：优先仅支持 `wiki/*.md` 页面，后续再评估 `raw/*.md`
  - [x] 设计 Markdown 编辑器与预览/渲染模式的切换关系，避免破坏当前浏览体验
  - [x] 打通后端保存 API、路径安全校验与保存失败提示
  - [x] 结合桌面版能力评估文件监听、外部修改检测、自动保存草稿等增强体验
  - [x] 明确与 knowledge-base 规范的边界：是否允许任意改写、是否需要保留原始内容、是否要记录最近一次编辑结果
- [x] 在 Chat 输入框加入 slash 命令入口，并支持 knowledge-base skills 与 schemas
  - [x] 设计输入框中的 slash 命令入口：输入 `/` 自动补全，是否还需要额外按钮
  - [x] 明确命令来源：默认只展示 knowledge-base skills / schemas，不直接暴露 Pi / agent 内置 slash 命令
  - [x] 明确 schema 的位置：先作为知识库命令来源的一部分接入，参数面板后续再补
  - [x] 设计选择命令后的行为：默认插入输入框草稿，不直接发送
  - [x] 明确 slash 命令与普通消息、Enter 发送、停止按钮、草稿态之间的交互优先级
  - [x] 设计最小参数面板：仅在 skill 明确需要结构化输入时展示
  - 结论：当前版本已支持输入 `/` 自动补全和额外 slash 按钮，两条入口都展示当前知识库的 skills 与 schemas；选择后默认把命令插入草稿而不直接发送。schema 暂时仍未接入单独的参数面板。
- [x] 在设置面板中添加“当前技能”一栏，展示并编辑当前知识库挂钩的 skills 与 schemas
  - [x] 明确数据来源：当前知识库中哪些 skills 与 schemas 会被识别为可挂钩能力
  - [x] 设计一个简洁的设置面板分栏，避免做成复杂 IDE 式管理器
  - [x] 支持查看当前已挂钩的 skills 与 schemas 列表
  - [x] 支持最小编辑能力：增删改或打开对应定义文件进行编辑
  - [x] 明确这一区域与未来 slash 命令自动补全之间的关系，避免两套能力目录不一致
  - [x] 评估是否需要在前端做命令说明、禁用态和错误提示，避免用户不知道哪些命令在当前模式下可用
  - 结论：设置面板已新增“当前技能”分栏，左侧按 Skills / Schemas / 支持文件分组展示当前知识库识别到的能力，右侧提供最小文本编辑器直接编辑原始定义；除了主 skill/schema 定义外，还会识别并展示相关的 `README.md`、`AGENTS.md`，以及知识库根目录的 `AGENTS.md`。同时支持一键新建最小模板的 skill / schema，并支持删除当前选中的主能力定义。该分栏与 Chat 输入框中的 slash 自动补全保持同源：slash 继续只使用 `/api/knowledge-base/slash-commands`，设置面板则使用扩展后的 `/api/knowledge-base/capabilities`，从而既保证命令列表干净，又能编辑完整支持文件。

### 3. 应用体验

- [x] 继续优化 Chat / Wiki 工作台体验
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
  - 结论：上传成功后，文件会立即出现在右下角 `Inbox` 面板中；用户可以从文件卡片里一键把 ingest 提示词插入聊天输入框，再发送给 Pi 按 `AGENTS.md`、`COMMUNICATION.md` 与 `schemas/ingest.md` 执行 ingest。
  - 结论：上传结果不再依赖聊天区的一条 assistant 提示，而是通过 `Inbox` 文件列表、轻量提示条和文件高亮来显式反馈；真正的 ingest 操作仍由用户主动发送给 Pi，因此过程和结果会自然留在对应知识库的隔离会话里，便于追踪。
- [x] 改进上传文件后的 Inbox / ingest 用户交互
  - [x] 避免“仅靠一条 assistant 消息提示上传成功”被用户忽略
  - [x] 设计可持续可见的 Inbox 状态入口，让用户随时知道当前知识库 `inbox/` 中有哪些待 ingest 文件
  - [x] 评估在右下角新增 Inbox 浮窗或抽屉，展示文件名、类型、上传时间、当前状态（待 ingest / 已处理）
  - [x] 评估上传成功后的即时反馈：toast、输入框上方状态条、待发送 ingest 草稿卡片，或自动打开 Inbox 面板
  - [x] 明确 Inbox 视图与 chat 发送 ingest 提示词之间的联动方式，例如“复制提示词”“插入到输入框”“标记为已提交给 Pi”
  - 结论：右下角已新增常驻 `Inbox` 入口与浮窗面板；面板会展示当前知识库 `inbox/` 文件名、类型、大小、更新时间，并保持可持续可见，不再依赖聊天区的一条 assistant 提示。
  - 结论：上传成功后会自动刷新并打开 `Inbox` 面板，高亮新文件，同时用轻量提示条提示“已上传到 inbox/...”；聊天区不再额外插入上传成功消息。
  - 结论：每个文件卡片都提供“一键插入 ingest 提示词”，插入后会把该文件状态显示为“提示词已准备”，让用户更清楚下一步就是发送给 Pi。
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
- [x] 修复引用提示词插入后的发送体验
  - [x] 排查“点击引用按钮后，提示词已写入聊天框，但不能立即发送，必须手动再输入一次”的根因
  - [x] 明确问题发生在输入框草稿态、发送按钮禁用条件，还是前端 `input/change` 事件未同步
  - [x] 修复后确保：点击引用按钮插入提示词后，可直接点击发送或按 Enter 立即发送
- [x] 修复 Inbox 浮窗数量徽标的自动刷新
  - [x] 排查 ingest 完成后右下角 Inbox 按钮数字未自动更新的原因
  - [x] 明确当前数量刷新是否只依赖“打开 Inbox 浮窗”动作触发
  - [x] 修复后确保 ingest 完成、上传完成、文件状态变化后，按钮数字会自动同步刷新
- [x] 恢复并统一 Inbox 文件上传的三种入口
  - [x] 修复 Tauri 版中“拖入 Inbox 浮窗无响应”的问题
  - [x] 支持文件直接拖入 Inbox 浮窗上传
  - [x] 支持文件直接拖入聊天框上传
  - [x] 保留并稳定现有“点击聊天框左下角 `+` 按钮上传文件”的入口
  - [x] 明确三种入口最终都走同一套校验、上传、刷新与高亮反馈逻辑，避免行为不一致
- [x] 在回答后增加“写回”快捷操作
  - [x] 设计 assistant 回答卡片上的“写回”按钮位置与样式，避免与“引用”等现有动作冲突
  - [x] 点击后向聊天框插入默认提示词，例如“请将上述回答写回wiki页面”
  - [x] 明确插入的是纯文本草稿，还是附带对当前回答的引用上下文
  - [x] 评估是否需要同时支持写回到当前打开 Wiki 页面，或仅先作为通用写回提示词入口
- [x] 排查会话切换与启动时的卡顿，并做性能优化
  - [x] 复现问题：点击进入一个会话，或 app 刚打开恢复最近会话时，聊天界面会短暂卡顿后才出现历史消息
  - [x] 定位当前最耗时的链路：会话列表加载、单会话历史恢复、前端整段重渲染、Markdown 渲染、右侧导航刷新、或后端 replay/history 合并
  - [x] 明确卡顿发生在前端主线程、后端 API、还是两者叠加
  - [x] 用日志或 profiling 标出最重的几个热点函数/接口
  - [x] 给出并实现第一轮低风险优化方案，优先减少“打开会话时白屏等待一下”的体感
  - [x] 评估是否需要进一步做历史分段渲染、虚拟列表、延迟渲染 trace/导航等深层优化
  - 结论：本轮排查认为卡顿主要来自“后端历史恢复成本 + 前端整段同步重渲染”的叠加。当前已新增文档 `docs/session-performance-optimization-log.md` 记录排查与优化历史；第一轮优化已完成四项：`replay_history()` 对已有 app-turns 走本地快路径、切会话时不再阻塞等待 session detail、历史消息改成分批渲染并减少重复滚动/导航刷新、启动阶段的 Pi options / slash / sessions / inbox 请求并行化。
- [x] 优化流式回答阶段的 Markdown 渲染性能
  - [x] 排查 `appendDelta()` / `setContent()` 当前“每个 delta 都整段重新跑 `markdownToHtml()`”的实际耗时
  - [x] 评估低风险优化：生成中先显示纯文本，final 再完整 Markdown；或对 Markdown 重渲染做节流
  - [x] 确保优化后不破坏现有代码块、链接、Wiki 内链与引用显示
  - [x] 把结果继续记录到 `docs/session-performance-optimization-log.md`
  - 结论：当前已落地第一轮低风险优化：流式 assistant 正文改成按帧合并 Markdown 渲染，`finalize()` 时再强制 flush；显示效果保持不变，但避免了每个 delta 都整段重跑 `markdownToHtml()`。
- [x] 优化右侧问题导航在长会话中的刷新成本
  - [x] 评估 `syncQuestionAnchors()` / `updateChatScrollAffordances()` 对超长历史的扫描成本
  - [x] 设计更懒的刷新策略，避免每次小变动都重新扫描全部 `.message-user`
  - [x] 评估是否可复用已有 question anchor 缓存，而不是每次重新从 DOM 收集
  - [x] 把结果继续记录到 `docs/session-performance-optimization-log.md`
  - 结论：当前已落地第一轮优化：问题 anchor 改成缓存维护，右侧导航 DOM 只在结构变化时重建；普通滚动时仅更新 active 高亮，不再重新扫描并重建整套导航。
- [x] 降低 session registry 的高频落盘开销
  - [x] 评估 `get_session()` 每次更新时间戳都写回 `gogo-session-registry.json` 的真实成本
  - [x] 设计节流/批量写盘策略，避免频繁只为 `last_used_at` 更新就落盘
  - [x] 确保异常退出时仍能保留足够可靠的 session 元数据
  - [x] 把结果继续记录到 `docs/session-performance-optimization-log.md`
  - 结论：当前已落地第一轮优化：`get_session()` 的触碰式 registry 更新改成节流写盘（5 秒窗口），创建/设置更新/请求开始与结束/进程重置等结构性变化仍立即落盘，从而减少频繁只为 `last_used_at` 更新时间而重写完整 registry 文件的 I/O。
- [x] 优化超长会话的 app-turns 历史读取
  - [x] 评估 `_load_history_from_app_turns()` 当前“顺序读完整 JSONL 再截尾”的成本
  - [x] 研究尾部读取、周期性快照，或历史分段文件等方案
  - [x] 明确哪种方案最适合当前 `gogo-app` 的实现复杂度和可靠性
  - [x] 把结果继续记录到 `docs/session-performance-optimization-log.md`
  - 结论：当前已落地第一轮优化：当只需要最近 `max_turns` 条 app-turns 历史时，改成从 `gogo-session-turns/*.jsonl` 尾部反向读取最后几行，而不是顺序扫描完整文件；默认会话恢复路径因此不再随着整个历史文件长度线性变慢。
- [x] 评估更深层的长会话渲染优化
  - [x] 评估“先渲染最近 N 轮，老历史延迟加载”的用户体验与实现复杂度
  - [x] 评估是否需要虚拟列表
  - [x] 评估是否应把 trace / 思考过程的详细 DOM 渲染延迟到用户展开时
  - [x] 把结果继续记录到 `docs/session-performance-optimization-log.md`
  - 结论：当前已完成方案评估。推荐顺序是：1）优先实现“最近 N 轮先渲染、老历史延迟加载”；2）再实现 trace / 思考过程按展开时机延迟渲染；3）最后再评估是否真的需要虚拟列表。当前判断是，虚拟列表收益上限高，但和现有消息缓存、吸底、trace 展开、右侧问题导航的耦合太深，不适合作为下一步首选。
- [x] 实现长会话“最近 N 轮优先渲染，老历史延迟加载”
  - [x] 设计默认首屏渲染的最近轮数，以及“加载更早消息”的交互位置
  - [x] 明确右侧问题导航在“仅部分历史已渲染”时的行为
  - [x] 评估后端历史接口是否需要补充分页 / before cursor，或先用前端已有历史缓冲实现第一版
  - [x] 把结果继续记录到 `docs/session-performance-optimization-log.md`
  - 结论：当前已完成第一轮实现。会话首屏默认只恢复最近 `60` 条历史，并在还有更早消息时显示“加载更早消息”；后端历史接口补成了从最新往前的 `limit + offset` 窗口语义。当前版本里，右侧问题导航只基于已渲染历史工作，这是为了换取更轻的首屏 DOM 成本而做的有意取舍。
- [x] 实现 trace / 思考过程按展开时机延迟渲染
  - [x] 调整 assistant 历史消息的 trace 渲染方式，折叠时只保留 summary
  - [x] 首次展开时再填充完整 trace / warnings DOM
  - [x] 确保已有流式消息、历史恢复消息和会话视图缓存行为一致
  - [x] 把结果继续记录到 `docs/session-performance-optimization-log.md`
  - 结论：当前已完成第一轮实现。历史 assistant 消息与流式 assistant 消息的 trace 都改成折叠时只维护 summary 和状态，用户首次展开时再创建内部 trace / warnings DOM；这样能继续降低长会话首屏恢复和流式回复期间的无效 DOM 构建成本。
- [x] 排查软件启动时的整体卡顿，并做启动性能优化
  - [x] 复现“应用启动时大约卡 1 秒才出界面”的问题，并区分是 Tauri 壳、后端启动、前端首屏渲染，还是它们叠加
  - [x] 明确启动链路中哪些步骤阻塞了首个窗口显示，例如：Tauri 启动后端、健康检查、前端 bootstrap、首屏数据请求
  - [x] 用日志或时间点埋点标出启动阶段最慢的几个步骤
  - [x] 给出并实现第一轮低风险优化，优先改善“窗口出现前的等待感”
  - [x] 评估是否需要把首屏渲染和数据加载拆成更明显的 loading / skeleton，而不是整段等待
  - [x] 把结果继续记录到 `docs/session-performance-optimization-log.md`
  - 结论：当前已完成第一轮启动优化：前端 bootstrap 改成“先恢复会话列表与最近活跃会话，再后台预热 `Pi options / slash / inbox`”，同时 Tauri 端 FastAPI 健康检查轮询间隔从 `300ms` 降到 `100ms`。当前判断是，启动卡顿来自“Tauri 等待本地后端 ready + 前端把非关键请求混入首屏关键路径”的叠加；开发态仍受 `beforeDevCommand` 限制，若后续仍需进一步改善窗口出现前的等待，可再评估原生 splash。

### 4. Backlog

- [x] 做一轮文档清理与覆盖性审计
  - [x] 检查 `docs/` 中哪些文档内容已经过时，不符合当前代码实现
  - [x] 检查哪些当前代码实现尚未记录在文档中，尤其是近期新增的设置面板、Inbox、Provider、diagnostics、会话恢复等能力
  - [x] 基于 `docs/code-doc-mapping.md` 和实际代码结构，补齐缺失文档入口或更新映射关系
  - [x] 区分“需要修正文档”与“需要补代码注释/架构说明”的问题，避免只做表面同步
  - [x] 产出一份清理结果：哪些文档已更新、哪些仍待补、哪些可以合并或废弃
  - 结论：本轮已重点更新 `docs/frontend-workbench-elements.md`、`docs/session-management.md`、`docs/agent-architecture.md` 与 `docs/gogo-app-architecture.md`，补齐设置面板侧边栏、Provider/diagnostics、Inbox、富历史恢复、单 reader task Pi RPC 等近期实现说明。
  - 结论：`docs/code-doc-mapping.md` 已新增 `docs/gogo-app-architecture.md` 的代码映射；审计结果已沉淀到 `docs/documentation-cleanup-audit-2026-04-15.md`，当前剩余待补的主要是未来桌面版实现文档，而不是 Web 版已落地能力的缺口。
- [x] 在设置面板中加入更明确的 health / diagnostics 信息
  - [x] 明确 diagnostics 需要展示哪些运行状态：知识库名称/路径、session namespace、后端模式、Pi RPC 连通性等
  - [x] 设计设置面板中的 diagnostics 区块，避免与知识库切换设置混淆
  - [x] 评估是否需要展示最近一次错误、超时、上传/ingest 状态，方便排查问题
  - [x] 明确哪些信息只做只读展示，哪些信息可以从 diagnostics 直接触发操作（如刷新状态、重连、打开日志目录）
  - 结论：设置面板已新增独立的“诊断”分组，集中展示知识库路径与目录状态、session namespace / session 目录、Pi RPC 配置与连通性、当前 runtime 模型状态，以及默认 provider/model/thinking 等关键信息。
  - 结论：当前 diagnostics 以只读信息 + “刷新状态”为主；最近错误信息先通过 Pi runtime 拉取错误兜底展示，不在诊断区直接执行重连或写配置，避免与其他设置项语义混淆。

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
| 2026-04-16 | 完成一轮会话切换 / 启动恢复卡顿排查与性能优化：新增 `docs/session-performance-optimization-log.md`，并落地 app-turns 历史快路径、后台刷新 session detail、历史消息分批渲染 |
| 2026-04-16 | 完成 Tauri 第一阶段迁移，并清理旧 Electron 文档与过期任务说明：新增 `src-tauri/`、Tauri 后端启动器、桌面 bridge 与目录选择能力；同步 README / TASKS / docs 索引 |
| 2026-04-14 | 新增待排查问题：长回复可能被提前中断；`PiRpcClient.abort()` 与流式读取并发时出现 `read() called while another coroutine is already waiting for incoming data` |
| 2026-04-14 | 将无 session 单次聊天迁移到 `/api/legacy/chat` 与 `/api/legacy/chat/stream`，主 `/api/chat*` 收敛为 session-only；完成固定检索与 `consulted_pages` 评估：两者仅保留为 legacy no-session 兼容能力与应用层 UI 元数据 |
| 2026-04-14 | 完成 `_build_pi_prompt` history 注入评估：session 链路完全依赖 RPC 会话历史；无 session 单次聊天继续保留 prompt 级 history 兜底 |
| 2026-04-14 | 完成会话管理对齐 ChatGPT：草稿态 + 懒创建 + 会话列表 `...` 菜单 + 重命名 API + 删除语义收敛 |
| 2026-04-14 | 基于 `gogo-app / gogo-client / gogo-server / knowledge-base` 新划分，重拆任务归属 |
