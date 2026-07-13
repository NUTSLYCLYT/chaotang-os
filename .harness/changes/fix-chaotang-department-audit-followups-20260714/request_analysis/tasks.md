# 任务：fix-chaotang-department-audit-followups-20260714

## 任务 1：合并部门别名映射表

- 目标：消除 `FLOW_DEPARTMENT_MAP` 与 `DEPARTMENT_ALIASES` 手动维护、字段漂移的问题。
- 前置条件：确认两表现有重叠 key 的值完全一致（已核实）。
- 输入：`backend/src/chaotang_department_payload.py` 的 `DEPARTMENT_ALIASES`。
- 输出：`backend/src/chaotang_department_autosubmit.py` 的 `FLOW_DEPARTMENT_MAP` 改为 `{**DEPARTMENT_ALIASES, chancellor, ops, physician}`。
- 涉及文件：`backend/src/chaotang_department_autosubmit.py`。
- 状态 / 数据变化：无运行时数据变化，纯代码结构调整。
- 验证命令与证据：Python 脚本逐 key 对比新旧值，`mismatches: NONE`；`pytest -q tests/test_chaotang_department_autosubmit.py` 通过。
- 回滚边界：`git revert`，无外部依赖。
- 完成定义：新字典包含所有旧 key 且值不变，测试通过。

## 任务 2：control-plane 边界声明

- 目标：让"control-plane 不管理业务部门派发"这条设计决策在文档里显式可查，防止误读成两者本该联动。
- 前置条件：已确认运行时零交叉引用（审计文档 finding #3）。
- 输入：无。
- 输出：`.harness/wiki/multi-agent-control-plane.md` 新增"范围声明"段落。
- 涉及文件：`.harness/wiki/multi-agent-control-plane.md`。
- 状态 / 数据变化：纯文档。
- 验证命令与证据：人工审阅段落内容准确。
- 回滚边界：`git revert`。
- 完成定义：段落存在且内容与审计发现一致。

## 任务 3：两套同名 task schema 互相加旁注

- 目标：`.harness/contracts/task.schema.json` 的 task 与 `backend/src/db/models.py` 的 `DecisionTask` 同名不同物，互相指向，减少误解。
- 前置条件：无。
- 输入：无。
- 输出：`task.schema.json` 加 `description` 字段；`DecisionTask` docstring 加旁注。
- 涉及文件：`.harness/contracts/task.schema.json`、`backend/src/db/models.py`。
- 状态 / 数据变化：纯文档/注释，`description` 字段不影响 JSON Schema 校验行为。
- 验证命令与证据：`python3 -c "import json; json.load(open('.harness/contracts/task.schema.json'))"` 确认仍是合法 JSON；`ast.parse` 确认 Python 语法不变。
- 回滚边界：`git revert`。
- 完成定义：两处旁注都存在且互相指向对方文件路径。

## 任务 4：撤回两处错误的 ORPHANED 标记

- 目标：`prompts_court.py` 和 `department-registry.ts` 此前被误判为孤儿代码并加了 ORPHANED 注释，深挖运行时加载路径后确认都是活代码，需要撤回错误标记、写入真实证据。
- 前置条件：已完整核实两处代码的真实调用链（见审计文档"核实更新"两轮记录）。
- 输入：`backend/config/flow_court.yaml`、`backend/src/flow_engine.py`、`backend/src/chaotang_api.py`（`prompts_court.py` 的调用证据）；`unified-decision-loop.ts`、`unified-ui-adapter.ts`、`junjichu/page.tsx`、`ShangshufangPage.tsx`（`department-registry.ts` 的调用证据）。
- 输出：两个文件头部注释从"ORPHANED"改为准确描述真实调用链。
- 涉及文件：`backend/src/prompts_court.py`、`frontend/src/core/courtos/unified/department-registry.ts`。
- 状态 / 数据变化：纯注释，不影响运行逻辑。
- 验证命令与证据：`ast.parse` 确认 Python 语法不变；TypeScript 文件人工审阅确认语法完整。
- 回滚边界：`git revert`。
- 完成定义：两处注释准确反映当前已核实的真实调用链，不再声称"零调用方"。
