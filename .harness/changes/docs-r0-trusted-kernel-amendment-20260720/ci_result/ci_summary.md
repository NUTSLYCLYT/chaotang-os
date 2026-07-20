# CI 摘要：docs-r0-trusted-kernel-amendment-20260720

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 时间 |
| --- | ---: | --- | --- | --- |
| `node scripts/r0-amendment-check.nodetest.mjs`（沙箱外只读；子进程 CLI 测试） | 0 | 7/7 PASS | 真实 amendment、缺失/重复 REQ/gate/M、语义反转、跨表 Owner、source digest、CLI 0/1/64/66 | 2026-07-20 |
| `node scripts/r0-amendment-check.mjs` | 0 | `22/22_UNIQUE`、`9/9_OWNED`、`11/11_DISPOSED`、`sourceDigest=expectedSourceDigest=9f0d7a5267e9bcfd64a73d4862b3a56eef4aae2d591dae3ad7850f7742daca9a`、`canAuthorizeRuntime=false` | canonical amendment 精确字节与 manifest candidate digest 比较、REQ/Gate/M、批准与 STOP 控制 | 2026-07-20 |
| `node scripts/execution-authority.mjs --authorize` | 2 | `STOP / AMENDMENT_APPROVAL_REQUIRED` | 草案未越权激活施工 | 2026-07-20 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors / 0 warnings | 根、前端、后端三层 harness | 2026-07-20 |
| `git diff --check` | 0 | PASS | 文档格式 | 2026-07-20 |

## 结果

修正案草案已机器验证：22 条 R0 REQ、9 条退出门与 11 条旧 M 处置无缺失、重复或错 Owner，§5/§6 跨表一致；checker 绑定 canonical 文件精确字节且不能授权 runtime。v1 authority 仍 fail closed。第一、第二候选的 Claude Code 审查发现需关闭项；修订后 exact-H 仍待冻结和复审。

## 未验证项

- G0 hosted PR、required check、非提交者复核与合入。
- G0 合入后的新 `origin/feature-chaotang-ext` effective base。
- amendment exact digest 与 Product Owner exact 批准。
- execution-authority v2；它属于未来 W01，不在本 docs change 中实现。
- 前端 core 17 项、4 个 evaluator、flow validation 3 errors、prod doctor STOP 等既有红灯未修复；本变更只记录它们。
- 所有 W02–W09 runtime、数据、安全、浏览器与发布证据均未实施。

## Diff 与回滚复核

- changed files：只允许 `.harness/changes/docs-r0-trusted-kernel-amendment-20260720/`、`scripts/r0-amendment-check.mjs`、`scripts/r0-amendment-check.nodetest.mjs`、`scripts/lib/r0-amendment-check.mjs`、`scripts/harness-doctor.mjs`、`.harness/manifest/project-harness.json`、`.harness/wiki/verification-matrix.md`。
- diff review：待候选提交和 Claude Code 三路审查。
- 回滚：纯文档 revert；不涉及运行数据。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 22/22 唯一映射 | committed validator、`amendment.md` §6 | PASS |
| 9/9 退出门唯一度量 | committed validator、`amendment.md` §7 | PASS |
| 11/11 旧 M 唯一处置 | committed validator、`amendment.md` §5.1 | PASS |
| checker digest 比较/路径/CLI fail closed | CLI 正反例与 manifest/doctor 登记 | PASS |
| W00–W09 依赖/RED/退出/回滚 | `amendment.md` §5/§8 | PASS |
| 第一 golden slice 与页面边界 | `amendment.md` §1/§3 | PASS |
| 非目标与历史 source-only | `amendment.md` §9 | PASS |
| v1 保持 STOP | CLI exit 2 | PASS |
| exact-H Claude Code review | 待提交 | PENDING |
| Owner exact approval | G0 merge 后 | BLOCKED_EXTERNAL |

## 声明状态

- `DRAFT_VERIFIED_LOCAL`
- `NOT_APPROVED`
- `NOT_EXECUTION_AUTHORITY`
