# 任务：feat-r0-w01-execution-authority-v2-20260721-20260721

## 任务 1：execution-authority v2 新技术栈

- 目标：造一套独立的 schema/manifest/resolver/CLI/tests，scoped 到仅授权 R0-W01
- 前置条件：R0-W01 owner exact-H 批准 + 三路 review GO 已落盘
- 输入：amendment.md §8 packet card + §11 Codex 执行指令 + v1 既有实现模式（照抄不改）
- 输出：GO 仅对 `R0-W01`；`P12`/`PKT-04`/`S3` 等旧编号一律 `UNKNOWN_WORK_PACKAGE_FORMAT`
- 涉及文件：`.harness/contracts/execution-authority-v2.schema.json`、
  `.harness/manifest/execution-authority.v2.json`、`scripts/lib/execution-authority-v2.mjs`、
  `scripts/execution-authority-v2.mjs`、`scripts/execution-authority-v2.nodetest.mjs`、
  `.harness/wiki/execution-authority-v2.md`（全部新建）
- 状态 / 数据变化：新增文件，不修改任何既有运行时状态
- 验证命令与证据：见 `ci_result/ci_summary.md`
- 回滚边界：删除这 6 个新文件即可完全回滚，v1 不受影响
- 完成定义：26/26 nodetest 通过 + CLI 手工验证通过

## 任务 2：amendmentGovernance 状态跃迁

- 目标：`PROPOSED_NOT_AUTHORITY` → `APPROVED_FOR_W01`，原子发生
- 前置条件：任务 1 的 v2 manifest 已就绪，可引用其证据摘要
- 输入：owner_approval + claude_code_review 两份既有证据文件的路径+实算 sha256
- 输出：`approvalEvidence`/`approvedSourceDigest` 从 null 变为非 null，`professionalReassignmentGateStatus`
  从声明式变为 `RUNTIME_ENFORCED_BY_EXECUTION_AUTHORITY_V2`
- 涉及文件：`.harness/manifest/project-harness.json`、`scripts/lib/amendment-governance.mjs`（拆
  dispatcher）、`scripts/r0-amendment-check.nodetest.mjs`（fixture 独立化 + 新增 9 项负例）
- 状态 / 数据变化：`project-harness.json.amendmentGovernance` 整块原子替换
- 验证命令与证据：见 `ci_result/ci_summary.md`
- 回滚边界：`git revert` 该 hunk 即恢复 `PROPOSED_NOT_AUTHORITY`，旧分支校验逻辑原样保留未删
- 完成定义：新旧两态 dispatcher 均有回归测试通过

## 任务 3：harness-doctor 双向硬断言接入

- 目标：doctor 自己就是回归防线，不依赖有人记得跑 nodetest
- 前置条件：任务 1、2 完成
- 输入：v2 registration 期望值 + 两次 `resolveExecutionAuthorityV2` 调用（W01/W02）
- 输出：`[ok] execution authority v2 authorizes exactly R0-W01 and blocks all successor packets`
- 涉及文件：`scripts/harness-doctor.mjs`
- 状态 / 数据变化：新增校验块，不改变既有 v1/amendmentGovernance 校验逻辑
- 验证命令与证据：`node scripts/harness-doctor.mjs` → 0 errors / 0 warnings
- 回滚边界：删除新增代码块即可
- 完成定义：doctor 单跑确认两条硬断言都真实执行（非跳过）

## 任务 4：独立审查

- 目标：非实现者 Claude Code 会话复核 H=`e467254c`
- 前置条件：任务 1-3 全部完成并本地验证通过
- 输入：B/H/tree/diff 四件套身份 + amendment.md 相关章节
- 输出：GO 判定，0 HIGH，2 MEDIUM（记录为 R0-W02 技术债，不阻塞）
- 涉及文件：`claude_code_review/exact-h-final.md`（本目录）
- 状态 / 数据变化：新增证据文件
- 验证命令与证据：审查会话独立重跑全部 7 条验证命令，见 `exact-h-final.md`
- 回滚边界：不适用（只读审查）
- 完成定义：四件身份全部 MATCH，Combined verdict = GO
