# P5 审查基线 v2：ext HEAD 全部 schema 权威旁路清单（事实更正版）

> v1（b7e062d）存在事实错误经 stop-review 指出，本版全部条目基于**实际调用**
> 而非注释引用重测（2026-07-17 01:0x，命令戳）。v1 错误：A2/A3 把注释当调用；
> C2 的"8 文件"被 `json.dumps(ensure_ascii=)` 假阳性污染。
> 用途不变：P5 整包审查核销底稿。

## A. create_all 真实调用（就一处）

| # | 位置 | 现状 | P5 预期 |
| - | --- | --- | --- |
| A1 | `backend/web/main.py:95` `Base.metadata.create_all(engine, checkfirst=True)` | 生产启动路径可达；alembic 004b 头注自承迁移链因此**非自包含** | 降 dev-only；生产断言 Alembic head 否则 fail-fast；004b 自包含化随之解锁 |

## B. flow_store 运行时 DDL（6 个 ensure_，精确名单）

| # | 函数（flow_store.py 行号） | DDL 对象 |
| - | --- | --- |
| B1 | ensure_task_result_json_column（:108） | ALTER tasks 加列 |
| B2 | ensure_retrospective_outcome_column（:128） | ALTER retrospectives 加列 |
| B3 | ensure_decree_execution_event_sequence_column（:159） | 事件表 sequence 列 |
| B4 | ensure_decree_execution_event_ledger_columns（:218） | 事件账本列族 |
| B5 | ensure_jinyiwei_evidence_unique_constraint（:337） | 唯一约束 |
| B6 | ensure_build_ledger_ownership_columns（:455） | build ledger 列 |

P5 预期：全部迁入正式 alembic 版本后移除（对应迁移可能已存在——004/005/007
等，需逐个对账"迁移在位→ensure 可删"）。

## C. 主库外 DDL 执行者（实测 execute ALTER/CREATE，5 文件）

| # | 文件 | 性质 | P5 处置 |
| - | --- | --- | --- |
| C1 | `src/tenant.py`（tenants/users/invites CREATE TABLE） | **主库相关**——census 第四迁移权威 | 收编 Alembic 或显式 deferred（涉 FCV1-002）——不得静默跳过 |
| C2 | `src/memory_store.py`（2 处） | 专项 memory DB | 显式登记为专项库+豁免理由 |
| C3 | `src/sqlite_vec_rag.py` | 专项 RAG DB | 同上 |
| C4 | `src/kpi_tracker.py` | 专项 kpi.db | 同上 |
| C5 | `src/db/flow_store.py`（B 类的 execute 载体） | 主库 | 随 B 类清零 |

## D. 既定纪律（复述防漂移）

005 三连修+012/013 计入范围递减；`.venv-alembic` 真实执行模式；
双起点证据（旧库升 head/空库从零）；autogenerate 白名单核对。

## 验收判据

生产模式主库：绕过 Alembic 的建表/改列路径=0（A1 门禁化、B1–B6 清零、
C1 显式归宿）；专项库 C2–C4 显式登记豁免；无静默遗留。
