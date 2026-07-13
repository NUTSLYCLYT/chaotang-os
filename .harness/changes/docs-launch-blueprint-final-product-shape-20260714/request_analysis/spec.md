# 规格说明：docs-launch-blueprint-final-product-shape-20260714

## 背景

S1 路径收敛已经以 `93a4483` 合入 ext，但上线蓝图仍记录旧快照和“尚未形成候选 PR”等过期结论；产品事实源虽已有“一条决策主线”草案，尚未冻结首发客户实际看到的界面、合同决策单最小字段和六部扩张门。本变更只校正文档事实与产品边界，不改变运行代码。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | S1 三个旧路径闭环已经合入 ext；产品事实源已将 `DecisionTask` 到 `ShiguanArchive` 定义为唯一任务聚合 | `git show --stat 93a4483`；`docs/product/PROJECT_PRODUCT.md` 5.1 | 工程负责人复核提交与文档 | 否 |
| 已确认事实 | 当前仍不满足生产 READY | `cd frontend && pnpm prod:doctor -- --json` | verification-loop，预期 STOP | 是，阻塞公开上线 |
| 已确认事实 | 历史测试污染过真实控制面 | `.harness/changes/incident-s1-real-db-test-pollution-20260713/`、`incident-s2-real-db-test-pollution-20260713/`、`incident-s10-control-db-v9-pollution-20260713/` | 事故记录与计划引用复核 | 是，要求 S2 隔离 |
| 推测 | 合同审查比六部全面展开更容易形成首笔付费 | `docs/product/PROJECT_PRODUCT.md` 8；本计划 S9 客户验证 | 只能由真实客户复用与付款验证 | 否，不冒充事实 |
| 未知问题 | 5 家客户是否会达到 3 家复用、1 家付费、1 条证言 | 尚无真实客户证据 | S9 试点验证 | 是，阻塞扩张 |

## 数据流与调用链

`合同/背景 -> 上书房 DecisionTask -> 丞相路由 -> outbox -> 军机处/刑部/蜂群分奏 -> 候选奏折 -> 御史确定性质量门 -> FinalMemorial -> 人工 EmperorDecision -> 导出/ShiguanArchive`。客户首发只直接操作上书房工作台、刑部决策单、圣裁确认和史馆档案；军机处及蜂群拓扑按需展开。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| 正式任务与路由 | `DecisionTask` / `ChancellorRouteDecision` | 上书房、军机处、状态读模型 | 单任务聚合；版本化路由 |
| 可靠派单与过程 | `OutboxEvent` / `DecreeExecutionEvent` | worker、军机处、观测 | 不以 HTTP 请求生命周期代替 durable execution |
| 候选与正式奏折 | `CourtReview.memorial_json` / `FinalMemorial` | 御史门、刑部决策单、圣裁 | 候选不得直接裁决；一旨最多一份正式奏折 |
| 合同风险项 | `riskLevel/evidence/explanation/missingEvidence/recommendedRevision/sourceLabel/engineTier` | 刑部决策单、质量门、导出 | 高风险必须有原文证据；fallback/demo 不得晋升 |
| 人工裁决与归档 | `EmperorDecision` / `ShiguanArchive` | 圣裁、史馆 | 不可逆动作必须人工确认；归档不可回写篡改 |

## 范围

- 校准上线蓝图的 ext 快照与 S1 已完成/未完成事实。
- 冻结首发客户界面、合同决策单最小稳定契约和扩张解冻门。
- 记录已确认事实、商业假设与未知客户证据的边界。

## 非目标

- 不实现新接口、数据库或 UI。
- 不把 ext 工作区其他待审代码纳入本变更。
- 不宣称 S1 完成、生产 READY 或已经获得付费验证。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 缺少原文证据 | 高风险结论不得晋升，进入补证 | 产品事实源 5.1.2；S7 黄金门 |
| 来源是 FALLBACK/DEMO | 明确降级，不得成为正式奏折 | 产品事实源 5.1；计划 1.4 |
| AI 生成结果但无人确认 | 只能停留在候选/待裁决 | 产品事实源 5.1；计划 1.4 |
| S1 已合入但 3050 仍属旧进程 | `prod:doctor` 保持 STOP，接管归 S3 | 计划 S1/S3 |
| 真实客户证据未达标 | 不解冻第二条付费切片 | 产品事实源 5.1.3；计划 S9 |

## 风险与回滚边界

只修改产品与计划文档以及根级 change record。回滚可逐文件撤销，不影响数据库和运行服务。主要风险是把商业假设写成已验证事实，因此文档明确区分“冻结的产品选择”与“S9 尚待客户验证的假设”。

## 计划确认记录

- 批准人：用户
- 批准日期：2026-07-14
- 批准范围：整合成果至 ext、完善整体主线、确定最终产品形态
- 明确未批准：公开生产发布、外部客户触达、自动执行不可逆动作

## 验收标准

- `PROJECT_PRODUCT.md` 与上线蓝图对首发产品、客户界面、风险项字段和扩张门口径一致。
- 蓝图不再把已由 `93a4483` 完成的三个 S1 闭环列为未执行。
- 根级 doctor、文档差异检查、敏感信息扫描通过；`prod:doctor` 的 STOP 被如实记录。
- 独立蓝图会审无未处理的阻断问题。
- 首发范围冻结法域、语言和合同类型；不支持范围 fail closed 并转人工。

## 验证计划

- `node scripts/harness-doctor.mjs`
- `git diff --check`
- `git diff -- docs/product/PROJECT_PRODUCT.md plans/chaotang-os-launch-blueprint-2026-07-14.md`
- ext 候选提交执行完整 `verification-loop`；生产 doctor 预期 STOP。
