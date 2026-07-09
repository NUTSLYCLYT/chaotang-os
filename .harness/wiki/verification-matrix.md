# 验证矩阵

| 范围 | 命令 | 用途 | 当前证据 |
| --- | --- | --- | --- |
| 根级 harness 架构 | `node scripts/harness-doctor.mjs` | 验证根 `.harness`、manifest、前端委托、后端 harness 清单和 docs 入口 | 2026-07-09 通过 |
| 前端工程 harness | `cd frontend && pnpm harness:doctor` | 验证前端 `.harness` 结构、模板、skills 和变更记录 | 由根 doctor 委托；2026-07-09 通过 |
| 后端 harness 架构 | `cd backend && python scripts/harness_doctor.py` | 验证后端 harness manifest、共享契约、主 harness、实现包和变更记录 | 由根 doctor 委托；2026-07-09 通过 |
| 后端运行/评测 harness 代表检查 | `cd backend && python -m pytest -q tests/test_commercial_loop_harness.py tests/test_legal_redteam_harness.py` | 验证 commercial-loop 与 legal red-team harness 行为 | 2026-07-09，28 个测试通过 |

高成本或真实模型驱动的后端 harness 命令需要显式确认 provider 凭证、超时和预算后再运行。
