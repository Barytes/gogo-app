# gogo-app

本地知识库工作台：浏览 `Wiki / Raw`，并通过 Pi RPC 驱动聊天式研究助手。

## 当前发布边界

截至 **2026-04-17**，当前仓库应理解为：

- 对外目标：做成普通用户可直接安装的 Windows / macOS 桌面应用
- 正式产品形态：桌面版；Web 版不作为正式对外产品
- 已支持：从源码运行的 Web 版
- 已支持：从源码运行的 Tauri 桌面开发版
- 尚未完成：面向最终用户稳定分发并验收完成的 Windows / macOS 安装包

也就是说，方向已经明确是“普通用户可直接安装”，当前也已经打通了 Tauri 发布态资源与 macOS `.app/.dmg` 基础构建；但现实状态仍然是“开发者可运行的桌面版先行，正式安装包尚未验收完成”。

如果你需要对外介绍当前状态，请优先参考：

- [docs/release-target-and-boundaries.md](docs/release-target-and-boundaries.md)

## 当前能力

- 单页工作台：`Wiki` / `Chat` 双布局
- 连接并切换外部 knowledge-base
- 多会话聊天与“思考过程”恢复
- 模型 / 思考水平切换
- 上传文件到 `inbox/` 并驱动 ingest
- 设置面板中的 Provider 与 diagnostics
- Tauri 桌面壳第一期实现

## Web 模式启动

当前适用对象：

- 开发者
- 愿意自己准备本地环境的技术用户

说明：

- Web 版当前主要用于开发、调试和技术验证
- 它不是面向普通用户的最终交付形态

1. 从 `.env.example` 创建 `.env`
2. 配置 `KNOWLEDGE_BASE_DIR`
3. 安装 Python 依赖

```bash
uv sync
```

4. 启动 FastAPI

```bash
uv run uvicorn app.backend.main:app --reload
```

5. 打开：

- `http://127.0.0.1:8000/`

兼容入口：

- `http://127.0.0.1:8000/chat`
- `http://127.0.0.1:8000/wiki`

## 桌面版状态

当前仓库里的桌面实现已经切到 Tauri，旧 Electron 可执行代码与历史文档都已清理。

当前这部分的定位是：

- 对外目标所对应正式桌面版的前置落地阶段
- 可供开发者和小范围内测运行与验证的桌面开发版
- 不是已经完成最终用户分发的正式桌面安装包

当前桌面链路仍依赖外部环境：

- Node `22` 或 `24`
- Rust 工具链
- Python 运行时
- 一个可用的 knowledge-base 目录
- 若没有 bundled 或系统可用的 `pi`，当前桌面版会退回到启动界面的 fallback 安装；这条路径当前仍依赖本机可用的 `npm`

如果你要运行桌面版，先准备：

1. Node `22` 或 `24`
2. Rust 工具链
3. 平台原生桌面依赖

然后安装 Node 依赖：

```bash
npm install
```

启动 Tauri 开发版：

```bash
npm run desktop:dev
```

开发模式下，Tauri 会先通过 `beforeDevCommand` 自动启动本地 FastAPI，再等待 `http://127.0.0.1:8000` 就绪，所以不需要你手动先开一个 uvicorn。

当前 Tauri 版会：

- 启动并托管本地 FastAPI 子进程
- 探活 `/api/health`
- 创建原生窗口并加载本地工作台页面
- 通过桌面桥恢复“选择知识库目录”
- 通过统一登录入口打开 Pi CLI，并尝试触发原生 `/login`，然后在登录完成后自动刷新 Provider 状态

如果后续要构建桌面产物，再运行：

```bash
npm run desktop:build
```

当前 `desktop:build` 已改为 **跨平台 Node 构建入口**，不再依赖 `sh`、`rm`、`mv`、`find` 这些 Unix shell 能力；默认会把桌面运行时收敛到 `src-tauri/desktop-runtime-staging/`，供 Tauri bundle 统一取用。  
目前已经在 macOS 上重新验证通过；Windows 侧还需要实机或 CI runner 验收最终产物。

如果已经拿到当前平台解压后的 `pi` 运行目录，可以把其中的 `pi` 可执行文件路径传给构建脚本。`desktop:build` 现在会先读取 `gogo-app/.env`，所以也可以直接把这条配置写进 `.env`：

```bash
GOGO_DESKTOP_PI_BINARY=./pi-runtime/macos-arm64/pi npm run desktop:build
```

也支持配置 runtime 根目录：

```bash
GOGO_DESKTOP_PI_RUNTIME_ROOT=./pi-runtime
```

默认搜索顺序现在是：

- `GOGO_DESKTOP_PI_BINARY`
- `GOGO_DESKTOP_PI_RUNTIME_ROOT`
- `gogo-app/pi-runtime`
- `../pi-runtime`

当前 `desktop:build` 会先构建一个独立的桌面后端 runtime，再继续执行 Tauri bundle；在 macOS 上，非沙箱环境下已验证可产出 `.app/.dmg`。  
当前桌面版已经把 bundled `pi` 接入了打包链：如果在构建时提供 `GOGO_DESKTOP_PI_BINARY`，`desktop:build` 会把该路径所在的上游 `pi` 运行目录整体打进安装包，并在运行时优先使用。  
这是因为当前 upstream `pi` 在 macOS 上仍会读取同目录下的 `package.json` 等运行时文件，不能只复制单个 `pi` 文件。  
如果既没有 bundled `pi`，又没检测到系统里的 `pi`，启动时才会退回到 fallback 安装引导，把 `pi` 装到 app data 下的托管目录。  
Windows 首发安装介质目前先按 **NSIS `-setup.exe`** 收敛，不再把 `msi` 作为首发必做项。  
需要特别注意的是：**macOS 上不能直接裸分发 upstream `pi` 运行目录**；它应作为 `gogo-app.app` 的内嵌运行时一起签名，并纳入主应用的 notarization。  
但它**仍不应直接等同于已经完成最终用户分发安装包**，因为真正的安装器静默安装、Windows 构建验收、签名与干净机器回归还没完成。

当前 companion knowledge-base 的路径策略是：

- 首次启动时会弹出系统目录选择器
- 你可以选择把 companion knowledge-base 放到哪个目录
- 选择结果会被记住，后续打包版会继续使用这个路径
- 如果取消选择，则回退到应用自己的默认 app data 目录
- 首次启动页当前已收敛成 3 步向导：欢迎页 -> 模型配置 -> 知识库目录；完成后才会进入主界面
- 设置面板里的“诊断”页现在已经提供查看状态、打开日志和导出本地诊断摘要的入口

一个已经踩过并修复的坑：

- 打包后的 **debug** 桌面产物不能再按 `cfg!(debug_assertions)` 当作“开发态”处理
- 否则 debug `.app` 会误去连接 `http://127.0.0.1:8000`，在没有本地 dev server 时表现为白屏
- 当前已经改成：只有 `tauri dev` 才走开发服务器；所有打包产物都走 bundle 内后端

当前仍然保留的已知边界：

- 对外目标已经明确是“普通用户可直接安装”，但当前尚未达到这个交付标准
- macOS `.app/.dmg` 基础 bundle 已能产出，但 Windows / macOS 最终用户安装包尚未完成验收闭环
- 桌面构建已包含独立后端 runtime，且构建入口已改成跨平台 Node 脚本；但 Windows 侧构建与跨平台验收仍未完成
- companion knowledge-base 已可随安装包资源提供，并在发布态默认 provision 到可写目录；但安装过程中让用户自行决定路径的链路尚未落地
- 当前聊天与 OAuth 登录链路仍依赖 `pi`，但桌面版已经支持在启动阶段检测并安装到托管目录
- 当前仅计划支持 API key 型 provider，以及 `pi` 已稳定支持且桌面引导已验证通过的 OAuth
- 首发阶段 API key 仅保存在本机认证文件中，不自动上传；当前暂不接入 macOS Keychain / Windows Credential Manager
- 自动更新尚未实现

Tauri 设计与当前实现边界见：

- [docs/tauri-migration-plan.md](docs/tauri-migration-plan.md)
- [docs/release-target-and-boundaries.md](docs/release-target-and-boundaries.md)
- [docs/desktop-packaging-guide.md](docs/desktop-packaging-guide.md)

## 关键文档

- [docs/release-target-and-boundaries.md](docs/release-target-and-boundaries.md)
- [docs/gogo-app-architecture.md](docs/gogo-app-architecture.md)
- [docs/frontend-workbench-elements.md](docs/frontend-workbench-elements.md)
- [docs/session-management.md](docs/session-management.md)
- [docs/tauri-migration-plan.md](docs/tauri-migration-plan.md)
- [docs/index.md](docs/index.md)
