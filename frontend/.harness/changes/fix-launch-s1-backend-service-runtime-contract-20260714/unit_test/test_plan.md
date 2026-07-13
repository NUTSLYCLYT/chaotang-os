# 单测计划

## 覆盖范围

- 两份 unit 的负向旧 runner 与正向唯一 ExecStart。
- 恢复手册的 venv/install/pip-check/import 命令。
- requirements 聚合关系与 gunicorn/uvicorn 声明。

## 命令

- `node --test scripts/backend-service-runtime-contract.nodetest.mjs`
- Python 3.12 隔离临时 venv 安装与 import smoke。

## 未覆盖风险

- 不启动真实 8081，不验证真实 `.env`、数据库或 provider。
- systemd user/system 权限与日志目录需在部署目标机验证。
