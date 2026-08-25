# P14-PILOT Owner Artifact Roundtrip V1

> 状态：`DRAFT / NON_AUTHORIZING / G1_PROPOSAL / PRODUCT_STOP`
>
> Task ID：`P14-PILOT-OWNER-ARTIFACT-ROUNDTRIP-V1`
>
> 基线：`origin/ext-dev@82ba658db44d829d6ae7e028dcbac7ecefb4cee7`
>
> 基线 tree：`63e8c716f705d559b51169da9d1b80b7db4afccf`

## Status

Draft

Owner 已同意登记本 Packet，并且只授权编制 successor task、plan、approval 三份草案、治理检查和独立复审。规范基线上的
`product-authority.m0.v1` 返回 `STOP / APPROVAL_NOT_SELECTED`，`execution-authority.ext.v1` 返回
`STOP / EXTERNAL_AUTHORITY_NOT_EVALUATED`；共享旧工作树的 legacy authority 同样保持 STOP，四门 authority 尚未机器化。
因此本三件套不能授权产品写入、候选形成、提交、试点或外部动作。

## Product Definition

### Packet

- 名称：`P14-PILOT-OWNER-ARTIFACT-ROUNDTRIP-V1`
- 目标用户：受邀请、已登录且拥有一份真实任务成果的普通用户。
- 用户行为：查看自己的成果事实与来源状态，下载成果，确认通过、退回修改或升级处理，刷新后看到同一状态，并从成果中的
  史馆入口找回对应回奏；另一位登录用户不能查看、下载、确认或召回该成果。
- 最终成果：一份摘要稳定的成果包、一份追加式人工确认回执，以及一个指向现有史馆回奏的可验证入口；没有可靠 `reply_id`
  或史馆回写时必须显示“暂未获得完整回写”，不得伪造归档成功。
- 所属闭环：`办事`。
- 当前成熟度：`ADVISORY`。
- 目标成熟度：`VERIFIED`；本 Packet 不声称 `PROFESSIONAL` 或 `PAID_PROVEN`。

### 唯一事实链

```text
authenticated owner
  -> report artifact API
  -> ArtifactStorage / WorkProductEnvelope
  -> verified artifact bytes + artifact_file_sha256 + work_product_content_digest
  -> append-only confirmation receipt
  -> refresh the same backend snapshot
  -> reply_id deep-link into the existing owner-scoped Shiguan archive
```

成果、人工确认、史馆归档和现实执行是四条独立状态轴。确认成果不等于史馆已回写，史馆已回写不等于现实动作已执行。前端不得
创建第二成果账本、第二史馆或本地 LIVE 状态。

## Scope Contract

### 允许的未来产品路径信封

以下 26 条路径是未来 G1 范围信封的最大集合，不是当前写入授权；最终候选不需要修改的路径必须从 exact manifest 删除：

1. `backend/app/accounting_reports/storage.py`
2. `backend/app/api/report_artifacts.py`
3. `backend/tests/test_accounting_confirmation_api.py`
4. `backend/tests/test_accounting_report_storage.py`
5. `backend/tests/test_accounting_work_product_storage.py`
6. `backend/tests/test_report_artifacts_api.py`
7. `frontend/src/app/api/report-artifacts/[id]/confirmation/handler.ts`
8. `frontend/src/app/api/report-artifacts/[id]/confirmation/route.test.ts`
9. `frontend/src/app/api/report-artifacts/[id]/handler.ts`
10. `frontend/src/app/api/report-artifacts/[id]/route.test.ts`
11. `frontend/src/app/api/report-artifacts/[id]/work-product/handler.ts`
12. `frontend/src/app/api/report-artifacts/[id]/work-product/route.test.ts`
13. `frontend/src/app/api/shiguan/archives/[id]/handler.ts`（未来唯一允许新增）
14. `frontend/src/app/api/shiguan/archives/[id]/route.test.ts`（未来唯一允许新增）
15. `frontend/src/app/api/shiguan/archives/[id]/route.ts`（未来唯一允许新增）
16. `frontend/src/app/shiguan/ShiguanClient.tsx`
17. `frontend/src/app/shiguan/ShiguanClient.visual.test.ts`
18. `frontend/src/app/shiguan/shiguanController.test.ts`
19. `frontend/src/app/shiguan/shiguanController.ts`
20. `frontend/src/features/study-visual/DevStudyWorkspace.module.css`
21. `frontend/src/features/study-visual/StudyArtifactConfirmation.test.ts`
22. `frontend/src/features/study-visual/StudyArtifactConfirmation.tsx`
23. `frontend/src/features/study-visual/StudyArtifactLinks.test.ts`
24. `frontend/src/features/study-visual/StudyArtifactLinks.ts`
25. `frontend/src/lib/backendClient.test.ts`
26. `frontend/src/lib/backendClient.ts`

约束：最多变更 26 条，changed candidate regular-file blobs 总字节不超过 524288 bytes，只允许 `MODIFY`，以及上述恰好三条
史馆单档案 BFF 的 `ADD`。其它新增文件、目录、依赖、数据库表、API namespace 或第 27 条产品路径立即
`STOP / SCOPE_EXPANSION_REQUIRED`。

范围证明必须从冻结的 `base..candidate` Git objects 计算：NUL-safe `name-status`，禁用 rename detection，拒绝 delete、rename、
symlink、submodule 和非普通 blob；字节上限算法为对每条 ADD/MODIFY 路径读取 candidate tree 中 blob size 后求和。工作树
`git diff` 或 `numstat` 不能充当最终范围/字节证明。

### 受保护路径

- `.harness/**`、`frontend/.harness/**`、`backend/harness/**`、`docs/decisions/**`、所有 `AGENTS.md`；
- `backend/app/auth/**`、数据库迁移和 schema、`backend/app/main.py`；
- 大殿、军机处、JiQun、LangGraph、Agent/Skill/蜂群控制面；
- `deploy/**`、release/runner/supervisor/CI、secret、生产数据和公共网络；
- 既有史馆模型、存储与 API。史馆入口只能消费已存在且 owner-scoped 的 `reply_id`，不得复制成果正文形成第二归档事实。

### 明确非目标

- P14-RELEASE、正式 acceptance、离线 wheel、external supervisor、cgroup watchdog；
- 自动创建史馆档案、重写史馆模型、跨库事务或数据库迁移；
- 电芯/PACK 英雄任务、丞相三张决策牌、军机处项目总管或页面视觉重构；
- 支付、交易、删除、对外发送、真实生产数据、公共试点；
- 当前草案阶段的任何 commit，以及未来候选未经独立、一次性、精确 materialization grant 的 commit；push、merge、release、
  deploy 始终不在本 Packet 授权内。

## Result Contract

### 必须产生的用户结果

1. 真实行为：同 Owner 在本地真实前后端链路查看、下载、裁决、刷新并进入史馆。
2. 可交付成果：后端验证后输出的原始成果字节；`artifact_file_sha256` 必须同时等于
   `report_artifacts.file_sha256`、成果 manifest 中 XLSX 条目的 digest 与 `sha256(downloaded bytes)`。
3. 结果字段：`confirmation_status = PENDING | CONFIRMED | REVISION_REQUIRED | ESCALATED`。
4. 明确失败状态：`OWNER_SCOPE_DENIED` 仅作为内部验收/审计分类；跨 Owner 与未知成果对外必须返回字节完全一致的通用 404，
   不得在 wire、日志或 UI 泄露对象是否存在。
5. 来源与证据：`owner_user_id` 只在后端用于隔离；用户响应必须分别包含 `artifact_id`、`run_id`、`reply_id`、
   `artifact_file_sha256`、`work_product_content_digest`、`source_state`、`artifact_state`、`artifact_gate`、
   `confirmation_status`、`archive_status`、`real_world_execution_status` 与公开确认回执。
6. 用户确认动作：`CONFIRMED`、`REVISION_REQUIRED` 或 `ESCALATED`，理由非空；同一版本只允许一次合法终态转换。
7. 史馆/复盘入口：单档案 BFF 必须通过现有 owner-scoped 后端 GET 精确读取 `reply_id`，并验证 `id == reply_id` 且
   `type == REPLY`；只有此时 `archive_status=ARCHIVED` 并提供深链。404 为 `PENDING_WRITEBACK`，503 为 `UNAVAILABLE`，均不得
   复制成果正文或自动创建第二档案。

字段语义固定如下：

- `artifact_file_sha256`：下载文件字节摘要；不得用 `work_product_content_digest` 代替。
- `work_product_content_digest`：`WorkProductEnvelope.content_digest` 的语义摘要；不得声称是 XLSX 文件摘要。
- `source_state`：`LIVE | MIXED | FALLBACK | DEMO | PENDING`，由后端从明确持久化 provenance 投影；缺少明确 provenance 时只能
  `PENDING`，不得从 HTTP 200、文件存在或前端 fixture 推断 `LIVE`。
- `archive_status`：`ARCHIVED | PENDING_WRITEBACK | UNAVAILABLE`，只由 owner-scoped 单档案读取结果决定。
- `real_world_execution_status`：本 Packet 没有现实执行事实源，固定为 `NOT_TRACKED`；任何 `EXECUTED` 声明均为合同错误。
- 公开确认回执只包含 `work_product_id/version/sequence/decision/structured_reason/created_at`；禁止返回 `actor_ref`、
  `owner_user_id` 或内部稳定用户 ID。

### 成功标准

- 同 Owner 显示、下载、确认与刷新使用同一 `artifact_id/run_id/artifact_file_sha256/work_product_content_digest`，确认回执追加且
  刷新后不回退。
- 下载前后都由后端校验字节摘要；损坏、替换、长度或 MIME 异常稳定失败且不返回部分成果。
- 另一 Owner 对查看、下载、确认和史馆深链均得到与未知 ID 等价的拒绝；响应、日志和 UI 不泄露 owner、路径或 secret。
- `source_state/confirmation_status/archive_status/real_world_execution_status` 四轴有独立 wire 字段和值域，禁止跨轴推断。
- LIVE/MIXED/FALLBACK/DEMO/PENDING 只根据明确后端证据显示；缺少可靠来源时显示等待或部分回写，不从 HTTP 200 推断业务 LIVE。
- 缺证、存储不可用、请求超时、上游模型失败、Fallback、刷新竞态和重复确认负例均 fail closed。
- 本地真实浏览器完成登录→打开成果→下载→确认→刷新→史馆入口，返回行为正确，控制台无阻断错误。
- 精准测试、受影响回归、前后端契约、owner 负例和独立复审均无未关闭 P0–P2。
- 先冻结 pre-commit tree/patch/evidence；Owner 另行精确授权一次本地 commit 后，只允许物化同一 tree。随后从 Git objects 重算
  `base..candidate` scope、blob bytes 和全部摘要，冻结唯一 candidate commit/tree 后才可请求 G2；当前草案没有 candidate。

### RED 合同

实施前必须以同一基线证明至少一个缺失行为：当前成果确认投影没有向普通用户分别提供可验证的
`artifact_file_sha256/work_product_content_digest/source_state/archive_status/real_world_execution_status`，且当前史馆页面不会通过
owner-scoped 单档案 BFF 按成果 `reply_id` 精确选择 REPLY。RED 必须使用真实后端响应和 owner-scoped 数据，不得用前端静态
fixture 证明后端缺失或成功。

## Affected Modules

- 模块：现有 `ArtifactStorage`、`WorkProductEnvelope`、report-artifact API 只读投影、前端成果确认和史馆选择控制器。
- 允许路径：严格限于本 Task `## Scope Contract` 中有序列出的 26 条未来产品路径；当前草案不授权修改其中任何一条。
- 后端事实源：现有 `ArtifactStorage`、`WorkProductEnvelope` 和 report-artifact API 只读投影。
- 前端：现有 report-artifact BFF、严格 backend DTO、Study 成果确认组件与 Shiguan 选择控制器。
- 证据：现有 backend pytest、frontend Node tests、typecheck/build 和本地真实浏览器链。

本草案不修改任何上述模块。

## Acceptance Criteria

- [ ] 四门 authority 已机器化，旧 authority 与新门组合采用 deny-overrides，且本 Task 获得 exact G1 `GO`。
- [ ] RED 在精确基线稳定复现，证明缺失行为而非测试环境故障。
- [ ] 产品 diff 严格位于批准的 exact path manifest，且不超过数量/字节上限。
- [ ] 同 Owner 查看、下载、确认、刷新和史馆入口全绿。
- [ ] 跨 Owner 四类操作和未知 ID 语义等价，失败不泄露存在性。
- [ ] digest、来源、confirmation receipt 与 Shiguan reply identity 均来自后端事实源。
- [ ] 缺证、超时、模型失败、Fallback、刷新、重复确认和归档缺失负例全绿。
- [ ] 本地真实浏览器链、返回、深链、控制台和截图证据完成。
- [ ] candidate SHA/tree、exact manifest 和 evidence bundle 冻结一致。
- [ ] 独立 Reviewer 无未关闭 P0–P2。

## Delivery Constraints

- 当前只允许本 task、同名 plan、同名 approval 三份治理草案。
- 当前三草案授权不允许产品写入或任何 commit；未来 G1 本身也不授权 commit。只有 Phase 5 独立、一次性、精确
  materialization grant 可以物化已冻结的同一 tree；push、merge、试点、release、deploy 或外部动作继续禁止。
- G1 只允许未来另行批准的干净隔离候选；G1 不接受候选、不授予试点。
- G1 测试后必须先冻结 pre-commit tree；本地 commit 需要新的精确 Owner 授权，且 commit tree 必须等于冻结 tree。该授权不包含
  push、merge、试点或发布。
- G2 必须在候选形成后冻结 exact identity，并取得新的 Owner 精确摘要确认和机器 `GO`。
- 稳定 lineage 固定为 `P14-PILOT-OWNER-ARTIFACT-ROUNDTRIP`；机器 G1 必须登记 predecessor approval digest、旧/新 base、
  `reanchorCount` 与 record，每个 lineage 最多一次 re-anchor。还必须登记可信 authority 时间、事件序号、
  `lastQualifyingEvidenceAt/kind/digest`；相同 digest 重放不能刷新时钟，连续 24 小时无新 RED/测试/候选/用户证据时暂停。
- 本 draft 不能原地晋升为 G1：四门 consumer 落地后必须按当时 closed schema 重新签发，提供 issued/expiry、非空一次性 nonce、
  完整 lineage/cadence 字段和机器消费记录。

## Technical Plan

1. 只读冻结远端基线、当前 authority 和既有事实链。
2. Owner 确认三文件精确摘要后，另行决定是否允许治理文件落地；这仍不授权产品施工。
3. 四门 authority 获得独立实现授权并机器化后，为本 Task 请求 exact G1 `GO`。
4. 在唯一隔离候选中先写 RED，再完成最小纵向修改并冻结 pre-commit tree/patch/evidence。
5. Owner 另行授权一次本地 commit 后物化相同 tree，从 Git objects 重算全部证明并冻结 candidate identity。
6. 完成验证与独立复审后请求 G2；邀请制试点仍需单独授权。

## Implementation Report

只完成三份非授权治理草案的编制。未修改产品、authority、Harness 或数据库；未创建 commit，未推送、试点、发布或部署。

## Acceptance Review

Pending。当前状态是 `DRAFT / PRODUCT_STOP`，不是 G1 `GO`。治理检查和独立复审完成后只生成精确摘要供 Owner 决定，不能
据此启动产品实现。

## Rollback

草案阶段仅放弃隔离治理工作树中的三条未提交文件；不触碰共享 dirty worktree、既有 P14 候选或远端历史。
