# CI 摘要：fix-r0-w08-tenant-null-and-harness-remediation-20260801

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `python3 -m pytest -q backend` | 0 | 3408 passed, 45 skipped, 4 warnings | 后端全量 | 2026-08-01 |
| `node scripts/run-nodetest.mjs node` | 0 | 1118 passed | 前端 node profile | 2026-08-01 |
| `node scripts/run-nodetest.mjs core` | 0 | 397 passed | 前端 core profile | 2026-08-01 |
| `NEXT_PUBLIC_API_MODE=real pnpm build` | 0 | build PASS | 前端构建 | 2026-08-01 |
| `python3 backend/scripts/harness_doctor.py` | 0 | 0 errors, 0 warnings | 后端护栏 | 2026-08-01 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors, 0 warnings | 根护栏 | 2026-08-01 |
| `run_w08_acceptance.py --closeout-preflight` | 1 | 36/36 + 10/10 pass; user records missing | W08 外部验收 | 2026-08-01 |

## 结果

代码与测试门禁通过；W08 仍是 `BLOCKED`，唯一剩余门为真实非开发用户验收记录。

## 未验证项

- 浏览器新鲜运行与生产身份未验证；3050 被明确禁止操作。
- 未执行数据库迁移或生产部署。

## Diff 与回滚复核

- changed files：18 个受批准 runtime/test/harness 文件，另有既存未跟踪 `backend/knowledge/docs/ima_archived/` 未纳入。
- diff review：独立 Codex 只读审查，无 HIGH；LOW 建议已处理 validator block 边界。
- 回滚是否演练：未演练，仅保留隔离分支可回退。
- 根 doctor：EXT base `8d17d3b1` 为 `0 errors / 0 warnings`；隔离候选提交后按预期因 v2 active packet 仍 pinned 到 EXT base 而 STOP，未修改 authority manifest。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 安全门禁 | tenantless draft/confirm focused tests | PASS |
| 回归 | backend/frontend/build/doctor | PASS |
| W08 人工验收 | records/ approved JSON | BLOCKED |

## 声明状态

- `VERIFIED_PARTIAL`
