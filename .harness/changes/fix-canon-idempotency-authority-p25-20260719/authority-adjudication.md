# P25 authority adjudication

## 裁决

P19 没有删除或退役 ABS-02P、PRIV-01、CANON Phase-A、CANON readiness 或六能力父文档。它们只存在于从共同祖先分出的 `7daf36ba42b5266a338b128abf055e164657ac9a` 兄弟线，从未进入 P19 基线或中央历史。

因此，P21 的“最新远端已退役”“业主明确裁定只保留历史证据”没有事实支持。P21 的 packet review 对其精确 archive-only B/H 是有效历史审批，但不能继续充当当前 authority 解释。P25 用新的审批链 supersede 该解释。

## 可复算提交关系

```text
4b0deee  common ancestor
├─ 7daf36b  local governance bundle (never integrated into central)
│  └─ d41c28e  reviewed Idempotency spec source
└─ af652e9  central line before P19
   └─ 08d296a  P19 cleanup merge
      └─ 475763a  P21 predecessor
         └─ f6a73f3  P21 archive-only merge
            └─ 023f198  P25 predecessor
```

关键复算：

- `7daf36b^ = 4b0deee`。
- `merge-base(7daf36b, af652e9) = 4b0deee`。
- `git diff af652e9..08d296a` 对 ABS/PRIV/CANON/六能力文档路径命中数为 0。
- `git diff 7daf36b..08d296a` 的删除样式只是兄弟树比较，不能证明中央发生删除事件。

## P19 精确 allowlist

P19 只批准删除下列六目录共 47 文件：

1. `.harness/changes/feat-menxiasheng-routing-veto-20260717/`
2. `.harness/changes/refactor-department-router-canonical-consolidation-20260717/`
3. `.harness/changes/feat-guoli-thin-slice-20260717/`
4. `frontend/.harness/changes/feat-guoli-thin-slice-20260717/`
5. `.harness/changes/feat-hanlin-min-read-model-20260717/`
6. `.harness/changes/feat-chancellor-llm-routing-recommendation-20260717/`

P19 review 明确记录 runtime/tests/product docs/ledger 无变化。P25 不 revert P19，也不恢复上述目录。

## Authority / evidence / runtime 分层

| 对象 | P25 后性质 | 处理 |
| --- | --- | --- |
| P21 `atomic-spec.md` | current engineering authority | KEEP / SPEC_READY |
| P21 request spec/summary | authority 导航与审计说明 | UPDATE via P25 |
| P21 packet review/approval | P21 archive-only 决策的 immutable history | KEEP / ZERO DIFF |
| `d41/7daf` | 来源与审计 provenance | KEEP in Git, not central SSOT |
| `docs/plans/canon-readiness` | 当前中央不存在；技术规格不应在此重建 | NO CHANGE |
| Idempotency runtime | absent/not implemented/not authorized | NO CHANGE |

## 为什么不是恢复产品文档

中央 `docs/README.md` 明确：技术实施方案、API 审计、接口对接计划由对应工程 harness/changes 管理；`docs/plans` 只承载跨线蓝图与决策记录。CANON-IDEMPOTENCY-01 是技术工程 contract，把它留在 P21 root change 是当前规则下的最小单一事实源。

其余 `7daf` durable ADR/plan 是否进入中央，应由独立 authority-reconciliation Packet 逐项裁决，不能混入 P25。
