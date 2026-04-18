# 开发问题记录

**最后更新**: 2026-04-18

> 用途：记录开发过程中出现过的真实问题、根因和解决方案，方便后续快速复用排查思路。  
> 建议新增问题时尽量保持这几个字段：现象、影响范围、根因、修复、验证。

## 2026-04-18：桌面打包回归导致 `.app` 崩溃、RPC 找不到 `pi`、模型/思考设置失败

### 现象

- 新 build 出来的 macOS `.app` 安装后启动即崩
- 聊天 / 会话链路提示 `RPC 模式下未找到 pi 命令，请检查环境配置。`
- 模型与思考水平切换失败，用户侧报告为设置失败 / HTTP500

### 影响范围

- Tauri 发布态启动链路
- Pi RPC 会话链路
- 模型切换
- 思考水平切换
- `Pi Login` 与 diagnostics

### 根因

- “能打包成功”不等于“运行时资源已经完整进入 `.app`”
- 本次问题至少暴露出两类发布态前提没有被显式验证：
  - bundle 内缺少 `app/frontend/assets`，导致后端 setup 直接失败
  - bundle / 托管安装 / PATH 三条路径都没有提供可用 `pi`，导致 RPC 主链路失效
- 模型与思考水平切换并不是独立问题；它本质上依赖同一条 Pi RPC 链路，因此会跟着一起失败

### 修复

- `scripts/desktop-build.mjs` 在 Tauri build 结束后，强制同步 `app/`、`backend-runtime/`、`pi-runtime/`、`knowledge-base/` 到最终 `.app`
- 新增专项文档：
  - [desktop-packaging-regressions.md](desktop-packaging-regressions.md)
- 后续发包必须按专项文档里的 bundle 完整性、启动冒烟、RPC 冒烟、干净机器验证清单执行

### 验证建议

1. `open` 打包后的 `.app`
2. 检查启动日志中是否出现 `setup: backend launched` 与 `setup: main window built`
3. 打开 diagnostics，确认 `pi` 来源存在
4. 创建真实会话并发送消息
5. 切换模型与思考水平，确认刷新后仍正确

> 详细复盘与后续发包清单见 [desktop-packaging-regressions.md](desktop-packaging-regressions.md)。

## 2026-04-16：重开 app 后，“思考过程”恢复成零散短句

### 现象

- 桌面版关闭再重新打开后，旧会话还能恢复
- 但 assistant 气泡里的“思考过程”不再完整
- 原本应该展示为结构化 `trace` / worklog 的内容，退化成几条零散短句，例如：
  - “我来查阅本地知识库中关于纳瓦尔和‘真本事’的相关内容。”
  - “让我再查一下纳瓦尔关于 networking 的具体表述……”

### 影响范围

- `GET /api/sessions/{id}/history`
- 前端 `hydrateSessionHistoryFromStore()` 之后的历史重建
- 关闭应用、刷新页面、切换回旧会话等“历史恢复”场景

### 根因

- `session_manager.py` 会同时参考两类历史：
  - Pi 原生 session 历史
  - 应用层 `gogo-session-turns/*.jsonl` 富历史
- 应用层富历史里保存了前端恢复真正需要的：
  - `trace`
  - `warnings`
  - `consulted_pages`
- 第一版修复虽然放宽成“尾部用户消息能对齐即可”，但仍然默认两份历史的尾部条目数量和回合边界大致一致
- 实际上，Pi 的 `get_messages()` 会把一些中间 assistant 状态消息也展开返回，例如：
  - “我来查阅本地知识库……”
  - “让我再查一下……”
- 这会导致 Pi 历史里的 assistant 条目数明显多于应用层富历史，尾部逐条合并依然失败
- 一旦失败，接口就回退为仅返回 Pi 原生历史；这份历史没有完整 `trace`，前端就只能恢复出零散文本，而不是完整“思考过程”

### 解决方案

- 历史恢复改成两级合并：
  - 第一层仍然尝试尾部回合合并
  - 如果 Pi 历史里混入了额外 assistant 中间消息，则退回到“按用户回合序列对齐”的合并方式
- 只要用户消息序列能够对齐，就允许用应用层富历史替换对应区段，从而恢复每轮最终 assistant 回答以及其中的：
  - `trace`
  - `warnings`
  - `consulted_pages`
- 这样既能保留 Pi 历史中更早的前缀消息，也不会让中间状态型 assistant 文本把富历史挤掉
- 对应代码：
  - `app/backend/session_manager.py`
  - `_merge_rich_history_tail()`
  - `_merge_rich_history_by_user_turns()`

### 验证建议

1. 发起一条会产生明显“思考过程”的问题
2. 等待回答结束，确认当前会话里能看到完整 worklog
3. 关闭 app 再重新打开
4. 进入同一会话，确认“思考过程”仍是完整的结构化记录，而不是零散短句
