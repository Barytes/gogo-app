# Docs Index

**最后更新**: 2026-04-24

> 说明：本索引仅覆盖 `docs/` 根目录文档，不包含 `docs/pi/`。

## 产品与总览

- [release-target-and-boundaries.md](release-target-and-boundaries.md) - 当前对外发布目标、支持范围、外部依赖与开发态/正式分发边界
- [product-definition-belief.md](product-definition-belief.md) - 产品目标与价值主张
- [课题组公共知识库的联邦架构设计.md](课题组公共知识库的联邦架构设计.md) - 联邦架构全局设计（历史/全局视角）

## 架构（gogo 项目）

- [gogo-project-architecture.md](gogo-project-architecture.md) - gogo 项目总览：gogo-app / gogo-server / gogo-client / knowledge-base 的关系
- [gogo-app-architecture.md](gogo-app-architecture.md) - gogo-app 的职责、边界与前后端架构
- [desktop-packaging-options.md](desktop-packaging-options.md) - gogo-app 桌面应用封装方案评估与当前路线说明
- [desktop-packaging-guide.md](desktop-packaging-guide.md) - 当前仓库下 macOS / Windows 的桌面打包方法、前置条件、产物位置与已知边界
- [desktop-packaging-regressions.md](desktop-packaging-regressions.md) - 桌面打包真实回归、根因、修复与发包前强制检查清单
- [tauri-migration-plan.md](tauri-migration-plan.md) - gogo-app 当前 Tauri 桌面壳实现、目标架构与后续迁移顺序
- [workspace-and-agent-runtime-refactor-plan.md](workspace-and-agent-runtime-refactor-plan.md) - 下一阶段两条结构性重构计划：内容工作区抽象，以及“ACP 外接 agent + bundled Pi fallback”的 runtime 抽象
- [gogo-client-architecture.md](gogo-client-architecture.md) - gogo-client 的职责、边界与同步端架构设计
- [gogo-server-architecture.md](gogo-server-architecture.md) - gogo-server 的职责、边界与聚合端架构设计

## 架构（Agent / Session）

- [agent-architecture.md](agent-architecture.md) - 当前 Agent 后端实现（RPC-only）
- [session-management.md](session-management.md) - Session 管理与恢复机制
- [agent-session-refactor-assessment.md](agent-session-refactor-assessment.md) - Agent/Session 重构评估与里程碑
- [frontend-workbench-elements.md](frontend-workbench-elements.md) - 前端工作台页面元素、状态与交互实现说明
- [model-provider-configuration-options.md](model-provider-configuration-options.md) - 用户自定义 model provider 的可选方案、取舍与推荐路线
- [slash-command-scope.md](slash-command-scope.md) - slash 命令的来源边界、候选范围、取舍与推荐决策
- [session-performance-optimization-log.md](session-performance-optimization-log.md) - 会话切换 / 启动恢复卡顿的排查、优化与迭代记录

## 规范与映射

- [knowledge-base-architecture.md](knowledge-base-architecture.md) - knowledge-base 的架构、schema、行为与边界
- [code-doc-mapping.md](code-doc-mapping.md) - 代码文件与解释文档映射
- [problem-log.md](problem-log.md) - 开发问题、根因与解决方案记录
- [documentation-cleanup-audit-2026-04-15.md](documentation-cleanup-audit-2026-04-15.md) - 本轮文档清理与覆盖性审计结果
