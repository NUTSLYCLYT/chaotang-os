# 任务：docs-r0-w08-user-acceptance-runbook-20260728

## 任务 1：执行材料

- 目标：让真实非开发用户验收可以按固定流程执行。
- 前置条件：R0-W08 authority 为 GO，closeout preflight 已存在。
- 输入：W08 user acceptance gate、closeout preflight。
- 输出：session runbook、observer checklist、acceptance rules、submission checklist。
- 涉及文件：`backend/harness/chaotang-true-loop/product_acceptance/user_acceptance/*.md`。
- 状态 / 数据变化：无真实用户记录写入。
- 验证命令与证据：人工 diff review + backend doctor manifest required files。
- 回滚边界：删除新增文档。
- 完成定义：执行者可按文档组织 5 人验收。

## 任务 2：Harness 登记

- 目标：让执行材料成为后端 harness 受保护资产。
- 前置条件：执行材料已新增。
- 输入：`backend/harness/manifest.json`。
- 输出：required list 包含四份执行材料。
- 涉及文件：`backend/harness/manifest.json`。
- 状态 / 数据变化：无。
- 验证命令与证据：`cd backend && python3 scripts/harness_doctor.py`。
- 回滚边界：回退 manifest hunk。
- 完成定义：backend doctor 通过。

## 任务 3：证据记录

- 目标：记录本 Packet 的边界和验证。
- 前置条件：实现和 manifest 完成。
- 输入：验证命令结果。
- 输出：根级 change record。
- 涉及文件：`.harness/changes/docs-r0-w08-user-acceptance-runbook-20260728/`。
- 状态 / 数据变化：无。
- 验证命令与证据：root doctor。
- 回滚边界：删除 change record。
- 完成定义：状态为 `VERIFIED_PARTIAL`，明确不关闭 W08。
