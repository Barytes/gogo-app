# gogo-app Architecture

**最后更新**: 2026-04-14

> 本文档描述 `gogo-app` 这个应用产品本身的职责、边界与当前前后端架构。  
> 项目级关系见 [gogo-project-architecture.md](gogo-project-architecture.md)。  
> knowledge-base 的内容与规范架构见 [knowledge-base-architecture.md](knowledge-base-architecture.md)。

## 1. 定位

`gogo-app` 是一个可直接交付给用户使用的 agentic knowledge base 应用。

它的目标是：

- 让用户浏览知识库内容
- 让用户与内置 agent 对话
- 让用户在不改造底层知识库的前提下，获得一个开箱即用的基础服务
- 支持连接用户指定的 knowledge-base，而不强绑单一内容仓

## 2. 功能职责

### 2.1 用户侧能力

- `Wiki/Raw` 内容浏览
- Chat 问答与流式响应
- 多会话管理
- 本地工作台式交互体验

### 2.2 系统侧能力

- 本地 FastAPI 服务
- Pi RPC 模型接入
- 会话状态与历史恢复
- 本地知识库目录读取与搜索 API

## 3. 边界

### 3.1 gogo-app 负责

- 应用 UI 与交互体验
- 前后端 API
- 会话与 Agent runtime 编排
- 将 knowledge-base 内容组织成可用产品体验

### 3.2 gogo-app 不负责

- knowledge-base schema 定义
- knowledge-base 写回规则与 lint 规则定义
- 多用户公共池聚合
- 独立同步客户端协议

这些分别属于 `knowledge-base`、`gogo-server`、`gogo-client`。

## 4. 当前架构

## 4.1 前端

主要文件：

- `app/frontend/index.html`
- `app/frontend/assets/workbench.js`
- `app/frontend/assets/wiki.js`
- `app/frontend/assets/chat.js`
- `app/frontend/assets/styles.css`

主要职责：

- 单页工作台布局
- `Wiki` / `Chat` 模式切换
- 会话列表、新建、删除、切换
- 流式事件消费与消息渲染
- Wiki/Raw 内容展示

## 4.2 后端

主要文件：

- `app/backend/main.py`
- `app/backend/agent_service.py`
- `app/backend/session_manager.py`
- `app/backend/pi_rpc_client.py`
- `app/backend/wiki_service.py`
- `app/backend/raw_service.py`
- `app/backend/config.py`

主要职责：

- 页面与 API 路由
- 单次聊天与会话聊天
- Session 生命周期管理
- Pi RPC 通讯
- knowledge-base 内容读取与搜索

## 4.3 运行链路

```text
Browser
  -> gogo-app frontend
  -> FastAPI (`main.py`)
  -> `agent_service.py` / `session_manager.py`
  -> `pi_rpc_client.py`
  -> `pi --mode rpc`
```

内容浏览链路：

```text
Browser
  -> gogo-app frontend
  -> FastAPI
  -> `wiki_service.py` / `raw_service.py`
  -> KNOWLEDGE_BASE_DIR
```

## 5. Session 与状态

- 会话目录：`.gogo/pi-rpc-sessions/`
- registry：`gogo-session-registry.json`
- 消息历史：Pi 原生 session JSONL
- 当前为 RPC-only 架构

更细的 session 机制见 [session-management.md](session-management.md)。

## 6. 当前实现边界

已实现：

- 本地应用 UI
- Wiki/Raw 浏览
- Pi RPC 聊天主链路
- 多会话与历史恢复

未实现：

- 内置写回平台能力
- 独立同步客户端
- 公共池聚合服务

## 7. 设计原则

- 应用层尽量薄：聚焦体验、编排、接入
- 规范层外置：knowledge-base 负责内容规则
- Agent 可替换：尽量不把能力绑死在单一模型上
- 目录可替换：通过 `KNOWLEDGE_BASE_DIR` 指向不同知识库

## 8. 实现细节文档

- [agent-architecture.md](agent-architecture.md) - gogo-app 中 Agent 后端实现细节
- [session-management.md](session-management.md) - gogo-app 中 Session 管理与恢复机制
- [frontend-workbench-elements.md](frontend-workbench-elements.md) - gogo-app 前端页面元素、状态与交互实现说明
