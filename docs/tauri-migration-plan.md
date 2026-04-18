# gogo-app Tauri 迁移方案

**最后更新**: 2026-04-17

> 本文档描述 `gogo-app` 从当前“Web 工作台 + 本地 FastAPI”形态迁移到 Tauri 桌面壳的推荐方案。  
> 当前仓库里的 Electron 可执行代码与历史说明文档都已清理。

## 0. 当前仓库状态

当前仓库已经落地了 Tauri 第一阶段代码：

- 已新增 `src-tauri/`
- 已新增 Tauri 主进程、后端启动器和基础 command
- 已恢复前端 `window.GogoDesktop` bridge
- 已恢复知识库目录选择按钮
- `desktop:dev` 已通过 `beforeDevCommand` 自动启动本地 FastAPI，并让 Tauri 连接 `http://127.0.0.1:8000`
- 已打通 Tauri bundle 资源映射，发布态可从 bundle resources 定位 `app/` 与 companion `knowledge-base/`
- 已接入独立桌面后端 runtime：`desktop:build` 会先用 PyInstaller 构建 `backend-runtime/`，发布态优先启动 bundle 内的独立后端
- 已把 `desktop:build` 重构为跨平台 Node 构建入口，不再依赖 Unix shell；默认只使用 `src-tauri/desktop-runtime-staging/` 作为 bundle 前的运行时 staging 目录
- 已在发布态把默认 knowledge-base、session 与 Pi extension 等可写状态收口到 app data 目录
- 已接入 companion knowledge-base 首次启动选址：当本地还没有已保存的知识库路径时，桌面版会先弹出系统目录选择器，并记住用户选择的 companion knowledge-base 位置
- 已把首次启动页收束成普通用户路径：桌面版会在启动阶段显示 `pi` 安装/检测、模型配置与诊断入口，并把“先浏览 Wiki”保留为清晰分支，而不是报错中断
- 已把 bundled `pi` 接入桌面打包链：构建时可通过 `GOGO_DESKTOP_PI_BINARY` 将上游 `pi` 运行目录收进 bundle resources，运行时优先使用
- 已保留 `pi` 检测与启动前后台安装作为 fallback：仅当 bundled / system `pi` 都缺失时，桌面版才会展示启动引导，并通过 `npm` 把 `pi` 安装到 app data 下的托管 `pi-runtime/`
- 已补齐 Windows 侧代码适配的基础骨架：桌面版登录桥现在会在 Windows 上通过 `cmd.exe` 拉起 bundled/system `pi` 并提示用户手动输入 `/login`；待 Windows 实机验收
- 已验证 macOS 调试构建可产出 `.app + .dmg`
- 已明确 Windows 首发安装介质先收敛到 `msi`；NSIS `-setup.exe` 暂不作为首发必做项
- 已确认一个 macOS 分发边界：upstream `pi` 运行目录本身可能被 Gatekeeper / quarantine 拦截，因此不能裸分发；后续应作为 `gogo-app.app` 的内嵌运行时统一签名，并纳入主应用 notarization
- `src-tauri/icons/icon.png` 当前先使用临时占位图标，后续应替换为 gogo-app 正式图标资产

当前已经踩过并修复的一个关键坑：

- **不要用 `cfg!(debug_assertions)` 区分 `tauri dev` 和“打包后的 debug 构建”**
  - `cargo/tauri` 的 debug bundle 同样会带有 `debug_assertions`
  - 如果用它判断“是否走开发态后端”，打包后的 debug `.app` 会错误地去连接 `http://127.0.0.1:8000`
  - 实际表现就是：应用窗口打开，但没有本地 dev server 时直接白屏
  - 当前修复方式是：在 `src-tauri/src/main.rs` 中改用 `tauri::is_dev()`，只有 `tauri dev` 才走开发服务器分支；所有打包产物都走 bundle 内后端

当前还没有完成的是：

- 在 Windows 本机或 CI runner 上验证新的跨平台 `desktop:build`，确认能产出 `backend-runtime/gogo-backend.exe` 与最终 `msi`
- 为 Windows 准备并验收 bundled `pi` 运行目录，确认 `pi.exe` 与其同目录运行时文件、OAuth `/login`、RPC 和 extension 链路都正常
- 在 macOS 上验证 bundled `pi` 随主 app 一起签名 / notarize 后的可执行性，而不是只验证 upstream runtime 本地可运行
- 把当前“启动前 fallback 安装 `pi`”继续前移到真正的安装器/首次启动向导，做到静默安装与普通用户无感补齐
- Windows 代码签名 / macOS Developer ID + notarization
- Windows 侧独立后端 runtime 与安装包链路验收

## 1. 迁移目标

Tauri 迁移的目标不是重写产品，而是把现有链路换成更轻量、安装更稳定的桌面外壳：

- 保留现有前端页面和交互
- 保留现有 FastAPI 后端与 Pi RPC 链路
- 用 Tauri 提供原生窗口、目录选择、打开路径、命令桥接
- 为后续 Pi CLI `/login`、文件监听、打包分发留出稳定入口

换句话说，目标架构是：

```text
Tauri WebView
  -> 加载 gogo-app 页面
  -> 页面继续请求本地 FastAPI
  -> FastAPI 继续调用 Pi RPC / knowledge-base
```

## 2. 为什么改用 Tauri

这次改向 Tauri，主要不是因为功能做不到，而是因为 Electron 在当前环境里带来了不必要的安装阻力：

- `npm install` 需要额外下载 Electron 二进制
- 下载链路容易受 GitHub Releases / TLS / timeout 影响
- 日常开发只为了一个桌面壳，却要承担较重的运行时和打包链

Tauri 的优势是：

- 首次项目安装更轻
- 不需要在 `npm install` 阶段额外拉取 Electron 运行时
- 最终包体和内存占用通常更小
- 对“本地 Web UI + 本地服务 + 原生命令桥”这种形态仍然足够友好

代价也很明确：

- 需要 Rust 工具链
- 调试体验和生态资料少于 Electron
- 桌面桥接要改成 Rust command / plugin 形态

## 3. 当前仓库适合的 Tauri 形态

对 `gogo-app` 来说，最合适的是“最小迁移版”：

- Tauri 只负责桌面壳
- FastAPI 仍然作为本地子进程启动
- WebView 直接加载 `http://127.0.0.1:<port>/`
- 前端继续使用现有 `index.html + assets/*.js`

不建议第一阶段就做这些：

- 把 FastAPI 改写进 Rust
- 把前端改成完整 SPA 构建链
- 在第一阶段就追求完整的安装器静默预装与自动更新

先把桌面壳跑通，再处理分发和内置运行时，会更稳。

## 4. 推荐目录结构

建议新增：

```text
gogo-app/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   └── src/
│       ├── main.rs
│       ├── backend.rs
│       └── commands.rs
├── app/
│   └── frontend/
│       └── assets/
│           └── desktop-bridge.js
└── docs/
    └── tauri-migration-plan.md
```

职责建议：

- `src-tauri/src/main.rs`
  应用入口、窗口创建、生命周期管理
- `src-tauri/src/backend.rs`
  启动 FastAPI、探活、退出时清理子进程
- `src-tauri/src/commands.rs`
  原生能力桥：目录选择、打开路径、后续 Pi CLI 登录
- `app/frontend/assets/desktop-bridge.js`
  前端统一桌面桥；Web 版空实现，Tauri 版走 `invoke`

## 5. 旧 Electron 代码到 Tauri 的映射

历史 Electron 文件和建议替代关系如下：

| 历史实现 | Tauri 对应位置 | 说明 |
|---|---|---|
| `electron/main.js` | `src-tauri/src/main.rs` | 应用启动、窗口、生命周期 |
| `electron/backend.js` | `src-tauri/src/backend.rs` | FastAPI 子进程与健康检查 |
| `electron/preload.js` | `src-tauri/src/commands.rs` + 前端 bridge | 不再使用 `window.GogoDesktop` |
| 前端直接判断 `window.GogoDesktop` | `desktop-bridge.js` | 用统一适配层替代平台细节 |

## 6. 前端改造建议

当前前端已经回退到纯 Web 行为，不再依赖 Electron preload。  
下一步迁移到 Tauri 时，建议不要再次把平台 API 直接散落到页面逻辑里，而是先抽一层：

```text
app/frontend/assets/desktop-bridge.js
  -> Web: 返回空实现 / not available
  -> Tauri: invoke("select_directory") / invoke("open_path")
```

建议暴露的最小接口：

```text
isDesktopRuntime()
selectKnowledgeBaseDirectory()
openPath(path)
triggerPiLogin(providerKey)
```

这样前端业务代码只认 bridge，不直接认 Electron 或 Tauri。

## 7. Tauri 第一阶段要做的能力

第一阶段只建议接 4 个能力：

1. 启动 FastAPI 子进程
2. 加载 `http://127.0.0.1:<port>/`
3. 打开系统目录选择器
4. 打开本地路径 / 文件

对应验收标准：

- 应用启动后能自动拉起后端
- 页面能正常打开已有工作台
- 用户能通过系统目录选择器切换知识库
- 关闭窗口时能正确清理后端子进程

## 8. 第二阶段能力

第一阶段稳定后，再补这些更像“桌面产品”的能力：

- 菜单 / 托盘
- 文件监听与变更刷新
- 原生日志目录与诊断导出
- 打包内置 Python 运行时

其中优先级最高的是：

1. 目录选择与路径打开
2. 内置 Python 运行时
3. 打包分发与诊断增强

当前补充说明：

- `Pi CLI /login` 桥已接通：
  - Tauri 会启动一个仅供本地 FastAPI 使用的桌面桥
  - 统一登录接口 `POST /api/settings/pi-login` 会通过该桥拉起系统终端中的交互式 `pi`
  - macOS 下会尽量自动输入原生 `/login`；若系统未授予自动输入权限，则退回为打开终端并提示用户手动执行
  - 前端会在触发后轮询 Provider 状态，检测到 `auth.json` 更新后自动刷新 Provider 与模型列表
- 启动体验已做一轮低风险优化：
  - 前端首屏优先恢复会话列表和最近活跃会话，`Pi options / slash / inbox` 改成后台预热
  - Tauri 端等待 FastAPI 就绪的健康检查轮询间隔从 `300ms` 收紧到 `100ms`，减少打包版起窗前的固定颗粒度等待
- 发布态资源路径已改为显式映射：
  - `app/` 与 `knowledge-base/` 会直接进入 bundle resources 下的稳定路径
  - companion knowledge-base 在桌面发布态会默认从 bundle template provision 到可写目录，而不是直接在只读资源目录内工作
- Debug bundle 白屏问题已经定位并修复：
  - 根因不是资源未打包，而是打包后的 debug `.app` 曾误用开发态分支
  - 修复后，debug `.app` 已可自动拉起 bundle 内 `backend-runtime`，并正常请求 `/`、静态资源与首屏初始化接口

## 9. 后端启动策略建议

Tauri 侧建议延续当前 Electron 版已经验证过的启动顺序：

1. `GOGO_DESKTOP_PYTHON`
2. 本地 `.venv/bin/python`
3. `uv run uvicorn ...`
4. `python3 -m uvicorn ...`
5. `python -m uvicorn ...`

这样迁移后，桌面壳变化不会影响后端运行策略。

建议 Tauri 侧继续设置这些环境变量：

- `GOGO_RUNTIME=desktop`
- `GOGO_DESKTOP_BACKEND_URL=http://127.0.0.1:<port>`
- `PYTHONUNBUFFERED=1`

## 10. Rust 侧建议依赖

第一阶段可优先考虑：

- `tauri`
- `tauri-build`
- `serde`
- `serde_json`
- `tokio`
- `tauri-plugin-dialog`
- `tauri-plugin-shell`

如果要自己做端口探测和子进程托管，也可以按实现需要补：

- `portpicker`
- `anyhow`

## 11. `package.json` 当前脚本

当前仓库已经加入这些脚本：

```json
{
  "scripts": {
    "backend:dev": "node ./scripts/backend-dev.mjs",
    "desktop:dev": "tauri dev",
    "desktop:build": "node ./scripts/desktop-build.mjs"
  }
}
```

## 12. 建议迁移顺序

### 第一步：建壳

- 初始化 `src-tauri/`
- 建立 Rust 入口
- 跑通一个空窗口

### 第二步：托管后端

- 迁移当前桌面后端启动器逻辑
- 加入健康检查
- WebView 指向本地 FastAPI

### 第三步：恢复最小原生桥

- 恢复“选择目录”
- 恢复“打开路径”
- 前端通过 `desktop-bridge.js` 调用

### 第四步：接 Pi CLI 登录

- 把统一登录接口 `POST /api/settings/pi-login` 接到真实桌面命令
- 明确 CLI 调用、日志回传和失败提示

### 第五步：再评估打包

- 确认是否内置 Python
- 确认 macOS 签名 / notarization
- 确认 Windows 产物形态

## 13. 风险与注意事项

- Tauri 解决的是 Electron 下载和包体问题，不会自动解决 Python 分发问题
- 如果桌面版要真正“开箱即用”，最终仍要处理 Python 运行时内置
- 前端不要再次把桌面 API 直接写死在平台全局对象上
- 第一阶段不要同时做“换壳 + 打包内置 Python + CLI 登录桥”，范围会过大

## 14. 最终建议

推荐执行策略：

1. 维持当前 Web 版可运行
2. 在现有 `src-tauri/` 基础上继续补齐 Rust 工具链与运行验证
3. 先做“启动 FastAPI + 加载本地页面 + 目录选择”三件事
4. 跑稳之后，再补 Pi CLI `/login` 和打包分发

这样迁移成本最低，也最符合 `gogo-app` 现有结构。
