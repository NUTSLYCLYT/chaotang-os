# 规格说明：feat-department-anti-hallucination-clause-20260717

## 背景

现有六部 council persona 各自有领域铁律，但没有共享的职责外拒答、缺口标注和工具/证据不足协议。PKT-4 在同一事实源追加共享条款，不复制六份文本。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 六部人格位于 `MINISTER_PERSONAS`，由 `council_prompt` 消费 | `backend/src/minister_personas.py` | 代码核对 + tests | 否 |
| 推测 | 共享条款可覆盖 L3 council prompt | 12 tests | 定向验证 | 否 |
| 未知问题 | 非 council 的其他 flow prompt 未纳入本包 | flow_engine prompt map | 后续 Packet/独立审计 | 否 |

## 数据流与调用链

六部专属 persona → 追加共享 clause → `council_prompt` → `chaotang_orchestrator` system prompt。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| council system prompt | `MINISTER_PERSONAS` + shared clause | orchestrator council steps | persona tests |

## 范围

只新增共享反幻觉条款及回归测试；不改变路由、执行、数据库或工具权限。

## 非目标

不包含 PKT-3 门下省、PKT-5 丞相推荐层，也不声称可约束所有非 council flow。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 职责外任务 | 明确拒绝或转交 | clause + persona tests |
| 缺证/无工具 | `[missing]`/待验证并给取证动作 | clause + persona tests |
| 六部一致性 | 同一常量追加，不允许六份漂移 | identity test |

## 风险与回滚边界

回滚共享常量和追加循环；既有领域 persona 保留。

## 计划确认记录

- 批准人：
- 批准日期：
- 批准范围：
- 明确未批准：

## 验收标准

六部共享同一条款，测试锁定职责外拒答与缺口标记，现有完整人格测试不回归。

## 验证计划

`python3 -m pytest -q backend/tests/test_minister_personas.py`；`git diff --check`；全量后端回归待收口。
