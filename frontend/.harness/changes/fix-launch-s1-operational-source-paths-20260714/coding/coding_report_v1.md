# 实现报告 v1

## 改动

- 八个 cron/monitor/restore 文件改用 canonical frontend/backend。
- system restore 与健康告警的手动 8081 指令复用项目 venv gunicorn runner。
- 新增 operational source path node test。

## 取舍

- 只替换执行事实源，不改变探针、阈值、通知、定时频率或任务逻辑。
- 不直接执行具有外部副作用的脚本。

## 验证

- RED 0/8；GREEN 8/8；累计契约 18/18。
- 完整结果见 CI/部署报告。
