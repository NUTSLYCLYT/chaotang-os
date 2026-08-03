# 规格说明：chore-ext-99-branch-convergence-k0-20260803

## 背景

2026-08-03 的只读审计确认，本地有 99 个分支不是
`feature-chaotang-ext` 的祖先。这 99 个 ref 包含产品代码、设计、review、authority、
archive、重复 tip、后继候选和未提交 WIP，不能解释为 99 个独立功能，更不能批量 merge。
本变更把它们冻结成可验证的资产快照，并为每个 ref 记录能力族、canonical donor、处置、
计划 authority、目标 owner、证明命令和生命周期状态。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 审计源集合为 99 个本地分支 | `git for-each-ref` + `git merge-base --is-ancestor`，2026-08-03 | CLI `--check` / Root Harness | 否 |
| 已确认事实 | EXT 基线 HEAD/tree 为 `b78a4f8...` / `615ac604...` | `git rev-parse HEAD HEAD^{tree}` | Codex | 否 |
| 已确认事实 | 当前只授权 `R0-W08` | `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` | Machine authority | 否 |
| 已确认事实 | 99 refs 可归入 47 个能力族 | `.harness/manifest/ext-branch-convergence.v1.json` | schema、validator、Node test | 否 |
| 未知问题 | 每个 `SUPERSEDED_VERIFY` 是否都有当前 equal-or-stronger 行为证据 | 不适用 | 后续 family Packet | 是，阻塞对应 ref 关闭，不阻塞 K0 台账 |
| 未知问题 | 29 个 implementation-intent refs 的后续 authority 和最终集成结果 | 不适用 | 用户 + machine authority + 独立 review | 是，阻塞产品融合，不阻塞只读清算 |

## 数据流与调用链

```text
local Git refs (read-only)
  -> frozen 99-ref manifest
  -> schema + deterministic validator
  -> --check / --status / --family projection
  -> later family Packet authority
  -> RED / adaptation / verification / review / local EXT integration
```

CLI 没有写模式，不调用 merge/cherry-pick/update-ref/worktree remove，也不修改 manifest。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `ext-branch-convergence.v1` | `.harness/manifest/ext-branch-convergence.v1.json` | Root Harness、后续 family Packets | 99 refs、47 families、枚举与 exact tip 由 Node 测试验证 |
| convergence schema | `.harness/contracts/ext-branch-convergence.schema.json` | validator、reviewer | JSON Schema 2020-12；branch record 禁止额外字段 |
| read-only CLI | `scripts/ext-branch-convergence.mjs` | Codex、reviewer、Harness | `--check` / `--status` / `--family`; invalid usage exit 64 |
| project registration | `.harness/manifest/project-harness.json` | `scripts/harness-doctor.mjs` | status 固定为 `DRAFT_OBSERVE_ONLY` |

## 范围

- Freeze the exact 99 audited local refs and their captured tips.
- Register 47 asset families with one canonical donor each.
- Record `ABSORB_ADAPT`, `REBUILD`, `SUPERSEDED_VERIFY`, `ARCHIVE`, `REJECT`, `DUPLICATE`, or `BLOCKED_WIP` for every source ref.
- Provide deterministic, read-only validation and projections.
- Register the control plane in the root Harness and documentation.

## 非目标

- No product code or runtime behavior changes.
- No merge, cherry-pick, branch deletion, ref movement, push, deployment, listener, or persistent database action.
- No claim that a planned disposition is implemented, reviewed, integrated, or externally accepted.
- No automatic inclusion of the new control branch in the frozen 99-source denominator.

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| duplicate branch name or family | fail validation | Node negative tests |
| unknown disposition/status | fail validation | Node negative tests |
| implementation disposition without authority label | fail validation | Node negative tests |
| `CLOSED` without checkpoint proof | fail validation | Node negative tests |
| duplicate canonical donors | fail validation | Node negative tests |
| frozen source ref missing or moved | `--check` returns FAIL | injected ref resolver tests + live CLI |
| candidate commit missing or not reachable from recorded tip | `--check` returns FAIL | injected Git relation tests + live CLI |
| duplicate history is neither contained nor patch-equivalent | `--check` returns FAIL | negative relation test; rebased-equivalent positive test |
| unknown family | CLI returns `NOT_FOUND`, exit 2 | CLI test |
| attempted write flag | usage error, exit 64 | CLI test |

## 风险与回滚边界

- Risk: branch tips move after capture. Mitigation: `--check` resolves every frozen ref and compares the full 40-character tip.
- Risk: manifest becomes a hidden implementation authority. Mitigation: docs and records state that only v2 work-package GO authorizes implementation.
- Risk: test mirrors the manifest. Mitigation: expected 99 branch names are a hand-frozen literal and live Git tips are independently resolved.
- Risk: CLI mutates the manifest. Mitigation: tests compare SHA-256 before and after status/family/check calls.
- Rollback: revert this isolated Packet's files; no product state, refs, database, or runtime was changed.

## 计划确认记录

- 批准人：用户。
- 批准日期：2026-08-03。
- 批准范围：按照 `2026-08-03-ext-99-branch-capability-convergence.md` 开始实施；当前切片为 Task 1 只读台账控制面。
- 明确未批准：批量 merge、产品代码、Runtime、数据库、push、deploy、3050 和 persistent DB migration。

## 验收标准

- Exactly 99 unique frozen source refs and 47 non-empty asset families.
- Every source ref has one disposition and one family.
- Every family has exactly one canonical donor.
- Candidate commits are reachable and duplicates have ancestry or patch-equivalence proof.
- Validator fails closed for malformed authority, closure, duplicate, and tip data.
- `--check`, `--status`, and `--family` are deterministic and read-only.
- Root doctor reports zero errors and zero warnings.

## 验证计划

```bash
node --test scripts/ext-branch-convergence.nodetest.mjs
node scripts/ext-branch-convergence.mjs --check
node scripts/ext-branch-convergence.mjs --status
node scripts/ext-branch-convergence.mjs --family W08_FULL_CONTRACT_LOOP
node scripts/harness-doctor.mjs
node scripts/execution-authority.mjs --check
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08
git diff --check
```
