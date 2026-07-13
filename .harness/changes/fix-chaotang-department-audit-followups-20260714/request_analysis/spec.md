# 规格说明：fix-chaotang-department-audit-followups-20260714

## 背景

`docs/chaotang-os-duplication-conflict-audit-2026-07-14.md` 审计报告发现若干文档/维护类问题；
本变更逐条落地其中不需要额外产品决策、可以直接修的部分。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | `FLOW_DEPARTMENT_MAP` 与 `DEPARTMENT_ALIASES` 两张表手动维护、字段不一致 | `backend/src/chaotang_department_autosubmit.py`、`backend/src/chaotang_department_payload.py`（改前） | pytest 已验证行为不变 | 否 |
| 已确认事实 | control-plane 与部门系统运行时零交叉引用，是设计上的合理分离 | 全仓 grep 复核（见审计文档 finding #3） | 人工复核 | 否 |
| 已确认事实 | `prompts_court.py` 被 `flow_court.yaml`（10 处 `prompt_module`）经 `flow_engine.py` 动态加载，是活代码 | `backend/config/flow_court.yaml`、`backend/src/flow_engine.py` L3849-3853、`backend/src/chaotang_api.py` L25 | 已核实（见审计文档"核实更新"） | 否 |
| 已确认事实 | `department-registry.ts` 有 3 个真实 importer，其中两条链被真实路由页面引用 | `frontend/src/core/courtos/unified/unified-decision-loop.ts`、`unified-ui-adapter.ts`、`frontend/src/app/(dashboard)/junjichu/page.tsx`、`frontend/src/features/shangshufang/ShangshufangPage.tsx` | 已核实（见审计文档"核实更新"） | 否 |
| 未知问题 | `agent_design/buildAgent/三省六部体系/` 原始 markdown 是否仍被 `prompt_validator.py`/`prompt_composer.py` 处理 | 未查清，两个文件是通用工具，未确认是否真的指向这个具体目录 | 待后续调查，本变更不下结论 | 否（不阻塞本变更范围） |

## 数据流与调用链

- `chaotang_department_autosubmit.protocol_department_for_flow()` → `FLOW_DEPARTMENT_MAP.get(ui_department)`；
  改动后该字典由 `{**DEPARTMENT_ALIASES, chancellor, ops, physician}` 派生，不再是独立维护的字面量。
- `flow_court.yaml` 的每个 step 声明 `prompt_module: src.prompts_court` → `flow_engine.py` 在缺少
  `prompt_key` 命中 `PROMPT_MAP` 时，用 `importlib.import_module(module_path)` 动态加载 → `chaotang_api.py`
  把 `flow_court.yaml` 映射到 `chancellor` 部门，是真实可选中的 flow。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `DEPARTMENT_ALIASES` | `backend/src/chaotang_department_payload.py` | `chaotang_department_autosubmit.FLOW_DEPARTMENT_MAP`（新增依赖） | pytest 验证 10 个旧 key 值与改动前逐一比对无差异 |
| `.harness/contracts/task.schema.json` | 根 harness | 阅读者（人工），无程序消费 `description` 字段 | JSON 语法校验通过 |

## 范围

见 `summary.md` 的文件列表：`task.schema.json`、`multi-agent-control-plane.md`、
`chaotang_department_autosubmit.py`、`db/models.py`、`prompts_court.py`、`department-registry.ts`。

## 非目标

- 不合并 `libu`/`libu_rites`/`libu_personnel` 命名（已确认不是真冲突，见审计文档高优先级 #1 的撤回记录）。
- 不裁决"三套六部实现哪个唯一真实"（已确认三套都是活代码，服务不同职责，不是要三选一淘汰的重复实现）。
- 不处理礼部（lifu）状态矛盾（用户已决定本轮只记录差距，不改代码不改文档，见审计文档高优先级 #4）。
- 不追加 `agent_design/buildAgent/三省六部体系/` 是否被读取的调查——已知未知问题，不在本次范围内解决。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| `FLOW_DEPARTMENT_MAP` 派生后，原有 10 个 key 的值必须逐一与改动前相同 | 无行为变化，只是消除手动维护 | Python 脚本逐 key 对比，见此前 commit 记录，`mismatches: NONE` |
| `chaotang-department-protocol` 相关 pytest 全绿（除 1 个已知无关的预存在失败） | 不新增测试失败 | `pytest -q tests/test_chaotang_department_protocol.py tests/test_chaotang_department_autosubmit.py` |

## 风险与回滚边界

- 风险低：多数改动是文档/注释类补充，唯一涉及运行逻辑的改动（`FLOW_DEPARTMENT_MAP` 派生）已验证零行为差异。
- 回滚方式：`git revert` 对应 commit 即可，无数据库迁移、无外部状态变更。

## 计划确认记录

- 批准人：用户（本轮"继续任务"多次确认按审计报告清单顺序执行）
- 批准日期：20260714
- 批准范围：审计报告中标记"只是需要补文档说明，不算真冲突"和"合并两张部门别名映射表"的条目
- 明确未批准：礼部状态是否隐藏/补后端引擎（用户已决定本轮不动）；三套六部实现是否要进一步整合

## 验收标准

- `node scripts/harness-doctor.mjs` 对本 change 记录 0 errors。
- `cd backend && python3 -m pytest -q tests/test_chaotang_department_protocol.py tests/test_chaotang_department_autosubmit.py` 无新增失败。

## 验证计划

- `node scripts/harness-doctor.mjs`
- `cd backend && python3 -m pytest -q tests/test_chaotang_department_protocol.py tests/test_chaotang_department_autosubmit.py`
