# 实现报告 v1

## 改动

- user/system 两份 8081 unit 使用完全相同的项目 venv gunicorn runner。
- 恢复手册增加 backend `.venv`、requirements、pip check 与 import smoke。
- 新增 runtime contract node test。

## 取舍

- 不调用全局 gunicorn，确保 worker 及其依赖来自同一 venv。
- 不复用开发 bootstrap，避免其 dev 鉴权默认值、固定邀请码和直接启动副作用。

## 验证

- RED 1/4，GREEN 4/4；联合路径契约 10/10。
- Python 3.12 隔离 venv 实际安装与 import smoke 通过。
- 完整证据见 CI 与 deployment 报告。
