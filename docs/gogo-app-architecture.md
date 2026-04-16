# gogo-app Architecture

**最后更新**: 2026-04-16

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
- 运行时切换知识库
- 设置面板中的 Provider / diagnostics 管理
- 上传文件到知识库 `inbox/` 并驱动 ingest 工作流

### 2.2 系统侧能力

- 本地 FastAPI 服务
- Pi RPC 模型接入
- 会话状态与历史恢复
- 本地知识库目录读取与搜索 API
- Model Provider profile 与 Pi extension 托管
- 按知识库隔离的 session 存储

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
- 顶部知识库标题与设置面板
- 会话列表、新建、删除、切换
- 聊天框中的模型 / 思考切换
- 文件上传与 Inbox 浮窗
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
- settings / diagnostics / inbox API
- Provider profile 与托管 extension 生成

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

当前启动链路的首轮优化方向是：

- 前端首屏优先恢复会话列表和最近活跃会话
- `Pi options`、`slash`、`inbox` 这类非关键数据改成后台预热
- 桌面版继续由 Tauri 先拉起本地 FastAPI，再加载前端页面

## 5. Session 与状态

- 会话目录：`.gogo/pi-rpc-sessions/`
- registry：`gogo-session-registry.json`
- 应用层富历史：`gogo-session-turns/*.jsonl`
- 消息历史基础：Pi 原生 session JSONL
- 当前为 RPC-only 架构

更细的 session 机制见 [session-management.md](session-management.md)。

## 5.1 Model Provider 与认证

当前 `gogo-app` 对 Pi 模型接入采用“两层拆分”：

- `Provider 定义层`：由 `gogo-app` 托管，保存为 app 自己的 profile，并生成 `.gogo/pi-extensions/managed-providers.ts`
- `认证层`：尽量交给 Pi 自己管理，凭证继续写入 `~/.pi/agent/auth.json`

这样做的原因是：

- `gogo-app` 更擅长管理应用级设置、知识库隔离和 UI
- Pi 自己更适合管理 provider 登录、token 刷新和模型能力发现
- 未来桌面版接入时，可以直接复用 Pi CLI 的 `/login`，而不是在 `gogo-app` 里重复造一套 OAuth 登录器

当前策略：

- `API Provider`：由 `gogo-app` 生成 extension 定义，API key 写入 Pi 的 `auth.json`
- `OAuth Provider`：
  - 桌面版目标主路径：通过 Pi CLI `/login` 完成登录和自动刷新
  - 当前 Web 版兜底：允许在设置面板手动导入 token，便于兼容测试和过渡

为此，后端已经预留了稳定的登录桥接口：

- `POST /api/settings/pi-login`

当前在 Web 运行时，这个接口只返回“桌面版尚未接入”的提示；桌面壳接入后，这个接口会统一打开交互式 Pi CLI，并触发原生 `/login`，而不是继续承担 provider-specific 登录语义。

## 5.2 设置、Inbox 与 diagnostics

当前 `gogo-app` 的设置面板已经收敛成 3 个分组：

- `知识库`
- `模型与 Provider`
- `诊断`

其中：

- 知识库分组负责切换本地 knowledge-base 路径和展示最近使用列表
- 模型与 Provider 分组负责管理 Provider profile，以及 Web 版的过渡态认证配置
- 诊断分组负责集中展示知识库目录状态、session namespace、Pi runtime、provider 状态

聊天输入框区域还额外承载了两个和知识库工作流强相关的能力：

- 左下角模型 / 思考切换
- 右下角 `Inbox` 浮窗

`Inbox` 的定位不是单纯“上传成功提示”，而是：

- 当前知识库 `inbox/` 的可持续可见入口
- 文件上传、拖拽上传、删除、刷新和 ingest 提示词插入的统一工作台

## 6. 当前实现边界

已实现：

- 本地应用 UI
- Wiki/Raw 浏览
- Pi RPC 聊天主链路
- 多会话与历史恢复
- 运行时知识库切换
- Provider 设置面板与 diagnostics
- Inbox 上传 / 删除 / ingest 联动

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
- [documentation-cleanup-audit-2026-04-15.md](documentation-cleanup-audit-2026-04-15.md) - 当前文档覆盖性审计结果与本轮清理范围
- [desktop-packaging-options.md](desktop-packaging-options.md) - gogo-app 桌面应用封装方案评估与推荐路线
- [tauri-migration-plan.md](tauri-migration-plan.md) - 当前 Tauri 桌面壳实现与后续迁移顺序
