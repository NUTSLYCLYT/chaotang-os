# 铭硕第一交付 · 人工确认、可信下载、史馆归档与项目回读 V1 Product Successor

任务 ID：`MINGSHUO-FIRST-DELIVERY-CONFIRM-DOWNLOAD-ARCHIVE-READBACK-V1-SUCCESSOR-20260914`

冻结基线：`origin/ext-dev@08bd5582dd04abdeadee025058854344dc9e3959`；tree：`b0e76ba5df4022d96a575385e8ffa6a5b3728f12`。

## Status

Draft

`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Product Definition

本 successor 承接已经落地的铭硕 exact20：用户已有证据约束、不可伪造商业数据的 `MINGSHUO_SOLUTION_QUOTATION_DRAFT_V1` PENDING WorkProduct，但确认后仍不能下载、没有史馆档案，项目详情也无法回读交付状态。

本包是后端可信生命周期的 shadow exact10：Owner 在铭硕专用入口作出人工决定；`CONFIRMED` 时以现有 Mingshuo project/fact-pack/delivery intent、ArtifactStorage/WorkProduct confirmation receipt 和 Shiguan `MEMORIAL/REPLY` 为唯一事实源，确定性归档原始需求与成果回奏，校验摘要后发布文件并在项目快照中只读返回稳定链接。`REVISION_REQUIRED` 或 `ESCALATED` 只记录决定，不发布、不归档为成功交付。

由于 exact10 会改变 readiness runtime/successor 指纹，本轮 machine GO 后只允许形成未提交 shadow byte evidence：focused、Ruff 与自测通过，完整 backend 精确只剩 closed-pair 一项失败后冻结 exact10 bundle、runtime/successor fingerprints 和 proposed ordered pair，并停止。随后必须独立落地 readiness exact2 prerequisite，再基于最新 ext-dev 重签本 exact10、逐字节重物化和完成全绿 candidate；本轮不得创建产品 candidate commit。

V4/BFF 页面接线仍是紧随其后的独立 successor；本包不新增前端入口，也不把后端 API 测试冒充浏览器闭环。

## Acceptance Criteria

- [ ] Shadow 精确修改 manifest 的十条既有路径，结构 `10 MODIFY`，全部 `100644`，无第十一条路径；本轮只冻结不可提交 donor，不获得 candidate 身份。
- [ ] 通用 report-artifact work-product 查询、confirmation 和 download 三个入口均对 Mingshuo capability/report type fail-closed，避免同一 user 跨 tenant 绕过 project/draft 绑定或产生“已确认但仍永久 PENDING”的分叉状态；Mingshuo tenant-scoped 专用 read/finalize/download API 是唯一入口。
- [ ] `ArtifactStorage` 的通用 confirmation primitive 本身必须拒绝 Mingshuo capability，不能只依赖 API 拦截；只有在 tenant/owner/project/draft/binding 全部验证后，服务层才能调用可 exact-replay 的 Mingshuo 专用 confirmation primitive。
- [ ] `CONFIRMED` 必须绑定当前 owner/tenant/project/draft、Fact Pack version/digest、artifact/work-product ID、WorkProduct content digest、confirmation receipt 与实际 XLSX SHA；任一漂移在发布前失败。
- [ ] 原始需求以确定性、owner-scoped `MEMORIAL` 保存；确认后的中性成果以确定性 `REPLY` 引用该奏折，使用现有两类史馆合同，不新增 archive type。
- [ ] 归档 evidence 标记为 `MIXED`，明确“用户输入 + 已验证来源 + 非约束性草案”；不得宣称真实价格、认证、交期、商业成功或外部发布。
- [ ] 保持 Mingshuo schema version 2、delivery-intent 三态/trigger、runtime registry、备份及 release contract 字节不变；不得新增 Mingshuo 表、字段、状态或迁移。
- [ ] 首次 finalize 的 durable confirmation receipt 冻结 terminal decision、structured reason、receipt sequence/time；MEMORIAL/REPLY canonical payload、digest 与域分离 ID 必须只从该 receipt 及不可变 fact-pack/binding/artifact/work-product/file identity 派生，重试与恢复不得重新读取当前时钟或可变输入。
- [ ] 多库协调按可恢复 forward-only saga 实现：每一步可精确重放；commit-then-error、进程中断、并发 finalize、重复确认、重复下载和重复回读不得生成第二回执、第二档案、第二文件或冲突身份。
- [ ] 只有确认回执、MEMORIAL、REPLY、artifact digest 与 delivery binding 全部一致时，PENDING 文件才可转为 PUBLISHED 并由现有 authenticated download 返回；失败或篡改继续 404/409/503 fail-closed。
- [ ] REPLY 的 `source_kind=MEMORIAL`、唯一 related archive 和 `source_text` 必须从同一份冻结 MEMORIAL canonical payload 派生；`source_text` 精确等于关联 MEMORIAL content，不允许从展示文案重新渲染。
- [ ] Shiguan server-identified Mingshuo archive ID 使用独立保留域前缀；server-identified exact-replay 写入必须是明确受限的 storage primitive，普通 `create_archive` 与通用 API 无法指定、引用或产生该前缀，并有直接负向测试。`is_mingshuo_server_archive_id` 必须在 Shiguan storage 唯一定义，API 只调用该共享判定。所有通用史馆入口都必须受控：get/list/recall/dadian-overview/statistics/global outcomes 均排除该域；create payload 内任何 direct/related/source archive reference、review、decision、archive outcomes read/write 均对该域返回 404 且零写入。只有铭硕 tenant/project/draft-scoped readback 可返回经联结验证的稳定 ID/digest。
- [ ] 项目详情返回 draft 对应的 artifact/work-product/confirmation/artifact/archive 状态及稳定 ID/digest，不复制档案正文、文件字节或确认账本，不形成第二事实源；仅有 CONFIRMED receipt 但 saga 未完成时必须显示 `RECOVERING/INCOMPLETE`，不得显示成功。
- [ ] 未认证、同 user 跨 tenant、跨 owner、猜测 ID、过期 Fact Pack、非当前 draft、非法决定、空理由、重复不同理由、篡改文件/receipt/archive/binding、并发 finalize、每个持久化边界 commit-then-error、归档或发布失败均有负向测试且不泄露路径、用户或内部异常；`test_mingshuo_delivery.py` 必须以真实 API 路由逐项证明通用 Shiguan get/list/recall/dadian-overview/statistics/outcomes/review/decision/create-reference 全部不泄露、不写入 Mingshuo 域档案，并正向证明普通非 Mingshuo 档案的既有通用流程未被过宽阻断。
- [ ] Shadow focused、exact10 Ruff、Doctor/authority/V2 checks 与自测、diff check 全绿；backend-full 与完整 Harness 均由结构化包装器精确只允许 readiness closed-pair 一项既知失败，三审均 `GO / P0=0 / P1=0 / P2=0` 后冻结 bundle/fingerprints/pair并 STOP。

## Delivery Constraints

- 当前只允许创建/修正三份 proposed 治理草案并完成校验、摘要与独立审查；不得物化正式 approval、运行 authority、实施产品、commit、push 或部署。
- 不新增第二套 Mingshuo 项目账本、确认账本、ArtifactStorage、史馆或 evaluator；Mingshuo DB 继续只保存既有 delivery intent 与上游稳定 ID/digest，finalize 终态不新增表、字段或状态，而由 ArtifactStorage receipt、档案对与文件发布状态共同反推。
- 不修改 Mingshuo schema、WorkProductEnvelope、ArchiveCreate 的公共 schema，不新增史馆 archive type，不允许公开下载、匿名分享或真实外部发布。
- 不修改 frontend、ScenePack、DecisionTask、readiness、Harness、authority、release contract 或 exact20 历史。
- 远端漂移、machine STOP、第十一条路径、完整 backend/Harness 出现第二项失败或 readiness 失败类型变化、无法构造确定性 archive identity、无法在故障注入后精确恢复、关键门禁失败或独立审查 P0–P2 立即停止。

## Affected Modules

- 模块：铭硕交付 finalize saga、ArtifactStorage 确认/发布边界、史馆确定性 MEMORIAL/REPLY 创建、owner-scoped 项目交付回读及对应测试。
- 允许路径：`backend/app/accounting_reports/storage.py`、`backend/app/api/mingshuo.py`、`backend/app/api/report_artifacts.py`、`backend/app/api/shiguan.py`、`backend/app/mingshuo/models.py`、`backend/app/mingshuo/service.py`、`backend/app/shiguan/storage.py`、`backend/tests/test_mingshuo_delivery.py`、`backend/tests/test_report_artifacts_api.py`、`backend/tests/test_shiguan_storage.py`。

## Technical Plan

1. 在干净 approval child 中先物化 RED：证明现状可记录通用 `CONFIRMED` 却不能下载/归档/回读；再覆盖跨 owner、摘要篡改、commit-then-error、重复不同 payload 和中断恢复。
2. 保持 Mingshuo DB schema/version、delivery intent 和 runtime registry 完全不变；先以当前不可变 tenant/owner/project/draft/binding 验证 ArtifactStorage WorkProduct，再由 Mingshuo 专用 confirmation primitive 原子创建或精确重放 receipt。两份 archive payload/digest、域分离 IDs 和全部上游 digest只能从 receipt 与不可变实体派生；后续步骤禁止再读取当前时钟或重新渲染 payload。
3. 在 Shiguan storage 增加明确受限、仅供可信服务层使用且具有独立 Mingshuo 保留域前缀的 server-identified MEMORIAL exact-replay primitive；普通 `create_archive` 和通用 API 必须无法指定、引用或产生该前缀，并由直接负向测试证明。REPLY 复用既有 `create_reply_with_evidence`，严格验证 ID、owner、唯一关联奏折、冻结完整 canonical payload，并保证 REPLY source_text 精确等于 MEMORIAL content。storage 与 API 共享域判定，所有通用 Shiguan 读取/搜索/统计/overview/outcome 投影排除该域，所有 review/decision/outcome/create-related mutation 对该域 404 且零写入；只有铭硕专用入口可在 tenant/project/draft 联结后返回稳定引用。
4. 在 ArtifactStorage 存储层让通用 work-product read、confirmation 与 published download primitive 对 Mingshuo capability/report type fail-closed；增加受 Mingshuo capability、terminal decision、冻结 receipt identity、reply binding 和文件摘要共同约束的专用 read/confirmation/publish/download primitives。通用 `publish_run` 继续拒绝 Mingshuo。
5. Mingshuo finalize service 先验证既有 `WORK_PRODUCT_BOUND` delivery intent，再按 `确认回执 → MEMORIAL → REPLY → 发布 → delivery readback` 顺序协调；finalize 不新增 intent 状态，后续步骤只以 receipt 与不可变上游 identity 做 exact replay/reconciliation；`REVISION_REQUIRED/ESCALATED` 不进入后三步。
6. 项目 GET 及专用 read/download 先验证 tenant/owner/project/draft，再联结稳定 ID/digest/status；任何跨库身份不一致返回 sanitized conflict/unavailable。已记录 receipt 但未完成全部边界时只返回 `RECOVERING/INCOMPLETE`，下载保持 404，不返回部分成功假象。
7. 当前先完成 strict JSON/schema/Task/Harness 治理校验和三审；得到 Owner 对唯一 canonical digest 的明确确认后才允许物化 formal approval、普通快进并运行一次 machine authority。GO 后实施 shadow exact10，完成 v01–v12；其中 backend-full 与完整 Harness 门禁必须结构化证明唯一失败正是 closed-pair 身份差异，拒绝其他 failure/error/timeout。产品三审后冻结 exact10 bundle、runtime/successor fingerprints 与唯一 proposed pair并 STOP。
8. 本 authority 随 shadow evidence 完成后必须由 Owner 标记 `ABANDONED_UNCONSUMED / BYTE_DONOR_ONLY / REISSUE_REQUIRED`；不得创建 candidate commit或运行 verify-candidate。先另立 readiness exact2 prerequisite，落地 pair 后再基于最新 ext-dev 重签 exact10，逐字节重物化并运行完整全绿矩阵、machine verify 与普通快进。

## Implementation Report

当前基线 `08bd5582… / b0e76ba5…` 已完成 exact20，完整 backend `5145 passed, 4 skipped`，Governance/Python/Security 三审 GO，machine candidate verification PASS。现有产品状态为 `READY_FOR_HUMAN_CONFIRMATION / PENDING / NON_BINDING_DRAFT`。

只读差距复核确认：通用 confirmation receipt 已存在；通用 download 只接受 PUBLISHED；`ArtifactStorage.publish_run` 明确拒绝 Mingshuo report type；Shiguan 只有 `MEMORIAL/REPLY`；Mingshuo project snapshot 尚未返回交付/档案状态。因此本包是第一交付闭环的真实后端缺口，不是重复建设。

## Acceptance Review

本 proposed 包在 Owner 确认、正式三文件 approval commit 和 machine GO 前始终为 `DRAFT / NON_AUTHORIZING`。治理审查必须证明 exact10 是完成后端闭环的最窄 shadow 边界，并且没有把 Mingshuo schema、V4、ScenePack 或新事实源偷入本包。

本包不会落地产品 candidate；它只冻结后续 prerequisite 与 exact10 重签所需的真实字节和指纹。只有后续 exact2 prerequisite 与 exact10 reissue 均落地，才可宣称后端闭环完成；再由 V4/BFF successor 通过真实浏览器与负向链验收后，才可宣称第一交付 UI 闭环完成。
