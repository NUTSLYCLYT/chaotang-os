# 验证矩阵

| 范围 | 命令 | 用途 | 当前证据 |
| --- | --- | --- | --- |
| 根级 harness 架构 | `node scripts/harness-doctor.mjs` | 验证根 `.harness`、manifest、前端委托、后端 harness 清单和 docs 入口 | 2026-07-09 通过 |
| 前端工程 harness | `cd frontend && pnpm harness:doctor` | 验证前端 `.harness` 结构、模板、skills 和变更记录 | 由根 doctor 委托；2026-07-09 通过 |
| 后端 harness 架构 | `cd backend && python scripts/harness_doctor.py` | 验证后端 harness manifest、共享契约、主 harness、实现包和变更记录 | 由根 doctor 委托；2026-07-09 通过 |
| 后端运行/评测 harness 代表检查 | `cd backend && python -m pytest -q tests/test_commercial_loop_harness.py tests/test_legal_redteam_harness.py` | 验证 commercial-loop 与 legal red-team harness 行为 | 2026-07-09，28 个测试通过 |
| 正式下旨、事件账本与正式奏折主链 | `cd backend && python3 -m pytest -q tests/test_final_memorial_gate.py tests/test_decree_event_ledger.py tests/test_outbox_worker.py tests/test_decree_execution_status.py tests/test_shangshufang_loop_api.py tests/test_chaotang_memorials.py -k 'not chancellor_chat_streams_single_agent_reply'` | 验证路由/派单/回奏/质量来源门/唯一正式奏折/人工裁决/史馆归档 | 2026-07-14，43 passed；实时聊天字面量用例独立列为不稳定外部模型测试 |
| 多 Agent 控制面契约 | `node --test scripts/multi-agent-contracts.nodetest.mjs` | 校验 task、lease、release evidence 正反例与 manifest 登记 | S0 实现；不得据此声明发布门禁已强制 |
| 多 Agent 任务与路径租约 | `node --test scripts/multi-agent-lease.nodetest.mjs` | 验证共享 registry、canonical scope、TTL、fencing、CLI、迁移和多 worktree 竞争 | S1：23 passed；独立复审 GO |
| 多 Agent 资源锁 | `node --test scripts/resource-lock.nodetest.mjs` | 验证 Task 授权、真实 holder、端口/构建取证、fencing、break-glass、200 轮真实竞争及数据库隔离 | S2：10 passed；联合 S1/S2 33 passed；独立复审 GO |
| 发布证据与运行身份 | `node --test scripts/release-evidence.nodetest.mjs frontend/scripts/prod-runtime-identity.nodetest.ts` | 从 Git object DB、实际 build 目录和 3050 socket owner 独立重算身份，并验证 SQLite hash chain 与 Ed25519 checkpoint | S8 本地实现；外部 CI protected trust root 未启用前不得 READY/ENFORCED |
| 故障恢复与 break-glass | `node --test scripts/recovery-drill.nodetest.mjs` | 验证 lease kill/TTL、PID 与机器身份、build 中断、存储故障快照、双人签名票据、原 production gate 和单次审计 | S9 `IMPLEMENTED_LOCAL`；双人外部公钥未配置前 break-glass fail closed，不得 READY/ENFORCED |
| 分阶段控制面推广 | `node --test scripts/rollout-controller.nodetest.mjs scripts/rollout-watch.nodetest.mjs scripts/rollout-authority-integration.nodetest.mjs && node scripts/rollout-control.mjs status` | 验证真实时钟阶段机、20+20 同类任务基线、误报/延迟自动回退、稳定/候选 wrapper dispatcher、pending replay、真实 authority socket/单次操作授权与进程清理、A1–A12 与连续 20 次真实发布 | S10 `IMPLEMENTED_LOCAL_OBSERVE_PENDING`；提交后才可真实启动 Observe。外部 required check、独立 release/rollout anchor 和真实时间窗口未满足，不得 Mandatory/ENFORCED |

高成本或真实模型驱动的后端 harness 命令需要显式确认 provider 凭证、超时和预算后再运行。
