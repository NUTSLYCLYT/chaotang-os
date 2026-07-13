# CI 摘要：chore-shangshufang-step0-contract-baseline-20260714

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `cd backend && python3 -m pytest -q tests/test_shangshufang_contract_baseline.py` | 0 | 6 passed，2 个既有 OpenAPI duplicate operation warning | 新 OpenAPI/黄金/source 漂移 baseline | 本次终端，2026-07-14 |
| `cd frontend && npx --yes tsx --test src/features/shangshufang/api/contract-baseline.nodetest.ts` | 0 | 2 passed | 新前端 adapter/source subset baseline | 本次终端，2026-07-14 |
| `cd frontend && pnpm exec tsc --noEmit` | 0 | PASS | 前端类型 | 本次终端，2026-07-14 |
| `cd backend && python3 -m pytest -q tests/test_shangshufang_contract_baseline.py tests/test_shangshufang_loop_api.py tests/test_outbox_worker.py tests/test_chancellor_contracts.py tests/test_decree_execution_status.py` | 1 | 37 passed / 1 failed / 4 warnings | 上书房、路由、outbox、状态相关组合回归 | 本次终端，2026-07-14 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors / 0 warnings | 根及委托 harness | 本次终端，2026-07-14 |
| `cd backend && python3 scripts/harness_doctor.py` | 0 | 0 errors / 0 warnings | 后端 harness | 本次终端，2026-07-14 |
| `cd frontend && pnpm harness:doctor` | 0 | 0 errors / 0 warnings | 前端 harness/change | 本次终端，2026-07-14 |
| `cd frontend && pnpm prod:doctor -- --json` | 2 | STOP：foreign 3050 + missing builds | 当前发布基线 | 本次终端，2026-07-14 |
| JSON parse、tracked/untracked diff check、限定新增文件 secret pattern scan | 0 | PASS，无命中 | fixture/格式/泄密基础检查 | 本次终端，2026-07-14 |

## 结果

专项新增测试 8/8、类型和三层 doctor 通过；相关组合回归存在 1 个既有失败，因此只能 `VERIFIED_PARTIAL`。prod:doctor 的 STOP 是预期发布阻断，不是本轮需要绕过的失败。

## 未验证项

- `test_chancellor_chat_streams_single_agent_reply` 失败：SSE 有 `agent="chancellor"` 和有效中文答复，但非确定性正文未包含字面量“丞相”。本轮不越级修复。
- 未运行 build/浏览器：无运行产品代码或 UI 行为变化；不能证明浏览器链路。
- 未完成 S1 路径收敛、RFR 最终验收或独立 worktree 候选 PR。
- 外部 trust anchor、immutable artifact 和生产 READY 未配置。

## Diff 与回滚复核

- changed files：本 change、指定 launch plan、2 个 backend baseline 文件、1 个 frontend test、frontend change。
- diff review：通过；未修改 runtime、deploy、数据库或用户已有脏树文件。
- 回滚是否演练：未实际回滚；新增测试/文档可按文件删除，无运行状态变化。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 契约/黄金 baseline 可重复 | 新测试 8/8 | PASS |
| launch S1 事实、ADR、威胁与 inventory 完整 | 文档静态检查 + 对抗审查 | PASS |
| 相关组合回归无失败 | 37/38 | FAIL（既有非确定性断言） |
| 发布可 READY | prod:doctor exit 2 / STOP | BLOCKED，属于 S1/S3 后续 |

## 声明状态

- `VERIFIED_PARTIAL`：本轮新增 baseline 已验证，但相关组合回归和 S1/发布硬门未完成。
