# 规格说明：docs-canon-idempotency-01-spec-20260719

## 当前解释

本 change 内 `atomic-spec.md` 是 CANON-IDEMPOTENCY-01 的 current engineering authority。它冻结未来 tenant/scope request replay contract，但不属于产品 SSOT，不授权 runtime 实现。

P21 最初把该规格定性为 archive-only，依据是“最新远端已退役 CANON 产品文档”和“业主已明确裁定不恢复”。P25 的提交历史审计证明：P19 只清理六个冻结旧 change 目录；CANON/ABS/PRIV 文档位于从未集成的 `7daf` 兄弟线，中央不存在删除或退役事件。P25 因此 supersede P21 的 authority interpretation，同时保留 P21 review/approval 作为当时裁决的历史证据。

## 当前实现与证据

| 分类 | 结论 | 证据 | Owner / 状态 |
| --- | --- | --- | --- |
| 已确认事实 | 无 shared replay ledger；至少 12 套局部 cache/dedup/claim/upsert/replay | `idempotency-census.md` + focused facts regression | Backend Request Idempotency / runtime blocker |
| 已确认事实 | `atomic-spec.md` 已冻结完整逻辑 contract，架构和隐私领域 review v3 GO | 本 change 内 spec/review | current engineering spec |
| 已确认事实 | P19 未删除 CANON/ABS/PRIV；`7daf` 从未合入中央 | P25 `authority-adjudication.md` | Project Owner / verified |
| 已确认事实 | 技术实施方案归 harness/changes，而非 `docs/plans` | `docs/README.md` | root ownership rule |
| 未知问题 | production KMS/key retention、tenant erasure/legal hold、各 scope material fields | 当前无获批 production policy | 阻塞 runtime/data |

## 事实源映射

| 事实 | 当前 authority | 历史证据 |
| --- | --- | --- |
| Idempotency 工程 contract | `atomic-spec.md` | `d41c28e`、领域 review v1..v3 |
| P21 当时的 archive-only 批准 | `packet_review/review-v1.md` + `approval-v1.json` | P21 B/H/R/M |
| archive-only 解释的纠偏 | P25 root change + P25 packet review | P19/7daf commit adjudication |
| runtime 状态 | 当前代码/schema/tests | 始终 `ABSENT / NOT_IMPLEMENTED / NOT_AUTHORIZED` |

## 范围

- 维护一份现行、自包含、可供未来实现 Packet 使用的工程原子规格。
- 明确 P21 与 P25 的审批边界，不篡改旧 review。
- 不恢复 `docs/plans`，不创建第二产品事实源。

## 非目标

- 不实现 ledger/service/schema/migration/KMS/provider token。
- 不改 runtime caller、test expectation 或数据库。
- 不 backfill、复制、删除或加密已有 raw keys/payload。
- 不把 current engineering spec 宣传成产品交付、business correctness 或 external exactly-once。

## 验收标准

1. `atomic-spec.md` 明确标为 current engineering spec，并保持 runtime 未授权。
2. P19/7daf 历史叙述与 Git 证据一致，不再声称中央退役或业主作出不存在的裁定。
3. P21 原 review/approval 保持不变；P25 以新 packet review 批准解释变化。
4. `docs/plans` 零新增，runtime/schema/test/data 零变化。
5. focused facts regression、root/backend doctor、diff/path scope 与 D6 全绿。

## 验证计划

- 重跑 P21 的 focused current-facts tests，证明 census 未漂移；不计作 runtime 实现。
- 运行 root/backend doctor、`git diff --check` 与 exact path review。
- 固定 P25 的 B/H，独立检查 P19 allowlist、P21 immutable review 与 authority mapping。
- 只在 review-only R + approval 和候选 no-ff merge M 通过 D6 后上传中央分支。
