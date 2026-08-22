# 任务：P14 × 六部 Readiness 继任兼容修复

> Task ID：`P14-SIX-MINISTRY-READINESS-SUCCESSOR-COMPATIBILITY-20260822`

## Status

Ready

## Product Definition

- 事实基线：P14 已获批的 20 路径候选通过 P14 后端精准矩阵 `266 passed`、前端 `682 passed`，但
  backend-full 暴露出三条过时的六部 accounting fixture，以及 Root Harness 对
  `backend/app/accounting_reports/storage.py` 的历史 current-content 指纹漂移。
- 根因 A：旧 fixture 在 artifact 仍为 `PENDING` 且没有 `management_report_xlsx` 精确绑定时写入
  confirmation；这与 P14 “只有 PUBLISHED 且完整绑定的 artifact 可确认”的安全不变量冲突。
- 根因 B：六部 2026-08-14 历史审查的 current-content 指纹把后继 Packet 明确接管的产品路径继续当成
  永久不变字节，无法区分合法 P14 后继变更与未授权漂移。
- 目标：保留历史 69 文件与独立 review identity；将两条 P14-owned 路径和两个自引用 validator 精确
  排除于旧 current-content 集合，继续校验剩余 65 条；另以双状态 composite fingerprint 持续约束两条
  后继路径；同时把 P14 产品范围扩为 21 条，仅允许修正旧测试 fixture/error expectation，不放宽产品安全行为。
- 非目标：不修改六部 readiness 报告/schema/review provenance，不修改产品代码，不确认 PENDING/ABORTED
  artifact，不改变 API、数据库、Provider、前端、P09/P15 或其他 Packet。

## Acceptance Criteria

- [ ] 六部报告中的 69 文件、历史 reviewed fingerprint、review status/reviewers/P0/P1 全部逐字不变。
- [ ] Python 与 Root Harness exclusions 精确等于 4 条，剩余集合恰 65 条，digest 精确为
  `sha256:013bfb8272e936be85c2d470033787c3b7f105ad6eae2dfe680373df023b5e69`。
- [ ] 第五条排除、任一剩余文件漂移、两 validator 策略不一致均失败关闭。
- [ ] 两条 successor-owned 路径只允许完整 legacy pair `709eba...c924` 或完整 reviewed P14 pair
  `d98fbc...648d9`；单条漂移、旧新混搭与第三状态全部失败关闭。
- [ ] P14 合同冻结 21 条 productPaths；新增路径仅为
  `backend/tests/test_six_ministry_accounting_evidence_adapter.py`。
- [ ] 新 fixture 必须先绑定 management XLSX 并 publish 后再写终局 confirmation；PENDING/ABORTED 仍拒绝。
- [ ] tampered durable payload 在 storage boundary 失败后使用稳定 non-enumerating unavailable code。
- [ ] readiness pytest、Root Harness/self-test、doctor、product-authority regression 与 V2 convergence 全绿。
- [ ] governance approval 与 candidate 均 exact single-parent、exact paths；candidate 独立 code/security review GO。
- [ ] candidate 远端落地后重新生成 21 路径 P14 approval；旧 20 路径 approval 不得复用。

## Delivery Constraints

- Base：`48c9497b934bc3d12300cf7d072bc442fdb8c9d5`
- Base tree：`cbc9af31de71e937ed27534a862c980ab92306db`
- Approval commit 只允许本 task、packet、plan 三条治理路径。
- Candidate commit 只允许 P14 合同、Python readiness verifier、Root Harness 三条路径。
- Candidate 不修改任何产品文件；产品工作树继续保留但在新 M0 前暂停第 21 路径修改与提交。
- 本 packet 没有仓内自动 consumer；Owner 必须分别确认 approval digest 与 candidate SHA/tree。
- 不访问生产数据、Provider、真实 secret；不部署、不迁移持久数据库、不推送产品候选。
- 回滚只 revert 单一 governance candidate；不得通过删除测试、更新历史 review 或放宽 confirmation 过门。

## Affected Modules

- 模块：六部 readiness 当前内容验证器、P14 合同边界、治理任务证据。
- 允许路径：严格等于 packet 的 3 条 approvalCommitPaths 与 3 条 candidatePaths；不得扩面。

## Technical Plan

1. 保留 backend-full 的三条 stale fixture 与 readiness fingerprint 失败作为 RED。
2. 在两个 validator 中冻结完全相同的四项 exclusions、65 文件计数/current-content digest 与
   successor pair 双状态 composite。
3. 修改 P14 合同为 21 路径，并冻结新增测试的唯一允许行为与先治理后产品顺序。
4. 运行专项、Harness/self-test、doctor、authority regression、V2 与 diff-check。
5. 独立 code/security review；锁定 raw SHA、canonical packet digest、commit/tree 与路径集合。
6. Owner 确认后依次推送 approval 和 candidate；远端双读后再生成新的 P14 M0 三件套。

## Implementation Report

- 改动摘要：四项 exclusions + 65 文件 current-content 指纹；两条后继路径 legacy/reviewed-P14 双状态
  composite；P14 合同 20→21 路径；独立治理两提交协议。
- 自审：历史 69/report/review identity 未改；两种 mixed pair 与任意 third state 均不在 allowlist；产品
  安全行为未修改。
- 验证：readiness 10/10、future adapter fixture 13/13、Root Harness 146、Harness self-test 174、doctor
  PASS、product-authority 12/12、V2 PASS、frontend isolated build/lint PASS、diff-check PASS。
- 剩余风险：产品候选仍需新版 21 路径 M0、backend isolated full、独立产品 review 与真实浏览器 evidence；
  本治理候选不授权产品提交或部署。

## Acceptance Review

- 验收结果：独立 code/security 均 P0=P1=P2=P3=0，治理 readiness GO。
- 验收证据：legacy pair `709eba...c924`、reviewed P14 pair `d98fbc...648d9`，两种 mixed pair 均拒绝；
  65 文件 digest `013bfb...b5e69`。
- 未通过项：Owner 尚未确认本 packet canonical digest 与未来 candidate commit/tree；因此尚未提交/推送。
