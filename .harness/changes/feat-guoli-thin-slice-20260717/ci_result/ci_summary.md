# CI 摘要：feat-guoli-thin-slice-20260717

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `python3 -m pytest -q tests/test_guoli_overview.py` | 0 | 3 passed | 后端 LIVE/NO_DATA、事实元数据 | 2026-07-17 19:31 CST |
| `pnpm exec tsx --test ...guoli... ...finance-intel-loop-path... ...backend-api...` | 0 | 9 passed | P8 行为、canonical 路径、transport aliases | 2026-07-17 19:49 CST |
| `pnpm exec tsc --noEmit` | 0 | PASS | 前端类型 | 2026-07-17 19:49 CST |
| `NEXT_PUBLIC_API_MODE=real pnpm build` | 0 | PASS，39 routes | production build | 2026-07-17 19:50 CST |
| 前端 / 后端 / 根级 harness doctor | 0 | PASS | 三层结构与 BFF 禁令 | 2026-07-17 |
| Playwright CLI `/chaotang/liubu` API/UI 同轮对照 | 0 | PASS | NO_DATA 浏览器实证、截图 | 2026-07-17 19:20 CST |
| `finance-intel-loop-smoke.spec.ts` | 1 | 旧入口 404 | 累计主闭环 | 2026-07-17，范围外 blocker |
| `finance-intel-loop-ui.spec.ts` 聚焦用例 | 1 | 旧页面无输入框 | 累计主闭环 | 2026-07-17，范围外 blocker |
| 当前 `/shangshufang` Playwright CLI 下旨 | 失败 | 生产 UI 仍 POST 旧 `/api/court/.../complete` → 404 | 累计主闭环 | 2026-07-17 19:29 CST |
| `finance-intel-loop-path.nodetest.ts`（修复前） | 1 | RED：未找到 canonical `backendFetch` | 回归测试先红 | 2026-07-17 |
| `finance-intel-loop-ui.spec.ts --trace on --workers=1`（最终） | 0 | 2 passed | 当前上书房授权裁决闸 + 缺证据补证分支 | 2026-07-17 19:47 CST |

## 结果

P8 自身行为、构建与统一累计 smoke 均已验证。历史三次失败作为根因证据保留；用户授权的 P3 canonical-path 修复已由 RED/GREEN 路径测试和 2/2 真实浏览器 smoke 证明。

## 未验证项

- 尚未进入独立 Claude Packet 审查、尚未合并或推送。

## Diff 与回滚复核

- changed files：国力 router/test、国力 frontend slice、六部挂载、canonical 上书房调用与 UI smoke、双层 change 记录。
- diff review：未触碰大典、未建页面/BFF/表/状态机；其他三指标仅存在于测试输入，生产 UI 不引用。
- 回滚是否演练：`NEXT_PUBLIC_GUOLI_THIN_SLICE=false` 浏览器复验后卡片区域消失。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 卡片字段完整且只来自 API | 同轮响应/DOM 对照 + adapter 严格 schema | PASS |
| NO_DATA 无伪百分比 | pytest + node + screenshot | PASS |
| 不展示另外三项 / 不建新页 | grep + browser snapshot + build routes | PASS |
| 累计主闭环 smoke | canonical POST 200 + Playwright 2 passed + trace | PASS |

## 声明状态

- `DRAFT / VERIFIED_PARTIAL / VERIFIED_COMPLETE / BLOCKED`：VERIFIED_COMPLETE
