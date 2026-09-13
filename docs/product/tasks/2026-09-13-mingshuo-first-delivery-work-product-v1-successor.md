# 铭硕第一交付 · 方案与报价成果物 V1 Product Successor

任务 ID：`MINGSHUO-FIRST-DELIVERY-WORK-PRODUCT-V1-SUCCESSOR-20260913`

冻结基线：`origin/ext-dev@3d0cbc6469162d355f3070ce1a10e03d9e4bc819`；tree：`e0c0f0158d8fa50dfd04e13aa7e13e70e07e374b`。

## Status

Draft

`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Product Definition

本 successor 完成铭硕第一交付闭环的第二段后端纵切：把当前 owner/tenant scoped、不可变且重新验真的 `MingshuoProjectFactPackV1` 与 `draft_request` 转换为一个确定性的内部《方案与报价草案》XLSX 和既有 `WorkProductEnvelope`。成果必须逐项区分事实、假设、建议、证据、缺失和风险；报价页只能是待商务填写/批准的空白草案，不得生成金额、认证结论、市场推荐或商业放行。

当前主线已拥有唯一 Mingshuo Fact Pack evaluator、通用 WorkProduct/Artifact gate、append-only 人工确认回执和 owner-scoped 报告成果库。本包只增加一个 Mingshuo producer/adapter，并为既有 ArtifactStorage 补足按 owner/run/capability 安全重放所需的窄查询；不得复制 evaluator、数据库、确认状态机、下载 API 或史馆。

本包完成后，现有 report-artifact confirmation API 可以对该 PENDING 成果记录一次人工决定，但文件仍不可下载、也不会归档。下载发布与史馆幂等归档必须在下一独立 successor 中，以确认回执和同一事实包锚点为前置条件完成。

## Acceptance Criteria

- [ ] Candidate 精确为 manifest 的十九路径，结构 `2 ADD + 17 MODIFY`，全部 `100644`；没有第二十条路径。
- [ ] 新建 `backend/app/mingshuo/delivery.py` 是纯确定性 producer：输入只能是已由现有 evaluator 重新验证的当前 Fact Pack、evaluation receipt 与绑定身份；不得访问网络、模型、IMA、MCP、环境凭据或第二数据库事实源。
- [ ] 只有 owner/tenant/project/draft-request 均匹配、draft request 精确绑定当前 `factPackVersion + factPackDigest`，且存储快照按原 `evaluatedUtcDay` 和当前 UTC 日双重重算均为 `PASS` 时才允许创建成果；HOLD、BLOCK、STOP、过期证据、时钟回退、旧版本和摘要漂移全部 fail-closed，且不留 artifact/work-product 行或文件。
- [ ] 交付身份必须完整绑定 `tenant_id + owner_user_id + project_id + draft_request_id + fact_pack_version + fact_pack_digest + evidence_digest + fact_digest + claim_digest + producer_policy_version`。完整私有 binding 只存于 tenant+owner scoped Mingshuo durable delivery intent/recovery relation；WorkProduct 只存不可逆 `bindingDigest`、Fact Pack 版本/摘要和不含 tenant/owner、request key、canonical bytes、原始 requirements 的最小公开安全锚点。ArtifactStorage 只是工件投影，不成为租户或业务事实源；通用 WorkProduct GET 和工作簿正文均不得暴露私有 owner/tenant 标识。
- [ ] 当前认证合同中 `tenant_memberships.user_id UNIQUE`、`tenant_id UNIQUE` 且 membership 不可换绑；服务必须先以实时 principal 的 tenant+owner 查询 Mingshuo project/intent，再按 intent 冻结的确定性 artifact ID 读取工件，并在每次 replay/response 前以 intent 完整 binding、WorkProduct `bindingDigest`、安全锚点、artifact hash/manifest/content digest 做闭合复核，不得要求或写入 WorkProduct 的 tenant/owner 明文。任何 membership 漂移、同 user 双 tenant、tenant reassignment 或 binding 不一致统一失败且不做 ArtifactStorage 猜测查询。未来若解除 1:1 membership，必须先另立 tenant-aware ArtifactStorage successor；本包不得静默沿用 owner-only 假设。
- [ ] `mingshuo.sqlite3` 新增 delivery intent 表、不可删除/受限状态更新触发器并提升 schema `user_version` 后，必须同步更新唯一 `runtime_data_registry` 的精确表/触发器/版本/schema digest 合同及 readiness 正负测试；旧 v1 数据库首次打开只允许 forward migration 到唯一 v2 结构，新增 intent 行必须被现有整库备份/恢复保留。新 registry digest 必须同时原子更新 release manifest schema、offline release build/verifier、RC1 acceptance 及三组对应测试；所有消费者必须拒绝旧 digest 或不一致值。不得修改历史 readiness 报告、放宽 schema 匹配、增加并行 registry 或绕过备份/发布证据校验。
- [ ] XLSX 固定包含“封面与限制”“事实与证据”“方案草案”“报价草案”“缺失与风险”五个工作表；工作表顺序、列名、排序、日期来源和 canonical cell projection 固定。幂等身份只绑定 canonical cell projection 与 delivery binding；首次持久化后的 XLSX raw SHA 冻结并用于后续 replay，不能要求不同进程重新生成的 ZIP bytes天然相同。
- [ ] 所有用户/证据文本只能写为字符串单元格；NFKC、去除前导控制符/Unicode 空白后首个字符为 `= + - @` 时必须用固定 apostrophe 编码并保留可审计原意。生成后必须解析 ZIP/OOXML 做后验收：拒绝公式 `<f>`、宏、`xl/externalLinks/`、外部 relationship、hyperlink、图片/媒体、嵌入对象、连接/查询、隐藏或 veryHidden sheet、重复或路径穿越条目，以及 allowlist 外的 part/relationship/content type；限制 ZIP 条目数、单项和总解压字节。
- [ ] 方案页只从受证据约束的 facts/claims 和用户原始 requirements 生成中性草案，不推断参数、认证、适用市场或性能。事实、假设与建议必须分栏；每条 claim 保留 evidence IDs、有效期与采用状态，不足即列入 missing/risk。
- [ ] 报价页不得生成数值金额、折扣、MOQ、交期承诺、税费、贸易条款或认证承诺。其状态固定为 `NON_BINDING_DRAFT / COMMERCIAL_APPROVAL_REQUIRED`，价格、MOQ、交期、质保和有效期字段固定为空并显示“待商务人工填写与批准”。
- [ ] WorkProduct 必须复用现有 `WorkProductEnvelope`、semantic digest 和 `evaluate_artifact_gate`；`capability_id` 固定为版本化 Mingshuo delivery capability，`confirmation_status=PENDING`、`artifact_state=PENDING`、`work_status=READY_FOR_HUMAN_CONFIRMATION` 只表示可审阅内部草案，不代表报价批准、可下载、已归档或商业成功。
- [ ] artifact manifest 必须精确包含五项且禁止 envelope 自指：`mingshuo_solution_quote_xlsx`=`mingshuo-solution-quotation-draft.xlsx` 的 raw SHA-256 hex；`mingshuo_fact_pack`=`mingshuo-project-fact-pack.json` 的既有 canonical Fact Pack SHA-256 去前缀 hex；`mingshuo_delivery_binding`=`mingshuo-delivery-binding.json` 的 canonical semantic SHA-256 hex；`confirmation_request`=`confirmation-request.json` 对固定 `{confirmationStatus:"PENDING",meaning:"INTERNAL_DRAFT_REVIEW_ONLY"}` 的 semantic SHA-256 hex；`mingshuo_delivery_projection`=`mingshuo-delivery-projection.json` 对 facts/assumptions/recommendations/evidence/missing/conflicts/risk 的 closed projection 做 semantic SHA-256。完整 WorkProduct envelope 或自身 content digest 不得作为 manifest item preimage；envelope 顶层 content digest 再按既有 `semantic_digest` 对包含上述固定 manifest 的完整 envelope计算。
- [ ] 复用既有 `ArtifactStorage` 的 PENDING XLSX 与 WorkProduct 表，不修改会计报告 producer、ledger gate或既有 report type。新增 lookup/create/replay 必须校验 owner、确定性 artifact ID、run、capability、version、`report_type=MINGSHUO_SOLUTION_QUOTATION_DRAFT_V1`、DB 实际 `state=PENDING`、payload `artifact_state=PENDING`、文件 raw hash、完整 manifest、Fact Pack binding、envelope content digest，以及恰好一条双向 artifact/work-product 绑定；ABORTED、PUBLISHED、缺失、多义或任一漂移均失败。既有 `publish_run` 必须在移动文件或更新任一行前，若该 run 含上述 Mingshuo report type 就原子 fail-closed；只允许后续独立 successor 的专用确认后发布路径消费它，现有会计 report type 的发布语义保持不变。
- [ ] 同一 `draft_request_id` 是唯一 delivery run identity。artifact ID 与 WorkProduct ID 分别由完整 binding digest 加固定域分隔符产生 opaque、deterministic、server-derived 的 32 位小写十六进制 ID；调用者不得提供，ID 难猜性不是授权边界，认证、tenant+owner intent lookup 和统一 404 才是授权边界。Mingshuo delivery intent 在触碰 ArtifactStorage 前以 `BEGIN IMMEDIATE` 创建，状态只允许 `PREPARED → ARTIFACT_PENDING → WORK_PRODUCT_BOUND`，每次转换需比较旧状态和固定 IDs/digest。第一次创建、并发及 crash-safe 重试必须收敛到同一 artifact/work-product；任何不同 capability、版本、事实包锚点、文件摘要或 envelope摘要返回 `409`，不得创建替代结果。
- [ ] 跨库恢复协议必须覆盖每个 durable 边界：intent commit 前无外部副作用；`PREPARED` 可生成/验收工作簿并用确定性 ID create-or-verify PENDING artifact；artifact commit 后未记 intent 时，重试只接受同 ID/run/report type/hash 的 PENDING row；`ARTIFACT_PENDING` 可 create-or-verify同一 WorkProduct；WorkProduct commit 后未记 intent 时，重试只接受完整同一绑定；最终转换为 `WORK_PRODUCT_BOUND` 后才允许响应。损坏、PUBLISHED/ABORTED、歧义或不同字节稳定失败并保留不可下载证据，不得把 abort 后字节冒充可恢复目标。
- [ ] 临时文件必须位于 ArtifactStorage 私有同文件系统目录，以随机名和 `O_CREAT|O_EXCL`、`0600`、no-follow 语义创建；通过已打开 fd 写入、flush/fsync、从同一 fd 计算 hash，并以同目录原子 rename进入受控 pending 名称。路径不得包含用户字段、project/draft ID 或 display name。未绑定 PENDING 与 ABORTED 工件不得被既有下载或确认路径读取；任何 Mingshuo PENDING 工件（无论是否已绑定）都必须被旧 `publish_run` 原子拒绝。
- [ ] 新 API 只允许 `POST /api/v1/mingshuo/projects/{project_id}/draft-requests/{draft_request_id}/work-product`；两段 ID 均精确为 32 位小写十六进制。请求必须为 `Content-Type: application/json` 的空对象 `{}`，未知/重复 key、0-byte、数组、非 JSON 或超限 body 均为 422。响应只返回 created、artifactId、workProductId、factPackVersion、factPackDigest、workStatus、confirmationStatus、artifactState 和明确的 nonAuthorizing=true，不返回文件路径、owner/tenant、原始 canonical bytes 或内部异常。
- [ ] 错误矩阵固定：非法 ID 或非法空对象合同为 422；当前 tenant+owner 下不存在的 project/draft、跨 tenant/owner 猜测均为同一 404；相同 ID 的不同 binding/state 为 409；SQLite busy/损坏、文件/工作簿/序列化故障为 503。响应、日志和审计均不得泄漏存在性、路径、SQL、凭据、原始 requirements、canonical bytes、认证头或部分文件；日志 allowlist 仅允许 correlation ID、内部 artifact/work-product ID、稳定错误码和不可逆摘要。
- [ ] 现有 Mingshuo project/revision/draft request、会计报告、通用成果人工确认与下载、P01、电池、Scene Pack、V4、史馆、readiness、Harness 和 authority 全部回归通过。

## Delivery Constraints

- 本包只允许十九路径；不得修改 `app/work_products` 冻结合同、report-artifact API、史馆、SceneRun/V4、Fact Pack evaluator/schema、main router、前端或 BFF。
- 允许复用 `backend/app/accounting_reports/storage.py` 的物理 ArtifactStorage，但禁止把 Mingshuo producer伪装成会计报告、复用 AccountingReportSession 或改变会计固定工件门。
- 不实现 PUBLISHED/download、史馆 archive、版本对比、真实报价审批、真实客户数据或生产副作用。
- 不从 draft request 的 `NON_AUTHORIZING` 推断业务授权；它只是绑定一个经验证的事实包版本。
- 任何 machine STOP、远端漂移、第二十条路径、跨域语义放宽、第二事实源、验证失败或独立审查 P0–P2 都必须停止。

## Affected Modules

- 模块：铭硕事实包到中性方案/报价成果 producer、既有 ArtifactStorage 幂等查询与 WorkProduct 绑定。
- 允许路径：manifest 中精确十九路径；后端实现七条、后端测试五条、release manifest schema 一条、离线发布/验收脚本及其测试六条。

## Technical Plan

1. 先写 RED：PASS 当前事实包尚不能形成成果；HOLD/BLOCK/过期/旧版本仍可能被错误消费；并发与 crash window 可能产生重复或孤儿；报价草案可能被误写成授权报价。
2. 新建纯 `delivery.py`，用受限单元格、公式注入防护和 ZIP/OOXML 后验收生成固定 cell projection 的 XLSX；用无自指的五项 manifest、现有 semantic digest 与 artifact gate 形成 `WorkProductEnvelope`。
3. 在 Mingshuo storage 增加 tenant+owner scoped durable intent和单向恢复状态机；同步更新唯一 runtime-data registry/readiness 的 v2 schema 闭合合同，并将新 registry digest 原子传播到 release manifest schema、offline build/verifier、RC1 acceptance 与对应测试；在 ArtifactStorage 增加确定性 ID 的 create-or-verify、完整 PENDING binding复核和 closed replay，并让旧 `publish_run` 对 Mingshuo report type 在任何文件移动前原子拒绝；不改变会计 producer、确认、发布或下载语义。
4. 在 Mingshuo service 中重新加载并验证实时 membership、project、draft request、Fact Pack canonical bytes和所有摘要，按每个 commit/rename crash window恢复同一成果；API 只接受严格 `{}` 并提供脱敏结果。
5. 完成 focused（含 readiness 与 v1→v2 migration/backup recovery）、backend-full、Ruff、三组离线发布/验收脚本测试、Harness/doctor/hook/authority/V2、exact19 preimage，以及 Governance/Python/Security 独立审查；同一 owner 经既有通用 `GET /api/v1/report-artifacts/{artifact_id}/work-product` 读取时，断言响应不含 tenant/owner、request key、canonical bytes 或原始 requirements。

## Implementation Report

2026-09-13 只读盘点确认：当前主线的 Mingshuo API 只到 project/revision/get/draft-request；draft request 只保存 `NON_AUTHORIZING` 身份，不生成成果。现有 WorkProduct/Artifact/confirmation/download 只被会计报告链消费，Mingshuo 对其引用为零；现有 Shiguan adapter只服务丞相旨意。V4 任务详情也明确显示“当前接口没有可授权下载的文件、成果版本和验收记录”。

本轮只编制 proposed 治理三文件，没有修改产品、物化正式 approval、运行 authority、测试产品、commit、push 或部署。

## Acceptance Review

Pending corrected strict validation and independent Governance/Python/Security design review. Proposed JSON 的 `state=APPROVED_FOR_ONE_CHILD` 只是现有 schema 对未来正式 approval 的固定字段；现有 machine authority 不验证 Owner 加密签名，本包依赖受保护 ext-dev、Owner 对 canonical digest 的外部确认和独立直接单亲 approval commit作为治理前提，不能宣称该人工控制已由本 exact19 机器证明。在这些条件成立且 machine authority 返回 GO 前，不产生产品执行权；若未来需要可验证 Owner签名，应另立 authority successor，不能夹入本包。

本包通过后也只证明“事实包 → PENDING 中性成果 → 可人工审阅”纵切完成；不得宣称下载、史馆、V4 完整闭环或生产可用。下一包必须基于最新 ext-dev 把 CONFIRMED 回执原子接到 PUBLISHED/download 与幂等史馆归档，然后再由 V4 任务详情消费该 owner-scoped 关联。
