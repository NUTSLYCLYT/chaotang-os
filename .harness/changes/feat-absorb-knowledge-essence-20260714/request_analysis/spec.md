# 规格说明：feat-absorb-knowledge-essence-20260714

## 背景

K0A 已封存 7 个外仓知识源共 16,234 项（accepted=0，全部隔离区）。K1–K6 摄取管线未建，但飞轮 0 燃料在转空轮。用户裁决：不等控制面，按人工白名单一次性吸收精华，frontmatter 记账代替控制面表。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 16,234 项中精华仅 24 篇（_wiki 78% 空壳 stub、蜂群目录为失败日志、brain.db 为联调流水账、ima_archived 52 篇 17 字节全同占位符） | 两次 Explore 子代理审计报告，2026-07-14 20:2x；md5/sha256 抽验 | 已验证 / Project Agent | 否 |
| 已确认事实 | `sqlite_vec_rag.ingest_dir` rglob 子目录自动入库；frontmatter 为 Obsidian 原生格式 | `backend/src/sqlite_vec_rag.py:139` | 已验证 | 否 |
| 推测 | frontmatter 块会作为首个 chunk 进入索引，属可接受噪声 | `knowledge_rag.py:407-441` 分块逻辑 | 检索质量回归时复查 | 否 |

## 数据流与调用链

白名单（脚本内 `_manifest()`）→ 读源文 → sha256(正文) → 写 frontmatter+正文到目标桶 → 运行时 `ingest_dir` 建索引 → `knowledge_vet` 接地检查消费 `trust_tier`（后续接线）。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| provenance frontmatter（source_id/source_path/content_hash/trust_tier/k0a_snapshot_token/absorbed_at） | `absorb_knowledge_essence.py` | RAG 索引、未来 K2 摄取管线、Obsidian | `--check` 模式 + pytest 哈希校验 |

## 范围

24 篇吸收 + ima_archived 移除 + 脚本与测试。详见 `../summary.md`。

## 非目标

- 不建 K1 控制面表 / Citation v2 / K2 长效摄取管线。
- 不迁移 qdrant 向量（重嵌代替）。
- 不改 RAG 检索端 trust_tier 加权逻辑（后续小 change 单独做）。
- 不动仓外活库 `/home/ubuntu/CourtOS-Brain`（wiki/OB 配置属另一工作项）。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 重跑脚本 | 幂等，`absorbed=0 already_ok=24` | 已实测两次运行 |
| 目标文件被手改 | `--check` 报 hash mismatch 退出码 1 | 单测覆盖 |
| 源文件带自有 frontmatter | 视为正文不误伤（仅识别含 absorbed_at 的自产头） | 单测覆盖 |

## 风险与回滚边界

- 回滚 = revert 本 commit；源文件未删（personas/courtos-brain 原件保留），K0A 快照哈希在案。
- ima_archived 移除不可从工作区恢复，但内容为 17 字节常量占位符，K0A 已记录哈希。

## 计划确认记录

- 批准人：用户
- 批准日期：2026-07-14
- 批准范围：吸收方案（20:26 裁决）+ 全面执行（20:3x）
- 明确未批准：commit（待 diff stat 批复）

## 验收标准

`--check` 零错误；pytest 4 项通过；harness-doctor 零错误；diff 中无白名单外内容文件。

## 验证计划

```bash
python3 backend/scripts/absorb_knowledge_essence.py --check
python3 -m pytest -q backend/tests/test_absorb_knowledge_essence.py
node scripts/harness-doctor.mjs
```
