# CI 摘要：refactor-dept-id-ssot-20260714

## 环境与安全边界

- 验收分支：`feature-chaotang-ext`。
- P1 实现提交：`8a16e8760f34490ba720eb8a662766cc1ddd340d`。
- P1 EXT merge：`defd157739ab1815eafeccfe420348ab452eae1a`。
- 工作区：`/home/ubuntu/Projects/chaotang-os`；P1 原工作树已迁到
  `/home/ubuntu/Projects/.fullcourt-worktrees/p1-dept-id-ssot`。
- 前端锁文件 SHA-256：
  `7a41d038ac6df98bffd9d76046e15f95e71880ebf6f3b015b45a2dd7b5b4d066`，
  验收前后未改变。
- 生产 DB `backend/var/data/fengqun.db` SHA-256：
  `10dbcf48d3fb4c6a5297bd2f42b73c030d9db7a79c1e0e47734df5dac60859e2`，
  代表套件前后及最终复核均一致；legacy `backend/data/fengqun.db` 不存在。

## 命令

| 工作目录 | 命令 | 起止时间（Asia/Shanghai） | 退出码 | 结果 / 覆盖范围 |
| --- | --- | --- | ---: | --- |
| `backend/` | `python3 -m pytest -q tests/test_department_identity_ssot.py` | 23:45:29–23:45:35 | 0 | 8 passed；后端 YAML SSOT、重复/未知 key fail-closed、消费者投影 |
| `frontend/` | `node --import tsx --test src/lib/contracts/dept-ssot.nodetest.ts` | 23:45:29–23:45:30 | 0 | 9 passed；前端 `dept.ts` SSOT 与 repository grep guard |
| `backend/` | `python3 -m pytest -q tests/test_chancellor_golden_cases.py` | 23:45:29–23:45:34 | 0 | 34 passed；覆盖裁决要求的 30 条并多 4 条，路由语义未漂移 |
| 根目录 | `node scripts/harness-doctor.mjs` | 23:45:29 | 0 | 根 doctor 0 errors / 0 warnings，委托前后端 doctor 通过 |
| `backend/` | `python3 scripts/harness_doctor.py` | 23:45:29 | 0 | 后端 doctor 0 errors / 0 warnings |
| `frontend/` | `node scripts/harness-doctor.mjs` | 23:45:29 | 0 | 前端 doctor 0 errors / 0 warnings，无 BFF/route handler 回流 |
| `frontend/` | `timeout 600s pnpm exec tsc --noEmit` | 23:45:54–23:46:08 | 0 | TypeScript 零错误 |
| `backend/` | `timeout 600s python3 -m pytest -q tests/test_final_memorial_gate.py tests/test_decree_event_ledger.py tests/test_outbox_worker.py tests/test_decree_execution_status.py tests/test_shangshufang_loop_api.py tests/test_chaotang_memorials.py -k 'not chancellor_chat_streams_single_agent_reply'` | 23:45:54–23:46:10 | 0 | 43 passed、1 deselected；下旨、状态、奏折、裁决、归档代表主链 |
| `backend/` | `timeout 300s python3 -m pytest -q tests/test_production_db_tripwire.py` | 23:45:54–23:46:04 | 0 | 5 passed；测试 DB 隔离 tripwire |
| `frontend/` | `timeout 900s pnpm test:node` | 23:45:54–23:46:03 | 1 | 1015 tests：1008 pass / 7 fail；与 P0 登记的同一组 7 个基线失败，P1 新增 6 项全部通过 |
| `frontend/` | `NEXT_PUBLIC_API_MODE=real NEXT_DIST_DIR=.next-p1-verify timeout 900s pnpm build` | 23:47:14–23:48:05 | 0 | 隔离 production build 通过；临时 dist 与 Next 自动写入的 tsconfig 条目随后清理，未触碰 3050 |
| `frontend/` | 既有 unified-loop 与 UX 聚焦 smoke（`--trace=on`） | 23:51:07–23:51:48 | 1 | 诊断失败：旧测试请求退役 `/api/court/shangshufang/*`（404）及 `/study`（404）；失败截图与 trace 保留 |
| `frontend/` | 证据专用当前规范 smoke：`playwright test e2e/p1-dept-id-ssot-evidence-smoke.spec.ts --project=chromium --workers=1 --trace=on` | 23:57:16–23:57:33 | 0 | 1 passed；隔离 18081 runtime + 3002 前端完成“下旨 → 军机处 → 御前裁决 → 史馆” |
| 根目录 | 两个 `git show <sha> \| git patch-id --stable` | 23:58:55 | 0 | 旧/新 P1 patch-id 同为 `ed9dd2bbf28d48af6c6836fc4362a450f3b9f0e0` |
| 根目录 | `git diff --check` + lock/DB SHA + legacy DB absence | 23:58:55 | 0 | 无 whitespace error，锁文件与生产 DB 不变 |
| 根目录 | `node scripts/harness-doctor.mjs`（证据目录完成后复跑） | 00:00:23 | 0 | project doctor 0 errors / 0 warnings，委托前后端 doctor 通过 |

## 完整 nodetest 的 7 个基线失败

与 P0 `chore-absorption-baseline-20260714` 逐项同类：

1. v1 module `active/pending` 旧预期；
2. 退役 recruit BFF route ENOENT；
3. `出纳司/国库司` 旧 office 预期；
4. 退役 dispatch route auth guard；
5. 两个退役 learning BFF route ENOENT；
6. 退役 orchestrate BFF route ENOENT。

P0 为 1009 tests / 1002 pass / 7 fail；本次为 1015 tests / 1008 pass / 7 fail，
证明 P1 增加的 6 个测试全部通过，失败集合未扩大。

## 浏览器证据与诚实边界

- 失败诊断：`ci_result/artifacts/playwright/`，包含旧路径 404 的截图和 trace。
- 当前规范 smoke：`ci_result/artifacts/playwright-current/`，包含成功 trace。
- 成功截图：`ci_result/artifacts/playwright/01-junjichu.png`、`02-shiguan.png`。
- smoke 使用独立 runtime root
  `/home/ubuntu/Projects/.fullcourt-worktrees/p1-smoke-runtime-20260714`，没有连接生产 DB。
- 隔离环境没有真实模型质量凭据，候选奏折会被正确阻断。因此成功 smoke 显式播种了
  与后端测试相同的“质门已通过”前置，只证明浏览器/API 编排与归档旅程，不构成真实模型
  或 EXT 三证认证。临时 evidence spec 已在运行后删除，产品源码未因此改变。
- 史馆页面 dev 日志出现既有 hydration mismatch 警告；页面仍返回 200 且 smoke 断言通过。

## Diff 与回滚复核

- P1 changed files：实现提交 29 个文件；证据提交只允许本 change 目录和裁决记录。
- diff review：重切前后 patch-id 相同；`git diff --check` 通过。
- 回滚：未在共享 EXT 上演练；安全命令为
  `git revert -m 1 defd157739ab1815eafeccfe420348ab452eae1a`。

## 未验证项

- 未运行会写真实运行账本或消耗 provider 预算的真实模型 smoke。
- 未修复完整 nodetest 的 7 个既有基线失败；它们未被 P1 扩大。
- 既有 smoke 文件的退役路径尚未更新；本轮只记录，不将范围外修复混入 P1。
- 未 push、未启动 release 分支、未执行 EXT 三证。

## 声明状态

- `VERIFIED_PARTIAL / READY_FOR_REVIEW`：P1 专属门禁、类型、build、代表主链与隔离浏览器
  旅程通过；全量 suite 的既有红灯和真实模型认证边界已明确披露。
