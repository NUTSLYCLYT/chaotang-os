# 已知红灯基线清单（收官前必须清零或显式 deferred）

> 建立：2026-07-15 08:20（P2 回归收尾后）。owner：absorption campaign。
> 规则：本清单是收官 P7 对账和 DONE 硬门"零未闭环验证残留"的对账底稿；
> 每项要么在对应 Packet 修复，要么在收官 claim 中显式 deferred+理由。
> 新增红灯必须追加到本清单，不得只留在单个 change 的 ci_summary 里。

## 后端全量 pytest 残留 7 失败（2026-07-15 af064fb 口径）

| # | 测试 | 根因 | 建议归属 |
| - | --- | --- | --- |
| 1 | `test_commit_closeout_check.py`（1 项） | 文档重复主题检测 | P7 收官对账时一并修 |
| 2-5 | `test_lawyer_rag.py`（4 项） | 真实法条资源不可用/未命中 | 知识线（K 系列）或 P6 前处理；与 absorb-knowledge 内容有关 |
| 6 | `test_persona_registry.py`（1 项） | `munger` roster 分类 | 小修，任意 Packet 顺带（单文件豁免） |
| 7 | `test_tianjian_verdict.py`（1 项） | 预期 6 项实际 9 项 | 钦天监契约漂移，P3/P6 界定 |

## 前端 test:node 基线 7 失败（P0 起持续，1018 pass 口径）

| # | 测试 | 根因 | 建议归属 |
| - | --- | --- | --- |
| 1 | chaotang 1.0 secondary modules `active/pending` | 旧预期 vs 现状 | P6（陈旧断言更新） |
| 2 | 铁律4 招聘 BFF 零写主库 | 引用已退役 BFF route（ENOENT） | P6 死测试退役 |
| 3 | bureau page view `出纳司/国库司` | 旧 office 预期 | P6 |
| 4 | dispatchDeptToSwarm auth 守门计数 | 退役 dispatch route，预期≥4 实际 0 | P6 |
| 5-7 | C1 学习持久化 / real-source / e2e 伪造后门（3 项） | 引用已退役 BFF route（ENOENT） | P6 死测试退役 |

## 其他登记

- lint script：前端 package.json 无 lint——P0 记 MISSING；是否补由用户裁决（不属 absorption 范围）。
- `test_chancellor_chat_streams_single_agent_reply`：依赖真实 LLM 字面量断言，代表套件长期 deselect——P7 收官时显式 deferred 或改造。
