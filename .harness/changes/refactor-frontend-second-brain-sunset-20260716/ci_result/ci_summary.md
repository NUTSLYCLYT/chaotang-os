# CI 摘要：refactor-frontend-second-brain-sunset-20260716

## 结论

P4a/P4b/P4c 与 rollout 收口均已验证。生产代码不再导入四个前端决策引擎；正式结论只投影
backend CourtReview/FinalMemorial。已满足 `PACKET_P4_READY_FOR_CLAUDE_REVIEW` 条件。

## 验证矩阵

| 验证 | 结果 | 说明 |
| --- | --- | --- |
| P4 frontend targeted | PASS：34/34 | canonical formal/candidate/direct/empty/retry/source/rollout、import graph、SHADOW 边界与 bridge |
| architecture import guard | PASS | 四引擎生产 allowlist 为空，attic/side-effect import 继续阻断 |
| TypeScript | PASS | `pnpm exec tsc --noEmit`，0 error |
| P4 backend targeted | PASS：10/10 | 蒸馏 schema/golden cases 与 fallback/missing-evidence 质门 |
| swarm persistence contract | PASS：1/1 | FALLBACK 仍可留痕，但 `passed=false` 且携两个 blocking reason |
| frontend full | BASELINE：1040 pass / 7 fail / 1047 | 7 项均为 P6 已登记 known-red，无 P4 新失败 |
| backend full | BASELINE：2638 pass / 27 skip / 8 initial fail | 第 8 项在 P4/基线单跑及 P4 整文件顺序均 PASS，不构成稳定 P4 回归 |
| root/backend/frontend doctor | PASS：0/0 × 3 | 三层结构与 manifest 完整 |
| browser smoke | PASS | canonical fixture：上书房下旨 → 军机处 `LIVE_SWARM` → 质门阻断/六部意见 → “补证已提交” |
| diff check | PASS | `git diff --check 188fb3d` 无输出 |
| production DB fingerprint | PASS | size `2121728`、mtime `1783863664`、SHA-256 `10dbcf48…60859e2`，与开工一致 |

## 全量 known-red

- frontend：7 项，归属 P6；本 Packet 未修改其实现。
- backend：7 项，分别位于 commit-closeout duplicate、lawyer RAG（4）、persona registry、
  tianjian forecast；与开工登记一致。
- 后端全量初次出现的 `test_swarm_run_api_persists_and_attaches_to_review` 无法稳定复现：夹具虽
  声称阻断真实部门引擎，实际仍进入 LiteLLM 无 key 重试链。该用例在 P4 与
  `feature-chaotang-ext@59923f8` 分别 isolated PASS，P4 整文件原顺序亦 10/10；归类为既有
  测试隔离/环境风险，不在 P4 扩域修改。P4 的契约更新仍独立要求
  `FALLBACK + missing_evidence` 必须 `passed=false` 并携两个 blocking reason。

## 回滚与发布边界

- 原子提交：P4a `2d30980`、P4b `6c5f32d`、P4c `4312767`、rollout `bec1e84`、
  fallback 契约 `93138f3`。
- `NEXT_PUBLIC_COURTOS_CANONICAL_PROJECTION=false` 或未知值只降级为安全等待，不恢复旧引擎。
- 用户已授权提交、合入与 push ext；未授权部署，release 分支保持冻结。

## 声明状态

`VERIFIED_COMPLETE`
