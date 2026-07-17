# P9 browser evidence

日期：2026-07-17（Asia/Shanghai）

## 环境

- P9 worktree frontend：Next dev `127.0.0.1:3002`，internal launch mode。
- P9 worktree backend：FastAPI `127.0.0.1:18081`，in-memory primary schema。
- 浏览器夹具只覆盖 `require_admin` 为 admin；truth ledger 指向 `/tmp/p9-hanlin-browser/truth_ledger.jsonl`。
- Playwright CLI session：`p9hanlin`，完成后已关闭；两服务完成后已停止。

## 旅程与结果

| 旅程 | 观察 | 结果 |
| --- | --- | --- |
| `/hanlin` + 2 条确定性记录 | `TRUTH_LEDGER`；条目 2、确定性 2、通过/未通过 1/1、通过率 50% | PASS |
| `/hanlin/experiments` | 两条真实记录分列“判定通过/判定未通过”；无开始、采用、停止按钮 | PASS |
| `/hanlin` + 仅非确定性记录 | `FALLBACK`；“暂无真实离线判定”；不填本地示例 | PASS |
| 请求头 | `/api/hanlin/overview` 带 `Authorization: Bearer p9-browser-token`，响应 200 | PASS |
| `/hanlin/rankings` 兼容抽查 | contributions/reviews/experiments/awards 四个受保护请求均为 200 | PASS |

## 本地截图（Git 忽略）

- `frontend/output/playwright/p9-hanlin-min-read-model/hanlin-truth-ledger.png`
- `frontend/output/playwright/p9-hanlin-min-read-model/hanlin-experiments-truth-ledger.png`
- `frontend/output/playwright/p9-hanlin-min-read-model/hanlin-fallback.png`

## 控制台说明

页面壳层的 `/api/chaotang/tasks` 对浏览器夹具 token 返回 401；Hanlin 请求均为 200。
该请求不属于 P9 diff，未作为 Hanlin 失败，也未在本 change 顺手修复。
