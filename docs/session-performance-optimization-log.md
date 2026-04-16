# 会话切换与启动卡顿排查记录

**最后更新**: 2026-04-16

## 1. 问题现象

用户反馈：

- 应用启动后恢复最近会话时，聊天区会短暂卡一下，然后历史消息才整体出现
- 点击切换到另一个会话时，也会出现类似的短暂卡顿

这类卡顿主要发生在：

- `bootstrapChat()` 初始化后的首个会话恢复
- `switchToSession()` 切换到一个尚未缓存 DOM 视图的会话

## 2. 本轮排查结论

本轮没有先上复杂 profiling，而是先沿代码路径排查了最可能的热点。结论是：卡顿主要来自“后端历史恢复慢 + 前端整段同步重渲染”的叠加。

### 2.1 后端热点

`/api/sessions/{id}/history` 最终走 `SessionPool.replay_history()`。

旧逻辑里，即使本地已经有应用层 `gogo-session-turns/*.jsonl`，仍然会优先尝试：

1. 新建一条临时 `PiRpcClient`
2. `switch_session`
3. `get_messages()`

这会导致每次打开会话时都额外做一轮 Pi RPC 历史回放，代价明显高于直接读取本地富历史文件。

### 2.2 前端热点

`switchToSession()` 旧逻辑里有两个明显的同步热点：

1. 在真正开始历史恢复前，会先 `await fetchSessionDetail(sessionId)`，把一个本可后台刷新的请求串行挡在前面
2. `renderHistory()` 用 `appendMessage()` 逐条插入历史，而 `appendMessage()` 每插一条都会：
   - 触发一次自动滚动逻辑
   - 触发一次右侧问题导航刷新

这意味着一段 100~200 条消息的历史，会在同一轮切换里重复触发很多次布局与导航计算，主线程卡顿就会很明显。

## 3. 本轮优化

### 3.1 迭代 1：历史恢复优先走本地 app-turns

文件：

- [app/backend/session_manager.py](/Users/beiyanliu/Desktop/gogo/gogo-app/app/backend/session_manager.py:1418)

改动：

- 如果当前 session 有本地 `gogo-session-turns/*.jsonl`
- 且会话当前不在 pending 回复中
- 则 `replay_history()` 直接返回应用层富历史

这样能避免在常见会话打开路径上，为了恢复历史再额外启动一次 Pi RPC 历史读取。

收益：

- 启动恢复最近会话更快
- 切换到已有历史的会话更快
- 同时保留 `trace / warnings / consulted_pages` 这些 UI 需要的富元数据

### 3.2 迭代 2：切会话时不再阻塞等待 session detail

文件：

- [app/frontend/assets/chat.js](/Users/beiyanliu/Desktop/gogo/gogo-app/app/frontend/assets/chat.js:2503)

改动：

- `switchToSession()` 不再先 `await fetchSessionDetail(sessionId)`
- 改成后台异步刷新 `refreshCurrentSessionDetailInBackground()`

收益：

- 减少会话切换前的额外等待
- session 标题 / 设置仍会随后刷新，但不会挡住历史消息出现

### 3.3 迭代 3：历史消息分批渲染，而不是逐条同步重排

文件：

- [app/frontend/assets/chat.js](/Users/beiyanliu/Desktop/gogo/gogo-app/app/frontend/assets/chat.js:1294)

改动：

- 把历史渲染改成 `createMessageElement() + renderHistory()` 分批插入
- 每批次渲染后让出一帧，再继续下一批
- 不再为历史恢复中的每一条消息都单独触发滚动和导航刷新

收益：

- 会话切换时主线程阻塞显著减轻
- 聊天区不再因为一次性重建大段历史而“卡死一下”
- 右侧问题导航仍然会刷新，但只在整段历史渲染后统一刷新一次

### 3.4 迭代 4：启动阶段的独立请求并行化

文件：

- [app/frontend/assets/chat.js](/Users/beiyanliu/Desktop/gogo/gogo-app/app/frontend/assets/chat.js:3180)

改动：

- `bootstrapChat()` 原本会串行执行：
  - `reloadPiOptions()`
  - `loadSlashCommands()`
  - `reloadSessions()`
  - `refreshInboxFiles()`
- 现在改成并行启动，再汇总错误

收益：

- app 冷启动时减少不必要的串行等待
- 最近会话恢复前的准备阶段更短

### 3.5 迭代 5：流式回答正文按帧合并 Markdown 渲染

文件：

- [app/frontend/assets/chat.js](/Users/beiyanliu/Desktop/gogo/gogo-app/app/frontend/assets/chat.js:2102)

改动：

- `appendDelta()` / `setContent()` 不再每收到一个增量就立刻重跑一次 `markdownToHtml()`
- 改成用 `requestAnimationFrame` 合并到下一帧统一渲染
- `finalize()` 时再强制 flush，确保最终正文一定完整落地

收益：

- 长回答流式生成时，主线程不会被高频 Markdown 全量重渲染持续占满
- 视觉上仍保持“边生成边看到 Markdown 效果”，但渲染频率被限制在浏览器帧级别

### 3.6 迭代 6：右侧问题导航改成缓存 anchor + 按需重建

文件：

- [app/frontend/assets/chat.js](/Users/beiyanliu/Desktop/gogo/gogo-app/app/frontend/assets/chat.js:1477)

改动：

- 不再在每次滚动或导航刷新时重新 `querySelectorAll(".message-user")`
- 改成维护 `questionAnchorsCache`
- 右侧导航 DOM 结构只在“问题条目结构变化”时重建
- 普通滚动时只更新当前 active 态，不再整块重建进度条和浮窗列表

收益：

- 长会话滚动时，右侧问题导航的刷新成本明显下降
- 问题越多，收益越明显

### 3.7 迭代 7：session registry 的触碰式更新改成节流落盘

文件：

- [app/backend/session_manager.py](/Users/beiyanliu/Desktop/gogo/gogo-app/app/backend/session_manager.py:101)

改动：

- `SessionPool` 新增 registry 触碰写盘节流状态：
  - `self._registry_touch_save_interval = 5.0`
  - `self._registry_last_saved_at`
- `_sync_registry_from_session()` 改成区分两类更新：
  - `force_save=True`：创建会话、设置更新、流式请求开始/结束、重置退出等结构性变化，仍然立即落盘
  - `force_save=False`：`get_session()` 这类只更新时间戳的触碰式更新，仅更新内存 registry，并按节流窗口合并写盘
- `get_session()` 不再每次读取会话都同步写整个 `gogo-session-registry.json`

收益：

- 会话读取高频场景下，磁盘 I/O 明显减少
- 不再为了 `last_used_at` 的频繁变化反复重写完整 registry 文件
- 结构性元数据仍保持立即持久化，异常退出时仍有较高可靠性

### 3.8 迭代 8：app-turns 历史恢复改成 JSONL 尾部读取

文件：

- [app/backend/session_manager.py](/Users/beiyanliu/Desktop/gogo/gogo-app/app/backend/session_manager.py:253)

改动：

- 为 `gogo-session-turns/*.jsonl` 增加 `_read_app_turn_tail_lines()`
- 当 `replay_history()` 只需要最近 `max_turns` 条历史时
- 不再从头顺序读取完整 JSONL 文件
- 而是按块从文件尾部反向读取，直接提取最后 `N` 行再做 JSON 解析与标准化

收益：

- 超长会话恢复最近历史时，读取成本随“需要展示的条数”增长，而不再随整个历史文件长度线性增长
- 对默认 `max_turns=200` 的常见会话恢复路径收益最直接
- 不需要引入额外快照文件，复杂度低、可靠性高

### 3.9 迭代 9：启动链路改成“首屏优先，会话先于预热”

文件：

- [app/frontend/assets/chat.js](/Users/beiyanliu/Desktop/gogo/gogo-app/app/frontend/assets/chat.js:3260)
- [src-tauri/src/backend.rs](/Users/beiyanliu/Desktop/gogo/gogo-app/src-tauri/src/backend.rs:18)

改动：

- `bootstrapChat()` 不再等待 `reloadPiOptions()`、`loadSlashCommands()`、`refreshInboxFiles()` 一起完成后再恢复最近会话
- 启动关键路径改成：
  1. `reloadSessions()`
  2. 恢复最近活跃会话或进入草稿态
  3. 首帧显示后再后台预热 `Pi options / slash / inbox`
- Tauri 侧后端健康检查轮询间隔从 `300ms` 收紧到 `100ms`

收益：

- 窗口显示后，首屏更快进入“可见的会话列表 / 最近会话”状态
- `slash`、`inbox`、模型选项这些非关键请求不再阻塞首屏
- 打包后的桌面版在“等待后端 ready 才创建窗口”的链路上，最多可减少约 `200ms` 的轮询颗粒度损耗

补充说明：

- `desktop:dev` 模式仍然受 `beforeDevCommand` 约束，开发态首次起窗前的等待不可能完全消除
- 这轮优化主要改善的是打包运行时的窗口出现速度，以及窗口出现后的首屏体感

### 3.10 迭代 10：长会话只先渲染最近一页历史，老历史按需加载

文件：

- [app/backend/main.py](/Users/beiyanliu/Desktop/gogo/gogo-app/app/backend/main.py:1075)
- [app/backend/session_manager.py](/Users/beiyanliu/Desktop/gogo/gogo-app/app/backend/session_manager.py:243)
- [app/frontend/assets/chat.js](/Users/beiyanliu/Desktop/gogo/gogo-app/app/frontend/assets/chat.js:1417)
- [app/frontend/index.html](/Users/beiyanliu/Desktop/gogo/gogo-app/app/frontend/index.html:160)

改动：

- `/api/sessions/{id}/history` 新增从最新往前的 `offset` 分页语义
- 前端首次恢复会话时，只请求最近 `60` 条历史
- 如果后端判断还有更早历史，则在聊天区顶部显示 `加载更早消息`
- 点击后再按批次补更老的一页，并把新加载的消息 prepend 到现有列表顶部

收益：

- 长会话打开时，首屏 DOM 构建量被限制在最近一页历史
- 会话切换和启动恢复时的首屏体感进一步改善
- 现有会话缓存、吸底逻辑、流式渲染都可以继续复用

当前取舍：

- 右侧问题导航当前只基于“已经渲染出来的用户问题”工作
- 也就是说，未加载的更早历史不会先出现在右侧导航里
- 这是当前阶段为了换取更轻首屏成本而做的有意取舍

### 3.11 迭代 11：trace / 思考过程按展开时机延迟渲染

文件：

- [app/frontend/assets/chat.js](/Users/beiyanliu/Desktop/gogo/gogo-app/app/frontend/assets/chat.js:2178)

改动：

- 历史 assistant 消息的 trace 区不再在创建消息 DOM 时立即构造完整 trace 列表和 warnings 列表
- 改成先只渲染 summary，用户首次展开 `details.message-trace` 时再一次性生成内部 DOM
- 流式 assistant 消息也改成同样的思路：
  - 折叠状态下只维护 `traceState / warningState`
  - 展开后才按帧构建或刷新 trace worklog DOM

收益：

- 长会话恢复时，assistant 历史消息里大量默认折叠的 trace DOM 不再抢占首屏构建成本
- 流式回复阶段即使持续收到 trace/warnings，也不会在折叠状态下不断维护完整内部 DOM
- 与当前会话视图缓存兼容，因为展开行为仍然绑定在真实 DOM 节点上

## 4. 当前状态

这轮优化完成后，已经优先解决了最显眼的两类低风险问题：

- 会话历史恢复时的额外 RPC 开销
- 历史消息整段同步重渲染造成的主线程卡顿
- 启动时把非关键预热请求挡在首屏前的问题
- 折叠状态下 trace / 思考过程仍然提前构建完整 DOM 的问题

这属于第一轮体感优化，不是终局方案。

## 5. 后续可继续优化的方向

如果后面还觉得会话很长时仍有卡顿，可以继续按下面优先级推进：

1. 历史恢复时优先先渲染“最近 N 轮”，更老消息延迟加载
2. 把右侧问题导航改成更懒的刷新策略，避免长历史每次都重新扫描所有 `.message-user`
3. 对超长会话引入虚拟列表
4. 继续评估是否还要进一步延迟更多折叠区域的内部 DOM 渲染
5. 如果仍然在意“窗口出现前”的等待，再评估是否需要原生 splash / 启动占位页

## 5.1 更深层长会话渲染优化评估

这轮没有继续直接改代码，而是先对三类更深层方案做了实现复杂度和收益评估。

### 方案 A：只先渲染最近 N 轮，老历史延迟加载

当前观察：

- `renderHistory()` 虽然已经分批渲染，但仍然会为这次恢复到前端的整段历史全部创建 DOM
- `createMessageElement()` 会同步构造 assistant 正文、引用区、动作区，以及 trace 容器
- 当一次恢复的是一段很长的历史时，分批渲染只能降低主线程峰值，不能减少总 DOM 构建量

优点：

- 对当前架构最匹配，收益最大
- 不需要立即上虚拟列表
- 可以继续复用已有 `sessionHistories`、`sessionViewNodes` 和“回到底部”逻辑
- 用户通常更关心最近几十轮，会话打开体感会明显改善

缺点：

- 需要引入“加载更早消息”交互
- 需要重新定义右侧问题导航是基于“已渲染问题”还是“全部问题”
- 如果用户频繁回看特别早的历史，会多一次加载操作

判断：

- **推荐作为下一步最高优先级实现**

### 方案 B：引入虚拟列表

当前观察：

- 现有聊天区不是纯文本列表，而是混合了：
  - 用户消息
  - assistant Markdown
  - 可展开 trace
  - 引用 / 写回动作
  - 右侧问题导航与吸底逻辑
- 每条消息高度高度动态，尤其 trace 展开前后差异很大

优点：

- 对超长历史的滚动性能提升上限最高
- 能从根上限制 DOM 数量

缺点：

- 实现复杂度最高
- 需要重写当前 `messagesEl`、滚动吸底、会话视图缓存、问题导航、trace 展开等多套逻辑
- 很容易引入“滚动位置跳动”“展开 trace 后高度错乱”“切会话缓存失真”等交互问题

判断：

- **当前阶段不推荐立即上**
- 更适合作为“最近 N 轮 + 延迟 trace”之后的第三阶段方案

### 方案 C：trace / 思考过程延迟渲染

当前观察：

- `renderTrace()` 在历史恢复时会直接把完整 trace 列表和 warning 列表都构造成 DOM
- 即使 `details.message-trace` 默认是折叠的，内部节点也已经全部创建完毕
- 对 trace 较长的 assistant 消息，这部分 DOM 成本不小

优点：

- 实现复杂度中等偏低
- 不改变消息主列表结构
- 对“长会话 + trace 很多”的场景收益直接
- 与方案 A 兼容，可以叠加

缺点：

- 需要改造 trace 数据在 DOM 与内存中的持有方式
- 展开 trace 时会有一次延迟，需要处理首开时机和过渡体验

判断：

- **推荐作为第二优先级实现**
- 最适合做成：历史恢复时只渲染 summary，用户首次展开时再填充完整 trace DOM

## 5.2 结论与推荐顺序

综合当前代码结构和收益/复杂度比，推荐顺序是：

1. **实现“最近 N 轮优先渲染，老历史延迟加载”**
2. **实现 trace / 思考过程延迟渲染**
3. 再评估是否真的需要虚拟列表

当前状态：

- 上面第 1、2 项已经完成第一轮实现
- 下一步是否继续深入，主要取决于真实长会话体感是否仍然不够顺滑

原因是：

- 当前系统已经有会话历史缓存、分批渲染和问题导航缓存，说明它更适合继续沿“减少首屏 DOM 构建量”这条线演进
- 直接跳到虚拟列表，会明显放大当前聊天区交互复杂度
- 先把“渲染多少”和“何时渲染 trace”收紧，通常就足以覆盖大多数长会话卡顿

## 6. 本轮新增发现的性能热点

除了已经修掉的点，这轮又确认了几类仍然值得关注的热点：

### 6.1 前端：流式回复时整段 Markdown 重渲染

文件：

- [app/frontend/assets/chat.js](/Users/beiyanliu/Desktop/gogo/gogo-app/app/frontend/assets/chat.js:2195)

现状：

- `appendDelta()` 每收到一个文本增量
- 都会把完整 `rawContent` 重新喂给 `markdownToHtml()`
- 然后整段覆盖 `bodyEl.innerHTML`

影响：

- 长回答、token 频繁更新时，会持续占用主线程
- 这更容易影响“正在生成时”的流畅度，而不是会话切换

当前状态：

- 这个热点已经做了第一轮优化：按帧合并渲染
- 后续如果仍觉得长回答生成时发涩，再评估“生成中纯文本、final 再完整 Markdown”这一档更激进的方案

### 6.2 前端：右侧问题导航仍会扫描全部用户消息

文件：

- [app/frontend/assets/chat.js](/Users/beiyanliu/Desktop/gogo/gogo-app/app/frontend/assets/chat.js:1405)
- [app/frontend/assets/chat.js](/Users/beiyanliu/Desktop/gogo/gogo-app/app/frontend/assets/chat.js:1558)

当前状态：

- 这个热点已经做了第一轮优化
- 当前实现会缓存问题 anchor，并把“结构重建”和“active 高亮更新”拆开
- 现在只有在新增/重建消息结构时才重建右侧问题导航，普通滚动只更新高亮态

### 6.3 后端：`get_session()` 高频更新时间会触发 registry 落盘

文件：

- [app/backend/session_manager.py](/Users/beiyanliu/Desktop/gogo/gogo-app/app/backend/session_manager.py:527)

现状：

- `get_session()` 每次都会更新 `last_used_at`
- 然后调用 `_sync_registry_from_session()`
- 最终写回整个 `gogo-session-registry.json`

影响：

- 单次代价不大
- 但如果会话读取很频繁，这属于不必要的磁盘 I/O

当前状态：

- 这个热点已经做了第一轮优化
- `get_session()` 的触碰式更新现在只会按节流窗口合并写盘
- 创建、设置更新、请求开始/结束、重置等结构变化仍立即落盘

### 6.4 后端：`_load_history_from_app_turns()` 每次都顺序读取完整 JSONL

文件：

- [app/backend/session_manager.py](/Users/beiyanliu/Desktop/gogo/gogo-app/app/backend/session_manager.py:260)

现状：

- 即使只要最近 200 条 turn
- 目前还是从头把整个 `gogo-session-turns/*.jsonl` 顺序读完，再截尾

影响：

- 对普通会话问题不大
- 对特别长的会话，读取成本会逐渐累积

当前状态：

- 这个热点已经做了第一轮优化
- 当只需要最近 `max_turns` 条 app-turns 时，当前实现会直接从 JSONL 文件尾部反向读取最后几行
- 后续如果历史规模继续扩大，再评估周期性快照或分段文件

### 6.5 启动阶段：首屏关键路径里混入非关键预热请求

文件：

- [app/frontend/assets/chat.js](/Users/beiyanliu/Desktop/gogo/gogo-app/app/frontend/assets/chat.js:3260)
- [src-tauri/src/backend.rs](/Users/beiyanliu/Desktop/gogo/gogo-app/src-tauri/src/backend.rs:257)

现状：

- 启动时原本会先等待 `Pi options / slash / inbox / sessions` 一起完成
- 而桌面壳在打包模式下还会先等待本地 FastAPI 健康检查通过，才创建主窗口

当前状态：

- 这个热点已经做了第一轮优化
- 前端首屏现在只保留“会话列表 + 最近会话恢复”关键链路
- Tauri 端健康检查轮询颗粒度也已收紧
- 如果后面仍觉得“窗口出现前”等待明显，再评估原生 splash

### 6.6 前端：长会话恢复时仍会创建完整消息 DOM 与 trace DOM

文件：

- [app/frontend/assets/chat.js](/Users/beiyanliu/Desktop/gogo/gogo-app/app/frontend/assets/chat.js:1310)
- [app/frontend/assets/chat.js](/Users/beiyanliu/Desktop/gogo/gogo-app/app/frontend/assets/chat.js:2058)

现状：

- `renderHistory()` 仍会为本次恢复到前端的全部历史创建 DOM
- assistant 历史消息会同步构造 Markdown 正文、引用区、操作区、trace 容器
- `renderTrace()` 即使在折叠状态下，也会预先创建完整 trace/warnings 子树

当前判断：

- 这是当前前端长会话渲染里剩下最值得继续优化的热点
- 下一步最推荐的方向不是虚拟列表，而是：
  - 只先渲染最近 N 轮
  - trace 按展开时机延迟渲染

当前状态：

- “只先渲染最近 N 轮”已经完成第一轮实现
- 当前前端长会话渲染里剩下更值得继续压缩的，是 assistant 历史消息中的 trace / warnings DOM

当前状态：

- 这个热点已经做了第一轮优化
- 历史与流式 assistant 消息都改成折叠时只维护 trace 状态
- 当前前端长会话渲染里剩下更值得继续评估的，才是是否要进一步引入虚拟列表
## 7. 结论

本轮最关键的判断是：

- 卡顿不是单一后端问题，也不是单一前端问题
- 而是“历史回放成本 + 同步重渲染成本”叠加
- 除了渲染侧，后端的高频元数据持久化也会在长时间交互里制造额外 I/O 噪音，适合用“触碰更新节流、结构更新立即保存”的方式收敛
- 启动体验还受“首屏关键路径是否被非关键数据阻塞”以及“Tauri 是否先等本地后端 ready 才起窗”这两层影响

因此第一轮优化也选择了双侧同时收敛：

- 后端减少不必要的历史回放
- 前端减少一次会话切换中的重复布局与导航计算
