# Minimal Public Portfolio Release Plan

**最后更新**: 2026-04-25

## 文档目标

本文档用于把 `gogo-app` 整理成一个“可以公开展示、可以让人试用、适合写进简历”的作品型项目。

这不是一个长期维护型开源项目计划，也不是一次全面代码重构计划。当前更现实的目标是：

- 让外部读者快速理解项目价值
- 让项目看起来体面、诚实、有边界
- 让别人可以按说明尝试运行
- 让简历和作品集引用时不会显得混乱
- 尽量少花时间，不再被旧项目长期拖住
- 通过代码索引文档降低长文件阅读成本，而不是立刻做高风险拆分

## 核心定位

推荐把 `gogo-app` 定位为：

> 一个实验性的本地知识库桌面工作台，用于探索 Wiki / Raw 知识库浏览、聊天式研究助手、Pi RPC 集成和 Tauri 桌面封装。

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

## 最小重构范围

只做以下 7 件事。

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

### 2. 添加项目状态说明

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

### 3. 添加 LICENSE

公开前必须加许可证，否则别人默认不能合法复用。

推荐选项：

- MIT：最简单宽松，适合作品型项目
- Apache-2.0：更正式，带专利授权条款

如果没有特别顾虑，推荐 MIT。

验收标准：

- 仓库根目录存在 `LICENSE`
- README 中有 License 段落

### 4. 检查敏感信息和尴尬残留

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

### 5. 准备截图或短 Demo

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

### 6. 精简公开文档入口

不需要立刻重组整个 `docs/`。

只做最小整理：

- README 只链接 3 到 5 个最重要文档
- `docs/index.md` 标记哪些文档偏内部记录
- 删除或修复明显失效链接
- 对 `docs/pi/` 这类第三方镜像文档补一句来源说明，或在 README 中弱化它的入口

验收标准：

- 外部读者不会被几十个内部文档吓退
- 文档入口不会把“内部问题日志”放在第一阅读路径

### 7. 为长文件编写代码索引文档

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

## 不做的事

这轮不要做：

- 不拆 `main.py`
- 不拆 `chat.js`
- 不用文件拆分替代代码索引文档
- 不补完整测试体系
- 不重做 CI
- 不整理所有历史文档
- 不承诺正式 Windows / macOS 安装包
- 不做大型代码质量工程
- 不尝试把项目包装成活跃社区项目

这些事情不是没有价值，而是不符合当前目标。当前目标是体面收尾和可展示，而不是继续扩大投入。

## 简历叙事

推荐简历写法：

```text
Built gogo, an experimental local knowledge-base desktop workspace integrating
FastAPI, Tauri, Pi RPC, local file-based Wiki/Raw storage, and multi-session
chat workflows. Took the project from Web MVP to desktop development build,
then documented its architecture tradeoffs and maintenance-mode release status.
```

中文版本：

```text
设计并实现 gogo，一个实验性的本地知识库桌面工作台，集成 FastAPI、Tauri、
Pi RPC、本地 Wiki/Raw 文件知识库与多会话聊天流程。项目从 Web MVP 推进到
桌面开发版，并沉淀了架构取舍、运行时边界和 maintenance mode 发布说明。
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
2. 加 LICENSE
3. 做敏感信息检查
4. 加截图
5. 精简 README 的文档入口
6. 为 2 到 4 个长文件补代码索引文档
7. 打一个 `v0.1.0-public-snapshot` tag

做到第 4 步，就已经足够作为作品展示。

做到第 7 步，就可以认为这个项目完成了体面收尾。

## 完成定义

当以下条件满足，就停止继续投入：

- README 已经适合公开阅读
- 项目状态已经明确为 maintenance mode
- 仓库有许可证
- 没有明显敏感信息
- 至少有 2 张截图或 1 个短 Demo
- 至少 2 个关键长文件有代码索引文档
- 简历中能自然描述项目价值和边界

完成后，把主要精力转向新项目。

## 一句话结论

`gogo-app` 不需要被重构成一个完美开源项目。它只需要成为一个诚实、体面、可展示的作品项目，然后让你轻装进入下一件事。
