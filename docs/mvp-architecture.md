# 课题组公共知识库 Web MVP 架构

## 概览

这个仓库是应用层，不存放知识内容本身。

它当前提供一个单页工作台：

- 左侧或主画布浏览外部 `knowledge-base` 仓库中的 `wiki/` 与 `raw/`
- 右侧以浮窗形式展示聊天面板
- `/api/chat` 固定使用 Pi SDK

知识内容、提示词、schemas 仍然在外部 `knowledge-base` 仓库中，通过 `KNOWLEDGE_BASE_DIR` 连接。

## 当前系统

```text
Browser
  -> unified workbench
      - wiki/raw browser
      - floating chat panel
  -> FastAPI
      - page shell
      - wiki/raw APIs
      - agent chat API
  -> external knowledge-base repo
      - wiki/
      - raw/
```

## 技术选择

| 层级 | 方案 | 说明 |
|------|------|------|
| 前端 | 原生 HTML/CSS/JS | 无构建步骤，单页工作台 |
| 后端 | FastAPI | 页面分发、知识库 API、agent chat API |
| Python 管理 | `uv` | Python 依赖安装与运行 |
| Node 依赖 | `npm` | 用于 Pi SDK bridge |
| 内容来源 | 外部文件仓库 | 通过 `KNOWLEDGE_BASE_DIR` 读取 `wiki/` 与 `raw/` |
| Agent 后端 | Pi SDK | 固定由 Python -> Node bridge -> Pi SDK 执行 |

## 目录

```text
gogo-app/
├── app/
│   ├── backend/
│   │   ├── agent_service.py
│   │   ├── config.py
│   │   ├── main.py
│   │   ├── pi_sdk_bridge.mjs
│   │   ├── raw_service.py
│   │   └── wiki_service.py
│   └── frontend/
│       ├── index.html
│       └── assets/
│           ├── chat.js
│           ├── styles.css
│           ├── wiki.js
│           └── workbench.js
├── docs/
│   ├── mvp-architecture.md
│   └── product-definition-belief.md
├── package.json
├── pyproject.toml
└── README.md
```

## 前端

前端只保留一个页面：[app/frontend/index.html](../app/frontend/index.html)。

布局特点：

- `Wiki 模式`：wiki/raw 占主画布，chat 为右侧可隐藏浮窗
- `Chat 模式`：chat 占主画布，wiki/raw 为右侧可隐藏浮窗
- 页面会读取 `/api/health`，显示当前实际 agent backend
- raw 中的文本可直接展示，PDF 可内嵌预览，其他二进制文件提供原文件入口

核心脚本：

- `workbench.js`：工作台模式与浮窗显隐
- `wiki.js`：wiki/raw 列表、搜索、详情与引用
- `chat.js`：聊天历史、建议问题、后端状态显示

## 后端

后端入口是 [app/backend/main.py](../app/backend/main.py)。

主要职责：

- 返回单页工作台
- 提供 `wiki` / `raw` 浏览 API
- 提供 `/api/chat` 和 `/api/health`
- 将聊天请求转发到 `agent_service.py`

页面路由：

- `/`
- `/chat`
- `/wiki`
- `/assets/*`

API 路由：

- `/api/health`
- `/api/chat/suggestions`
- `/api/chat`
- `/api/wiki/pages`
- `/api/wiki/tree`
- `/api/wiki/page`
- `/api/wiki/search`
- `/api/raw/files`
- `/api/raw/file`
- `/api/raw/search`
- `/raw/file`

## 服务划分

### `wiki_service.py`

- 读取外部 `wiki/` Markdown
- 生成页面列表、树结构、详情和搜索结果

### `raw_service.py`

- 读取外部 `raw/` 文件
- 区分文本、PDF 和其他二进制材料
- 返回列表、详情、搜索结果和下载路径

### `agent_service.py`

- 统一的 `/api/chat` 入口
- 在调用 Pi 前先做本地 wiki/raw 检索
- 负责 Pi SDK 调用失败时的错误响应格式

### `pi_sdk_bridge.mjs`

- 由 Python 子进程调用
- 使用 Pi SDK 创建临时 session
- 以知识库目录为只读工作区

## Agent Runtime

- Python 后端调用本地 Node bridge
- Node bridge 使用 `@mariozechner/pi-coding-agent`
- 当前使用只读工具集

## 数据流

### 浏览 wiki

```text
Browser -> /api/wiki/pages
Browser -> /api/wiki/page?path=...
FastAPI -> wiki_service -> external knowledge-base/wiki
```

### 浏览 raw

```text
Browser -> /api/raw/files
Browser -> /api/raw/file?path=...
FastAPI -> raw_service -> external knowledge-base/raw
```

### 发起聊天

```text
Browser -> POST /api/chat
FastAPI -> agent_service
agent_service -> local wiki/raw retrieval
agent_service -> selected backend
agent_service -> reply + consulted_pages
```

## 当前边界

已经完成：

- 单页工作台
- wiki/raw 浏览与搜索
- raw PDF 内嵌预览
- Pi SDK 聊天后端接线
- 外部 knowledge-base 仓库读取

还没有做：

- 用户系统
- 上传与 ingest
- 写回知识库
- 审核流
- 后台 worker
- 数据库

## 运行

Python 依赖：

```bash
uv sync
```

如果使用 Pi：

```bash
npm install
```

启动：

```bash
uv run uvicorn app.backend.main:app --reload
```

关键配置：

```bash
KNOWLEDGE_BASE_DIR=../knowledge-base
PI_NODE_COMMAND=node
PI_TIMEOUT_SECONDS=180
```
