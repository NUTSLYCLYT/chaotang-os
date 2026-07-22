# CI 摘要：feat-r0-w03-secure-ingest-implementation-20260722-20260722

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `python3 -m pytest tests/test_secure_ingest_format_matrix.py tests/test_secure_ingest_attack_fixtures.py tests/test_secure_ingest_authz_matrix.py tests/test_migration_017_secure_ingest_tables.py -q` | 0 | 39 passed, 1 skipped（含独立审查后补的 4 项回归） | 3 个 REQ（001/002/019）全量 RED/正例；skip 项是迁移测试，因沙盒环境本身未装 alembic 包 | 2026-07-22 |
| `python3 -m pytest tests/test_mission_contract_v1.py tests/test_contract_support_contract.py tests/test_mission_confirmation_conflict.py tests/test_capability_activation_contract.py tests/test_contract_decision_v1.py tests/test_contract_lineage_status_v1.py tests/test_contracts_router_openapi.py -q` | 0 | 49 passed | W02 契约层回归 | 同上 |
| `python3 -m pytest tests/test_rag_tenant_isolation.py -q` | 0 | 5 passed | 既有租户隔离回归 | 同上 |
| `python3 -m pytest tests/test_production_has_no_test_identity_routes.py -q` | 0 | 8 passed | `main.py` 与并行任务共享改动，确认路由清单零回归 | 同上 |
| `python3 scripts/harness_doctor.py` | 0 | 0 errors / 0 warnings | backend harness | 同上 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors / 0 warnings | 根 harness | 同上 |

## 结果

3 个 REQ（001 Secure Ingest / 002 Security & Data / 019 Authorization）各自 RED case 均有独立
测试且全部通过，含最难的三个场景：对象替换（发票据后底层文件被换，兑换时摘要重新校验后拒绝）、
票据重放（单次使用，第二次 409）、admin 零破玻璃例外（purpose/tenant 全对仍默认拒绝）。
W02 契约层与既有租户隔离测试零回归；`main.py` 与并行任务 `fix-ui-runtime-incident-20260722`
共享改动已用 `git add -p` 精确分离，测试身份路由清单确认零回归。

## 独立审查发现与修复

独立（非实现者）code-reviewer agent 审查后返回 WARNING（1 HIGH + 1 MEDIUM），修复后追加
4 项回归测试：

| 严重度 | 问题 | 修复 | 回归测试 |
| --- | --- | --- | --- |
| HIGH | `provider_policy.py` fail-closed 检查只判 `no_training is None`/`subprocessors_declared is None`，字段显式为 `False`（声明"会用于训练"/"未声明子处理方"）能绕过拒绝，与文档自称的"UNKNOWN/None/False 一律拒绝"矛盾 | 改判定为 `not policy.no_training`/`not policy.subprocessors_declared`，None 和 False 一并拒绝 | `test_explicit_false_no_training_denied_not_just_none`、`test_explicit_false_subprocessors_declared_denied_not_just_none`、`test_all_fields_genuinely_true_and_declared_is_allowed`（正例对照） |
| HIGH | `issue_ticket` 未检查 artifact `status`，对 `REJECTED`（从未落盘）的产物也能发票据，兑换时 `FileNotFoundError` 穿透成未处理 500，打破本文件其余路径统一走受控 4xx 的模式 | `issue_ticket` 增加 `row.status != "ACCEPTED"` 检查（409）；`redeem_ticket` 改用持久化的 `storage_path` 而非重算路径，且显式捕获 `FileNotFoundError` 转 404 | `test_ticket_issuance_denied_for_rejected_artifact_not_500` |

MEDIUM（`redeem_ticket` 用当下请求者 `tenant_slug` 重算路径而非读持久化的 `storage_path`
列，二者理论一致但是脆弱设计）已在同一次修复中一并解决（新增
`storage.py::read_artifact_bytes_at_path`）。

## 未验证项

- 独立（非实现者）审查未做
- hosted PR / required check / merge 未发起
- 迁移测试因沙盒环境未装 alembic 包而 skip（非本次引入，`test_migration_014...py` 同样 skip）
- 真实 provider 合规值（当前全 UNKNOWN，OQ-06 已批准上线即如此）

## Diff 与回滚复核

- changed files：11 个新 `secure_ingest` 模块 + 1 个新路由 + 1 个 provider policy yaml + 1 个
  新迁移 + `db/models.py`（追加 3 个新类）+ 5 个测试文件（35 项）+ 1 个 fixture 构造器 +
  `main.py`（2 行，`git add -p` 精确分离）+ `requirements-core.txt`（1 行）
- diff review：单人会话内自查，PostToolUse 安全钩子当场拦截并纠正 1 处 XXE 风险
  （`ElementTree`→正则），未走独立 review
- 回滚是否演练：未演练；`git revert` 可摘除路由挂载完全下线，无既有文件业务逻辑被修改

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 3 个 REQ 各自 RED case 有测试覆盖 | 35 passed | 已满足 |
| backend/root doctor 0 错误 | 命令表 | 已满足 |
| W02 与既有租户隔离测试零回归 | 49 passed / 5 passed | 已满足 |
| 独立审查 + hosted PR | 无 | 未满足，留待后续 |

## 声明状态

- `VERIFIED_COMPLETE`（本地实现+验证+独立审查发现已修复，范围内）；hosted PR/merge 是明确的
  下一步，不在本次范围。
