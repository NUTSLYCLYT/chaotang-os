# 规格说明：fix-launch-s1-backend-service-runtime-contract-20260714

## 背景

上一闭环把两份 8081 unit 收敛到 canonical backend 路径后，systemd 验证暴露出启动器契约漂移：user unit 直接调用 `.venv/bin/uvicorn`，system unit 调用宿主机专属 `/home/ubuntu/miniforge3/bin/python -m gunicorn`，恢复手册也没有安装 backend `.venv`。这会导致同一代码在不同 unit 下运行行为不同或根本无法启动。

## 范围

- 两份 8081 unit 统一执行 `backend/.venv/bin/python -m gunicorn -c gunicorn.conf.py web.main:app`。
- 恢复手册明确创建 `.venv`、安装聚合 requirements、执行 `pip check` 和运行时模块导入。
- 新增独立契约门禁，验证 runner、安装命令和依赖声明。

## 非目标

- 不在 canonical 脏工作区安装 `.venv`，不重启或接管 8081。
- 不修改 `gunicorn.conf.py` 的端口、worker、timeout 或认证策略。
- 不运行面向开发且会生成临时秘密/邀请码并启动服务的 `bootstrap_chaotang.sh`。
- 不解决仓库既有全量 ruff 债务。

## 验收标准

- 两个旧 runner 和缺失安装步骤先分别产生 RED，再以相同测试转 GREEN。
- Python 3.12 隔离临时 venv 能安装 `requirements.txt`，通过 `pip check` 并导入 gunicorn、uvicorn、web.main。
- build、typecheck、相关回归和三层 doctor 通过；生产门继续诚实 STOP。

## 验证计划

- `node --test scripts/backend-service-runtime-contract.nodetest.mjs`
- 隔离 Python 3.12 临时 venv 安装、`pip check` 与 import smoke
- production build/typecheck、production lifecycle 回归、后端代表 pytest
- compose、三层 doctor、prod:doctor、ruff baseline、secret/diff 检查
