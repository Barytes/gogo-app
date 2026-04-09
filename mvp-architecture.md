# 课题组公共知识库 Web MVP 架构

## 当前目标

这一版不再描述一个未来的大而全系统，而是描述仓库里已经落下来的最小可用 Web MVP。

当前 MVP 的目标只有一条：

1. 提供一个统一工作台，左侧浏览 wiki 和 raw，右侧直接和 agent 对话

其中：

- 对话区已经接上后端接口，但当前是 mock agent
- 内容区尽量真实读取独立 knowledge-base repo 中的 `wiki/` 和 `raw/`
- 整体使用 `uv + FastAPI + 静态前端`
- 后端已经预留 Pi CLI 和 `my-agent-loop` 集成骨架

---

## 当前实现概览

当前 Web MVP 由三部分组成：

1. 本地知识库内容层
2. FastAPI 后端
3. 静态前端界面

系统形态如下：

```text
Browser
  -> Unified Workbench
     - left: wiki + raw
     - right: chat
            |
            v
    FastAPI Backend
      - /api/chat
      - /api/chat/suggestions
      - /api/wiki/pages
      - /api/wiki/page
      - /api/wiki/search
      - /api/wiki/tree
      - /api/raw/files
      - /api/raw/file
      - /api/raw/search
      - /raw/file
        |
        v
  external knowledge-base repo
    -> wiki/
    -> raw/
```

---

## 技术栈

| 层级 | 当前方案 | 说明 |
|------|---------|------|
| 前端 | 原生 HTML + CSS + JavaScript | 不需要构建步骤，当前是单页双栏工作台 |
| 后端 | FastAPI | 负责页面分发和 API |
| Python 管理 | `uv` | 用于依赖安装与运行 |
| 内容存储 | Markdown 与原始文件 | 通过 `KNOWLEDGE_BASE_DIR` 读取外部 knowledge-base repo |
| Agent 对话 | Mock / Pi / my-agent-loop | 默认 mock，可切换到安装在运行设备上的 `pi`，或导入本地 `my-agent-loop` |

---

## 目录结构

当前应用仓库与外部知识库仓库的关系如下：

```text
workspace/
├── knowledge-base/
│   ├── AGENTS.md
│   ├── skills/
│   ├── schemas/
│   └── wiki/
└── gogo-app/
    ├── app/
    │   ├── backend/
    │   │   ├── config.py
    │   │   ├── agent_service.py
    │   │   ├── main.py
    │   │   ├── chat_service.py
    │   │   ├── raw_service.py
    │   │   └── wiki_service.py
    │   ├── frontend/
    │   │   ├── index.html
    │   │   ├── chat.html
    │   │   ├── wiki.html
    │   │   └── assets/
    │   │       ├── styles.css
    │   │       ├── chat.js
    │   │       └── wiki.js
    │   └── README.md
    ├── .env
    ├── AGENTS.md
    ├── README.md
    ├── pyproject.toml
    └── uv.lock
```

应用仓库内部目录如下：

```text
gogo-app/
├── app/
│   ├── backend/
│   │   ├── config.py
│   │   ├── agent_service.py
│   │   ├── main.py
│   │   ├── chat_service.py
│   │   ├── raw_service.py
│   │   └── wiki_service.py
│   ├── frontend/
│   │   ├── index.html
│   │   ├── chat.html
│   │   ├── wiki.html
│   │   └── assets/
│   │       ├── styles.css
│   │       ├── chat.js
│   │       └── wiki.js
│   └── README.md
├── README.md
├── pyproject.toml
└── uv.lock
```

---

## 前端架构

前端目前是无构建链路的静态页面，直接由 FastAPI 返回。

### 1. 统一工作台

文件：

- `app/frontend/index.html`

职责：

- 把 wiki 浏览和 chat 对话放进同一个页面
- 左侧显示 wiki/raw 切换、搜索、列表和正文
- 右侧显示对话历史、建议问题和输入框
- 支持在 wiki 页面与 chat 输入框之间做联动
- 支持从 raw 材料打开原始文件

当前行为：

- 页面初始化时读取 `/api/wiki/pages`
- 点击左侧页面后读取 `/api/wiki/page` 或 `/api/raw/file`
- 右侧输入框把问题发送给 `/api/chat`
- 聊天回复中的页面引用可以反向打开左侧 wiki 页面
- 左侧当前页面可以一键引用到右侧提问框
- 在 raw 模式下，文本材料直接显示，PDF 材料支持页面内预览，其他二进制材料提供打开原文件入口

### 4. 共享样式

文件：

- `app/frontend/assets/styles.css`

职责：

- 定义聊天页与 wiki 页的视觉样式
- 兼容桌面和移动端

---

## 后端架构

后端目前是一个单体 FastAPI 服务。

文件：

- `app/backend/main.py`

职责：

- 提供页面路由
- 提供聊天 API
- 提供 wiki 浏览 API
- 挂载静态资源
- 暴露当前绑定的 knowledge-base 路径
- 根据配置在 mock 与 Pi CLI 之间切换 agent 后端
- 根据配置在 mock、Pi CLI 与 `my-agent-loop` 之间切换 agent 后端

### 页面路由

| 路由 | 用途 |
|------|------|
| `/` | 统一工作台 |
| `/chat` | 兼容路由，返回统一工作台 |
| `/wiki` | 兼容路由，返回统一工作台 |
| `/assets/*` | 前端静态资源 |

### API 路由

| 路由 | 用途 |
|------|------|
| `/api/health` | 健康检查 |
| `/api/chat/suggestions` | 对话建议问题 |
| `/api/chat` | mock agent 对话接口 |
| `/api/wiki/pages` | wiki 页面列表 |
| `/api/wiki/page` | 单页详情 |
| `/api/wiki/search` | wiki 搜索 |
| `/api/wiki/tree` | wiki 树结构 |
| `/api/raw/files` | raw 材料列表 |
| `/api/raw/file` | 单个 raw 材料详情 |
| `/api/raw/search` | raw 材料搜索 |
| `/raw/file` | 打开原始文件 |

---

## 服务拆分

### 1. `wiki_service.py`

文件：

- `app/backend/wiki_service.py`
- `app/backend/config.py`

职责：

- 通过 `KNOWLEDGE_BASE_DIR` 定位外部 knowledge-base repo
- 读取外部 `wiki/` 下的 markdown 文件
- 生成页面列表
- 生成树结构
- 读取单页内容
- 基于标题、摘要和内容做简单搜索

这是当前 MVP 中最接近真实能力的一层，因为它直接读取本地知识库。

### 2. `raw_service.py`

文件：

- `app/backend/raw_service.py`

职责：

- 读取外部 `raw/` 下的材料文件
- 生成原始材料列表
- 返回文本材料内容
- 为 PDF 提供预览链接
- 为其他二进制文件提供元数据与打开链接
- 支持按文件名、路径和文本内容做简单搜索

### 3. `agent_service.py`

文件：

- `app/backend/agent_service.py`

职责：

- 作为 `/api/chat` 的统一入口
- 根据 `AGENT_MODE` 选择 mock 或 Pi
- 在 Pi 模式下组织本地检索上下文
- 通过子进程调用安装在运行设备上的 `pi` CLI
- Pi 不可用时回退到 mock

Pi 集成原则：

- 不把 Pi 源码包含进当前 repo
- 只要求运行机器上正常安装 `pi`
- 通过 `.env` 和 CLI 参数完成集成

### 4. `my-agent-loop` 集成

当前应用还支持把本地 `my-agent-loop` 作为另一种 agent backend。

集成原则：

- 不把 `my-agent-loop` 源码复制到当前 repo
- 保持 `my-agent-loop` 为独立目录或独立 repo
- 通过 `.env` 中的 `MY_AGENT_LOOP_DIR` 指向它
- 由 `agent_service.py` 动态导入并直接调用它的 `chat()` 逻辑

### 5. `chat_service.py`

文件：

- `app/backend/chat_service.py`

职责：

- 接收用户问题
- 用本地 wiki 搜索结果做简单命中
- 生成 mock agent 回复
- 返回关联页面和建议问题

这层当前不是一个真实 agent runtime，而是一个可替换的模拟层。

### 6. 外部知识库依赖

当前应用不会把提示词、schemas 和 wiki 内容存进自己的 repo。

它依赖外部 knowledge-base repo，并通过下面的方式连接：

- `.env` 中的 `KNOWLEDGE_BASE_DIR`
- 默认 sibling 路径 `../knowledge-base`

---

## 数据流

### 场景 1：用户打开统一工作台

```text
Browser -> GET / -> 返回 index.html
Browser -> GET /api/wiki/pages -> 返回页面列表
Browser -> GET /api/wiki/page?path=... -> 返回页面正文
FastAPI -> 读取 `KNOWLEDGE_BASE_DIR/wiki/`
Browser -> 渲染 markdown 内容
```

### 场景 2：用户浏览 raw 材料

```text
Browser -> 切换到 raw 模式
Browser -> GET /api/raw/files -> 返回原始材料列表
Browser -> GET /api/raw/file?path=... -> 返回文本内容、PDF 预览信息或文件元数据
Browser -> 若是 PDF，则页面内嵌 /raw/file?path=...
Browser -> 若是其他二进制文件，打开 /raw/file?path=...
```

### 场景 3：用户在右侧聊天区提问

```text
Browser -> POST /api/chat
FastAPI -> agent_service
agent_service -> mock path、Pi CLI path 或 my-agent-loop path
agent_service -> wiki/raw retrieval
agent_service -> 返回回复 + 相关页面
Browser -> 渲染回复
```

---

## 当前系统边界

这一版是刻意收缩后的 MVP，所以有几件事明确还没做：

### 已做

- 前端聊天界面
- 前端 wiki 浏览界面
- FastAPI 单体后端
- 本地 wiki 读取、列表、搜索、详情 API
- raw 材料读取、列表、搜索、详情 API
- raw 文件打开入口
- mock chat 接口
- Pi CLI 集成骨架
- my-agent-loop 集成骨架
- `uv` 项目管理
- 独立 app repo + 独立 knowledge-base repo 的拆分结构

### 未做

- 真实 agent runtime
- 真实模型调用
- 用户系统
- 文件上传
- ingest 工作流
- insight write-back
- review 队列
- worker 异步任务系统
- 数据库

---

## 为什么当前先这样做

当前架构的原则很简单：

1. 先把前端工作面做出来
2. 先把 wiki 浏览链路做真实
3. 先把 chat 链路做通，即使后端还是 mock
4. 后面再逐步把 mock 替换成真 agent

这比一开始就上复杂前端框架、异步任务系统、鉴权和冲突处理更适合现在的阶段。

---

## 后续最自然的演进方向

在当前架构基础上，后续可以按下面顺序扩展：

### 1. 把 `/api/chat` 从 mock 换成真实 agent 调用

即：

- 读取 `.env`
- 调用真实模型
- 继续保留本地 wiki 作为上下文来源

### 2. 增加 ingest API

即：

- 上传文件
- 保存到 `knowledge-base/inbox/` 或 `raw/`
- 调用真实 ingest agent

### 3. 增加后台 worker

当 chat、ingest、write-back 变成长任务之后，再加入 worker 会更合适。

### 4. 增加 review / proposal 机制

当系统开始真实写回 `wiki/` 时，再引入审查和冲突处理。

---

## 启动方式

当前项目使用 `uv`。

安装依赖：

```bash
uv sync
```

启动服务：

```bash
uv run uvicorn app.backend.main:app --reload
```

知识库仓库路径由 `.env` 控制：

```bash
KNOWLEDGE_BASE_DIR=../knowledge-base
```

Pi 集成也通过 `.env` 控制：

```bash
AGENT_MODE=mock
PI_COMMAND=pi
PI_TIMEOUT_SECONDS=180
```

my-agent-loop 集成也通过 `.env` 控制：

```bash
AGENT_MODE=my-agent-loop
MY_AGENT_LOOP_DIR=../my-agent-loop
MY_AGENT_LOOP_MODEL=grok-4-fast
BUILDER_API_KEY=your-key
```

打开页面：

- `http://127.0.0.1:8000/`
- `http://127.0.0.1:8000/chat`
- `http://127.0.0.1:8000/wiki`

---

## 结论

当前这份架构不再是一个“规划中的平台架构”，而是一个已经落地的 Web MVP 架构：

- 前端是静态页面
- 后端是 FastAPI
- wiki 浏览尽量真实
- agent 对话先用 mock 跑通
- 整体由 `uv` 管理

后续扩展时，应该优先替换 chat 的 mock 层，而不是先引入更重的工程结构。
