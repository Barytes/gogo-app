# gogo-app 与 knowledge-base 边界说明

**最后更新**: 2026-04-14

## 1. 目标

本文档定义：

- `gogo-app` 负责什么
- `knowledge-base` 负责什么
- 两者如何协作

并作为架构导航入口，指向：

- [client-architecture.md](client-architecture.md)
- [server-architecture.md](server-architecture.md)
- [knowledge-base-capabilities.md](knowledge-base-capabilities.md)

## 2. 边界原则

`gogo-app` 是应用与交互层；`knowledge-base` 是内容与规范层。

- 应用层（gogo-app）：会话、页面/API、流式交互、前端体验、RPC 对接
- 规范层（knowledge-base）：目录约定、schema、写入规则、lint/校验规则、协作规范

## 3. 能力归属

### 3.1 gogo-app 提供

- Chat/Wiki/Raw 浏览与交互 UI
- FastAPI 路由与本地 API
- Pi RPC 会话管理与流式事件处理
- 会话持久化索引（`.gogo/pi-rpc-sessions/gogo-session-registry.json`）

### 3.2 knowledge-base 提供

- `raw/`、`wiki/` 内容存储
- 页面结构与 schema 规范
- 写回/更新/lint 的约束规则
- 面向多 agent 的统一协作约定

## 4. 协作方式

1. gogo-app 读取 `KNOWLEDGE_BASE_DIR` 指向的知识库内容。
2. 模型问答在 gogo-app 中执行（RPC-only）。
3. 内容层能力（写回、lint、规范约束）以 knowledge-base 规则为准。
4. 用户可替换任意 coding agent，仍遵循同一 knowledge-base 规范。

## 5. 设计决策（当前）

- gogo-app 不内置“知识写回实现体系”作为平台能力主线。
- 写回能力与规则归属 knowledge-base 侧，避免绑定单一应用。
- gogo-app 后续聚焦：体验、会话、检索与模型接入质量。

