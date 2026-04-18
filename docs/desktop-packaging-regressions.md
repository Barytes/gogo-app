# Desktop Packaging Regressions

**最后更新**: 2026-04-18

> 用途：记录桌面打包阶段出现过的真实回归、根因、修复方式和强制回归项。  
> 目标不是“复盘聊天”，而是让后续每次发包都能按同一套清单验证，避免再踩同类坑。

## 1. 2026-04-18：macOS `.app` 安装后启动即崩

### 现象

- 从 `npm run desktop:build` 得到的 `.app` / `.dmg` 可以产出
- 但把应用拖到 `/Applications` 后，双击会直接崩溃
- 崩溃栈落在 Tauri/tao 的 `did_finish_launching`
- 启动日志显示后端 setup 阶段失败

### 根因

- 构建成功不等于运行时资源已经完整进包
- 当时 `.app` 的 `Contents/Resources/` 内缺少完整的 `app/` 资源目录，尤其是：
  - `app/frontend/assets`
- 发布态后端通过 `GOGO_APP_ROOT` 把资源根目录指向 bundle 内的 `Contents/Resources`
- 后端启动时会挂载 `app/frontend/assets`；目录缺失会导致后端直接退出
- Tauri 壳随后因为 setup hook 失败而触发启动期崩溃

### 修复

- 不再只依赖 `tauri.conf.json > bundle.resources` 的复制结果
- `scripts/desktop-build.mjs` 在 Tauri build 结束后，强制把以下目录同步进最终 `.app`：
  - `Contents/Resources/app`
  - `Contents/Resources/backend-runtime`
  - `Contents/Resources/pi-runtime`
  - `Contents/Resources/knowledge-base`
- 同步后立即校验：
  - `backend-runtime/gogo-backend`
  - `app/frontend/assets`
- 最后基于修正后的 `.app` 重新生成 `.dmg`

### 验收标准

至少确认以下结果同时成立：

1. `open <gogo-app.app>` 后不再启动即崩
2. 启动日志出现：
   - `setup: bundled runtime path`
   - `setup: backend launched`
   - `setup: main window built`
3. `.app/Contents/Resources/app/frontend/assets` 实际存在
4. `.app/Contents/Resources/backend-runtime/gogo-backend` 实际存在

## 2. 2026-04-18：RPC 模式下未找到 `pi` 命令

### 现象

- 前端聊天或会话链路提示：
  - `RPC 模式下未找到 pi 命令，请检查环境配置。`
- 桌面版 diagnostics 中看不到可用 `pi` 命令
- `Pi Login`、RPC 会话、模型切换、思考水平切换等能力一起失效

### 根因

`app/backend/config.py` 的 `get_pi_command_path()` 只按以下顺序解析 `pi`：

1. bundle 内的 `pi-runtime/pi*`
2. 应用托管安装目录 `APP_STATE_DIR/pi-runtime/node_modules/.bin/pi*`
3. 系统 `PATH` 上的 `pi`

只要以下三者同时不满足，RPC 主链路就会失败：

- 安装包没有带 `pi-runtime`
- 首次启动没有成功装入托管 `pi`
- 用户机器本身也没有可见的 `pi`

这不是前端局部问题，而是桌面打包 / 发行策略没有把 Pi 运行时交付清楚。

### 修复与结论

- 发包时必须明确 Pi 的发行策略，不能再把“包能 build 成功”误当成“RPC 能运行”
- 当前首发策略下，更稳妥的要求是：
  - macOS / Windows 安装包内直接带可运行的 `pi-runtime`
  - 并在打包后显式验证 `Contents/Resources/pi-runtime/pi*` 是否存在
- 当前打包脚本已补成 fail-fast：
  - 若显式传了 `GOGO_DESKTOP_PI_BINARY`，则使用该路径
  - 若未显式传入，则按平台尝试默认 `../pi-runtime/...`
  - 如果两者都找不到，构建直接失败，不再静默产出缺少 `pi-runtime` 的安装包
- 如果未来改成“首次启动时托管安装”，也必须在干净机器上把该安装路径完整 smoke test 通过，不能只在开发机验证

### 验收标准

1. diagnostics 能显示实际命中的 `pi` 来源：
   - `bundled`
   - `managed`
   - `path`
2. RPC 会话能正常创建
3. `/api/settings/pi-login` 能拉起可用的 `pi`

## 3. 2026-04-18：模型与思考水平切换失败，前端表现为设置失败 / HTTP500

### 现象

- 用户在工作台切换模型或思考水平时失败
- 前端侧可能表现为：
  - `HTTP500`
  - 设置失败 toast
  - 聊天区追加“切换模型/思考水平失败”

### 根因

这类问题不要当成独立 UI Bug 处理。  
当前链路里，模型与思考水平切换本质上依赖 Pi RPC：

1. 前端调用 `PATCH /api/sessions/{session_id}/settings`
2. 后端进入 `SessionPool.update_session_settings()`
3. 该方法必须先拿到可用 `pi` 命令
4. 然后通过 RPC 依次执行：
   - `switch_session`
   - `set_model`
   - `set_thinking_level`
   - `get_state`

因此只要 Pi CLI 缺失、RPC 进程起不来、或发布态会话环境不完整，模型/思考设置就一定会失败。  
换句话说，这通常是“RPC 运行前提未满足”的下游表现，而不是一个单独的设置面板问题。

### 验收标准

发包后必须人工验证下面两条：

1. 新建一个真实会话，切换一次模型，刷新后状态仍正确
2. 再切换一次思考水平，刷新后状态仍正确

如果这两条没有过，就不能认为“桌面版的 RPC 链路已经可发布”。

## 4. 强制发包检查清单

### 4.1 构建产物完整性

发包后先检查 bundle 内容，不要直接把 `.dmg` 给用户：

- `Contents/Resources/app/frontend/assets`
- `Contents/Resources/backend-runtime/gogo-backend` 或 `gogo-backend.exe`
- `Contents/Resources/pi-runtime/pi` 或 `pi.exe`
- `Contents/Resources/knowledge-base`

### 4.2 启动冒烟

至少执行一次：

```bash
open src-tauri/target/release/bundle/macos/gogo-app.app
```

然后检查启动日志是否出现：

- `setup: bundled runtime path`
- `setup: backend launched`
- `setup: main window built`

### 4.3 RPC 冒烟

在真正的 `.app` 启动状态下验证：

1. diagnostics 能看到 `pi` 命令来源
2. 能发起一次真实聊天
3. 能切换模型
4. 能切换思考水平
5. `Pi Login` 能打开对应命令入口

### 4.4 干净机器要求

以下任一情况都不能视为“通过发布验证”：

- 只在开发仓库目录里运行过
- 只验证过 `npm run desktop:build`
- 只验证过应用能打开主窗口
- 没验证 RPC 会话、模型切换、思考水平切换

至少要在一台**没有当前开发环境兜底**的机器上确认：

- 没有仓库源码目录也能运行
- 没有本地 `.venv` / `uv` / 系统 `pi` 兜底也能运行，或安装引导路径已经被完整验证

## 5. 相关代码与文档

- `scripts/desktop-build.mjs`
- `src-tauri/tauri.conf.json`
- `src-tauri/src/main.rs`
- `src-tauri/src/backend.rs`
- `app/backend/config.py`
- `app/backend/session_manager.py`
- `app/backend/main.py`
- `docs/desktop-packaging-guide.md`
- `docs/problem-log.md`
