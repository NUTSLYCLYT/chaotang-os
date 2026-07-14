# Codex 第一条提示词：FULL_COURT_V1 CAPABILITY CENSUS

> 用法：整段发给 Codex。任务只读，Codex 不得改任何文件。

```text
你现在是"朝堂 OS FULL_COURT_V1 全量能力盘点与集成架构负责人"。

当前任务只读。

禁止修改任何代码、文档、配置、依赖、测试、数据库或 Git 状态。

唯一例外：完整盘点报告必须写入新文件
.harness/changes/docs-full-court-v1-strategy-20260714/census.md，
除该文件外不得创建或修改任何文件。报告只留在聊天输出不算完成。

目标：

不是裁剪 V0.1，也不是决定上线范围。

本任务要完整识别朝堂 OS 当前已经规划、已经实现、部分实现、重复实现、Mock 实现和尚未实现的全部产品能力，形成 FULL_COURT_V1 的功能宇宙和集成地图。

产品决策：

1. 先实现和跑通全部有效能力；
2. 再依据真实数据收敛上线范围；
3. 发散的是产品能力，不是事实源；
4. 保留全部有效功能，但重复实现只能保留一个 canonical owner；
5. 所有功能必须接入统一 DecisionTask 生命周期；
6. 非正式能力可以 INTERNAL、SHADOW 或 EXPERIMENTAL；
7. MOCK、DEMO、FALLBACK 不得标记为 LIVE。

权威事实源：

1. docs/product/CHAOTANG_CONVERGENCE_GUIDE.md
2. .harness/changes/chore-evidence-driven-shangshufang-workflow-20260714/blueprint.md
3. docs/plans/chaotang-os-launch-blueprint-2026-07-14.md
4. AGENTS.md
5. CLAUDE.md
6. frontend、backend、scripts、docs 和测试中的真实代码
7. 当前 Git 与机器事实

必须盘点以下能力域：

1. 身份、登录、邀请、租户和角色
2. 上书房与 DecisionTask
3. 丞相拟票、朱批和 D0/D1/D2
4. 路由、Outbox、Worker、DAG、重试和幂等
5. 六部及所有专署能力
6. 锦衣卫证据、来源、鲜度和主动密折
7. 御史质量门、封驳、弃权和冲突
8. 候选奏折、正式奏折和丞相呈递
9. 圣裁、补证、复核、驳回、再议和局部问话
10. 史馆、版本、归档、检索和结果回填
11. 翰林、Golden cases、评测和离线飞轮
12. 钦天监、预测、结算和命中率
13. 国力仪表盘
14. 邮件、企微和其他 MCP
15. Provider、Prompt、模型路由和成本
16. 前端页面、导航和移动端
17. 数据库、迁移、缓存和搜索
18. OpenTelemetry、SLO、错误预算和告警
19. CI、发布、attestation、Canary 和回滚
20. 数据安全、删除、真实客户数据和审计

对每个能力输出：

- CAPABILITY_ID
- 中文名称
- 用户价值
- 当前入口
- 前端文件
- 后端文件
- 数据对象
- API
- 事件
- Agent/Flow
- Prompt
- 测试
- 依赖
- Feature Flag
- sourceLabel
- 当前成熟度 L0–L6
- 是否是真实实现
- 是否依赖 Mock/Fallback
- 是否有重复实现
- canonical owner 候选
- 是否接入 DecisionTask 主链
- 是否存在第二状态机
- 是否存在租户风险
- 是否存在数据安全风险
- 缺失环节
- 推荐建设 Wave
- 推荐最终状态先留空，不判断 GA/Beta/Internal

必须专门检查：

1. 六部是否存在多套 registry、prompt、flow 或路由实现；
2. 同一个部门是否有多个 ID；
3. 前后端是否使用不同状态；
4. 页面是否显示真实事件；
5. Mock/Fallback 是否可达 production；
6. 已退役 BFF 是否仍被测试或代码引用；
7. 候选奏折和正式奏折是否可能重复；
8. 是否存在多个迁移权威；
9. 是否存在多个用户/租户数据权威；
10. 每个页面是否有真实后端 owner；
11. 每个后端能力是否有用户入口；
12. 每个功能是否有正常、失败、权限和恢复测试。

输出以下报告：

# FULL_COURT_V1 CAPABILITY CENSUS

## 1. Executive summary

- 功能总数
- L0–L6 数量
- 真实实现数量
- Mock/Fallback 数量
- 重复实现数量
- 未接入主链数量
- 无测试数量
- 无 UI 数量
- 无后端数量
- 安全阻塞数量

## 2. Capability registry

用结构化表格列出全部能力。

## 3. Duplicate implementation map

逐项列出：

- 重复能力
- 各套实现
- 当前调用方
- 推荐 canonical owner
- 其他实现应转 adapter、archive 还是 retire

## 4. Canonical backbone gaps

检查：

DecisionTask
→ ChancellorRouteDecision
→ OutboxEvent
→ DecreeExecutionEvent
→ DepartmentMemorial
→ CourtReview
→ FinalMemorial
→ EmperorDecision
→ ShiguanArchive

指出每一段是否真实连通。

## 5. Full-court dependency graph

列出所有能力的前置依赖。

## 6. Development waves

按以下原则编排：

Wave 1：统一底座
Wave 2：全部能力接入
Wave 3：逐项纵向跑通
Wave 4：全朝廷组合联调
Wave 5：失败和恢复
Wave 6：全量 UI
Wave 7：外部集成
Wave 8：质量评估与产品收敛

## 7. Proposed FULL_COURT_V1 frozen universe

列出本轮确定要实现的所有能力。

本轮以后新增想法进入 FULL_COURT_V2_BACKLOG。

## 8. First ten Task Packets

只给出前十项的建议：

- Task ID
- Goal
- Dependencies
- In scope
- Out of scope
- Acceptance criteria
- Verification
- Risk

除 census.md 外不得修改文件。
不得开始实现。
不得决定最终上线范围。
不得删除任何功能。
不得保留重复事实源。
不得把代码存在描述为功能跑通。

报告完整写入 census.md 后，聊天最后一行只输出：

CENSUS_READY_FOR_CLAUDE_REVIEW
或
CENSUS_NO_GO
```
