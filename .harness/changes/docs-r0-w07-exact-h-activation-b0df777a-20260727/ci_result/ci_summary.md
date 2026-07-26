# CI 摘要：R0-W07 Exact-H Activation Recovery

## 状态

`PRE_INTEGRATION_REVIEW_READY / NON_AUTHORIZING`

## 基线

```text
HEAD = b0df777a1fe94d98afdc62b4cdd02a2f8a091391
tree = a7beae653e5c9d2efd38fe1fda61a2cbe8b41565
R0-W07 = STOP / NO_ACTIVE_WORK_PACKAGE
```

## 本轮验证目标

| 检查 | 预期 |
| --- | --- |
| changed paths | PASS：仅本 Packet 和对应 spec/plan |
| execution authority v1 | `STOP / AMENDMENT_APPROVAL_REQUIRED` |
| execution authority v2 check | `VALID_STRUCTURE` |
| R0-W07 authorize | `STOP / NO_ACTIVE_WORK_PACKAGE` |
| authority + amendment tests | PASS：`108/108` |
| root harness doctor | PASS：`0 errors / 0 warnings` |
| backend harness doctor | PASS：`0 errors / 0 warnings` |
| diff check | PASS |

## 实测命令

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

## 尚未生成

- activation candidate H/tree；
- activation intent 和 review package digest；
- owner exact-H approval；
- Codex Independent QA final verdict；
- ACTIVE manifest；
- W07 GO 证据。

上述项目必须留空而不是填写临时值。本 Packet 不允许被解释为 activation evidence。

## 运行时边界

`NOT_DEPLOYED / NO_PUSH / NO_DB_MIGRATION / NO_LISTENER_3050_TAKEOVER`
