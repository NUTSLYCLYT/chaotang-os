# 任务：test-finance-incident-day-replay-20260719

## 任务 1：事故日黄金用例

- 目标：三场景钉安全不变量（红线/诚实阻断/人工裁决位）。
- 输入：台账 #3 构想 + P22/P23 后的真实链路。
- 输出：`test_finance_intel_incident_day_replay.py`。
- 验证命令与证据：`pytest tests/test_finance_intel_incident_day_replay.py` 3 passed。
- 回滚边界：删文件。
- 完成定义：断言全为行为不变量，stub 取证零网络。

## 任务 2：候选收口

- 验证：全量 suite 2842 passed / 0 failed；双 doctor 0 errors。
- 状态：packet 标准形（H→R→candidate）过闸。
- 回滚边界：`git revert` 单提交。
