---
name: product-flow
description: 在 Codex 桌面任务内自动完成产品定义、Claude Code 模块交付、测试、Codex 验收与有限返工。用户说“自动交付：需求内容”、“一键交付”或显式调用 $product-flow 时使用；适用于希望只输入一次需求、不手动切换 Codex 与 Claude Code 的仓库内产品任务。
---

# 自动产品交付

把当前 Codex 任务作为产品经理和总编排器；通过脚本调用 Claude Code 程序团队。保持顺序执行，
不假设两个客户端能互相发送消息。

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

## 3. 调用 Claude Code

运行：

```text
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --task <任务路径>
```

保持当前 Codex 任务等待命令结束。Claude Code 必须按 `CLAUDE.md` 依次使用架构、模块交付和
测试角色，写回 `Technical Plan`、`Implementation Report` 与状态。

- 状态为 `Blocked`：读取阻塞内容并向用户提出最少问题，不继续重试。
- 状态不是 `Implemented`：报告协议失败，不自行伪造完成状态。
- 命令失败：保留输出和工作区，运行只读诊断后报告；不要无限重启。

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
  状态解析。
- 用 `--dry-run --task <Ready 任务>` 查看将发送给 Claude 的调用，不启动 Claude。
