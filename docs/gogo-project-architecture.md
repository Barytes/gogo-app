# gogo 项目架构总览

**最后更新**: 2026-04-14

## 1. 目标

本文档从项目级视角定义 `gogo` 的四个核心部分：

- `gogo-app`
- `gogo-server`
- `gogo-client`
- `knowledge-base`

以及它们之间的边界与协作方式。

并作为架构导航入口，指向：

- [gogo-app-architecture.md](gogo-app-architecture.md)
- [gogo-client-architecture.md](gogo-client-architecture.md)
- [gogo-server-architecture.md](gogo-server-architecture.md)
- [knowledge-base-architecture.md](knowledge-base-architecture.md)

## 2. 项目分层

### 2.1 `gogo-app`

- 一个可直接使用的知识库产品
- 提供知识库浏览、Agent 对话、会话管理、模型接入
- 内置一个基础知识库，也可连接用户指定的 LLM Wiki / knowledge-base
- 目标是为用户提供开箱即用的 agentic knowledge base 服务

### 2.2 `gogo-server`

- 多用户公共知识库聚合端
- 承担公共池托管、聚合、同步入口等服务端职责
- 面向多个用户的知识库汇聚与公共知识沉淀

### 2.3 `gogo-client`

- 用户本地同步客户端
- 连接指定的 `gogo-server`
- 上传个人知识库贡献
- 下载 server 上的 `public-pool`

### 2.4 `knowledge-base`

- 内容与规范基础设施
- 保存 `raw/`、`wiki/` 等内容
- 定义 schema、写回规则、lint/校验规则与协作约束
- 不绑定某一个特定 agent 或某一个特定应用

## 3. 边界原则

- `gogo-app` / `gogo-client` / `gogo-server` 属于产品与系统层
- `knowledge-base` 属于内容与规范层
- 应用可以替换，但 knowledge-base 规范应尽量稳定
- 用户可以选择自己顺手的 coding agent，只要遵循同一 knowledge-base 规范即可协作

## 4. 能力归属

### 4.1 gogo-app 提供

- Chat/Wiki/Raw 浏览与交互 UI
- 本地 FastAPI 路由与应用 API
- Pi RPC 会话管理与流式事件处理
- 会话持久化索引（`.gogo/pi-rpc-sessions/gogo-session-registry.json`）

### 4.2 gogo-server 提供

- 公共池托管
- 多用户知识汇聚入口
- 聚合与发布流程
- 面向多个客户端的同步目标

### 4.3 gogo-client 提供

- 本地与远端 server 的连接能力
- 上传个人知识库内容
- 下载 `public-pool`
- 用户侧同步与本地集成体验

### 4.4 knowledge-base 提供

- `raw/`、`wiki/` 内容存储
- 页面结构与 schema 规范
- 写回/更新/lint 的约束规则
- 面向多 agent 的统一协作约定

## 5. 协作关系

1. `gogo-app` 读取 `KNOWLEDGE_BASE_DIR` 指向的知识库内容，为用户提供直接可用的交互式产品。
2. `gogo-client` 面向同步场景，把本地知识库与 `gogo-server` 连接起来。
3. `gogo-server` 承担多用户公共知识聚合与发布。
4. 内容层能力（写回、lint、规范约束）以 `knowledge-base` 规则为准。
5. 用户可替换任意 coding agent，仍遵循同一 knowledge-base 规范。

## 6. 当前设计决策

- gogo-app 不内置“知识写回实现体系”作为平台能力主线。
- 写回能力与规则归属 knowledge-base 侧，避免绑定单一应用。
- gogo-app 后续聚焦：体验、会话、检索与模型接入质量。
- `gogo-server` 与 `gogo-client` 是独立于 `gogo-app` 的两个系统角色，不应被混入 gogo-app 的局部架构文档。
