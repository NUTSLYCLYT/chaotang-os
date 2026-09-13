# 铭硕第一交付 · 方案与报价成果物 V1 exact20 Lineage Corrective Product Successor

任务 ID：`MINGSHUO-FIRST-DELIVERY-WORK-PRODUCT-V1-EXACT20-LINEAGE-CORRECTIVE-SUCCESSOR-20260913`

冻结基线：`origin/ext-dev@52e289c74000866b8aca8d147386ce499b8a38a9`；tree：`43f0114f989b49b3abb0cfc92d6143bf5529bffa`。

## Status

Draft

`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Product Definition

本 successor 是被放弃 exact19 的 forward-only lineage correction。它复用现有 Mingshuo Fact Pack evaluator、ArtifactStorage、WorkProductEnvelope、runtime-data registry、确认回执和离线发布事实源，把重新验真的 Fact Pack 与 draft request 转换为确定性的五页《方案与报价草案》XLSX 和 PENDING WorkProduct。报价不含金额或商业承诺；下载、发布、史馆归档和 V4 展示仍属于后继包。

旧任务 `MINGSHUO-FIRST-DELIVERY-WORK-PRODUCT-V1-SUCCESSOR-20260913` 的 one-child authority 已由 Owner 明确处置为 `ABANDONED_BY_OWNER_UNCONSUMED / NO_REANCHOR`。其十九路径未提交工作区只可作为 `BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE`，不得消费、恢复或继承旧 authority、candidate、测试或审查身份。

exact19 在受影响测试中暴露 `APPROVAL_SCOPE_CONTRADICTION / TRUSTED_RUNNER_IDENTITY_DEPENDENCY_OMITTED`：`scripts/run_rc1_release_acceptance.mjs` 的候选字节摘要将变为 `sha256:938beaa21a86f69e9449276fb2bd9d4eddf91de76e4b954d8a78c024800e0c2a`，而唯一备份验证器 `backend/app/operations/sqlite_backup.py` 仍冻结旧可信摘要 `sha256:98cdd5e95b0dce4621d578a6a5f1f95885ef4afbdda90122465b1ce642b05d1d`。本包只增加该第二十路径，同步既有可信 RC1 runner identity；不得建立第二信任表、第二 evaluator 或新业务范围。

## Acceptance Criteria

- [ ] Candidate 精确为 manifest 的二十路径，结构 `2 ADD + 18 MODIFY`，全部 `100644`；没有第二十一条路径。
- [ ] old exact19 donor 只作字节来源；在本 approval 的直接子候选中按路径重物化，并重新执行全部验证和独立审查。
- [ ] `backend/app/operations/sqlite_backup.py` 只把既有 `_TRUSTED_RUNNER_SHA256` 更新为候选 runner 的真实 raw SHA-256，不改变备份、恢复、containment、fail-closed 或 provenance 语义。
- [ ] 修正 stale `user_version=1` 期望，使测试精确验证 forward migration 后的唯一 v2 合同；不得放宽 runtime registry 的表、触发器、版本或 digest 闭合检查。
- [ ] 修正备份测试 fixture，使其通过合法 project/draft/intention lineage 建立可恢复 intent；不得关闭 foreign key、绕过 schema 或删除完整性断言。
- [ ] 保留 exact19 的全部产品语义：经当前日和存储日双重 PASS 的 Fact Pack 才能生成五个固定 worksheet 的 non-binding XLSX；HOLD/BLOCK、过期、时钟回退、旧版本、摘要漂移和跨租户/owner 全部 fail-closed。
- [ ] 交付身份继续绑定 tenant、owner、project、draft request、Fact Pack 版本/摘要、evidence/fact/claim digest 和 producer policy；私有 binding 只在 owner-scoped intent 中，公开 WorkProduct 仅保留不可逆 digest 与安全锚点。
- [ ] 保留 `PREPARED → ARTIFACT_PENDING → WORK_PRODUCT_BOUND` durable saga、确定性 IDs、create-or-verify、crash recovery、并发幂等和旧 `publish_run` 对 Mingshuo PENDING 工件的原子拒绝。
- [ ] XLSX 继续进行公式注入防护与 bounded OOXML 后验收；拒绝公式、宏、外链、隐藏页、媒体、嵌入、路径穿越、重复条目及 allowlist 外部件。
- [ ] 新 API 仍只接受严格 `Content-Type: application/json` 的 `{}`；错误映射保持 422/404/409/503，响应和日志不得泄漏 tenant/owner、路径、SQL、凭据、canonical bytes 或原始 requirements。
- [ ] runtime registry 新 digest `sha256:7caed69599c964b7fc908229d86795008a0956fdae90628a904f8e4ec87dcabe` 必须在唯一 registry、release schema、offline build/verifier、RC1 acceptance 及测试中一致，并拒绝旧值或交叉不一致。
- [ ] 未提交候选先通过 v01–v15（focused、backend-full、exact20 Ruff、离线发布三组测试、Harness/doctor/hook/authority/V2 和 `git diff --check`）；三审与身份冻结后，只有在另行有效授权下创建本地直接单亲 candidate commit，才运行依赖 `HEAD^/HEAD^^` 的 v16 exact20 preimage 和 machine verify-candidate。
- [ ] Governance、Python、Security 三个独立只读审查均为 `GO / P0=0 / P1=0 / P2=0`。

## Delivery Constraints

- 只允许 manifest 精确二十路径；新增范围只有 `backend/app/operations/sqlite_backup.py`，不得出现第二十一条路径。
- 不修改 Fact Pack evaluator/schema、WorkProduct 合同、report-artifact API、史馆、SceneRun/V4、前端、Harness、authority、真实报价审批或外部发布。
- 不把 `NON_AUTHORIZING` draft request、PENDING WorkProduct 或人工确认误写为报价批准、可下载、已归档、商业成功或生产就绪。
- 任何远端漂移、machine STOP、路径扩大、第二事实源、安全门放宽、关键验证失败或独立审查 P0–P2 都立即停止。

## Affected Modules

- 模块：铭硕 Fact Pack 到中性方案/报价 WorkProduct、owner-scoped durable delivery saga、唯一 runtime registry 与可信离线发布/备份身份链。
- 允许路径：manifest 精确二十路径；原 exact19 加 `backend/app/operations/sqlite_backup.py`，结构固定 `2 ADD + 18 MODIFY`。

## Technical Plan

1. 以旧 exact19 工作区为只读 donor，核对十九路径 identity，不继承其 authority 或验证结论。
2. 从本 approval commit 的干净直接子候选重物化十九路径，修正两个已确认测试缺陷，并在第二十路径只同步可信 runner SHA。
3. 先证明 trusted runner old/new SHA mismatch、stale schema version 和非法 FK fixture 的真实失败，再以最小差异转绿；不得通过删除断言或放宽校验达成。
4. 未提交候选运行 manifest v01–v15；通过后进行 Governance/Python/Security 三审并冻结字节身份。
5. 只有在另行有效授权下创建本地直接单亲 candidate commit，随后运行 v16 exact20 preimage 和 machine verify-candidate；仅当实时远端仍为 approval commit、路径/模式/摘要一致、机器 PASS 时，才可普通 fast-forward。禁止 force-push 与生产部署。

## Implementation Report

只读依赖闭包已确认：当前 base 为 `52e289c74000866b8aca8d147386ce499b8a38a9 / 43f0114f989b49b3abb0cfc92d6143bf5529bffa`；旧 donor 的受影响回归为 `179 passed, 3 failed`，其中两项是范围内测试纠偏，一项唯一需要新增 `backend/app/operations/sqlite_backup.py`。`runtime_lock.py` 未冻结第二份 runner hash，`scripts/mingshuo-fact-pack.mjs` 已覆盖 runner 与 backup validator，因此 exact20 已形成闭合依赖，不需要第二十一条路径。

本轮仅编制 proposed 治理三文件；未修改产品、未物化正式 approval、未运行 product authority、未运行产品测试、未 commit、未 push、未部署。

## Acceptance Review

Pending strict validation and independent Governance/Python/Security review. Proposed JSON 的 `state=APPROVED_FOR_ONE_CHILD` 只是正式 approval schema 的固定字段，本草案仍是 `DRAFT / NON_AUTHORIZING`。只有 Owner 后续精确确认 canonical digest、正式三文件形成直接单亲 approval commit并由 machine authority 返回 GO，才可实施 exact20。

即使 exact20 落地，也只完成“事实包 → PENDING 中性方案/报价成果 → 可人工审阅”。第一交付里程碑剩余的 `CONFIRMED → 下载 → 史馆幂等归档 → V4 任务详情回看` 必须另立最小后继包，不得在本包顺手扩展。
