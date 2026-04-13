# Agent/Session 重构评估（Pi SDK 能力边界与落地路径）

> 适用代码：`app/backend/agent_service.py`、`app/backend/session_manager.py`、`app/backend/pi_sdk_bridge.mjs`、`app/backend/session_event_store.py`

**更新时间**: 2026-04-14

---

## 1. 评估目标

基于当前代码与给定对话，评估是否可以将 `agent_service` + `session` 重构为更简洁高效的模式，并明确：

- 哪些能力可以交给 Pi SDK，避免重复造轮子
- 哪些能力必须留在 gogo-app（业务层/产品层责任）
- 推荐的重构路径、风险与回滚策略

---

## 2. 先给结论（Executive Summary）

可以重构得更简洁，但不建议“全删自研层”。

1. 可以下沉给 Pi SDK 的部分：
   - 对话树与会话历史持久化（前提：启用文件型 SessionManager，而非 `inMemory()`）
   - Token/文本流事件订阅
   - AgentSession 生命周期内的上下文连续性
2. 仍应保留在 gogo-app 的部分：
   - 会话列表 API、标题、删除、idle 清理等产品级会话管理
   - 前后端统一 `request_id`、超时策略、可观测性与审计
   - 与本地知识库检索策略耦合的业务逻辑
3. 推荐目标不是“完全移除 session_manager”，而是：
   - 将其降级为轻量编排层（orchestrator）
   - 减少重复实现（尤其 `replay_history` / 自定义事件回放解析）

---

## 3. 对给定对话结论的逐条评估

## 3.1 判断基本正确的部分

- `SessionManager.inMemory()` 不会产生 Pi 原生 JSONL，会话仅存在进程内存中。
- 当前代码确实有“SDK能力 + 应用层重复实现”：
  - 你们在 Python 端自己做了 JSONL 事件存储与历史重建
  - Bridge 中又在 Session 内维护了上下文
- 如果改为文件型会话管理器，历史回放这块可明显简化。

## 3.2 需要修正或谨慎的部分

- “可以直接用 Python SDK 替代 Node 子进程”：当前仓库没有 Python 版 Pi SDK 依赖证据，现状是 Node SDK + Python 调用桥接。
- “SessionManager.create()/buildSessionContext()/appendCustomEntry() 一定可用”：该说法在你当前安装版本未完成本地 API 核验，不能直接当成事实。
- “可以删除 session_manager.py”：不建议。即使下沉存储与历史，也仍需产品级会话编排与 API 语义层。

---

## 4. 当前代码的复杂度来源（根因）

并非单一“代码写复杂了”，而是三层职责混在一起：

1. SDK 运行时职责（Node/AgentSession）
   - prompt 执行、流事件、模型 fallback、工具调用
2. 应用业务职责（FastAPI）
   - 会话列表/创建/删除/切换、前端状态一致性
3. 可观测性与恢复职责（你们新增）
   - request_id、timeout、事件落盘、回放

当前复杂度高，是因为“2 + 3”被部分塞进“1”的边界里手工拼接。

---

## 5. 可交给 Pi SDK vs 应保留自研（边界表）

| 能力 | 是否建议交给 Pi SDK | 说明 |
|---|---|---|
| 会话上下文树管理 | 是 | SDK原生强项，避免手工拼 history |
| 会话历史持久化（JSONL） | 是（前提启用文件型 manager） | 解决 `inMemory()` 导致无法导出原生会话 |
| 流式 delta 事件生产 | 是 | SDK直接订阅，减少桥接层拼装 |
| `request_id` 贯通 | 否 | 这是产品可观测性需求，需应用层定义 |
| 全局审计日志 `events.jsonl` | 视需求 | SDK通常只管会话文件，不含全局审计 |
| Session 列表/标题/删除 API | 否 | 产品功能，不是 SDK 职责 |
| Idle 回收/资源配额 | 否 | 服务治理职责，需应用层维护 |
| 检索策略（wiki/raw） | 否 | 业务策略，应留在 app |

---

## 6. 推荐重构方向（B+：保守但收益高）

不建议一步到位“全量替换”，建议采用 B+：

1. 保留 `session_manager.py` 作为编排层
2. 逐步把“会话存储/历史重放”迁到 Pi SDK 原生能力
3. 将“事件审计”保留为可选附加层（而非主数据源）

目标形态：

```text
FastAPI (业务路由/策略/可观测性)
    -> Session Orchestrator (轻量)
        -> Pi Bridge (Node SDK)
            -> 文件型 SessionManager (原生 JSONL)
```

---

## 7. 具体迁移步骤（建议分阶段）

## 阶段 0：能力探针（必须先做）

- 在 `pi_sdk_bridge.mjs` 里确认你当前 SDK 版本是否支持：
  - 文件型 SessionManager 构造方式
  - 历史 entries/tree 读取接口
  - 是否存在官方会话导出 API
- 形成一份“API实测清单”，再进入下一步。

## 阶段 1：存储模式切换（最关键）

- 将 `SessionManager.inMemory()` 切换为文件型实现。
- 保持现有协议不变，先确保行为兼容。
- 验证：会话是否真实写入原生 JSONL 路径，重启后可读取。

## 阶段 2：历史回放源切换

- 让 `/api/sessions/{id}/history` 优先从 Pi 原生会话读取。
- `session_event_store.py` 从“主存储”降级为“审计日志（可选）”。
- 精简 `replay_history()` 中手工解析逻辑。

## 阶段 3：上下文重复注入治理

- 对 Session 模式，移除或弱化 `history` 手工拼接 prompt（避免双重上下文）。
- 保留无 Session 模式的 fallback 路径。

## 阶段 4：清理与收敛

- 删除无价值重复代码与文档噪音。
- 补全回归测试：会话切换、超时、重启恢复、并发请求。

---

## 8. 预期收益

- 代码体量下降：减少“手工事件回放 + 历史重建”相关复杂逻辑
- 一致性提升：历史源从“自定义推导”转为“SDK原生记录”
- 稳定性提升：降低会话切换时的状态分叉与事件丢失概率

---

## 9. 风险与回滚

主要风险：

- SDK 版本与文档示例不一致（API 不可用或行为差异）
- 文件型 manager 带来的 I/O 与路径权限问题
- 切换阶段导致新旧历史格式并存

回滚策略：

- 保留开关（`PI_SESSION_STORAGE_MODE=in_memory|file`）
- 保留当前 `session_event_store` 作为兜底路径，待稳定后再降级/删除

---

## 10. 是否值得做

值得做，但建议按阶段推进，不建议一次性重写。

“全交给 SDK”是方向，不是边界答案；最终应是：
- SDK 负责 Agent runtime 与原生会话语义
- gogo-app 负责产品级会话治理与可观测性

这个分层更简洁，也更稳。
