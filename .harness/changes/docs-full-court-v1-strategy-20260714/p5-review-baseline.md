# P5 审查基线：ext HEAD（ddd215b）全部 schema 权威旁路清单

> 用途：P5（alembic-single-authority）整包审查的核销底稿——每项要么退役/
> 门禁化，要么在 change 记录显式 deferred+理由。审查者 2026-07-17 00:5x
> grep 实measured，非推测。

## A. create_all 路径

| # | 位置 | 现状 | P5 预期 |
| - | --- | --- | --- |
| A1 | `backend/web/main.py:95`（checkfirst=True，注释自称"仅为补建"） | 生产启动路径可达 | 降 dev-only；生产断言 Alembic head 否则 fail-fast |
| A2 | `backend/src/formal_memorial.py:48` 附近 | 同类补建 | 同上 |
| A3 | `backend/src/db/flow_store.py`（:132/:163/:221/:343 注释链） | dev 补救 create_all | 同上 |

## B. 运行时 ALTER / ensure_*（flow_store 6 个 ensure_）

| # | 位置 | 现状 | P5 预期 |
| - | --- | --- | --- |
| B1 | `flow_store.py:108` ensure_task_result_json_column（ALTER tasks） | 运行时加列 | 迁入正式 alembic 版本后移除 |
| B2 | `flow_store.py:128` ensure_retrospective_outcome_column（ALTER retrospectives） | 同上 | 同上 |
| B3–B6 | flow_store 其余 4 个 ensure_*（grep `def ensure_` = 6） | 同上 | 逐一处置 |

## C. 原生 DDL 第四权威

| # | 位置 | 现状 | P5 预期 |
| - | --- | --- | --- |
| C1 | `backend/src/tenant.py:132/140/152`（tenants/users/invites CREATE TABLE IF NOT EXISTS） | census DATA-02 判定的第四迁移权威 | 纳入 Alembic 或显式裁决 deferred（涉 FCV1-002 tenant 权威合并，可能超 P5 范围——需显式说明而非静默跳过） |
| C2 | 其他含 ensure_/ALTER 的 8 文件（swarm_persistence/ima_knowledge_store/tenant_bootstrap/decision_task_kernel/chaotang_store/hubu_real_data_importer/ai_ops_context/finance_facts） | 待逐一分类（部分或为专项 DB 非主库） | P5 至少出分类清单：主库运行时 DDL 清零；专项 DB 显式登记 |

## D. 既定纪律（复述防漂移）

- 005 三连修+012/013 已落，计入范围递减不重做；
- 迁移测试环境缺 alembic 时用 `.venv-alembic` 补真实执行证据（P4.5a 模式）；
- 双起点证据：旧库升 head + 空库从零到 head；
- autogenerate 白名单核对（DATA-02 已知坑）。

## 验收判据

生产模式下绕过 Alembic 的建表/改列路径 = 0（A/B 类清零或门禁化）；
C 类每项有显式归宿（收编/deferred+理由），无静默遗留。
