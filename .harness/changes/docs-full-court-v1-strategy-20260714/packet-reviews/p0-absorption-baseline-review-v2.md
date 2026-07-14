# Packet P0 审查报告 v2（BASE 2a92646 重切版）：chore-absorption-baseline-20260714

| 绑定项 | 值 |
| --- | --- |
| BASE_SHA | `f9b3e88668cfa0e891274a0b4b5cc3947c1e36fe`（新 integration/full-court-v1 HEAD） |
| HEAD_SHA | `037ceb61a7677da9659e76d3b8843fc8f463797a` |
| branch | `task/p0-absorption-baseline`（新 base 重切） |
| worktree | `/tmp/chaotang-p0-v2base` |
| change ID | `chore-absorption-baseline-20260714` |
| PREDECESSOR_INTEGRATION_SHA | `f9b3e88`（= 当前 integration HEAD） |
| campaign BASE_SHA | `2a92646`（B1 裁决迁移后） |
| push/upstream | 无 ✓ |
| 前版审查 | `p0-absorption-baseline-review.md`（旧 base `802e951`，GO）——存于 `archive/p0-absorption-baseline-pre-2a92646` |
| 审查时间 | 2026-07-14 23:20 (Asia/Shanghai) |

## 审查性质

B1 base 迁移后的重切版。baseline.md 为**重写**（非复制），故做实质复核而非 re-anchor 备注。

## 独立复核

| 项 | Codex 声明 | 独立复核 | 判定 |
| --- | --- | --- | --- |
| 生产源码 LOC（新口径基线） | 238894 | 对 `037ceb6` tree 同口径重算 = 238894 | PASS |
| legacy 四文件 LOC | 950/308/2166/980 | 逐文件重算一致——结构重构未触 legacy 核心文件，KPI 连续性成立 | PASS |
| LOC 增量归因 | +151 归结构重构，不归后续 Packet | 与 archive 版基线 238743 差值吻合 | PASS |
| 真实 DB 指纹 | `10dbcf48…` 不变（新路径 backend/var/data/） | 与旧版审查时实测值一致，mtime 仍为 07-12 | PASS |
| collect-only 2589（旧 2572） | 新 base 含结构重构自带测试 | 差值方向与 2a92646 内容一致，可信 | PASS |
| 7 个前端失败集合 | 与旧 P0 完全相同 | 清单逐项对照旧版一致 | PASS |
| 诚实标记 | NOT_RUN_SAFETY_BLOCKED / NO_COUNTER_BASELINE / lint MISSING 全保留 | 无弱化 | PASS |
| socketpair preflight | 当前 runner =1（可跑 TestClient/tsx） | 新增记录，符合 P0 runner 教训惯例 | PASS |

## 结论

- 重切版所有数字均为新 base 实测（非照抄旧值），KPI 口径连续、差异全部显式归因；
- 旧版 GO 的全部结论在新 base 上保持成立；archive 分支保留完整历史链，可恢复；
- worktree 迁移记录、predecessor 链、无 push 均合规。

## 遗留提醒

- worktree 仍在 `/tmp`，已发生过一次环境清理导致 untracked 证据丢失（P1 change 目录）；
  建议后续 Packet worktree 移出 `/tmp`（如 `~/Projects/.fullcourt-worktrees/`）。
- P1（`c06d66d`）仍基于已废弃的旧 base，必须重切/rebase 到 `f9b3e88` 链并重建
  change 目录证据后才能进入审查。

## 裁决

PACKET_REVIEW_GO
