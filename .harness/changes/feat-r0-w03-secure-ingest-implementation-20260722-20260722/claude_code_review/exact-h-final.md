# Claude Code Exact-H Independent Review — R0-W03 secure ingest implementation

| Identity | Value |
| --- | --- |
| Base B | `50207b3c258c72f4326d78bc0933e207084e1a4d` |
| Candidate H | `6688e89b7baa64b2126a8e2fd39c6b285375b2ae` |
| Tree | `eb1cfe2a1cc1951738344b95902307d783de16c1` |
| Canonical diff SHA-256（`git diff B..H`） | `1160a44f1b483df39fff987ef1484fabae95d4f429c9772efa7dbb0b6bbfb789` |
| Scope | 2 commits（`80572fe6` 实现 + `6688e89b` 独立审查发现修复），27 文件，1938 insertions |
| Reviewer | Claude Code，独立（非实现者）会话，`code-reviewer` agent，只读 + 独立复测 |

## Verdict

| Lane | Verdict | Unresolved HIGH | Unresolved MEDIUM |
| --- | --- | ---: | ---: |
| Correctness（3 个 REQ RED case 保真度） | GO | 0 | 0 |
| Fail-closed guarantees（tenant/admin/provider/ticket） | GO | 0 | 0 |
| Git-Evidence / Scope | GO | 0 | 0 |

Combined verdict: **GO**（首轮 1 HIGH + 1 HIGH-adjacent + 1 MEDIUM，全部已在 `6688e89b` 修复并补
回归测试；复测确认 0 未解决项）。

## 独立验证（重新跑，不采信实现方声明）

- `cd backend && python3 -m pytest tests/test_secure_ingest_format_matrix.py tests/test_secure_ingest_attack_fixtures.py tests/test_secure_ingest_authz_matrix.py tests/test_migration_017_secure_ingest_tables.py -v` → 39 passed, 1 skipped（skip 为沙盒缺 alembic 包，非本次引入，与 `test_migration_014...py` 同款）
- `python3 -m pytest tests/test_mission_contract_v1.py tests/test_contract_support_contract.py tests/test_mission_confirmation_conflict.py tests/test_capability_activation_contract.py tests/test_contract_decision_v1.py tests/test_contract_lineage_status_v1.py tests/test_contracts_router_openapi.py tests/test_rag_tenant_isolation.py tests/test_production_has_no_test_identity_routes.py -q` → 62 passed（W02 契约层 + 既有租户隔离 + 测试身份路由清单，均零回归）
- `python3 scripts/harness_doctor.py` → 0 errors, 0 warnings
- `node scripts/harness-doctor.mjs`（根目录）→ 0 errors, 0 warnings

## 对抗式核验（主动尝试破坏 fail-closed 保证）

1. 跨租户查询/发票/兑换——三处均按 `tenant_id` 过滤，`_resolve_tenant()` 只信 `CurrentUser`，
   未见任何从 body/query 读 tenant 的路径。跨租户状态查询确认 404（不是 403，不泄漏存在性）。
2. admin 零破玻璃——`purpose_authz.py` 的 `role == "admin"` 分支无条件拒绝，路由层
   `test_admin_denied_ticket_issuance_by_default` 复现为 403 `INTERNAL_OPS_DEFAULT_DENY`。
3. provider policy fail-closed——首轮发现真实漏洞：`no_training`/`subprocessors_declared`
   显式 `False`（而非 `None`）能绕过检查，与模块文档自称的"UNKNOWN/None/False 一律拒绝"矛盾。
   已修复为 `not policy.xxx` 判断，`None`/`False` 一并拒绝；正例对照测试确认真正齐全声明时
   仍能放行（未把拒绝逻辑改过头）。
4. 下载票据对象替换防线——兑换时重新读盘算摘要，故意换底层字节后确认 409。
5. 票据重放——单次使用，第二次兑换确认 409。
6. REJECTED artifact 领票——首轮发现真实 bug：`issue_ticket` 未查 `status`，对从未落盘的
   REJECTED 产物也发票，兑换时 `FileNotFoundError` 穿透成未处理 500，打破本路由其余路径统一
   受控 4xx 的模式。已修复：`issue_ticket` 增加 `status != "ACCEPTED"` 检查（409）；
   `redeem_ticket` 改读持久化 `storage_path` 而非重算路径，且显式捕获 `FileNotFoundError` 转 404。
7. 注入扫描原文落库/落日志——`grep` 确认 `src/secure_ingest/` 无 `print`/`logger` 调用，
   DB 只存 `injection_flag_categories_json`（类别名列表），不存 `extracted_text`。
8. zip-bomb/宏检测是否真被路由使用——确认 `reject_reason` 分支真实读取
   `structure.macro_detected`/`zip_bomb_suspected` 并据此拒收，不是算了不用的死代码。
9. 迁移文件字段与 ORM 逐字段核对——3 张新表列名/类型/nullable/default/索引全部一致
   （迁移在此沙盒无法实跑，因 alembic 包未装，静态核对为准）。
10. 范围蔓延扫描——`git diff --stat` 27 文件精确匹配声明范围；`main.py` 的 diff 仅为
    2 行挂载（import + include_router），未混入并行任务 `fix-ui-runtime-incident-20260722`
    的其余改动。

## Findings

首轮独立 code-reviewer agent 审查发现 2 项 HIGH + 1 项 MEDIUM，均已在本 H 内修复：

- **HIGH-1（已修复）**：`provider_policy.py` fail-closed 判定漏判显式 `False`。
- **HIGH-2（已修复）**：`issue_ticket` 未检查 artifact status，REJECTED 产物领票兑换时 500。
- **MEDIUM-1（已修复，与 HIGH-2 同根因）**：`redeem_ticket` 重算路径而非读持久化
  `storage_path` 列，导致该列成为死数据、脆弱设计。

复测未发现新的未解决项。

## Non-authorization statement

本审查只确认 H 的实现质量、fail-closed 行为与既有代码约定一致性，不批准 R0-W04 及以后、真实
客户数据或上线。这是对已获批 W03 range 内实现工作的复核，不是新的范围批准。
