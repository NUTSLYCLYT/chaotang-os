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

## 2026-07-14 Task 6 续办证据

| 命令 | 退出码 | 结果 | 范围 |
| --- | ---: | --- | --- |
| `test "$(rg -c '^\\| WF-D1-' .../golden-assets-plan.md)" -eq 10` | 0 | PASS，D1 恰好 10 条 | 工作流目录结构 |
| `test "$(rg -c '^\\| WF-D2-' .../golden-assets-plan.md)" -eq 10` | 0 | PASS，D2 恰好 10 条 | 工作流目录结构 |
| `test "$(rg -c '^\\| WF-FAIL-' .../golden-assets-plan.md)" -eq 10` | 0 | PASS，失败/对抗/恢复恰好 10 条 | 工作流目录结构 |
| `test -z "$(rg '^\\| WF-(D1|D2|FAIL)-' .../golden-assets-plan.md | cut ... | sort | uniq -d)"` | 0 | PASS，30 个 ID 无重复 | 工作流目录唯一性 |
| `git diff --check -- .../golden-assets-plan.md` | 0 | PASS | 新增文档 whitespace |
| `node scripts/harness-doctor.mjs` | 0 | PASS，0 errors / 0 warnings | 根级、前端与后端 harness 委托 |

Task 6 只冻结目录与治理规则，没有运行 30 条端到端用例，也没有完成合同双人标注、阈值批准或生产数据授权。执行到此检查点时 Task 7/8 尚未开始；后续状态见下节，change 总状态始终保持 `VERIFIED_PARTIAL`。

## 2026-07-14 Task 7 续办证据

| 命令 | 退出码 | 结果 | 范围 |
| --- | ---: | --- | --- |
| `ss -ltnp` | 0 | PASS，观测到 3050/8081/4444 等本机监听 | 本机端口快照，不等于生产拓扑 |
| `ps -fp 2207,962,3917,7920` + `readlink /proc/<pid>/cwd` | 0 | 3050 属于旧工作区；8081 属于当前 backend；4444 属于仓库外 OpenClaw | 本机进程身份 |
| 沙箱内 `pnpm prod:doctor -- --json` | 2 | EPERM/不可采信 | 证明受限沙箱不能替代本机生产诊断 |
| 沙箱外 `pnpm prod:doctor -- --json` | 2 | `STOP`：foreign 3050、missing builds、JWT key id 缺失；2/5 checks PASS | 本机 release gate，只读复跑 |
| Task 7 两文件存在、表头/状态字段断言 | 0 | PASS | `production-unknowns.md`、`data-governance-gate.md` 结构 |
| `git diff --check -- production-unknowns.md data-governance-gate.md` | 0 | PASS | Task 7 文档 whitespace |
| `node scripts/harness-doctor.mjs`（Task 7 后复跑） | 1 | FAIL：delegated frontend doctor | 范围外 `frontend/.harness/changes/refactor-dept-id-ssot-20260714` 缺 `summary.md`；本轮未修复 |
| `cd frontend && pnpm harness:doctor` | 1 | 同上，唯一错误为不完整 change | 证明失败不由 Task 6/7 文档内容触发 |

Task 7 产物完成但 production-only 事实仍 BLOCKED。在该检查点 Task 8 尚未启动：HEAD 从 `0e27228` 变化到 `a073811`，并一度出现范围外脏树/change；后续 owner 收口后才在最终快照继续复验，结果见下一节。

## 2026-07-14 Task 8 动态复验

最终证据快照：`96d9a382f978bc457b9f4eb1e8c4a77ad650ac26`。复验期间分支在首轮全量测试中从 `cbbe5e2` 前进到 `96d9a38`，因此相关组合和全量命令均在 HEAD 稳定后重跑；首轮混合快照的 2585/7 结果不作为最终断言。

| 命令 | 退出码 | 结果 | 范围 |
| --- | ---: | --- | --- |
| `cd frontend && pnpm build` | 1 | 预期 fail-closed：未显式设置 `NEXT_PUBLIC_API_MODE=real` | 发布模式诚实门 |
| `cd frontend && NEXT_PUBLIC_API_MODE=real pnpm build` | 0 | PASS，production build/TypeScript/40 routes | Build |
| `cd frontend && pnpm exec tsc --noEmit` | 0 | PASS | 前端类型 |
| lint capability probe | 1 | `UNAVAILABLE`：无 lint script、无本地 eslint binary | 不宣称 lint 通过 |
| 沙箱内前端 contract Node test | 1 | `listen EPERM`，tsx IPC 受沙箱限制 | 不作为断言失败 |
| 沙箱外同一 contract Node test | 0 | 2/2 passed | 前端 adapter/source contract |
| 后端整文件 contract baseline（沙箱内首次运行） | 130 | 首个进度点后超过 90 秒无输出，人工中断；后续确认为执行环境假阴性 | 沙箱限制调查证据 |
| OpenAPI baseline 具名用例 + `timeout 30s` | 0 | 1 passed，2 warnings | 请求/OpenAPI 快照 |
| `direct_fallback` 具名用例 + `timeout 30s`（沙箱内） | 124 | 稳定超时；faulthandler 与最小 AnyIO 复现确认 asyncio 自唤醒 socket `send()` 返回 `PermissionError: EPERM` | 沙箱假阴性，不是业务失败 |
| 沙箱外 `python3 -m pytest -q tests/test_shangshufang_contract_baseline.py` | 0 | 6 passed，2 warnings，3.46s | 后端正式合同最低基线 |
| 最终 SHA 沙箱外上书房相关组合回归 | 0 | 38 passed，4 warnings，9.87s | 合同、主循环、outbox、Chancellor、execution status |
| 最终 SHA 沙箱外 `python3 -m pytest -q` | 1 | 2601 passed / 26 skipped / 9 failed / 12 warnings，330.85s | 全量后端失败基线 |
| `cd backend && python3 scripts/harness_doctor.py` | 0 | 0 errors / 0 warnings | 后端 harness |
| `cd frontend && pnpm harness:doctor`（最终 SHA） | 0 | 0 errors / 0 warnings | 前端 harness |
| `node scripts/harness-doctor.mjs`（最终 SHA） | 0 | 0 errors / 0 warnings | 根级及委托 harness |
| common credential pattern scan | 0 | PASS，无命中 | 本 change secret 基础检查 |
| `git diff --check` | 0 | PASS | 全工作树 whitespace |
| 沙箱外 `pnpm prod:doctor -- --json` | 2 | STOP，2/5 PASS；foreign 3050、missing builds、JWT identity 缺失 | 浏览器前置/发布门 |

未运行项：

- 浏览器 Playwright：不满足受控 3050、immutable build、JWT identity 和隔离候选前置，按任务规则保持 BLOCKED。
- coverage：本轮不是新增运行逻辑，未运行带 coverage 的全量命令，不能计算或声称覆盖率。

全量失败分类（本轮仅记录，不越界修复）：

- `tests/test_commit_closeout_check.py` 1 项：文档查重测试依赖的真实 qintianjian 文档位置与当前 monorepo 资产不一致。
- `tests/test_decision_task_single_writer.py` 1 项：并发合入的 `src/governance_compat_store.py:62` 直接构造 `DecisionTask`，违反唯一 writer 门。
- `tests/test_flow_store_legacy_tripwire.py` 1 项：并发合入的 `chaotang_store.write_review_files` 写操作没有出现在导出的 legacy endpoint counter 中。
- `tests/test_lawyer_rag.py` 4 项：`backend/src/lawyer_rag.py` 仍从 `backend/skills/personas` 取法条库，而 persona 资产已迁至项目根 `skills/personas`。
- `tests/test_persona_registry.py` 1 项：真实 roster 对裸名 `munger` 的固定期望与当前 persona 重组后的目录名/席位不一致。
- `tests/test_tianjian_verdict.py` 1 项：端点真实链路现在输出 9 items，测试仍固定期望 6，属于行为/期望漂移。

Task 8 状态为 `VERIFIED_PARTIAL_BLOCKED`；后端合同最低门已 PASS，但全量 9 项失败和浏览器/生产硬门仍阻止升级，Step 0/change 总状态保持 `VERIFIED_PARTIAL`。
