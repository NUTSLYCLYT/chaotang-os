# 变更摘要：docs-chancellor-junjichu-orchestration-design-20260713

| 字段 | 值 |
| --- | --- |
| Change ID | docs-chancellor-junjichu-orchestration-design-20260713 |
| 类型 | docs(设计方案，待拆分为多个 feat/fix 实施变更) |
| 状态 | DRAFT |
| Owner | Project Agent |
| 创建日期 | 20260713 |

## 范围

- 主线：丞相→军机处→部→司→蜂群→回奏 编排重构设计，复用现有 jiqun 编排引擎（`swarm_execution_loop.py`/`real_department_engines.py`/`SWARM_DEFS`/`ModelAdapter`），新增军机处评议层 + 司级蜂群注册 + 御史 shadow mode + 超时修复。
- 文件：`request_analysis/spec.md`(完整设计)、`request_analysis/tasks.md`(四阶段任务分解)。本变更本身不改代码，是后续多个实施变更的规格来源。
- 验证：见 spec.md"验收标准"/"验证计划"；实施验证按 tasks.md 各任务的验收标准逐条来。
- **2026-07-13 已过一轮架构复审(architect agent，opus)并按发现修正**：原稿把户部/吏部并列 P0、超时当成加参数、部门选择覆盖入口以为要新建——复审后确认：① 部门选择覆盖入口(`run_swarm_execution_loop(params["department_ids"])`)其实已经存在，缺的是 `outbox_worker._execute_council()` 没调用它；② 超时是真新工程(下推到引擎级网络调用)，不是 executor 层加参数；③ 户部三道闸共享结构化输入、由统一函数做跨闸综合判定，拆司需要 case 拆分器+综合判定重写，风险工作量比吏部高，移到吏部验证通过后的第二阶段；④ 覆盖生效时元蜂群会从审计记录里消失(仍照常执行)，是需要顺带修的既有次生漏洞。
- 试点范围（修正后）：**吏部单独起步**（任免/招聘两司，吃自由文本、无结构化耦合），跑通"军机处→部→司→蜂群→司报告→部汇总"整条链路骨架后，再排期户部第二试点（预算/出纳/会计三司，需要先补 case 拆分器）。
- 顺带修复的既有 bug（阶段0，跟五层结构无关）：蜂群调用无超时（真工程）、两套独立关键词表分叉导致"记录参与者≠实际执行者"（一行接线，入口已存在）、覆盖生效时元蜂群从审计记录消失（复审新发现）。
