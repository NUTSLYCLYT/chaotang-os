# 后端变更摘要：feat-launch-readiness-hardening-20260711

| Field | Value |
| --- | --- |
| Change ID | feat-launch-readiness-hardening-20260711 |
| Status | DRAFT |
| Owner | 后端 harness |
| Date | 20260711 |

## 摘要

2026-07-11 实测(真实注册 + 真实下旨 + 真实轮询)暴露的后端侧治理缺口：一次性、不可复现的端点覆盖率审计脚本没有沉淀为常设检查；密旨(`orchestrate_all`)的兼容占位状态没有在文档里显式登记为"待产品决策"；工部(`gongbu_review_verdict`)结构性需要 `presale_output + task_input` 双输入，普通自由文本下旨永远打不到这条真实引擎，此前没有文档说明，容易被误判为"又坏了"。

## 范围

- `backend/scripts/check-endpoint-coverage.py`：把本轮临时写的路由内省 + 前端路径归一化比对脚本，迁移成仓库内可重复运行的常设脚本，导出 `/openapi.json` 结构供前端 `check-contract-drift.mjs` 复用(避免前后端各写一套解析)。
- `backend/harness/chaotang_department_protocol/README.md`(或同级文档)补充一段："工部真实引擎的双输入契约与自由文本下旨的差距"，明确记录这是结构性限制，不是缺陷。
- `backend/web/routers/court_compat.py::orchestrate_all` 增加代码级注释登记：此端点是密旨当前唯一真实调用路径，产品决策(接入真实调度 vs 保持占位)待定，链接到本 change 记录。

## 非目标

- 不在本轮实现密旨接入真实调度(需要用户拍板选择方向)。
- 不改动户部/刑部/兵部/礼部/吏部已验证可用的真实引擎逻辑。
- 不重写 `real_department_engines.py` 里工部的双输入契约本身。

## 验证计划

- `python scripts/harness_doctor.py`
- `python scripts/check-endpoint-coverage.py`(新增，需能对当前 352 条路由跑出与本轮人工审计一致的结果：5 个未被前端调用，其中 4 个诚实空桩 + 1 个已被替代的 legacy 端点)
- `python -m pytest -q tests/test_chaotang_department_protocol.py`(确认工部文档补充没有破坏既有协议测试)
