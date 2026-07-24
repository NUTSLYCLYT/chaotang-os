# CI 摘要：docs-r0-w05-evidence-rework-approval-20260723-20260723

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `git rev-parse HEAD HEAD^{tree}` | 0 | base=`67bcc78e`；tree=`e7efd61b` | exact mainline identity | 本地干净工作树 / 2026-07-23 |
| `sha256sum .../amendment.md` | 0 | `2ba59cbe...a83e38` | canonical amendment bytes | 本地 / 2026-07-23 |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W05` | 2 | `STOP / NO_ACTIVE_WORK_PACKAGE` | W05 尚未获权 | 本地 / 2026-07-23 |
| `node --test scripts/execution-authority-v2.nodetest.mjs` | 0 | 27/27 | authority 行为 | 获批激活候选 / 2026-07-23 |
| `node --test scripts/r0-amendment-check.nodetest.mjs` | 0 | 10/10 | amendment 行为 | 获批激活候选 / 2026-07-23 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors / 0 warnings | 三层边界与 manifest | 获批激活候选 / 2026-07-23 |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W05` | 0 | `GO / APPROVED_WORK_PACKAGE` | W05 唯一激活 | 获批激活候选 / 2026-07-23 |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W04` | 2 | `STOP / WORK_PACKAGE_MISMATCH` | W04 不可重复领取 | 获批激活候选 / 2026-07-23 |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W06` | 2 | `STOP / BLOCKED_DEPENDENCY` | W06 未获权 | 获批激活候选 / 2026-07-23 |
| Standards final review | 0 | `PASS / 0 MUST / 0 WARN` | 仓库规范与证据链 | candidate `5250321d` / 2026-07-23 |
| Spec final review | 0 | `PASS / 0 MUST / 0 WARN` | W05 范围与排除项 | candidate `5250321d` / 2026-07-23 |
| final atomic activation verification | 0 | W05=`GO`；W04=`STOP/WORK_PACKAGE_MISMATCH`；W06=`STOP/BLOCKED_DEPENDENCY` | W05 专属 review digest 与唯一 active package | 最终本地候选 / 2026-07-23 |

## 结果

Product Owner exact approval 与 approval digest 已完成。首次 authority 翻转的机器测试虽通过，但独立 Standards 审查发现它错误复用了明确不授权 W05 的 W01 review evidence；候选随即恢复 fail closed。最终 Standards/Spec 对 `5250321d` 均 PASS，现已生成 W05 专属 review evidence，并在同一候选中原子替换 review path/digest 与翻转 W05 ACTIVE。没有修改产品实现。

## 未验证项

- W05 RED/GREEN、migration、公共 API 纵切、回滚和产品验收。
- 推送、合并、发布和生产验证。

## Diff 与回滚复核

- changed files：本 approval change 与 execution-authority v2 manifest；无产品代码。
- diff review：待独立 Standards/Spec review；批准不替代机器 GO。
- 回滚是否演练：治理提交可 revert 到 `activeWorkPackage:null`；无产品运行态变更。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| W04 已合并且 base 精确 | Git commit/tree | PASS |
| W05 未越权启动 | authority STOP | PASS |
| 单 Packet 范围与排除项完整 | Spec 复审 PASS；Standards 允许生成专属 review evidence | PASS_TO_REVIEW_EVIDENCE |
| exact approval | `owner_approval/exact-h-approval.md` | PASS |
| W05 GO，W04/W06 STOP | W05 专属 review evidence + manifest 原子翻转 + 最终机器复验 | PASS |

## 声明状态

- `DRAFT / VERIFIED_PARTIAL / VERIFIED_COMPLETE / BLOCKED`：`VERIFIED_COMPLETE`（仅指本地 W05 治理激活；不代表产品实现、推送、合并或发布）
