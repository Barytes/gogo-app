# knowledge-base 能力说明

**最后更新**: 2026-04-14

## 1. 文档目的

本文档只描述 `knowledge-base` 侧能力，不描述 gogo-app 应用实现。

## 2. 核心定位

knowledge-base 是“内容与规则基础设施”，面向任意 coding agent（pi/codex/claude 等）统一提供约束。

## 3. 提供的能力

- 内容存储：`raw/`、`wiki/`
- 结构规范：目录结构、frontmatter、页面类型
- 写回规范：允许写入的位置、命名约定、字段约束
- 质量约束：lint/校验规则、引用与链接规范
- 协作约束：贡献流程、变更记录、文档同步规则

## 4. 不负责的能力

- 前端 UI
- 会话管理
- RPC 与模型接入
- 流式渲染与交互体验

这些由 gogo-app 或其他客户端应用负责。

## 5. 与 gogo-app 的关系

- gogo-app 使用 knowledge-base 作为数据与规范来源。
- gogo-app 不应复制一套与 knowledge-base 冲突的写回/校验语义。
- 如果规则变化，应优先更新 knowledge-base 规范，再由 gogo-app 适配。

## 6. 相关文档

- [app-kb-boundary.md](app-kb-boundary.md)
- [client-architecture.md](client-architecture.md)
- [server-architecture.md](server-architecture.md)

