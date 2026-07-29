# 规格说明：docs-ext-a9-w08-family-coverage-closeout-20260730

## 背景

EXT-A9 的目标是让历史资产全部获得明确处置。第一批决策矩阵将
`R0-W08 branch family` 标记为 `SUPERSEDED_VERIFY`，因为多数 W08
分支看起来已经进入当前 EXT。这个 Packet 对 W08 refs、change records
和 closeout gate 做只读核对，判断是否还存在需要吸收的 W08 分支库存。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 当前 `R0-W08` authority 为 `GO`，`R0-W09` 为 `STOP / BLOCKED_DEPENDENCY` | authority commands / 2026-07-30 | Codex | 否 |
| 已确认事实 | 31 个本地 `r0-w08` refs 全部是 `feature-chaotang-ext` 祖先 | `git merge-base --is-ancestor <ref> feature-chaotang-ext` / 2026-07-30 | Codex | 否 |
| 已确认事实 | W08 focused harness tests pass | `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py` -> 19 passed | Codex | 否 |
| 已确认事实 | W08 closeout preflight fail-closes only on missing approved real user record | `run_w08_acceptance.py --closeout-preflight; test $? -eq 1` | Codex | 是，阻塞 W08 closeout |
| 推测 | W08 branch family no longer contains unique unmerged implementation inventory | Ancestor checks plus current change summaries | Must remain open to hunk-level correction if future audit finds a missing file | 否 |
| 未知问题 | Whether real non-developer user acceptance has been performed outside the repo | 不适用 | Product Acceptance Owner | 是，外部证据未进入 governed records |

## 数据流与调用链

W08 branch refs
-> ancestor coverage check
-> change summary status scan
-> W08 acceptance harness focused test
-> closeout preflight
-> disposition decision for W08 branch family.

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| W08 branch coverage | Git refs / commit graph | EXT-A9 asset ledger | `merge-base --is-ancestor` |
| W08 automated product acceptance | `run_w08_acceptance.py` and product acceptance fixtures | W08 closeout preflight | CLI JSON and focused pytest |
| W08 user acceptance | Governed records directory | W08 closeout preflight | exactly one approved real record required |

## 范围

- Create W08 branch-family coverage closeout documentation.
- Mark W08 branch family as `SUPERSEDED_BY_EXT_HEAD` for asset-reconciliation purposes.
- Preserve the real W08 closeout blocker.
- Do not modify product runtime or test behavior.

## 非目标

- No W08 closeout.
- No W09 activation.
- No historical branch merge or cherry-pick.
- No fake, fixture, or model-generated user acceptance record.
- No push, deployment, database migration, or 3050 operation.

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| W08 ref is ancestor | classify as covered by EXT | ancestor command |
| W08 ref is not ancestor | leave as open asset and inspect hunk-level | not observed in this Packet |
| closeout preflight lacks real records | remain `BLOCKED` | CLI expected failure |
| focused W08 tests fail | do not claim coverage closeout | not observed; 19 passed |

## 风险与回滚边界

Risk is misreading branch coverage as product closeout. This Packet explicitly
separates branch-family coverage from W08 closeout. Rollback is limited to this
docs-only change record.

## 计划确认记录

- 批准人：Project Owner direction via EXT-A9 continuation
- 批准日期：2026-07-30
- 批准范围：docs-only W08 branch-family coverage closeout
- 明确未批准：product code, W08 closeout, W09 activation, push, deployment, DB migration, 3050 operation

## 验收标准

- W08 refs are inventoried.
- Each W08 ref is checked for ancestry against `feature-chaotang-ext`.
- W08 remaining blocker is stated precisely.
- Packet status does not claim W08 closeout or production deployment.

## 验证计划

- `git for-each-ref --format='%(refname:short)' refs/heads refs/remotes | rg 'r0-w08'`
- `git merge-base --is-ancestor <ref> feature-chaotang-ext`
- `python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py`
- `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --closeout-preflight; test $? -eq 1`
- `node scripts/harness-doctor.mjs`
- `git diff --check`
