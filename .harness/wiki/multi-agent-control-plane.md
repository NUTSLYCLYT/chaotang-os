# 多 Agent Harness 控制面

本控制面为同一 Git 仓库内的并发 Agent 提供任务、租约、资源锁、构建与发布证据的唯一协调层。详细建设顺序以 `docs/multi-agent-harness-control-plane-blueprint-2026-07-13.md` 为准。

## 状态语义

- `DESIGNED`：仅存在设计，不可作为门禁。
- `IMPLEMENTED`：代码和契约已落地并通过局部测试，但尚未取得 rollout 证据。
- `ROLLOUT`：在 shadow/soft/mandatory 阶段收集真实发布证据。
- `ENFORCED`：只有 mandatory 连续 20 次真实发布全部通过后才能声明。

## 事实源

- 契约：`.harness/contracts/`。
- 初始基线：`.harness/baselines/multi-agent-control-plane-20260713.json`；`null` 表示历史无可靠遥测，不等于零。
- 运行数据库：后续步骤固定在 `git rev-parse --git-common-dir` 所指目录下的 `chaotang-harness/control-plane.sqlite3`。
- 端口：`3002`/`3050` 为共享受保护端口；`3100–3199` 为 worktree 动态隔离池，均必须持有资源租约。
- 根级登记：`.harness/manifest/project-harness.json`。

## S0 验证

```bash
node --test scripts/multi-agent-contracts.nodetest.mjs
node scripts/harness-doctor.mjs
```

本页不授予生产发布权限。租约、资源锁、发布指挥权和外部信任锚在相应步骤完成前均保持未强制状态。

## S9 恢复边界

- 控制面数据库升级到 schema v8，加入单次 break-glass 使用记录，并对身份字段及全局 audit 启用不可更新/删除触发器。
- 数据库无法打开、完整性损坏、真实 `SQLITE_FULL` 或只读写失败时保持 fail closed，并在 owner-only 恢复目录保留原始或操作前快照；不会自动删除或重建权威库。
- Emergency Maintainer 必须提交最长 30 分钟、绑定完整 commit SHA、release ID、operator、reason、evidence 和精确 resource operation 的 Ed25519 票据；两个不同信任域的审批人都必须签名。执行固定使用 `/usr/bin/corepack pnpm gate:prod-release`，任何失败或 `SKIP` 都不执行紧急操作。
- 票据在操作前必须由控制面外的原子 replay authority `claim`，操作后先写外部 `complete` 再写本地 terminal；本地数据库回滚或终态落盘失败都不能让同一票据再次使用。
- 仓库内的 `.harness/trust/break-glass-trust.json` 是 `EXTERNAL_REQUIRED` 占位配置，因此当前生产 break-glass 有意 fail closed。只有管理员经过审查固定两把独立公钥及外部 replay adapter 后才可进入 S10 rollout。

## S10 rollout

- 权威策略是 Git `HEAD` 中的 `.harness/policy/control-plane-rollout.json`；工作区副本与 Git object 不一致时 fail closed。用户的其他 tracked dirty 只作为晋级风险记录，不阻止 Observe 启动，也不得由控制面自动 stash 或提交。
- `node scripts/rollout-control.mjs start-observe` 只启动真实 Observe。生产 CLI 不接受测试时钟、手工外部门禁布尔值、手工 20 次发布或手工 A1–A12 JSON。
- Task 指标只能从已注册 task 的 `task.step.completed/retried` 与 `task.metrics.finalized` append-only audit 收集，baseline 必须早于 activation 且零重复 baseline 不可宣称下降；release 从完整 terminal history、失败/恢复/事故 audit 与独立验证的 `release_evidence=verified` 收集；A1–A12 只能在 clean detached Git worktree 运行固定 verifier，形成 `verification.acceptance` 后再经外部 checkpoint 收集。
- git-common-dir 下独立 SQLite v1 rollout ledger 的 task/release/acceptance 指标均不可改写/删除；主控制库保持 schema v8。每个 rollout 事件形成 hash chain；晋级必须与仓库外单调 checkpoint 对齐，缺失或旧数据库回拨一律停止晋级。
- Observe 仅记录；Warn 需要带原因的人工 continue 并审计；Enforce paths 绑定外部 S3 required check；Enforce resources 绑定 S2/S5/S6/S8/S9 和外部信任；Mandatory 还要求 A1–A12 与 20 个唯一、连续、真实、无事故 production release。
- 自动回退会冻结当时 active lease/lock 与 wrapper pointer 快照，不删除活跃状态。Mandatory break-glass 仍只能使用 S9 的双签、最长 30 分钟、commit/release 单次票据，并且必须运行原 `pnpm gate:prod-release`。
- 当前事实是 `IMPLEMENTED_LOCAL_OBSERVE_PENDING`，尚未从 clean committed policy 启动 Observe。真实 2–3 天、后续各阶段真实时间、外部权威配置和 20 次真实发布不能由测试或文档替代。
- `rolloutHistoryGate`（`scripts/harness-doctor.mjs` 校验 `.harness/rollout-history.jsonl`）同样是 `IMPLEMENTED_LOCAL`：它能挡住"改状态不留痕"和"改完再悄悄改回去"，但检查代码本身和被检查的状态同住一个仓库，任何本地脚本都防不住"同一次改动里把检查代码也改弱"——这不是能靠更多代码修完的洞，需要外部（不受同一提交控制的）CI 强制状态检查或 CODEOWNERS 才能真正堵住。当前只做到：同一改动里检查代码和 rolloutStage/components 一起变化时，必须在 `rollout-history.jsonl` 显式写 `checkerChangedInThisTransition: true` 并说明原因，把"悄悄绕过"变成"写进永久记录的公开承认"，成本不是零但也不是不可绕过。
