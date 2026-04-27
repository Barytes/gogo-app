# 文档清理与覆盖性审计（2026-04-15）

**最后更新**: 2026-04-15

> 本文档记录本轮 `gogo-app` 文档清理任务的结论：  
> 哪些文档已经过时、这次修了什么、哪些代码实现此前缺少文档、以及当前仍保留的文档边界。

## 1. 审计范围

本轮对齐了这些代码与文档：

- `app/backend/main.py`
- `app/backend/config.py`
- `app/backend/session_manager.py`
- `app/backend/pi_rpc_client.py`
- `app/backend/agent_service.py`
- `app/frontend/index.html`
- `app/frontend/assets/workbench.js`
- `app/frontend/assets/wiki.js`
- `app/frontend/assets/chat.js`
- `app/frontend/assets/styles.css`

对应重点文档：

- `docs/frontend-workbench-elements.md`
- `docs/session-management.md`

## 2. 本轮发现的过时文档

### 2.1 `frontend-workbench-elements.md`

过时点：

- 仍以旧版工作台元素说明为主
- 没有覆盖设置面板侧边栏分组
- 没有覆盖 Provider 设置、diagnostics、Inbox 浮窗、模型/思考切换
- 没有写清楚富历史恢复和“思考过程”恢复链路

处理结果：

- 已整篇重写，按当前页面结构重新整理

### 2.2 `session-management.md`

过时点：

- 历史恢复仍写成“RPC -> 原生 JSONL”双层
- 没写 `gogo-session-turns/*.jsonl`
- 没写富历史覆盖尾部、trace/warnings 恢复
- 没写 `PiRpcClient` 单 reader task 结构

处理结果：

- 已按当前真实实现重写

### 2.3 `agent-architecture.md`

过时点：

- 没写当前 Provider extension 托管架构
- 没写单 reader task + event queue 的 Pi RPC 客户端模型
- 没写 settings / diagnostics / runtime model 切换

处理结果：

- 已按当前真实实现重写

### 2.4 `gogo-app-architecture.md`

过时点：

- 对设置面板、Inbox、diagnostics、知识库切换等能力描述不足

处理结果：

- 已补充当前实现能力和职责边界

## 3. 本轮补上的“代码有、文档之前没写”的能力

### 3.1 设置面板

已补文档内容：

- 左侧分组导航
- 知识库设置
- Model Provider 配置
- diagnostics 分组

### 3.2 Inbox 工作流

已补文档内容：

- 上传到 `inbox/`
- 自动打开 Inbox
- 拖拽上传
- 删除 Inbox 文件
- `ingest` 按钮与聊天输入框联动

### 3.3 富历史恢复

已补文档内容：

- `gogo-session-turns/*.jsonl`
- `trace / warnings / consulted_pages`
- 刷新和切会话后的“思考过程”恢复逻辑

### 3.4 Provider / 认证架构

已补文档内容：

- `.gogo/pi-extensions/managed-providers.ts`
- `auth.json` 持续由 Pi 管理
- `desktop-pi-login` 与 `manual-tokens`
- 桌面版登录桥的预留接口

### 3.5 Diagnostics

已补文档内容：

- 知识库、session、Pi runtime、provider 的诊断字段
- `/api/settings/diagnostics` 的定位

## 4. `code-doc-mapping.md` 调整

本轮新增映射：


原因：

- 它已经不是纯概念文档，而是明显依赖 `index.html`、`workbench.js`、`chat.js`、`wiki.js`、`main.py`、`config.py` 的当前实现

## 5. 当前仍然保留的边界

以下内容仍不应在本轮强行补成“已实现文档”：

- 真正的桌面版 Pi CLI 登录桥
- Electron 主进程 / preload / IPC 代码
- 桌面版 Wiki Markdown 编辑模式
- 桌面版 slash 命令桥接

这些都仍然属于桌面版任务，而不是当前 Web 版实现。

## 6. 审计结论

本轮文档清理后，`gogo-app` 当前最核心的实现已经有文档覆盖：

- 前端工作台结构与主要元素
- Session 主链路与富历史恢复
- Agent / Pi RPC / Provider 运行时架构
- 应用层职责与边界

剩余待补的主要是未来桌面版实现文档，而不是当前 Web 版已经落地能力的说明缺口。
