# 任务：fix-jwt-runtime-identity-contract-20260714

## 任务 1

- 目标：建立不泄密的 JWT runtime identity 发布子门。
- 前置条件：保留脏工作区；不读取 secret；不重启 live 服务。
- 输入：8081 health、外部 expected key id、外部临时 probe token。
- 输出：health auth metadata、loopback probe、fail-closed doctor 结论。
- 涉及文件：`backend/web/routers/health.py`、`backend/tests/test_health_auth_identity.py`、`backend/docker-compose.yaml`、`frontend/scripts/{jwt-runtime-identity.mjs,jwt-runtime-identity.nodetest.mjs,prod-doctor.mjs}`、部署/护栏/计划文档。
- 状态 / 数据变化：只读 HTTP；无数据库写入；无进程/secret 变更。
- 验证命令与证据：见 `ci_result/ci_summary.md`。
- 回滚边界：仅回滚本 change 文件。
- 完成定义：聚焦与回归门通过，live doctor 新子门 fail closed，不误报 READY。
