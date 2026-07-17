# Packet Review：P6.1 部门 Agent 架构 + P6 测试隔离整合合并

| 项 | 值 |
| --- | --- |
| 复审者 | Claude Code（本会话），只读复审 |
| 被审内容 | `task/p6-test-isolation-fix` 全部 27 个提交（squash 为单一实现提交 `61a6fec`），含 PKT-1~5 部门 Agent 架构落地、P6 测试隔离修复、P7 独立复审证据 |
| Predecessor | `37542c3c2c9ef89f538ac6a25e8795da30ff3529`（origin/feature-chaotang-ext 当前 HEAD） |
| Reviewed head | `61a6fec218c555074f8f3bdad854d701fcb9e61d`（squash 实现提交） |

## 复审范围

本次复审覆盖以下已落地内容（全部在本会话内逐项独立实测，非转述 commit message）：

- **PKT-1** 工部储能售后五阶段真实引擎（`adapt_gongbu`）——48 测试通过，能力图谱确认注册。GO。
- **PKT-2** 部门路由关键词收口（`DEPARTMENT_RULES` 改为从 canonical registry 投影生成）——初版有 HIGH 回归：锦衣卫路由被删除、零替代路径，`infer_departments` 对锦衣卫任务硬塞户部+工部（复现"世界杯"bug 根因）。已在 `df21744` 修复并本会话实测验证：`infer_departments('...信源可信度...查证...谣言')` → `['锦衣卫']`。GO（修复后）。
- **PKT-3** 门下省路由否决关卡（`menxia_veto.py`）——继承 PKT-2 同一根因，对正确的锦衣卫路由给出错误封驳。已随 `df21744` 一并修复，本会话实测：`review_route` 对同一输入 → `准奏`。GO（修复后）。
- **PKT-4** 六部共享反幻觉铁律——`DEPARTMENT_ANTI_HALLUCINATION_CLAUSE` 确认追加进六部 persona，测试锁定。一处 `\n` 转义字面量 bug 已在 `18f5058` 修复。GO。
- **PKT-5** 丞相 LLM 路由推荐层——结构清晰，`unsupported_scope` 用本次调查起点原句回归验证；生产路径当前 `call_fn` 未接线，如实降级，未夸大为已生效。GO。
- **P6 测试隔离**：`FENGQUN_RUNTIME_ROOT` 隔离缺口（裸 pytest 曾真实写入 `backend/var/data/fengqun.db`）已修复并补齐 fail-closed 回归守卫；后续两轮 stop-review 又堵上了守卫本身的 false-green 缺口（只查 kpi_tracker → 改查全部 10 个冻结路径模块；in-process 守卫无法验证 import 顺序 → 补裸子进程验证）。
- **全量回归**：`2703 passed / 37 skipped / 7 known baseline failures`（`known-red-baseline-ledger.md` 记录的既有基线），PKT-1~5 与 P6 不引入新增失败。本会话另发现一个全量套件下概率性失败（`pytest-randomly` 随机顺序偶发触发 2 项 golden case 失败，非本批改动逻辑错误，已定位根因写入 `refactor-department-router-canonical-consolidation-20260717/packet_review/`）。

## Blockers

无（原 PKT-2/PKT-3 的锦衣卫回归已确认修复并复测通过）。

## 裁决

**PACKET_REVIEW_GO**。本批内容可合入 `feature-chaotang-ext`。

*本复审基于本会话内多轮独立实测（直接运行代码、非静态读 diff），详细分项证据见
`.harness/changes/{refactor-department-router-canonical-consolidation-20260717,
feat-menxiasheng-routing-veto-20260717,feat-chancellor-llm-routing-recommendation-20260717}
/packet_review/` 下已提交的分项 review 文件。*
