# Frontend Workbench Elements

**最后更新**: 2026-04-18

> 本文档说明 `gogo-app` 前端页面中各个主要元素的职责、状态来源与实现位置。  
> 目标不是解释后端 RPC，而是回答“页面上这个区域/按钮是干什么的、由谁实现、和谁联动”。

## 1. 相关文件

- `app/frontend/index.html`
  页面骨架，定义工作台、设置面板、Inbox 面板和聊天控件的 DOM。
- `app/frontend/assets/styles.css`
  负责整体布局、面板显隐、设置面板侧边栏、消息样式和 Inbox 浮窗样式。
- `app/frontend/assets/workbench.js`
  负责 `Wiki / Chat` 工作台切换、知识库标题、设置面板和 diagnostics。
- `app/frontend/assets/wiki.js`
  负责 Wiki / Raw 列表、页面详情、页内跳转、引用到聊天、Wiki 浏览历史。
- `app/frontend/assets/chat.js`
  负责会话管理、消息渲染、流式回复、思考过程、模型/思考切换、上传与 Inbox。

## 2. 页面总结构

`index.html` 将页面分成 5 个主要区域：

1. `header.topbar`
   顶部工作台栏，展示当前知识库名称和设置入口。
2. `section.workbench-wiki`
   Wiki / Raw 浏览区，包含目录栏和内容栏。
3. `section.unified-chat-panel`
   聊天区，包含会话侧栏和聊天主区域。
4. `div.floating-dock`
   某侧面板被隐藏后，用浮动按钮重新打开。
5. `div.settings-overlay`
   设置面板遮罩层，内部是“左侧导航 + 右侧内容”的设置浮层。

`workbench.js` 通过给 `body` 切换类名控制整体布局：

- `layout-wiki`
- `layout-chat`
- `chat-hidden`
- `wiki-hidden`
- `session-sidebar-collapsed`

## 3. 顶部工作台元素

### 3.1 `#knowledge-base-name`

- 功能：显示当前连接的知识库名称，而不是固定写死标题。
- 数据来源：`GET /api/settings -> knowledge_base.name`
- 实现：`workbench.js -> renderKnowledgeBaseSettings()`

### 3.2 `#open-settings-panel`

- 功能：打开设置面板。
- 实现：`workbench.js -> openSettingsPanel()`
- 结果：
  会先刷新 `/api/settings`，再显示设置浮层。

### 3.3 `#layout-mode-wiki` / `#layout-mode-chat`

- 功能：切换工作台主布局。
- 实现：`workbench.js -> setLayout("wiki" | "chat")`

### 3.4 `#show-wiki-panel` / `#show-chat-panel`

- 功能：某一块在当前布局里被隐藏时，用浮动按钮恢复显示。
- 实现：`workbench.js -> showWiki() / showChat()`

## 4. 设置面板

设置面板已经不是“单页长滚动”，而是侧边栏分组结构。

### 4.1 左侧导航

- DOM：`[data-settings-section]`
- 当前分组：
  - `knowledge-base`
  - `current-skills`
  - `model-providers`
  - `diagnostics`
- 实现：`workbench.js -> setActiveSettingsSection()`

### 4.2 知识库设置区

主要元素：

- `#knowledge-base-path-input`
- `#pick-knowledge-base-path`
- `#apply-knowledge-base-path`
- `#knowledge-base-recent-list`
- `#knowledge-base-settings-feedback`

功能：

- 显示当前知识库路径
- 在桌面版运行时调用系统目录选择器
- 手动切换本地知识库目录
- 展示最近使用的知识库列表
- 显示切换成功/失败反馈

数据来源：

- `GET /api/settings`
- `PATCH /api/settings/knowledge-base`

桌面版适配：

- 如果存在 `window.GogoDesktop`，会显示“选择目录”按钮
- 当前桥接实现由 `app/frontend/assets/desktop-bridge.js` 提供
- Tauri 版会通过 `invoke("select_knowledge_base_directory")` 拉起原生目录选择器，再复用已有知识库切换 API

### 4.3 当前技能区

主要元素：

- `#capability-summary-chips`
- `#capability-list`
- `#create-skill-button`
- `#create-schema-button`
- `#refresh-capability-list`
- `#delete-capability-button`
- `#capability-editor-input`
- `#save-capability-button`
- `#reset-capability-button`

功能：

- 展示当前知识库识别到的 `skills` 与 `schemas`
- 按 `Skills / Schemas` 分组展示
- 支持直接新建一个最小模板的 `skill` 或 `schema`
- 同时展示并允许编辑这些能力相关的支持文件，例如 `skills/*/README.md`、`skills/*/AGENTS.md`、`schemas/**/README.md`、`schemas/**/AGENTS.md`
- 额外展示并允许编辑知识库根目录的 `AGENTS.md`
- 展示它们在 slash 自动补全里对应的命令名、类型和路径
- 允许直接编辑原始定义文本并写回知识库
- 支持删除当前选中的 `skill` 或 `schema`
- 保持和 Chat 输入框 slash 列表共用同一套能力目录

数据来源：

- `GET /api/knowledge-base/capabilities`
- `GET /api/knowledge-base/capability-file`
- `POST /api/knowledge-base/capability-file`
- `PATCH /api/knowledge-base/capability-file`
- `DELETE /api/knowledge-base/capability-file`

### 4.4 Model Provider 设置区

主要元素：

- `#provider-profile-list`
- `#provider-mode-api` / `#provider-mode-oauth`
- `#provider-key-input`
- `#provider-display-name-input`
- `#provider-oauth-preset-select`
- `#provider-auth-mode-select`
- `#provider-base-url-input`
- `#provider-api-type-select`
- `#provider-models-text`
- `#save-provider-button`
- `#provider-desktop-login-button`

功能：

- 列出当前 Provider profile
- 编辑 API / OAuth 两类 provider
- 在 OAuth provider 中区分：
  - `desktop-pi-login`
  - `manual-tokens`
- 保存、删除 provider 配置
- 为未来桌面版预留 `Pi 登录` 入口

数据来源：

- `GET /api/settings`
- `POST /api/settings/model-providers`
- `DELETE /api/settings/model-providers/{provider_key}`
- `POST /api/settings/pi-login`

`POST /api/settings/pi-login` 在桌面开发态也可通过后端直连兜底打开 macOS Terminal 或 Windows 终端；Windows 下优先直接启动 PowerShell，前端不需要区分 Tauri 桥与兜底路径。

### 4.5 Diagnostics 区

主要元素：

- `#security-mode-select`
- `#save-security-settings-button`
- `#open-security-log-button`
- `#refresh-diagnostics-button`
- `#diagnostics-status-chips`
- `#diagnostics-kb-list`
- `#diagnostics-pi-list`
- `#diagnostics-session-list`
- `#diagnostics-provider-list`
- `#diagnostics-security-list`
- `#diagnostics-security-events`

功能：

- 切换 Pi 安全模式（只读 / 允许写文件 / 允许执行命令）
- 展示当前受信任工作区、托管安全 extension 路径和安全日志路径
- 展示最近的 `bash / write / edit` allow / block 审计记录
- 展示知识库名称、路径和 `wiki/raw/inbox` 目录状态
- 展示 session namespace、session 目录、活跃会话数
- 展示 Pi 命令、命令路径、超时、工作目录、当前模型/思考
- 展示 provider profile 数量、默认 provider/model/thinking

数据来源：

- `GET /api/settings/diagnostics`
- `PATCH /api/settings/security`

## 5. Wiki 区域元素

### 5.1 `#mode-wiki` / `#mode-raw`

- 功能：切换结构化 `Wiki` 页面和原始 `Raw` 文件。
- 实现：`wiki.js -> setMode()`

### 5.2 `#wiki-search`

- 功能：搜索当前来源下的列表。
- 请求：
  - `/api/wiki/search`
  - `/api/raw/search`

### 5.3 `#wiki-list`

- 功能：展示 Wiki / Raw 条目列表。
- 实现：`wiki.js -> renderList()`
- 当前页条目会加 `.active`

### 5.4 `#toggle-wiki-sidebar-open` / `#toggle-wiki-sidebar-close`

- 功能：在 `chat` 布局下展开或收起 Wiki 目录栏。
- 实现：`wiki.js` 直接给侧栏切换显隐类。

### 5.5 `#wiki-category`

- 功能：显示当前页来源和相对路径。
- 示例：
  `wiki / insights/foo.md`

### 5.6 `#wiki-title`

- 功能：显示当前页标题。
- 近期实现：
  `chat` 布局下，标题改成独占第二行，真正使用到右侧按钮左边的整段宽度。

### 5.7 `#wiki-history-back` / `#wiki-history-forward`

- 功能：在 Wiki 面板内部做前进/后退。
- 实现：
  `wiki.js` 维护独立的 back / forward 栈，不依赖浏览器全局历史。

### 5.8 `#quote-into-chat`

- 功能：把当前 Wiki 页面作为引用提示注入聊天输入框。
- 联动：
  `wiki.js` 通过 `wiki:quote` 事件通知 `chat.js`

### 5.9 `#wiki-content`

- 功能：展示当前页正文。
- 页面类型：
  - markdown 页面
  - 文本 raw
  - PDF raw
  - 二进制 raw

页内链接行为：

- 站内 Wiki / Raw 链接会被拦截成工作台内部跳转
- 相对链接会按当前文件所在目录解析
- 聊天区传来的 `http://127.0.0.1:8000/knowledge/...`、`wiki/...md` 等内部路径也会在 Wiki 面板里打开

## 6. Chat 区域元素

### 6.1 `#session-sidebar`

- 功能：显示历史会话列表、新聊天入口和会话菜单。
- 实现：`chat.js`
- 持久化：
  `gogo:session-sidebar-collapsed`

### 6.2 `#new-session-button`

- 功能：进入草稿态。
- 行为：
  不立即建会话；发送第一条消息时才懒创建 session。

### 6.3 `#session-list`

- 功能：展示全部历史会话。
- 每项包含：
  - 主按钮：切换会话
  - `...`：展开重命名 / 删除
- 近期实现：
  在 `wiki` 布局的 chat 浮窗里，切会话后会自动收起会话侧栏。

### 6.4 `#messages`

- 功能：消息流容器。
- 实现：
  - 普通消息：`appendMessage()`
  - 流式消息：`createStreamingAssistantMessage()`
- 特点：
  - 启动时优先恢复会话列表与最近活跃会话，`Pi options / slash / inbox` 改成首帧后的后台预热，避免非关键请求挡住首屏
  - 长会话首屏只先恢复最近一页历史，若还有更早消息，则在聊天区顶部显示“加载更早消息”
  - 只在用户接近底部时自动吸底
  - 手动上滑时不强制拉回底部
  - 每个 session 都缓存当前已渲染节点，切回进行中的会话能继续看到实时视图
  - 历史恢复改成分批渲染，避免长会话在切换或启动恢复时一次性同步重排整段 DOM
  - assistant 消息里的 trace / 思考过程改成折叠时只显示 summary，首次展开时才真正创建内部 DOM
  - 流式 assistant 正文改成按帧合并 Markdown 渲染，而不是每个 delta 都立即整段重绘
  - 右侧问题导航会缓存问题 anchor，普通滚动时只更新高亮态，不再每次都重建整套导航 DOM

### 6.5 助手消息与“思考过程”

- 消息气泡：
  - 用户：`.message-user`
  - 助手：`.message-assistant`
- 富文本渲染：`renderMessageBody()`
- “思考过程”容器：`details.message-trace`

当前支持：

- 标题、列表、引用、代码块、链接
- 指向 Wiki 的内部链接直接打开右侧 Wiki 面板
- 裸文本或行内代码形式的 `wiki/...md` 自动转链接
- trace 中展示具体读取文件、搜索关键词、bash 命令摘要，而不只显示工具名
- 若 trace 表示“安全限制已阻止”，聊天区会弹出安全确认弹窗，显示命令/路径、是否可单次放行，以及把“禁止理由”直接继续 steer 给当前 Pi 会话

### 6.6 `#chat-input`

- 功能：主输入框。
- 行为：
  - `Enter` 发送
  - `Shift+Enter` 换行
  - 当前回复进行中也允许继续编辑草稿
  - 输入 `/` 时会拉起当前知识库 `skills + schemas` 的 slash 自动补全
  - 选中某个 slash 命令后，默认插入输入框草稿，不直接发送

### 6.7 发送 / 终止按钮

- DOM：`button[type="submit"]`
- 状态：
  - 空闲：发送 `↑`
  - 当前会话正在回复：终止 `■`
- 终止实现：
  `chat.js -> abortCurrentReply() -> POST /api/sessions/{id}/abort`

### 6.8 左下角控制区

主要元素：

- `#chat-upload-button`
- `#toggle-inbox-panel`
- `#chat-model-button`
- `#chat-thinking-button`
- `#chat-slash-button`
- `#chat-security-button`
- `#chat-settings-hint`
- `#chat-slash-panel`

当前行为补充：

- 安全模式入口已从 diagnostics 挪到聊天输入框按钮行，放在 `context window` 按钮旁边
- 安全模式菜单与模型 / 思考水平菜单共用同一套 `chat-control-button + chat-control-menu` 尺寸和交互
- 当 Pi 在当前模式下触发 `bash / write / edit` 阻断时，会拉起 `#chat-security-modal`
- 用户可以：
  - `允许这一次`：通过后端创建一次性审批，并在同一会话里要求 Pi 只重试这一个已批准操作
  - `禁止并告知 Pi`：输入理由后，前端会先终止当前回复，再把这段约束作为新的 user turn 继续推进任务

功能：

- 上传文件到当前知识库 `inbox/`
- 打开 `Inbox` 面板
- 切换当前模型
- 切换当前思考水平
- 打开当前知识库 `skills + schemas` 的 slash 命令面板
- 当当前模型不支持某个思考水平时，显示轻量提示

slash 面板当前会：

- 按 `Skills / Schemas` 分组
- 对每一项显示类型徽标
- 选择后把命令插入草稿，不直接执行

在 `wiki` 布局的 chat 浮窗中：

- 模型按钮和思考按钮会压缩成图标态
- 仍保留 `title` / `aria-label`，但不显示长文字，避免挡住发送按钮

### 6.9 Inbox 面板

主要元素：

- `#inbox-panel`
- `#close-inbox-panel`
- `#refresh-inbox-panel`
- `#ingest-inbox-panel`
- `#inbox-file-list`
- `#inbox-file-empty`

功能：

- 常驻显示当前知识库 `inbox/` 文件状态
- 上传成功后自动打开并高亮新文件
- 支持删除文件
- `ingest` 按钮会把“请 ingest 一下 inbox 的内容。”插入输入框

每个文件卡片展示：

- 文件名
- 类型
- 大小
- 更新时间
- 当前状态（如 `待 ingest`）
- 删除按钮

## 7. 跨模块桥接对象

### 7.1 `window.WorkbenchUI`

- 定义位置：`workbench.js`
- 作用：统一管理工作台布局显隐

### 7.2 `window.WikiWorkbench`

- 定义位置：`wiki.js`
- 作用：让聊天区或其他模块主动要求 Wiki 打开某一页

### 7.3 `window.ChatWorkbench`

- 定义位置：`chat.js`
- 作用：让 Wiki 区聚焦聊天输入框或注入 prompt

### 7.4 自定义事件

- `wiki:quote`
  把当前 Wiki 页面作为引用提示写入聊天输入框

## 8. 前端状态存放位置

### 8.1 `localStorage`

- `research-kb-workbench-layout`
  保存当前布局和面板隐藏状态。
- `gogo:session-sidebar-collapsed`
  保存会话侧栏是否折叠。
- `gogo:last-active-session-id`
  保存最近一次打开的会话。

### 8.2 内存状态

`wiki.js` 主要状态：

- `allPages`
- `activePath`
- `activePage`
- `activeMode`
- `wikiBackHistory`
- `wikiForwardHistory`

`chat.js` 主要状态：

- `currentSessionId`
- `sessions`
- `sessionHistories`
- `sessionViewNodes`
- `currentStreamingMessage`
- `pendingSessionIds`
- `abortingSessionIds`
- `hydratedSessionIds`
- `availableModels`
- `draftChatSettings`
- `inboxFiles`
- `inboxPanelOpen`
- `highlightedInboxPath`

`workbench.js` 主要状态：

- `workbenchState`
- `appSettings`
- `activeSettingsSection`
- `providerFormMode`
- `providerAuthMode`
- `diagnosticsState`

## 9. 样式层职责

`styles.css` 主要承担 5 类职责：

1. 设计 token
2. Wiki / Chat 双栏布局
3. 设置面板侧边栏与内容区
4. 聊天气泡、trace、模型按钮、停止按钮
5. Inbox 浮窗、拖拽高亮、文件卡片和响应式退化

## 10. 典型交互链路

### 10.1 切换知识库

1. 用户打开设置面板
2. 在“知识库”分组输入路径或点击最近项
3. `PATCH /api/settings/knowledge-base`
4. 后端切换知识库并 reset session pool
5. 前端刷新设置与会话/知识浏览状态

### 10.2 上传并 ingest Inbox

1. 用户点击 `+` 或把文件拖到 Inbox
2. `POST /api/knowledge-base/inbox/upload`
3. 前端自动刷新并打开 Inbox，高亮新文件
4. 用户点击 `ingest`
5. 提示词写入输入框，再由用户发送给 Pi

### 10.3 切换模型 / 思考

1. 前端先通过 `/api/pi/options` 读取当前模型状态和可用模型
2. 草稿态切换只更新本地 `draftChatSettings`
3. 已有会话切换会调用 `/api/sessions/{id}/settings`
4. 如果当前模型不支持所选思考水平，则弹轻量提示，不真正切换

### 10.4 会话刷新 / 切换后的“思考过程”恢复

1. 前端请求 `/api/sessions/{id}/history`
2. 后端优先返回带 `trace / warnings / consulted_pages` 的富历史
3. 前端据此分批重建消息和“思考过程”区域，而不是逐条同步插入
4. 切回进行中的会话时，若本地仍有流式视图缓存，则优先恢复实时视图
5. 切换会话时不再先阻塞等待额外的 session detail 请求；标题和元数据改为后台刷新，优先让历史消息先出现
