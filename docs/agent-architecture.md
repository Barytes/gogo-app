# Agent 服务架构

> 本文档描述 Agent 服务的架构设计和当前实现状态。

**最后更新**: 2026-04-13

---

## 概览

Agent 服务是 gogo-app 的核心推理引擎，负责：
1. 检索本地知识库（wiki + raw）
2. 调用 Pi SDK 进行 LLM 推理
3. 返回流式或非流式的聊天响应

---

## 架构位置

```
┌─────────────────────────────────────┐
│  前端 (chat.js)                     │
│  - 用户输入                          │
│  - 流式消费 NDJSON                   │
└──────────────┬──────────────────────┘
               │ HTTP POST /api/chat/stream
               ▼
┌─────────────────────────────────────┐
│  FastAPI (main.py)                  │
│  - /api/chat (非流式)               │
│  - /api/chat/stream (流式)          │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Agent Service (agent_service.py)   │
│  - _collect_context()  检索知识库    │
│  - _prepare_pi_request() 准备请求    │
│  - run_agent_chat()    同步调用      │
│  - stream_agent_chat() 异步流式调用  │
└──────────────┬──────────────────────┘
               │ JSON payload
               ▼
┌─────────────────────────────────────┐
│  Pi SDK Bridge (pi_sdk_bridge.mjs)  │
│  - Node.js 子进程                    │
│  - 调用 @mariozechner/pi-coding-agent│
│  - 返回 text_delta / thinking_delta  │
└─────────────────────────────────────┘
```

---

## 核心组件

### 1. `agent_service.py` — Agent 服务主模块

**文件**: `app/backend/agent_service.py`

**职责**:
- 检索本地知识库（wiki + raw）
- 构建 Pi SDK 提示词
- 调用 Pi SDK Bridge
- 处理同步和流式响应
- 错误处理和超时控制

#### 公开函数

| 函数 | 描述 | 返回类型 |
|------|------|---------|
| `get_agent_backend_status()` | 获取 Agent 后端状态 | `dict` |
| `run_agent_chat(message, history)` | 同步聊天调用 | `dict` |
| `stream_agent_chat(message, history)` | 异步流式聊天 | `AsyncIterator[dict]` |

#### 内部函数

| 函数 | 描述 |
|------|------|
| `_collect_context(message)` | 检索相关知识库页面 |
| `_build_pi_prompt(...)` | 构建用户提示词 |
| `_build_pi_system_prompt()` | 构建系统提示词 |
| `_build_consulted_pages(...)` | 构建引用页面列表 |
| `_prepare_pi_request(...)` | 准备 Pi SDK 请求 |
| `_run_pi_agent_chat(...)` | 执行 Pi 调用（同步） |
| `_pi_error_response(...)` | 构建错误响应 |
| `_pi_error_event(...)` | 构建流式错误事件 |

---

### 2. `pi_sdk_bridge.mjs` — Pi SDK 桥接

**文件**: `app/backend/pi_sdk_bridge.mjs`

**职责**:
- 由 Python 子进程调用
- 使用 `@mariozechner/pi-coding-agent` 创建临时 session
- 以知识库目录为只读工作区
- 订阅 Pi session 事件
- 流式输出文本增量、thinking 增量、trace 事件

**输入** (JSON):
```json
{
  "cwd": "/path/to/workdir",
  "system_prompt": "...",
  "prompt": "...",
  "thinking_level": "medium",
  "stream": true
}
```

**输出** (NDJSON):
```json
{"type": "context", ...}
{"type": "thinking_delta", "delta": "..."}
{"type": "text_delta", "delta": "..."}
{"type": "trace", "item": {...}}
{"type": "final", "message": "...", "trace": [...]}
```

---

## 数据流

### 流式聊天流程

```
1. 用户提问
   ↓
2. POST /api/chat/stream
   ↓
3. stream_agent_chat() 被调用
   ↓
4. _collect_context() 检索知识库 (6 wiki + 4 raw)
   ↓
5. _prepare_pi_request() 准备请求
   ↓
6. yield {"type": "context", "consulted_pages": [...]}
   ↓
7. 启动 Node.js 子进程 (pi_sdk_bridge.mjs)
   ↓
8. 读取 stdout 事件流
   ├→ thinking_delta → yield
   ├→ text_delta → yield
   ├→ trace → yield
   └→ final → yield, 结束
   ↓
9. 处理子进程退出状态
   ↓
10. 如有错误 → yield error event
```

### 检索优先级

```
_collect_context(message):
  1. search_pages(message, limit=6)   # 个人知识库优先
  2. search_raw_files(message, limit=4)
  3. 返回 wiki_hits + raw_hits
```

---

## 提示词设计

### 系统提示词 (`_build_pi_system_prompt`)

```python
def _build_pi_system_prompt() -> str:
    return "\n".join([
        "你是一个课题组公共知识库的助手。优先阅读以下文档理解行为规范：",
        "1. knowledge-base/AGENTS.md - 核心职责和工作流程",
        "2. knowledge-base/COMMUNICATION.md - 沟通风格和协作方式",
        "",
        "回答风格：热情、耐心、乐于帮助用户，愿意详细深入地分析问题，为用户提供详尽的解答，保持开放、探索的心态探寻知识库中的内容，遵守知识库规则和用户的指令，严谨地维护知识库中的页面，禁止随意更改知识库的 schema",
    ])
```

**设计说明**：
- 精简到 6 行，指引 Agent 从文档中获取详细规则
- 设定了热情、耐心、深入的回答风格
- 移除了"read-only"限制，支持写回功能
- 强调遵守知识库规则和保护 schema

---

## 事件类型

流式响应支持以下事件类型：

| 类型 | 描述 | 字段 |
|------|------|------|
| `context` | 检索到的知识库上下文 | `consulted_pages` |
| `thinking_delta` | Pi 思考增量 | `delta` |
| `text_delta` | 回复文本增量 | `delta` |
| `trace` | 工具执行 trace | `item` |
| `final` | 最终响应 | `message`, `trace`, `warnings`, `consulted_pages` |
| `error` | 错误事件 | `message`, `warnings` |

---

## 错误处理

### 错误场景

| 场景 | 检测方式 | 响应 |
|------|---------|------|
| Node.js 未找到 | `pi_node_command_path` 为空 | `_pi_error_response()` |
| Bridge 脚本不存在 | `pi_sdk_bridge_path.exists()` 为 False | `_pi_error_response()` |
| 子进程超时 | `asyncio.TimeoutError` | `_pi_error_event()` |
| 子进程非零退出 | `returncode != 0` | `_pi_error_event()` |
| JSON 解析失败 | `json.JSONDecodeError` | `_pi_error_response()` / parse warning |
| Pi 返回 error | `pi_response.get("ok")` 为 False | `_pi_error_response()` |

---

## 配置项

| 配置 | 环境变量 | 默认值 | 描述 |
|------|---------|--------|------|
| `KNOWLEDGE_BASE_DIR` | `KNOWLEDGE_BASE_DIR` | `../knowledge-base` | 知识库目录 |
| `PI_WORKDIR` | `PI_WORKDIR` | `KNOWLEDGE_BASE_DIR` | Pi 工作目录 |
| `PI_NODE_COMMAND` | `PI_NODE_COMMAND` | `node` | Node.js 命令 |
| `PI_TIMEOUT_SECONDS` | `PI_TIMEOUT_SECONDS` | `180` | 超时时间（秒） |
| `PI_THINKING_LEVEL` | `PI_THINKING_LEVEL` | `medium` | 思考级别 |

---

## 当前实现状态

### 已实现功能

| 功能 | 状态 | 备注 |
|------|------|------|
| 知识库检索 | ✅ | wiki + raw 双层检索 |
| 同步聊天 | ✅ | `run_agent_chat()` |
| 流式聊天 | ✅ | `stream_agent_chat()` |
| Pi SDK 集成 | ✅ | 通过 Node.js bridge |
| 上下文检索 | ✅ | 优先个人知识库（6 + 4 配额） |
| 错误处理 | ✅ | 多种错误场景 |
| 超时控制 | ✅ | 可配置超时 |
| 流式事件解析 | ✅ | NDJSON 消费 |

### 与架构的差距

| 架构描述 | 当前实现 | 差距 |
|---------|---------|------|
| 双层知识库检索（personal + public-pool） | 单层 `KNOWLEDGE_BASE_DIR` | ⚠️ 待实现 `PUBLIC_POOL_DIR` 支持 |
| 系统提示词标注"read-only" | ✅ 已移除 | 完成 |
| `should_suggest_contribution()` | 未实现 | ⚠️ 待实现贡献建议逻辑 |

---

## 相关文件

| 文件 | 描述 |
|------|------|
| `app/backend/agent_service.py` | Agent 服务主模块 |
| `app/backend/pi_sdk_bridge.mjs` | Pi SDK 桥接脚本 |
| `app/backend/config.py` | 配置管理 |
| `app/backend/wiki_service.py` | Wiki 检索服务 |
| `app/backend/raw_service.py` | Raw 检索服务 |
| `docs/client-architecture.md` | 客户端架构设计 |

---

## 变更日志

| 日期 | 变更 |
|------|------|
| 2026-04-13 | 初始版本 |
| 2026-04-13 | 更新检索优先级为个人知识库优先（limit 6+4） |
| 2026-04-13 | 优化系统提示词：指引 Agent 阅读 AGENTS.md，设定热情耐心风格，移除 read-only 限制 |
