# CI 摘要：chore-absorption-baseline-20260714

| 命令 | 退出码 | 结果 | 覆盖 |
| --- | ---: | --- | --- |
| socketpair preflight | 0 | send=1 | runner capability |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors, 0 warnings | 根/委托 |
| backend `python3 scripts/harness_doctor.py` | 0 | 0 errors, 0 warnings | 后端 harness |
| frontend `node scripts/harness-doctor.mjs` | 0 | 0 errors, 0 warnings | 前端 harness |
| `pytest -q tests/test_production_db_tripwire.py` | 0 | 5 passed in 3.39s | 生产 DB tripwire |
| canonical 主链代表套件 | 0 | 43 passed, 1 deselected in 5.70s | 下旨/事件/奏折/裁决/归档 |
| `pytest --collect-only -q` | 0 | 2589 collected in 7.00s | 后端集合事实 |
| 无选择后端全量 pytest | 未运行 | `NOT_RUN_SAFETY_BLOCKED` | legacy 裸路径未全封 |
| `pnpm install --offline --frozen-lockfile --ignore-scripts` | 0 | reused 144 / downloaded 0 | 前端离线依赖 |
| `pnpm exec tsc --noEmit` | 0 | PASS | 前端类型 |
| `pnpm test:node` | 1 | 1009 tests；1002 pass / 7 fail | 完整前端 node suite |
| lint script 检查 | 0 | `lint=MISSING` | 只记录 |
| 控制面 DB 前后 `stat` + SHA | 0 | 完全一致 | 安全证明 |

## 前端 7 个基线失败

与旧 P0 逐项相同：v1 `active/pending`；退役 recruit BFF route ENOENT；`出纳司/国库司`；退役 dispatch route auth guard；两个退役 learning BFF route ENOENT；退役 orchestrate BFF route ENOENT。P0 只记录，不修。

## 声明

P0 验证设施可在当前 runner 有界完成；证据状态 `VERIFIED_PARTIAL`。`NOT_RUN_SAFETY_BLOCKED` 与 `NO_COUNTER_BASELINE` 继续禁止最终 campaign DONE。
