# Minimal Public Portfolio Release Plan

**最后更新**: 2026-04-25

## 文档目标

本文档用于把 `gogo` 整理成一个“可以公开展示、可以让人试用、适合写进简历”的作品型项目。

这不是一个长期维护型开源项目计划，也不是一次全面代码重构计划。当前更现实的目标是：

- 让外部读者快速理解项目价值
- 让项目看起来体面、诚实、有边界
- 让别人可以按说明尝试运行
- 让简历和作品集引用时不会显得混乱
- 尽量少花时间，不再被旧项目长期拖住
- 把项目的设计原则写清楚，让功能和技术选择看起来有来源
- 通过代码索引文档降低长文件阅读成本，而不是立刻做高风险拆分

## 核心定位

推荐把 `gogo` 定位为：

> 一个自带AI Agent的llm-wiki本地知识库桌面应用原型，开箱即用，不需要安装Claude Code，Codex即可与 AI 研究助手对话并使用llm-wiki式的本地知识库。

推荐公开状态：

> Maintenance mode / public project snapshot.  
> 项目可以作为作品、参考实现和原型记录查看；当前不承诺长期维护，也不建议作为生产依赖使用。

这个定位同时满足三件事：

- 可以发布给别人看和试用
- 不需要承诺长期维护
- 可以在简历中作为完整项目经历展示

## 当前判断

`gogo-app` 已经具备作品展示价值：

- 有明确产品方向：本地知识库工作台
- 有真实技术组合：FastAPI、Tauri、Pi RPC、本地文件知识库、会话管理
- 有完整探索过程：从 Web MVP 到桌面开发版
- 有足够可讲的工程内容：运行时边界、桌面打包、知识库结构、agent 会话恢复

但它不适合继续按“高质量长期维护开源项目”推进：

- 代码体量较大，且很多实现来自 AI 辅助生成
- 维护者本人对部分代码掌控感不足
- 继续重构会消耗大量时间
- 后续精力计划投入新项目

因此，本计划只做最小必要整理，不追求彻底清理代码债务。

## 公开策略

采用“作品型公开”策略：

- 可以公开仓库
- 可以写进简历
- 可以提供运行说明
- 可以保留 issue，但说明 best-effort support
- 也可以关闭 issue，把反馈入口放到个人联系方式
- 不主动承诺 roadmap
- 不承诺跨平台安装包长期可用
- 不把它包装成生产级工具或社区型开源项目

建议 README 中明确写：

```text
This project is in maintenance mode. It is published as a portfolio project,
research prototype, and reference implementation. I am not actively developing
new features, but the repository remains available for learning and review.
```

中文可以写：

```text
本项目当前处于 maintenance mode。它作为作品项目、研究原型和参考实现公开，
不再积极开发新功能，也不承诺长期维护。
```

## 从 Tolaria 学到的调整

参考 Tolaria 后，本计划需要吸收四个轻量做法：

- README 应该前置设计原则，而不是只写功能和限制
- 公开文档应包含一个轻量概念索引，帮助人和 AI 先理解项目词汇
- 长文件索引应被明确写成 AI-readable / Documentation as navigation 的一部分
- 少量关键决策可以用短 decision notes 记录，不需要完整 ADR 体系

这些调整不会把项目重新推回“大型开源化工程”。它们的目标是让 gogo 更像一个有原则、有边界、可导航的作品项目。

## 最小重构范围

只做以下 9 件事。

### 1. 重写 README

目标：

- 让陌生人在 1 分钟内知道这个项目是什么
- 让面试官快速看到项目亮点
- 让用户知道它能不能跑、怎么跑、有什么限制

README 建议结构：

```text
# gogo

一句话定位

## Project Status
maintenance mode / public snapshot

## Principles
Local files first / Portable knowledge / AI-readable by default / Documentation as navigation / Prototype honestly

## What It Does
核心能力列表

## Screenshots / Demo
截图或短视频

## Tech Stack
FastAPI / Tauri / Pi RPC / local knowledge base

## Quick Start
最短可运行路径

## Known Limitations
诚实边界

## Why This Project Exists
项目背景和探索价值

## License
许可证
```

验收标准：

- README 不再像内部状态记录
- README 不承诺长期维护
- README 优先展示项目价值，而不是先解释所有未完成事项
- README 能在短版 Principles 中表达 gogo 的取舍

### 2. 添加设计原则文档

新增设计原则文档。

这份文档是从 Tolaria 学来的关键动作：不要只告诉读者项目做了什么，也要告诉读者项目相信什么。

建议原则：

- Local files first
- Portable knowledge, no lock-in
- AI-readable by default
- Agent as collaborator, not owner
- Conventions over hidden configuration
- Documentation as navigation
- Prototype honestly
- Built from real workflow exploration

每条原则建议包含：

- 这个原则是什么意思
- gogo 里哪些设计体现了它
- 它也意味着哪些事情暂时不做

验收标准：

- README 有短版 Principles
- 设计原则文档有完整解释
- 至少 5 条原则能对应到 gogo 的真实设计，而不是泛泛口号

### 3. 添加项目状态说明

可以选择二选一：

- 在 README 顶部加 `Project Status`
- 或新增 `PROJECT_STATUS.md`

推荐先只写进 README，减少文件数量。

需要明确：

- 当前是作品型公开
- 不是生产级软件
- 不再积极开发
- issue / PR 处理是 best-effort

验收标准：

- 外部读者不会误解为活跃维护项目
- 简历引用时也不会显得项目被“弃坑”，而是有意识地进入 maintenance mode

### 4. 添加 LICENSE

公开前必须加许可证，否则别人默认不能合法复用。

推荐选项：

- MIT：最简单宽松，适合作品型项目
- Apache-2.0：更正式，带专利授权条款

如果没有特别顾虑，推荐 MIT。

验收标准：

- 仓库根目录存在 `LICENSE`
- README 中有 License 段落

### 5. 检查敏感信息和尴尬残留

目标不是大扫除，而是避免明显风险。

最小检查项：

- `.env` 不进入 Git
- 没有 API key、token、私钥
- 没有个人隐私路径写在 README 主路径中
- 没有大体积构建产物被 Git 跟踪
- 没有明显不适合公开的私人内容

建议命令：

```bash
git status --short
git ls-files | rg '(\.env|token|secret|key|target/|node_modules|__pycache__)'
rg -n '(sk-|api[_-]?key|token|secret|password|PRIVATE KEY)' .
```

验收标准：

- 没有明显密钥或隐私内容
- Git 跟踪文件不包含常见本地产物

### 6. 准备截图或短 Demo

对简历和公开展示来说，截图比重构代码更有价值。

最小材料：

- 主工作台截图
- Wiki / Raw 浏览截图
- Chat 会话截图
- 设置或桌面启动截图

如果有精力，可以做一个 30 到 60 秒短视频：

- 打开应用
- 选择知识库
- 浏览页面
- 发起一次聊天

验收标准：

- README 中能看到项目实际界面
- 简历或作品集可以链接到截图 / Demo

### 7. 新增轻量概念索引

新增 `docs/concepts.md`。

Tolaria 的 `ABSTRACTIONS.md` 值得学习，因为它让读者先理解核心名词，再进入代码。gogo 不需要写很长，但应该给人和 AI agent 一个词汇表。

建议包含：

- Knowledge base
- Wiki
- Raw
- Inbox
- Session
- Agent backend
- Pi RPC
- Provider
- Skill / capability

每个概念只需要回答：

- 它是什么
- 它存在于哪里
- 它和其他概念有什么关系
- 如果要改相关行为，应该先看哪些文件或文档

验收标准：

- 新读者能先读概念索引，再读代码索引
- 核心名词可被搜索和引用
- 概念索引能服务人类读者和 AI agent

### 8. 精简公开文档入口

不需要立刻重组整个 `docs/`。

只做最小整理：

- README 只链接 3 到 5 个最重要文档
- README 优先链接 `design-principles.md`、`concepts.md`、`code-index/` 和必要的运行文档
- `docs/index.md` 标记哪些文档偏内部记录
- 删除或修复明显失效链接
- 对第三方镜像文档补一句来源说明，或在 README 中弱化它的入口

验收标准：

- 外部读者不会被几十个内部文档吓退
- 文档入口不会把“内部问题日志”放在第一阅读路径

### 9. 为长文件编写代码索引文档

这一步是“文档化重构”，不是代码重构。

长文件确实会影响可读性，但直接拆分 `main.py`、`session_manager.py`、`chat.js`、`workbench.js` 风险较高。更适合当前目标的方式是：为这些长文件写代码索引文档，让人和 AI agent 都能更快定位结构、职责和修改入口。

这件事的价值：

- 帮助外部开发者读懂长文件，而不是被几千行代码吓退
- 展现维护者对复杂代码的理解和负责态度
- 避免为了“看起来干净”而做高风险拆分
- 降低 AI agent 检索和理解代码的 token 成本
- 展现 AI native 开发者对 coding agent 工作方式的理解

建议新增：

```text
docs/code-index/
  backend-main.md
  backend-session-manager.md
  frontend-chat.md
  frontend-workbench.md
```

每个索引文档建议包含：

- 文件职责：这个文件负责什么，不负责什么
- 主要区域：按代码顺序列出大段落和行号范围
- 核心数据流：用户操作 / API 请求 / session 事件如何流动
- 关键函数表：函数名、作用、被谁调用、常见修改场景
- 修改指南：想改某类行为应该先看哪里
- 风险提示：哪些区域耦合强，修改时需要小心
- AI agent 提示：给 coding agent 的检索入口和上下文建议

示例模板：

```markdown
# `app/backend/main.py` Code Index

## Responsibility

This file defines the FastAPI app, API routes, static frontend serving, and
desktop bridge endpoints.

## Reading Map

| Area | Approx. Lines | Purpose |
|------|---------------|---------|
| App setup | 1-120 | Imports, app root, constants, helper setup |
| Desktop bridge helpers | 121-260 | Login shell and Tauri bridge helpers |

## Common Tasks

| Task | Start Here | Notes |
|------|------------|-------|
| Add an API endpoint | Route section | Keep request models near the route |
| Debug desktop login | Desktop bridge helpers | Also check Tauri commands |

## AI Agent Notes

Start with this index before reading the full file. Prefer targeted searches
for route names, request models, and service functions.
```

验收标准：

- 至少为 2 个最长 / 最重要文件写索引文档
- README 或 `docs/index.md` 能链接到代码索引入口
- 索引文档能帮助读者在 3 到 5 分钟内知道该从哪里开始看
- 索引不承诺代码已经是最优结构，只说明当前结构和修改入口

## 可选加分项

这些事项来自 Tolaria 的启发，但不是公开前阻塞项。

### 1. 添加短 decision notes

可以新增 `docs/decisions/`，记录少数关键选择。

优先写：

- Why local files first
- Why Pi RPC
- Why maintenance mode
- Why code index before file split

每篇只需要 1 到 2 页，不需要完整 ADR 流程。

### 2. 添加最小 SECURITY.md

如果仓库公开且允许 issue，可以添加一个很短的 `SECURITY.md`：

- latest / main best effort
- old releases unsupported
- 不要公开提交敏感漏洞
- 提供一个私下联系渠道

### 3. 定义最小 smoke check

不需要完整 CI，但可以在 README 或 docs 中列出公开前手动验证：

- 启动后端
- 打开首页
- 加载 example knowledge base
- 访问 wiki tree
- 创建或恢复一个 session
- 检查 `/api/health`

## 不做的事

这轮不要做：

- 不拆 `main.py`
- 不拆 `chat.js`
- 不用文件拆分替代代码索引文档
- 不补完整测试体系
- 不重做 CI
- 不整理所有历史文档
- 不补完整 ADR 体系
- 不补完整社区治理体系
- 不承诺正式 Windows / macOS 安装包
- 不做大型代码质量工程
- 不尝试把项目包装成活跃社区项目

这些事情不是没有价值，而是不符合当前目标。当前目标是体面收尾和可展示，而不是继续扩大投入。

## 简历叙事

推荐简历写法：

```text
Built gogo, an experimental local knowledge-base desktop workspace exploring
local-first Markdown knowledge, FastAPI/Tauri desktop packaging, Pi RPC agent
integration, and AI-readable project documentation. Published it as a
maintenance-mode portfolio project with explicit design principles and
code-index docs to make a complex AI-assisted codebase navigable for both
humans and coding agents.
```

中文版本：

```text
设计并实现 gogo，一个实验性的本地知识库桌面工作台，探索 local-first
Markdown 知识库、FastAPI/Tauri 桌面封装、Pi RPC agent 集成和 AI-readable
项目文档。项目以 maintenance mode 形式公开，并通过设计原则与代码索引文档，
让复杂的 AI 辅助代码库对人类和 coding agent 都更可导航。
```

如果被问到代码质量，可以这样讲：

```text
这个项目是高探索度原型，很多实现是在 AI 辅助下快速迭代出来的。
后期我意识到代码可维护性开始下降，所以没有继续无限打补丁，而是选择冻结范围、
整理公开说明，并把经验迁移到下一代项目设计中。
```

这个回答的重点是：你不是不知道问题，而是能识别问题、控制投入、做出取舍。

## 推荐执行顺序

按最小成本排序：

1. 改 README
2. 写设计原则文档
3. 加 LICENSE
4. 做敏感信息检查
5. 加截图
6. 写 `docs/concepts.md`
7. 精简 README 的文档入口
8. 为 2 到 4 个长文件补代码索引文档
9. 打一个 `v0.1.0-public-snapshot` tag

做到第 5 步，就已经足够作为作品展示。

做到第 9 步，就可以认为这个项目完成了体面收尾。

## 完成定义

当以下条件满足，就停止继续投入：

- README 已经适合公开阅读
- README 和设计原则文档已经表达 gogo 的设计原则
- 项目状态已经明确为 maintenance mode
- 仓库有许可证
- 没有明显敏感信息
- 至少有 2 张截图或 1 个短 Demo
- 核心概念有轻量索引
- 至少 2 个关键长文件有代码索引文档
- 简历中能自然描述项目价值和边界

完成后，把主要精力转向新项目。

## 一句话结论

`gogo-app` 不需要被重构成一个完美开源项目。它只需要成为一个诚实、体面、可展示的作品项目，然后让你轻装进入下一件事。
