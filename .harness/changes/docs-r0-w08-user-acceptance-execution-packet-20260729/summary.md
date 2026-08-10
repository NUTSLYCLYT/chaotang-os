# 变更摘要：docs-r0-w08-user-acceptance-execution-packet-20260729

> 执行授权：`R0-W08_ACTIVE_GOVERNANCE_AND_EVIDENCE_PREP`
> 本目录只记录 W08 用户验收执行 Packet；不创建最终用户记录，不关闭 W08，不宣称生产部署。

| 字段 | 值 |
| --- | --- |
| Change ID | docs-r0-w08-user-acceptance-execution-packet-20260729 |
| 类型 | docs |
| 状态 | VERIFIED_PARTIAL / BLOCKED_ON_REAL_USER_RECORDS |
| Owner | EXT Master Governance / W08 Product Acceptance |
| 创建日期 | 20260729 |
| Base HEAD | `bdea736e015b46c1209d74530d436a68583f0a97` |
| Base tree | `24d4f3759a0bfec4ca39e32237177731a5b45e06` |

## 范围

- 主线：R0-W08 Product Acceptance Hardening。
- 目标：把 W08 从机器验收通过推进到真实非开发用户验收执行阶段。
- 文件：
  - `.harness/changes/docs-r0-w08-user-acceptance-execution-packet-20260729/`
  - `.harness/changes/docs-r0-w08-user-acceptance-execution-packet-20260729/session_execution_queue.md`
  - `.harness/changes/docs-r0-w08-user-acceptance-execution-packet-20260729/draft_user_acceptance_record.json`
  - 只引用既有 `backend/harness/chaotang-true-loop/product_acceptance/user_acceptance/` 材料，不修改产品代码。
- 验证：
  - `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08`
  - `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py`
  - `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --closeout-preflight`

## 当前判定

- W08 黄金合同矩阵：`36/36`，PASS。
- W08 real-backend browser flow：harness 记录 `10/10`，PASS；本轮 fresh smoke 已复跑 batch2/3/4 共 `9/9`，PASS。
- W08 closeout：BLOCKED。
- 阻塞原因：`backend/harness/chaotang-true-loop/product_acceptance/user_acceptance/records/` 下尚无唯一一份 approved 真实用户验收 JSON。

## 非目标

- 不新增页面。
- 不新增 Agent。
- 不修改产品运行代码。
- 不 push。
- 不部署。
- 不迁移数据库。
- 不操作 3050。
- 不用 fixture、开发者自测或截图替代真实非开发用户验收。
- 不把本 Packet 内的 draft JSON 放进 `records/` 作为 closeout 证据。
