# 规格说明：feat-final-memorial-quality-gate-20260714

## 背景

第一纵切面已经把正式下旨主链升级为结构化事件账本，但当前 `CourtReview.memorial_json` 仍同时承担“蜂群候选输出”和“可供皇帝裁决的正式奏折”两种语义；皇帝裁决入口也能直接归档候选 JSON。需要建立唯一正式奏折事实源，并把质量门与来源等级变成不可绕过的裁决前置条件。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | `CourtReview.memorial_json` 是候选奏折，当前没有一旨一份的正式奏折表 | `backend/src/db/models.py`、`backend/src/swarm_persistence.py`，2026-07-14 只读检查 | Project Agent | 是 |
| 已确认事实 | `quality_result.passed=True` 会直接把任务推进 `awaiting_decision`，未检查 FALLBACK/DEMO | `backend/src/chancellor/decree_status.py`、`backend/src/execution/outbox_worker.py` | Project Agent | 是 |
| 已确认事实 | adopt/approve/archive 可直接把 `CourtReview.memorial_json` 写入史馆 | `backend/web/routers/shangshufang.py::_apply_task_decision` | Project Agent | 是 |
| 未知问题 | 30 条黄金旨意发布门尚未建立 | 不适用 | 后续独立变更 | 否 |

## 数据流与调用链

`outbox worker -> swarm result -> candidate CourtReview -> effective quality/source gate -> FinalMemorial -> emperor decision -> ShiguanArchive`。未过门的候选只进入补证，不生成正式奏折。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `FinalMemorialV1` | `final_memorials` 唯一行/任务 | 皇帝裁决、史馆归档、事件账本 | 新表，不改变旧 `memorials` 与 `CourtReview` 展示契约；专项集成测试 |

## 范围

- 新增 `final_memorials` 模型与 Alembic 010 迁移。
- 新增唯一正式化服务：质量通过、来源可裁决、内容非空才落库。
- worker 写 `memorial.formalized` 或 `memorial.blocked` 事件，并用有效门结果决定任务状态。
- adopt/approve/archive 必须读取正式奏折；候选 JSON 不能绕过门禁进入史馆。

## 非目标

- 不删除或改造旧通用 `memorials` 表。
- 不修改前端页面，不部署生产，不写真实数据库。
- 不处理正式奏折的多版本/supersede；本纵切面先冻结一旨一份。
- 不建立 30 条黄金旨意数据集。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| quality passed 且来源 LIVE/MIXED/LIVE_ENGINE/LIVE_SWARM | 唯一生成正式奏折并可裁决 | worker/服务集成测试 |
| quality failed | 不生成，任务进入补证 | 参数化测试 |
| 来源 FALLBACK/DEMO | 即使模型质量门 passed 也必须阻断 | 参数化测试 |
| 同一任务相同正式化请求重放 | 返回同一行，数量保持 1 | 幂等测试 |
| 没有正式奏折却请求 adopt/approve/archive | fail closed，不写 EmperorDecision/史馆 | API 测试 |

## 风险与回滚边界

风险：既有测试依赖“候选奏折可直接归档”的宽松行为；本变更会有意收紧。回滚时可回退 worker/裁决门与模型引用，新增表保留为空；不做破坏性删列/删表。

## 计划确认记录

- 批准人：用户
- 批准日期：2026-07-14
- 批准范围：继续上一阶段，以 TDD 与 verification-loop 推进唯一正式奏折和质量门
- 明确未批准：生产部署、真实数据写入、Provider/密钥修改

## 验收标准

1. 每项新门禁先出现能力缺失型 RED，再由最小实现转 GREEN。
2. 一道旨意最多一条正式奏折记录，幂等重放不重复。
3. quality failed 或 FALLBACK/DEMO 均不生成正式奏折，状态回到补证。
4. 皇帝 adopt 类动作只能归档正式奏折，不能绕过门禁读取候选 JSON。
5. 目标回归、静态检查、doctor 与 diff/security review 有证据。

## 验证计划

- 小测试：`python3 -m pytest -q tests/test_final_memorial_gate.py`
- 目标回归：event ledger、outbox、状态、上书房决策与史馆归档相关测试。
- verification-loop：compile、lint、目标测试、完整套件观察、两级 doctor、diff/security review。
