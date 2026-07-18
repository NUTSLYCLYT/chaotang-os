# CI 摘要：fix-menxia-veto-enforcement-p16-20260719

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| B16 canonical dispatch 临时行为探针 | 1 | 封驳后实际 `edict_recorded`，预期 RED | CRITICAL 缺陷复现 | P16 隔离 worktree，2026-07-19 |
| `python3 -m pytest -q backend/tests/test_menxia_veto.py backend/tests/test_chaotang_dispatch_decision_fact.py backend/tests/test_direct_canonical_dispatch.py backend/tests/test_shangshufang_loop_api.py -p no:randomly` | 0 | 64 passed | 后端 veto、无副作用、API、幂等 | 同上 |
| 三个前端 canonical `.nodetest.ts` | 0 | 18 passed | REST memorial、SSE、read model | 同上 |
| Playwright 首跑 | 1 | 作战流 blocked，但当前中心面板缺少“未生成奏折”，预期 RED | 真浏览器展示缺口 | Chromium / 同上 |
| `pnpm exec playwright test e2e/menxia-veto-blocked-state.spec.ts --project=chromium` | 0 | 1 passed | 真页面 blocked/无成功误报 | Chromium / 同上 |
| backend 全量首跑 | 1 | 2773 passed, 37 skipped, 2 failed；仅 writer baseline 8→10 | 架构清单 RED | 同上，310.36s |
| 两个 writer/tenant AST 测试 | 0 | 3 passed | 精确 writer 与 tenant lineage | 同上 |
| H16 `python3 -m pytest -q backend/tests -p no:randomly` | 0 | 2775 passed, 37 skipped, 4 warnings, 0 failed | review-v1 前 backend 全量 | 同上，269.32s |
| `pnpm exec tsc --noEmit` | 0 | 无错误 | frontend 类型 | 同上 |
| `NEXT_PUBLIC_API_MODE=real pnpm build` | 0 | Next 生产构建成功 | frontend production build | 同上 |
| frontend / backend / root Harness Doctor | 0 | 三层均 0 errors, 0 warnings | 所有权与护栏 | 同上 |
| `git diff --check && git diff --cached --check` | 0 | 无输出 | 格式 | 同上 |
| Claude Code review-v1 | 0 | `PACKET_REVIEW_NO_GO`：override 可绕过职责范围封驳 | 独立固定 SHA 审查 | `packet_review/review-v1.md` |
| v2 两条 override 旁路回归（修复前） | 1 | 2 failed：纯函数错误准奏；API 错误 `edict_recorded` | review-v1 HIGH 复现 | v2 隔离 worktree |
| v2 两条旁路回归 + 合法 override 正例（修复后） | 0 | 3 passed | 安全负例 + 兼容正例 | 同上 |
| v2 六个聚焦/架构测试文件 | 0 | 69 passed | veto、override、API、幂等、writer/tenant | 同上，9.22s |
| v2 `python3 -m pytest -q backend/tests -p no:randomly` | 0 | 2777 passed, 37 skipped, 4 warnings, 0 failed | 修复后 backend 全量 | 同上，269.80s |

## 结果

H16 行为、浏览器和架构门全绿，但 Claude review-v1 仍发现测试盲区并 NO_GO。v2 已把
该 HIGH 复现为两条 RED并转绿，聚焦 69 passed、backend 全量 2777/37/4/0；仍必须取得
review-v2 GO，不能沿用 H16 的 GO 假设。4 条 warning 与已发布基线相同。

## 未验证项

- 尚未实现/验证 Menxia 人工 override 后的恢复执行；当前诚实保持不可放行。
- 工部电池 P0 关键词 HIGH 不在本包，仍需独立修复和复审。
- P17 memorial backfill/递归 validator 不在本包。
- review-v1 为 NO_GO；尚未取得 v2 固定候选 SHA 的独立 GO，ext 合并/推送保持禁止。

## Diff 与回滚复核

- changed files：20 个实现/测试路径 + 4 个根 change 证据路径 + review-v1，计划恰好 25。
- diff review：无 schema migration；标准 review-v1 NO_GO 原文保留，由未来 review-v2 最高版本终态覆盖。
- 回滚是否演练：未执行破坏性回滚；只能在替代 fail-closed 修复同时上线时 revert。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| veto 阻止所有执行副作用 | 后端 64 项聚焦回归 | PASS |
| 状态/REST/SSE/UI 语义一致 | 18 node tests + 1 Playwright | PASS |
| 重试幂等且不误伤普通人工确认 | API/Menxia 回归 | PASS |
| writer 与 tenant 架构门 | 3 passed，精确 10 writers | PASS |
| backend 无回归 | v2 2777/37/4/0 | PASS |
| frontend build / 三层 doctor / diff | 全绿 | PASS |
| 独立 Packet 复审 | review-v1 NO_GO；等待 review-v2 | PENDING |

## 声明状态

- `REVIEW_V1_NO_GO_FIXED / REVIEW_V2_PENDING`：HIGH 已 RED/GREEN 回修；v2 全量与固定 SHA 复审待收口，未合入、未推送。
