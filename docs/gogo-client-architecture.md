# gogo-client Architecture

**最后更新**: 2026-04-14

> 本文档描述 `gogo-client` 的目标架构。  
> 当前仓库尚未实现 `gogo-client`，本文档描述的是设计目标与系统边界。  
> 项目级关系见 [gogo-project-architecture.md](gogo-project-architecture.md)。

## 1. 定位

`gogo-client` 是用户本地的同步客户端。

它不是一个完整的知识库浏览应用，而是一个连接器与同步器，负责：

- 连接特定的 `gogo-server`
- 上传用户自己的 knowledge-base 贡献
- 下载 server 上的 `public-pool`
- 在本地 knowledge-base 与远端公共池之间建立同步关系

## 2. 功能职责

- 配置并连接一个或多个 `gogo-server`
- 管理用户身份与远端连接参数
- 打包并上传本地贡献
- 拉取并更新远端 `public-pool`
- 维护本地同步状态、冲突状态与日志

## 3. 边界

### 3.1 gogo-client 负责

- 本地与远端的同步协议执行
- 上传/下载过程的状态管理
- 用户侧 server 配置管理
- 将远端公共池映射到本地 knowledge-base 工作目录

### 3.2 gogo-client 不负责

- 聊天与 Agent UI
- 模型推理
- knowledge-base schema 定义
- 公共池聚合策略

这些分别属于 `gogo-app`、`knowledge-base`、`gogo-server`。

## 4. 目标架构

```text
Local knowledge-base
  <-> gogo-client
  <-> remote gogo-server
  <-> public-pool / pending-pool
```

## 5. 核心模块（设计）

### 5.1 Sync Engine

- 扫描本地待上传内容
- 拉取远端公共池更新
- 维护本地同步状态

### 5.2 Server Connector

- 保存 server URL、用户身份、认证信息
- 负责上传、下载、重试与状态反馈

### 5.3 Local Mapping Layer

- 将本地 knowledge-base 与远端 `public-pool` 建立目录映射
- 处理本地工作目录中的同步布局

### 5.4 Conflict / Status Layer

- 记录上传失败
- 记录下载版本差异
- 向用户暴露同步日志与当前状态

## 6. 关键数据对象（设计）

- 本地 knowledge-base 根目录
- 远端 server 配置
- `public-pool` 本地副本
- 待上传贡献队列
- 同步日志与状态缓存

## 7. 典型流程

### 7.1 上传贡献

1. 扫描本地可贡献内容
2. 按 knowledge-base 规范过滤与打包
3. 上传到 `gogo-server`
4. 记录上传结果

### 7.2 下载公共池

1. 连接远端 server
2. 拉取 `public-pool`
3. 更新本地副本
4. 刷新本地索引与同步状态

## 8. 当前状态

当前未实现。  
后续如果单独落库，建议优先做：

- server 配置
- `public-pool` 下载
- 本地贡献上传
- 同步状态展示

