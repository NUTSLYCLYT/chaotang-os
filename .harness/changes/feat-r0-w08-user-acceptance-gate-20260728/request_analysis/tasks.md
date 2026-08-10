# 任务：feat-r0-w08-user-acceptance-gate-20260728

## 任务 1：RED

- 目标：证明当前 W08 harness 无法校验非开发用户验收。
- 前置条件：R0-W08 authority 为 GO。
- 输入：现有 `run_w08_acceptance.py`。
- 输出：新增 focused tests。
- 涉及文件：`backend/tests/test_w08_product_acceptance_harness.py`。
- 状态 / 数据变化：无运行数据写入。
- 验证命令与证据：`python3 -m pytest -q backend/tests/test_w08_product_acceptance_harness.py` -> 4 failed / 3 passed，缺少用户验收 API。
- 回滚边界：删除新增测试 hunk。
- 完成定义：测试因缺少用户验收校验接口失败。

## 任务 2：GREEN

- 目标：增加最小用户验收校验能力。
- 前置条件：RED 已确认。
- 输入：`w08-user-acceptance.v1` payload。
- 输出：`validate_user_acceptance_payload` 与 `run_user_acceptance`。
- 涉及文件：`backend/harness/chaotang-true-loop/product_acceptance/scripts/run_w08_acceptance.py`。
- 状态 / 数据变化：无运行数据写入。
- 验证命令与证据：focused pytest -> 7 passed。
- 回滚边界：回退 runner hunk。
- 完成定义：合格 records 通过，缺失/开发参与/有指导 records fail closed。

## 任务 3：Evidence Surface

- 目标：提供记录模板、空 records 目录说明，并登记 manifest。
- 前置条件：GREEN 通过。
- 输入：W08 final acceptance threshold。
- 输出：README、template、records README、manifest entry。
- 涉及文件：`backend/harness/manifest.json`、`product_acceptance/user_acceptance/**`。
- 状态 / 数据变化：不提交真实验收记录。
- 验证命令与证据：backend/root harness doctor。
- 回滚边界：回退新增文件与 manifest hunk。
- 完成定义：doctor 能识别并要求用户验收门资产存在。
