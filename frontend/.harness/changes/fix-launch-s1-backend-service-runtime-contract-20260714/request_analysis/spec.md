# 需求说明

## 背景

P0 路径收敛后，两份 8081 unit 仍分别使用直接 uvicorn 和宿主机 miniforge gunicorn，恢复手册也没有创建 canonical backend `.venv`。同一服务缺少唯一、可安装、可验证的生产启动契约。

## 范围

- 两份 unit 统一为项目 `.venv/bin/python -m gunicorn -c gunicorn.conf.py web.main:app`。
- 恢复手册增加 backend venv 安装、依赖一致性与应用导入检查。
- 根级测试锁定 runner、安装步骤及现有依赖声明。

## 非目标

- 不修改 API/UI/数据库/工作流逻辑，不修改 gunicorn 参数。
- 不安装 canonical 生产 venv，不启动、停止或重启 8081。
- 不使用会生成本地邀请码并直接启动服务的开发 bootstrap。

## 验收标准

- 三个缺陷先 RED、再 GREEN。
- 隔离 Python 3.12 venv 实际安装聚合 requirements 并通过 import smoke。
- candidate build/typecheck/test/doctor 通过，生产门继续 STOP。

## 风险

- 两份 unit 分属 user/system systemd，EnvironmentFile 是否可选仍有差异，本轮只统一 executable。
- canonical 目标机尚未执行恢复手册，systemd parser 会诚实报告 executable 不存在。
- 全仓 ruff 有大量既有债务，不应混入本部署契约变更。

## 验证计划

- runtime contract node tests、隔离 Python 3.12 venv 安装验证。
- typecheck/build、production regression、backend representative pytest。
- compose/systemd、doctor、prod:doctor、lint/security/diff。
