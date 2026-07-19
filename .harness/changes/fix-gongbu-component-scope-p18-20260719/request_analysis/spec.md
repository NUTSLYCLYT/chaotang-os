# 规格说明：fix-gongbu-component-scope-p18-20260719

## 背景

P17 已保证“进入工部储能安全引擎的任务恒为 black”，但 Claude 随后实证两条组件措辞
`模组端子松动打火`、`电芯析锂` 在已发布树上令 `adapt_gongbu()` 返回 `None`。进一步审计发现：
混合任务可能不选择工部；六部 canonical 路由不认识组件词；真实引擎返回空或页面跳过真实引擎时，
工部规则兜底仍为 `准奏 + requires_human_confirmation=false`。这是 scope→fallback 的系统性旁路。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 组件/危险-only 文本令 direct engine 返回 None | P17 远端探针 + P18 RED | Codex 实跑 | 是 |
| 已确认事实 | 混合合同任务不选择工部 | `route_swarms` RED | Codex 实跑 | 是 |
| 已确认事实 | 工部 real engine 无结论时 fallback 自动准奏 | `run_department_swarm` RED | Codex 实跑 | 是 |
| 已确认事实 | canonical 六部路由只选刑部 | `route_department_task` RED | Codex 实跑 | 是 |
| 设计取舍 | 危险信号本身可以拉起工部安全 scope | 共享分类函数 | Claude 待复审 | 否 |

## 数据流与调用链

用户/奏折文本 → canonical 六部路由与 L4 `route_swarms` → 工部 direct engine → 若有效则
P0/P1 black；若无有效结论或跳过 real engine → `_enforce_gongbu_safety_stop` → 复核且风险项
要求人工确认。`is_gongbu_safety_scope()` 是 direct、L4 route 与 fallback 的共享判定入口；
canonical 六部词表继续由 `departments.yaml` 持有。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| 工部安全 scope | `real_department_engines.py` | direct/L4 route/fallback | 组件词或危险信号命中 |
| 六部 routing keywords | canonical `departments.yaml` | `department_identity`/router | 增加电芯、模组、单体、析锂 |
| fallback human confirmation | `swarm_execution_loop.py` | brief risk register/quality gate | real engine 空、规则或 live 输出均补 hard-stop |

## 范围

- 3 个生产/配置文件：真实引擎、L4 蜂群编排、canonical YAML。
- 3 个测试文件：direct、L4 route/fallback、六部 canonical route。
- 本根级 Harness change 证据。

## 非目标

- 不重做 P17 的 P0/P1 分级和缓存隔离。
- 不宣称危险语义 NLP 已完美；本包保证漏词不会再走无人签 fallback。
- 不修改通用非工部 fallback 或其他部门策略。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 模组端子松动打火 | direct=P0/black 且人签 | direct 回归 |
| 控制柜爆燃 | 危险信号本身拉起 direct=P0 | direct 回归 |
| 电芯析锂 | direct=P1/black 且人签 | direct 回归 |
| 合同 + 模组打火 | 同时选择刑部与工部 | L4 route 回归 |
| real engine 返回 None | fallback=复核且人签 | fallback 行为回归 |
| 合同 + 电芯析锂 | canonical candidates 含刑部与工部 | 六部路由回归 |

## 风险与回滚边界

安全方向假阳性会增加人工确认和响应成本；这是比物理安全漏报更可接受的失败方向。回滚若恢复
组件任务返回 None 或 fallback 无人签，会重新打开已实证的安全旁路，禁止无审查回滚。

## 计划确认记录

- 批准人：业主“下一步”授权按既定 Packet 顺序继续
- 批准日期：2026-07-19
- 批准范围：P18 最小实现、测试、Claude review、GO 后 D6 发布
- 明确未批准：整体旧分支合入、绕过审查、范围外顺手修复

## 验收标准

1. 四条新增行为测试必须先在 P17 远端 RED，再在 P18 GREEN。
2. direct、L4 route、fallback、canonical route 四条路径形成闭环。
3. 聚焦、后端全量、三层 doctor、diff check 全绿。
4. Claude 固定 B/H 独立 GO 后才允许 D6 no-ff 发布。

## 验证计划

- 4 个精确 node ID 的 RED/GREEN。
- 五文件跨模块 focused pytest。
- `python3 -m pytest -q backend/tests -p no:randomly`。
- 三层 doctor、diff check、Claude、D6。
