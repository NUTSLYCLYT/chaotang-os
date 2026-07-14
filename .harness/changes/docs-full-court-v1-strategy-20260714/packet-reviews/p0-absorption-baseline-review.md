# Packet P0 审查报告：chore-absorption-baseline-20260714

| 绑定项 | 值 |
| --- | --- |
| BASE_SHA | `91091b84013ba047871ad23febf7cadf46269e7d`（integration/full-court-v1 HEAD） |
| HEAD_SHA | `802e951116ad1a674ff2791232ada10d6d5decd5` |
| branch | `task/p0-absorption-baseline` |
| worktree | `/tmp/chaotang-p0` |
| change ID | `chore-absorption-baseline-20260714` |
| PREDECESSOR_INTEGRATION_SHA | `91091b8`（= 当前 integration HEAD，merge-base 一致） |
| git status --porcelain | 空（clean） |
| push/upstream | 无 upstream，未 push ✓ |
| 审查时间 | 2026-07-14 19:47 (Asia/Shanghai) |
| 审查触发 | 分支监控（Codex 侧 token 未经聊天转达，按监控事件开审并在此注明） |

## 审查范围

`integration/full-court-v1...task/p0-absorption-baseline` = 2 commits
（`dfc0260` 基线证据 + `802e951` 证据绑定），共 5 文件 +317 行，
全部位于 `.harness/changes/chore-absorption-baseline-20260714/**`。

## 独立复核（重跑/重算，非采信自检）

| 项 | Codex 声明 | 独立复核结果 | 判定 |
| --- | --- | --- | --- |
| 根 harness doctor | 0 errors | 重跑 `0 errors, 0 warning(s)` | PASS |
| DB tripwire 测试 | 5 passed 3.58s | 重跑 5 passed 3.03s | PASS |
| 生产源码 LOC KPI | 238743 | 同口径重算 238743（逐字节一致） | PASS |
| 真实控制面 DB hash | `10dbcf48…` 不变 | 现路径 `backend/var/data/fengqun.db` 实测 `10dbcf48…` 一致；路径迁移系 ext 在途 runtime-layout 变更，与 P0 无关且 baseline 已如实记录 | PASS |
| diff 越界 | 仅 change 目录 | `git diff --stat` 确认无产品/测试/配置改动 | PASS |

## 检查项结论（协议 1–15）

1. 越界：无。2. TDD：P0 为基线 Packet，runner 根因给出 RED（socketpair EPERM/
TestClient hang faulthandler 栈）→GREEN（正常 profile 43/43）证据链，定性充分。
3. 第二事实源：无。4. 误删：无。5. 漂白：无——`NOT_RUN_SAFETY_BLOCKED`、
`NO_COUNTER_BASELINE` 诚实入册并正确绑定"禁止 DONE"后果。6. 命令真实性：
抽查重跑一致。7. doctor 三层 0/0；golden 代表套件 43/43。8. 一 Packet 一
change 一分支：合规（两 commit 为原子 checkpoint）。9. DB 三元指纹一致
（独立复核）。10. 不适用。11. 未触冻结边界、无物理删除。12. 从当前
integration HEAD 起步、未 push。13. DoD 映射表+未验证项完整。
14. 冒烟按铁律 11 P0 豁免；测试基础设施修复=NONE（根因为外部 runner
capability，非仓库缺陷——该定性有 RED/GREEN 对照支撑，接受）。15. 不适用。

## 亮点

- 后端契约测试 hang 根因定位到 runner capability（socketpair EPERM →
  BlockingPortal 唤醒丢失），排除仓库缺陷，避免了一次错误的 conftest 手术。
- P7 KPI 基线口径可机器复算（LOC 精确复现），P2/P3 的计数器缺口用
  `NO_COUNTER_BASELINE` 显式占位而非伪装成 0。
- 前端 7 失败逐项列明（4 项系已退役 BFF 死测试引用，与 census
  重复实现地图第 15 行互证），正确留作红灯基线。

## 遗留（非阻塞，转后续 Packet）

- 4 个 BFF 死测试引用的清理归 P6（孤儿测试退役范围）。
- `NOT_RUN_SAFETY_BLOCKED`（无选择全量 pytest）解除条件已写明；
  在解除前 campaign 终态只能 PARTIAL——与收官硬门一致。

## 裁决

PACKET_REVIEW_GO
