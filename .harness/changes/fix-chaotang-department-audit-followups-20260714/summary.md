# 变更摘要：fix-chaotang-department-audit-followups-20260714

| 字段 | 值 |
| --- | --- |
| Change ID | fix-chaotang-department-audit-followups-20260714 |
| 类型 | fix |
| 状态 | DELIVERED |
| Owner | Project Agent |
| 创建日期 | 20260714 |

## 范围

- 主线：根项目（跨线协调、边界文档）+ 后端（部门别名/prompt 模块）+ 前端（unified registry 治理说明）
- 文件：
  - `.harness/contracts/task.schema.json`：加 `description` 字段，说明与 `DecisionTask` 同名不同物。
  - `.harness/wiki/multi-agent-control-plane.md`：加"范围声明"，明确不管理业务部门派发。
  - `backend/src/chaotang_department_autosubmit.py`：`FLOW_DEPARTMENT_MAP` 改为从 `DEPARTMENT_ALIASES` 派生，不再手动维护两张漂移的表。
  - `backend/src/db/models.py`：`DecisionTask` docstring 加旁注，指向 `task.schema.json` 的"task"。
  - `backend/src/prompts_court.py`：撤回错误的 ORPHANED 标记，改为记录真实的动态加载路径（`flow_court.yaml` → `flow_engine.py` → `chancellor` 部门）。
  - `frontend/src/core/courtos/unified/department-registry.ts`：撤回错误的 ORPHANED 标记，改为记录真实的三个 importer（含两个真实路由页面）。
- 验证：`node scripts/harness-doctor.mjs`、`cd backend && python3 -m pytest -q tests/test_chaotang_department_protocol.py tests/test_chaotang_department_autosubmit.py`

## 背景

本变更是 `docs/chaotang-os-duplication-conflict-audit-2026-07-14.md` 审计报告的后续修复，覆盖审计
发现的中优先级 #6（两张部门别名表漂移）、高优先级 #3（control-plane 与部门系统边界说明）、medium #8
（两套同名 task schema）；以及审计执行过程中两次自我纠错（`prompts_court.py`、`department-registry.ts`
最初被误判为孤儿代码，深挖运行时加载路径后确认都是活代码，已撤回错误标记）。详细过程见审计文档本身
的多轮"核实更新"记录。

## 关联提交

本 change 记录是补记——对应的代码改动已经完成并通过验证，本次提交把工作内容和这份记录一起落地，
commit 本身会带 `Change: fix-chaotang-department-audit-followups-20260714` trailer。
