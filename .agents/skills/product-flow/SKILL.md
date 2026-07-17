---
name: product-flow
description: 在 Codex 桌面任务内自动完成产品定义、程序团队模块交付、测试、Codex 验收与有限返工；Claude Code 受限时自动切换到同名 Codex 专业角色。用户说“自动交付：需求内容”、“一键交付”或显式调用 $product-flow 时使用；适用于希望只输入一次需求、不手动切换客户端的仓库内产品任务。
---

# 自动产品交付

把当前 Codex 任务作为产品经理和总编排器；优先通过脚本调用 Claude Code 程序团队，Claude
因配额或速率限制无法继续时，由当前任务调用同名 Codex 专业角色接力。保持顺序执行，不假设
两个客户端能互相发送消息。

## 授权语义

- 把 `$product-flow` 或“自动交付：”后的文本作为产品需求。
- 除非用户另有限制，本次调用明确授权：无阻塞时自动置为 `Ready`；实现证据全部通过时自动
  置为 `Accepted`；验收失败时最多再调用 Claude Code 一次。
- 只在必须新增业务决定、验收条件无法定义、权限/支付/隐私/删除/迁移等高风险事项、不可逆
  外部副作用或用户改动可能被覆盖时暂停询问。不要为了普通实现细节打断用户。

## 1. 预检

1. 从仓库根目录读取 `AGENTS.md`、`docs/product-collaboration.md` 和任务模板。
2. 运行 `claude auth status`、`node scripts/check_harness.mjs` 和 `git status --short`。
3. Claude 未登录、harness 失败或已有改动与需求可能重叠时停止并报告。保留所有用户改动。
4. 不自动提交、推送、发布或创建外部资源；除非用户另有明确授权。

## 2. 建立产品任务

1. 从 `docs/product/tasks/TEMPLATE.md` 创建一个日期加短名的任务文件，先使用 `Draft`。
2. 填写产品问题、目标用户、目标、非目标、可验证的验收标准、交付约束和业务模块。允许路径
   暂写“待架构确认”，由 Claude Code 负责人补充。
3. 对低风险缺口写明最小假设；不得把未确认的业务决定伪装成事实。
4. 如有阻塞问题，保持 `Draft` 并询问用户。如无阻塞，记录“用户通过 product-flow 委托自动
   确认”，把状态改为 `Ready`。

## 3. 调用程序团队

运行：

```text
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --task <任务路径>
```

用户明确授权 Claude Code 使用 `bypassPermissions` 时，改为运行：

```text
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --bypass-permissions --task <任务路径>
```

不得从普通 `$product-flow` 调用推断该权限；只有用户明确授权时才传入开关。runner 在 Claude
退出后必须重新读取任务状态，只有 `Implemented` 返回成功；`Blocked` 或残留的 `In Progress`
均返回非零，防止把 Claude 的正常进程退出误判为交付成功。

保持当前 Codex 任务等待命令结束。Claude Code 必须按 `CLAUDE.md` 依次使用架构、模块交付和
测试角色，写回 `Technical Plan`、`Implementation Report` 与状态。

runner 默认使用 Claude Code 的 `stream-json` 事件流，并在当前 Codex 任务中持续展示主/子角色
消息、工具调用、命令结果、文件操作、Hook 和最终统计；不得把长时间无输出误判为进程结束。
完整 JSONL 写入系统临时目录 `chaotang-product-flow/`，runner 启动时输出实际路径。实时展示会
截断过长单条内容并脱敏常见 API Key、Token、密码和 Bearer 凭据；需要完整诊断时读取本次打印
的 JSONL 路径，不把运行日志、密钥或环境文件写进仓库。

- 状态为 `Blocked`：读取阻塞内容并向用户提出最少问题，不继续重试。
- 状态不是 `Implemented`：报告协议失败，不自行伪造完成状态。
- 命令失败：保留输出和工作区，运行只读诊断后报告；不要无限重启。

### Claude 受限时由 Codex 接力

runner 只把结构化事件中的明确拒绝视为受限：`rate_limit_event.status = rejected`、
`error = rate_limit` 或错误结果的 HTTP 429。`allowed_warning`、普通实现失败、测试失败、权限拒绝、
任务 `Blocked` 和未登录均不触发模型切换。受限且任务尚未 `Implemented` 时 runner 返回专用退出码
`6`；这表示当前 Codex 任务应自动接力，不需要再次询问用户。

接力时，当前 Codex 任务分阶段担任程序团队负责人，并显式使用 `.codex/agents/` 中继承当前
Codex 会话模型的同名专业角色。该 skill 明确要求调用 Codex 原生 subagents；角色按以下顺序
执行，不并行运行有写权限的角色：

1. 保留 Claude 已产生的任务文件、diff 和日志；`Ready` 改为 `In Progress`，已有
   `In Progress` 不重置。先调用 `solution-architect` 只读复核当前状态，负责人据此补全或修订
   `Affected Modules` 的允许路径和 `Technical Plan`。
2. 对尚未完成的每个业务模块顺序调用一次 `module-engineer`，每次只传一个模块、允许路径、相关
   验收标准以及 Claude 已完成内容的摘要。专业角色不得修改产品任务文件。
3. 所有模块完成后调用 `test-engineer` 独立补测试、运行验证并寻找假绿；负责人随后自审、填写
   `Implementation Report` 并把状态改为 `Implemented`。
4. 若 Codex 专业角色发现产品歧义或高风险冲突，负责人改为 `Blocked` 并停止；不得用模型切换
   绕过产品停止条件。程序交付完成后，当前任务退出负责人阶段，再以产品经理身份执行验收。

Claude 受限后的 Codex 接力属于同一次交付尝试，不额外消耗一次返工机会。若 Claude 在受限前
已经完成部分模块，只交付剩余模块，但架构只读复核和最终测试角色仍必须执行，避免把不完整状态
直接当成实现证据。不得因为接力而扩大允许路径、提交、推送、发布或创建外部资源。

## 4. 验收与有限返工

1. 读取 diff、`Implementation Report` 和测试证据，运行 harness 及报告中可复现的相关验证。
2. 逐条核对 `Acceptance Criteria`。不能用“代码看起来正确”代替行为或测试证据。
3. 全部通过：填写 `Acceptance Review`，勾选已验证条目，把状态改为 `Accepted`。
4. 未通过：在 `Acceptance Review` 记录具体缺口，把状态退回 `Ready`，再次运行交付脚本。
5. 第二次仍未通过：把状态改为 `Blocked`，报告剩余缺口并停止。总交付次数最多两次。

## 5. 最终输出

向用户报告任务路径、最终状态、完成模块、验证证据、返工次数和剩余风险。若为 `Accepted`，
明确说明改动仍未提交；只有用户明确要求时才执行 Git 提交、推送或发布。

## 脚本维护

- 用 `node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test` 测试参数、路径和
  状态解析、流式参数、事件格式化、脱敏、受限事件识别与 Codex 接力退出码。
- 用 `--dry-run --task <Ready 任务>` 查看将发送给 Claude 的调用，不启动 Claude。
