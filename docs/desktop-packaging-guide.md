# Desktop Packaging Guide

**最后更新**: 2026-04-24

> 这份指南面向仓库协作者、Windows/macOS 下的 Codex，以及需要从源码构建桌面安装包的人。  
> 它描述的是**当前仓库状态下**的打包方法与边界，不等同于“已经达到可对外发布标准”。

## 1. 先说结论

截至 **2026-04-18**：

- `gogo-app` 已经可以在 **macOS** 上从当前仓库稳定构建出 `.app + .dmg`
- `gogo-app` 的构建入口已经重构为**跨平台 Node 脚本**
- 代码层已经补齐了 **Windows** 所需的构建主链与 `pi` 登录桥基础骨架
- 但 **Windows 侧仍未在实机或 CI runner 上完成最终验收**

因此当前最准确的说法是：

- **可以上传到 GitHub 作为统一源码仓库**
- **macOS 已可直接按本文档打包**
- **Windows 已具备继续打包的代码基础，但还不能承诺“一定可直接打包成功”**

## 2. 当前构建入口

当前统一入口是：

```bash
npm run desktop:build
```

它会做这几件事：

1. 用 PyInstaller 构建独立后端 runtime
2. 把 bundled `pi` 运行目录 stage 到 `src-tauri/desktop-runtime-staging/`
3. 再调用 Tauri build，产出平台对应安装包

当前真正有效的桌面 staging 目录只有：

- `src-tauri/desktop-runtime-staging/backend/`
- `src-tauri/desktop-runtime-staging/pi/`

它们都是**构建时生成物**，不应手工维护，也不应提交运行时内容。

`src-tauri/tauri.conf.json` 不再静态声明这些 resources。`desktop:build`
会在构建时生成临时 Tauri 配置，把 `app/`、`backend-runtime/`、
`pi-runtime/` 和 companion `knowledge-base/` 显式写入 `bundle.resources`。
这样 `npm run desktop:dev` 不会因为本地尚未生成
`src-tauri/desktop-runtime-staging/backend/` 而在 Tauri 配置校验阶段失败。

Windows / macOS 的开发态 OAuth 登录入口也保留后端直连兜底：如果
`POST /api/settings/pi-login` 无法连接 Tauri 桥，Python 后端会直接打开
本机终端运行当前检测到的 `pi`，让用户继续手动输入 `/login`。
Windows 下登录桥会直接启动系统 PowerShell 并运行当前检测到的 `pi`；
只有本机找不到 PowerShell 时才退回 `cmd.exe`。不要把 OAuth 登录主链路
交给 `wt.exe` 二次解析命令行，否则 Windows Terminal 可能把 PowerShell
命令体误当成要启动的程序。

Windows NSIS 安装模式为 `both`：安装器会明确让用户选择“仅当前用户”或
“所有用户”。如果安装到 `Program Files` 这类需要管理员权限的位置，应选择
“所有用户”；仅当前用户安装应使用默认的 `%LOCALAPPDATA%\gogo-app`。
启动期日志会写入 `%TEMP%\gogo-app-desktop-startup.log`，用于排查安装版
只闪一下或主窗口未创建的问题。
Windows 发布态会把 bundle 内的 PyInstaller 后端 runtime 物化到
`%APPDATA%\space.aibuilders.gogoapp\bundled-resources\backend-runtime`；
该目录在后续启动中应被复用。若二次启动闪退，优先检查启动日志是否停在
复制 `backend-runtime/_internal/*.pyd`，这通常说明 managed runtime 复用或清理逻辑回归。
Windows release 版主程序必须以 GUI subsystem 构建，启动时不应出现额外
终端窗口；后端子进程应保持 `CREATE_NO_WINDOW`，并且 `backend.log` 不可写
时只能降级丢弃 stdout/stderr，不能导致桌面端 setup 失败。

## 2.1 强制回归清单

从 **2026-04-18** 起，`npm run desktop:build` 成功不再被视为“已通过桌面发包验证”。

每次发包前，必须额外执行并记录：

- bundle 资源完整性检查
- `.app` 启动冒烟
- RPC 会话冒烟
- 模型切换与思考水平切换冒烟
- 干净机器验证

专项记录与检查项见：

- [desktop-packaging-regressions.md](desktop-packaging-regressions.md)

## 3. 仓库中与打包相关的关键文件

### 3.1 必要源码

- `package.json`
- `scripts/backend-dev.mjs`
- `scripts/desktop-build.mjs`
- `src-tauri/tauri.conf.json`
- `src-tauri/src/main.rs`
- `src-tauri/src/backend.rs`
- `src-tauri/src/commands.rs`
- `app/backend/desktop_entry.py`
- `app/backend/`
- `app/frontend/`
- `../knowledge-base/`

### 3.2 平台无关的约定

- companion knowledge-base 模板来自 `../knowledge-base/`
- bundled `pi` 优先通过环境变量 `GOGO_DESKTOP_PI_BINARY` 指向某个平台对应 runtime 目录中的 launcher
- 若未显式传入 `GOGO_DESKTOP_PI_BINARY`，打包脚本会按平台尝试默认路径；找不到就直接 fail，不再静默产出一个“没带 Pi 的包”
- 当前推荐把各平台 `pi` runtime 放在项目根目录旁的：
  - `../pi-runtime/macos-arm64/`
  - `../pi-runtime/windows-x64/`

## 4. macOS 打包

### 4.1 前置条件

- Node `22` 或 `24`
- Rust toolchain
- Python 环境
- `uv`
- 一个可用的 companion `pi` runtime

当前 macOS 的 `pi` runtime 推荐路径：

```bash
../pi-runtime/macos-arm64/pi
```

### 4.2 构建命令

在 `gogo-app/` 目录下运行：

```bash
npm run desktop:build
```

当前 macOS arm64 默认会自动尝试：

```bash
../pi-runtime/macos-arm64/pi
```

如需覆盖默认来源，仍可显式指定：

```bash
GOGO_DESKTOP_PI_BINARY=../pi-runtime/macos-arm64/pi npm run desktop:build
```

如需调试构建：

```bash
GOGO_DESKTOP_PI_BINARY=../pi-runtime/macos-arm64/pi npm run desktop:build -- --debug
```

### 4.3 产物位置

- `.app`:
  - `src-tauri/target/<profile>/bundle/macos/gogo-app.app`
- `.dmg`:
  - `src-tauri/target/<profile>/bundle/dmg/gogo-app_<version>_aarch64.dmg`

### 4.4 当前已知边界

- macOS 上 bundled `pi` 不能裸分发上游 runtime 目录
- 最终对外发布前，需要随 `gogo-app.app` 一起签名并纳入 notarization
- 当前 companion knowledge-base 的模板 provision 已修复：若用户选定目录不完整，会自动补齐模板
- 若 bundle 内缺少 `app/`、`backend-runtime/` 或 `pi-runtime/`，应用可能表现为启动即崩、RPC 找不到 `pi`、模型/思考水平设置失败；这些都必须在发包前按专项回归清单显式验证
- 当前打包脚本已改为 fail-fast：若默认路径和 `GOGO_DESKTOP_PI_BINARY` 都无法提供可用的 Pi runtime，则构建会直接失败

## 5. Windows 打包

### 5.1 当前状态

当前仓库已经具备：

- 跨平台 `desktop:build`
- Windows 后端产物路径约定：`backend-runtime/gogo-backend.exe`
- Windows bundled `pi` 路径约定：`pi-runtime/pi.exe`
- Windows 桌面版 `/login` 终端拉起基础实现：通过 PowerShell 启动 bundled/system `pi`

但当前**仍未完成**：

- Windows 实机或 CI 打包验收
- Windows bundled `pi` runtime 实测
- Windows 最终安装包 smoke test

### 5.2 Windows 首发安装介质

当前首发策略先收敛为：

- **NSIS `-setup.exe`**

当前不再把 `msi` 作为首发必做项。

### 5.3 建议的 `pi` runtime 目录

建议把 Windows 的 runtime 放在：

```text
../pi-runtime/windows-x64/
```

其中应至少包含：

- `pi.exe`
- 以及 `pi.exe` 运行时所需的同目录文件

### 5.4 PowerShell 构建命令

在 `gogo-app/` 目录下运行：

```powershell
$env:GOGO_DESKTOP_PI_BINARY="..\pi-runtime\windows-x64\pi.exe"
npm run desktop:build
```

如需调试构建：

```powershell
$env:GOGO_DESKTOP_PI_BINARY="..\pi-runtime\windows-x64\pi.exe"
npm run desktop:build -- --debug
```

### 5.5 预期产物

当前目标是至少产出：

- `backend-runtime/gogo-backend.exe`
- 最终安装介质 `NSIS setup.exe`
- `%TEMP%\gogo-app-desktop-startup.log` 中应出现 `setup: main window built`
- 双击安装版只出现 `gogo-app` 桌面端窗口，不出现额外终端窗口

### 5.6 需要 Windows 侧继续验证的点

- `npm run desktop:build` 是否在 Windows 本机或 CI 上完整通过
- `backend-runtime/gogo-backend.exe` 是否能被 Tauri 发布态正常拉起
- `pi-runtime/pi.exe` 及其同目录 runtime 文件是否随包可用
- `/api/settings/pi-login` 是否能通过 PowerShell 正常打开终端并让用户输入 `/login`
- 中文路径与带空格路径是否正常

## 6. 推荐目录布局

建议在 `gogo/` 根目录附近保持如下结构：

```text
gogo/
├── gogo-app/
├── knowledge-base/
└── pi-runtime/
    ├── macos-arm64/
    │   └── pi
    └── windows-x64/
        └── pi.exe
```

## 7. 打包不等于可发布

当前很容易混淆两个概念：

1. 能从源码打出平台安装包
2. 已达到“面向普通用户可发布”的标准

当前仓库已经接近第 1 点，但还没有完成第 2 点。

仍然阻塞对外发布的包括：

- 4.3 Phase 3：首次启动引导、模型配置、本地诊断
- Windows 实机打包与验收
- Windows 代码签名
- macOS Developer ID 签名与 notarization
- 干净机器回归

## 8. 什么时候应该做 4.3

建议这样理解：

- **为了内部验证构建链**：可以先打包，再继续补 4.3
- **为了对外发布候选版本**：4.3 应视为发布前阻塞项

也就是说：

- “能打包”不必等 4.3 全做完
- “能对外给普通用户使用”则应把 4.3 基本做完

## 9. 推荐下一步

如果目标是让 Windows 下的 Codex 继续接手，建议顺序是：

1. 在 Windows 主机准备 `../pi-runtime/windows-x64/pi.exe`
2. 按本指南执行 `npm run desktop:build`
3. 验证能否产出 `backend-runtime/gogo-backend.exe` 与 `NSIS setup.exe`
4. 验证 bundled `pi` 登录链
5. 再继续完成 4.3
