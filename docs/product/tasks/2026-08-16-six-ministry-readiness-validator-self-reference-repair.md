# 任务：六部 Readiness 验证器自引用修复

> Task ID：`SIX-MINISTRY-READINESS-VALIDATOR-SELF-REFERENCE-REPAIR-20260816`

## Status

Ready

## Product Definition

- 用户确认：Owner 要求继续双编排公共合同主线；全量回归暴露出批准父提交的 readiness 验证器
  自引用。由于本任务触及受保护 Harness，仍须 Owner 对 machine-readable governance packet 的
  canonical digest 单独确认；packet 冻结 base/tree、两条候选路径、非目标、双指纹策略和验证矩阵。
- 事实基线：`origin/ext-dev@32cd88ab60819ad15d978f923a0a339cf6bed9db` 的 readiness 专项
  4 passed / 1 failed；全后端 4017 passed / 4 skipped / 1 failed。报告列出的 69 文件从首次受审提交
  `2e6fea337a50c316e748b7e65f03da52905e3394` 到当前只变化 `scripts/check_harness.mjs`。
- 根因：Harness 已把自身排除后冻结 68 文件指纹，但 Python readiness 测试也属于这 68 文件；修改该
  测试又会改变被验证集合，形成第二个自引用。任何只改报告或只改测试的方案都会使另一道门失败。
- 目标：历史 69 文件独立复核指纹 `a6c2…` 保持不变；当前内容证明统一改为排除两个验证器
  `scripts/check_harness.mjs` 与 `backend/tests/test_six_ministry_readiness_report.py` 后的 67 文件指纹
  `sha256:6f4158f5c03fdd898a37377dee21f1c47dee2bca40b0adbd9d16fa031a43196c`。
- 非目标：不修改 readiness 报告/schema/review provenance，不改变产品逻辑、API、数据库、Provider、
  前端、RuntimeSkill、能力状态或双编排候选。

## Acceptance Criteria

- [ ] 根 Harness 与 Python 测试都要求报告三处历史 review identity 精确保持
  `sha256:a6c2de2ca7f15069a6d997ce2cccb9498ddd4dd1269d539c192993e85a265190`。
- [ ] 两个验证器在历史 69 文件清单中都恰好出现一次，但只从当前内容指纹计算集合中排除这两个；
  集合必须恰好 67 个、无重复、排序稳定。
- [ ] 两个验证器使用相同 `path + NUL + bytes + NUL` 算法，67 文件均精确匹配 `6f4158…`。
- [ ] 任一非验证器文件漂移、历史 report/review 指纹漂移、排除集增减或 unknown field 仍失败关闭。
- [ ] 不删除、skip 或弱化 schema、family、resolver、reviewer、p0/p1、authority 和 Harness 自测断言。
- [ ] readiness 专项、全后端 pytest、Harness、自测、doctor、M0 authority regression 全部通过。
- [ ] 独立代码与安全复核确认无自授权、无历史 review 冒领、无产品行为变化。
- [ ] approval commit 只含 governance packet、task 与 plan 共 3 路径；治理候选是其
  精确单亲子且只修改 Python verifier 与根 Harness 两个路径。
- [ ] approval commit 提交后、推送前，机械证明唯一 parent 等于冻结 base，且 base→approval diff
  精确为 packet 的 3 路径；结果随 approval SHA/tree 交给 Owner 确认。
- [ ] 候选提交后、推送前，机械证明唯一 parent 等于 approval commit，且 approval→candidate diff
  精确为 packet 的 2 路径；结果随 candidate SHA/tree 交给 Owner 二次确认。

## Delivery Constraints

- Base：`32cd88ab60819ad15d978f923a0a339cf6bed9db`
- Base tree：`d2812970a3306f3dda81317cb5683ecd21e57c5f`
- Approval commit 只允许 governance packet 的 `approvalCommitPaths` 共 3 路径。
- 治理候选只允许 governance packet 的 `candidatePaths` 两路径：
  `backend/tests/test_six_ministry_readiness_report.py`、`scripts/check_harness.mjs`。
- 这是用户另行明确批准后才可实施的治理/证据修复；M0 产品 approval 不得用于授权受保护 Harness。
- 本 packet 没有仓内自动 consumer；安全性依赖 packet 固定的
  `EXACT_SINGLE_PARENT_AND_PATHS_OWNER_CONFIRMED` 协议、独立复核和两次 Owner SHA/tree 确认，
  任何缺失都不得提交/推送下一阶段。
- 不访问公网、生产数据、Provider 或真实凭据；不修改 Gitee policy；不发布或部署。
- 回滚：revert 单一治理候选；不得用跳过测试、改报告结论或扩排除集规避失败。
- 修复落地后，原双编排 approval 失效，必须在新基线上重新签发同 6 产品路径 approval。

## Affected Modules

- 模块：根 Harness 六部 readiness 守卫、后端 readiness 回归测试、治理任务证据。
- 允许路径：
  1. `backend/tests/test_six_ministry_readiness_report.py`
  2. `docs/product/tasks/2026-08-16-six-ministry-readiness-validator-self-reference-repair.md`
  3. `docs/product/tasks/2026-08-16-six-ministry-readiness-validator-self-reference-repair.packet.json`
  4. `docs/superpowers/plans/2026-08-16-six-ministry-readiness-validator-self-reference-repair.md`
  5. `scripts/check_harness.mjs`
- 依赖模块：`docs/migrations/2026-08-14-six-ministry-runtime-readiness.json`（只读）、
  `docs/contracts/six-ministry-runtime-readiness.schema.json`（只读）、M0 product authority（只读）。

## Technical Plan

- 先保留两个 RED 证据：当前 Python 指纹失败；先前“只改测试”方案机械证明会令 Harness 指纹漂移。
- 先运行 `node scripts/harness-doctor.mjs --check` 记录变更前状态。当前 `ext-dev` 不存在
  `new-change.mjs`，且机器 Harness 明确拒绝 `.harness/changes/**` 为未授权 control-plane；因此本任务
  使用 `docs/product/tasks/*.packet.json` 作为闭合、可复算审批载体，不放宽 Harness 或迁入旧控制面。
- 在两个 validator 中冻结完全相同的两项排除集与 67 文件预期 SHA-256，不改历史报告。
- 先专项 GREEN，再运行全量/根治理矩阵；最终候选冻结后独立 code/security review。

## Implementation Report

- 改动摘要：Pending
- 自审：Pending
- 验证：Pending
- 剩余风险：Pending

## Acceptance Review

- 验收结果：Pending
- 验收证据：Pending
- 未通过项：Owner 尚未确认本治理 packet identity/digest。
