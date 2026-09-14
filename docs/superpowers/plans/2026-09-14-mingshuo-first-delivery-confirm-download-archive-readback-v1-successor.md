# Mingshuo First Delivery Confirm / Download / Archive / Readback V1 Plan

Task: `MINGSHUO-FIRST-DELIVERY-CONFIRM-DOWNLOAD-ARCHIVE-READBACK-V1-SUCCESSOR-20260914`

State: `DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

Base: `08bd5582dd04abdeadee025058854344dc9e3959 / b0e76ba5df4022d96a575385e8ffa6a5b3728f12`

## Goal

把已落地的 Mingshuo PENDING WorkProduct 接到现有人工确认、ArtifactStorage 下载和 Shiguan 归档事实源，形成可恢复、幂等、owner/tenant 隔离的后端闭环，并为下一包 V4/BFF 接线提供稳定 read model。

## Source-of-Truth Boundaries

- Mingshuo DB：project、requirement/fact-pack/draft identity，以及既有 delivery intent 和稳定外部 ID/digest；finalize 不向该库增加表、字段或终态。
- ArtifactStorage：不可变 WorkProduct、append-only confirmation receipt、XLSX 文件状态与实际 SHA；所有 generic primitives 对 Mingshuo fail-closed，专用 primitives 只接受已验证的冻结协调身份。
- Shiguan：不可变 `MEMORIAL/REPLY` 档案与成果回奏 identity。
- 项目 readback：只验证并联结上述身份，不复制三套 payload。

原始需求归档为 MEMORIAL；确认成果归档为 source_kind=MEMORIAL 的 REPLY。两者均由服务端确定性 ID 创建，客户端不得指定。REPLY source_text 必须逐字节来自冻结 MEMORIAL content。Evidence 使用 MIXED，明确测试/用户输入/已验证来源边界。

## Shadow Exact10 Scope

十条既有路径全部为 `M`、模式 `100644`；本轮只形成 uncommitted byte evidence：

1. `backend/app/accounting_reports/storage.py`
2. `backend/app/api/mingshuo.py`
3. `backend/app/api/report_artifacts.py`
4. `backend/app/api/shiguan.py`
5. `backend/app/mingshuo/models.py`
6. `backend/app/mingshuo/service.py`
7. `backend/app/shiguan/storage.py`
8. `backend/tests/test_mingshuo_delivery.py`
9. `backend/tests/test_report_artifacts_api.py`
10. `backend/tests/test_shiguan_storage.py`

Mingshuo schema version 2、delivery-intent 三态与 trigger、runtime data registry、sqlite backup 及 release contract 必须保持字节不变。终态协调不新增第四事实源：receipt 冻结 decision/reason/sequence/time，archive identity 与 canonical payload 只从 receipt 和不可变上游身份机械派生。

## TDD Sequence

### RED 1 — split confirmation state

证明现有通用 endpoint 可留下 `CONFIRMED + PENDING + no archive`，下载返回 404，项目 readback 看不到终态。修复后通用 report-artifact work-product read、confirmation、download 及底层 generic storage primitives 对 Mingshuo 全部 fail-closed；Shiguan storage 唯一定义域 ID 判定，通用 Shiguan get/list/recall/dadian-overview/statistics/outcomes 均排除该域，review/decision/outcome 及 create payload 内任何 archive reference 对该域 404 且零写入。只有 tenant-scoped Mingshuo read/finalize/download 才能推进或读取完整链；普通非 Mingshuo 档案的既有通用流程必须保持可用。

### RED 2 — identity and authorization

覆盖未认证、同 user 跨 tenant、跨 owner、猜测 project/draft/artifact/work-product、过期 Fact Pack、错误 binding、非 terminal decision、空理由和同一 identity 不同理由。`test_mingshuo_delivery.py` 通过真实 API 路由覆盖通用 Shiguan get/list/recall/dadian-overview/statistics/global/archive outcomes、review、decision 与 create reference；Mingshuo 域档案不得泄露、计数或被修改，普通 create/API 也不得指定、引用或产生保留域 ID。所有拒绝发生在新 confirmation/archive/publish 写入前。

### RED 3 — archive and publish integrity

篡改 WorkProduct digest、artifact actual SHA、receipt、MEMORIAL/REPLY payload/owner/related id/source_text，或模拟每一持久化边界 commit-then-error。不得发布文件、返回下载链接或把部分状态报告成成功。

### GREEN — recoverable exact replay

首次 finalize 由 Mingshuo 专用 ArtifactStorage primitive 原子创建或精确重放 receipt，以其 decision、reason、sequence、created_at 加不可变 fact-pack/binding/artifact/work-product/file identity机械派生两份 archive canonical payload/digest 和域分离 IDs。`CONFIRMED` exact replay 在首次、并发、重复、commit-then-error 与进程中断恢复后只从 receipt 与不可变实体恢复，返回同一 receipt、memorial ID、reply ID、artifact ID、work-product ID、digest 和下载 bytes；数据库中各 durable entity精确一条。

如果 receipt 已落地而 saga 尚未完成，readback 必须返回 `RECOVERING/INCOMPLETE`，download 继续 404；只有 archive pair、reply linkage、artifact SHA、WorkProduct digest 和专用 publish 全部复核后才返回完成。

`REVISION_REQUIRED/ESCALATED` exact replay 只保留 terminal receipt，文件仍 PENDING，不产生成功 REPLY 或下载。

## Verification Matrix

1. 当前治理阶段：strict JSON/schema、Task contract、路径/模式/差异、完整基线 Harness 与 Governance/Python/Security 设计三审。
2. Owner 确认 digest、正式 approval commit 普通快进且 machine GO 后：Mingshuo delivery、report-artifact、Shiguan storage/API、vertical 与 WorkProduct focused suites。
3. POSIX temp 下运行完整 backend；机器包装器必须精确解析出唯一失败 node 为 readiness closed-pair membership 断言，拒绝其他 failure、error、timeout 或不完整结果，因此同时证明非-readiness backend 全绿。
4. exact10 Ruff；完整 Harness 只允许相同 readiness closed-pair 身份失败；Harness self-test、Doctor check/tests、hook self-test、authority regression、V2 check/tests 与 `git diff --check` 全绿。
5. Governance/Python/Security 产品三审；冻结 exact10 raw/blob/mode/bytes、bundle、combined diff、验证 evidence、runtime fingerprint、successor fingerprint 与唯一 proposed pair。
6. STOP，不创建 candidate commit、不运行 machine verify；Owner 放弃未消费 authority。
7. 独立 readiness exact2 prerequisite 落地后，基于最新 ext-dev 重签 exact10，byte-for-byte 重物化并运行 backend-full、Harness/Doctor/V2 checks、machine verify 与普通快进。

任何 shadow 字节变化都会使测试、摘要和三审证据失效。readiness prerequisite 后的新 exact10 不继承 candidate/通过身份，必须重新执行完整矩阵与三审。

## Independent Reviews

- Governance：单一事实源、MEMORIAL/REPLY 语义、exact10、non-goals、lineage 与 STOP 条件。
- Python：schema/version 不变约束、跨库 saga、exact replay、commit ambiguity、文件移动补偿、并发/幂等及错误映射。
- Security：认证、同 user 跨 tenant/owner 隔离、generic ArtifactStorage 与 Shiguan 入口绕过、ID 猜测、TOCTOU、路径/摘要篡改、日志/错误泄漏、确认权限及下载头。

任一 P0–P2 为 NO-GO。

## Follow-on V4 Package

本包落地后才冻结 V4/BFF successor：Mingshuo API client/BFF、方案报价场景页、任务列表/详情 read model、人工确认按钮、下载与史馆链接、空/失败/重复状态，以及真实浏览器链。该后继不得复制 Mingshuo evaluator 或另建项目 ledger。

## Rollback Boundary

正式 approval 前丢弃隔离草案即可。shadow 只保留未提交隔离字节；不得提交或推送。后续 prerequisite/exact10 普通快进落地后的回退必须通过 forward-only corrective successor，禁止历史改写和 force-push。未部署生产。

## STOP Conditions

- 远端不再精确为批准基线；
- 当前 machine authority 或后继 exact10 reissue 的 verify-candidate STOP；
- 出现第十一条产品路径、需要修改 Mingshuo schema/runtime registry/backup，或产品范围超出 exact10；
- 无法证明确定性 MEMORIAL/REPLY identity 和跨库 exact replay；
- 为通过测试需要放宽 owner/tenant、摘要、文件或确认校验；
- focused/non-readiness backend/自测失败，完整 backend 出现第二项失败或 readiness 失败类型变化；
- 独立审查出现 P0–P2。

本计划不授权正式 approval、产品实施、commit、push、Pilot、Release 或生产部署。
