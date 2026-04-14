# gogo-server Architecture

**最后更新**: 2026-04-14

> 本文档描述 `gogo-server` 的目标架构。  
> 当前仓库尚未实现 `gogo-server`，本文档描述的是设计目标与系统边界。  
> 项目级关系见 [gogo-project-architecture.md](gogo-project-architecture.md)。

## 1. 定位

`gogo-server` 是多用户公共知识库聚合端。

它的职责不是替用户推理，而是：

- 托管多个用户贡献进入公共池的入口
- 管理 `pending-pool` 与 `public-pool`
- 执行知识聚合、发布与公共池维护

## 2. 功能职责

- 接收来自多个 `gogo-client` 的贡献
- 管理待处理的 `pending-pool`
- 管理可分发的 `public-pool`
- 执行聚合、索引更新、发布流程
- 对外提供公共池下载能力

## 3. 边界

### 3.1 gogo-server 负责

- 多用户公共知识入口
- 公共池生命周期管理
- 聚合与发布流程
- 面向客户端的同步目标

### 3.2 gogo-server 不负责

- 单用户本地聊天与会话体验
- 本地知识库浏览 UI
- knowledge-base schema 的定义
- 用户端模型接入

这些分别属于 `gogo-app`、`knowledge-base`、`gogo-client`。

## 4. 目标架构

```text
Multiple gogo-clients
  -> gogo-server ingestion layer
  -> pending-pool
  -> aggregation / publish pipeline
  -> public-pool
  -> back to clients
```

## 5. 核心子系统（设计）

### 5.1 Ingestion Layer

- 接收用户上传的贡献
- 校验基础元数据
- 写入 `pending-pool`

### 5.2 Pending Pool Manager

- 管理待处理内容
- 维护贡献状态
- 为聚合流程提供输入

### 5.3 Aggregation Pipeline

- 聚合知识条目
- 更新公共索引
- 将结果发布到 `public-pool`

### 5.4 Distribution Layer

- 向客户端暴露公共池下载目标
- 维护版本与发布状态

## 6. 数据对象（设计）

- `pending-pool`
- `public-pool`
- 聚合日志
- 发布版本信息
- 用户贡献记录

这些对象的内容结构应遵守 [knowledge-base-architecture.md](knowledge-base-architecture.md)。

## 7. 典型流程

### 7.1 接收贡献

1. 客户端上传本地贡献
2. server 完成接收与基础校验
3. 写入 `pending-pool`

### 7.2 聚合发布

1. 从 `pending-pool` 读取新贡献
2. 执行聚合流程
3. 更新 `public-pool`
4. 发布给客户端拉取

### 7.3 公共池分发

1. 客户端连接 server
2. 请求最新 `public-pool`
3. 下载并更新本地副本

## 8. 当前状态

当前未实现。  
从优先级看，后续建议先定义：

- `pending-pool/public-pool` 的边界
- 上传与下载协议
- 聚合触发机制
- 最小发布流程

