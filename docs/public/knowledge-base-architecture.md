# knowledge-base Architecture

**最后更新**: 2026-04-14

> 本文档描述 `knowledge-base` 的架构、schema、行为、职责与边界。  
> 它不描述某一个具体应用如何实现 UI 或模型接入。  
> 早期项目级关系文档已不再作为当前公开文档维护。

## 1. 定位

`knowledge-base` 是 gogo 体系中的内容与规范基础设施。

它要解决的不是“怎么做一个应用”，而是：

- 内容如何组织
- 页面如何约束
- 写入如何规范
- 校验如何统一
- 多个 agent / 多个应用如何在同一套规则上协作

## 2. 总体边界

### 2.1 knowledge-base 负责

- 内容存储结构
- schema 与页面约束
- 写回规则
- lint / 校验规则
- 协作约定
- 本地知识库与公共知识池的数据边界

### 2.2 knowledge-base 不负责

- 前端 UI
- 会话管理
- 模型接入
- 流式事件处理
- 多用户 server 程序实现

这些属于 `gogo-app`、`gogo-client`、`gogo-server`。

## 3. 两类 knowledge-base

## 3.1 client 端 knowledge-base

这是用户本地工作的知识库实例。

典型结构：

```text
knowledge-base/
  raw/
  wiki/
  schemas/
  AGENTS.md
  docs/...
```

职责：

- 保存本地原始材料
- 保存本地 wiki 页面
- 提供 schema、规范、lint 约束
- 作为任意 coding agent 的共享工作面

## 3.2 server 端 knowledge-base

这是面向多用户共享的公共知识层。

典型由两部分组成：

- `pending-pool`
- `public-pool`

职责：

- 接收多个用户的可贡献内容
- 存储聚合前与聚合后的公共知识
- 向客户端分发公共池内容

## 4. client 端 knowledge-base 架构

## 4.1 `raw/`

职责：

- 保存原始材料
- 保持接近原始来源
- 作为上层 wiki 与 Agent 查询的证据层

边界：

- 不要求强结构化
- 不承担最终知识表达职责

## 4.2 `wiki/`

职责：

- 保存结构化知识页面
- 作为用户长期复用的知识层
- 承担概念、判断、方法、关系等表达

边界：

- 必须遵守页面 schema
- 应尽量避免把原始材料直接无结构堆入

## 4.3 `schemas/`

职责：

- 定义页面 frontmatter
- 定义页面类型
- 定义写回约束
- 定义 lint/校验规则

这是 knowledge-base 的“规则核心”。

## 4.4 行为约束

client 端 knowledge-base 应定义并约束：

- 哪些目录可写
- 哪些页面类型允许创建
- frontmatter 必填字段
- 链接、引用、命名规范
- lint 与校验失败时的行为

## 5. server 端 knowledge-base 架构

## 5.1 `pending-pool`

定位：

- 临时接收区
- 聚合前输入层

职责：

- 保存待进入公共池的贡献
- 为聚合流程提供原始输入

边界：

- 不是最终稳定知识视图
- 不应直接作为默认查询面

## 5.2 `public-pool`

定位：

- 公共知识发布层
- 多用户共享的稳定视图

职责：

- 存放聚合后的公共知识
- 为客户端分发提供来源
- 形成群体层的知识复利

边界：

- 不等于任何单个用户的本地知识库
- 内容应经过 server 侧流程处理后再发布

## 5.3 server 端行为约束

server 端 knowledge-base 应定义并约束：

- `pending-pool` 与 `public-pool` 的目录边界
- 聚合前后数据状态
- 可发布页面类型
- 公共池 schema 与索引规则
- 版本、日志、来源记录方式

## 6. Schema 设计原则

- 规则应稳定，避免频繁破坏性修改
- 不依赖某个单一 agent 的私有能力
- 对不同客户端与不同 agent 保持可实现
- 内容约束与应用实现分离

## 7. 行为设计原则

- 应让不同 agent 都能遵守同一套规则
- 应让不同应用都能读取与消费同一份知识库
- 应优先约束高风险动作：写入、覆盖、发布、聚合
- 不应把应用级流程硬编码进 knowledge-base 本身

## 8. 与其他系统的关系

### 8.1 与 gogo-app

- gogo-app 消费 knowledge-base 的内容与规则
- gogo-app 不应复制一套冲突的写回/校验语义

### 8.2 与 gogo-client

- gogo-client 负责把本地 knowledge-base 与 server 端公共池连接起来

### 8.3 与 gogo-server

- gogo-server 负责维护 server 端 knowledge-base 的生命周期

## 9. 当前设计结论

- 写回规则归 knowledge-base
- lint / 校验规则归 knowledge-base
- schema 演进归 knowledge-base
- gogo 应用族只负责消费、接入、同步、展示与编排

## 10. 相关文档

- [gogo-app-architecture.md](gogo-app-architecture.md)
