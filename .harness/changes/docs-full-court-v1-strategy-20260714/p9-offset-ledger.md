# P9 残段核销单（并行会话承接对账，2026-07-17 实测口径）

> 干对账预备件 1/4。P9=翰林最小读模型（方案 :315）。

## 已由并行会话承接（引证 commit）

| 验收项 | 承接证据 | 状态 |
| --- | --- | --- |
| 1 条数据线接真源（experiments/overview 读 truth_ledger，空/损坏诚实 FALLBACK） | `c669c8a`（test_hanlin_truth_source 82 行） | ✅ |
| 翰林 surface 限内部环境 | `b8515f6`（internal launch env gating） | ✅ |
| 复用现有存储、不新建表/状态机 | 同上（读 truth_ledger） | ✅ |

## 残段（P9 收官需补，实测 2026-07-17 02:5x）

| # | 验收项 | 现状实测 | 量级 |
| - | --- | --- | --- |
| R1 | `hanlin-home-mock.ts` 降级明示 DEMO 标+生产 flag 默认关 | 文件仍在，home 页无 DEMO sourceLabel 标注（grep 0） | 小 |
| R2 | `/api/hanlin/reset-demo` 限内部账号 | hanlin.py 无 internal/admin 限制（grep 0）；注：b8515f6 的 surface gating 可能已在环境层拦住——需确认层级后决定是否还需端点级限制 | 小 |
| R3 | 其余数据线 deferred 清单落 change 目录 | 未见 | 文书 |
| R4 | 翰林线冒烟（正常+空态+权限） | 未见证据 | 小 |

## 核销口径

P9 = 承接 3 项 ✅ + 残段 4 项（R1–R4，合计约半天）。
收官门 1 的 P9 记为"部分承接，残段清单在册"——残段清零或显式 deferred
后方可计入 10/10。
