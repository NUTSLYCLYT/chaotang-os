# 任务：fix-launch-s1-backend-service-runtime-contract-20260714

## 任务 1：RED

- 目标：机械复现两份 unit runner 漂移和恢复手册安装缺口。
- 输入：当前 tracked unit、requirements 与恢复文档。
- 输出：四项 backend runtime contract 测试。
- 验收：首次运行 1/4 通过、3/4 失败；三个失败分别对应两个旧 runner 和缺失安装证明。

## 任务 2：GREEN

- 目标：建立唯一生产 runner 与可复现安装步骤。
- 输入：`requirements.txt`、`requirements-optional.txt`、`gunicorn.conf.py` 的现有事实。
- 输出：两份 unit 与恢复 README 的最小修改。
- 验收：同一测试 4/4 通过，隔离 Python 3.12 venv 安装与 import smoke 通过。

## 任务 3：候选证据循环

- 目标：证明本变更可进入审查但未越权声明生产 READY。
- 输入：本分支完整 diff。
- 输出：verification-loop 与 change 记录。
- 验收：行为回归通过；历史 lint 债务、foreign 3050 和 immutable build 缺口如实记录。
