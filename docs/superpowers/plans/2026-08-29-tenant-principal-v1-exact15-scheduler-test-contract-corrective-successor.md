# Tenant Principal V1 Exact15 Scheduler Test Contract Corrective Successor Plan

任务：`TENANT-PRINCIPAL-V1-EXACT15-SCHEDULER-TEST-CONTRACT-CORRECTIVE-SUCCESSOR-20260829`

基线：`0631ac0d5e14a71121d6077c3d73e105c15e2bb9` / tree `a5d1cb57d803dcab19901df07273f2937bb1dda5`

Approval RFC 8785 canonical digest：`sha256:522df0c020970dd31575b1c7c8abc1e9914951c823bc348235b2a96f54e6dfdd`

状态：`PLAN_ONLY / NON_AUTHORIZING / APPROVAL_SCOPE_CONTRADICTION_CORRECTIVE`

## Goal

保留 exact15 已形成的全部产品价值与两个 P1 安全修复，机械冻结十四条 donor blob，只 forward-only 修正 scheduler storage 测试 fixture 的 principal 合同。测试必须使用合法 PERSONAL/OWNER membership；生产代码不得重新接受 membershipless 或 revoked user。

## Dependency DAG

`98428a17 runtime-lock exact2` → `9f2ab340 first latest-base exact15 approval (review NO-GO)` → `0631ac0d independent-review corrective approval (authority GO, scope contradiction, no child)` → `new fixed14+corrective1 approval` → `new exact15 candidate`。

旧 exact14、两代 exact15 approvals、nonce、未提交候选、测试与 review 均不可跨边继承。前序 one-child 以 `ABANDONED_UNCONSUMED / REISSUE_REQUIRED / NO_REANCHOR` 终止。

## Exact Paths

- Final product scope：Task 固定十五路径，结构 `15 M / 100644`。
- Fixed14：除 `backend/tests/test_daily_memorial_storage.py` 外的十四条路径，blob 必须精确等于 Task donor manifest。
- Corrective exact1：仅 `backend/tests/test_daily_memorial_storage.py`，必须从冻结 blob `4cf9c04e…` 形成新 blob。
- Frozen donor bundle：`sha256:89d38102cc9c326b95882c110ab2b4e812e7057a60c707de975dca0b369d7bd7`。
- Frozen combined full-index diff：`sha256:c9f2e0a251f334b66e15ca00ac366f592212c2a46db7cf133f49472eec34e4eb`。

## RED Phase

1. 新 approval 基线上按 Task donor manifest 重物化 exact15，并复核所有 raw/blob/mode/bytes、bundle 与 full-index diff。
2. 运行 focused 集合，必须精确复现 `test_scheduled_user_enumeration_is_sorted_and_internal` 单一失败，其余 268 项通过。
3. 验证失败来自 fixture 缺少 PERSONAL tenant/active OWNER membership，不是生产查询、schema 或环境错误。
4. 保留 revoked-principal 与 legacy ambiguity 负例；不得伪造、删除或放宽。

## GREEN Phase

1. 仅在 `test_daily_memorial_storage.py` fixture 中，为计划任务测试用户创建稳定 PERSONAL tenant 与 active OWNER membership。
2. fixed14 byte-for-byte 不动，包括 production scheduler closed JOIN 与 migration preflight。
3. 不修改 schema-v6、scheduler orchestration 或任何第十六路径。

## Verification

- 单一 scope-contradiction RED→GREEN。
- scheduler revoked/active 对照与 migration ambiguity/same-user 对照。
- exact15 focused、exact15 Ruff、进程级 POSIX temp backend-full。
- committed/clean candidate 的 runtime-lock 三路 full shard与全 app/tests Ruff。
- exact15 path/status/mode/fixed14/corrective1 结构门。
- root Harness、自测、Doctor、hook、Authority regression、V2、diff-check。
- Code、Python/Database、Security 三路独立只读审查。

## Non-Goals

不改 fixed14，不新增第十六路径，不改 scheduler.py、公开 API、前端、SSO、角色扩展、schema、runtime-lock、Harness、authority、CI、ADR、能力市场、奖励、Pilot、发布或部署。

## Stop Conditions

远端漂移、machine STOP、donor identity 不符、RED 拓扑不符、范围扩大、生产安全门放宽、fixed14 漂移、fixture 未变化、完整矩阵失败或独立审查 P0–P2，立即 STOP。只允许普通 fast-forward，不部署。
