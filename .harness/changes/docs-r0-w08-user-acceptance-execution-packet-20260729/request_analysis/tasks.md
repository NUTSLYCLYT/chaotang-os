# 任务：docs-r0-w08-user-acceptance-execution-packet-20260729

## 任务 1：确认 W08 当前 gate 状态

- 目标：确认 W08 已进入用户验收阶段，而不是继续扩大功能范围。
- 前置条件：`R0-W08` authority 返回 GO。
- 输入：当前 EXT HEAD、W08 golden matrix、browser flow evidence。
- 输出：当前状态为 `VERIFIED_PARTIAL / BLOCKED_ON_REAL_USER_RECORDS`。
- 涉及文件：本 Packet 文档。
- 状态 / 数据变化：无产品数据变化。
- 验证命令与证据：
  - `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08`
  - `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py`
- 回滚边界：删除本 Packet 目录。
- 完成定义：authority GO、黄金合同 PASS、closeout blocker 清楚。

## 任务 2：执行 5 名非开发用户 sessions

- 目标：收集最终 W08 human acceptance evidence。
- 前置条件：3002/8081 本地可用，且 session host 不逐步指导用户。
- 输入：
  - `participant_task_card.zh-CN.md`
  - 一份中文制造业/B2B 合同样本
  - 浏览器入口 `/shangshufang` 与 `/shiguan`
- 输出：5 条 deidentified participant records。
- 涉及文件：
  - `backend/harness/chaotang-true-loop/product_acceptance/user_acceptance/records/<approved-record>.json`
- 状态 / 数据变化：只新增最终用户验收记录；不得修改产品代码。
- 验证命令与证据：
  - 每名成功用户必须记录 `contract_review_pack_id`、`artifact_manifest_id`、`archive_receipt_id`、`browser_evidence_ref`。
- 回滚边界：移除未批准或不合格 record 文件。
- 完成定义：5 records，其中至少 4 success，median first value <= 180 秒。

## 任务 3：W08 closeout preflight

- 目标：用 runner 验证最终用户验收记录。
- 前置条件：`records/` 下恰好一份 approved JSON。
- 输入：approved record JSON。
- 输出：`READY_FOR_CLOSEOUT`。
- 涉及文件：`records/<approved-record>.json`。
- 状态 / 数据变化：无运行态修改。
- 验证命令与证据：
  - `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --user-acceptance backend/harness/chaotang-true-loop/product_acceptance/user_acceptance/records/<approved-record>.json`
  - `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --closeout-preflight --user-acceptance backend/harness/chaotang-true-loop/product_acceptance/user_acceptance/records/<approved-record>.json`
  - `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --closeout-preflight`
- 回滚边界：移除 record JSON，closeout 回到 BLOCKED。
- 完成定义：三条命令均 PASS。

## 任务 4：W08 closeout candidate

- 目标：在 closeout preflight PASS 后生成 W08 quiescent closeout candidate。
- 前置条件：任务 3 PASS。
- 输入：approved record、runner 输出、fresh status。
- 输出：W08 closeout Packet 候选。
- 涉及文件：治理 manifest 与 closeout evidence，具体范围需另行批准。
- 状态 / 数据变化：将 W08 从 ACTIVE 推进到 closeout candidate；不激活 W09。
- 验证命令与证据：authority v2 check、harness doctor、W08 preflight。
- 回滚边界：closeout candidate 未获批前不得整合。
- 完成定义：用户批准后再受控整合。
