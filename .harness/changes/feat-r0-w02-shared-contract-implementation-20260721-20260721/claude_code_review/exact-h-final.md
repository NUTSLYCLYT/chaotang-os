# Claude Code Exact-H Independent Review — R0-W02 shared contract implementation

| Identity | Value |
| --- | --- |
| Base B | `3f297c49bb955068ec4b3970667aa510317bcb96` |
| Candidate H | `3caa0a51cf02e88126212c19a7239326533cc5e2` |
| Tree | `cb0a40b9995a0de3e43b09ee2ad68dac77f662f7` |
| Canonical binary diff SHA-256 | `76a3f12dc3856e75e1eb10b892433d71ffd6ad27ba5e8e779222fd84654b901f` |
| Scope | 2 commits（`529b267e` 治理开工闸 + `3caa0a51` W02 实现），25 文件 |
| Reviewer | Claude Code，独立（非实现者）会话，只读 |

## Verdict

| Lane | Verdict | Unresolved HIGH | Unresolved MEDIUM |
| --- | --- | ---: | ---: |
| Authority（治理闸正确性） | GO | 0 | 0 |
| Correctness（7 个 REQ RED case 保真度） | GO | 0 | 1 |
| Git-Evidence | GO | 0 | 0 |

Combined verdict: **GO**（0 HIGH / 1 MEDIUM，判定不阻塞合并）。

## 独立验证（重新跑，不采信实现方声明）

- `node --test scripts/execution-authority-v2.nodetest.mjs` → 26/26 pass
- `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W02` → GO
- `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W01` → STOP/WORK_PACKAGE_MISMATCH
- `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W03` → STOP/BLOCKED_DEPENDENCY
- `node scripts/harness-doctor.mjs` → 0 errors
- `python3 scripts/harness_doctor.py`（backend）→ 0 errors
- 7 个 REQ 测试文件 + OpenAPI 测试 → 49 passed

## 对抗式核验（主动尝试破坏 fail-closed 保证，未能破坏）

1. 尝试让非 `activeWorkPackage` 的包拿到 GO——`workPackage !== manifest.activeWorkPackage` 这道
   最终关卡未被本次改动削弱，仍无条件拦截。
2. 独立核实 `effectiveBase` bug 说法——`project-harness.json` 的 `amendmentGovernance.effectiveBase`
   确认未被本次 diff 改动、仍是冻结的 G0 锚点；新 manifest 的 `effectiveBase` 已合法前进到 W02 基线。
   用**旧逻辑**推演，会对这次合法的 W02 授权产生假 `EFFECTIVE_BASE_MISMATCH`——独立证实这个 bug
   是真的，修复是必要的，不是实现方自说自话。
3. `CapabilityGrantV1` 试图构造 `NOT_ACTIVATED`+非零权限——`model_validator(mode="after")` 无逃逸
   路径，代码里没有任何地方用 `model_construct()` 绕过。
4. `ContractLineageStatusV1` 确认 `status` 字段字面不存在（非同义反复的结构断言），交叉规则真实拦截。
5. taxonomy 哨兵设计——陌生原始字符串在 schema 层报错，已知超范围走 DECLINED 结构化拒答，两条路径
   都不静默放行。
6. 范围蔓延扫描：7 个新文件共 694 行，grep 未发现 LLM 调用/HTTP 出站/`/dadian` 引用。

## Findings

**MEDIUM-1**：`_MISSION_DRAFT_STORE`/`_MISSION_LINEAGE_STORE`（`backend/web/routers/contracts.py:38-39`）
是进程内 dict，只按 `mission_contract_id` 索引，无租户/owner 隔离——任何已认证用户猜到/观察到别人
的 `mission_contract_id` 就能读写。路由已挂进真实 `app`（非仅测试可达）。router docstring 已诚实
标注这是非持久化 schema-proving stub、真实租户隔离是 W03（REQ-019）职责，且这个模式跟仓库既有
`web/routers/drafts.py` 的约定一致，不是本次引入的新退化。**不阻塞本次合并，但要记进 W03 前置
依赖清单，不能漏掉**。

## Non-authorization statement

本审查只确认 H 的实现质量、fail-closed 行为与既有代码约定一致性，不批准 R0-W03 及以后、真实客户
数据或上线。这是对已获批 W02 range 内实现工作的复核，不是新的范围批准。
