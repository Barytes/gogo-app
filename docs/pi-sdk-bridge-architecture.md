# Pi SDK Bridge 架构文档（已归档）

> 本文档描述历史文件 `app/backend/pi_sdk_bridge.mjs` 的职责、数据流、事件协议与已知约束。
>
> 现状：该文件已在 F5 阶段删除，后端主链路已收敛为 `session_manager.py + pi_rpc_client.py`（RPC-only）。

**最后更新**: 2026-04-13

---

## 1. 目标

`pi_sdk_bridge.mjs` 是 Python 后端与 `@mariozechner/pi-coding-agent` 之间的 Node.js 桥接层，负责：

- 初始化 Pi session（工作目录、thinking level、system prompt）
- 接收来自 `session_manager.py` 的 JSON 请求（stdin）
- 订阅 Pi SDK 事件并转换为 NDJSON（stdout）
- 在 long-running 模式下复用同一个 session 处理多轮请求

---

## 2. 运行模式

桥接脚本支持两种模式：

- `long_running`
  - 首条 JSON 作为初始化参数
  - 之后逐行读取后续请求并调用 `handlePrompt()`
  - 适配 Session 池的长连接子进程模型

- `run_once`（兼容）
  - 不带 `mode: "long_running"` 时走单次执行
  - 执行一次 `prompt` 后输出结果并结束

入口逻辑在 `main()`：

1. `readline` 创建 stdin 行读取器
2. `readFirstJsonLine()` 读取首条非空 JSON
3. 判断 `payload.mode`
4. `long_running` 进入循环；否则执行 `runOnce()`

---

## 3. 输入输出协议

## 3.1 输入（来自 Python stdin）

初始化 payload（示例）：

```json
{
  "cwd": "/abs/path",
  "thinking_level": "medium",
  "system_prompt": "...",
  "mode": "long_running"
}
```

后续请求 payload（示例）：

```json
{
  "prompt": "用户问题",
  "history": [{"role":"user","content":"..."}],
  "thinking_level": "medium",
  "stream": true
}
```

## 3.2 输出（写到 stdout NDJSON）

事件类型：

- `ready`
- `trace`
- `thinking_delta`
- `text_delta`
- `text_replace`
- `final`
- `error`

在 long-running + `stream=true` 下，输出按行 NDJSON 事件流；  
在非流式单次模式下，输出单个 JSON 对象。

---

## 4. 内部模块划分

## 4.1 事件规范化

相关函数：

- `summarizePiEvent()`
- `buildToolStartTrace()`
- `buildToolErrorTrace()`
- `buildThinkingTrace()`
- `addTraceEntry()`

职责：

- 把 Pi SDK 原始事件映射为前端可展示的 `trace item`
- 去重连续重复 trace
- 限制 trace 数量和文本长度（`MAX_TRACE_ITEMS`、`MAX_TRACE_DETAIL_LENGTH`）

## 4.2 文本聚合

相关状态：

- `currentAssistantText`
- `currentThinkingText`

来自 Pi 事件的三类增量处理：

- `thinking_delta` 追加到思考文本
- `text_delta` 追加到回复文本
- `text_replace` 覆盖回复文本

最终在 `final` 事件中输出聚合结果；若增量为空，回退从 `session.getTree()` 提取最近 assistant 文本。

## 4.3 Session 生命周期

相关函数：

- `initSession(payload)`：创建 SDK session 并注册订阅
- `handlePrompt(payload)`：处理单次请求并输出 `final/error`
- `resetSessionState()`：每个 prompt 前清空本轮缓存状态

long-running 模式下 `currentSession` 会复用；不会每问一次重建 session。

---

## 5. 与后端的协作关系

调用方：

- `app/backend/session_manager.py`

协作方式：

1. `SessionPool._start_session_process()` 启动 Node 子进程并写入初始化 payload
2. `send_message_async()` 每次请求写一行 JSON
3. bridge 每行处理后输出 NDJSON
4. Python 逐行读取并转发给 FastAPI StreamingResponse

---

## 6. 关键设计决策

## 6.1 为什么使用 readline 按行协议

long-running 场景下 stdin 不会关闭。  
如果等待“读到 EOF 再解析”，会导致桥接阻塞，后续请求无法执行。

因此当前实现是：

- 首行初始化
- 后续逐行请求循环

这与 Session 池的持续写入模型保持一致。

## 6.2 为什么保留 run_once 模式

- 便于兼容旧调用链和独立调试
- 能在不依赖 Session 池时做最小集成验证

---

## 7. 已知限制

- SDK 事件字段依赖第三方库版本，若上游事件结构变化需同步更新映射函数
- 当前桥接不做请求级 ID 标注，跨层日志关联成本较高
- 进程级恢复策略由 Python 侧负责（bridge 本身不管理进程重启）

---

## 8. 建议演进

1. 在请求 payload 中加入 `request_id`，并原样回传到所有事件
2. 增加 bridge 级调试日志开关（仅开发环境）
3. 将事件 schema 抽成共享文档/类型定义，减少前后端协议漂移

---

## 9. 相关文件

- `app/backend/pi_sdk_bridge.mjs`
- `app/backend/session_manager.py`
- `app/backend/agent_service.py`
- `docs/session-management.md`
- `docs/agent-architecture.md`
