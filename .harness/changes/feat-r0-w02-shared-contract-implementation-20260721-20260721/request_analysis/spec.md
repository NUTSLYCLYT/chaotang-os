# 规格说明：feat-r0-w02-shared-contract-implementation-20260721-20260721

## 背景

R0-W02 已获 execution-authority v2 授权（GO），Product Owner 批准 R0-W02 实现、OQ-03
taxonomy 冻结（见 `.harness/changes/docs-r0-w02-shared-contract-approval-20260721-20260721/`）。
本变更交付 W02 packet card 产物：`MissionContractV1`/`ContractSupportDecisionV1`/
`ContractDecisionV1`/正交状态与 lineage 契约，覆盖 7 个 REQ（003/004/005/006/007/012/017），
后端 Pydantic/OpenAPI 为跨端契约事实源。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 7 个 REQ 各自的 RED case 均有对应负例测试且全部通过 | `ci_result/ci_summary.md` 命令表 | 已验证 | 否 |
| 已确认事实 | OpenAPI 收录全部 5 个新 schema + 5 条新路径 | `test_contracts_router_openapi.py` | 已验证 | 否 |
| 已确认事实 | `api-contract-stability.mjs` 硬编码 `python`（此机器只有 `python3`）导致脚本原生跑不通 | 已修复：优先 `python3`，ENOENT 时退回 `python`；不影响原逻辑 | 已验证 | 否 |
| 推测 | 无 | 不适用 | 不适用 | 不适用 |
| 未知问题 | 尚未做独立（非实现者）审查，未发 hosted PR | 不适用 | 待用户/后续会话 | 是（阻塞 MERGED_AND_VERIFIED，不阻塞本地实现完成度） |

## 数据流与调用链

```
POST /api/contracts/support/evaluate  → evaluate_support() → ContractSupportDecisionV1
POST /api/contracts/mission/draft     → compute_mission_content_digest() 服务端重算 → 落草稿桩
POST /api/contracts/mission/{id}/confirm → confirm_mission() revision+digest 比对 → 200/409
POST /api/contracts/capability/activate → activate_capabilities() → list[CapabilityGrantV1]
POST /api/contracts/decision          → ContractDecisionV1 契约往返 stub
```
草稿/lineage 存储是进程内 dict（W02 schema-proving stub，非持久化，W04 提供真实单一事实源）。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `MissionContractV1`/`ContractSupportDecisionV1`/`ContractDecisionV1`/`ContractLineageStatusV1`/`CapabilityGrantV1` | `backend/src/contracts/*.py`（Pydantic，唯一事实源） | `app.openapi()` → `frontend/src/lib/contracts/backend-openapi-2026-07-21.d.ts`（生成，前端只消费不手写） | 49 项 pytest + OpenAPI 收录断言 |
| `contract_taxonomy.py` 五个 Literal 枚举 | 本变更，OQ-03 冻结值 | 上述 5 个契约 | Literal + `extra="forbid"` 结构性 fail-closed |

## 范围

7 个 REQ 对应的 Pydantic 契约 + FastAPI 路由（`/api/contracts/*`）+ OpenAPI/TS 快照重生成 +
RED 测试。

## 非目标

不做真实摄取/风控/LLM 逻辑（W03/W05）；不建 Mission 持久化单一事实源（W04，REQ-008 边界）；
不建完整能力目录（W03/W05）；不碰前端 UI（W07）；不新增 BFF 或 `/reports/[id]`；不碰 `/dadian`。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| `constraints`/`prohibited_actions` 等字段缺失 | Pydantic ValidationError，不静默默认空列表 | `test_missing_key_rejected_not_silently_defaulted` |
| 四维度任一缺失或超范围 | 结构化 DECLINED，累计所有命中原因 | `test_contract_support_contract.py` 全量 |
| 非硬需求能力 / 未激活能力访问 | 类型层面无法构造，非运行时检查 | `test_capability_activation_contract.py` |
| revision/digest 任一不匹配确认请求 | 409 + 冲突详情 | `test_router_returns_http_409_on_conflict` |
| decision_status=DECIDED 但 mission 未 CONFIRMED | ValidationError | `test_decided_without_confirmed_mission_rejected` |

## 风险与回滚边界

纯新增模块 + 一个新路由 + 两处基础设施小修复（脚本可移植性、doctor 动态化，均在 W02 前置
governance 提交里已完成）。回滚：`git revert` 本 commit 即可，新路由从 `main.py` 摘除、新文件
删除，不影响任何既有路由/契约（无修改任何既有文件的业务逻辑，只新增 import 和 include_router
两行）。

## 计划确认记录

- 批准人：lyt（通过 R0-W02 governance 批准 + AskUserQuestion 确认设计细节）
- 批准日期：2026-07-21
- 批准范围：R0-W02 实现（本变更全部内容）
- 明确未批准：R0-W03 及以后

## 验收标准

7 个 REQ 各自 RED case 有测试覆盖；OpenAPI 收录 5 个新 schema/路径；backend/root doctor 0 错误；
v1/v2 execution-authority 与既有测试零回归。

## 验证计划

见 `ci_result/ci_summary.md`。
