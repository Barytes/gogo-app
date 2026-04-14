# Frontend Workbench Elements

**最后更新**: 2026-04-14

> 本文档说明 `gogo-app` 前端页面中各个主要元素的职责、状态来源与实现位置。  
> 目标不是解释后端 RPC，而是回答“页面上这个区域/按钮是干什么的、由谁实现、和谁联动”。

## 1. 相关文件

- `app/frontend/index.html`
  页面骨架，定义所有主要 DOM 节点和按钮。
- `app/frontend/assets/styles.css`
  负责布局、玻璃态视觉、聊天气泡、Wiki 面板、响应式与显隐状态样式。
- `app/frontend/assets/workbench.js`
  负责 `Wiki / Chat` 工作台模式切换，以及面板隐藏/显示状态。
- `app/frontend/assets/wiki.js`
  负责 Wiki/Raw 列表、页面详情、页内跳转、引用到聊天、Wiki 浏览历史。
- `app/frontend/assets/chat.js`
  负责会话管理、消息渲染、流式回复、思考过程、输入框与终止按钮。

## 2. 页面总结构

`index.html` 把整个前端分成 4 个区域：

1. `header.topbar`
   顶部模式切换栏，控制整个工作台是 `wiki` 布局还是 `chat` 布局。
2. `section.workbench-wiki`
   左侧知识浏览工作区，内部再分成目录栏和内容栏。
3. `section.unified-chat-panel`
   聊天工作区，内部再分成会话侧栏和聊天主区。
4. `div.floating-dock`
   某一侧面板被隐藏后，用浮动按钮重新打开。

`workbench.js` 不直接创建 DOM，而是通过给 `body` 切换类名来控制整体布局：

- `layout-wiki`
- `layout-chat`
- `chat-hidden`
- `wiki-hidden`

## 3. 顶部工作台元素

### 3.1 `#layout-mode-wiki`

- 功能：切换到以 Wiki 为主的双栏布局。
- 实现：`workbench.js` 中 `setLayout("wiki")`。
- 结果：
  `body` 加上 `layout-wiki`，并保证 Wiki 区可见。

### 3.2 `#layout-mode-chat`

- 功能：切换到以 Chat 为主的双栏布局。
- 实现：`workbench.js` 中 `setLayout("chat")`。
- 结果：
  `body` 加上 `layout-chat`，并保证 Chat 区可见。

### 3.3 `#show-wiki-panel` / `#show-chat-panel`

- 功能：当某一块在当前布局里被隐藏时，用浮动按钮恢复显示。
- 实现：`workbench.js` 的 `showWiki()` / `showChat()`。
- 样式：`styles.css` 中 `.floating-dock` 与 `.hidden`。

## 4. Wiki 区域元素

### 4.1 `#mode-wiki` / `#mode-raw`

- 功能：切换知识来源是结构化 `Wiki` 页面，还是原始 `Raw` 文件。
- 实现：`wiki.js` 中 `setMode()`、`fetchPages()`、`navigateToPage()`。
- 行为：
  - `Wiki` 模式默认打开 `index.md`
  - `Raw` 模式默认打开第一条 raw 文件

### 4.2 `#wiki-search`

- 功能：对当前来源下的列表做实时搜索。
- 实现：`wiki.js` 监听 `input` 事件后调用：
  - `/api/wiki/search`
  - `/api/raw/search`
- 结果：刷新 `#wiki-list` 的渲染内容。

### 4.3 `#wiki-list`

- 功能：显示 Wiki/Raw 页面目录。
- 实现：`wiki.js` 的 `groupPages()` 和 `renderList()`。
- 结构：
  - 按 `section` 分组
  - 每个条目是 `button.wiki-list-item`
  - 当前页会加 `.active`

### 4.4 `#toggle-wiki-sidebar-open` / `#toggle-wiki-sidebar-close`

- 功能：在 chat 布局下展开或收起 Wiki 目录栏。
- 实现：`wiki.js` 直接给 `.wiki-sidebar` 切换 `wiki-sidebar-visible`。
- 样式：`styles.css` 里 `body.layout-chat .workbench-wiki .wiki-sidebar`。

### 4.5 `#wiki-category`

- 功能：显示当前页面的来源、分类和路径。
- 数据来源：`wiki.js -> loadPage()`，格式类似：
  `wiki / insights / insights/xxx.md`
- 作用：让用户知道自己当前打开的是哪一类内容。

### 4.6 `#wiki-title`

- 功能：显示当前页面标题。
- 数据来源：`wiki.js -> loadPage()` 的 `data.title`。
- 近期实现：
  chat 布局下标题已经改成第二行横跨整行显示，避免被右侧按钮区挤压。

### 4.7 `#open-source-file`

- 功能：当当前内容是 raw 文件且后端提供 `download_url` 时，允许直接打开原文件。
- 实现：`wiki.js -> loadPage()` 中根据 `activeMode === "raw"` 动态显隐。
- 备注：
  对普通 markdown wiki 页面默认隐藏。

### 4.8 `#wiki-history-back` / `#wiki-history-forward`

- 功能：在 Wiki 面板内部做前进/后退，而不是依赖浏览器历史。
- 实现：
  - `wiki.js` 维护 `wikiBackHistory` 和 `wikiForwardHistory`
  - `navigateToPage()` 负责记录历史
  - `updateWikiHistoryButtons()` 控制禁用态

### 4.9 `#quote-into-chat`

- 功能：把当前 Wiki 页面作为引用提示注入聊天输入框。
- 实现：
  - `wiki.js` 触发 `window.dispatchEvent(new CustomEvent("wiki:quote"))`
  - `chat.js` 监听 `wiki:quote`，调用 `injectPrompt(...)`
- 联动：
  同时会让 Chat 面板可见并聚焦输入框。

### 4.10 `#wiki-content`

- 功能：展示当前页面正文。
- 实现：
  - markdown 页面：`wiki.js -> markdownToHtml()`
  - 文本 raw：渲染成 `<pre><code>`
  - pdf：嵌入 `<iframe>`
  - 二进制 raw：显示摘要信息
- 页内链接：
  `wiki.js -> resolveWorkbenchTarget()` 会把站内链接拦截成内部导航，继续在 Wiki 面板里打开，而不是整页跳转。

## 5. Chat 区域元素

### 5.1 `#session-sidebar`

- 功能：显示历史会话列表和新建按钮。
- 实现：`chat.js`
- 状态：
  - 是否折叠由 `SESSION_SIDEBAR_STORAGE_KEY` 持久化到 `localStorage`
  - 切换按钮为 `#toggle-session-sidebar` 和 `#toggle-session-sidebar-main`

### 5.2 `#new-session-button`

- 功能：进入草稿态，准备开始一个新问题。
- 实现：`chat.js -> enterDraftState()`
- 行为：
  - 不立即请求后端建会话
  - 真正发送第一条消息时才创建 session

### 5.3 `#session-list`

- 功能：显示全部历史会话。
- 实现：`chat.js -> fetchSessions()` 和 `renderSessionList()`
- 每个会话条目包含：
  - 主按钮：切换到该会话
  - 更多菜单按钮：展开重命名/删除操作
- 近期实现：
  在 `wiki` 布局中，点击会话后会自动收起侧栏，回到聊天主区域。

### 5.4 `#session-list-empty`

- 功能：当没有会话时显示占位文案。
- 实现：`renderSessionList()` 根据 `sessions.length` 控制 `.hidden`。

### 5.5 `#messages`

- 功能：聊天消息流容器。
- 实现：
  - 静态消息：`appendMessage()`
  - 流式消息：`createStreamingAssistantMessage()`
- 特点：
  - 只在用户接近底部时自动吸底
  - 手动上滑看历史时，不会被流式回复强制拉回底部
  - 会缓存每个 session 当前已渲染节点，切会话再切回来能直接恢复视图

### 5.6 消息气泡

- 用户消息：`.message-user`
- 助手消息：`.message-assistant`
- 共同实现：`chat.js -> renderMessageBody()`
- 样式：`styles.css` 中 `.message-*`、`.message-body`、`.message-meta`

助手消息支持的展示能力：

- 标题、列表、引用、代码块
- Markdown 链接
- 指向 Wiki 的站内链接自动拦截到右侧 Wiki 面板
- 裸文本形式的 `wiki/...md` 路径自动转链接
- 行内代码形式的 `wiki/...md` 路径也会转成可点击 Wiki 链接

### 5.7 “思考过程”区域

- 容器：`details.message-trace`
- 功能：展示流式 trace、状态、工具调用和 warnings。
- 实现：
  - `renderTrace()`
  - `createWorklogGroup()`
  - `createWorklogNote()`
  - `createStreamingThinkingNote()`
- 当前展示方式：
  - 工具调用会按动作分组
  - 不只显示 `read/bash` 名称，也会显示具体文件或命令摘要

### 5.8 `#chat-input`

- 功能：主输入框。
- 行为：
  - `Enter` 发送
  - `Shift+Enter` 换行
  - Pi 回复中仍允许继续输入草稿
- 联动：
  - `wiki:quote` 会向这里注入引用提示
  - `focusChatInput()` 会自动把 Chat 面板显出来并聚焦
  - 当前前端发送前会先懒创建 session，因此不会直接走无 session 单次聊天入口

### 5.9 `button[type="submit"]` / `.chat-submit-button`

- 功能：发送或终止回复。
- 状态由 `chat.js -> setChatPending()` 控制：
  - 空闲时是发送按钮 `↑`
  - 当前会话正在回复时切成终止按钮 `■`
- 终止实现：
  `chat.js -> abortCurrentReply()` 调用 `/api/sessions/{session_id}/abort`

### 5.10 `#hide-chat-panel`

- 功能：在 `wiki` 布局中隐藏 chat 浮窗。
- 实现：`workbench.js -> hideChat()`

## 6. 跨模块桥接对象

前端没有引入框架，因此模块协作主要靠 `window` 上的桥接对象与自定义事件。

### 6.1 `window.WorkbenchUI`

- 定义位置：`workbench.js`
- 作用：统一管理工作台布局显隐
- 主要方法：
  - `getState()`
  - `setLayout()`
  - `showChat()` / `hideChat()`
  - `showWiki()` / `hideWiki()`
  - `ensureChatVisible()` / `ensureWikiVisible()`

### 6.2 `window.WikiWorkbench`

- 定义位置：`wiki.js`
- 作用：让聊天区和其他模块可以直接要求 Wiki 打开某一页
- 主要方法：
  - `openPage(path, source)`
  - `showSidebar()`
  - `hideSidebar()`

### 6.3 `window.ChatWorkbench`

- 定义位置：`chat.js`
- 作用：让 Wiki 区可以要求 Chat 面板聚焦或注入 prompt
- 主要方法：
  - `focusInput()`
  - `injectPrompt(text, replace)`

### 6.4 `wiki:quote` 自定义事件

- 发送方：`wiki.js`
- 接收方：`chat.js`
- 用途：把当前 Wiki 页面转成一个聊天提示上下文，而不是直接写死模块依赖。

## 7. 前端状态存放位置

### 7.1 `localStorage`

- `research-kb-workbench-layout`
  保存当前是 `wiki` 还是 `chat` 布局，以及某块面板是否被隐藏。
- `gogo:session-sidebar-collapsed`
  保存聊天会话侧栏是否折叠。
- `gogo:last-active-session-id`
  保存最近一次打开的会话。

### 7.2 内存状态

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

## 8. 样式层的职责

`styles.css` 主要承担 4 类职责：

1. 设计 token
   颜色、圆角、字体、阴影都放在 `:root` 变量里。
2. 全局布局
   如 `.site-shell`、`.workbench-grid`、`.workbench-wiki`。
3. 组件样式
   如 `.button`、`.wiki-list-item`、`.message-body`、`.trace-worklog`。
4. 状态样式
   如 `.hidden`、`.active`、`.pending`、`body.layout-chat`、`body.session-sidebar-collapsed`。

也就是说，JS 主要负责改状态，CSS 主要负责把状态翻译成界面。

## 9. 典型交互链路

### 9.1 打开一个 Wiki 页面

1. 用户点击 `#wiki-list` 条目或聊天中的站内链接
2. `wiki.js -> navigateToPage()`
3. `loadPage()` 拉取详情接口
4. 更新：
   - `#wiki-category`
   - `#wiki-title`
   - `#wiki-content`
   - Wiki 浏览历史按钮

### 9.2 从 Wiki 引用到聊天

1. 用户点击 `#quote-into-chat`
2. `wiki.js` 派发 `wiki:quote`
3. `chat.js` 收到事件，把提示写入 `#chat-input`
4. `WorkbenchUI.ensureChatVisible()` 保证聊天面板可见

### 9.3 发送并流式接收 Pi 回复

1. 用户在 `#chat-input` 输入并发送
2. `chat.js -> sendMessage()`
3. 若当前还没有 session，则先创建 session
4. 前端创建一个流式助手消息占位
5. `POST /api/chat/stream`（session-only）按 NDJSON 持续返回：
   - `context`
   - `trace`
   - `thinking_delta`
   - `text_delta`
   - `final`
6. 前端分别更新：
   - 正文内容
   - 思考过程
   - consulted pages
   - warnings

### 9.4 终止回复

1. 当前会话 pending 时，发送按钮切成 `■`
2. 用户点击后调用 `abortCurrentReply()`
3. 请求后端 abort API
4. 前端保留已经生成的部分文本，并把按钮恢复成发送态

## 10. 阅读前端代码的建议顺序

如果要快速熟悉这个前端，建议按下面顺序读：

1. `index.html`
   先搞清楚页面上到底有哪些区域和按钮。
2. `workbench.js`
   先理解全局布局与显隐状态。
3. `wiki.js`
   再理解知识浏览区。
4. `chat.js`
   最后看聊天区，因为它状态更多、流式链路更长。
5. `styles.css`
   在理解结构之后，再回头看样式状态会更容易。
