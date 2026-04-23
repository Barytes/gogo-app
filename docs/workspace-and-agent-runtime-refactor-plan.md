# Workspace 与 Agent Runtime 重构计划

**最后更新**: 2026-04-24

> 本文档记录两条下一阶段的结构性重构方向：  
> 1. 将 `gogo-app` 从固定 `knowledge-base/wiki + raw` 目录约束中解耦，支持更通用的 Markdown 工作区。  
> 2. 将 Agent runtime 从当前 Pi-only 结构抽象成“可绑定任意本地 coding agent，同时保留 bundled Pi runtime 兜底”的双轨架构。

## 1. 背景

当前 `gogo-app` 已经具备一套可用的本地 knowledge-base 工作台，但仍有两个明显的结构性绑定：

1. 内容工作区仍默认假设用户连接的是一个带 `wiki/`、`raw/`、`inbox/` 的 `knowledge-base` 目录。
2. Agent runtime 仍默认假设聊天主链路就是 `pi --mode rpc`。

这两点都阻碍了 `gogo-app` 走向更通用的桌面工作台：

- 对内容侧来说，用户不一定已经维护一套符合当前 `knowledge-base` 规范的目录；很多用户只有一个普通 Markdown 文件夹。
- 对 Agent 侧来说，用户不一定想只用 bundled Pi；也可能希望连接自己本机已有的 Claude Code、Codex，或其他本地 coding agent。

因此，下一阶段需要把这两个“硬绑定”都改成“抽象层 + 兼容层”的结构。

## 2. 目标与非目标

### 2.1 目标

- 允许 `gogo-app` 打开两类本地工作区：
  - 完整 `knowledge-base`
  - 任意 Markdown 文件夹
- 允许 `gogo-app` 连接两类 Agent runtime：
  - bundled / system Pi runtime
  - 用户本机的其他 coding agent
- 对外仍保留当前最稳妥的默认路径：
  - companion knowledge-base
  - bundled Pi runtime
- 不把 UI、session、权限审批、diagnostics 写死在某一种 agent 或某一种目录结构上。

### 2.2 非目标

- 不要求第一阶段就让“普通 Markdown 文件夹”拥有完整的 `skills / schemas / inbox / ingest` 能力。
- 不要求第一阶段就原生适配每一个 agent 的私有协议。
- 不要求第一阶段放弃 Pi；Pi 仍然是最稳定、最可控的默认 fallback runtime。

## 3. 重构 A: 内容工作区抽象

### 3.1 现状问题

当前内容浏览、编辑、启动引导和 diagnostics 都深度假设：

- 根目录下必须有 `wiki/`
- 根目录下必须有 `raw/`
- 很多文案、错误提示和桌面引导也围绕 `wiki/raw/inbox` 展开

这让 `gogo-app` 更像“特定 knowledge-base 的壳”，而不是“可打开本地内容工作区的桌面应用”。

### 3.2 目标结构

引入统一的 `workspace descriptor`，替代“默认就是 knowledge-base 根目录”的隐式约定。

建议抽象为：

```text
workspace
  - mode
  - root_path
  - content_roots
  - capability_flags
  - session_namespace
```

其中：

- `mode`
  - `knowledge-base`
  - `markdown-folder`
- `content_roots`
  - `primary_markdown_root`
  - `raw_root`（可空）
  - `inbox_root`（可空）
  - `capability_root`（可空）
- `capability_flags`
  - `supports_raw`
  - `supports_inbox`
  - `supports_capabilities`
  - `supports_ingest`

### 3.3 建议的两种工作区模式

#### A. `knowledge-base` 模式

保留当前兼容结构：

```text
<root>/
  wiki/
  raw/
  inbox/
  skills/
  schemas/
  AGENTS.md
```

此模式下保留现有全部能力：

- Wiki/Raw 浏览
- Markdown 编辑
- Inbox / ingest
- skills / schemas / AGENTS
- 当前 slash 命令和 capability 编辑器

#### B. `markdown-folder` 模式

允许用户直接选择任意一个本地 Markdown 文件夹，例如：

```text
<root>/
  notes/
  drafts/
  README.md
  research.md
```

此模式下第一阶段建议只保证：

- Markdown 列表
- 搜索
- 详情浏览
- 编辑
- 新建 / 删除 `.md`

并显式降级以下能力：

- `raw/` 独立视图
- `inbox/` ingest
- `skills / schemas / AGENTS.md`

### 3.4 需要调整的层

#### 配置层

- `config.py` 不再只判断“是否存在 `wiki/` + `raw/`”
- 改为先识别 `workspace mode`
- `settings` / `diagnostics` 返回结构中新增：
  - `workspace_mode`
  - `primary_markdown_root`
  - `raw_root`
  - `inbox_root`
  - `capabilities`

#### 内容服务层

- `wiki_service.py` 不再直接绑定 `<kb>/wiki`
- `raw_service.py` 不再默认要求存在 `raw/`
- 引入统一的 workspace path resolver

#### 前端工作台层

- `wiki.js` 不再把 `wiki/raw/inbox` 视为永远存在的固定三态
- `workbench.js` 的启动引导、diagnostics、设置文案改为围绕“工作区”而不是只围绕 `knowledge-base`
- `Raw` / `Inbox` / `Capabilities` 在不支持时应隐藏或明确置灰

#### 桌面引导与发包层

- 首次启动不应只提示“请选择 knowledge-base”
- 应改成“请选择工作区”
- companion knowledge-base 仍作为推荐默认工作区存在，但不再是唯一合法结构

### 3.5 分阶段推进建议

#### Phase A1: 抽象工作区模型

- 后端新增 workspace descriptor
- settings / diagnostics 返回真实工作区模式
- 保持现有 `knowledge-base` 流程完全兼容

#### Phase A2: 支持任意 Markdown 文件夹

- 接受无 `wiki/raw` 结构的目录
- 主 Markdown 浏览改为读取 `primary_markdown_root`
- 非适用能力在 UI 上明确降级

#### Phase A3: 评估增强能力

- 是否给 `markdown-folder` 模式引入隐藏 inbox
- 是否允许把 `raw` 退化为“同目录非 Markdown 浏览”
- 是否允许为普通工作区单独挂一个 capability 目录

### 3.6 风险与待定问题

- 现有很多前端交互把 `Wiki / Raw / Inbox` 视为固定工作台结构，需要梳理显示逻辑。
- 当前安全边界默认围绕“knowledge-base 根目录”计算，需要改为围绕“workspace root / allowed roots”计算。
- `markdown-folder` 模式下，哪些能力是“隐藏”还是“禁用只读”，需要统一 UX 口径。

## 4. 重构 B: Agent Runtime 抽象

### 4.1 现状问题

当前 Agent 层的真实调用链路是：

```text
gogo-app
  -> session_manager / agent_service
  -> pi_rpc_client
  -> pi --mode rpc
```

这意味着：

- 主链路默认是 Pi-only
- UI、diagnostics、登录引导、安装链路都围绕 Pi 展开
- 用户如果本机主要使用 Claude Code、Codex 或其他 coding agent，当前无法直接接入

### 4.2 目标结构

将 Agent runtime 从“Pi 实现”提升为“runtime 抽象层”，至少支持两类后端：

1. `PiRuntimeAdapter`
   - bundled Pi runtime
   - system Pi runtime
2. `AcpRuntimeAdapter`
   - 通过 ACP 连接任意兼容的本地 coding agent 或 bridge

目标不是把 Pi 去掉，而是让 Pi 从“唯一实现”变成“默认实现 + fallback 实现”。

### 4.3 ACP 作为通用接入层

本计划建议把 ACP 作为“连接外部本地 coding agent”的标准接口层。

参考资料：

- ACP GitHub 仓库: <https://github.com/agentclientprotocol/agent-client-protocol>
- ACP 协议概览: <https://agentclientprotocol.com/protocol/overview>

根据 ACP Overview，协议采用 JSON-RPC 2.0，并围绕这些基础方法/通知组织：

- `initialize`
- `authenticate`
- `session/new`
- `session/load`
- `session/prompt`
- `session/cancel`
- `session/update`
- `session/request_permission`

这套模型与 `gogo-app` 当前已有的会话、流式更新、权限审批、终止当前请求等交互是可以对齐的。

### 4.4 关于 Claude Code / Codex 的边界

这里需要明确一个边界：

- `gogo-app` 不应假设 Claude Code、Codex 等所有 agent 都天然支持 ACP。
- 正确的对接语义应是：
  - 连接 **ACP-compatible agent**
  - 或连接这些 agent 的 **ACP adapter / bridge**

也就是说，产品目标不是“直接内嵌每个 agent 的私有协议”，而是“尽可能统一走 ACP”。

### 4.5 建议的运行时架构

```text
Frontend
  -> Agent Runtime API
  -> Runtime Manager
      -> PiRuntimeAdapter
      -> AcpRuntimeAdapter
  -> session store / diagnostics / approvals
```

拆分建议：

- `Runtime Manager`
  - 管理当前激活的 runtime profile
  - 负责启动、切换、健康检查、diagnostics 聚合
- `PiRuntimeAdapter`
  - 继续复用现有 `pi_rpc_client.py` 和 session 链路
- `AcpRuntimeAdapter`
  - 作为 ACP client
  - 负责进程拉起或连接 transport
  - 把 ACP 的 session/update / permission / tool events 映射到现有前端事件模型

### 4.6 运行时配置模型

建议把当前“模型 Provider 配置”上层再包一层“Agent runtime 配置”：

- `runtime_type`
  - `bundled-pi`
  - `system-pi`
  - `acp-agent`
- `runtime_label`
- `launch_config`
  - command
  - args
  - cwd policy
  - env mapping
- `capabilities`
  - sessions
  - permission requests
  - file writes
  - terminal
  - slash commands
- `auth_mode`
  - none
  - runtime-owned
  - app-assisted

### 4.7 对前端与 UX 的影响

需要把“Pi 设置”提升成更通用的“Agent Runtime 设置”：

- 运行时选择
  - bundled Pi
  - system Pi
  - 用户配置的 ACP agent
- 运行时状态
  - 已安装 / 可启动 / 认证状态 / 支持能力
- 运行时专属说明
  - bundled Pi: 保持当前安装、登录、diagnostics 流程
  - ACP agent: 显示它的 launch command、可用能力、权限请求能力和会话支持情况

当前的 Pi 相关 UI 不需要立刻删除，但应逐步收敛成：

- “Pi 是一种 runtime”
- 而不是“Agent 就等于 Pi”

### 4.8 会话与权限模型建议

当前 `gogo-app` 最可复用的部分不是 Pi 本身，而是这些产品层抽象：

- 会话列表
- 流式消息展示
- 终止当前请求
- 权限审批弹层
- 诊断面板
- 本地安全审计

因此推荐保持：

- 前端继续消费统一的 session/update-like 事件流
- 权限审批继续由 `gogo-app` UI 统一承接
- runtime adapter 只负责协议翻译，不直接接管产品层 UI

### 4.9 分阶段推进建议

#### Phase B1: 抽象 runtime 接口

- 在后端定义统一 runtime adapter interface
- 把现有 Pi 链路包进 `PiRuntimeAdapter`
- 保证现有行为不回退

#### Phase B2: 接入 ACP client

- 新增 `AcpRuntimeAdapter`
- 先支持最小 ACP 生命周期：
  - initialize
  - session/new or session/load
  - session/prompt
  - session/cancel
  - session/update
  - permission requests

#### Phase B3: 暴露运行时选择器

- 设置面板新增 runtime 选择与 profile 管理
- bundled Pi 保持默认
- 允许用户手动新增一个 ACP agent profile

#### Phase B4: 兼容更多 agent 与 bridge

- 评估社区 ACP bridge
- 明确官方支持清单与“社区兼容”清单
- 逐步减少前端中写死的 Pi 文案

### 4.10 风险与待定问题

- 不同 ACP agent 对会话持久化、权限请求、终端工具、文件操作的支持度可能不同。
- 当前 `gogo-app` 的安全边界围绕 Pi 托管 security extension 设计；ACP 路径下需要重新定义“统一审批 + 本地审计”边界。
- 一些 runtime 可能把认证完全交给自身 CLI；`gogo-app` 需要接受“认证状态只读展示，而不是自己完成登录”的情况。

## 5. 两条重构之间的关系

这两条重构互相独立，但会在三个点上相互影响：

1. `workdir / allowed roots`
   - Agent runtime 的默认工作目录和安全边界需要基于新的 workspace descriptor 计算。
2. `session namespace`
   - 未来 session 隔离不应只按 knowledge-base 路径，还应考虑 runtime profile。
3. `diagnostics`
   - 诊断面板需要同时展示：
     - 当前工作区模式
     - 当前 agent runtime 类型

## 6. 推荐落地顺序

建议按下面顺序推进：

1. 先做工作区抽象
   - 先把“能打开什么目录”从 `knowledge-base` 结构解绑
2. 再做 runtime 抽象
   - 把 Agent 层从 Pi-only 提升为 runtime manager
3. 最后接 ACP
   - 在运行时抽象稳定后接入 ACP client

原因是：

- workspace 抽象会直接影响 security boundary、diagnostics 和 desktop onboarding
- runtime 抽象则依赖这些“工作目录 / 权限边界 / 状态展示”先变成通用模型

## 7. 结论

下一阶段 `gogo-app` 的结构目标，不应再是：

- “一个绑定特定 `wiki/raw` 目录和 Pi runtime 的工作台”

而应是：

- “一个可打开本地内容工作区、可连接本地 coding agent、同时保留 companion knowledge-base 与 bundled Pi 作为默认体验的桌面应用”

对应到这两条重构：

1. 内容侧：从 `knowledge-base-only` 走向 `workspace-first`
2. Agent 侧：从 `Pi-only` 走向 `runtime-first`

这两件事一起完成后，`gogo-app` 才真正具备“既能给普通用户开箱即用，也能给高级用户接入自己本机工作流”的产品弹性。
