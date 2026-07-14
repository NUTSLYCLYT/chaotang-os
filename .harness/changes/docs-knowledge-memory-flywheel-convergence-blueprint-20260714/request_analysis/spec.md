# 规格说明：docs-knowledge-memory-flywheel-convergence-blueprint-20260714

## 背景

用户要求吸收以前完成的 Obsidian、旧 Super Brain、知识库、史馆和飞轮资源，并把史馆、翰林院、知识内核和可信飞轮建设到可客观验收的 10 分。按既定工程纪律，本轮只调查和制定蓝图，不修改运行代码。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | live Vault 190 Markdown；仓内 archive 1700 files，二者快照不同 | read-only inventory/hash comparison，2026-07-14 | Project Agent | 是 |
| 已确认事实 | 仓内 Wiki 大量 stub 且有 stale source blocker | `audit_courtos_brain` | Project Agent | 是 |
| 已确认事实 | 旧 Super Brain 8099、watcher、Ollama 正在运行；已有 Qdrant/引用/记忆/增量摄取能力 | process/port/health、只读代码审查 | Project Agent | 否 |
| 已确认事实 | 旧 Super Brain 无 tenant/auth，不能直接成为生产事实源 | `/home/ubuntu/super_brain_backend/app.py` | Project Agent | 是 |
| 已确认事实 | 当前史馆写链与页面读链分裂；知识 required tests 有真实失败；翰林/部门学习为空 | 聚焦测试与代码证据 | Project Agent | 是 |
| 推测 | 26 个同路径不同 hash 是 live 更新或迁移清理差异 | 尚未逐项人工裁决 | Owner + migration review | 是 |
| 未知问题 | 旧 Qdrant point 的 owner/version/license 完整度 | 尚未只读导出 manifest | K0 implementation | 是 |
| 未知问题 | 历史客户资料的租户、许可、隐私和保留期限 | 当前 frontmatter 不完整 | Business/Data owner | 是 |

## 数据流与调用链

详见蓝图 §2：source → ingest snapshot/quarantine → versioned document/chunk → rebuildable index → CitationUsage → formal decision/archive → outcome → Hanlin eval → gated promotion。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| 正式归档 | `ShiguanArchive` | 史馆 UI、Outcome、Hanlin | 不允许 Obsidian/compat 成为第二写者 |
| 知识元数据 | SQL source/document/version/chunk | index/retrieval/audit | 向量库是 projection，可重建 |
| 检索引用 | Citation v2 + ClaimEvidenceLink | 蜂群、正式奏折、史馆 | 必须把具体 claim 绑定 version/chunk/hash/tenant/scope 及 supports/contradicts/context |
| 历史资源 | live Vault、仓内 archive、旧 Qdrant | migration adapter | 默认 quarantine，只读吸收 |
| 学习晋升 | HanlinExperiment/PromotionDecision | release control | shadow + golden + 角色化审批证据 + release identity + rollback；布尔值不构成批准 |

## 范围

只读调查、目标契约、10 分验收矩阵、边界条件、K0–K10 施工蓝图和第一最小闭环定义。

## 非目标

本轮不迁移正文、不写真实数据库/Vault/Qdrant、不停止旧服务、不修改 API/UI、不宣称生产 READY。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 历史资源冲突/失效/无归属 | quarantine，不自动晋升 | blueprint §5 |
| 索引或 embedding 不可用 | 元数据与 index 状态分离，不报告成功 | blueprint §5/K3 |
| 归档/隐私删除 | 检索清除与历史引用/法律保留分别处理 | blueprint §3/§5 |
| Q&A/LLM 派生知识 | derived_untrusted，不自动回流共享知识 | blueprint §5 |
| 外部 outcome 不足 | NO_DATA，最高 EXTERNAL_EVIDENCE_REQUIRED | blueprint §4.4/§11 |

## 风险与回滚边界

最大风险是把个人知识、客户证据、正式裁决和模型生成内容混成同一检索库，或永久维持多主同步。蓝图采用只读 source adapter、quarantine、版本化元数据、可重建索引和单向晋升。当前仅文档，可直接撤销，不影响运行时。

## 计划确认记录

- 批准人：用户（目标与历史资源吸收）；实施步骤尚待逐步确认
- 批准日期：2026-07-14
- 批准范围：调查与蓝图
- 明确未批准：运行时迁移、旧服务停机、真实数据写入、批量多 PR 实施

## 验收标准

调查结论有路径/运行/测试证据并明确终端摘要的复现缺口；计划与 canonical workflow 对齐；每步一个 PR 级闭环、含 RED/验证/回滚；明确 rubric 或外部证据不足时不能宣称 10 分。

## 验证计划

运行根 doctor、检查文档 diff、对抗审查蓝图的事实源、依赖、权限、迁移、删除、回滚和可验收性。
