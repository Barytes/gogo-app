# Pi 最小安全边界

**最后更新**: 2026-04-18

## 1. 当前目标

这份边界说明只覆盖 `gogo-app` 首发前的最小安全约束。

目标不是把 Pi 变成强沙箱，而是先把最明显的宿主机风险收住：

- 默认不让 Pi 直接跑任意 `bash`
- 默认不让 Pi 把文件写到 knowledge-base 之外
- 默认阻断一批明显危险的宿主机命令
- 让用户能在聊天区直接切换当前安全模式
- 让用户在“模式阻断”发生时做一次人肉确认，并把禁止理由直接 steer 给 Pi
- 让用户能看见受信任工作区和本地审计记录

## 2. 当前实现

`gogo-app` 会托管生成 `.gogo/pi-extensions/managed-security.ts`，并在每次启动 Pi RPC 进程时自动通过 `--extension` 注入。

这层 extension 当前拦截：

- `bash`
- `write`
- `edit`

同时它还会：

- 为安全阻断写入结构化 payload，供前端弹窗显示命令/路径与可否单次放行
- 在“模式阻断”时通过 Pi RPC extension UI 子协议暂停当前 `tool_call`，等待前端返回允许或禁止

## 3. 安全模式

当前提供 3 档安全模式：

- `只读模式`
  允许聊天、读文件、搜索；禁止 `bash / write / edit`
- `允许写文件`
  允许在当前 knowledge-base 内 `write / edit`；默认禁止 `bash`
- `允许执行命令`
  允许 `bash / write / edit`，但仍会阻断明显危险命令

首发默认值是：

- `允许写文件`

这样可以保留 Wiki 写回等主流程，同时避免默认把宿主机 shell 完全暴露给 Pi。

## 4. 受信任工作区

当前首发版本只信任：

- 当前 knowledge-base 目录

这意味着：

- `write / edit` 只能落在当前 knowledge-base 内
- knowledge-base 外的路径会直接被阻断
- 目前还不支持用户在 UI 里追加额外受信任工作区

## 5. 默认阻断规则

在 `允许执行命令` 模式下，当前仍会默认阻断一批明显危险命令，例如：

- `sudo`
- `su`
- `rm -rf /`
- `rm -rf ~` / `rm -rf $HOME`
- `mkfs*`
- `dd ... of=/dev/...`
- `shutdown` / `reboot` / `halt` / `poweroff`
- `diskutil`
- `launchctl`

对于写文件，当前还会阻断：

- knowledge-base 外写入
- `.env`
- `.git`
- `node_modules`
- `.ssh`
- 常见 shell / git 配置文件

## 6. 本地审计

当前所有 `bash / write / edit` 的 allow / block 决策都会写入本地 JSONL 日志：

- `.gogo/logs/pi-security-events.jsonl`

兼容性保留的一次性审批状态文件仍然存在：

- `.gogo/pi-security-approvals.json`

但当前聊天主链路的“允许这一次”已经不再依赖它，而是直接在当前 `tool_call` 上做 inline confirm。

记录至少包含：

- 时间
- session
- tool
- 目标路径或命令
- 判定结果（`allow` / `block`）
- 阻断原因（如果有）

这些日志只保存在本地，不会自动上传。

## 7. 人在环确认

当前新增了一个“轻量人在环”链路，但边界非常明确：

- 安全模式入口位于聊天输入框控制区，不再放在 diagnostics 里
- 当 Pi 因当前模式被拦截时，聊天输入框上方会弹出一个小型确认框
- 确认框会显示：
  - 当前安全模式
  - Pi 正要执行的命令或文件路径
  - 这条阻断是否允许放行当前这一次调用
  - 当前阻断原因
- 用户可以：
  - `允许这一次`
    当前 `tool_call` 会直接恢复执行，不需要补发一条新的 user prompt
  - `禁止并告知 Pi`
    输入禁止理由后，extension 会在同一个 `tool_call` 内继续拿到这段理由，再以“当前调用被阻止”的方式把原因传回给 Pi，让 Pi 在同一轮里改计划

这里的“允许”只覆盖**当前模式造成的阻断**，不会穿透硬阻断。

也就是说，下面这些仍然不能被弹窗放开：

- `sudo`
- `su`
- `rm -rf /`
- `rm -rf ~`
- `mkfs*`
- `dd ... of=/dev/...`
- `shutdown / reboot / halt / poweroff`
- `diskutil`
- `launchctl`
- knowledge-base 外写入
- 敏感文件或敏感目录写入

## 8. 当前不承诺的能力

当前明确不承诺：

- 容器级隔离
- 系统调用级沙箱
- 完整的多工作区授权模型
- 所有高风险操作都支持交互式放行

## 9. 后续增强

不阻塞首发，但后续建议继续补：

- 为“工作区外写入 / 大范围删除 / 敏感配置改写”增加二次确认
- 评估容器化执行或更强沙箱
