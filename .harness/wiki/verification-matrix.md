# 验证矩阵

| 范围 | 命令 | 用途 | 当前证据 |
| --- | --- | --- | --- |
| 根级 harness 架构 | `node scripts/harness-doctor.mjs` | 验证根 `.harness`、manifest、前端委托、后端 harness 清单和 docs 入口 | 2026-07-09 通过 |
| M0–M10 执行权威 | `node --test scripts/execution-authority.nodetest.mjs && node scripts/execution-authority.mjs --check` | 验证所有计划均被清点并绑定摘要，v1 永远保持 `INACTIVE`；`--authorize` 必须返回 `STOP` | 2026-07-21，G0 已合入；v1 仍为 STOP，W01 exact 批准前不得称 ENFORCED |
| R0 修正案提案完整性 | `node --test scripts/r0-amendment-check.nodetest.mjs && node scripts/r0-amendment-check.mjs` | 比较 canonical amendment 精确字节 SHA-256 与 manifest `candidateSourceDigest`，验证 exact integration base、具名 Owner、22/22 REQ、9/9 退出门、11/11 旧 M 处置与 fail-closed 控制；checker 永不授权 runtime | 2026-07-21，`REPINNED_PENDING_EXACT_REVIEW_AND_APPROVAL`；真实客户数据、W08、W09 前还必须重新指定专业负责人 |
| 能力入口清算与遥测契约 | `node --test scripts/capability-entry-governance.nodetest.mjs` | 验证功能清算表、统一调用事件、14 天零调用与 replacement 证据删除门 | 2026-07-14，OBSERVE；尚无统一 runtime sink，不得删除入口 |
| K0B 知识质量 rubric | `node --test scripts/knowledge-quality-rubric.nodetest.mjs` | 验证合同/检索/outcome/成本/时效阈值、逐run门和 fail-closed 状态 | 2026-07-14，FROZEN_LOCAL / NO_DATA；门已冻结，真实黄金案例与 outcome 未到 |
| EXT 99 分支能力融合台账 | `node --test scripts/ext-branch-convergence.nodetest.mjs && node scripts/ext-branch-convergence.mjs --check` | 验证 99 个冻结 ref、唯一能力归属、唯一 canonical donor、处置/authority/checkpoint 契约和 ref tip 未漂移；CLI 全部只读 | 2026-08-03，DRAFT_OBSERVE_ONLY；不授权 merge、cherry-pick、代码实施或删除分支 |
| Packet 独立复核本地反馈门 | `node --test scripts/packet-review-local-feedback.nodetest.mjs && node scripts/packet-review-pre-push.mjs --status` | 验证 B→H→R→M、唯一 change/approval、报告 digest、终态 GO、安装/卸载与 bypass 诚实声明 | 2026-07-16，`LOCAL_FEEDBACK_ONLY`；无外部签名/required check，不得称 ENFORCED |
| 前端工程 harness | `cd frontend && pnpm harness:doctor` | 验证前端 `.harness` 结构、模板、skills 和变更记录 | 由根 doctor 委托；2026-07-09 通过 |
| 后端 harness 架构 | `cd backend && python scripts/harness_doctor.py` | 验证后端 harness manifest、共享契约、主 harness、实现包和变更记录 | 由根 doctor 委托；2026-07-09 通过 |
| 后端运行/评测 harness 代表检查 | `cd backend && python -m pytest -q tests/test_commercial_loop_harness.py tests/test_legal_redteam_harness.py` | 验证 commercial-loop 与 legal red-team harness 行为 | 2026-07-09，28 个测试通过 |
| 研究技能与户部投资蜂群安全评测 | `cd backend && node harness/deep-research-skill-distillation/evaluators/run-deep-research-harness.mjs && node harness/hubu-investment-swarm-gate/evaluators/run-hubu-investment-gate.mjs` | 验证研究证据链、技能蒸馏、30/60/90 outcome 计划，以及非建议边界和不安全买入指令阻断 | 2026-07-14，两个 evaluator 通过；报告写入忽略的 `artifacts/` |
| 正式下旨、事件账本与正式奏折主链 | `cd backend && python3 -m pytest -q tests/test_final_memorial_gate.py tests/test_decree_event_ledger.py tests/test_outbox_worker.py tests/test_decree_execution_status.py tests/test_shangshufang_loop_api.py tests/test_chaotang_memorials.py -k 'not chancellor_chat_streams_single_agent_reply'` | 验证路由/派单/回奏/质量来源门/唯一正式奏折/人工裁决/史馆归档 | 2026-07-14，43 passed；实时聊天字面量用例独立列为不稳定外部模型测试 |
| 多 Agent 控制面契约 | `node --test scripts/multi-agent-contracts.nodetest.mjs` | 校验 task、lease、release evidence 正反例与 manifest 登记 | S0 实现；不得据此声明发布门禁已强制 |
| 多 Agent 任务与路径租约 | `node --test scripts/multi-agent-lease.nodetest.mjs` | 验证共享 registry、canonical scope、TTL、fencing、CLI、迁移和多 worktree 竞争 | S1：23 passed；独立复审 GO |
| 多 Agent 资源锁 | `node --test scripts/resource-lock.nodetest.mjs` | 验证 Task 授权、真实 holder、端口/构建取证、fencing、break-glass、200 轮真实竞争及数据库隔离 | S2：10 passed；联合 S1/S2 33 passed；独立复审 GO |
| 发布证据与运行身份 | `node --test scripts/release-evidence.nodetest.mjs frontend/scripts/prod-runtime-identity.nodetest.ts` | 从 Git object DB、实际 build 目录和 3050 socket owner 独立重算身份，并验证 SQLite hash chain 与 Ed25519 checkpoint | S8 本地实现；外部 CI protected trust root 未启用前不得 READY/ENFORCED |
| 故障恢复与 break-glass | `node --test scripts/recovery-drill.nodetest.mjs` | 验证 lease kill/TTL、PID 与机器身份、build 中断、存储故障快照、双人签名票据、原 production gate 和单次审计 | S9 `IMPLEMENTED_LOCAL`；双人外部公钥未配置前 break-glass fail closed，不得 READY/ENFORCED |
| 分阶段控制面推广 | `node --test scripts/rollout-controller.nodetest.mjs scripts/rollout-watch.nodetest.mjs scripts/rollout-authority-integration.nodetest.mjs && node scripts/rollout-control.mjs status` | 验证真实时钟阶段机、20+20 同类任务基线、误报/延迟自动回退、稳定/候选 wrapper dispatcher、pending replay、真实 authority socket/单次操作授权与进程清理、A1–A12 与连续 20 次真实发布 | S10 `IMPLEMENTED_LOCAL_OBSERVE_PENDING`；提交后才可真实启动 Observe。外部 required check、独立 release/rollout anchor 和真实时间窗口未满足，不得 Mandatory/ENFORCED |

高成本或真实模型驱动的后端 harness 命令需要显式确认 provider 凭证、超时和预算后再运行。
