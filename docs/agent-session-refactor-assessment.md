# Agent/Session 重构评估（含 Pi SDK 会话能力探针）

> 适用代码：`app/backend/agent_service.py`、`app/backend/session_manager.py`、`app/backend/pi_rpc_client.py`、`app/backend/config.py`
>
> 注：文档中包含重构前的历史分析（涉及旧文件）用于决策追溯；当前运行链路已为 RPC-only。

**更新时间**: 2026-04-18

---

## 1. 目标

基于当前实现和 `docs/pi/` 文档，完成 Pi SDK 会话能力探针，并给出两套“最优重构”方案：

- 方案 F：完全重构（你偏好的方向）
- 方案 G：渐进重构（风险最小方向）

每套方案都给出实施要点与 pros/cons。

---

## 2. 会话能力探针（已完成）

探针来源：

- `docs/pi/session.md`
- `docs/pi/sdk.md`
- `docs/pi/rpc.md`
- `docs/pi/README.md`

## 2.1 已确认的会话能力

1. 会话存储模型：
   - Pi 原生会话是 JSONL 树结构，默认落盘于 `~/.pi/agent/sessions/...`
   - `SessionManager.inMemory()` 不落盘，仅内存态
2. SessionManager（SDK）：
   - `create/open/continueRecent/inMemory/forkFrom`
   - `list/listAll`
   - `buildSessionContext/getEntries/getTree/getSessionFile/isPersisted`
   - `appendCustomEntry/appendSessionInfo` 等
3. Runtime 会话替换（SDK）：
   - `createAgentSessionRuntime(...)`
   - `runtime.newSession()/switchSession()/fork()/importFromJsonl()`
4. RPC 会话能力（CLI）：
   - `new_session/switch_session/get_state/get_messages/set_session_name/export_html`
   - 可通过 `id` 做请求响应关联
5. RPC 协议限制：
   - 文档明确要求严格 LF JSONL framing
   - 不建议用 Node `readline` 解析 RPC 帧（会有分隔符兼容问题）

## 2.2 与重构前 gogo-app 的差异（关键，历史）

1. 重构前 `pi_sdk_bridge.mjs` 使用 `SessionManager.inMemory()`，因此没有 Pi 原生 JSONL 会话文件。
2. 重构前会话历史恢复依赖 `session_event_store.py + replay_history()` 手工重建，而非 SDK 原生上下文。
3. 重构前 bridge 是自定义 stdin/stdout 协议，不是官方 RPC 协议。

结论：能力层面完全可重构，但实现路径要在“SDK直连”与“RPC标准化”之间做取舍。

---

## 3. 功能边界：谁该负责

## 3.1 建议交给 Pi SDK / RPC 的职责

- 会话树、分支、上下文构建
- 会话持久化（JSONL）
- 流式事件与消息状态
- 会话列举/切换/fork（通过 Runtime 或 RPC）

## 3.2 建议保留在 gogo-app 的职责

- 产品级会话元数据（标题策略、UI排序、业务标签）
- 前后端 `request_id` 追踪与日志关联
- 业务检索策略（wiki/raw 的检索时机和配额）
- 服务治理（超时、限流、资源隔离、健康检查）

---

## 4. 最优方案 F（完全重构）

目标：彻底移除“自定义 bridge 协议 + 手工 JSONL 事件重建”这条链路，统一到官方 RPC 协议。

## 4.1 架构

```text
FastAPI
  -> RpcSessionPool（Python，轻量）
      -> pi --mode rpc（每会话一个进程）
          -> Pi 原生 SessionManager（文件型，JSONL）
```

## 4.2 关键改造点

1. 删除自定义 bridge 协议路径：
   - 弱化/移除 `pi_sdk_bridge.mjs` 作为主链路
2. 新建 Python RPC client（严格 LF JSONL parser）：
   - 发送 `prompt/new_session/get_state/get_messages/switch_session`
   - 事件流直通前端
3. 会话恢复改为 RPC/原生会话读取：
   - `/api/sessions/{id}/history` 不再依赖 `replay_history()`
4. `session_event_store.py` 下线并删除：
   - 审计能力后续如需恢复，建议独立实现，不再耦合主链路

## 4.3 Pros

- 协议标准化，减少自定义协议维护成本
- 和 Pi 官方演进方向一致（后续兼容性更好）
- 删除大量手工回放和双份状态逻辑，代码更“薄”

## 4.4 Cons

- 改动面最大，回归测试成本高
- RPC framing 实现必须严格，初期容易踩协议细节坑
- 需要重写现有 bridge 事件适配层和超时中断控制

---

## 5. 最优方案 G（渐进重构）

目标：保留现有 bridge 交互方式，先把最痛点（会话落盘与回放重复）切到 Pi 原生能力。

## 5.1 架构

```text
FastAPI
  -> SessionPool（保留）
      -> pi_sdk_bridge.mjs（保留，但改造）
          -> SessionManager.create/continueRecent（文件型）
```

## 5.2 关键改造点

1. `pi_sdk_bridge.mjs`：
   - `SessionManager.inMemory()` -> 文件型 `SessionManager.create(...)` 或 `continueRecent(...)`
2. 历史恢复：
   - 优先从 Pi 原生 session entries/context 读取
   - `session_event_store + replay_history` 逐步下线
3. 保留现有 API 形状：
   - 前端和 FastAPI 路由基本不动，降低迁移噪音

## 5.3 Pros

- 对现有功能影响最小，迁移风险低
- 可快速解决“无法导出原生会话 JSONL”的核心问题
- 保留可回滚路径，便于线上稳态演进

## 5.4 Cons

- 自定义 bridge 仍在，长期技术债仍存在
- 部分重复状态管理还会继续存在一段时间
- 最终形态不如方案 F 简洁

---

## 6. 两种方式对比（结论）

| 维度 | 方案 F 完全重构（RPC） | 方案 G 渐进重构（保留 bridge） |
|---|---|---|
| 代码简洁度（长期） | 高 | 中 |
| 首次改造风险 | 高 | 低 |
| 交付速度 | 中-慢 | 快 |
| 回滚难度 | 高 | 低 |
| 与官方协议一致性 | 高 | 中 |
| 对现有前后端兼容性 | 中 | 高 |

如果你明确要“完全重构”，当前最优就是方案 F。  
如果你要“快速先稳住线上”，则先做方案 G 再转 F。

---

## 7. 方案 F（完全重构）实施计划（可测试里程碑）

下面给出“完全重构优先”的落地计划。每个里程碑都对应你可以直接手测的功能结果。

当前进展（2026-04-14）：

- F1 已完成（代码与最小命令集验证通过）
- F2 已完成（主链路切换、事件映射、request_id 贯通与文案对齐）
- F3 已完成（Session 管理层接入 RPC 会话命令与并发互斥）
- F4 已完成（历史恢复切到 Pi 原生会话链路）
- F5 已完成（legacy 主路径下线，架构收敛为 RPC-only）

补充说明（2026-04-18）：

- 当前 RPC-only 主链路又增加了一层首发前最小安全约束：`agent_service.py` 与 `session_manager.py` 启动 Pi RPC 时，会在 Provider extension 之外额外注入 gogo-app 托管的 `managed-security.ts`
- 这层约束属于应用级“最小安全边界”，不是容器级强沙箱；其职责是限制 `bash/write/edit` 的默认能力范围，并把 allow / block 决策写入本地安全日志

## 7.1 当前实现与原方案描述的差异（已落地）

为避免把“实施阶段假设”误读为“当前代码行为”，补充如下：

1. 当前实现不是“每会话常驻一个 RPC 进程”，而是按请求启动 `PiRpcClient`，通过 `session_file` 做会话切换与复用。
2. `session_event_store.py` 未降级保留，已直接删除；历史恢复路径为 `RPC get_messages -> 原生 session JSONL`。
3. 迁移期 `PI_BACKEND_MODE` 已完成使命并移除，当前后端为 RPC-only。

## F1：RPC 基座接入（旁路，不切主流量）

目标：在不破坏现有链路的前提下，跑通 Pi 官方 RPC 协议基础能力。

实现步骤：

1. 新建 Python 侧 RPC 客户端模块（严格 LF JSONL framing）。
2. 实现命令发送/响应关联（统一 `id`）。
3. 支持最小命令集：`get_state`、`prompt`、`abort`。
4. 迁移阶段新增后端开关（如 `PI_BACKEND_MODE=legacy|rpc`），用于灰度切换。
5. 增加基础诊断日志（请求/响应耗时、超时、进程退出码）。

可测试结果：

- （历史验收）切到 `PI_BACKEND_MODE=rpc` 能完成一轮最小问答（流式或非流式）。
- 超时/abort 能返回可见错误，不会卡死输入框。

## F2：聊天主链路切换到 RPC（保留 Session API 形状）

目标：`/api/chat` 与 `/api/chat/stream` 主路径改为 RPC 执行。

当前状态：✅ 已完成（2026-04-14）

落地结果（已实现）：

1. `agent_service.py` 下线 legacy bridge 主分支，单次聊天固定走 RPC 执行器。
2. `session_manager.py` 收敛为 RPC-only 会话管理；`session_event_store.py` 已删除。
3. 历史恢复默认不依赖旧事件目录，主数据源为 Pi 原生会话（在线 `get_messages` + 离线 JSONL）。
4. 文档与任务同步更新，F1-F5 全部闭环。

实现步骤：

1. `agent_service.py` 引入 RPC 执行器，替代 bridge 子进程调用。
2. 将 RPC 事件映射为现有前端事件类型（`thinking_delta/text_delta/trace/final/error`）。
3. 保留并贯通 `request_id`（前端 -> 后端 -> 日志）。
4. 对齐当前超时策略与错误文案，避免回归。

可测试结果：

- 现有前端不改交互即可正常流式回复。
- 简单问题（如“你是谁”）可稳定返回，不出现“长期 pending”。

## F3：多会话与会话元数据切换到 RPC 会话机制

目标：`/api/sessions` 系列接口在 RPC 模式下可用并保持现有体验。

当前状态：✅ 已完成（2026-04-14）

实现步骤：

1. 在 Session 管理层接入 RPC 会话命令（`new_session`、`switch_session`、`set_session_name`、`get_state`）。
2. 保持现有 API 返回结构（`session_id/title/message_count` 等字段语义兼容）。
3. 处理会话并发互斥（每会话单飞、会话切换时 pending 正确）。
4. 对齐删除/回收逻辑（映射到 session file 生命周期或归档策略）。

可测试结果：

- 可创建两个会话并来回切换，各自上下文独立。
- 会话标题可设置并在列表稳定显示。

## F4：历史恢复切到 Pi 原生会话（替换手工 replay）

目标：`/api/sessions/{id}/history` 不再依赖 `session_event_store + replay_history` 主路径。

当前状态：✅ 已完成（2026-04-14）

实现步骤：

1. 优先通过 RPC `get_messages` 获取当前会话消息。
2. 为“进程不在线”场景增加离线读取（从 Pi 原生 JSONL 会话文件恢复）。
3. 前端继续使用现有 hydrate 逻辑，无感切换数据源。
4. 校准消息映射（assistant/tool/custom）到前端展示模型。

可测试结果：

- 刷新页面后切回旧会话，历史仍可恢复。
- 后端重启后，历史恢复仍可用（基于 Pi 原生 JSONL）。

## F5：旧链路下线与收敛

目标：完成“完全重构”闭环，旧架构退出主路径。

当前状态：✅ 已完成（2026-04-14）

实现步骤：

1. 删除 `pi_sdk_bridge.mjs`。
2. 删除 `session_event_store.py`，并移除 `replay_history` 对其主路径依赖。
3. 清理遗留配置项与死代码，更新全部架构文档。
4. 补齐回归清单与验收脚本（会话切换、超时、恢复、并发）。

可测试结果：

- 复现你之前报告的切会话/超时问题场景，行为稳定且可重复通过。
- 默认运行时不再依赖旧事件目录作为主会话数据源。

---

## 8. 两条路径的 Pros / Cons（用于决策复核）

## 8.1 完全重构（方案 F）

Pros：

- 长期架构最简洁，协议与 Pi 官方一致。
- 会话与历史语义统一，减少“双份状态”与手工回放逻辑。
- 后续维护成本最低。

Cons：

- 首次改造风险与回归压力最大。
- RPC 协议细节（framing/并发/取消）实现门槛高。
- 需要一轮较完整的端到端测试建设。

## 8.2 渐进重构（方案 G）

Pros：

- 风险低，交付快，可快速止血。
- 对现有前后端改动小，回滚容易。

Cons：

- 保留 bridge 技术债，长期复杂度仍偏高。
- 同期会存在新旧两套语义，团队认知负担更大。

---

## 9. 执行建议（基于你的偏好）

你已明确“希望完全重构”，建议直接按 F1 -> F5 执行。  
其中 F2/F3/F4 都是用户可直接感知并可手测验收的节点，F5 作为收口节点。

---

## 10. 文档级事实约束

1. 当前仓库并未包含 `node_modules`，因此本次探针是“文档能力探针”，不是“本地二进制行为实测”。
2. 文档已明确 `SessionManager.inMemory()` 不持久化，因此它不能导出 Pi 原生 JSONL 会话。
3. 若切到 RPC，必须按 `docs/pi/rpc.md` 的 LF JSONL framing 实现，不能直接复用不兼容的行分割器实现。
