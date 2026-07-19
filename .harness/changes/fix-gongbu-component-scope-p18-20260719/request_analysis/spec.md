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
| Claude v1 HIGH | 单字危险信号会把防火墙、聚焦、烧钱、爆款等领域外文本变成储能消防简报 | review-v1 本地隔离报告 + P18-v2 RED | Claude/Codex 实跑 | 是，已回修 |
| Claude v1 MEDIUM | `合同+控制柜爆燃` 的 canonical candidates 缺工部 | review-v1 本地隔离报告 + P18-v2 RED | Claude/Codex 实跑 | 是，已回修 |
| Claude v2 HIGH | 全文任意共现令单体服务短路、模组包体膨胀伪造消防指令 | Claude v2 NO_GO + P18-v3 RED | Claude/Codex 实跑 | 是，已回修 |
| Claude v2 MEDIUM | route/run 文本口径遗漏 known_facts 或 unknown_gaps，事故 fallback 可无人签 | Claude v2 NO_GO + P18-v3 RED | Claude/Codex 实跑 | 是，已回修 |
| 设计取舍 | 危险信号只在已确认物理范围分档；歧义组件只认有限连续物理短语 | 共享分类函数 + 正负例 | Claude v3 待复审 | 否 |

## 数据流与调用链

用户/奏折文本 → canonical 六部路由与 L4 `route_swarms` → 工部 direct engine → 若有效则
P0/P1 black；若无有效结论或跳过 real engine → `_enforce_gongbu_safety_stop` → 复核且风险项
要求人工确认。`is_gongbu_safety_scope()` 是 direct、L4 route 与 fallback 的共享判定入口；
它以明确硬件词为主，歧义的 `模组/单体` 只通过有限连续物理短语入域，危险字符只在入域后
分档。`_edict_context_text()` 向 route、real/rule/live/fallback 提供同一份奏折事实投影，包含
known facts 与 unknown gaps。canonical 六部词表继续由 `departments.yaml` 持有。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| 工部安全 scope | `real_department_engines.py` | direct/L4 route/fallback | 明确硬件词，或有限连续组件物理短语 |
| 危险分档 | `real_department_engines.py` | `adapt_gongbu` | 仅在 scope 已成立后决定 P0/P1，不独立拉起引擎 |
| 六部 routing keywords | canonical `departments.yaml` | `department_identity`/router | 电芯/析锂 + 控制柜/配电柜/端子；不使用裸模组/单体 |
| 奏折事实文本 | `swarm_execution_loop._edict_context_text` | route/real/rule/live/hard-stop | 同时纳入 known_facts/unknown_gaps/risk_flags/review_plan |
| fallback human confirmation | `swarm_execution_loop.py` | brief risk register/quality gate | real engine 空、规则或 live 输出均补 hard-stop |

## 范围

- 3 个生产/配置文件：真实引擎、L4 蜂群编排、canonical YAML。
- 3 个测试文件：direct、L4 route/fallback、六部 canonical route。
- 本根级 Harness change 证据。

## 非目标

- 不重做 P17 的 P0/P1 分级和缓存隔离。
- 不宣称危险语义 NLP 已完美；已识别 scope 的任务不会再走无人签 fallback，未知物理漏词仍需后续词表/结构化事实治理。
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
| 合同 + 控制柜爆燃 | canonical candidates 含刑部与工部 | v2 六部路由回归 |
| 防火墙/聚焦/烧钱失控/飙升/骤降/爆款/高温促销 | direct 返回 None，不生成储能消防简报 | v2 领域外负例 |
| 合同 + 烧钱失控 | L4 不因业务隐喻强制追加工部安全参审 | v2 L4 负例 |
| 单体服务短路 / 前端模组包体膨胀 | direct 返回 None，不做全文任意共现 | v3 领域外负例 |
| known_facts=控制柜爆燃 | 路由含工部；real None fallback 仍复核且人签 | v3 统一事实投影回归 |
| unknown_gaps=电芯析锂程度未知 | fallback 复核且人签 | v3 统一事实投影回归 |

## 风险与回滚边界

已确认物理范围内仍选择安全方向的保守分档；但领域外假阳性会制造失实指令和告警疲劳，不能
视为无害。回滚若恢复组件任务返回 None 或 fallback 无人签，会重新打开已实证的安全旁路；
若恢复单字危险信号独立拉起 scope，则重新引入 Claude v1 HIGH。两者均禁止无审查回滚。

## 计划确认记录

- 批准人：业主“下一步”授权按既定 Packet 顺序继续
- 批准日期：2026-07-19
- 批准范围：P18 最小实现、测试、Claude review、GO 后 D6 发布
- 明确未批准：整体旧分支合入、绕过审查、范围外顺手修复

## 验收标准

1. 四条旁路测试必须先在 P17 远端 RED，再在 P18 GREEN。
2. Claude v1 的领域外假阳性与 canonical 不对称必须在 H18 RED、v2 GREEN。
3. Claude v2 的全文共现假阳性与奏折事实口径旁路必须在 v2 RED、v3 GREEN。
4. direct、L4 route、fallback、canonical route 四条路径形成闭环。
5. 聚焦、后端全量、三层 doctor、diff check 全绿。
6. Claude 固定 B/H 独立复审无 HIGH/MEDIUM 阻断后才允许 D6 no-ff 发布。

## 验证计划

- 原 4 个精确 node ID + v2 3 个边界 node + v3 2 个事实投影 node，累计 9 个精确回归。
- 五文件跨模块 focused pytest。
- `python3 -m pytest -q backend/tests -p no:randomly`。
- 三层 doctor、diff check、Claude、D6。
