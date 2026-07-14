# 规格说明：chore-knowledge-quality-rubric-k0b-20260714

## 背景

K0A 已证明历史资产存在，但不能回答“什么叫知识和飞轮达到10分”。K0B 只冻结判定标准：合同质量、纯检索质量、可信 outcome、成本/延迟、证据时效、owner 和重验条件。它不生成黄金案例，也不把现有 0 authenticated outcome 伪装成 PASS。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | launch S7 已冻结 P0=100%、P1≥90%、高风险 precision≥80%、引用覆盖/缺证标注100%、虚构条款0 | `plans/chaotang-os-launch-blueprint-2026-07-14.md:425-477` | Project Agent | 否 |
| 已确认事实 | 当前真实 outcome 燃料不足，历史 authenticated ratio 为0 | `backend/docs/quality_doctrine.md:93-113` | Project Agent | 是，证据状态只能 NO_DATA |
| 已确认事实 | 纯检索质量此前未与最终风险 precision 分开 | 知识飞轮蓝图 §4.2 与 launch S7 对照 | Project Agent | 已在本 rubric 分开 |
| 推测 | 每份20元成本上限能覆盖首轮 beta 模型调用 | 尚无真实定价/成本分布 | Product/Finance owner | 是，90天内或定价变化必须重审 |
| 未知问题 | 30条真实 settled outcome 何时形成 | 依赖5家试点和真实业务结果 | Pilot owner | 是，阻止 promotion/10分 |

## 数据流与调用链

`rubric JSON -> evaluator(report, now) -> scope/dataset/version/每次run/aggregate/outcome/economics/evidence 检查 -> PASS | FAIL | NO_DATA | EXPIRED -> release/promotion consumer`。当前没有真实 report，因此 project manifest 固定 `currentEvidenceStatus=NO_DATA`。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `knowledge-quality-rubric.v1` | 根 harness manifest | 合同质量 runner、Hanlin promotion、release gate | JSON Schema + exact threshold test |
| evaluation report | 后续只读 quality runner | 确定性 evaluator | 绑定 model/prompt/provider/KB/retriever/scorer/dataset version |
| result status | `evaluateKnowledgeQuality` | release/promotion | PASS 才可晋升；FAIL/NO_DATA/EXPIRED 全部阻断 |

## 范围

机器 rubric、schema、evaluator、测试、manifest/doctor/wiki 登记和蓝图状态更新。

## 非目标

不创建30条黄金合同；不接真实模型；不采集客户 outcome；不改 release gate；不封禁 legacy 写面；不改数据库/API/UI；不进入K0C/K1。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 样本不足/分母0 | `NO_DATA`，不得真空100% | node negative test |
| 任一运行回退但平均达标 | `FAIL`，3次运行逐次过门 | per-run regression test |
| 非大陆法域/非中文/非制造B2B | `FAIL` + 人工升级语义 | unsupported scope test |
| P0<100%、虚构条款>0、认证比<100% | `FAIL` | metric negative test |
| report>168h、结果快照>30天、黄金标签>90天或 rubric 到期 | `EXPIRED` | lifecycle expiry test |
| 缺版本/证据路径 | `NO_DATA` | missing identity test |
| authenticated>settled、settled>archive、未来时间 | `FAIL` | integrity test |

## 风险与回滚边界

最大风险是把任意阈值写成“客观真理”，或用平均数、空分母和过期证据制造绿灯。rubric 明确版本/复审日期，任何模型、prompt、provider、知识/许可、retriever、scorer、标签、法域、结果快照或发布候选变化必须重验。成本20元属于90天冻结的产品假设，不是永恒常数。

## 计划确认记录

- 批准人：用户（“下一步”）
- 批准日期：2026-07-14
- 批准范围：知识飞轮蓝图 K0B
- 明确未批准：K0C legacy 写面封禁、K1 schema、黄金案例生产、客户 outcome 采集、release gate 接入

## 验收标准

rubric/schema/manifest 登记完整；S7与纯检索指标分离；30 archives/30 settled/5 tenants/30 days/authenticated=100% 冻结；3次运行逐次过门；证据7天过期、结果快照30天、标签/rubric 90天复审；正反例和 doctors 通过。

## 验证计划

先观察 RED，再实现最小契约；运行 node test、JSON Schema validator、root相邻测试、root/backend doctor、diff/secret/placeholder scan；无UI故不跑浏览器。
