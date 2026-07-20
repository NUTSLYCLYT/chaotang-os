# CI 摘要：fix-r0-execution-authority-20260720

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `node --test scripts/execution-authority.nodetest.mjs`（RED 1） | 1 | 缺 `scripts/lib/execution-authority.mjs` | 主线缺少 resolver | 2026-07-20 本会话 |
| 同命令（RED 2） | 1 | 缺受管文档语义 validator export | 根入口/R0 PRD 旁路 | 2026-07-20 本会话 |
| 同命令（RED 3） | 1 | 缺 symlink path reader export | 权威输入路径旁路 | 2026-07-20 本会话 |
| `node scripts/execution-authority.nodetest.mjs` | 0 | 9/9 GREEN | resolver/schema/inventory/consumer/CLI/损坏 manifest/路径负例 | 2026-07-20 本会话 |
| `node scripts/execution-authority.mjs --check` | 0 | `VALID_INACTIVE_GUARD` | 当前真实 manifest | 2026-07-20 本会话 |
| `node scripts/execution-authority.mjs --authorize` | 2 | 预期 `STOP` | 施工 fail closed | 2026-07-20 本会话 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors / 0 warnings | 根 harness 与委托 doctor | 2026-07-20 本会话 |
| `cd frontend && pnpm harness:doctor` | 0 | 0 errors / 0 warnings | 前端边界无回归 | 2026-07-20 本会话 |
| `cd backend && python3 scripts/harness_doctor.py` | 0 | 0 errors / 0 warnings | 后端 harness 无回归 | 2026-07-20 本会话 |
| `git diff --cached --check` | 0 | PASS | staged diff whitespace/冲突标记 | 2026-07-20 本会话 |

## 结果

当前为 `IMPLEMENTED_UNVERIFIED`。实现与定向门已绿，尚需完整语法/diff 检查、三层独立命令和 Claude Code exact-HEAD 审查。

## 未验证项

- 托管平台 required check/非提交者强制复核未验证。
- Claude Code 三路审查尚未运行。
- 尚未创建候选提交，因此没有最终 H/tree/diff digest。

## Diff 与回滚复核

- changed files：仅根治理、scripts 与本 change，最终以 `git diff --name-status` 为准。
- diff review：待 Claude Code 三路审查。
- 回滚是否演练：未演练；设计为整包 revert，无运行时数据迁移。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| v1 固定 inactive/STOP | Node suite、CLI | PASS |
| 全计划 inventory/digest | Node suite、root doctor | PASS |
| 根入口/R0 PRD 旁路阻断 | Node suite | PASS |
| 三层 doctor | 根、前端、后端独立命令均 0 errors / 0 warnings | PASS |
| Claude Code exact-HEAD review | 待生成 | PENDING |

## 声明状态

- `VERIFIED_PARTIAL`
