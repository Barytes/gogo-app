# gogo-app 任务列表

> 本文档只维护 `gogo-app` 自身的任务。  
> 项目级架构参考：[gogo-project-architecture.md](docs/gogo-project-architecture.md)  
> 应用架构参考：[gogo-app-architecture.md](docs/gogo-app-architecture.md)

**最后更新**: 2026-04-24

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

- [ ] 规划 Agent runtime 抽象，支持“外接本地 coding agent + bundled Pi fallback”
  - [ ] 将当前 Pi-only 架构提升为 runtime manager + adapter 结构，而不是让 Agent 层默认等于 `pi --mode rpc`
  - [ ] 明确 bundled Pi、system Pi、ACP agent 三类 runtime profile 的配置模型、诊断模型与切换语义
  - [ ] 评估并设计 ACP 接入层，优先对接 `initialize`、`session/new`、`session/load`、`session/prompt`、`session/cancel`、`session/update` 与 permission request 映射
  - [ ] 明确 Claude Code、Codex 等外部 agent 的接入边界：默认通过 ACP-compatible agent 或 bridge 接入，不在 `gogo-app` 中直接实现各家私有协议
  - [ ] 保留 bundled Pi runtime 作为默认体验和 fallback 路径，避免外接 agent 配置失败时整条聊天主链路不可用
  - 参考文档：`docs/workspace-and-agent-runtime-refactor-plan.md`

### 1. gogo-app 与外部 knowledge-base 的连接质量

- [x] 明确 `KNOWLEDGE_BASE_DIR` 接入体验
- [x] 提升知识库切换/初始化时的错误提示
- [x] 明确 gogo-app 如何发现并展示当前连接的 knowledge-base 信息
- 结论：后端已支持运行时读取与切换知识库目录，前端设置面板可展示当前知识库名称、路径与最近使用列表；切换失败时会明确提示“目录不存在”“缺少 `wiki/` / `raw/` 子目录”等错误；切换知识库后会按知识库 namespace 隔离 session 存储，避免不同知识库的会话互相混淆。

- [ ] 规划内容工作区抽象，解除 `wiki/raw` 目录强绑定
  - [ ] 将当前“知识库目录”抽象为更通用的 workspace descriptor，至少区分 `knowledge-base` 与 `markdown-folder` 两种模式
  - [ ] 明确 `markdown-folder` 模式第一阶段支持范围：Markdown 浏览、搜索、编辑、新建、删除
  - [ ] 明确 `raw / inbox / skills / schemas / AGENTS.md` 在普通 Markdown 工作区中的降级策略，避免 UI 与后端继续假设这些目录恒定存在
  - [ ] 调整启动引导、diagnostics、桌面 provision 文案与错误提示，使其围绕“工作区”而不是固定 `knowledge-base/wiki/raw` 结构
  - [ ] 评估新的 workspace 抽象对安全边界、session namespace 和桌面 companion knowledge-base 路径选择的影响
  - 参考文档：`docs/workspace-and-agent-runtime-refactor-plan.md`

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
- [ ] 规划并落地从当前开发态到“可分发给最终用户”的桌面安装包链路（Windows / macOS）
  - [ ] 明确发布目标与边界：区分“开发者可运行的桌面版”和“最终用户双击可安装的桌面版”，并在 README / docs 中写清当前支持范围、外部依赖与已知限制
  - [ ] 启用 Tauri 正式 bundle 配置，明确 Windows 与 macOS 的目标产物形态（至少包含 `NSIS setup.exe` 或等价安装器，以及 `.app + dmg` 或等价 macOS 安装包）
  - [ ] 明确并实现后端交付策略：是内置 Python 运行时、内置虚拟环境、还是在安装阶段生成受控运行时；避免打包版继续依赖源码目录下的 `.venv`、`uv` 或系统 Python
  - [ ] 明确并实现应用资源装载策略：让打包版能够在脱离仓库源码目录后仍正确定位 `app/backend/`、`app/frontend/`、图标与其他运行资源，而不是继续假设工作目录就是仓库根目录
  - [ ] 明确 `knowledge-base` 的交付边界：是要求用户首次启动时手动选择已有 knowledge-base，还是提供示例知识库 / 首次启动向导；同时补齐“目录不存在 / 缺少 `wiki/` / `raw/` / `inbox/`”等安装后引导
  - [ ] 明确 Pi 依赖的发行策略：是要求目标机器预装 `pi`，还是将其纳入安装引导；同时为“未安装 / 未登录 / PATH 不可见”提供安装后诊断与引导入口
  - [ ] 补齐发布态诊断能力：在桌面版里提供“查看运行环境、后端日志、Pi 状态、knowledge-base 状态”的可视化诊断，降低用户安装后排障成本
  - [ ] Windows 打包链路
    - [ ] 确认 Windows 所需运行前置条件（WebView2、VC runtime、权限模型、默认日志目录、路径编码与空格路径兼容）
    - [ ] 产出可安装的 Windows 包，并验证安装、升级安装、卸载、首次启动、日志落盘、目录选择、Pi 登录、文件打开等关键路径
    - [ ] 评估并接入 Windows 代码签名，避免未签名安装包导致的高风险提示或 Defender/SmartScreen 拦截
  - [ ] macOS 打包链路
    - [ ] 确认 macOS 所需运行前置条件（WebKit/Tauri bundle 形态、Terminal / AppleScript 权限、Sandbox 外文件访问、日志目录与应用支持目录）
    - [ ] 产出 `.app` 与面向用户分发的 `dmg`（或等价安装介质），并验证拖拽安装、首次启动、Gatekeeper 提示、目录选择、Pi 登录、文件打开与升级覆盖
    - [ ] 评估并接入 Developer ID 签名与 notarization，避免用户在 macOS 上默认无法打开应用
  - [ ] 建立最小发布流程：定义版本号、构建命令、产物命名、校验步骤、人工 smoke test 清单与发布说明模板，确保每次发版都能稳定复现
  - [ ] 发版前回归清单
    - [ ] 干净机器验证：至少在一台未配置开发环境的 Windows 与一台未配置开发环境的 macOS 上完成安装与首轮引导验证
    - [ ] 核心能力回归：知识库选择、Wiki 浏览、聊天、多会话恢复、Provider 设置、Pi 登录、Inbox 上传、文件打开、错误提示与 diagnostics
    - [ ] 失败场景回归：knowledge-base 缺失、Pi 未安装、Pi 未登录、后端启动失败、端口冲突、权限不足、路径含中文或空格
  - [ ] 补齐开源文档：新增面向用户的安装文档、平台差异说明、常见问题、故障排查与“从源码运行 / 从安装包运行”的区别说明

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
- [x] 优化 Chat / Wiki / Inbox 浮窗的默认展开与收起行为
  - [x] 修复切换 `chat/wiki` 模式时自动弹出对应浮窗的问题，改为保留用户当前展开状态，而不是模式切换即强制打开
  - [x] 统一 `chat/wiki/inbox` 三种浮窗的“点击浮窗外区域自动收回”交互，并处理事件冒泡、遮罩层与拖拽/滚动冲突
  - [x] 明确浮窗显隐状态的优先级：模式切换、首次进入页面、上传完成、引用/写回插入提示词、手动点击按钮之间不能互相抢状态
  - [x] 补一轮回归：切换模式、上传文件、打开 Inbox、进入 Wiki 详情、返回聊天时都不应出现意外自动弹出或无法收起
- [x] 优化 Chat 输入区底部工具栏的布局与命令菜单显示
  - [x] 修复发送按钮与模型/思考/命令按钮互相遮挡的问题，覆盖常见窗口宽度、长 placeholder、系统缩放和桌面壳内嵌场景
  - [x] 调整底部按钮组的间距、尺寸、换行/滚动策略，避免命令按钮显示不全、被裁切或视觉权重失衡
  - [x] 优化各类命令按钮与弹出菜单的样式层级，降低当前“图标过挤、文案截断、面板贴边”的问题，确保中英文文案都可读
  - [x] 补桌面端截图回归，重点覆盖窄窗口、长命令列表、打开安全模式菜单与上下文提示卡并存时的布局稳定性
- [x] 打通 Wiki 与 Inbox 的联动浏览和文件创建能力
  - [x] 让 Wiki 视图可以看到当前知识库 `inbox/` 中的文件，明确它是作为独立分组、侧栏节点，还是与现有 Wiki 树并列展示
  - [x] 明确 Inbox 文件在 Wiki 中的可见范围与只读/可操作边界，至少支持查看基础元信息，并能从 Wiki 侧跳转到对应 Inbox 操作
  - [x] 在 Wiki 中支持新建 `.md` 文件，明确新建入口、默认目录、文件名校验、重名处理与创建后自动进入编辑态/详情态的交互
  - [x] 评估是否需要复用现有 Wiki 编辑能力与后端保存接口，避免为“新建 md”单独再做一套保存链路
  - [x] 补充端到端回归：新建 Markdown、保存、刷新后仍可见；Inbox 文件在 Wiki 可见且不会误混入正式 Wiki 文档树
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

### 4. 对外发布与开源准备

#### 4.0 已确定的发布基线

- [x] 首发对象：普通最终用户 / 非技术终端用户
- [x] 首发平台：Windows + macOS 必须同时支持；Linux 仅保留开发态
- [x] 正式产品形态：只认桌面版；Web 版不作为正式对外产品
- [x] companion knowledge-base：随安装包提供，安装时由用户决定路径，安装后保留为可随时切回的示例库
- [x] `pi` 依赖策略：首发优先使用 bundled `pi` 运行时；未检测到 bundled / system `pi` 时，再走应用内托管安装作为 fallback
- [x] 首次启动主路径：优先检测 bundled / system `pi`，必要时引导安装 -> 配置模型/API key（可跳过） -> 进入 companion knowledge-base -> 已配置模型时跑 demo，未配置时可先浏览 Wiki
- [x] 首发模型配置范围：支持 API key 型 provider，以及 `pi` 已稳定支持且桌面引导已验证通过的 OAuth
- [x] API key 存储策略：首发阶段仅保存在本机认证文件中，不自动上传，暂不接入 macOS Keychain / Windows Credential Manager
- [x] 首发最低成功标准：用户配置模型后，能完整跑通一次上传、ingest、聊天、写回
- [x] 首发兼容要求：必须支持中文路径与带空格路径
- [x] 联网边界：聊天依赖用户自己配置并联网访问的模型；知识库浏览与编辑可断网
- [x] 默认日志/诊断策略：只保存在本地，不自动上传；用户可手动导出后发 GitHub issue
- [x] 正式支持渠道：GitHub Issues，不额外提供作者邮箱支持渠道
- 结论：当前发布路线已经固定为“普通用户可直接安装的 Windows / macOS 桌面版”；后续任务不再围绕“要不要做桌面正式版”讨论，而是围绕如何把这套标准落地。

#### 4.1 Phase 1: Companion Knowledge-Base 与 Demo 体验

- [x] 打造一套开箱即用的 companion knowledge-base
  - [x] 收敛为最小通用结构：`inbox / raw / wiki / AGENTS.md / schemas(query, ingest, lint) / skills(示例)`，不再沿用课题组专用的复杂分层
  - [x] 更新知识库中的 `AGENTS.md`、基础 `schemas` 与示例 `skills`，只保留最基本的行为指示，不再要求额外的研究组运营规则
  - [x] 明确写回最小语义在 companion knowledge-base 中如何体现：允许 agent 将用户要求或自己判断高价值的内容写回 Wiki
  - [x] 明确 companion knowledge-base 与用户自有知识库的边界：companion knowledge-base 用于开箱演示与随时切回的示例体验，用户也可自由切换到自己的长期知识库

#### 4.2 Phase 2: 安装器、Runtime 与资源交付

- [ ] 完成 Windows / macOS 安装包链路
  - [x] 启用并稳定 Tauri 正式 bundle，并验证发布态资源映射可稳定产出 macOS release `.app + .dmg` 产物；Windows 安装介质仍待补齐
  - [x] 将当前 `desktop:build` 从 Unix shell 主链重构为真正跨平台可运行的构建入口：现已改为 Node 脚本，避免 Windows 打包依赖 `sh`、`rm`、`mv`、`find`
  - [x] 补齐 Windows 构建适配的代码侧主链：当前 `desktop:build` 已可在代码层构建独立后端 runtime、staging bundled `pi` 并继续调用 Tauri bundle；实机/CI 验证仍留给下一条任务
  - [x] 在 Windows 本机或 Windows CI runner 上验证 `npm run desktop:build`，确认可产出 `backend-runtime/gogo-backend.exe` 与最终安装介质（至少 `NSIS setup.exe`）
    - [x] 已在 Windows LTSC 2019 本机补齐 Rust MSVC / WebView2 / VS 2019 Build Tools，并验证 `desktop:build` 可产出 `desktop-runtime-staging/backend/gogo-backend.exe`
    - [x] 已补齐 Windows 打包所需的 `src-tauri/icons/icon.ico`，Tauri build 不再被缺失图标阻塞
    - [x] 已定位并修复 `scripts/desktop-build.mjs` 在 Windows 上直接 `spawn` 本地 `tauri.cmd` 导致的 `spawn EINVAL`
    - [x] 已确认切换到 `NSIS setup.exe` 后可绕开 WiX / `msi` 阶段，Windows 打包已成功进入 NSIS bundle 阶段
    - [x] 已通过预置 NSIS 依赖缓存解决在线下载超时，当前 Windows 本机构建已成功产出 `src-tauri/target/release/bundle/nsis/gogo-app_0.1.0_x64-setup.exe`
  - [x] 明确 Windows 首发安装介质策略：首发先收敛为 `NSIS setup.exe`，不再把 `msi` 作为首发必做项
    - [x] 修复 Windows NSIS 安装模式过于隐式的问题：安装器已改为 `installMode=both`，让用户明确选择“仅当前用户”或“所有用户”；安装到 `Program Files` 等路径时应选择“所有用户”以触发管理员权限
  - [x] 完成桌面后端运行时交付：`desktop:build` 会先构建独立的 PyInstaller 后端 runtime，并验证其可脱离源码目录与开发态 `.venv` 启动；发布态优先启动 bundle 内的 `backend-runtime`
  - [x] 实现 companion knowledge-base 随安装包资源交付，并在桌面发布态下默认从 bundle template provision 到可写的 app data 目录
  - [x] 让用户在安装/首次启动时决定 companion knowledge-base 路径，而不是只使用默认 provision 路径；当前实现为：首次启动时弹出系统目录选择器，记住选择结果，并把 companion knowledge-base provision 到用户选定位置
  - [ ] 实现安装器中的 `pi` 检测与静默安装链路
  - [x] 调整 `pi` 交付优先级：优先评估并接入 bundled `pi`，把“启动时 fallback 安装”保留为兜底路径，而不是正式首选交付方式
  - [x] 先把 bundled `pi` 的打包入口接进构建链：`desktop:build` 现在会优先使用当前平台默认的 bundled `pi` 路径，也支持通过 `GOGO_DESKTOP_PI_BINARY` 显式指定上游 `pi` 运行目录；若两者都不可用则直接 fail，避免产出未携带 `pi-runtime` 的安装包
  - [x] 已在 macOS 本地验证 bundled `pi` 运行目录可随桌面 bundle 分发：`pi-runtime/` 会带上 `package.json` 等旁件，OAuth `/login` 的终端拉起不再因缺少运行时文件而失败，诊断接口也已确认运行时优先使用 bundle 内的 `pi`
  - [x] 已补齐 Windows 侧桌面 Pi 登录桥代码：桌面版现在会在 Windows 上优先通过 PowerShell 拉起 bundled / system `pi`，并提示用户在终端中手动输入 `/login`；仍待 Windows 实机验收
    - [x] 修复 Windows 开发态 OAuth 登录兜底仍是 macOS-only 的问题：当 Python 后端无法连接 Tauri 桥时，现在会直接打开 PowerShell 并运行当前检测到的 `pi`；同时修复 Python 参数数组传给 `cmd.exe /K` 导致的“文件名、目录名或卷标语法不正确”，`cmd.exe` 仅保留为最终兜底
    - [x] 修复 Windows 11 实机通过 Windows Terminal 拉起 OAuth 登录时把 PowerShell 命令体误解析为启动程序的问题：Rust 桌面桥与 Python 兜底现在都直接启动 `powershell.exe -NoExit ... -Command ...`，不再经由 `wt.exe` 二次解析命令行
  - [x] 在当前桌面运行时保留 `pi` 检测与启动前安装链路作为 fallback：当未检测到 bundled/system `pi` 时，应用启动时优先展示安装引导，并在后台把 `pi` 托管到 app data 下的 `pi-runtime/`
  - [x] 将 `pi` 安装状态接入设置与诊断：展示命令来源、托管路径、npm 可用性、安装中状态与本地安装日志路径
  - [ ] 为 Windows 准备并验收可随包分发的 bundled `pi` 运行目录，确认 `pi.exe` 及其同目录运行时文件都能随包工作，而不是只复制单个可执行文件
    - [x] 修复 Windows 实机问题：安装包启动应用时会额外弹出一个终端窗口持续显示 FastAPI 后端日志；当前已改为 Windows 发布态隐藏后端控制台，并把后端输出落盘到 app data 下的 `logs/backend.log`
  - [ ] 为 Windows / macOS 分别准备并验收可随包分发的 `pi` 运行目录产物，确认 OAuth `/login`、RPC 与 extension 链路在 bundled 形态下正常；当前 macOS 本地 bundle 已验证，Windows 与跨平台最终验收仍待完成
    - [x] 修复 Windows 实机问题：在配置 Pi 模型并尝试打开 Pi CLI 时，终端报错 `'\\\\?\\D:\\Program Files\\gogo-app\\' CMD 不支持将 UNC 路径作为当前目录。无法打开 pi agent。`；当前已在 Windows shell 桥中去除 `\\?\\` / `\\?\\UNC\\` verbatim 前缀，并统一用于 `cmd.exe` 与 `explorer` 入口，确保安装目录和空格路径可正常工作
  - [ ] macOS bundled `pi` 不可直接裸分发：需要作为 `gogo-app.app` 的内嵌运行时一起签名，并纳入整包 notarization 验收
  - [ ] 把当前启动前安装链路继续前移到真正的安装器/首次启动向导，做到 bundled `pi` 缺失时普通用户也无需等待应用启动后再补装
  - [x] 确保发布态应用能够正确定位 bundle 内的后端资源，并把默认 knowledge-base、session 与 Pi extension 等可写状态收口到 app data 目录
    - [x] 修复 Windows NSIS 安装包启动只闪现命令行后立即退出的问题：根因是安装产物缺失 `app/` 前端资源与可执行的 bundled backend launcher；当前 `desktop:build` 会显式生成 Tauri bundle resource 清单，并在 Windows 下把 sidecar `gogo-backend.exe` 与 `backend-runtime/` 一起打包，应用启动时会先把 bundle 内的后端 runtime 物化到 app data 再拉起
    - [x] 修复 Windows 安装版闪退缺少主进程日志的问题：Tauri 启动日志现在写入 `%TEMP%\gogo-app-desktop-startup.log`，已用临时安装目录验证发布态能走到 `setup: main window built`
    - [x] 修复 Windows 安装版首次欢迎页关闭后再次启动闪退的问题：启动器现在会复用 app data 下已完整物化的 `bundled-resources/backend-runtime`，避免第二次启动继续覆盖 `.pyd` 等运行库文件导致 Tauri setup hook panic
    - [x] 修复 Windows 发布态启动时额外出现终端窗口的问题：release 版 Tauri 主程序已声明为 Windows GUI subsystem；后端子进程继续使用 `CREATE_NO_WINDOW`，关掉终端不应再连带关闭桌面端
    - [x] 修复 Windows app data 下 `logs/backend.log` 无法打开时启动闪退的问题：后端日志文件不可写时不再让 setup hook 失败，而是丢弃后端 stdout/stderr 并继续启动
  - [x] 收敛桌面资源 staging 目录：当前构建链与 `.gitignore` 已统一以 `src-tauri/desktop-runtime-staging/` 作为唯一有效资源输入，旧 `desktop-runtime/` 只保留为历史遗留目录
    - [x] 修复 Windows `desktop:dev` 被发布态 staging 资源阻塞的问题：基础 `src-tauri/tauri.conf.json` 不再静态声明 `desktop-runtime-staging/backend` 等 `bundle.resources`，资源清单改为仅由 `desktop:build` 生成临时 Tauri 配置写入
  - [ ] 明确并接入 Windows 代码签名
  - [ ] 明确并接入 macOS Developer ID 签名与 notarization

#### 4.3 Phase 3: 首次启动引导、模型配置与本地诊断

- [x] 补齐首次启动引导与安装后诊断
  - [x] 发布时序说明：4.3 不阻塞“内部打包验证”，但应阻塞“面向普通用户的候选发布包”
  - [x] 实现首次启动向导，按既定主路径串起 `pi` 安装/检测、模型配置、进入 companion knowledge-base 和完整工作流入口
  - [x] 把“API key 可跳过，但仍可浏览 Wiki”做成清晰分支，而不是报错中断
  - [x] 实现模型配置入口，覆盖 API key 型 provider 与首发承诺范围内的 Pi OAuth
  - [x] 在应用内增加环境自检：knowledge-base 目录结构、`pi` 是否可执行、后端是否启动成功、模型配置是否完整
  - [x] 为常见失败场景提供面向普通用户的错误提示与下一步建议，而不是只暴露底层报错
  - [x] 提供“查看诊断信息 / 打开日志目录 / 导出诊断摘要”等入口，且默认只做本地保存

#### 4.4 Phase 4: 首发能力闭环

- [x] 围绕首发最低成功标准打通完整任务链
  - [x] 上传文件
  - [x] ingest
  - [x] 聊天
  - [x] 写回 Wiki
  - [x] 验证 companion knowledge-base 和用户自有 knowledge-base 两条路径都可跑通
  - [x] 验证“已配置模型”和“未配置模型但先浏览 Wiki”两种首屏路径都成立
  - [x] 补齐首发前的最小安全约束，降低 `pi` 直接执行 bash / 写文件时的宿主机风险
    - [x] 设计并落地用户可见的安全模式总开关：
      - [x] `只读模式`：允许聊天、读文件、搜索，禁止 `write` / `edit` / `bash`
      - [x] `允许写文件`：允许 `write` / `edit`，但禁止 `bash`
      - [x] `允许执行命令`：允许 `write` / `edit` / `bash`，但仍默认阻断明显危险命令
    - [x] 明确并固化默认工作区边界：
      - [x] 默认以当前 knowledge-base 目录作为 `pi` workdir
      - [x] 当前首发版本仅信任当前 knowledge-base，不允许 agent 自由漂移到任意目录
      - [x] 在 diagnostics / 设置中显示当前受信任工作区范围，方便用户理解边界
    - [x] 基于 `pi` extension 机制实现一层 managed security extension，拦截 `tool_call`
      - [x] 优先覆盖 `bash`
      - [x] 覆盖 `write` / `edit`
      - [x] extension 由 `gogo-app` 托管生成与更新，不要求用户手工维护
    - [x] 为明显危险命令建立默认阻断规则
      - [x] 直接阻断高风险模式，例如 `sudo`、`rm -rf /`、`rm -rf ~`、磁盘格式化、系统服务命令等
      - [x] 用可维护规则表统一管理，而不是把判断散落在 UI / 后端多处
      - [x] 在被阻断时向用户明确说明“为什么被阻断”
    - [x] 增加 bash / 写文件操作的完整日志与可见提示
      - [x] 记录时间、session、tool、目标路径/命令、判定结果（allow / block）
      - [x] 在聊天工作日志 / trace 中明确显示“安全限制已阻止：...”
      - [x] 日志只保存在本地，不自动上传
    - [x] 为首发建立一份“最小安全边界”文档
      - [x] 明确当前不是强沙箱，不承诺容器级隔离
      - [x] 明确当前默认限制与用户可调整项
      - [x] 把“容器化执行 / 更强沙箱”列为后续增强项，而不是首发阻塞项
    - 结论：当前版本已经具备首发可用的“最小安全约束”闭环。Pi RPC 进程会自动加载 gogo-app 托管的 `managed-security.ts`；默认安全模式为“允许写文件”，允许在当前 knowledge-base 内执行 `write/edit`，默认禁止 `bash`，并持续阻断 `sudo`、删根目录、磁盘格式化等明显危险命令。所有 `bash/write/edit` 的 allow/block 决策都会写入本地安全日志，并在聊天工作台中提供内联审批浮层，支持对当前工具调用直接批准或禁止，并把禁止理由继续 steer 给 Pi；当前模式、受信任工作区、日志路径与最近审计记录也可在应用内查看。

#### 4.5 Phase 5: 跨平台兼容与干净机器验收

- [ ] 建立干净机器回归流程
  - [ ] 至少准备一台未配置开发环境的 Windows 与一台未配置开发环境的 macOS 作为验收环境
  - [ ] 每次候选发布都完整走一遍下载、安装、首次启动、示例知识库接入、模型配置、Pi 登录/授权、核心功能 smoke test
  - [ ] 把中文路径与带空格路径列为首发阻塞项，必须完成验收
  - [ ] 明确回归清单与通过标准，避免只在开发机上验证
  - [ ] 记录平台特有问题与临时绕过方式，反向驱动安装文档和产品改进

#### 4.6 Phase 6: 对外文档与支持入口

- [ ] 更新一套真正面向外部用户的文档
  - [ ] 重写仓库 README，使其先讲“这是什么、适合谁、安装后第一步是什么、如何最快跑通 demo”
  - [ ] 新增安装指南，覆盖 Windows / macOS 安装器、companion knowledge-base 路径选择、`pi` 静默安装与模型配置
  - [ ] 新增快速开始文档，围绕 companion knowledge-base 给出一条 5 分钟内能跑通的最短体验路径
  - [ ] 新增 FAQ / 故障排查文档，覆盖 knowledge-base、`pi`、Provider、权限、中文路径与空格路径问题
  - [ ] 新增平台差异说明，明确 Windows / macOS 的行为差异、限制与权限要求
  - [ ] 在所有对外文档中统一写明：正式支持渠道是 GitHub Issues

#### 4.7 Phase 7: 开源基础设施与发布流程

- [ ] 补齐开源项目基础设施
  - [ ] 新增 `LICENSE`
  - [ ] 新增 `CONTRIBUTING.md`
  - [ ] 新增 `CODE_OF_CONDUCT.md`
  - [ ] 补充 issue 模板，尤其是安装失败、模型配置失败、路径兼容问题、写回问题等模板
  - [x] 明确 `gogo-app` 与 companion `knowledge-base` 的仓库关系、许可边界与推荐协作方式：两者都开源；companion knowledge-base 作为随安装包提供的示例知识库，与 `gogo-app` 一起构成首发体验

- [ ] 最后补齐发布自动化
  - [ ] 明确版本号策略、release checklist 与 changelog / release notes 模板
  - [ ] 评估并接入最小 CI：基础检查、构建验证、关键 smoke test
  - [ ] 评估并接入自动化构建桌面产物的流程，减少手工发版步骤
  - [ ] 明确哪些步骤必须人工确认，哪些步骤可以自动化，避免把不稳定链路过早全自动化

### 5. Backlog

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
| 2026-04-24 | 修复 Windows 10/11 启动时多出终端窗口且关终端会关闭桌面端的问题：release 版 Tauri 主程序现在使用 Windows GUI subsystem；同时后端日志打开失败不再导致 setup panic，`backend.log` 不可写时会降级为 null stdout/stderr |
| 2026-04-24 | 修复 Windows 11 OAuth 登录终端报错 `0x80070002`：另一台设备上 Windows Terminal 会把 `& 'C:\Program Files\gogo-app\pi-runtime\pi.exe'` 这段 PowerShell 命令体误当成要启动的程序，导致“系统找不到指定的文件”。当前 Rust 桌面桥与 Python 兜底均改为直接启动 PowerShell，`cmd.exe` 只作最终兜底 |
| 2026-04-24 | 修复 Windows 安装版首次启动后再次打开闪退：`%TEMP%\gogo-app-desktop-startup.log` 显示第二次启动在复制 `backend-runtime/_internal/httptools/parser/*.pyd` 到 app data 时失败并触发 setup panic；当前桌面启动器会先检查 app data 下已物化的 `bundled-resources/backend-runtime` 是否完整，完整则直接复用，只有半成品目录才清理后重建，避免关闭欢迎页后再次打开只闪黑框 |
| 2026-04-24 | 修复 Windows 安装后 `gogo-app` 只闪一下的问题排查链路：确认生成的 setup.exe payload 可正常解包，发现历史安装路径 `D:\Program Files\gogo-app` 为空且 NSIS 会恢复上一次安装位置；当前已将 NSIS `installMode` 改为 `both`，让安装器明确区分当前用户/所有用户安装，并把 Tauri 主进程启动日志改写到 `%TEMP%\gogo-app-desktop-startup.log`。重新 `desktop:build` 后，临时安装目录冒烟通过，日志出现 `setup: main window built` |
| 2026-04-24 | 修复 Windows 开发态 OAuth 登录提示“当前开发态兜底登录只实现了 macOS”：`POST /api/settings/pi-login` 在 Tauri 桥不可用时，Python 后端现在会打开 PowerShell 并运行当前检测到的 `pi`，同时保留路径前缀清洗和 managed provider extension 参数；后续发现 Python 参数数组会触发 `cmd.exe` 报“文件名、目录名或卷标语法不正确”，且 `cmd.exe` 下 Pi CLI 菜单残影明显，已将 Python 兜底与 Rust 桌面桥都改为优先 PowerShell，`cmd.exe` 仅作最终兜底 |
| 2026-04-24 | 修复 Windows `npm run desktop:dev` 被发布态 staging 资源校验阻塞的问题：基础 `src-tauri/tauri.conf.json` 不再静态声明 `desktop-runtime-staging/backend` / `pi` resources，发布包资源清单继续由 `desktop:build` 生成临时 Tauri 配置写入；同步更新桌面打包指南与回归记录 |
| 2026-04-24 | 新增 `docs/workspace-and-agent-runtime-refactor-plan.md`，记录两条下一阶段结构性重构：内容工作区抽象，以及“ACP 外接 agent + bundled Pi fallback”的 Agent runtime 抽象；同步补充 `docs/index.md` 与 `TASKS.md` |
| 2026-04-23 | 将一组新的工作台交互改动加入任务列表：模式切换不自动弹出 Chat/Wiki、三类浮窗支持点外收起、Chat 底部工具栏遮挡与命令菜单样式优化、Wiki 可见 Inbox、Wiki 支持新建 `.md` 文件 |
| 2026-04-18 | 修复 Windows 安装版启动闪退：定位到 NSIS 安装产物缺失 `app/` 前端资源与可执行的 bundled backend launcher，导致已安装应用只弹出命令行窗口后立即退出；当前已把 `desktop:build` 改为显式生成 Tauri resource 清单，随包分发 `app/`、`backend-runtime/` 与 Windows sidecar `gogo-backend.exe`，并在启动时把 bundle 内后端 runtime 物化到 app data 后再启动，已在本机安装版验证可正常打开 `gogo-app` 主窗口 |
| 2026-04-18 | 修复两条 Windows 打包态实机问题：1）Tauri 桌面版在 Windows 下启动 FastAPI 后端时不再继承控制台，而是隐藏子进程窗口并把日志落盘到 app data 下的 `logs/backend.log`；2）Pi 登录桥在调用 `cmd.exe` / `explorer` 前会清洗 `\\?\\` 与 `\\?\\UNC\\` 路径前缀，修复安装目录位于 `Program Files` 时无法打开 `pi` 终端的问题 |
| 2026-04-18 | 扩展仓库 `.gitignore` 的 Windows / 本地环境忽略规则：补充 `.vs/`、`Thumbs.db`、`Desktop.ini`、`*.lnk`、`*.stackdump`、`pip-wheel-metadata/` 等本地噪音文件，降低 macOS / Windows 跨平台协作时的误提交风险 |
| 2026-04-18 | 补充两条 Windows 实机问题记录：1）安装包启动应用时会额外弹出终端并持续显示 FastAPI 后端日志，和 macOS 当前体验不一致；2）配置 Pi 模型时终端报错 `'\\\\?\\D:\\Program Files\\gogo-app\\' CMD 不支持将 UNC 路径作为当前目录。无法打开 pi agent。`，需修复 Windows 下安装目录路径与 Pi 登录桥兼容性 |
| 2026-04-18 | Windows 桌面构建链路推进：补齐 `src-tauri/icons/icon.ico`，确认本机已装好 Rust / WebView2 / VS 2019 Build Tools，`desktop:build` 已能产出 `desktop-runtime-staging/backend/gogo-backend.exe`；同时修复 `scripts/desktop-build.mjs` 在 Windows 上直接 `spawn` 本地 `tauri.cmd` 导致的 `spawn EINVAL`，并将 Windows 首发安装介质从 `msi` 调整为 `NSIS setup.exe`。随后通过预置 NSIS 依赖缓存解决下载超时，已在本机成功产出 `src-tauri/target/release/bundle/nsis/gogo-app_0.1.0_x64-setup.exe` |
| 2026-04-16 | 完成一轮会话切换 / 启动恢复卡顿排查与性能优化：新增 `docs/session-performance-optimization-log.md`，并落地 app-turns 历史快路径、后台刷新 session detail、历史消息分批渲染 |
| 2026-04-16 | 完成 Tauri 第一阶段迁移，并清理旧 Electron 文档与过期任务说明：新增 `src-tauri/`、Tauri 后端启动器、桌面 bridge 与目录选择能力；同步 README / TASKS / docs 索引 |
| 2026-04-14 | 新增待排查问题：长回复可能被提前中断；`PiRpcClient.abort()` 与流式读取并发时出现 `read() called while another coroutine is already waiting for incoming data` |
| 2026-04-14 | 将无 session 单次聊天迁移到 `/api/legacy/chat` 与 `/api/legacy/chat/stream`，主 `/api/chat*` 收敛为 session-only；完成固定检索与 `consulted_pages` 评估：两者仅保留为 legacy no-session 兼容能力与应用层 UI 元数据 |
| 2026-04-14 | 完成 `_build_pi_prompt` history 注入评估：session 链路完全依赖 RPC 会话历史；无 session 单次聊天继续保留 prompt 级 history 兜底 |
| 2026-04-14 | 完成会话管理对齐 ChatGPT：草稿态 + 懒创建 + 会话列表 `...` 菜单 + 重命名 API + 删除语义收敛 |
| 2026-04-14 | 基于 `gogo-app / gogo-client / gogo-server / knowledge-base` 新划分，重拆任务归属 |
