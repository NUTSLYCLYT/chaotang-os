# 决策 0041：下旨永远受理、执行结果如实回奏

## Status

Accepted — 2026-08-11

## Context

既有拟旨契约把材料完整性、路由确定性和来源预检作为【下旨】的前置门槛。用户现已明确产品原则：【下旨】应代表正式发出旨意，系统不得因为预判无法办成而阻止受理。与此同时，材料不足、供应商不可用或系统故障不能被伪装成成功办理。

因此需要把“是否接受旨意”和“旨意能否成功办结”从一个状态门槛拆成两个独立契约，并让每个已受理任务最终产生真实、可理解的回奏。

## Decision

- 对已认证用户提交的非空旨意，【下旨】始终可用。后端持久化成功后返回 `202`、旨意标识和任务标识。
- 拟旨阶段的澄清、材料缺失和风险提示不得禁用【下旨】；它们可以随任务进入执行上下文。
- `NEEDS_INPUT` 不再是拒绝下旨的前置结果，而是已受理旨意的一类正式终态回奏，必须说明缺少什么以及如何补充。
- 成功办理形成 `SUCCEEDED` 回奏；不可恢复的系统异常形成脱敏 `FAILED` 回奏。任何已受理任务都不得永久停留在 `QUEUED` 或 `RUNNING`。
- 每道旨意最多归档一条最终 `REPLY`。幂等、owner 隔离、冻结路由、证据不可变、部门职责与 ADR 0028 的主办理链保持不变。
- 仅空白旨意、认证失败、持久化失败或非法幂等冲突等无法建立合法任务的技术条件可以同步拒绝受理。

本 ADR 在“下旨可用性与材料不足处理”方面取代 ADR 0033 和既有故障记录中的前置拦截要求；ADR 0028 的丞相、六部/军机处、锦衣卫证据和史馆归档主流程不变。

## Consequences

- 用户的下旨意图不会再被系统预检替代，所有合法旨意都有可追踪任务。
- 材料不足和执行失败会在下旨后形成明确回奏，用户体验从“不能下旨”变成“已受理但需补充/办理失败”。
- 前端按钮、拟旨 authority、异步任务状态、执行器与史馆归档契约必须同步调整。
- 系统必须增加终态收敛、超时和幂等测试；“受理成功”不得被误解为“办理成功”。
- 旧的拟旨前财务来源预检测试必须改为执行期 `NEEDS_INPUT` 回奏测试，但不得删除来源真实性和假成功防护。

## Verification

- `cd backend && .\.venv\Scripts\python.exe -m pytest tests -q`
- `cd backend && .\.venv\Scripts\python.exe -m ruff check app tests`
- `cd frontend && npm test`
- `cd frontend && npm run lint && npm run typecheck && npm run build`
- `node scripts/check_harness.mjs`
- `node scripts/check_harness.mjs --self-test`
- `node .agents/hooks/check-harness.mjs --self-test`
- `node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test`
- `git diff --check`
