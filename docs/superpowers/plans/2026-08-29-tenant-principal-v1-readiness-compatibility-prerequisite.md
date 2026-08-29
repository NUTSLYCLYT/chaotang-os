# Tenant Principal V1 Readiness Compatibility Prerequisite — Execution Plan

## Objective

在不修改六部历史证据、不扩大 exclusion、不放宽笛卡尔积接受的前提下，为 Tenant Principal V1
已审查产品字节追加第五个精确 runtime/successor compatibility pair，恢复根 Harness 的真实性。

## Stage 1 — Governance

1. 远端必须精确为 `63195b81871c0c32c6ace3f05138b8caeba80afe`。
2. approval commit 只新增本 Task、packet、Plan 三文件，全部 `100644`。
3. 校验 JSON 无重复键、路径闭合、base commit/tree、pair 与授权语义。
4. 创建单亲治理 commit，并普通 fast-forward 推送 `origin/ext-dev`。

## Stage 2 — RED

1. 从治理 commit 创建独立候选工作树。
2. 先在 Python readiness 测试加入第五 pair 期望、现有 pair `+1/-0` 和混搭拒绝。
3. 运行精准测试，确认旧 Node validator 因只接受四 pair 而失败。

## Stage 3 — GREEN

1. 在 `scripts/check_harness.mjs` 原子追加 frozen pair。
2. 更新 self-test 的精确 pair count、label 与 expected pair set。
3. 不改 exclusions、successor paths、历史 fingerprint、readiness JSON 或其他路径。
4. 运行精准 Python/Node 测试和根 Harness。

## Stage 4 — Verification

- exact two-path structure、模式与单亲关系；
- readiness Python 测试；
- backend full pytest；
- root Harness、self-test、doctor 与 hook self-test；
- product-authority regression；
- V2 convergence；
- `git diff --check`；
- 独立 code/security review 无 P0–P2。

## Stage 5 — Delivery

1. 创建唯一两文件单亲候选 commit。
2. 再次确认远端仍为治理 approval commit。
3. 普通 fast-forward 推送两文件候选到 `origin/ext-dev`。
4. 推送后重新抓取远端并核对 commit/tree。
5. 旧 Tenant approval 失效；在新远端基线重新签发 exact14 successor approval。

## Rollback and STOP

不使用 force push、不覆盖历史。若候选失败，不推送；治理 commit 可保留为未消费历史证据。若远端漂移，
当前 packet 立即失效并重新签发。最终 Tenant 产品 candidate push 不在本计划授权范围内。
