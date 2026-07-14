# 变更摘要：feat-dept-function-uplift-20260714

| 字段 | 值 |
| --- | --- |
| Change ID | feat-dept-function-uplift-20260714 |
| 类型 | feat |
| 状态 | DRAFT |
| Owner | Project Agent |
| 创建日期 | 20260714 |

## 范围

- 主线：backend（RAG 检索 / 史馆读链 / 翰林院读模型）
- 文件：`backend/src/sqlite_vec_rag.py`、`backend/scripts/seed_sqlite_vec_knowledge.py`、`backend/web/routers/chaotang.py`、`backend/web/routers/hanlin.py` + 3 个新测试文件
- 验证：`python3 -m pytest -q backend/tests/test_trust_tier_weighting.py backend/tests/test_shiguan_unified_read.py backend/tests/test_hanlin_truth_source.py backend/tests/test_hanlin.py backend/tests/test_sqlite_vec_rag.py`

## 三项功能提升（2026-07-14 吸收方案配套）

1. **trust_tier 检索加权**：docs 表补 trust_tier 列（旧库 ALTER 兼容）；检索按 tier 重排（statute×0.85 加权 / self_generated×1.25 降权 / 未标注平权）；seed 脚本剥离 provenance frontmatter（去首块噪声）并透传 trust_tier。
2. **史馆读链统一（K5 第一步）**：`/api/chaotang/archive` 把 canonical `ShiguanArchive` 行投影进 memorials/decisions（按 task_id 去重，canonical 优先，带 sourceLabel/synthetic），表空回退旧投影，老档案不丢。
3. **翰林院最小真源（P9）**：`/api/hanlin/experiments` 与 overview 接 truth_ledger——每条确定性判定即一次离线实验，账本空保持诚实 FALLBACK；不为奖项/孵化等无产品数据字段编造数字。

## 与 FULL_COURT 计划的关系

P9（翰林最小读模型）在 codex-absorption-plan 中有对应 Packet；本 change 先行落地最小版，FULL_COURT 会话执行到 P9 时应以本实现为基础增量，不重复造。已通过 bootstrap-authorization.md 渠道知会。

## 审批日志

- 方案批准：用户 2026-07-14 21:23"合 并让这几个部门的的功能实现最佳"。
- commit 批复：用户 2026-07-14 21:57 回"批 合"（diff stat 12 文件 +555/-17，含 code-reviewer 2H/3M/2L 全修复）。
