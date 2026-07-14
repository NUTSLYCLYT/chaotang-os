# 朝堂 OS · 史馆、翰林院、知识内核与可信飞轮 10 分建设蓝图

> 日期：2026-07-14
> 状态：K0A_K0B_IMPLEMENTED_LOCAL / EXTERNAL_EVIDENCE_REQUIRED / K0C_PENDING_OWNER_APPROVAL
> 本文件只做调查、契约和施工排序，不代表运行时已实施或生产 READY。
> 上位施工权威：`chaotang-os-single-fact-source-convergence-blueprint-2026-07-14.md` 的 C0–C10。
> 上线约束：首发仍冻结为刑部合同审查决策工作台，不因知识工程扩大客户导航。

## 0. 结论

这四块不是四套产品，而是同一道旨的离线可信学习链：

```text
正式任务与外部资料
  -> 知识摄取暂存区（不可信）
  -> 来源/许可/租户/秘密/重复/时效/引用验证
  -> 版本化知识文档与可重建索引
  -> 蜂群检索并留下 CitationUsage
  -> FinalMemorial / EmperorDecision
  -> ShiguanArchive（当时事实不可变）
  -> OutcomeEvent（后来真实结果，追加式）
  -> 翰林院离线 eval / 策论 / 候选改进
  -> 黄金案例 + shadow 对照 + 人工批准
  -> 新 prompt / rule / retriever 版本晋升或回滚
```

唯一原则：**吸收能力和历史证据，不吸收旧系统的终态写权。**

- `ShiguanArchive` 是正式归档事实源；Obsidian 不是线上事务数据库。
- SQL 元数据/版本/授权是知识控制面事实源；向量库只是可删除、可重建的检索投影。
- 翰林院只能产生实验、评测和晋升建议，不能直接改线上 prompt、规则或知识。
- 飞轮只认 canonical task、可核引用和外部真实结果；自评分、Q&A 自回流和孤儿运行不能晋升。
- 旧 Super Brain 在迁移开始前必须先封禁 Vault/brain DB/Qdrant 写面和 Q&A 回流；迁移期只允许只读 query/observation。等价能力、迁移校验、观察期和回滚证据完成后退役，不永久双主。

## 1. 当前资源调查

### 1.1 已确认资产

| 资产 | 当前事实 | 可吸收能力 | 不可直接继承 |
| --- | --- | --- | --- |
| `/home/ubuntu/CourtOS-Brain` | 190 个 Markdown，约 0.93 MB；live watcher 正在监听；只读 audit 当前无 blocker | 原始证据分层、Obsidian 编辑体验、外部只读源 | 无租户/对象授权；不是正式归档库 |
| 仓内 `courtos-brain/` | 1700 文件、1672 Markdown、约 4.9 MB；比 live vault 多 1517 条路径 | 丰富历史资料、source/concept/entity 结构、控制台与人工工作流 | 598/598 concept 为 stub、430/434 entity 为 stub；存在 stale source blocker；不能成为第四工作入口 |
| `/home/ubuntu/super_brain_backend` | 8099 正在运行；Qdrant 约 121.7 MB；brain.db 有 88 条 message；watcher 正在运行 | 增量监听、digest 去重、Qdrant、引用返回、上下文预算、会话摘要/事实记忆、Wiki 编译 | API 无 auth/tenant；可直接写 Vault；全量同步不排除控制文件；hash embedding 可静默降级；Q&A 可自我回流放大错误 |
| `backend/src/knowledge/` | 已有 `KnowledgeSource`、`Citation`、多源 adapter 和 router | 作为唯一检索适配层继续扩展 | Citation 缺文档版本、租户、内容 hash、许可、时间和可撤销状态 |
| `backend/src/knowledge_rag.py` / `sqlite_vec_rag.py` | 默认 sqlite-vec；支持 tenant filter 和 scope | 保留本地可重建索引、离线 embedding fallback | 当前环境缺 `sqlite_vec`；required tests 有 skip/fail；删除/版本化不完整 |
| IMA store/API | 上传、列表、active/archive 元数据已接线 | 上书房补证入口、文件级状态 | 归档不能删除已索引 chunk；目录和元数据仍以 default/global 为主；索引失败被吞掉 |
| 法条库 | 仓根已有 6 组 lawyer statutes | 刑部首发的共享、版本化法域知识 | `lawyer_rag.py` 当前从 `backend/skills/personas` 查找，真实路径在仓根 `skills/personas`，聚焦测试 4 项失败 |
| `ShiguanArchive` | model、人工裁决后写入和质量门测试已存在 | 作为唯一正式归档聚合 | 页面读另一套 `/api/chaotang/archive`；formal list/detail/verdict/retrospective 多为 FALLBACK；真实 DB 当前 0 archive |
| 翰林院 | 前端组件丰富；后端结构响应稳定 | UI/契约外壳、角色和实验概念 | 无 App Router 页面；后端列表全部为空；无持久化实验、eval、晋升门 |
| truth ledger / nightly flywheel | 幂等、确定性 checker、ratchet 和日报代码已有 | 作为评测/晋升证据基础 | 当前 health 读到 857 entries 但 0 deterministic、0 authenticated；外部真实结局未闭环；部门学习 API 为空 |

### 1.2 当前直接失败证据

- 史馆/归档聚焦测试：31 passed，但 contract test 明确接受 FALLBACK 空案卷，不能证明用户读到 `ShiguanArchive`。
- 翰林院/department learning：8 passed，只证明“空数组不 404”。
- 知识库聚焦测试：25 passed、6 failed、16 skipped；法条检索 4 项失败，case archive 入库 2 项因缺 `sqlite_vec` 失败。
- 飞轮机制测试：40 passed、2 skipped；只能证明代码机制，不证明真实结果燃料。
- 当前默认环境：`CHAOTANG_RAG_BACKEND` 未设置，默认 sqlite-vec；`sqlite_vec` 与 `chromadb` 均不可 import。

### 1.3 已确认、推测、未知

| 分类 | 结论 | 证据 | 是否阻塞 |
| --- | --- | --- | --- |
| 已确认 | live Vault 和仓内归档不是同一快照 | relative path/hash：183 shared，157 identical，26 different；两侧各有 unique | 是 |
| 已确认 | 仓内 Wiki 数量大但绝大多数是 stub | `audit_courtos_brain` counts | 是 |
| 已确认 | 旧 Super Brain 缺少 auth/tenant | `app.py` 路由无 dependency/auth middleware，检索无 tenant filter | 是 |
| 已确认 | 正式史馆写链与页面读链分裂 | `shangshufang._archive_task` vs `useArchiveRecords('/api/chaotang/archive')` | 是 |
| 已确认 | 向量索引不可当事实源 | IMA archive 无 delete；旧 Qdrant/当前 sqlite-vec 都是派生索引 | 是 |
| 推测 | 26 个同路径不同 hash 可能是 live 后续修改或仓内迁移清理 | 尚未逐项人工裁决 | 是 |
| 推测 | 旧 Qdrant 中包含 190 篇 live Vault 的大部分 chunk | 只有文件体积和运行状态，未做逐文档 manifest 对账 | 是 |
| 已确认 | 旧 Qdrant 有 2 collections / 13,970 points，vector size 768；观察到的 payload keys 不含 owner/version/license | K0A 脱敏 manifest `sha256:817585...967c` | 是，全部 quarantine |
| 未知 | 历史资料许可、客户归属、隐私和保留期限 | 当前 Markdown frontmatter 不完整 | 是 |
| 未知 | 5 家试点能提供多少外部 outcome 回填 | 需业务 owner 与客户流程 | 是，阻止飞轮 10 分 |

### 1.4 可复核代码证据索引

以下路径是本轮结论的代码/文档事实源；终端计数仍须由 K0A 固化为可复跑的脱敏 manifest，当前不能仅凭本表宣称迁移基线已冻结。

| 结论 | 代码或文档证据 |
| --- | --- |
| 外部 Vault 与旧 Super Brain 是受保护运行依赖 | `backend/docs/runtime_dependency_inventory.md:14-21` |
| 正式归档模型与写入链存在 | `backend/src/db/models.py:356`；`backend/web/routers/shangshufang.py:468` |
| 史馆前端读取 `/api/chaotang/archive` | `frontend/src/features/shiguan/lib/use-shiguan.ts` |
| 兼容史馆接口含 FALLBACK/空态 | `backend/web/routers/governance_compat.py:185-321`；`backend/tests/test_chaotang_study_archive.py:25-27` |
| 翰林后端当前是隔离空壳 | `backend/web/routers/hanlin.py`；`backend/tests/test_hanlin.py:61` |
| 当前知识抽象及 Citation 契约 | `backend/src/knowledge/base.py`；`backend/src/knowledge/adapters.py`；`backend/src/knowledge/router.py` |
| IMA 归档不能清除既有索引块 | `backend/src/ima_knowledge_store.py:9` |
| 法条读取路径与实际资产根不一致 | `backend/src/lawyer_rag.py`；`skills/personas/*-lawyer/references/statutes.md` |
| 当前飞轮缺外部认证真值 | `backend/docs/quality_doctrine.md:93-113`；`backend/web/routers/department_learning.py` |
| 仓内知识归档不能成为第四主线 | `.harness/rules/project-boundaries.md`；`courtos-brain/VAULT-GUIDE.md` |

### 1.5 根因分析

| 根因 | 已确认表现 | 不是根因的表象 |
| --- | --- | --- |
| 缺少统一、版本化且带租户授权的知识控制面 | 当前 Citation 字段不足；Obsidian、IMA、sqlite-vec、Qdrant 各自持有局部状态 | “向量库选得不够先进” |
| 正式归档写模型与用户读取 projection 分裂 | `ShiguanArchive` 写链存在，但页面和 compat 仍读另一套 archive/FALLBACK | “史馆页面组件不够丰富” |
| 评测机制与外部真值没有可信关联 | truth ledger 有机制数据，但 authenticated outcome 为 0；department learning 为空 | “模型还不够聪明” |
| 历史资产没有 owner/license/retention/version manifest | live Vault、仓内 archive、旧 Qdrant 无法安全自动合并 | “资料数量不够多” |
| 摄取、引用、归档、删除和晋升没有共同处置协议 | IMA archive 不删索引；旧 Q&A 可回流；原文可复制到多种派生物 | “再补一个同步脚本就行” |

因此最高杠杆不是再建一套知识库或导航，而是先完成可复核 inventory，再建立唯一控制面与 claim-evidence 契约，最后才允许历史资料晋升和飞轮学习。

## 2. 目标数据流与信任边界

```text
┌──────────────────── 不可信来源区 ────────────────────┐
│ Obsidian / IMA / 上传 / 法条 / legacy Qdrant / Web   │
└───────────────────────┬──────────────────────────────┘
                        ▼
              KnowledgeIngestRun + SourceSnapshot
        path guard / MIME / size / secret / license / tenant
                        ▼
                   QUARANTINED
             normalize / content_hash / dedupe
             PII / prompt-injection / staleness vet
                        ▼ owner/policy approval
                  KnowledgeDocument
                        │
                  KnowledgeVersion
                        │
              KnowledgeChunk + CitationTarget
                        │
           ┌────────────┴────────────┐
           ▼                         ▼
    sqlite-vec/dev projection   future prod projection
           └────────────┬────────────┘
                        ▼
              KnowledgeRouter.retrieve
                        ▼
                 CitationUsage
          task/tenant/query/model/prompt/retriever version
                        ▼
         DepartmentOpinion -> FinalMemorial -> Decision
                        ▼
                 ShiguanArchive
               immutable “当时怎么判”
                        ▼
                   OutcomeEvent
               append-only “后来怎样”
                        ▼
              HanlinExperiment / EvalRun
                        ▼
       shadow -> golden gate -> human approval -> release
```

### 2.1 四类知识域

| scope | 内容 | 默认可见性 | 是否可进正式奏折 |
| --- | --- | --- | --- |
| `platform_shared` | 法条、公开标准、已批准方法论 | 全租户只读 | 可以，必须带版本与引用 |
| `tenant_private` | 客户合同、企业资料、客户复盘 | 同租户授权用户 | 可以，必须对象授权 |
| `user_private` | 个人偏好、私人笔记、对话记忆 | 仅本人/显式委托 | 默认不可以，需用户晋升 |
| `task_evidence` | 某正式任务上传的证据 | 任务参与者 | 可以，是最高优先级证据 |

Obsidian 默认进入 `user_private` 或 quarantine，不得默认变成 `platform_shared`。历史铭硕/客户资料若无法确定 tenant，进入 `unknown_owner` quarantine。

## 3. 核心契约

### 3.1 控制面对象

| 对象 | 必需字段 | 唯一写者 |
| --- | --- | --- |
| `KnowledgeSourceRecord` | `id,type,scope,tenant_id,owner_id,root_uri,read_only,license_grant_id,retention_policy_id,status` | knowledge admin service |
| `KnowledgeIngestRun` | `id,source_id,snapshot_id,started_at,finished_at,discovered,accepted,quarantined,rejected,manifest_hash,error` | ingest worker |
| `SourceSnapshot` | `source_uri,content_hash,size,mtime,source_version,observed_at` | source adapter |
| `KnowledgeDocument` | `id,tenant_id,owner_id,scope,title,status,current_version_id,source_id` | promotion service |
| `KnowledgeVersion` | `id,document_id,content_hash,content_ref,source_snapshot_id,valid_from,valid_to,license_grant_id,license_policy_version,source_label` | promotion service |
| `KnowledgeChunk` | `id,version_id,ordinal,text_hash,content_ref,token_count,index_state` | chunker/indexer |
| `KnowledgeAccessGrant` | `subject_type,subject_id,document_id,permission,purpose,granted_by,expires_at,revoked_at,policy_version` | authorization service |
| `TaskEvidenceBinding` | `task_id,document_id,tenant_id,participant_policy_version,status` | canonical task service |
| `LicenseGrant` | `provenance,allowed_use,tenant_visibility,model_processing,redistribution,territory,effective_at,expires_at,evidence_ref,revoked_at,approved_by` | knowledge/data owner |
| `RetentionPolicy` | `scope,retention_period,legal_hold_priority,disposition,approved_by,policy_version` | privacy/legal owner |
| `LegalHold` | `id,tenant_id,scope,object_refs,legal_basis,evidence_ref,placed_by,placed_at,expires_at,released_by,released_at,status,policy_version,supersedes_hold_id` | authorized legal service |
| `CitationUsage` | `task_id,tenant_id,actor_id,purpose,request_id,authz_policy_version,chunk_id,version_id,query_hash,rank,score,retriever_version,used_at` | retrieval boundary |
| `ClaimEvidenceLink` | `artifact_id,artifact_version,claim_id,citation_id,relation,claim_text_hash,excerpt_hash,validator,verdict,policy_version` | formal evidence gate |
| `ArchiveOutcomeEvent` | `archive_id,tenant_id,task_id,event_type,actual,source_type,source_auth_level,occurred_at,recorded_at,recorded_by,evidence_ref,idempotency_key,supersedes_event_id,payload_hash` | authorized outcome service |
| `HanlinExperiment` | `id,hypothesis,dataset_version,baseline,candidate,metrics,status,owner` | hanlin offline service |
| `KnowledgePromotionDecision` | `experiment_id,candidate_version,policy_version,action,reason,approved_by,approved_at,release_id,idempotency_key,evidence_manifest_hash,rollback_ref` | authorized release service |
| `DeletionRequest / DeletionEvidence` | `subject_or_object_ref,scope,reason,approved_by,legal_hold_ids,targets,completed_at,manifest_hash` | privacy disposition service |

### 3.2 Citation v2

现有 Citation 保留，并 additive 增加：

```text
citation_id, document_id, version_id, chunk_id,
tenant_id, scope, content_hash, source_uri,
source_label, observed_at, valid_at,
license_grant_id, license_decision_version, use_purpose,
retriever_version, score_breakdown, content_ref,
excerpt_ciphertext?, excerpt_hash?, excerpt_expires_at?
```

不得保存无版本许可字符串。Citation 默认保存受控 `content_ref + hash`，不长期复制正文；确需 excerpt 时必须限长、加密、可撤销并有到期时间。任何高风险合同结论必须通过 `ClaimEvidenceLink` 绑定到 `version_id + chunk_id + content_hash`，并声明 supports/contradicts/context；“曾检索到”、只有标题或 URL 均不算可核引用。`FinalMemorial` 的 evidence manifest 固化这些链接的确定性 hash，史馆归档引用同一 manifest。许可到期/撤销会触发 source/document/citation disposition：停止新检索，历史引用只显示该许可允许的最小审计信息。

### 3.3 状态机

```text
DISCOVERED -> QUARANTINED -> VETTED -> ACTIVE
                         \-> REJECTED
ACTIVE -> SUPERSEDED | ARCHIVED | TOMBSTONED
```

- `ARCHIVED`：停止新检索，但保留历史 Citation 解析。
- `TOMBSTONED`：隐私/许可删除；检索索引必须清除，历史只保留不可逆最小审计 hash（受 legal hold 约束）。
- 任何状态变化追加事件；不物理覆盖历史版本。

### 3.4 删除、法律保留与不可变档案

“不可变”约束的是裁决事件与审计顺序，不等于永久保留可识别正文。处置顺序为：服务端查询有效 `LegalHold`（客户端不得提交布尔状态）→ 校验授权 → 冻结目标清单 → 删除/密文化受控内容 → 追加 redaction/tombstone envelope → 清理派生投影 → 生成不可逆对账证据。hold 的创建、到期、解除和 supersedes 都必须有角色化审批与证据引用；解除后处置任务从审计 checkpoint 继续。

| 载体 | 正常删除 | legal hold | 删除后保留 |
| --- | --- | --- | --- |
| source/object/chunk/vector/cache | 删除内容与检索投影 | 冻结并限制访问 | object/hash/id 与处置事件 |
| Citation/CitationUsage | 撤销 excerpt/content_ref 解析 | 仅授权角色可解析 | citation id、hash、用途、授权快照 |
| FinalMemorial/ShiguanArchive | redact/tombstone envelope，不重写事件顺序 | 冻结 payload 并记录 hold | 裁决元数据、不可逆 hash、删除事件 |
| Outcome/truth ledger/Hanlin dataset | 删除或不可逆匿名化派生内容，重算 dataset | 冻结对应版本 | event/dataset/version hash 与处置状态 |
| export/backup | 撤销导出、进入备份到期/恢复后二次删除队列 | 阻止到期清除 | deletion manifest 与恢复重放证明 |

删除完成必须机器对账上述所有载体；只删 chunk/vector 不算 DSAR 完成。授权撤销后，历史引用只按当时授权快照显示最小审计信息，默认不再解析正文。

## 4. 10 分验收矩阵

“10 分”只在以下硬门全部有真实证据时成立。K0B 已冻结机器 rubric，但当前黄金合同与 authenticated settled outcome 尚未形成，证据状态仍是 `NO_DATA / EXTERNAL_EVIDENCE_REQUIRED`，不能预先判 9 分或 10 分。

### 4.1 史馆 10 分

1. 页面 list/detail/search/retrospective 只读 `ShiguanArchive` projection。
2. `FinalMemorial + EmperorDecision + evidence manifest` 同事务归档。
3. 当时快照不可修改；后续结果只追加 `ArchiveOutcomeEvent`。
4. tenant/user/object authorization 攻击测试全拒绝。
5. 每个档案可验证 source/version/hash，伪 LIVE 与缺证高风险无法归档。
6. 同一 decision replay 不重复建档；并发有唯一约束。
7. 导出、隐私删除、legal hold 语义明确。
8. list/detail/search/recall 的 trace、latency、empty/fallback 可观测。
9. 备份恢复后 archive/event/citation 数量与 hash 对账一致。
10. 真实浏览器完成建案→裁决→史馆查看→结果回填。

### 4.2 知识内核 10 分

1. 全部 source 有 owner/scope/tenant/license/retention。
2. 同 snapshot 重跑新增 document/version/chunk 均为 0。
3. 100% 检索命中能解析到不可变版本和 source snapshot。
4. 跨 tenant/user/task 检索泄漏为 0。
5. archive/tombstone 后新检索命中为 0，历史引用仍按政策可解释。
6. embedding backend/维度/version 变化可全量 rebuild，不改事实元数据。
7. 必需依赖安装且 required tests 不因 backend 缺失 skip。
8. 30+ 合同黄金检索问题达到 K0B 冻结的分层 recall/precision 数值，虚构引用为 0；测试集、负责人、证据过期时间和重验条件均入 manifest。
9. prompt injection、秘密、PII、超大文件、恶意路径进入 quarantine。
10. import manifest 对 live Vault、仓内 archive、旧 Qdrant 的 accepted/quarantine/rejected 总数可对账。

### 4.3 翰林院 10 分

1. 只做离线研究，不进入实时裁决链。
2. 实验有冻结 dataset、baseline、candidate、metric、owner 和版本。
3. 传话失真、检索引用、缺证、封驳原因、押注/结果至少五类 eval 可运行。
4. candidate 不优于 baseline 时硬拒绝；平手不晋升。
5. 线上变更必须 shadow、人工批准、可回滚。
6. 失败样本自动进入待标注池，不能自动成为真值。
7. 页面展示真实 experiment/eval/promotion 数据，不使用 mock/空壳伪 implemented。
8. RBAC 从服务端身份派生，客户端角色头不能提权。
9. 每次晋升带 release identity、prompt/rule/retriever/KB version。
10. 至少一次错误候选被门拒、一次合格候选晋升并成功回滚的演练证据。

### 4.4 可信飞轮 10 分

1. 只接受 canonical task 和 authenticated outcome。
2. 每条学习样本带 task/archive/citation/model/prompt/retriever 版本。
3. 自评分和 Q&A 自回流不能成为晋升真值。
4. 外部结果（签约/纠纷/退货/复购/人工纠错）有 owner 和 evidence ref。
5. `authenticated_ratio=1.0` 作为发布样本门；无真值显示 NO_DATA。
6. 指标区分 retrieval、decision、business outcome，不把过程分冒充价值。
7. 数据投毒、重复回放、标签漂移和裁判漂移有独立检测。
8. 知识/prompt/rule 晋升全部经黄金门和人工批准。
9. 线上质量下降可自动停止晋升并回滚版本。
10. 至少 30 条正式归档样本和 K0B 冻结的最小 settled outcome 样本完成端到端对账；同时冻结观察窗口、真实性等级、负责人、证据过期时间与重验条件，不由工程自行伪造。

## 5. 边界条件表

| 条件 | 预期行为 | 验证 |
| --- | --- | --- |
| 同内容不同路径 | 仅物理 blob 可按 hash 去重；逻辑 document/ACL/source/license 按租户与来源独立。只有 owner/scope/license/retention 全相同且已批准才可逻辑归并 | same-hash cross-tenant non-disclosure test |
| 同路径内容变化 | 新建 version，不覆盖旧版本 | version history test |
| 文件删除/重命名 | 标记 source missing；不静默删历史 | reconciliation test |
| stale absolute `raw_path` | quarantine，允许人工 relink；不丢 source note | migration test |
| symlink/`..`/Vault 外路径 | 连接前拒绝 | path traversal test |
| note 含 prompt injection | 标记不可信文本；不得变成系统指令 | adversarial retrieval test |
| note 含 secret/PII | quarantine/redact policy；保留审计而非内容泄漏 | secret/PII test |
| unknown tenant/customer | `unknown_owner` quarantine | ownership test |
| embedding 不可用 | ingest 元数据可完成，index 明确 FAILED；不得报告 indexed | dependency fault test |
| embedding 维度变化 | 新 projection version，shadow rebuild 后原子切换 | rebuild test |
| 文档归档 | 新检索排除，旧 citation 可解析 | archive test |
| 隐私删除 | chunk/vector/object 删除并生成 deletion evidence | DSAR test |
| legal hold 与删除冲突 | hold 优先并限制访问；解除后恢复处置，所有决定追加审计 | hold/release/replay test |
| 许可到期或撤销 | 停止新检索并触发 disposition；历史引用按许可决策版本只显示最小审计信息 | license expiry/revocation test |
| Q&A/LLM 生成内容 | 默认 `derived_untrusted`，不得自动反哺共享知识 | self-amplification test |
| watcher 重复/乱序事件 | content hash 幂等，旧 snapshot 不覆盖新 version | concurrency test |
| 旧 Qdrant point 无 owner/version | quarantine/legacy observation，不直接 publish | migration test |
| 跨 tenant 相同 query | 结果集合严格隔离，共享知识例外显式声明 | authorization test |
| archive 无 formal memorial | fail closed，不生成正式史馆档案 | workflow test |
| outcome 与原裁决矛盾 | 追加 outcome/correction，不改写原档案 | append-only test |
| candidate eval 提升但安全回退 | 安全门优先，不晋升 | promotion gate test |

## 6. 施工步骤（每步一个最小闭环）

所有 K1+ 受现有 convergence blueprint 前置硬门约束：P0-B 归属漏洞、测试生产路径、`prod:doctor` 和 clean immutable candidate 未满足时，只允许 characterization、隔离 schema/test 或直接关闭硬门的修复。

### K0 — 冻结资源 manifest 与 10 分 rubric

- K0 调查/蓝图：已识别资源和风险。
- K0A（`IMPLEMENTED_LOCAL`）：已新增只读 inventory CLI/test 与脱敏 manifest；7 个来源为 6 STABLE + 1 ABSENT，0 accepted / 16,234 quarantined；法条源严格限定为 6 个 `*-lawyer/references/statutes.md`，不把其他 persona 文件误报为法条；连续复跑 manifest/snapshot hash 一致。嵌入式 Qdrant 从稳定临时副本读取 2 collections / 13,970 points，源 store 不被打开为写者。artifact：`.harness/changes/chore-knowledge-resource-inventory-k0a-20260714/artifacts/knowledge-resource-inventory.json`。SQLite 使用只读事务；文件源逐文件 `stat→read→stat` 并记录 scan boundary；任一活动源边界变化即输出 `UNSTABLE_SOURCE/RETRY`，不得冻结其 count/hash。
- K0B（`IMPLEMENTED_LOCAL / NO_DATA`）：机器 rubric 已冻结：检索 required-evidence recall@10=100%、relevant-chunk precision@10≥80%、citation resolvable=100%；P0=100%、P1≥90%、高风险 precision≥80%、引用覆盖/正确/缺证/unsupported fail-closed=100%、虚构条款=0；每次候选跑3次且逐次过门；30 archives + 30 authenticated settled outcomes + 5 tenants + 30天窗口；成本≤20元/份、P95≤180秒；report 7天、outcome snapshot 30天、标签/rubric 90天到期或复审。事实源：`.harness/manifest/knowledge-quality-rubric.v1.json`。
- K0C：建立 legacy write inventory 与 filesystem/API tripwire；封禁 8099 写 API、Q&A 回流、Vault/brain DB/Qdrant 写入，仅保留只读观察。旧 watcher 若保留，只能产生 snapshot 事件，不能写任何源或索引。
- 文件：本蓝图、根 change record；实现时新增 `backend/scripts/knowledge_resource_inventory.py`、脱敏 schema/manifest、tests 与 ops note（具体路径由 K0A RED 先冻结）。
- 验证：对同一已捕获 snapshot token 重复规范化得到同一 schema/count/hash；fixture 与稳定源可由另一执行者复跑；活动源允许墙钟结果变化，但必须显式标 `UNSTABLE_SOURCE`，不能伪装成稳定基线。Qdrant point manifest 可对账；只读 syscall/HTTP method tripwire 证明 inventory 自身没有写源；K0C 另行证明系统单写者。
- 回滚：K0A/B 删除报告无运行影响；K0C 恢复前须显式 owner 批准，默认不恢复任何 legacy 写面。

### K1 — Canonical knowledge metadata、授权与 Citation v2

- K1A：Source/Snapshot/IngestRun + quarantine 状态，不建立 Citation。
- K1B：Document/Version/Chunk + LicenseGrant/RetentionPolicy/AccessGrant/TaskEvidenceBinding 与 scoped repository。
- K1C：Citation v2 + CitationUsage + ClaimEvidenceLink + formal evidence manifest gate。
- K1D：Outcome/Promotion/Deletion 契约；不得用 `human_confirmed: bool` 充当审批凭证。
- 文件：`backend/src/db/models.py`、Alembic migration、`backend/src/knowledge/`、schemas/tests。
- RED：跨租户相同 hash 的检索、计数、错误信息与 timing 不泄漏；重复 snapshot；授权撤销；许可过期；旧 citation 缺版本；claim 无证；archive/tombstone/legal hold 语义。
- 验证：Alembic upgrade/downgrade、隔离 SQLite/PostgreSQL、repository contract。
- 依赖：K0A–K0C 和 C1 tenant/RBAC 基础全部通过。

### K2 — 安全摄取暂存区与 Obsidian adapter

- 内容：吸收 old watcher 的 debounce/digest/filter；adapter 只读 snapshot，默认 quarantine；禁止直接写 live Vault。
- 文件：新增 `backend/src/knowledge/ingest/*`、worker/outbox、配置、tests。
- RED：路径逃逸、隐藏目录、控制文件、secret、unknown owner、重复/乱序事件。
- 验证：对复制到 tmp 的 Vault 跑；生产 Vault 只读 hash 前后一致。
- 回滚：关闭 source flag；legacy 只读 query 可保持，任何旧写面仍保持封禁。

### K3 — 修复可重建索引与删除语义

- 内容：先修 required `sqlite_vec` 依赖/doctor；索引从 KnowledgeVersion 投影；增加 projection version、tombstone delete、rebuild/swap。
- 文件：requirements/container、`sqlite_vec_rag.py`、index worker、doctor/tests。
- RED：依赖缺失必须 health RED；archive/tombstone 后仍命中；维度变化污染旧索引。
- 验证：required KB tests 零 backend skip；全量 rebuild hash/count；故障恢复。
- 决策：不把旧 Qdrant 设为新事实源；只做迁移读取。若容量压测证明 sqlite-vec 不达标，再用同一 adapter 契约替换 projection。

### K4 — 历史资源 dry-run、quarantine 与受控晋升

- 内容：比较 live Vault/仓内 archive/旧 Qdrant manifest；157 identical 只做物理 blob 去重候选，全部先进入 quarantine；owner/scope/license/retention 全部一致且获批后才允许逻辑归并。26 conflict 和其余 unique 逐类裁决；stub 不自动晋升为知识。
- 文件：migration script、manifest/report、tests；正文不进 Git 报告。
- RED：冲突 hash、stale raw path、无许可/owner、Q&A derived content、孤儿 vector。
- 验证：dry-run 与 apply 数量严格相等；重跑 0 新版本；抽样人工核验。
- 回滚：新对象标记 migration batch 并可整体 tombstone；旧源保持只读。

### K5 — 统一正式史馆读写模型

- 内容：list/detail/search/retrospective 改读 `ShiguanArchive` + append-only outcome；compat 只做 projection，不再返回成功空案卷冒充真实档案。
- 文件：Shiguan models/migration/repository/router、frontend adapter/page、tests。
- RED：真实 archive 页面不可见、未知 archive retrospective 假成功、跨用户/租户读取、原档案被回写。
- 验证：任务→formal→decision→archive→browser；DB 对账；对象授权攻击。
- 依赖：C4/C6D，不能越过正式任务主链。

### K6 — 刑部合同证据接地与引用门

- 内容：把仓根 statutes 注册成 versioned `platform_shared` source；修路径；合同风险项必须引用原文 task evidence 或有效法条版本。
- 文件：lawyer source adapter、formal memorial quality gate、contract schemas/tests/golden cases。
- RED：虚构 621 条、归档法条仍被引用、跨租户合同、无原文高风险晋升。
- 验证：法条/knowledge 聚焦测试全绿；30+ 黄金合同指标沿用 launch blueprint S7。

### K7 — 翰林院真实离线 eval/experiment

- 内容：dataset builder 必须 join `ShiguanArchive + FinalMemorial evidence manifest + ClaimEvidenceLink + Citation/CitationUsage + License/Retention/Deletion disposition + authenticated OutcomeEvent` 后生成冻结 dataset；缺任一关系标 `UNUSABLE/NO_DATA`，不得成为 eval 真值。实现 distortion、grounding、missing-evidence、gate-reason、outcome eval；API 返回真实实验。
- 文件：Hanlin models/services/jobs/routes、frontend App Router 页面、tests。
- RED：空壳接口、候选自动晋升、客户端 role 提权、dataset 漂移。
- 验证：baseline/candidate/reject/promote/rollback 全链；前端 build/type/browser。
- 依赖：K5/K6；不在首发客户导航展示。

### K8 — 可信结果飞轮与安全晋升

- 内容：OutcomeEvent、formal evidence manifest、ClaimEvidenceLink、Citation/CitationUsage、当前 disposition、错误样本池、truth ledger v2/upcaster；只接 canonical authenticated 且证据链完整的样本，缺链标 `UNUSABLE/NO_DATA`；晋升接 release identity。
- 文件：truth ledger migration/upcaster、outcome API/job、nightly flywheel、release gate/tests。
- RED：857 legacy rows 被误判真值、孤儿 run 晋升、Q&A 自我引用、重复 outcome、错误候选晋升。
- 验证：health 数字对账；authenticated release sample=100%；shadow→promote→rollback 演练。
- 外部依赖：真实客户结果；没有 settled outcome 时状态必须 NO_DATA，不能宣称 10 分。

### K9 — 统一 UI 与可观测性

- 内容：史馆显示档案/引用/后来结果；翰林显示实验与门；知识控制台显示 source/ingest/quarantine/index health；飞轮显示可信样本而非自评分。
- 文件：frontend feature adapters/pages、backend read projections、OpenAPI/types、telemetry。
- 验证：真实后端 Playwright，console/pageerror=0；同一 task 四页面事实一致。
- 依赖：K5–K8。

### K10 — 迁移切换、恢复演练与退役旧 Super Brain

- 内容：旧服务只读 shadow 对账；备份/恢复/删除/重建/性能/故障注入；观察期零未解释差异后停止 watcher 和 8099 只读查询面。旧写面已在 K0C 封禁，不能拖到 K10。
- 文件：deploy/ops docs、release commander probes、restore/rollback scripts、change record。
- 验证：真实 rollback、index rebuild、DB/object/vector count/hash 对账；canary；外部信任锚。
- 回滚：恢复旧服务只读查询，不恢复双主写或直接 Vault 写入。

## 7. 依赖图

```text
K0
 └─ K1
     ├─ K2 ─ K4
     └─ K3 ─ K4
              ├─ K5 ─ K7 ─ K9
              └─ K6 ─ K7 ─ K8 ─ K9
                               └─ K10
```

K2/K3 可在 K1 后并行；K5/K6 可在 K4 后并行，但首个实施闭环仍严格 WIP=1。

## 8. 验证矩阵

| 层 | 每 PR | 发布候选 |
| --- | --- | --- |
| Python | RED→GREEN 聚焦测试、py_compile/type/lint（工具可用时） | 完整 backend pytest，失败与基线逐项归因 |
| 数据 | migration upgrade/downgrade、count/hash、tripwire | backup/restore、rebuild、rollback、真实库不被测试触碰 |
| 安全 | tenant/user/object/secret/path/prompt injection | 独立威胁复核、DSAR/legal hold 演练 |
| 契约 | OpenAPI/schema、Citation v2、state transition | 30 条黄金旨意 + 30+ 合同黄金案例 |
| 浏览器 | 纵切页面真实后端验证 | 建案→裁决→史馆→回填→翰林实验 trace |
| 运行 | source/ingest/index/retrieval/outcome 宽事件 | canary、SLO、恢复、外部 release attestation |

## 9. 反模式

- 把 Obsidian 文件夹直接当线上史馆表。
- 永久保留 current RAG、Qdrant、IMA、Obsidian 四个互相同步的主库。
- 只复制 Markdown，不保留 source/version/hash/license/owner。
- 把所有历史 Q&A 自动训练回去。
- 用“文件数量、chunk 数、接口 200”证明知识质量。
- 归档只移动文件但不删索引，却向用户宣称不可检索。
- 翰林院直接改 prompt/规则，没有冻结 eval、人工批准和回滚。
- 把没有外部 outcome 的内部高分叫作飞轮变强。
- 在 P0-B/生产 DB/发布身份硬门未清前并行开十条实现线。

## 10. 第一实施闭环（待用户确认）

K0A/K0B 已按上述范围完成。下一闭环变为 **K0C：建立 legacy write inventory、写面 tripwire，并封禁 8099 写 API、Q&A 回流及 Vault/brain DB/Qdrant 写入，只保留只读 observation**；这是运行状态变化，未经再次确认不实施。

RED 至少覆盖：

1. 相同快照重跑 manifest hash 与计数一致；
2. 输出不得包含正文、secret、客户明文标识或不必要的绝对路径；
3. live Vault、仓内 archive、brain.db、Qdrant collection/point metadata 均被计数，读取失败必须显式 RED；
4. Qdrant 无 owner/version/license 的 point 只能计入 quarantine/unknown，不得 accepted；
5. inventory 前后真实 DB/Vault/Qdrant 内容 hash 不变。

K0A 退出条件已通过；K0B rubric/schema/evaluator 也已通过正反例与 doctor。K1 仍须等待 K0C 和 C1 tenant/RBAC，不因 rubric 冻结而解锁。

## 11. 计划变更协议

- 任何新增知识源必须先扩 source contract 和威胁模型，不得直接写 adapter。
- 任何更换向量引擎只改 projection，不改 KnowledgeDocument/Version/Citation 事实契约。
- 任何历史迁移数量变化必须更新 manifest 和差异解释，不能修改预期迎合结果。
- 任何“10 分”声明必须附本文件 4.1–4.4 的逐项证据；K0B 已冻结但外部 outcome 不足时最高状态仍为 `IMPLEMENTED_LOCAL / EXTERNAL_EVIDENCE_REQUIRED`，`NO_DATA` 不得漂白为 PASS。
