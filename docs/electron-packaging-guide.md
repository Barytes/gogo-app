# gogo-app Electron 封装指南

**最后更新**: 2026-04-15

> 本文档面向当前 `gogo-app` 代码结构，说明如何把它封装成一个 Electron 桌面应用。  
> 目标不是“重写前后端”，而是在尽量复用现有 FastAPI + 前端工作台的前提下，引入桌面原生能力。

## 1. 目标

Electron 版 `gogo-app` 需要解决的核心问题有四类：

- 应用窗口：不再依赖外部浏览器
- 本地服务托管：自动启动和管理 FastAPI
- 原生能力桥接：
  - 选择知识库目录
  - 打开日志/状态目录
  - 后续拉起 Pi CLI 做 `/login`
- 桌面版能力扩展：
  - Wiki Markdown 编辑模式
  - 文件监听
  - slash 命令桥接

## 2. 当前架构与封装原则

当前 `gogo-app` 是：

```text
Browser
  -> Frontend (index.html + assets/*.js)
  -> FastAPI (app/backend/main.py)
  -> Pi RPC / knowledge-base local files
```

Electron 封装后建议变成：

```text
Electron Main
  -> 启动 FastAPI 子进程
  -> 创建 BrowserWindow
  -> preload / IPC 桥
  -> Frontend
  -> FastAPI
  -> Pi RPC / knowledge-base local files
```

设计原则：

- 前端尽量少改，继续访问本地 FastAPI
- Python 后端继续保留，不改成 Node 后端
- Electron 只负责“桌面壳 + 原生桥”
- 不把 Pi RPC 逻辑搬到 Electron 里

## 3. 推荐目录结构

建议在 `gogo-app` 根目录新增一个 Electron 子目录，例如：

```text
gogo-app/
├── app/
├── docs/
├── electron/
│   ├── main.js
│   ├── preload.js
│   ├── backend.js
│   └── package.json
└── ...
```

职责建议：

- `electron/main.js`
  - 创建窗口
  - 管理应用生命周期
  - 注册 IPC
- `electron/preload.js`
  - 暴露安全的桌面 API 给前端
- `electron/backend.js`
  - 启动 / 关闭 FastAPI
  - 做健康检查
- `electron/package.json`
  - Electron 依赖、dev script、打包配置

## 4. 第一版建议做法

### 4.1 启动本地 FastAPI

Electron 主进程启动时：

1. 选择一个本地端口
2. 启动 Python / uvicorn / 项目已有启动命令
3. 轮询 `GET /api/health`
4. 健康检查通过后再加载页面

建议不要一开始就把 FastAPI 内嵌进 Electron；  
更稳妥的是把它当作独立子进程托管。

### 4.2 BrowserWindow 加载本地服务

窗口加载目标建议是：

```text
http://127.0.0.1:<port>/
```

这样现有前端资源、FastAPI 路由、SSE/streaming 都能尽量原样复用。

### 4.3 preload 暴露桌面 API

建议通过 `contextBridge` 只暴露少量明确 API，例如：

- `selectKnowledgeBaseDirectory()`
- `openPath(path)`
- `getAppRuntimeInfo()`
- `startPiDesktopLogin(providerKey)` 以后再接

不要把完整 `ipcRenderer` 直接暴露给页面。

## 5. 最小实现清单

### Phase 1: Electron 壳跑起来

- 准备 `electron/package.json`
- 增加 `electron/main.js`
- 增加 `electron/backend.js`
- 启动 FastAPI
- 打开窗口加载 `http://127.0.0.1:<port>/`
- 应用退出时正确关闭后端子进程

### Phase 2: 接入知识库目录选择

- Electron 主进程调用系统文件夹选择器
- 通过 preload 暴露给前端
- 前端设置面板优先调用桌面 API
- Web 版继续保留“手动输入路径”兜底

### Phase 3: 接入 Pi CLI 登录桥

- 在 Electron 主进程里启动交互式 `pi`
- 给出独立终端窗口或嵌入式 PTY 方案
- 前端继续调用：
  - `POST /api/settings/model-providers/{provider_key}/desktop-login`
- Electron 负责把这个动作桥到本地 Pi CLI

### Phase 4: 接入本地编辑与文件监听

- Wiki Markdown 编辑模式
- 外部文件变化监听
- Inbox / wiki / raw 状态自动刷新

## 6. 主进程建议职责

Electron `main` 进程建议负责：

- 应用生命周期管理
- BrowserWindow 管理
- FastAPI 子进程启动/关闭
- 系统文件夹选择器
- 打开本地目录、日志目录
- 未来的 Pi CLI 交互桥

不建议在 main 进程里负责：

- 聊天流逻辑
- Wiki 解析
- Pi RPC JSONL 协议处理

这些仍应留在现有后端。

## 7. preload / IPC 建议

建议只暴露白名单 API：

```text
window.GogoDesktop = {
  isDesktopRuntime(),
  selectKnowledgeBaseDirectory(),
  openPath(path),
  startPiLogin(providerKey),
}
```

前端根据是否存在 `window.GogoDesktop`，决定：

- 当前是桌面版还是 Web 版
- 是否显示“选择目录”按钮
- 是否启用“Pi 登录”按钮的真实能力

这样可以保证：

- Web 版和桌面版前端共用一套 UI
- 只是根据 runtime capability 打开或关闭功能

## 8. FastAPI 启动建议

推荐思路：

- Electron 启动 Python 子进程
- 统一设置工作目录到 `gogo-app/`
- 显式传入桌面运行时环境变量，例如：
  - `GOGO_RUNTIME=desktop`

这样后端就能区分：

- Web 版：`GOGO_RUNTIME=web`
- Electron 版：`GOGO_RUNTIME=desktop`

当前 `gogo-app` 的 Provider / diagnostics 已经开始按这个思路留接口了，因此 Electron 版可以直接接上。

## 9. 开发与调试建议

开发期建议保留两套启动方式：

### 9.1 Web 模式

继续使用当前方式：

- 单独启动 FastAPI
- 浏览器访问本地页面

### 9.2 Electron 模式

Electron 负责：

- 启动后端
- 打开窗口
- 打印后端日志

这样可以把问题分成两类：

- Web / 后端本身的问题
- 桌面壳和原生桥的问题

## 10. 打包建议

第一版打包目标建议优先：

- macOS

原因：

- 当前开发环境就是 macOS
- 目录选择、Pi CLI、知识库路径、文件监听都可以先在单平台跑通

打包上建议：

- 先把 Electron 壳跑通
- 再决定是否把 Python 环境一起打包

第一阶段不一定要立刻做“全离线独立安装包”，也可以先做：

- 开发机可运行的 Electron App
- 明确依赖本地 Python / uv 环境

第二阶段再考虑：

- bundling Python
- 安装器
- 自动更新

## 11. 关键风险

### 11.1 Python 运行时分发

这是 Electron + Python 路线里最现实的问题之一：

- 是要求用户本地有 Python / uv？
- 还是一起打进安装包？

建议第一阶段不要过早优化，先跑通桌面链路。

### 11.2 FastAPI 端口管理

要明确：

- 端口如何分配
- 端口被占用时怎么办
- 多开应用是否允许

第一版建议：

- 单实例应用
- 固定端口失败则回退到随机可用端口

### 11.3 Pi CLI 交互

Pi CLI 登录桥是 Electron 版的关键收益点，但也是需要额外设计的点：

- 用系统终端拉起
- 还是嵌入式终端组件
- 如何感知登录完成
- 如何处理取消和失败

这块建议在 Electron 跑通后单独做一期。

## 12. 推荐落地顺序

推荐按这个顺序推进：

1. Electron 壳 + 启动 FastAPI
2. 桌面运行时标识 `GOGO_RUNTIME=desktop`
3. 原生选择知识库目录
4. 打通设置面板里的 `Pi 登录` 桥
5. Wiki Markdown 编辑模式
6. slash 命令按钮与 Pi 原生命令桥

## 13. 结论

对当前 `gogo-app` 来说，Electron 封装的最优思路不是“重写产品”，而是：

- 保留当前 FastAPI + 前端工作台
- 用 Electron 托管本地服务与桌面能力
- 逐步把目录选择、Pi CLI 登录、Markdown 编辑、slash 命令桥接接进来

也就是说：

- **后端继续是 Python**
- **前端继续是现有工作台**
- **Electron 只做桌面壳和原生桥**

这是最符合当前代码现状、也最容易分阶段推进的路线。
