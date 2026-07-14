# 变更摘要：feat-absorb-knowledge-essence-20260714

| 字段 | 值 |
| --- | --- |
| Change ID | feat-absorb-knowledge-essence-20260714 |
| 类型 | feat |
| 状态 | DRAFT |
| Owner | Project Agent |
| 创建日期 | 20260714 |

## 范围

- 主线：backend 知识库（`backend/knowledge/docs/`）+ 根级方法论文档（`docs/knowledge-architecture/`）
- 文件：`backend/scripts/absorb_knowledge_essence.py`、`backend/tests/test_absorb_knowledge_essence.py`、24 篇吸收文档、移除 `backend/knowledge/docs/ima_archived/`（38 篇占位符）
- 验证：`python3 backend/scripts/absorb_knowledge_essence.py --check` + `python3 -m pytest -q backend/tests/test_absorb_knowledge_essence.py`

## 结论

对 K0A 封存的 16,234 项外仓资源完成人工裁决式吸收：**24 篇精华入库，其余明确拒收**（K0A 哈希快照原地封存可回查）。一次性抢救，非长效摄取管线（K2 仍待建）。

## 吸收清单（24 篇）

| 桶 | 数量 | 去向 | trust_tier |
| --- | --- | --- | --- |
| 法条（6 个律师 persona 的 statutes.md） | 6 | `backend/knowledge/docs/legal/` | `statute` |
| 电池行业硬知识（原位补 frontmatter） | 6 | `backend/knowledge/docs/*.md` | `curated` |
| 决策简报（courtos-brain 03-Outputs） | 1 | `backend/knowledge/docs/decisions/` | `curated` |
| 仙湖营销发布版（含硬数据） | 7 | `backend/knowledge/marketing_selfgen/（RAG 树外，检索加权落地前不入索引）` | `self_generated` |
| 知识库架构方法论（VAULT-GUIDE/控制台/自生长工作流） | 4 | `docs/knowledge-architecture/`（不入 RAG） | `methodology` |

每篇头部带 provenance frontmatter：`source_id / source_path / content_hash(sha256) / trust_tier / k0a_snapshot_token / absorbed_at`，溯源链直接挂 K0A manifest。

## 明确拒收（理由）

- `_wiki` 1,305 篇：concepts 100%、entities 99% 是从未合成的空壳 stub。
- 蜂群目录约 200 篇：`exit 141` / `No such file: openclaw` 失败日志。
- 00-Inbox / 01-Daily-Briefings / 02-Chancellor-Reports / 04-Offices：思维链裸 dump、运维日报、空报告、一次性文案。
- `brain.db` 88 条：联调流水账，summaries 表为空。
- 13,970 个 qdrant 向量：派生数据，入库文档重嵌即可。
- 营销"可发布"重复对 + `待核_含绝对化`（广告法风险）。
- `ima_archived/` 占位符：52 篇 17 字节全同 `contract evidence`，本 change 移除仓内 38 篇；K0A ima_docs 快照已封存哈希，无信息损失。

## 审批日志

- 方案批准：用户 2026-07-14 20:26 裁决吸收方案 + 20:30"继续" + 20:3x"同意 全面执行 并且wiki和ob 也要配置好"。
- commit 批复：用户 2026-07-14 20:55 回"批"（diff stat 68 文件 +1691/-38，含 Codex 复审两项修复）。
