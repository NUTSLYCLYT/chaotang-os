# 任务：feat-r0-w02-shared-contract-implementation-20260721-20260721

## 任务 1：taxonomy + 5 个 Pydantic 契约

- 目标：OQ-03 冻结值落成代码 + 交付 5 个 W02 packet card 产物
- 前置条件：execution-authority v2 对 R0-W02 返回 GO
- 输入：OQ-03 taxonomy 提案（已获批）+ amendment §6 的 7 条 REQ 定义
- 输出：`contract_taxonomy.py` + `mission_contract.py`（含 digest 计算）+ `contract_support.py`
  + `contract_decision.py` + `contract_lineage.py` + `contract_capability.py` +
  `mission_confirmation.py`
- 涉及文件：`backend/src/contract_taxonomy.py`、`backend/src/contracts/*.py`（6 个新文件）
- 状态 / 数据变化：纯新增模块，无既有文件修改
- 验证命令与证据：见 `ci_result/ci_summary.md`
- 回滚边界：删除新文件即可，无依赖方（W02 是第一个消费者）
- 完成定义：7 个 REQ 各自正例+负例测试全绿

## 任务 2：FastAPI 路由 + OpenAPI 暴露

- 目标：让 `app.openapi()` 真实收录 5 个新契约（REQ-004 退出证据）
- 前置条件：任务 1 完成
- 输入：`web/routers/auth.py` 的 `response_model=` 约定（照抄，不用 `ok()/fail()` 信封）
- 输出：5 条 `/api/contracts/*` 路由 + `web/schemas/contracts.py` 请求体
- 涉及文件：`backend/web/routers/contracts.py`、`backend/web/schemas/contracts.py`、
  `backend/web/main.py`（挂载，2 行新增）
- 状态 / 数据变化：新增路由；main.py 只加 import + include_router 各一行
- 验证命令与证据：`test_contracts_router_openapi.py`
- 回滚边界：从 main.py 摘除挂载两行 + 删除新文件
- 完成定义：OpenAPI 收录 5 个 schema + 5 条路径

## 任务 3：可移植性修复 + OpenAPI/TS 快照重生成

- 目标：交付 W02 的退出证据快照
- 前置条件：任务 1、2 完成
- 输入：既有 `scripts/api-contract-stability.mjs`（发现硬编码 `python` 在此机器跑不通）
- 输出：`frontend/src/lib/contracts/backend-openapi-2026-07-21.d.ts`
- 涉及文件：`scripts/api-contract-stability.mjs`（修复）、`frontend/src/lib/contracts/backend-openapi-2026-07-21.d.ts`（新增）
- 状态 / 数据变化：脚本修复是纯增强（优先 python3，ENOENT 退回 python），不改变原有行为
- 验证命令与证据：`node scripts/api-contract-stability.mjs` 成功产出，`.d.ts` 含 14 处新契约名命中
- 回滚边界：脚本改动可 revert；快照文件是生成产物，删除后重跑脚本可复现
- 完成定义：新契约类型出现在生成的 `.d.ts` 里
