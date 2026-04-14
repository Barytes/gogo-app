# 课题组公共知识库 - 本地 Client 架构

## 概览

这个文档描述联邦架构中**个人本地客户端**的功能和设计。

本地客户端是一个完整的 LLM Wiki + Agent 工作站，能够独立运行所有推理和知识管理功能。服务器只作为 Git 仓库存储公共池，不承担推理任务。

```
┌─────────────────────────────────────┐
│  个人本地客户端                      │
│  ┌─────────────────────────────┐    │
│  │  personal-wiki/             │    │
│  │    raw/          (个人材料) │    │
│  │    wiki/         (个人知识) │    │
│  │    public-pool/  (只读副本) │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │  FastAPI 本地服务            │    │
│  │    - 页面分发                │    │
│  │    - Wiki/Raw API           │    │
│  │    - Agent Chat API         │    │
│  │    - Write API              │    │
│  │    - Git Sync API           │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │  单页工作台前端               │    │
│  │    - Wiki 浏览器             │    │
│  │    - Chat 面板               │    │
│  │    - Sync 状态               │    │
│  │    - 贡献队列                │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

## 核心设计选择

| 维度 | 选择 | 为什么 |
|------|------|--------|
| 推理位置 | 本地 | 省 token，不依赖服务器 |
| 知识库形态 | 本地目录 + git submodule | 离线可用，sync 可控 |
| 写回 | 支持 | 核心功能，知识沉淀 |
| Git 操作 | 本地命令 | push 到 pending-pool，pull 从 public-pool |
| 身份管理 | 本地配置 | 课题组内部，简单身份即可 |

## 目录结构

### 客户端应用

```
gogo-app/
├── app/
│   ├── backend/
│   │   ├── agent_service.py       # Agent 推理服务
│   │   ├── config.py              # 配置管理
│   │   ├── main.py                # FastAPI 入口
│   │   ├── session_manager.py     # Session 管理（RPC 会话）
│   │   ├── pi_rpc_client.py       # Pi RPC 客户端
│   │   ├── raw_service.py         # Raw 材料服务
│   │   ├── wiki_service.py        # Wiki 知识服务
│   │   ├── write_service.py       # 知识写回服务（新增）
│   │   └── git_sync_service.py    # Git 同步服务（新增）
│   └── frontend/
│       ├── index.html
│       └── assets/
│           ├── chat.js
│           ├── styles.css
│           ├── wiki.js
│           ├── workbench.js
│           └── sync.js            # Sync UI（新增）
├── docs/
├── package.json
├── pyproject.toml
└── README.md
```

### 个人知识库（运行时）

```
personal-wiki/                      # 由 KNOWLEDGE_BASE_DIR 指向
├── raw/                            # 个人原始材料（不同步）
│   ├── papers/
│   ├── meetings/
│   ├── experiments/
│   └── projects/
├── wiki/                           # 个人维护知识
│   ├── knowledge/
│   │   ├── topics/
│   │   ├── comparisons/
│   │   └── methods/
│   └── insights/
│       ├── gaps/
│       ├── tensions/
│       └── next-steps/
├── public-pool/                    # git submodule（只读副本）
│   ├── knowledge/
│   ├── insights/
│   ├── tensions/
│   ├── index.md
│   └── log.md
├── inbox/                          # 待处理材料
├── config.yaml                     # 个人配置
└── .git/
```

## 前端

前端保留单页工作台布局，但增加 Sync 相关 UI。

### 布局模式

- `Wiki 模式`：wiki/raw 占主画布，chat 为右侧可隐藏浮窗
- `Chat 模式`：chat 占主画布，wiki/raw 为右侧可隐藏浮窗

### 新增 UI 元素

1. **Sync 状态栏**
   - 显示 public-pool 最后同步时间
   - 显示待 push 的贡献数量
   - 一键 sync 按钮

2. **贡献队列面板**
   - 列出标记为"可贡献"的本地页面
   - 选择要 push 的页面
   - 显示 push 历史

3. **来源标注**
   - Wiki 列表中标注页面来源（public vs personal）
   - 检索结果中标注来源优先级

### 核心脚本

- `workbench.js`：工作台模式与浮窗显隐
- `wiki.js`：wiki/raw 列表、搜索、详情与引用
- `chat.js`：聊天历史、流式消费、后端状态显示
- `sync.js`：Sync 状态轮询、手动 sync 触发、贡献队列管理（新增）

## 后端

后端入口是 `app/backend/main.py`，运行在本地 localhost。

### 主要职责

- 返回单页工作台
- 提供 wiki / raw 浏览 API（双层检索）
- 提供 Agent chat API（本地推理）
- 提供 Write API（知识写回）
- 提供 Git Sync API（pull/push 状态）

### 页面路由

- `/` — 工作台首页
- `/chat` — Chat 模式
- `/wiki` — Wiki 模式
- `/assets/*` — 静态资源

### API 路由

#### 现有 API（保留）

- `/api/health` — 健康检查
- `/api/chat/suggestions` — 建议问题
- `/api/chat` — 非流式聊天
- `/api/chat/stream` — 流式聊天
- `/api/wiki/pages` — Wiki 页面列表
- `/api/wiki/tree` — Wiki 树结构
- `/api/wiki/page` — Wiki 页面详情
- `/api/wiki/search` — Wiki 搜索
- `/api/raw/files` — Raw 文件列表
- `/api/raw/file` — Raw 文件详情
- `/api/raw/search` — Raw 搜索
- `/raw/file` — Raw 文件下载

#### 新增 API

- `/api/write/wiki` (POST) — 写回 wiki 页面
- `/api/write/insight` (POST) — 写回 insight 页面
- `/api/sync/status` (GET) — Sync 状态
- `/api/sync/pull` (POST) — 从 public-pool 拉取
- `/api/sync/push` (POST) — 推送到 pending-pool
- `/api/sync/contributions` (GET) — 贡献队列
- `/api/config` (GET/PUT) — 个人配置读写

## 服务划分

### `wiki_service.py`（修改）

**职责**：
- 读取双层知识库（personal wiki + public-pool）
- 实现优先级检索路由：
  1. 先检索 `public-pool/knowledge/`（共识层）
  2. 再检索 `wiki/knowledge/`（个人理解）
  3. 最后检索 `raw/`（原始材料）
- 检索结果标注来源（public vs personal）

**新增函数**：
```python
def search_all_sources(query: str, limit: int = 12) -> list[dict]:
    """跨 public-pool 和 personal-wiki 的统一检索"""
    
def get_public_pool_dir() -> Path:
    """获取 public-pool 本地路径"""
```

### `raw_service.py`（保留）

**职责**：
- 读取 `personal-wiki/raw/` 文件
- 区分文本、PDF 和其他二进制材料
- 返回列表、详情、搜索结果和下载路径

### `agent_service.py`（修改）

**职责**：
- 统一封装 Pi 聊天逻辑
- 在调用 Pi 前先做双层知识库检索（public-pool 优先）
- 支持同步和流式两条聊天链路

**修改点**：
- `_collect_context()` 函数改为优先检索 public-pool
- `_build_pi_system_prompt()` 增加"优先引用公共池共识"的指导
- 移除"read-only"限制，支持写回建议

**新增函数**：
```python
def should_suggest_contribution(response: dict) -> bool:
    """判断当前问答是否值得贡献到公共池"""
    
def mark_for_contribution(page_path: str) -> None:
    """标记页面为待贡献状态"""
```

### `write_service.py`（新增）

**职责**：
- 创建/更新 `wiki/knowledge/` 页面
- 创建/更新 `wiki/insights/` 页面
- 遵循 `schemas/ingest.md` 和 `schemas/insight.md` 的格式
- 自动维护 frontmatter（作者、时间、来源）
- 追加日志到 `wiki/log.md`

**核心函数**：
```python
def create_wiki_page(
    path: str,
    title: str,
    content: str,
    author: str,
    source: str = "agent-synthesis"
) -> str:
    """创建 wiki 页面，返回实际路径"""

def create_insight_page(
    page_type: str,  # gap, tension, tradeoff, next-step
    title: str,
    judgment: str,
    evidence_links: list[str],
    author: str,
    confidence: str = "medium"
) -> str:
    """创建 insight 页面"""

def update_page_with_links(
    target_path: str,
    new_link_path: str,
    link_context: str
) -> None:
    """在目标页面添加相关链接（cross-link）"""
```

### `git_sync_service.py`（新增）

**职责**：
- 管理 public-pool git submodule
- 执行 git pull 从 public-pool remote
- 执行 git push 到 pending-pool remote
- 检测本地待贡献队列
- 记录 sync 历史

**核心函数**：
```python
def get_sync_status() -> dict:
    """返回 sync 状态：最后同步时间、待 push 数量等"""

def pull_public_pool() -> dict:
    """从 public-pool 拉取最新内容"""

def push_to_pending_pool(paths: list[str]) -> dict:
    """推送指定页面到 pending-pool"""

def get_contribution_queue() -> list[dict]:
    """获取待贡献页面队列"""

def mark_for_contribution(path: str) -> None:
    """标记页面为待贡献（写入 config.yaml）"""
```

### `config.py`（扩展）

**新增配置项**：

```python
# 知识库路径
PERSONAL_WIKI_DIR = Path(os.getenv("PERSONAL_WIKI_DIR", "./personal-wiki"))
PUBLIC_POOL_DIR = PERSONAL_WIKI_DIR / "public-pool"
PUBLIC_POOL_REMOTE = os.getenv("PUBLIC_POOL_REMOTE", "git@github.com:org/public-pool.git")
PENDING_POOL_REMOTE = os.getenv("PENDING_POOL_REMOTE", "git@github.com:org/pending-pool.git")

# 用户身份
USER_ID = os.getenv("USER_ID", "anonymous")
USER_NAME = os.getenv("USER_NAME", "Anonymous User")

# Sync 策略
AUTO_SYNC_ENABLED = os.getenv("AUTO_SYNC_ENABLED", "true").lower() == "true"
AUTO_CONTRIBUTE_ENABLED = os.getenv("AUTO_CONTRIBUTE_ENABLED", "true").lower() == "true"
SYNC_FREQUENCY = os.getenv("SYNC_FREQUENCY", "daily")  # daily, weekly
```

### `session_manager.py` + `pi_rpc_client.py`（RPC 主链路）

**职责**：
- `session_manager.py`：会话创建/切换/删除、并发互斥、历史恢复
- `pi_rpc_client.py`：`pi --mode rpc` 通讯、事件流读取、命令响应关联
- 以个人知识库目录为工作区，输出文本增量、thinking 增量与过程 trace

## 数据流

### 本地检索（双层路由）

```
用户提问
  ↓
优先检索 wiki/knowledge/ (个人理解)
  ↓
不足时检索 public-pool/knowledge/ (共识层)
  ↓ 
仍不足时检索 raw/ (原始材料)
  ↓
合并结果（标注来源）→ Agent 推理
```

### 发起聊天

```
Browser -> POST /api/chat/stream
FastAPI -> agent_service
agent_service -> 双层知识库检索（public-pool 优先）
agent_service -> Python async stream
agent_service -> Node bridge
Node bridge -> Pi SDK session events
FastAPI -> NDJSON stream (text delta + trace + final payload)
```

### 写回知识

```
用户点击"保存到知识库"
  ↓
Browser -> POST /api/write/wiki (或 /api/write/insight)
FastAPI -> write_service
write_service -> 创建/更新 markdown 文件
write_service -> 追加日志到 wiki/log.md
write_service -> 可选：标记为待贡献
  ↓
返回成功状态
```

### 同步流程

```
用户点击 Sync
  ↓
Browser -> POST /api/sync/pull
FastAPI -> git_sync_service
git_sync_service -> git pull public-pool remote
git_sync_service -> 更新本地 public-pool/
  ↓
返回 sync 结果（新增页面列表）
```

### 贡献流程

```
用户在贡献队列选择页面
  ↓
Browser -> POST /api/sync/push
FastAPI -> git_sync_service
git_sync_service -> git add selected pages
git_sync_service -> git commit with author info
git_sync_service -> git push pending-pool remote
  ↓
返回 push 结果
```

## Agent Runtime

- 本地运行 Pi SDK（通过 Node bridge）
- 工作目录为个人知识库根目录
- 优先使用 public-pool 作为知识源
- 支持写回本地文件

## 检索优先级

| 问题类型 | 检索优先级 |
|---------|-----------|
| 事实/共识问题 | 1. wiki/knowledge/ → 2. public-pool/knowledge/ → 3. raw/ |
| 研究判断问题 | 1. wiki/insights/ → 2. public-pool/insights/ → 3. wiki/knowledge/ |
| 原始材料查询 | 1. raw/ → 2. wiki/knowledge/ |

## 写回策略

### 何时写回 wiki/knowledge/

- 用户明确要求保存
- 问答形成了可复用的领域共识/概念澄清
- 整合了多个来源的结构化整理

### 何时写回 wiki/insights/

- 问答产生了研究 gap 建议
- 暴露了方法 tradeoff 或认知 tension
- 提出了可复用的下一步实验建议

### 何时标记为贡献

- 默认配置：所有写回页面自动标记为可贡献
- 用户可在 config.yaml 中关闭自动贡献
- 贡献前可在贡献队列中审查/编辑

## 运行

### 依赖安装

Python 依赖：
```bash
uv sync
```

Node 依赖（如果使用 Pi）：
```bash
npm install
```

### 环境配置

创建 `.env`：
```bash
# 个人知识库路径
PERSONAL_WIKI_DIR=/Users/your-name/research-kb/personal-wiki

# Git remote 配置
PUBLIC_POOL_REMOTE=git@github.com:your-org/public-pool.git
PENDING_POOL_REMOTE=git@github.com:your-org/pending-pool.git

# 用户身份
USER_ID=beiyans
USER_NAME="Beiyan Liu"

# Sync 策略
AUTO_SYNC_ENABLED=true
AUTO_CONTRIBUTE_ENABLED=true
SYNC_FREQUENCY=daily
```

### 启动服务

```bash
uv run uvicorn app.backend.main:app --reload
```

### 初始化 public-pool

第一次运行时需要初始化 git submodule：
```bash
cd personal-wiki
git submodule add git@github.com:your-org/public-pool.git public-pool
```

## 当前边界

已经实现：
- 单页工作台
- Wiki/Raw 浏览与搜索
- Raw PDF 内嵌预览
- Pi SDK 聊天后端
- 双层知识库检索（public-pool + personal-wiki）
- 本地知识写回
- Git sync 基础功能

还没有做：
- 服务器端自动聚合（由 server 架构文档定义）
- 张力页面自动生成
- 贡献统计 dashboard
- 复杂的冲突检测和合并策略

## 相关文档

- [客户端架构设计](client-architecture.md) — 本文档
- [服务器架构设计](server-architecture.md) — 服务器端设计
- [联邦架构总览](课题组公共知识库的联邦架构设计.md) — 整体架构设计
- [产品定义信念](product-definition-belief.md) — 产品目标
