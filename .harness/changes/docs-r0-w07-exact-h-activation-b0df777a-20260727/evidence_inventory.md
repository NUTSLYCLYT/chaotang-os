# Evidence Inventory

| Evidence | Current state | Generation gate |
| --- | --- | --- |
| EXT baseline H/tree | `RECORDED` | Current isolated worktree |
| Reviewer reassignment overlay | `REGISTERED_IN_LOCAL_EXT` | Candidate `35ac0e28...` |
| Packet design/spec/plan | `PREPARED` | This candidate |
| Integrated-mainline identity remediation | `IMPLEMENTED_AND_VERIFIED` | Event 1 TDD |
| Canonical W07 profile migration | `IMPLEMENTED_AND_VERIFIED` | Event 1 candidate |
| Remediated authority candidate H/tree | `FROZEN_EXTERNAL_RECEIPT` | Exact Git candidate |
| Reviewer overlay refresh | `REGISTERED_IN_LOCAL_EXT` | Event 2 exact-H evidence |
| Activation review package | `GENERATED_PRE_OWNER` | Event 1 exact Git range |
| Activation intent | `GENERATED_PRE_OWNER` | Exact package digest |
| Product Owner overlay-refresh approval | `RECORDED_FOR_EVENT_2` | Exact authority candidate |
| Product Owner activation approval | `PENDING_EXACT_APPROVAL` | Exact package and intent bytes |
| Independent final review | `NOT_REQUESTED` | After owner evidence |
| Atomic activation candidate | `NOT_GENERATED` | Separate activation approval |
| W07 GO | `NOT_OBSERVED` | After approved integration only |

## Registered Reviewer Overlay

```text
registration candidate = 142856e2c65cc96eccfeb54990d98d280c569a20
reviewed candidate = 6c01c810e60a20e955c5fb650e78317365c0d6df
reviewed tree = 3c9dfce871c362e2e9d7e93f12d24db3847f9d8d
review package sha256 = 9fd0d7f60cc09362da78e3165d4e85283a69a178fd4a5faf6c920bba592a16f9
pass-1 sha256 = 6ad0418e9495cd02c1719404d035ae2b11dd309527c76623ebdd0342d8443c29
pass-2 sha256 = e9fea702e0a618afb8ed77b6bafffd36127f5992f990c10b32248502e211c7b7
```

这些 identity 只证明 reviewer overlay 已登记，不构成 W07 activation approval。
由于后续 identity remediation 会修改 protected authority blobs，该 overlay 必须在
activation 前通过新的 exact-H 证据链静默刷新；不得把现有 digest 复用于新 runtime。

## Event 2 Overlay Refresh Receipt

```text
reviewed candidate = eb6e86e586ab5401780e5b49cdcf32af5ee27f86
reviewed tree = d08538039ad907c54bf1df41feaa3046097c91d9
review package sha256 = e067b0241f7aa1fc1494b989daf432937a142da1616ea91f4f05190227ed1571
owner approval sha256 = 8c59783ad3c56e35a9b897b7d331db922fe6529fc99a4295760abad3781b616f
pass-1 sha256 = 0361d649584fb88fb66dc3f1cc87c2549af6a040c00956f7180d5cd9269339b6
pass-2 sha256 = 3d5fbf6fe56d62cb791d0eae902e874f8187b79744c2c2771c3e33319938a5d4
```

该 receipt 只支持 quiescent overlay registration。旧 overlay 保留在 Git 历史中；
Event 2 registration candidate
`35ac0e2839be300a295ca63bd99577bbe47a088d` 已受控整合到本地 EXT。W07 ledger
仍不存在。

## Event 3 Pre-Owner Inputs

```text
local EXT = 35ac0e2839be300a295ca63bd99577bbe47a088d
review base = b0df777a1fe94d98afdc62b4cdd02a2f8a091391
authority candidate = eb6e86e586ab5401780e5b49cdcf32af5ee27f86
authority tree = d08538039ad907c54bf1df41feaa3046097c91d9
review package path =
  .harness/changes/docs-r0-w07-exact-h-activation-b0df777a-20260727/review_inputs/activation-candidate.diff
review package sha256 =
  ba87835b8bb74aab4782411f8037515e0ea7c09d8798e80419f2e4be06a7fd7a
activation intent path =
  .harness/changes/docs-r0-w07-exact-h-activation-b0df777a-20260727/activation_intent/r0-w07-activation-intent.json
activation intent sha256 =
  8450ae3ba33da562d75e10220508f38e04f06bf4f84db99249469e136039c328
```

这两份文件是 owner exact-H 审批输入，不是 approval evidence。canonical owner
approval、Codex final review、ACTIVE manifest 和 W07 GO 均未生成。
