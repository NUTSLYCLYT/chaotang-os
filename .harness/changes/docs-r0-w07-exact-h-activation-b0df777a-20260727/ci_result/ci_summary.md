# CI 摘要：R0-W07 Exact-H Activation Recovery

## 状态

`EVENT_3_INPUT_CANDIDATE / OWNER_APPROVAL_PENDING / NON_AUTHORIZING`

## Packet Preparation Baseline

```text
HEAD = b0df777a1fe94d98afdc62b4cdd02a2f8a091391
tree = a7beae653e5c9d2efd38fe1fda61a2cbe8b41565
R0-W07 = STOP / NO_ACTIVE_WORK_PACKAGE
```

## Event 1 验证目标

| 检查 | 预期 |
| --- | --- |
| changed paths | PASS：Packet、authority v2 wiki/runtime/test |
| execution authority v1 | `STOP / AMENDMENT_APPROVAL_REQUIRED` |
| execution authority v2 check | `VALID_STRUCTURE` |
| R0-W07 authorize | `STOP / NO_ACTIVE_WORK_PACKAGE` |
| authority + amendment tests | PASS：`113/113` |
| root harness doctor | PASS：`0 errors / 0 warnings` |
| backend harness doctor | PASS：`0 errors / 0 warnings` |
| diff check | PASS |

## Packet Preparation Baseline Verification

验证时间：`2026-07-27T01:19:17+0800`

```text
node --test scripts/execution-authority.nodetest.mjs scripts/r0-amendment-check.nodetest.mjs scripts/execution-authority-v2.nodetest.mjs
  exit 0 / 108 passed / 0 failed
node scripts/harness-doctor.mjs
  exit 0 / 0 errors / 0 warnings
(cd backend && python3 scripts/harness_doctor.py)
  exit 0 / 0 errors / 0 warnings
node scripts/execution-authority-v2.mjs --check
  exit 0 / VALID_STRUCTURE
node scripts/execution-authority.mjs --authorize
  exit 2 / STOP / AMENDMENT_APPROVAL_REQUIRED
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W07
  exit 2 / STOP / NO_ACTIVE_WORK_PACKAGE
git diff --check
  exit 0 / PASS
```

## Exact Candidate Receipt

候选不能在自身内容中预写自身 Git H。每轮审查由仓外只读 receipt 记录 exact H/tree、
base-to-H diff digest、命令退出码和时间，再将其作为不可变审查输入。首轮候选
`b2d92c6e12854e11b7deb00d5e656d4aaefb41c5`、tree
`3347d6b12765c86df93e5f30ea2be16a3be23258` 被独立 QA 判定
`NO_GO / HIGH 1 / MEDIUM 2`，不得集成；本次修订处理其全部 findings。

第二轮候选 `2f9d4a09aa235e656e51a8e19e2a550a89a46818`、tree
`0c27ca3d759836a65fdd0596e0a19e79c5268956` 被独立 QA 判定
`NO_GO / HIGH 1 / MEDIUM 1`，不得集成。其 hardened base-to-H diff SHA-256 为
`ec12726a572f0703ce8b862e60051520f49c6736662c390047d2ac49dac37e28`。
本次修订增加 integrated-mainline identity remediation、overlay refresh 和可复现的
hardened diff 命令。

第三轮候选 `d32cd4593f46ade3c45ac81b16d982f1a14b280d`、tree
`76e16ab2d2f55613344ef534aa75cc1460df841c` 被独立 QA 判定
`NO_GO / HIGH 1 / MEDIUM 0 / LOW 1`，不得集成。其 hardened base-to-H diff
SHA-256 为
`54685042045fc2854c9bf1061c26ca9bc383be1ab037e83e950d5555cf697eb7`。
本次修订拆分 pre-integration STOP/simulation 与 post-integration canonical GO，
并统一四事件术语。

第四轮候选 `14668a1e8046fc81d8fb25985556405844538c7b`、tree
`bdf3e374ab79b0f74840102c3953d761c3b62bb1` 获得独立 QA
`GO / HIGH 0 / MEDIUM 0 / LOW 1`。其 hardened base-to-H diff SHA-256 为
`3988ba4ee7501376d73b6c87500c441b299289ca9bd8773e07a3a274e2687dc4`。
唯一 LOW 是 Event 4 名称不统一；本次修订统一为 `Atomic Activation Event`。

## Event 1 Fresh Verification

验证时间：`2026-07-27T04:17:12+08:00`

```text
node --test scripts/execution-authority.nodetest.mjs scripts/r0-amendment-check.nodetest.mjs scripts/execution-authority-v2.nodetest.mjs
  exit 0 / 113 passed / 0 failed
node scripts/execution-authority.mjs --check
  exit 0 / VALID_INACTIVE_GUARD
node scripts/execution-authority.mjs --authorize
  exit 2 / STOP / AMENDMENT_APPROVAL_REQUIRED
node scripts/execution-authority-v2.mjs --check
  exit 0 / VALID_STRUCTURE
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W06
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W07
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W09
  each exit 2 / STOP / NO_ACTIVE_WORK_PACKAGE
node scripts/harness-doctor.mjs
  exit 0 / 0 errors / 0 warnings
(cd backend && python3 scripts/harness_doctor.py)
  exit 0 / 0 errors / 0 warnings
git diff --check
  exit 0 / PASS
```

Changed paths are limited to the W07 Packet status records, authority v2 wiki,
authority v2 runtime, amendment-governance shared diff guard, and the Node test.
The v2 manifest, schema, product code, deployment state, database, and listener
state are unchanged.

## 尚未生成

- owner exact-H approval；
- Codex Independent QA final verdict；
- Event 3 quiescent registration parent H/tree；
- Event 4 atomic activation candidate H/tree；
- ACTIVE manifest；
- W07 GO 证据。

上述项目必须留空而不是填写临时值。本 Packet 不允许被解释为 activation evidence。

## Event 2 Reviewer Overlay Refresh

```text
reviewed candidate = eb6e86e586ab5401780e5b49cdcf32af5ee27f86
reviewed tree = d08538039ad907c54bf1df41feaa3046097c91d9
review package sha256 =
  e067b0241f7aa1fc1494b989daf432937a142da1616ea91f4f05190227ed1571
owner approval sha256 =
  8c59783ad3c56e35a9b897b7d331db922fe6529fc99a4295760abad3781b616f
pass 1 = GO / HIGH 0 / MEDIUM 0
pass 2 = GO / HIGH 0 / MEDIUM 0
```

正式验证必须在 Event 2 commit 冻结后重新运行。本段不预先声明 exact candidate
通过，也不改变 W07 的 `STOP / NO_ACTIVE_WORK_PACKAGE`。

## Event 3 Pre-Owner Input Verification

```text
isolated baseline = 35ac0e2839be300a295ca63bd99577bbe47a088d
isolated baseline tree = 4142f785185cdbecc3a34d4d51b8df64ce0ae68c
local EXT = 35ac0e2839be300a295ca63bd99577bbe47a088d
review base = b0df777a1fe94d98afdc62b4cdd02a2f8a091391
authority candidate = eb6e86e586ab5401780e5b49cdcf32af5ee27f86
authority tree = d08538039ad907c54bf1df41feaa3046097c91d9
review package bytes = 81750
review package changed paths = 12 exact
review package sha256 =
  ba87835b8bb74aab4782411f8037515e0ea7c09d8798e80419f2e4be06a7fd7a
activation intent bytes = 1645
activation intent sha256 =
  8450ae3ba33da562d75e10220508f38e04f06bf4f84db99249469e136039c328
target manifest + intent structural validation = VALID_EVENT3_INPUTS
```

这些结果只证明 owner 审批输入可复现且结构一致。它们不构成 owner approval、
independent review、manifest activation 或 authority GO。

### Embedded Exact-Diff Check Boundary

review package 是 `b0df777a...eb6e86e5` 的逐字节 unified diff。原始 diff 的空白
context line 由单个空格 context marker 表示，因此：

```text
git diff --check b0df777a...eb6e86e5
  exit 0 / PASS
git diff --check
  exit 0 / PASS on the clean Event 3 worktree
git diff --check <Event 3 parent>..<Event 3 candidate>
  expected non-zero only inside review_inputs/activation-candidate.diff
```

最后一条命令会把内嵌 patch 当成普通新增文本，并将 context marker 报告为 trailing
whitespace。规范化或排除这些字节都会破坏 exact-package contract。适用的 source
检查是 Event 1 Git range PASS，以及 canonical package 与 hardened 生成结果逐字节相等。

## 运行时边界

`NOT_DEPLOYED / NO_PUSH / NO_DB_MIGRATION / NO_LISTENER_3050_TAKEOVER`
