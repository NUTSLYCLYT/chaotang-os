# 任务：fix-p4-5-semantic-freeze-20260716

## P4.5a — EmperorDecision.kind（VERIFIED）

- 目标：冻结 `edict_confirm / compat_dispatch / final_verdict` 三类语义。
- 前置条件：现有 10 个 action 与 6 个生产写入口盘点完成。
- 输出：单一映射函数、非 NULL 模型列与 check、迁移 012。
- 状态 / 数据变化：历史已知 action 确定性回填；未知值阻断升级。
- 验证命令与证据：见 `ci_result/ci_summary.md`。
- 回滚边界：代码可原子 revert；迁移降级会删除 kind，需先导出核验。
- 完成定义：契约、API 回归、旧库/空库迁移和真实库指纹全部通过。

## P4.5b — execution_state（VERIFIED）

- 已穷举真实事件/工件词表并形成 ADR；只新增真实边界支持的 `dispatch.failed` 与 `dispatch.receipt_only`。
- 已建立 first-match-wins 全函数判定表：attempt 优先、同 attempt sequence 次序、末行 quarantine。
- council 部分工件因不符合现有单事务边界而 fail closed；不发明正常 `partial` 状态。
- 保留既有 status 枚举；上书房状态、朝堂 task detail 与 SSE snapshot 复用同一派生器。
- RED：5 个契约/写入测试失败；读模型 6 个断言失败。GREEN：后端相关 82 passed，前端镜像 4 passed。

## P4.5c — 质量门 import seam（VERIFIED）

- `src.swarm_quality_gate` 成为唯一门逻辑拥有者；`swarm_review` 与
  `swarm_execution_loop` 保留同对象兼容 re-export。
- 架构守门禁止生产者从 `swarm_review` 直接导入质量门，并禁止 review 模块继续定义门逻辑。
- RED：2 failed；GREEN：seam/review/distillation 12 passed，execution API/perf 12 passed。

## P4.5d — CourtReview 写入基线（VERIFIED）

- 以独立 AST 扫描和显式 multiset 固化生产路径、所属函数与调用数量。
- 当前基线为 6 个路径/函数条目、8 次构造调用；不拆分或改写现有 writer。
- RED：冻结清单模块缺失，测试收集失败；GREEN：架构门 1 passed，相邻事实链回归 42 passed。

## P4.5e — DepartmentOpinionV1（VERIFIED）

- 从现有 `brief.department_sections` 一对一投影严格 V1 的全部 12 个字段，不建立新表。
- 冻结 position→signal/verdict；逐部门来源优先，内部 `LIVE_ENGINE` 在产品 wire 边界映射为 `LIVE`，原始值仍保留在 raw brief。
- 证据、风险、后令与人工确认均来自真实 section；非法 position/source fail closed。
- RED：2 failed；GREEN：契约 7 passed、相关后端 41+8 passed、前端消费者 22 passed。

## P4.5f — tenant lineage + 013（VERIFIED）

- `DecisionTask / ChancellorRouteDecision / OutboxEvent /
  DecreeExecutionEvent / CourtReview / FinalMemorial / EmperorDecision /
  ShiguanArchive` 8 张核心表已增加 nullable、无 default 的 `tenant_id`。
- 20 个生产构造点均显式写入 lineage：请求根任务只接收已验证 slug 的严格解析结果，
  下游沿 task/review/outbox 继承；治理兼容入口无认证事实，明确写 NULL。
- worker 对两个已知但不一致的 tenant 值 fail closed；未知值不猜测、不回填，进入
  `list_tenant_lineage_quarantine()` 可审计清单。
- 013 expand-only：无 default/backfill/index/FK；缺核心表、已有 NOT NULL 或默认值均阻断。
- RED：字段与 20 个 writer 契约 2 failed，013 缺失 7 failed；GREEN：相关回归
  110 passed，全部迁移测试 18 passed（其中 013 为 9 passed）。
- 独立审查首轮 NO-GO 指出 route/final replay、review 三方校验与冲突失败时间线
  四处缺口；均已追加 RED 用例并修复，待复审签发 GO。
- 真实数据库从未作为测试目标；只在临时 SQLite 演练 upgrade/downgrade/fresh chain。

## 收口（IN REVIEW）

- 全量相关验证完成；两层 doctor、真实库指纹复核与独立审查待最后执行。
- 独立审查 GO 后方可合入 ext/进入 P5。

## 范围外问题（RECORDED）

- `frontend/config/ministry_output_contracts.yaml` 与其 validator 描述了另一套扩张字段，当前只读基线即报 `DepartmentOpinionV1 missing field: department_name`。
- P4.5e 以可执行 JSON Schema 和两个 TS 运行时类型为事实源；YAML/validator 漂移须另立变更，不在本包顺手扩 scope。
- 完整后端基线已有 7 个与本包无关的失败：文档重复检测 1、律师 RAG 本地资料 4、
  persona 清单 1、钦天监期望数量 1；在基线提交重跑完全相同，不纳入 P4.5f 修复。
