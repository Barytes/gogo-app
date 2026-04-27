# 🐶 gogo

自带一个 [Pi Agent](https://github.com/badlogic/pi-mono) 的 [llm-wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) 风格本地知识库桌面应用原型。开箱即用，不需要额外安装任何Coding Agent或配置任何插件，即可直接与 AI 研究助手对话，在本地管理和积累个人知识。

![gogo](docs/assets/gogo_demo_video.gif)

我正在使用 llm-wiki 作为自己的第二大脑，也非常喜欢这种组织知识的方式。但在日常使用中，我发现 llm-wiki 的工作流有些麻烦：需要同时打开 Obsidian 和 Codex，在两个工具之间来回切换。对我来说尤其明显，因为我通常只有一个屏幕。另一方面，我也很难把 llm-wiki 这种模式安利给身边没有 IT 背景的朋友，因为他们需要下载安装 Coding Agent、配置运行环境和 LLM 模型。这个门槛足以让很多人望而却步。

为此，我用一个星期时间 Vibe Coded 了 gogo（100% 纯 AI，零人工）。现在，我把 gogo 作为自己日常使用 llm-wiki 的入口。虽然它远远没有到达完美水准，但是我觉得它已经能够满足我的需求。它把本地知识库、AI 研究助手和 llm-wiki 工作流放在同一个应用里。如果你也有类似的痛点，希望它也能帮到你。

## 开始使用 gogo

gogo 提供了 Windows x64 和 MacOS（Apple Silicon）版本的安装包。你可以在 [Github Release](https://github.com/Barytes/gogo/releases) 下载对应的安装包。

### 1. 首次启动

安装后，首次启动会出现一个欢迎页面。你首先需要配置自己的 LLM 模型。gogo 底层是一个 [Pi Agent](https://github.com/badlogic/pi-mono) ，它支持通过 API Key 和 OAuth 两种方式配置。如果你是通过购买 API 或者订阅 Coding Plan 的形式来使用 LLM，你可以在 API Key 选项中填入你的 API Key、BaseURL 等信息，也可以直接将模型提供商为 OpenClaw 提供的 json 配置文件复制粘贴过来，gogo 可以自动识别。如果你订阅了模型提供商的高级计划，你可以在 OAuth 选项中打开终端 Pi，通过 `\login` 命令登陆支持的模型提供商。目前仅支持 Anthropic (Claude Pro/Max)、GitHub Copilot、Google Cloud Code Assist (Gemini CLI)、Antigravity、ChatGPT Plus/Pro (Codex Subscription)。

配置好 LLM 模型后，你需要选择知识库的位置。如果你没有使用 llm-wiki 类的知识库，gogo 会在你选择的路径中为你创建一个示例知识库（见[example-knowledge-base](https://github.com/Barytes/gogo/tree/main/example-knowledge-base)）。如果你已经在使用 llm-wiki 类的知识库（包含raw, wiki目录），你可以选择你自己的知识库路径。

### 2. llm-wiki 的工作流
如果你不熟悉 llm-wiki，你可以阅读这篇文章：[llm-wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)。llm-wiki 的核心理念是把一次性的检索，变成可以持续维护的知识，从而产生[信息复利](https://www.superlinear.academy/c/share-your-insights/andrej-karpathy-llm-wiki-context-infrastructure)。

llm-wiki 的工作流可以概括为三个 schema：1）**Ingest**：把新资料放进 raw 层，由 LLM 读取并在 wiki 层建立新的 wiki 页面，并跟已有的 wiki 页面关联；2）**Query**：回答时优先从 wiki 检索与综合信息，必要时再回 raw 验证；3）**lint**：清理 wiki 页面，检查冲突、过时内容、孤儿页和缺失链接。

gogo 的示例知识库（见[example-knowledge-base](https://github.com/Barytes/gogo/tree/main/example-knowledge-base)）为你提供了一个最小的 llm-wiki。它包括了下面的内容：
- `wiki/`：整理后的 wiki 页面
- `raw/`：原始资料
- `inbox/`：新文件的临时入口
- `skills/`：给 agent 使用的 skills
- `schema/`: 定义了 ingest, query 和 lint 三个 schemas
- `AGENTS.md`: 给 agent 的初始指令

你可以通过修改 schemas, skills 和 AGENTS.md，自定义 agent 在知识库里的行为方式。

你可以使用任何你喜欢的 coding agent （Claude code, Codex, etc.）使用这个知识库。它完全不需要搭配 gogo 使用。

### 3. 通过 gogo 使用 llm-wiki

gogo 提供了一个内置的 Pi agent，你可以通过 Chat 界面与它对话，使用 llm-wiki。
- **Ingest**：Pi agent 会固定地 ingest 知识库 `inbox/` 目录下的内容。你可以将想要存入知识库的文件自行移到 `inbox/`，也可以点击 Chat 聊天框中的“+”按钮上传文件，gogo 会将上传到文件复制到`inbox/` 目录下。你可以从右下角的 inbox 浮窗中看到`inbox/` 目录中的内容。点击 Ingest 按钮，可插入提示词。
- **Query**：gogo 的 Pi agent 会综合 wiki 的内容回答提问。当 wiki 的材料不足时，它会浏览 raw 中的原始材料获取更多的信息。它并没有联网搜索功能，你需要自行为它配置相应的skill。
- **lint**：告诉 Pi agent 你想要 lint/清理 即可。
- **浏览Wiki**：gogo 有 Wiki/Chat 两种界面模式，可以点击右上角的开关切换。Wiki 模式下 Wiki 页面浏览是主界面，Chat 会在右下角浮窗显示；Chat 模式下 agent 聊天窗口是主界面，Wiki 则会在浮窗显示。Wiki 页面中链接的和 agent 回答中提到页面可以点击自动跳转。Wiki 界面中为你提供了简单的编辑、删除、新建功能。你也可以点击页面的“引用”按钮，将这一页引用到提示词中。
- **Skills 和 Schemas**：聊天窗口支持 slash 命令，调用知识库`skills/`和`schemas/`中定义的 skills 和 schemas。你可以自行在知识库相应的目录下新增、修改、删除 skills 和 schemas。gogo 也在设置面板（点击左上角 ⚙️ 按钮）中的“当前技能”栏为你提供了一个简单的面板，以便浏览、修改、新增和删除 skills 和 schemas。
- **模型**：agent 聊天窗口中提供了切换模型、思考水平、权限以及显示和压缩上下文窗口的按钮。你也可以在左上角 ⚙️ 设置面板中的“模型”栏新增、编辑、删除模型提供商配置。
- **设置面板**：可点击左上角 ⚙️ 按钮打开设置面板。“知识库”栏可以选择切换不同的知识库。“当前技能“栏可以浏览和修改当前知识库的 skills 和 schemas。“模型”栏可以配置模型提供商。“诊断”栏会显示日志信息。


## 设计原则

- **💁gogo 服务于本地 llm-wiki 知识库**：为 llm-wiki 提供更好用的入口，而不是把知识和工作流反过来锁进应用本身。停止使用 gogo 也不会损失知识库内的任何内容。
- **🤝统一 Wiki + Agent 工作面**：gogo 把知识浏览、页面编辑和围绕知识推进任务的对话放进同一个工作面里，减少用户在多个工具之间来回切换的成本。
- **🔍聚焦 llm-wiki 场景，而不是做通用知识管理器**：gogo 优先把 llm-wiki 这类本地知识库工作流做到顺手，而不是为了更泛化的场景牺牲边界清晰度和使用体验。
- **👑用户是知识库的第一拥有者**：用户应该始终能看见、修改、迁移和替换自己的知识库结构、skills、schemas 和工作方式，而不是被迫接受封闭系统的默认安排。
- **🤖不过度黑盒化 Agent 机制**：gogo 不把 agent 包装成完全不可见的“魔法”，而是尽量让模型配置、slash 命令、诊断信息、上下文和权限边界都对用户透明。
- **📦开箱即用**：gogo 的目标是让用户尽量少做环境搭建，就能使用 llm-wiki。


## 项目状态

本项目当前处于 **维护模式（maintenance mode）**。

它作为作品项目公开。由于个人的精力有限，我目前不再积极开发新功能，也不建议把这个仓库视为生产级软件或长期支持的桌面产品。

这意味着：

- 你可以下载 Windows / MacOS 安装包并运行使用当前版本的 gogo。
- 你可以阅读代码、在本地运行，并把它作为参考实现。
- 目前仅按 best-effort 方式维护，我不计划主动推动新功能或长期支持，不保证及时修复出现的问题。


# 🐶 gogo (English)

A desktop app prototype for a local [llm-wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)-style knowledge base with a built-in AI agent. It is designed to be usable out of the box: you can talk to an AI research assistant and manage and grow your personal knowledge locally, without installing any additional coding agents or configuring plugins.

I use llm-wiki as my second brain, and I really like this way of organizing personal knowledge. In daily use, though, I found the workflow a little cumbersome. I had to keep both Obsidian and Codex open and constantly switch between them, which was especially annoying because I usually work on a single screen. I also found it hard to recommend llm-wiki to non-technical friends, because it required them to install a coding agent, configure the environment, and set up an LLM model. That is a lot of friction before they can even try the idea.

So I built gogo. Today, I use gogo as my daily entry point for working with llm-wiki. Although it's not a perfect app, I find it good enough to meet my needs. It brings the local knowledge base, the AI research assistant, and the llm-wiki workflow into one app. If you have run into the same pain points, I hope it helps you too.

## Getting Started

gogo provides installers for Windows x64 and macOS (Apple Silicon). You can download the appropriate package from [GitHub Releases](https://github.com/Barytes/gogo/releases).

### 1. First Launch

After installation, you will see a welcome screen on first launch. The first thing you need to do is configure your LLM model. gogo is powered by [Pi Agent](https://github.com/badlogic/pi-mono), which supports both API Key and OAuth-based configuration. If you use LLMs through purchased API access or a coding plan subscription, you can enter your API key, base URL, and related settings in the API Key option. You can also paste in a JSON configuration file provided by a model provider such as OpenClaw, and gogo will recognize it automatically. If you subscribe to a provider's premium plan, you can open Pi in a terminal from the OAuth option and log in to a supported provider with the `\login` command. At the moment, the supported providers are Anthropic (Claude Pro/Max), GitHub Copilot, Google Cloud Code Assist (Gemini CLI), Antigravity, and ChatGPT Plus/Pro (Codex Subscription).

After configuring your LLM model, you need to choose the location of your knowledge base. If you do not already use an llm-wiki-style knowledge base, gogo will create a sample knowledge base for you in the path you select; see [example-knowledge-base](https://github.com/Barytes/gogo/tree/main/example-knowledge-base). If you already use an llm-wiki-style knowledge base with `raw/` and `wiki/` directories, you can point gogo to your own knowledge base instead.

### 2. The llm-wiki Workflow

If you are not familiar with llm-wiki, you can start with this article: [llm-wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f). The core idea of llm-wiki is to turn one-off retrieval into knowledge that can be continuously maintained, so that it compounds over time.

The llm-wiki workflow can be summarized with three schemas: 1) **Ingest**: put new material into the `raw/` layer, let the LLM read it, create new wiki pages in the `wiki/` layer, and connect them with existing pages; 2) **Query**: answer questions by searching and synthesizing from `wiki/` first, and return to `raw/` for verification when needed; 3) **lint**: clean up wiki pages and check for conflicts, outdated content, orphan pages, and missing links.

gogo's sample knowledge base, available at [example-knowledge-base](https://github.com/Barytes/gogo/tree/main/example-knowledge-base), gives you a minimal llm-wiki to start from. It includes:

- `wiki/`: maintained wiki pages
- `raw/`: raw source material
- `inbox/`: a temporary entry point for new files
- `skills/`: skills used by the agent
- `schema/`: defines the three schemas for ingest, query, and lint
- `AGENTS.md`: the agent's initial instructions

You can customize how the agent behaves inside the knowledge base by modifying the schemas, skills, and `AGENTS.md`.

You can also use this knowledge base with any coding agent you like, such as Claude Code or Codex. It does not depend on gogo.

### 3. Using llm-wiki Through gogo

gogo includes a built-in Pi agent that you can talk to through the Chat interface to work with llm-wiki.

- **Ingest**: the Pi agent ingests content from the knowledge base's `inbox/` directory. You can move files into `inbox/` yourself, or click the `+` button in the chat input to upload a file, and gogo will copy that file into `inbox/`. You can inspect the contents of `inbox/` in the floating inbox panel at the bottom right. Clicking the Ingest button inserts a prompt for the workflow.
- **Query**: gogo's Pi agent answers questions by synthesizing from the wiki. When the wiki does not contain enough material, it will browse the raw sources to gather more information. It does not include web search by default, so you need to configure a corresponding skill yourself if you want that ability.
- **lint**: just tell the Pi agent that you want to lint or clean up the knowledge base.
- **Browsing the Wiki**: gogo has two interface modes, `Wiki` and `Chat`, and you can switch between them with the toggle in the upper right. In Wiki mode, wiki browsing is the main view and Chat appears as a floating panel at the bottom right; in Chat mode, the agent chat window becomes the main view and Wiki appears as the floating panel. Links inside wiki pages and pages mentioned in agent responses can be clicked to jump directly. The Wiki interface also includes simple edit, delete, and create actions. You can also click the page's quote button to insert that page into your prompt.
- **Skills and Schemas**: the chat window supports slash commands that invoke skills and schemas defined in the knowledge base's `skills/` and `schemas/` directories. You can add, modify, or delete those skills and schemas yourself. gogo also provides a simple panel under `Current Skills` in the settings panel, opened with the `⚙️` button in the upper left, where you can browse, edit, create, and delete skills and schemas.
- **Models**: the agent chat window includes controls for switching models, thinking level, permissions, and displaying or compacting the context window. You can also add, edit, and delete model provider configurations in the `Models` section of the settings panel opened from the `⚙️` button in the upper left.
- **Settings Panel**: click the `⚙️` button in the upper left to open the settings panel. The `Knowledge Base` section lets you switch between different knowledge bases. The `Current Skills` section lets you browse and modify the current knowledge base's skills and schemas. The `Models` section is for configuring model providers. The `Diagnostics` section shows log information.

## Design Principles

- **💁 gogo serves the local llm-wiki knowledge base**: it provides a better entry point for llm-wiki, rather than locking knowledge and workflow back into the app itself. Stopping use of gogo does not mean losing anything stored in the knowledge base.
- **🤝 A unified Wiki + Agent workspace**: gogo brings knowledge browsing, page editing, and conversations that move knowledge work forward into a single workspace, reducing the cost of constantly switching between tools.
- **🔍 Focused on the llm-wiki use case, not a general-purpose knowledge manager**: gogo prioritizes making llm-wiki-style local knowledge-base workflows feel smooth, instead of sacrificing clear boundaries and usability for broader but less focused scenarios.
- **👑 The user is the primary owner of the knowledge base**: users should always be able to inspect, modify, migrate, and replace their own knowledge-base structure, skills, schemas, and workflows, rather than being forced into the defaults of a closed system.
- **🤖 Do not over-black-box the agent**: gogo does not present the agent as invisible magic; instead, it tries to keep model configuration, slash commands, diagnostics, context, and permission boundaries visible to the user.
- **📦 Out of the box**: gogo aims to minimize setup friction so that users can start using llm-wiki with as little environment preparation as possible.

## Project Status

This project is in **maintenance mode**.

It is published as a portfolio project. Due to limited personal bandwidth, I am no longer actively developing new features, and this repository should not be treated as production-ready software or a long-term supported desktop product.

What this means:

- You can download and run the current version of gogo through the Windows / macOS installers.
- You can read the code, run it locally, and use it as a reference implementation.
- The project is now maintained on a best-effort basis, and I do not plan to actively push new features or provide long-term support.


## 开发者指南 / Developer Guide

如果你想深入了解这个项目，你可以从下面的文档入手，并进一步阅读[docs](https://github.com/Barytes/gogo/tree/main/docs)中的文档。

If you want to know more about this project, you can begin with the following docs and read the documentation in [docs](https://github.com/Barytes/gogo/tree/main/docs).

- [文档索引 / Documentation index](docs/index.md)
- [开发者文档 / Developer guide](docs/public/developer-guide.md)
- [设计原则 / Design principles](docs/public/design-principles.md)
- [架构概览 / Architecture overview](docs/public/architecture-overview.md)
- [知识库指南 / Knowledge base guide](docs/public/knowledge-base-guide.md)
