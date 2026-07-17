# 已知红灯基线清单（收官前必须清零或显式 deferred）

> **战役燃尽计数（只减不增；新想法进 V2 backlog；口径=DONE 门 1 分母 P0–P9）**
> 门 1 Packet：**7/10 完成**（P0–P6）｜P7 实现候选待审 1｜P8 未开工 1｜P9 PARTIAL/残段核销待做 1
> 计划外加练包（不入门 1 分母）：P4.5、D6、P5.1/P5.2/P5.3 已完成；不得混入 7/10
> 红灯台账：OPEN 6（后端范围外 6）｜FIXED_PENDING_REVIEW 1（P7）｜前端 OPEN 0｜lint 裁决 1
> P7 对账：NOT_RUN 已由后续安全全量与 P6 full pytest 解除；deferred 汇总已落盘；仍缺 P9 顶层核销与 legacy/canonical 连续流量窗口
> 更新纪律：每合入一个 Packet/核销一项，本计数同 commit 递减；分母永不混入加练包。

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
| 1 | `test_commit_closeout_check.py`（1 项） | 测试依赖已搬迁的真实 `docs/qintianjian.md`，fixture 非自包含 | P7 `docs-absorption-closeout-20260717` 步骤一 | 临时 Git fixture 下重叠/已跟踪两分支均通过 | FIXED_PENDING_REVIEW（目标 RED；全文件 9 passed） |
| 2-5 | `test_lawyer_rag.py`（4 项） | 真实法条资源不可用/未命中 | 新立 `fix-lawyer-rag-statute-assets-<date>`（知识线，P3 开始前后皆可，独立于 P 序列） | 4 项全绿或资源缺失显式 skip+理由 | OPEN |
| 6 | `test_persona_registry.py`（1 项） | `munger` roster 分类 | 新立 `fix-persona-roster-munger-<date>`（单文件独立微修 change，非顺手夹带） | 该测试通过 | OPEN |
| 7 | `test_tianjian_verdict.py`（1 项） | 预期 6 项实际 9 项 | 新立 `fix-tianjian-verdict-contract-<date>`——先裁定 6 还是 9 是契约事实源，再改另一侧 | 测试与契约文档一致后通过 | OPEN |

## 前端 test:node 基线 7 失败（P0 起持续，1018 pass 口径）

| # | 测试 | 根因 | 执行单元 | 验收 | 状态 |
| - | --- | --- | --- | --- | --- |
| 1 | chaotang 1.0 secondary modules `active/pending` | 旧预期 vs 现状 | P6 change 步骤"陈旧断言清理" | 断言与产品现状一致后通过 | CLOSED（P6 `7f2745e`；frontend full 1041/1041） |
| 2 | 铁律4 招聘 BFF 零写主库 | 守门意图有效，锚定路径已退役（ENOENT） | P6 子步骤 a"失效守门语义迁移" | 零写主库守门重写为现行架构等价断言并通过；禁止无迁移退役 | CLOSED（现行 backend single-writer/auth 等价守门） |
| 3 | bureau page view `出纳司/国库司` | 旧 office 展示预期，无守门语义 | P6 子步骤 b"陈旧断言清理" | 断言与产品现状一致后通过 | CLOSED（现行 `国库司` 契约） |
| 4 | dispatchDeptToSwarm auth 守门计数 | 守门意图有效（auth 全覆盖），计数锚定退役 route | P6 子步骤 a | requireCourtSwarmAuth 守门改锚现行调用面（计数>0）并通过 | CLOSED（active POST decorator auth scan） |
| 5-7 | C1 学习持久化 / real-source / e2e 伪造后门（3 项） | 守门意图有效（数据隔离/sign-off/后门已除），锚定路径退役 | P6 子步骤 a | 三条守门逐一重写为现行架构等价断言并通过；威胁模型消失者单独说明后方可退役 | CLOSED（现行 learning/provenance/backend-route 守门） |

## 其他登记

## 2026-07-17 后续核销（P6 独立修复 worktree）

- 后端全量 pytest 已在持久 PTY 会话完成：**2697 passed / 37 skipped / 4 warnings**（223.24s）。
- 原残留 #2–#5：律师 RAG 路径修复后，`tests/test_lawyer_rag.py` 4 项通过；提交 `613553d`。
- 原残留 #6：芒格资料已达到判官席字节阈值，测试断言更新为当前事实；同提交 `613553d`。
- 原残留 #7：钦天监端点测试隔离共享 RAG，避免历史磁盘状态追加 3 条无关证据；提交 `853b9dd`。
- 组合回归：相关 42 项通过；未跟踪的 IMA archived 文件为测试产物，已核查并移除。
- 两个 mock router（`qintian_forecast.py`、`forecast_intel_taiyi.py`）仍保持原位：replacement、调用方迁移和连续 14 天零调用证据尚未完成，不能标记 RETIRED。

- lint script：前端 package.json 无 lint——P0 记 MISSING；是否补由用户裁决（不属 absorption 范围）。
- `test_chancellor_chat_streams_single_agent_reply`：依赖真实 LLM 字面量断言，代表套件长期 deselect——P7 收官时显式 deferred 或改造。
