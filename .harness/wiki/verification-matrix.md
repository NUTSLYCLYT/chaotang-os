# 验证矩阵

| 范围 | 命令 | 用途 | 当前证据 |
| --- | --- | --- | --- |
| 根级 harness 架构 | `node scripts/harness-doctor.mjs` | 验证根 `.harness`、manifest、前端委托、后端 harness 清单和 docs 入口 | 2026-07-09 通过 |
| 前端工程 harness | `cd frontend && pnpm harness:doctor` | 验证前端 `.harness` 结构、模板、skills 和变更记录 | 由根 doctor 委托；2026-07-09 通过 |
| 后端 harness 架构 | `cd backend && python scripts/harness_doctor.py` | 验证后端 harness manifest、共享契约、主 harness、实现包和变更记录 | 由根 doctor 委托；2026-07-09 通过 |
| 后端运行/评测 harness 代表检查 | `cd backend && python -m pytest -q tests/test_commercial_loop_harness.py tests/test_legal_redteam_harness.py` | 验证 commercial-loop 与 legal red-team harness 行为 | 2026-07-09，28 个测试通过 |
| 多 Agent 控制面契约 | `node --test scripts/multi-agent-contracts.nodetest.mjs` | 校验 task、lease、release evidence 正反例与 manifest 登记 | S0 实现；不得据此声明发布门禁已强制 |
| 多 Agent 任务与路径租约 | `node --test scripts/multi-agent-lease.nodetest.mjs` | 验证共享 registry、canonical scope、TTL、fencing、CLI、迁移和多 worktree 竞争 | S1：23 passed；独立复审 GO |
| 多 Agent 资源锁 | `node --test scripts/resource-lock.nodetest.mjs` | 验证 Task 授权、真实 holder、端口/构建取证、fencing、break-glass、200 轮真实竞争及数据库隔离 | S2：10 passed；联合 S1/S2 33 passed；独立复审 GO |

高成本或真实模型驱动的后端 harness 命令需要显式确认 provider 凭证、超时和预算后再运行。
