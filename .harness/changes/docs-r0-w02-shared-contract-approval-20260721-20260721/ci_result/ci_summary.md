# CI 摘要：docs-r0-w02-shared-contract-approval-20260721-20260721

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W02` | 0 | GO | ledger 翻转生效 | 2026-07-21 |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W03` | 2 | STOP/BLOCKED_DEPENDENCY | 依赖链仍守住 | 同上 |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W01` | 2 | STOP/WORK_PACKAGE_MISMATCH | 已完成的包不再可重复领取 | 同上 |
| `node --test scripts/execution-authority-v2.nodetest.mjs` | 0 | 26 pass / 0 fail | v2 全量单测(含本次两处 bug 修复) | 同上 |
| `node --test scripts/r0-amendment-check.nodetest.mjs` | 0 | 10 pass / 0 fail | governance 未受影响回归 | 同上 |
| `node --test scripts/execution-authority.nodetest.mjs` | 0 | 9 pass / 0 fail | v1 零回归 | 同上 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors / 0 warnings | 全仓 doctor | 同上 |

## 结果

Ledger 翻转成功且经过对抗式验证：不仅正例(W02 GO)通过，还验证了两个容易被忽略的边界——已完成
的 W01 不能重复领取、尚未到来的 W03 仍被依赖链挡住。翻转过程中发现并修复了 v2 resolver 自身的
两处设计缺陷（见"未验证项"下方说明，均已修复且有回归测试覆盖）。

## 发现并修复的 bug（翻转过程中暴露，不是未验证项，是本次变更的一部分）

1. `approvedScope` 校验硬编码死了 `["R0-W01"]`，没有随 `activeWorkPackage` 变化——导致 W02
   永远无法通过校验。修复：改为比对 `approvalEvidence.approvedScope[0] === manifest.activeWorkPackage`
   （`activeWorkPackage` 为 null 时放宽，兼容回滚态）。
2. `effectiveBase` 误与 `amendmentGovernance.effectiveBase`（修正案批准时刻的永久冻结锚点）比对，
   语义错误——后者永远不变，前者应随每个包的开工基线推进。修复：改为跟同一份 manifest 内
   `approvalEvidence.candidateH` 做自洽校验。
3. `harness-doctor.mjs` 的硬断言同样硬编码了 R0-W01/R0-W02，改成动态读取
   `activeWorkPackage` + `EXPECTED_R0_WORK_PACKAGE_SEQUENCE` 算下一个包，不用每次开新包
   都手改 doctor 代码。

三处都补了/改了对应回归测试，见 `scripts/execution-authority-v2.nodetest.mjs` 的
diff（effective base mismatch 测试改为对 manifest 而非 governance 做突变；approvedScope 测试
文案更新；两个真实仓库 CLI 测试改成动态读取当前 activeWorkPackage，不再硬编码包名）。

## 未验证项

- W02 的实际业务实现（Pydantic 契约/路由/测试）尚未开始，本变更只是开工前置关卡

## Diff 与回滚复核

- changed files：`.harness/manifest/execution-authority.v2.json`（ledger 翻转）+
  `scripts/lib/execution-authority-v2.mjs`（bug 修复）+ `scripts/harness-doctor.mjs`（动态化）+
  `scripts/execution-authority-v2.nodetest.mjs`（测试跟进）+ 本变更记录本身
- diff review：单人会话内自查，未走独立 review（纯治理配置+bug修复，非新产品逻辑；下一步
  W02 实现完成后仍需照 W01 模式走独立审查）
- 回滚是否演练：未演练；`git revert` 即可恢复 ledger 到只授权 R0-W01 的状态,resolver 逻辑修复
  本身不需要回滚(是修 bug 不是加功能)

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| Product Owner 批准 R0-W02 落盘 | `owner_approval/exact-h-approval.md` | 已满足 |
| OQ-03 taxonomy 冻结 | 同上文件 | 已满足 |
| ledger 原子翻转且 GO/STOP 均正确 | 命令表 | 已满足 |
| v1 零回归 | 9/9 pass | 已满足 |
| doctor 0 errors | 0 errors / 0 warnings | 已满足 |

## 声明状态

- `VERIFIED_COMPLETE`（Step 0 治理关卡范围内）；R0-W02 实际业务实现是独立的后续变更，不在本次
  范围。
