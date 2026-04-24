# Desktop Packaging Regressions

**最后更新**: 2026-04-24

> 用途：记录桌面打包阶段出现过的真实回归、根因、修复方式和强制回归项。  
> 目标不是“复盘聊天”，而是让后续每次发包都能按同一套清单验证，避免再踩同类坑。

## 0. 2026-04-24：`desktop:dev` 被打包 staging 资源阻塞

### 现象

- 在 Windows 上运行 `npm run desktop:dev`
- Tauri 配置校验失败并提示 `resource path desktop-runtime-staging\backend doesn't exist`

### 根因

- `src-tauri/tauri.conf.json` 静态声明了发布打包用的 `bundle.resources`
- 其中 `desktop-runtime-staging/backend` 和 `desktop-runtime-staging/pi` 只会由
  `npm run desktop:build` 临时生成
- `tauri dev` 不需要这些发布态资源，但仍会校验配置中声明的 resource 路径

### 修复

- 从基础 `src-tauri/tauri.conf.json` 移除静态 `bundle.resources`
- 继续由 `scripts/desktop-build.mjs` 在 `desktop:build` 时生成临时 Tauri 配置并写入完整资源清单

### 验收标准

1. 干净工作区中未生成 `src-tauri/desktop-runtime-staging/backend/` 时，`npm run desktop:dev` 不再因 resource path 缺失失败
2. `npm run desktop:build` 仍会把 `app/`、`backend-runtime/`、`pi-runtime/` 和 companion `knowledge-base/` 写入 bundle resources

## 0.1 2026-04-24：Windows 开发态 Pi 登录兜底缺失

### 现象

- Windows 下点击 OAuth 登录入口
- 后端返回 `当前开发态兜底登录只实现了 macOS。`
- 修复 macOS-only 后，继续出现 `文件名、目录名或卷标语法不正确。`

### 根因

- `POST /api/settings/pi-login` 会优先调用 Tauri 桥
- 当开发态桥地址缺失或不可连接时，Python 后端会走直连兜底
- 该兜底原先只实现了 macOS Terminal 分支，没有 Windows `cmd.exe` 分支
- Windows `cmd.exe /K` 的命令体不能可靠地作为 Python 参数数组中的单独参数传入，否则 Python 的参数拼接会和 `cmd.exe` 引号规则冲突

### 修复

- Python 后端新增 Windows 直连兜底：打开 `cmd.exe /K`，切到 app 根目录，并运行当前检测到的 `pi`
- Windows 兜底会清洗 `\\?\\` / `\\?\\UNC\\` 路径前缀，并保留 managed provider extension 参数
- Windows 兜底改为传完整命令行字符串启动 `cmd.exe /K ...`，避免参数数组转义破坏 `cd /d "..." && call "...pi.cmd"` 这类命令
- 由于 `cmd.exe` 对 Pi CLI 的交互式菜单容易出现残影，Windows 登录桥进一步改为优先直接启动 PowerShell；若缺少 PowerShell，最后才退回 `cmd.exe`

### 验收标准

1. Windows `desktop:dev` 下点击 Pi OAuth 登录入口，不再出现 macOS-only 提示
2. 不再出现 `文件名、目录名或卷标语法不正确。`
3. 系统打开 PowerShell 或兜底 `cmd.exe` 窗口并启动 `pi`，用户可在其中输入 `/login`
4. Pi CLI 的 provider 选择菜单没有明显拖影；若系统终端渲染仍异常，再单独评估 Windows Terminal 作为用户手动入口

## 0.1.1 2026-04-24：Windows 11 OAuth 登录被 Windows Terminal 误解析

### 现象

- 在另一台 Windows 11 设备上完成安装和欢迎页模型配置。
- 点击 OAuth 登录后，终端提示：
  - `出现错误 2147942402 (0x80070002)`
  - `启动“" & 'C:\Program Files\gogo-app\pi-runtime\pi.exe'"”时`
  - `系统找不到指定的文件。`

### 根因

- 这不是普通的 `pi.exe` 路径检测错误，而是 Windows Terminal 对命令行做了二次解析。
- `wt.exe` 没有稳定地把 `powershell.exe -Command ...` 作为一个 PowerShell 会话启动，反而把命令体里的 `& '...\pi.exe'` 片段当成了要启动的程序。
- 因为这个“程序名”当然不存在，所以报 `0x80070002`。

### 修复

- Rust 桌面桥和 Python 开发态兜底都不再优先调用 `wt.exe`。
- Windows OAuth 登录现在直接启动 `powershell.exe -NoExit -NoProfile -ExecutionPolicy Bypass -Command ...`。
- `cmd.exe /K` 仅保留为 PowerShell 不存在时的最终兜底。

### 验收标准

1. Windows 11 安装版点击 OAuth 登录时，不再出现 `0x80070002` 或“启动 `& '...\pi.exe'`”。
2. 打开的终端进程是 PowerShell，并能运行 bundled `pi-runtime\pi.exe`。
3. 用户可在该终端中输入 `/login` 完成 Pi 原生 OAuth 登录。

## 0.2 2026-04-24：Windows 安装目录为空导致启动只闪一下

### 现象

- `npm run desktop:build` 成功产出 NSIS `setup.exe`
- 安装后点击 `gogo-app`，只有一个命令行窗口一闪而过，主窗口没有打开
- 检查发现历史安装目录 `D:\Program Files\gogo-app` 存在但为空

### 根因

- NSIS 默认 `installMode` 是 `currentUser`
- 安装器会恢复上一次保存的安装路径
- 如果历史路径是 `Program Files` 这类更适合 per-machine/admin 的位置，current-user 安装可能留下空目录或不可用入口
- 旧版本主进程启动日志写到 `/tmp/gogo-app-desktop-startup.log`，Windows 下不可用，导致闪退时缺少 Tauri setup 线索

### 修复

- `src-tauri/tauri.conf.json` 将 NSIS `installMode` 改为 `both`
- Windows 用户安装时可以明确选择“仅当前用户”或“所有用户”
- 如果选择 `Program Files`，应走“所有用户”并触发管理员权限
- Tauri 主进程启动日志改写到 `%TEMP%\gogo-app-desktop-startup.log`

### 验收标准

1. 生成的 `installer.nsi` 包含 `!define INSTALLMODE "both"`
2. 临时目录安装后包含 `gogo-app-desktop.exe`、`gogo-backend.exe`、`app/`、`backend-runtime/`、`pi-runtime/` 和 `knowledge-base/`
3. 启动安装版后 `%TEMP%\gogo-app-desktop-startup.log` 出现 `setup: main window built`
4. `gogo-app-desktop` 与 `gogo-backend` 进程均能保持运行，主窗口标题为 `gogo-app`

## 0.3 2026-04-24：Windows 首次欢迎页关闭后二次启动闪退

### 现象

- Windows 安装版第一次启动可以进入首次欢迎页面。
- 关闭欢迎页面后，再次点击 `gogo-app`，只出现一个短暂黑色命令行窗口，主窗口不再打开。
- `%TEMP%\gogo-app-desktop-startup.log` 显示 Tauri 已进入 setup，但在准备 backend runtime 时 panic。

### 根因

- Windows 下 bundled PyInstaller 后端会先从安装目录复制到可写的 app data：
  - `%APPDATA%\space.aibuilders.gogoapp\bundled-resources\backend-runtime`
- 第二次启动时旧逻辑会再次把完整 `backend-runtime` 复制到同一个目的地。
- 复制覆盖 `_internal/httptools/parser/*.pyd` 等 Python 扩展文件时，如果目标文件已存在、被占用或不可覆盖，就会返回错误。
- 该错误从 Tauri setup hook 冒出，导致主窗口还没创建应用就退出。

### 修复

- 桌面后端启动器现在会先检查 app data 下已物化的 runtime 是否完整。
- 如果 `bundled-resources/backend-runtime/gogo-backend.exe` 与 `_internal/` 已存在，则直接复用，不再重复复制 bundle。
- 如果只存在半成品 runtime 目录，则先删除后重建。

### 验收标准

1. 安装后首次启动可以进入欢迎流程。
2. 关闭欢迎流程后再次启动，主窗口仍能正常打开。
3. 首次与二次启动的 `%TEMP%\gogo-app-desktop-startup.log` 都能走到 `setup: main window built`。
4. `%APPDATA%\space.aibuilders.gogoapp\bundled-resources\backend-runtime` 会跨启动复用。

## 0.4 2026-04-24：Windows 启动时出现额外终端窗口且关闭终端会退出桌面端

### 现象

- Windows 10 / Windows 11 安装版启动后同时出现两个窗口：
  - `gogo-app` 桌面端窗口
  - 一个额外的终端窗口
- 关闭额外终端窗口后，`gogo-app` 桌面端也会被关闭。
- 部分 Windows 10 设备还会在启动期闪退，启动日志停在打开 `logs/backend.log`。

### 根因

- Tauri 主程序在 Windows release 下仍按 console subsystem 运行，双击启动时会额外创建控制台窗口。
- 后端子进程虽然已经使用 `CREATE_NO_WINDOW`，但主进程控制台仍会影响用户体验，并可能让用户误关掉整个进程树。
- 另外，`logs/backend.log` 打不开时旧逻辑会把错误冒泡到 Tauri setup hook，导致主窗口创建前退出。

### 修复

- `src-tauri/src/main.rs` 为 Windows release 添加 `windows_subsystem = "windows"`，主程序按 GUI 应用启动。
- 后端子进程继续使用 `CREATE_NO_WINDOW`。
- Windows 后端日志打开失败时降级为 `stdout/stderr = null`，不再阻塞应用启动。

### 验收标准

1. Windows 10 / Windows 11 安装版双击启动时只出现 `gogo-app` 桌面端窗口。
2. 不再出现可关闭后连带关闭桌面端的额外终端窗口。
3. 即使 `%APPDATA%\space.aibuilders.gogoapp\logs\backend.log` 暂时不可写，桌面端也不应在 setup 阶段闪退。

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
