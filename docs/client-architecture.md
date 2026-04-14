# gogo-app Client Architecture

**最后更新**: 2026-04-14

> 本文档仅描述 gogo-app 客户端能力。  
> 与 knowledge-base 的边界见 [app-kb-boundary.md](app-kb-boundary.md)。  
> knowledge-base 能力见 [knowledge-base-capabilities.md](knowledge-base-capabilities.md)。

## 1. 范围

客户端负责交互体验与状态管理，不承载知识库规范定义。

## 2. UI 结构

- 单页应用（`app/frontend/index.html`）
- `Wiki` / `Chat` 双模式工作台
- 会话侧边栏（创建、切换、删除、pending 状态）

## 3. 核心脚本

- `app/frontend/assets/workbench.js`
  - 页面模式切换与布局控制
- `app/frontend/assets/wiki.js`
  - Wiki/Raw 列表、搜索、详情展示
- `app/frontend/assets/chat.js`
  - 聊天输入、流式事件消费、会话管理与历史 hydrate

## 4. 与后端的接口（客户端视角）

- 聊天：
  - `POST /api/chat`
  - `POST /api/chat/stream`
- 会话：
  - `GET /api/sessions`
  - `POST /api/sessions`
  - `DELETE /api/sessions/{id}`
  - `GET /api/sessions/{id}/history`
  - `POST /api/sessions/{id}/chat/stream`（兼容入口）
- 内容浏览：
  - `GET /api/wiki/*`
  - `GET /api/raw/*`
  - `GET /raw/file`

## 5. 非目标

以下不属于客户端架构职责：

- knowledge-base schema 制定与演进
- 写回规则定义
- lint 规范定义

这些由 knowledge-base 侧定义，客户端只负责消费与呈现。

