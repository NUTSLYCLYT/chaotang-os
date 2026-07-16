# 已知红灯基线清单（收官前必须清零或显式 deferred）

> **战役燃尽计数（只减不增；新想法进 V2 backlog）**
> Packet：已完成 7（P0/P1/P2/P3/P4/P4.5/D6 闸）｜进行中 1（P5）｜待开工 3（P6/P7/P8）+P9 残段核销
> 红灯台账：OPEN 14（后端 7+前端 7）｜lint 裁决 1｜deferred 待汇总 1
> 收官预备件（见 p7-dry-reconciliation.md）：4（P9 核销单/NOT_RUN 解除文书/legacy 计数快照/deferred 汇总页）
> 更新纪律：每合入一个 Packet/核销一项，本计数同 commit 递减。

> 建立：2026-07-15 08:20（P2 回归收尾后）。owner：absorption campaign。
> 规则：本清单是收官 P7 对账和 DONE 硬门"零未闭环验证残留"的对账底稿；
> 每项要么在对应 Packet 修复，要么在收官 claim 中显式 deferred+理由。
> 新增红灯必须追加到本清单，不得只留在单个 change 的 ci_summary 里。

归属规则：每项绑定唯一执行单元（既有 Packet 步骤或新立 change ID）+ 验收标准。
执行者一律 Codex（唯一写入者），完成即在本表勾销并引用 commit。
本表引用的 P6 子步骤 a/b 与 P7 步骤一已随 codex-absorption-plan.md **v2.1 增补**
落为方案正文（同批提交），不是台账虚指。

## 后端全量 pytest 残留 7 失败（2026-07-15 af064fb 口径）

| # | 测试 | 根因 | 执行单元 | 验收 | 状态 |
| - | --- | --- | --- | --- | --- |
| 1 | `test_commit_closeout_check.py`（1 项） | 文档重复主题检测 | P7 change（absorption-closeout）步骤一 | 该测试通过或断言修正有据 | OPEN |
| 2-5 | `test_lawyer_rag.py`（4 项） | 真实法条资源不可用/未命中 | 新立 `fix-lawyer-rag-statute-assets-<date>`（知识线，P3 开始前后皆可，独立于 P 序列） | 4 项全绿或资源缺失显式 skip+理由 | OPEN |
| 6 | `test_persona_registry.py`（1 项） | `munger` roster 分类 | 新立 `fix-persona-roster-munger-<date>`（单文件独立微修 change，非顺手夹带） | 该测试通过 | OPEN |
| 7 | `test_tianjian_verdict.py`（1 项） | 预期 6 项实际 9 项 | 新立 `fix-tianjian-verdict-contract-<date>`——先裁定 6 还是 9 是契约事实源，再改另一侧 | 测试与契约文档一致后通过 | OPEN |

## 前端 test:node 基线 7 失败（P0 起持续，1018 pass 口径）

| # | 测试 | 根因 | 执行单元 | 验收 | 状态 |
| - | --- | --- | --- | --- | --- |
| 1 | chaotang 1.0 secondary modules `active/pending` | 旧预期 vs 现状 | P6 change 步骤"陈旧断言清理" | 断言与产品现状一致后通过 | OPEN |
| 2 | 铁律4 招聘 BFF 零写主库 | 守门意图有效，锚定路径已退役（ENOENT） | P6 子步骤 a"失效守门语义迁移" | 零写主库守门重写为现行架构等价断言并通过；禁止无迁移退役 | OPEN |
| 3 | bureau page view `出纳司/国库司` | 旧 office 展示预期，无守门语义 | P6 子步骤 b"陈旧断言清理" | 断言与产品现状一致后通过 | OPEN |
| 4 | dispatchDeptToSwarm auth 守门计数 | 守门意图有效（auth 全覆盖），计数锚定退役 route | P6 子步骤 a | requireCourtSwarmAuth 守门改锚现行调用面（计数>0）并通过 | OPEN |
| 5-7 | C1 学习持久化 / real-source / e2e 伪造后门（3 项） | 守门意图有效（数据隔离/sign-off/后门已除），锚定路径退役 | P6 子步骤 a | 三条守门逐一重写为现行架构等价断言并通过；威胁模型消失者单独说明后方可退役 | OPEN |

## 其他登记

- lint script：前端 package.json 无 lint——P0 记 MISSING；是否补由用户裁决（不属 absorption 范围）。
- `test_chancellor_chat_streams_single_agent_reply`：依赖真实 LLM 字面量断言，代表套件长期 deselect——P7 收官时显式 deferred 或改造。
