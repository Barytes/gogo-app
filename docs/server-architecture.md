# gogo-app Server Architecture

**最后更新**: 2026-04-14

> 本文档仅描述 gogo-app 后端能力。  
> 与 knowledge-base 的边界见 [app-kb-boundary.md](app-kb-boundary.md)。  
> knowledge-base 能力见 [knowledge-base-capabilities.md](knowledge-base-capabilities.md)。

## 1. 范围

后端是本地 FastAPI 服务，负责应用层 API、会话编排与模型接入，不定义知识库规则本身。

## 2. 核心模块

- `app/backend/main.py`
  - 页面路由与 API 路由入口
- `app/backend/agent_service.py`
  - 单次聊天与流式聊天执行
- `app/backend/session_manager.py`
  - 多会话生命周期、互斥、历史恢复、空闲清理
- `app/backend/pi_rpc_client.py`
  - `pi --mode rpc` 通讯与事件流读取
- `app/backend/wiki_service.py` / `raw_service.py`
  - 内容读取与搜索 API
- `app/backend/config.py`
  - 配置读取（`PI_COMMAND`、`PI_TIMEOUT_SECONDS`、`PI_RPC_SESSION_DIR` 等）

## 3. 运行链路

1. 前端请求 `/api/chat` 或 `/api/chat/stream`
2. 后端调用 `agent_service` 或 `session_manager`
3. 通过 `pi_rpc_client` 与 Pi RPC 通讯
4. 返回 NDJSON 流或同步响应

## 4. Session 存储

- 主目录：`.gogo/pi-rpc-sessions/`
- 元数据索引：`gogo-session-registry.json`
- 会话消息：Pi 原生 session JSONL 文件

## 5. API 能力（当前）

- Chat API：同步/流式
- Session API：创建、列举、详情、删除、历史恢复
- Wiki/Raw API：列表、详情、搜索、下载

## 6. 非目标

以下不属于 gogo-app server 架构职责：

- knowledge-base schema 设计
- knowledge-base 写回规范与 lint 规范
- 多 agent 协作协议定义

这些由 knowledge-base 文档体系维护，后端按约束接入。

