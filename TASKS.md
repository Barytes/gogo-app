# gogo-app 任务列表

> 本文档描述当前代码实现状态，并维护一份任务列表追踪与 [client-architecture.md](docs/client-architecture.md) 和 [server-architecture.md](docs/server-architecture.md) 的差距。

**最后更新**: 2026-04-14

---

## 代码现状

### 已完成功能

#### 后端 (FastAPI)

| 模块 | 文件 | 状态 |
|------|------|------|
| 配置管理 | `app/backend/config.py` | ✅ 基础配置（KNOWLEDGE_BASE_DIR, PI 相关配置） |
| 主入口 | `app/backend/main.py` | ✅ 页面路由、Wiki/Raw API、Chat API |
| Wiki 服务 | `app/backend/wiki_service.py` | ✅ 列表、搜索、详情、树结构 |
| Raw 服务 | `app/backend/raw_service.py` | ✅ 列表、搜索、详情、PDF 预览 |
| Agent 服务 | `app/backend/agent_service.py` | ✅ Pi RPC 主链路、流式聊天 |
| Session 管理 | `app/backend/session_manager.py` | ✅ RPC 会话生命周期、历史恢复、空闲回收 |
| Pi RPC Client | `app/backend/pi_rpc_client.py` | ✅ RPC JSONL 通信与命令封装 |

**相关架构文档**: [docs/agent-architecture.md](docs/agent-architecture.md)

#### 前端

| 模块 | 文件 | 状态 |
|------|------|------|
| 主页面 | `app/frontend/index.html` | ✅ 单页工作台布局 |
| 工作台控制 | `app/frontend/assets/workbench.js` | ✅ Wiki/Chat 模式切换、浮窗控制 |
| Wiki 浏览 | `app/frontend/assets/wiki.js` | ✅ 列表、搜索、详情、Markdown 渲染 |
| Chat | `app/frontend/assets/chat.js` | ✅ 流式消费、工作日志显示 |
| 样式 | `app/frontend/assets/styles.css` | ✅ 基础样式 |

#### API 路由

| 路由 | 状态 |
|------|------|
| `GET /` | ✅ 工作台首页 |
| `GET /chat` | ✅ Chat 模式 |
| `GET /wiki` | ✅ Wiki 模式 |
| `GET /api/health` | ✅ 健康检查 |
| `GET /api/chat/suggestions` | ✅ 建议问题 |
| `POST /api/chat` | ✅ 非流式聊天 |
| `POST /api/chat/stream` | ✅ 流式聊天 |
| `GET /api/sessions` | ✅ 会话列表 |
| `POST /api/sessions` | ✅ 创建会话 |
| `GET /api/sessions/{id}` | ✅ 会话详情 |
| `GET /api/sessions/{id}/history` | ✅ 会话历史恢复 |
| `DELETE /api/sessions/{id}` | ✅ 删除会话 |
| `POST /api/sessions/{id}/chat/stream` | ✅ 会话流式聊天（兼容入口） |
| `GET /api/wiki/pages` | ✅ Wiki 列表 |
| `GET /api/wiki/tree` | ✅ Wiki 树 |
| `GET /api/wiki/page` | ✅ Wiki 详情 |
| `GET /api/wiki/search` | ✅ Wiki 搜索 |
| `GET /api/raw/files` | ✅ Raw 列表 |
| `GET /api/raw/file` | ✅ Raw 详情 |
| `GET /api/raw/search` | ✅ Raw 搜索 |
| `GET /raw/file` | ✅ Raw 下载 |

---

## 任务列表

### 文档层级关系

```
product-definition-belief.md (核心目标和价值)
    ↓
client-architecture.md + server-architecture.md (架构设计)
    ↓
TASKS.md (任务列表 - 描述代码与架构的差距)
    ↓
代码实现
```

### 未完成功能

#### 0. 检查并优化 Agent 服务

对 `app/backend/agent_service.py`、`session_manager.py`、`pi_rpc_client.py` 进行全面优化。

- [x] **0.1 优化 Pi Agent System Prompt** ✅ 已完成
  - [x] 指引 Agent 阅读知识库的 `AGENTS.md`
  - [x] 设定人格和回答风格
  - [x] 移除冗余的系统提示词

- [x] **0.2 支持 Session 多会话管理（RPC 持久会话）** ✅ 已完成
  - [x] 创建 `app/backend/session_manager.py` 独立模块
  - [x] 实现 Session 池管理（创建、销毁、复用）
  - [x] 实现会话上下文复用（避免每条问题新建逻辑会话）
  - [x] 支持多个并发 session（多对话并行）
  - [x] 新增 `GET /api/sessions` 路由（获取会话列表）
  - [x] 新增 `POST /api/sessions` 路由（创建新会话）
  - [x] 新增 `DELETE /api/sessions/{id}` 路由（删除会话）
  - [x] 前端增加会话管理 UI（列表、新建、删除按钮）
  - [x] 前端增加会话切换功能

- [x] **0.2A Agent/Session 重构评估与迁移（Pi SDK 优先）** ✅ 已完成
  - [x] 输出评估文档：[docs/agent-session-refactor-assessment.md](docs/agent-session-refactor-assessment.md)
  - [x] 完成 Pi SDK 会话能力探针（见评估文档第 2 节）
  - [x] 输出两种最优重构方案并对比 pros/cons（完全重构 F vs 渐进重构 G）
  - [x] 明确迁移偏好：完全重构优先（见评估文档第 4、6、7 节）
  - [x] **里程碑 F1：RPC 基座接入（旁路，不切主流量）** ✅ 已完成
    - [x] 新建 Python RPC 客户端（严格 LF JSONL framing）
    - [x] 实现 `id` 关联的命令-响应通道
    - [x] 跑通 `get_state/prompt/abort` 最小命令集
    - [x] 增加并验证 RPC 后端开关（后续在 F5 收敛为 RPC-only）
    - [x] 验收：RPC 模式下可完成最小问答 + abort 生效
  - [x] **里程碑 F2：聊天主链路切换到 RPC** ✅ 已完成
    - [x] `agent_service.py` 切换 `/api/chat` 与 `/api/chat/stream` 到 RPC 执行器
    - [x] RPC 事件映射为现有前端事件类型（thinking/text/trace/final/error）
    - [x] 贯通 `request_id`，并对齐超时与错误文案
    - [x] 验收：现有前端不改交互即可稳定流式回复
  - [x] **里程碑 F3：多会话管理切到 RPC 会话机制** ✅ 已完成
    - [x] 在 Session 管理层接入 `new_session/switch_session/set_session_name/get_state`
    - [x] 保持 `/api/sessions` 返回结构兼容
    - [x] 完成会话并发互斥与 pending 状态一致性
    - [x] 验收：多会话创建/切换/独立上下文稳定可用
  - [x] **里程碑 F4：历史恢复切到 Pi 原生会话** ✅ 已完成
    - [x] `/api/sessions/{id}/history` 优先使用 RPC `get_messages`
    - [x] 增加离线场景下的原生 JSONL 读取恢复
    - [x] 前端保持现有 hydrate 流程，无感切换数据源
    - [x] 验收：刷新页面与后端重启后，历史可恢复
  - [x] **里程碑 F5：旧链路下线与收敛** ✅ 已完成
    - [x] 下线 `pi_sdk_bridge.mjs` 主调用路径
    - [x] 下线 `session_event_store/replay_history` 主路径并删除旧实现
    - [x] 清理遗留配置与死代码，更新相关文档
    - [x] 验收：默认链路不依赖 `.gogo-sessions` 主存储，关键场景回归通过

- [ ] **0.3 添加写回功能**
  - [ ] 创建 `app/backend/write_service.py`
  - [ ] 实现 `create_wiki_page()` 和 `create_insight_page()` 函数
  - [ ] 遵循 `schemas/ingest.md` 和 `schemas/insight.md` 格式
  - [ ] 自动维护 frontmatter（作者、时间、来源）
  - [ ] 追加日志到 `wiki/log.md`
  - [ ] 新增 `POST /api/write/wiki` 和 `POST /api/write/insight` 路由

- [ ] **0.4 设计 Tool 系统**（Skill 系统的基础）
  - [ ] 定义 Tool 接口规范（输入、输出、错误处理）
  - [ ] 实现基础 Tool 注册机制
  - [ ] 实现文件读取 Tool（已存在，需封装）
  - [ ] 实现文件写入 Tool（配合写回功能）
  - [ ] 实现搜索 Tool（封装 wiki/raw search）
  - [ ] 支持用户扩展自定义 Tool
  - [ ] 更新 RPC 链路的 Tool 注册与调用（不依赖 `pi_sdk_bridge.mjs`）

- [ ] **0.5 设计 Skill 系统**（在 Tool 之上编排任务流程）
  - [ ] 定义 Skill 接口规范
  - [ ] 实现 `ingest` Skill（材料摄取）— 编排 read/classify/write Tool
  - [ ] 实现 `query` Skill（本地查询）— 编排 search/read/answer Tool
  - [ ] 实现 `lint` Skill（清理检查）— 编排 scan/report Tool
  - [ ] 支持用户扩展自定义 Skill
  - [ ] 更新 RPC 链路支持 Skill 调用

- [ ] **0.6 支持 Model Provider 配置**
  - [ ] **能力边界（RPC 模式）**
    - [ ] 明确：RPC mode 不支持“运行时动态新增 provider”
    - [ ] RPC mode 仅支持对“已配置模型”做运行时操作：`set_model` / `cycle_model` / `get_available_models`
  - [ ] **Provider 配置方式（启动时）**
    - [ ] 方式 A：静态配置 `~/.pi/agent/models.json`（OpenAI 兼容 API，如 Ollama/vLLM/LM Studio）
    - [ ] 方式 B：通过 extension 的 `pi.registerProvider()` 注册 provider（支持 OAuth/非标准 API）
  - [ ] **gogo-app 实现任务**
    - [ ] 新增 `MODEL_NAME` 配置（用于选择已配置模型）
    - [ ] `MODEL_PROVIDER` 改为“provider 选择/约束”语义，不再描述为“动态添加 provider”
    - [ ] 保留 `PI_THINKING_LEVEL` 配置
    - [ ] 更新 `config.py`：读取并校验模型选择配置（provider/model）
    - [ ] 更新 RPC 链路：启动后调用 `get_available_models` 校验候选模型，再调用 `set_model` 切换
    - [ ] 更新文档：说明新增 provider 必须通过 `models.json` 或 `registerProvider()`，不能通过 RPC 命令直接添加
  - [ ] **验收标准**
    - [ ] 对未预配置 provider/model，后端返回明确错误提示（指导去改 `models.json` 或安装 extension）
    - [ ] 对已配置模型，可在 RPC 会话中稳定切换并生效

- [ ] **0.7 疑点：`_build_pi_prompt` 中的 history 处理**
  - [ ] **问题**：当前 `_build_pi_prompt()` 手动将最近 6 轮 history 附加到 prompt 中（`agent_service.py:54-59`）
  - [ ] **疑点**：RPC 会话链路已维护原生会话上下文，是否仍应在 prompt 层拼接最近 history？
  - [ ] **待确认**：是否可以移除手动 history 注入，改为依赖 RPC 会话自身历史（仅保留无 session 的兜底策略）？
  - [ ] **相关代码**：`session_manager.py` 的 `send_message()` / `send_message_async()` 当前已不使用 `history` 参数（`del history`）

- [ ] **0.8 移除固定检索和 consulted_pages 注入**
  - [ ] **当前设计**：
    ```python
    # agent_service.py: _prepare_rpc_request()
    wiki_hits, raw_hits = _collect_context(message)  # 固定检索 6+4
    consulted_pages = _build_consulted_pages(...)    # 构建引用列表
    prompt = _build_pi_prompt(..., wiki_hits, raw_hits)  # 注入 prompt
    payload = { prompt, consulted_pages }            # 传给 Pi
    ```
  - [ ] **问题**：
    1. 检索时机过早 — 在 Agent 有机会决定是否需要检索之前，就已经检索并注入了
    2. 检索策略固定 — limit=6+4 是硬编码的，无法根据问题类型调整
    3. 与 Tool 系统目标矛盾 — 如果 Agent 能自主调用检索工具，就不需要预先注入
  - [ ] **目标设计**：
    - 由 Agent 按照 `schemas/query.md`（待创建）自行决定是否需要检索、检索什么、检索多少
    - RPC 工具链需要确保检索 Tool 被正确封装和注册
    - 移除 `_collect_context()` 的自动调用，改为 Tool 形式供 Agent 调用
  - [ ] **需要修改的代码**：
    - [ ] `agent_service.py`: 移除 `_collect_context()` 在 `_prepare_rpc_request()` 中的调用
    - [ ] `agent_service.py`: 移除 `_build_pi_prompt()` 中的 `wiki_hits` 和 `raw_hits` 参数
    - [ ] `agent_service.py`: 移除 `consulted_pages` 的构建和传递
    - [ ] `wiki_service.py`: 封装 `search_pages()` 为 Tool 接口
    - [ ] `raw_service.py`: 封装 `search_raw_files()` 为 Tool 接口
    - [ ] `pi_rpc_client.py` + RPC 扩展链路：确保检索 Tool 对 Agent 可见并可调用
  - [ ] **过渡期考虑**：
    - 当前 Pi RPC 扩展链路的 Tool 注册方式需要确认
    - 如果 Tool 系统尚未就绪，可以先保留固定检索作为 fallback

---

#### 1. 双层知识库支持

当前代码使用单层 `KNOWLEDGE_BASE_DIR`，需要支持 `personal-wiki/` + `public-pool/` 双层结构。

- [ ] **1.1 配置扩展**
  - [ ] 新增 `PERSONAL_WIKI_DIR` 环境变量
  - [ ] 新增 `PUBLIC_POOL_DIR` 配置
  - [ ] 新增 `PUBLIC_POOL_REMOTE` 和 `PENDING_POOL_REMOTE` 配置
  - [ ] 新增用户身份配置 `USER_ID` 和 `USER_NAME`
  - [ ] 新增 Sync 策略配置 (`AUTO_SYNC_ENABLED`, `SYNC_FREQUENCY` 等)

- [ ] **1.2 Wiki 服务改造**
  - [ ] `wiki_service.py` 支持双层检索（个人 wiki 优先）
  - [ ] 检索结果标注来源（public vs personal）
  - [ ] `search_pages()` 支持多源合并和优先级排序

- [ ] **1.3 Agent 服务改造**
  - [ ] `_collect_context()` 实现双层检索逻辑
  - [ ] `_build_pi_system_prompt()` 增加来源优先级指导

#### 2. 知识写回功能

当前代码明确标注"read-only"，不支持写回。

- [ ] **2.1 Write Service**
  - [ ] 创建 `app/backend/write_service.py`
  - [ ] 实现 `create_wiki_page()` 函数
  - [ ] 实现 `create_insight_page()` 函数
  - [ ] 实现 `update_page_with_links()` 函数
  - [ ] 遵循 `schemas/ingest.md` 和 `schemas/insight.md` 格式
  - [ ] 自动维护 frontmatter（作者、时间、来源）
  - [ ] 追加日志到 `wiki/log.md`

- [ ] **2.2 Write API**
  - [ ] 新增 `POST /api/write/wiki` 路由
  - [ ] 新增 `POST /api/write/insight` 路由
  - [ ] 请求体包含页面内容、作者、来源等元数据

- [ ] **2.3 写回 UI**
  - [ ] Chat 消息增加"保存到知识库"按钮
  - [ ] 写回表单（选择路径、类型、标签）
  - [ ] 写回确认和反馈

#### 3. Git 同步功能

当前代码没有 Git 操作能力。

- [ ] **3.1 Git Sync Service**
  - [ ] 创建 `app/backend/git_sync_service.py`
  - [ ] 实现 `get_sync_status()` 函数
  - [ ] 实现 `pull_public_pool()` 函数
  - [ ] 实现 `push_to_pending_pool()` 函数
  - [ ] 实现 `get_contribution_queue()` 函数
  - [ ] 实现 `mark_for_contribution()` 函数
  - [ ] 管理 public-pool git submodule

- [ ] **3.2 Sync API**
  - [ ] 新增 `GET /api/sync/status` 路由
  - [ ] 新增 `POST /api/sync/pull` 路由
  - [ ] 新增 `POST /api/sync/push` 路由
  - [ ] 新增 `GET /api/sync/contributions` 路由

- [ ] **3.3 Sync UI**
  - [ ] 创建 `app/frontend/assets/sync.js`
  - [ ] Sync 状态栏（最后同步时间、待 push 数量）
  - [ ] 一键 sync 按钮
  - [ ] 贡献队列面板
  - [ ] 页面来源标注（public vs personal）

- [ ] **3.4 配置 UI**
  - [ ] 新增 `GET /api/config` 路由
  - [ ] 新增 `PUT /api/config` 路由
  - [ ] 配置编辑界面

#### 4. 贡献标记功能

- [ ] **4.1 贡献标记逻辑**
  - [ ] `agent_service.py` 实现 `should_suggest_contribution()`
  - [ ] `agent_service.py` 实现 `mark_for_contribution()`
  - [ ] 写回时自动/手动标记为可贡献

- [ ] **4.2 贡献队列 UI**
  - [ ] 列出待贡献页面
  - [ ] 选择要 push 的页面
  - [ ] 显示 push 历史

#### 5. 服务器端聚合脚本（独立仓库）

服务器端功能在单独的仓库中实现。

- [ ] **5.1 聚合主脚本**
  - [ ] 创建 `scripts/aggregate.py`
  - [ ] 实现 `scan_incoming()` 函数
  - [ ] 实现 `extract_metadata()` 函数
  - [ ] 实现 `find_similar_pages()` 函数（语义相似度）
  - [ ] 实现 `add_cross_links()` 函数
  - [ ] 实现 `process_aggregation()` 主流程

- [ ] **5.2 冲突检测脚本**
  - [ ] 创建 `scripts/tension_detector.py`
  - [ ] 实现 `extract_judgments()` 函数
  - [ ] 实现 `detect_contradiction()` 函数
  - [ ] 实现 `create_tension_page()` 函数

- [ ] **5.3 Index 生成脚本**
  - [ ] 创建 `scripts/index_generator.py`
  - [ ] 实现 `scan_all_pages()` 函数
  - [ ] 实现 `group_by_topic()` 函数
  - [ ] 实现 `generate_index_md()` 函数

- [ ] **5.4 聚合调度**
  - [ ] 创建 `aggregate.sh` 入口脚本
  - [ ] 配置 cron job（每周执行）
  - [ ] 日志输出到文件

---

## 任务优先级

| 优先级 | 功能 | 说明 |
|--------|------|------|
| P0 | 0. 检查并优化 Agent 服务 | Agent 是核心引擎，优先优化 |
| P0 | 0.2 Session 多会话管理 | 改善用户体验，支持多对话并行 |
| P0 | 双层知识库支持 | 联邦架构的基础 |
| P0 | 知识写回功能 | 核心价值"沉淀复利"的关键 |
| P1 | Git 同步功能 | 联邦架构的同步机制 |
| P1 | 贡献标记功能 | 降低贡献摩擦 |
| P2 | 服务器端聚合 | 可手动执行，自动化可延后 |

---

## 变更日志

| 日期 | 变更 | 影响的任务 |
|------|------|-----------|
| 2026-04-13 | 初始版本 | - |
| 2026-04-13 | 修改检索优先级为个人知识库优先 | 更新 1.2、1.3 任务描述 |
| 2026-04-13 | 新增任务 0：检查并优化 Agent 服务 | 新增 0.1-0.6 子任务 |
| 2026-04-13 | 完成任务 0.1：优化 Pi Agent System Prompt | 移除 read-only 限制，更新 agent-architecture.md |
| 2026-04-13 | 新增任务 0.7：Session 长连接和多会话管理 | 新增 session_manager.py 和会话管理 UI |
| 2026-04-13 | 任务 0.7 移动到 0.2 位置 | 重新编号后续任务（原 0.2-0.7 → 0.3-0.7） |
| 2026-04-13 | 合并任务 0.3 和 0.9 | 原 0.3「移除固定检索」和 0.9「consulted_pages 疑点」合并为新的 0.9，任务重新编号（原 0.4-0.7 → 0.3-0.6） |
| 2026-04-13 | 新增任务 0.8「history 处理疑点」 | 记录 `_build_pi_prompt` 中手动传递 history 与 Session 自动管理历史的疑问 |
| 2026-04-14 | 新增任务 0.2A（Agent/Session 重构评估） | 新增 `docs/agent-session-refactor-assessment.md` 并挂到任务 0 |
| 2026-04-14 | 完成 Pi SDK 会话能力探针并补充双方案评估 | 更新 `0.2A`：标记探针完成，新增完全重构优先结论 |
| 2026-04-14 | 制定方案 F 完全重构里程碑计划 | 在 `0.2A` 增加 F1-F5 可测试里程碑与分步实施清单 |
| 2026-04-14 | 执行完成 F1 里程碑 | 新增 `pi_rpc_client.py`、接入 RPC 旁路开关、完成最小命令集验证 |
| 2026-04-14 | 执行完成 F2 里程碑 | `/api/chat` 与 `/api/chat/stream` 主链路切换到 RPC，贯通 request_id，并统一超时/中断文案 |
| 2026-04-14 | 执行完成 F3 里程碑 | `session_manager.py` 切到 RPC 会话命令（new/switch/set_name/get_state）并实现会话单飞互斥 |
| 2026-04-14 | 执行完成 F4 里程碑 | `/api/sessions/{id}/history` 优先走 RPC `get_messages`，并支持 Pi 原生 JSONL 离线恢复与重启后会话恢复 |
| 2026-04-14 | 执行完成 F5 里程碑 | 删除 `pi_sdk_bridge.mjs` 与 `session_event_store.py`，Session 体系收敛到 RPC-only |
| 2026-04-14 | 更新 0.6 Model Provider 约束 | 明确 RPC 仅支持模型选择，不支持运行时新增 provider；补充 `models.json` / `registerProvider()` 两种配置路径 |
