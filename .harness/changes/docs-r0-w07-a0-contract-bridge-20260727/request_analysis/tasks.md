# 任务：docs-r0-w07-a0-contract-bridge-20260727

## 当前 Packet：治理、设计和计划

- [x] 从 local EXT exact `b8f7b27b...` 创建 isolated governance worktree。
- [x] 复核 W07 `GO / APPROVED_WORK_PACKAGE` 和 clean base。
- [x] 只读确认 Mission/Task、read model、artifact、archive 四组缺口。
- [x] 建立 W07-A0 `PROPOSED_NOT_AUTHORITY` scope amendment。
- [x] 将策略固定为 `RUNNABLE_MINIMUM -> PRE_W08_HARDENING`。
- [x] 完成 `docs/superpowers/specs/2026-07-27-r0-w07-a0-contract-bridge-design.md`。
- [x] 完成 `docs/superpowers/plans/2026-07-27-r0-w07-a0-contract-bridge.md`。
- [x] 自审 placeholder、接口一致性、W08/W09 越界和 file ownership。
- [x] 运行 authority、root/backend doctor、diff check。
- [x] 冻结 non-authorizing design candidate H/tree。
- [ ] 请求 Product Owner 对后续 implementation exact scope 批准。

## 后续 Implementation Packet：尚未授权

### Gate 0：重新绑定

- [ ] 从届时最新 EXT exact H 创建新的 isolated implementation worktree。
- [ ] 重新验证 W07 authority GO。
- [ ] 固定 owner、files、out-of-scope 和 one-writer locks。
- [ ] 记录 current focused baseline 和预期 RED。

### Checkpoint A：RUNNABLE_MINIMUM

- [ ] RED/GREEN：MissionContract 与 owned DecisionTask 的唯一兼容绑定。
- [ ] RED/GREEN：用现有 CourtLoopRun 持久保存完整 revision snapshot。
- [ ] RED/GREEN：server typed read model、allowed actions 和 blockers。
- [ ] RED/GREEN：pack/manifest/archive exact lineage 投影。
- [ ] RED/GREEN：generated TS adapter 与现有两页 hunk-level consumer。
- [ ] 跑通一条合成 real-backend browser flow。
- [ ] Codex 只读验收；声明只能是 `RUNNABLE_MINIMUM`。

### Checkpoint B：PRE_W08_HARDENING

- [ ] RED/GREEN：dedicated mission revisions 和 DB unique/CAS constraints。
- [ ] RED/GREEN：compat snapshot 到 canonical revisions 的确定性转换。
- [ ] RED/GREEN：authenticated PARTIAL refresh/reconnect recovery。
- [ ] RED/GREEN：consistent read transaction 与 mixed-lineage fail closed。
- [ ] RED/GREEN：并发、重启、重复提交、cross-tenant、corrupt lineage。
- [ ] isolated migration up/down、OpenAPI、typecheck/build、browser fault tests。
- [ ] 两轮独立只读审查和 exact-H W07 closeout acceptance。

### W08/W09 Handoff

- [ ] 只有 Checkpoint B 通过才生成 W08 activation candidate。
- [ ] W08 生产 36 goldens、10/10 real-backend traces、5-user >=4 success。
- [ ] 只有 W08 完成才生成 W09 activation candidate。
- [ ] W09 冻结 source/build/database/listener identity 并运行 verification loop。

## 停止条件

authority conflict、production ambiguity、scope expansion、file ownership conflict、
concurrent writer、真实客户数据、第二任务/完成状态或 browser completion inference
出现时立即 `BLOCKED`。
