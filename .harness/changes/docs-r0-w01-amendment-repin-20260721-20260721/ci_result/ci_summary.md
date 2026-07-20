# CI 摘要：docs-r0-w01-amendment-repin-20260721-20260721

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `node --test scripts/r0-amendment-check.nodetest.mjs`（RED） | 1 | 6 pass / 2 fail，符合预期 | 旧 checker 缺少 re-pin/base/Owner 契约 | 2026-07-21，本地终端 |
| `node --test scripts/r0-amendment-check.nodetest.mjs`（缺失 manifest base RED） | 1 | 7 pass / 1 fail，符合预期 | 证明未登记 base 曾被错误放行 | 2026-07-21，本地终端 |
| `node --test scripts/r0-amendment-check.nodetest.mjs`（GREEN） | 0 | 8/8 pass | base、Owner、映射、CLI 与 fail-closed 负例 | 2026-07-21，本地终端 |
| `node scripts/r0-amendment-check.mjs` | 0 | `VALID_REPINNED_AMENDMENT` | digest=`214528...a3078`、22/22、9/9、11/11 | 2026-07-21，本地终端 |
| `node --test scripts/execution-authority.nodetest.mjs` | 0 | 9/9 pass | inactive authority 回归 | 2026-07-21，本地终端 |
| `node scripts/execution-authority.mjs --authorize` | 2 | 预期 `STOP / AMENDMENT_APPROVAL_REQUIRED` | 证明没有越权启动 runtime | 2026-07-21，本地终端 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors / 0 warnings | 三层架构、manifest 与 delegated doctors | 2026-07-21，本地终端 |
| `git diff --check` | 0 | clean | whitespace/static diff | 2026-07-21，本地终端 |
| credential pattern scan of changed content | 0 | no credential-like additions | secrets hygiene | 2026-07-21，本地终端 |

## 结果

本地 GREEN 与根级回归通过；authority 仍按设计 fail closed。尚不能称候选已批准或产品已上线。

## 未验证项

- exact-H Claude Code 三路只读复审
- 托管门禁与 Product Owner 精确批准

## Diff 与回滚复核

- changed files：13（9 modified + 4 new），全部位于根级治理、checker/test/doctor；无 frontend/backend runtime 文件
- diff review：本地逐文件复核完成，无范围外修改；旧测试转换 helper 已删除，测试直接读取 canonical bytes
- 回滚是否演练：不适用；仅治理文件，回滚方案为 revert

前端 build、浏览器 E2E、后端业务测试均为 N/A：本 change 没有修改对应 runtime，且它们不能证明治理重钉正确。既有产品红灯继续保留，不能被本地 root GREEN 覆盖。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| stop-ship RED | 6 pass / 2 fail | PASS |
| re-pin GREEN | amendment 8/8、CLI valid、doctor 0/0 | PASS |
| authority 保持 STOP | authority 9/9；authorize exit 2 | PASS |
| exact-H 独立复审 | 待执行 | PENDING |

## 声明状态

- `DRAFT / VERIFIED_PARTIAL / VERIFIED_COMPLETE / BLOCKED`：VERIFIED_PARTIAL（本地完成，待 exact-H 独立复审与 Owner 批准）
