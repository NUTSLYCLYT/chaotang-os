# CI 摘要：chore-professional-agent-k0-ext-convergence-20260810

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` | 0 | GO / APPROVED_WORK_PACKAGE | 修改前及收窄后 current EXT 权威 | 本地控制台，2026-08-10 |
| `node --test scripts/professional-agent-matrix.nodetest.mjs` | 0 | 12/12 PASS | Draft 2020-12、schema 摘要、路径、来源、覆盖与篡改反例 | 本地控制台，2026-08-10 |
| `node scripts/professional-agent-matrix.mjs --check` | 0 | PASS：8 assets / 6 verified / 2 partial | current EXT 路径、35 个设计、71 个 Prompt | 本地控制台，2026-08-10 |
| `backend/.venv/bin/python -m pytest -q <12 个矩阵引用测试文件>` | 0 | 93 passed / 1 dependency deprecation warning | 6 个 VERIFIED 能力域的现有行为 | 临时环境，本地控制台，2026-08-10 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors / 0 warnings | 根项目与委派门禁 | 本地控制台，2026-08-10 |
| `cd backend && python3 scripts/harness_doctor.py` | 0 | 0 errors / 0 warnings | 后端 harness 架构 | 本地控制台，2026-08-10 |
| `git diff --check` | 0 | PASS | 补丁格式 | 本地控制台，2026-08-10 |
| `node scripts/ext-branch-convergence.mjs --check` | 1 | FAIL：2 个既存 source ref 已移动 | 99 分支冻结台账完整性 | 本地控制台，2026-08-10 |

## 结果

K0 当前候选的结构、来源绑定、路径、计数和引用能力测试通过。太医只登记为“诚实不可用”兼容边界；钦天监只登记离线契约与信号能力，不声明旧兼容 API 已就绪。

## 未验证项

- 99 分支台账因 `codex/professional-agent-overlay-clean` 与 `docs/r0-trusted-kernel-amendment-20260720` 在冻结后移动而失败；与本 Packet 无因果关系，必须用 audited successor 记录修复。
- 根 `project-harness.json` 与 root doctor 登记尚未执行，因为两者属于 R0-W08 钉住的权威输入；需后续 exact-H authority Packet，不能在当前候选里静默修改。
- Python 临时环境已删除；1 条 Starlette/httpx 依赖弃用警告未影响 93 个测试。

## Diff 与回滚复核

- changed files：仅本 change 记录、专业 Agent matrix schema/manifest/wiki、只读检查器及 Node 测试。
- diff review：不含 `backend/app`、产品 runtime、API、前端、数据、provider、旧 worktree 或根权威钉住文件。
- 回滚是否演练：未执行破坏性回滚；候选为纯新增文件，可由单提交 revert。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 旧 K0 来源可追溯 | exact donor + EXT convergence cross-check | PASS |
| 发布 schema 不可静默弱化 | Draft 2020-12 + canonical schema SHA-256 + mutation tests | PASS |
| current EXT 路径真实存在 | CLI path/lstat checks | PASS |
| VERIFIED 不可无测试或占位命令 | 负向测试 | PASS |
| 35 design / 71 prompt 数量冻结 | recursive assertions | PASS |
| 引用能力行为不回归 | 93 pytest | PASS |
| 根 manifest/doctor 强制登记 | exact-H authority successor | PENDING |
| 99 台账恢复全绿 | audited successor refs | PENDING |

## 声明状态

- `DRAFT / VERIFIED_PARTIAL / VERIFIED_COMPLETE / BLOCKED`：`VERIFIED_PARTIAL`（候选本身通过，根登记与 99 台账继承记录待后续 Packet）
