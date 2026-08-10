# 规格说明：docs-r0-w08-user-acceptance-execution-packet-20260729

## 背景

R0-W08 的目标是 Product Acceptance Hardening：用 36 份中文制造业/B2B 黄金合同、10 条真实后端浏览器流程、5 名非开发用户至少 4 人成功的验收门，证明合同审查闭环可以被目标用户无陪同跑通。

截至 `bdea736e015b46c1209d74530d436a68583f0a97`，机器可验证部分已通过；最终 closeout 仍因真实用户记录缺失而 fail-closed。本 Packet 用来把下一阶段执行队列、证据格式、阻塞条件和 closeout 命令固定下来，避免把本地自测、fixture 或截图误报为产品验收。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | R0-W08 authority 为 GO | `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` / 2026-07-29T15:07:03Z | EXT Master Governance | 否 |
| 已确认事实 | 黄金合同矩阵 `36/36` 通过 | `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py` | W08 Product Acceptance | 否 |
| 已确认事实 | browser flow harness 记录 `10/10` 通过 | `run_w08_acceptance.py --closeout-preflight` 的 `browser_flows` gate | W08 Product Acceptance | 否 |
| 已确认事实 | closeout 当前 BLOCKED | `records/ must contain exactly one approved user acceptance JSON file` | W08 Product Acceptance | 是 |
| 已确认事实 | Fixture 不能作为最终验收 | `fixtures/valid_closeout_example.json` 被 runner 拒绝为 final evidence | QA Auditor | 否 |
| 未知问题 | 真实用户是否能无陪同完成 | 尚未执行 5 名目标用户 sessions | Product Acceptance Owner | 是 |

## 数据流与调用链

```text
Participant
-> /shangshufang
-> upload contract
-> MissionContract
-> EvidencePacket
-> RiskItem
-> supplement evidence / acknowledge gap
-> risk decision
-> ContractReviewPack
-> ArtifactManifest
-> PDF/DOCX/JSON authorized download
-> /shiguan ArchiveReceipt audit replay
-> approved user acceptance JSON
-> W08 closeout preflight
```

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| Golden contract matrix | `backend/harness/chaotang-true-loop/product_acceptance/golden_cases/w08_contracts.json` | `run_w08_acceptance.py` | 36 cases, unique ids, manufacturing/B2B risk-family coverage |
| User task prompt | `participant_task_card.zh-CN.md` | session host and participant | `task_prompt_ref` 必须精确等于 `participant_task_card.zh-CN.md` |
| User acceptance record | `user_acceptance/records/<approved-record>.json` | W08 closeout preflight | 必须是 records/ 下唯一 JSON；5 records；至少 4 success |
| Browser evidence reference | session host | user acceptance JSON | 每个成功记录必须绑定 browser evidence ref |
| ContractReviewPack / ArtifactManifest / ArchiveReceipt ids | real backend session | user acceptance JSON | 每个成功记录必须填写，且不能使用 `fixture-` 前缀 |

## 范围

- 建立 W08 用户验收执行队列。
- 明确 5 名 participant 的记录要求。
- 明确 closeout 前必须运行的验证命令。
- 记录当前阻塞状态，不伪造 closeout。

## 非目标

- 不生成真实用户记录。
- 不把 fixture、开发者自测、截图、API dry-run 作为最终用户验收。
- 不新增页面或 Agent。
- 不修改产品代码。
- 不 push、不部署、不迁移数据库、不操作 3050。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| records/ 为空 | closeout preflight 必须 BLOCKED | `run_w08_acceptance.py --closeout-preflight` |
| records/ 多于一个 JSON | closeout preflight 必须 BLOCKED | runner auto-discovery gate |
| JSON 在 records/ 外 | explicit closeout 必须 BLOCKED | path boundary gate |
| 使用 fixture 前缀 | user acceptance 必须 FAIL | fixture rejection gate |
| 少于 5 participants | user acceptance 必须 FAIL | `records` count gate |
| 成功人数少于 4 | user acceptance 必须 FAIL | success threshold gate |
| median first value > 180s | user acceptance 必须 FAIL | median first value gate |

## 风险与回滚边界

- 最大风险：为赶进度把开发者操作或 fixture 当成用户验收。控制方式：runner 拒绝 fixture，Packet 明确 BLOCKED。
- 证据风险：participant feedback 可能包含个人或客户敏感信息。控制方式：只提交 deidentified record，不写真实姓名、手机号、客户名、合同敏感金额。
- 操作风险：误把 W08 closeout 说成生产上线。控制方式：本 Packet 明确 `NOT_DEPLOYED`，不操作 3050。
- 回滚边界：本 Packet 只新增 `.harness/changes/docs-r0-w08-user-acceptance-execution-packet-20260729/` 文档；删除该目录即可回滚本轮治理记录，不影响产品代码。

## 计划确认记录

- 批准人：用户口头批准“进入下一阶段”。
- 批准日期：2026-07-29。
- 批准范围：W08 用户验收执行 Packet 与 closeout 证据准备。
- 明确未批准：push、deployment、database migration、3050 operation、fake user acceptance、W09 activation。

## 验收标准

- Packet 明确 W08 当前 gate 状态。
- Packet 明确 5 名非开发用户验收执行队列。
- Packet 明确 final closeout 需要的三条命令。
- closeout 在真实记录缺失时保持 BLOCKED。

## 验证计划

- `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08`
- `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py`
- `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --closeout-preflight`
- 收到真实记录后：
  - `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --user-acceptance backend/harness/chaotang-true-loop/product_acceptance/user_acceptance/records/<approved-record>.json`
  - `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --closeout-preflight --user-acceptance backend/harness/chaotang-true-loop/product_acceptance/user_acceptance/records/<approved-record>.json`
  - `python3 backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py --closeout-preflight`
