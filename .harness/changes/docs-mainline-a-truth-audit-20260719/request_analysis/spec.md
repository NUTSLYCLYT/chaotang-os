# 规格说明：docs-mainline-a-truth-audit-20260719

## 背景

主线 A 策略（业主 2026-07-18 批准牌 A：内测上线）第一步是闭环真实度审计：
上菜前先盘库，逐环节标注 真实 / 降级 / 假数据，避免把上线计划建在未盘点的
库存上。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 锦衣卫取证零网络请求，URL 模板拼接，CIK 仅 AAPL/MSFT | `finance_intel_loop_contract.py:139-148,15-18`，2026-07-19 直读 | Claude 源码审计 | 是，阻断上线（PKT-A1 修） |
| 已确认事实 | source_label 硬编码 LIVE_SWARM 两处 | `finance_intel_loop_contract.py:471`、`shangshufang.py:2078` | 同上 | 是，诚实纪律 HIGH（PKT-A1 修） |
| 已确认事实 | 户部核算诚实拒算；主线输入永缺 → 永不算 | `finance_intel_loop_contract.py:106-136` + 前端 body 仅 ticker/market/question | 同上 | 否，PKT-A2 修 |
| 已确认事实 | 红线体系已在 ext（禁三类输出+非建议声明+人工确认） | `shangshufang.py:1983-1987,2034-2037` | 同上 | 否，正向发现 |
| 已确认事实 | 真实检索设施存在未接线 | `backend/src/jinyiwei_search.py`（Tavily，缺 key 诚实退空） | 同上 | 否 |
| 未知问题 | EDGAR API 当前限流政策细节 | 不适用 | PKT-A1 开工时确认 | 否 |

## 数据流与调用链

见 `truth-audit.md` 九环节表。

## 范围

- 新增 `truth-audit.md`：九环节三态表、已有资产盘点、缺口整改包 PKT-A1~A3 排序。
- 本 change 四件套。

## 非目标

- 不修任何发现的问题（含 HIGH 假标）——审计只审计，整改走独立 packet。
- 不跑 E2E、不起服务。

## 风险与回滚边界

docs-only，删目录即回滚。最大风险是审计遗漏隐藏的真实取证路径——已用
`rg httpx|requests` 全后端扫描交叉验证（finance-intel-loop 链内无命中）。

## 计划确认记录

- 批准人：项目业主
- 批准日期：2026-07-18（牌 A 队列批准，含本审计包）
- 批准范围：只读审计 + docs-only 快批线。
- 明确未批准：顺手修复任何发现、改实现/测试、推送 ext。

## 验收标准

1. 九环节全部有 file:line 证据，三态标注。
2. HIGH 问题明确列出且不顺手修。
3. 整改包排序有理由（真取证+诚实标捆绑逻辑成文）。
4. doctor 0 errors；diff 只含本 change 目录。

## 验证计划

源码直读 → 三态表成文 → doctor → diff 复核 → 业主审批。
