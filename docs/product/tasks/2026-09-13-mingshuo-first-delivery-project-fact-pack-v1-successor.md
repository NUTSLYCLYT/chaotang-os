# 铭硕第一交付 Project + Fact Pack + Runtime Data V1 Product Successor

任务 ID：`MINGSHUO-FIRST-DELIVERY-PROJECT-FACT-PACK-V1-SUCCESSOR-20260913`

冻结基线：`origin/ext-dev@3b0e4541a76385f348e6196af6983aa2dca2b9eb`；tree：`11295a5dbb1b0869855c87e907a98e3dd6e0e179`。

## Status

Draft

`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_EXACT_DIGEST_CONFIRMATION`

## Product Definition

本 successor 是铭硕第一交付闭环的第一段持久化接线：在已落地的唯一 Python Fact Pack evaluator 上，建立认证 owner/tenant 绑定、项目身份、不可变需求修订、不可变 Fact Pack 修订、canonical digest、非授权草案请求，以及该新 SQLite 数据的统一 readiness、备份/恢复与 Release registry identity。它关闭“Fact Pack 没有持久化业务消费者”的最早断点，但不把本包描述为完整浏览器交付闭环。

现行主线已有通用 Scene Pack S4、军机处任务看板、WorkProduct/Confirmation、会计成果下载和史馆归档；这些能力目前尚未被同一铭硕业务身份串联。本包不复制它们，也不把会计成果存储或通用 Scene Pack 数据库冒充铭硕事实源。后续包必须以本包冻结的 `tenant_id + owner_user_id + project_id + fact_pack_version + fact_pack_digest` 为唯一跨模块引用，再接方案/报价 producer、人审、下载、史馆和 V4。

客户端提交的 tenant、owner、project ID、decision、digest、状态、评估日期、价格权限、生产或业务成功字段都不是事实。服务端从 `CurrentUser` 绑定 tenant/owner，生成项目身份，并调用 `backend/app/mingshuo/fact_pack.py` 的唯一 evaluator。Node relay、Scene Pack、模型、IMA、表格和前端不得成为第二 evaluator。

### Closed HTTP contract

- `POST /api/v1/mingshuo/projects`：创建项目、首个需求 revision 与首个 Fact Pack revision；新建返回 `201`。
- `POST /api/v1/mingshuo/projects/{project_id}/revisions`：为现有 owner-scoped 项目追加不可变需求/Fact Pack revision；新建返回 `201`。
- `GET /api/v1/mingshuo/projects/{project_id}`：读取当前项目快照；成功返回 `200`。
- `POST /api/v1/mingshuo/projects/{project_id}/draft-requests`：对当前 PASS revision 创建非授权草案工作项；新建返回 `201`，精确幂等重放返回 `200`。
- 未认证统一 `401`；未知、跨 owner 或跨 tenant 统一 `404`；幂等键冲突、revision 上限或状态冲突为 `409`；未知字段、非法 JSON、重复 JSON key、格式或容量越界为 `422`；存储、完整性或响应投影不可用为脱敏 `503`。
- 所有输入/输出 DTO 均 `extra="forbid"`；响应不暴露 owner、tenant、内部 SQLite 错误、SQL、路径或密钥。

### Closed input and authority contract

- 整体 UTF-8 request body 不超过 `1,048,576` bytes；继续沿用 evaluator 的 depth `64`、node count `32,768` 和重复键拒绝。
- `project_id` 只由服务端生成，精确为 32 位小写十六进制；所有 path ID 都必须先满足同一格式再查库。
- `request_key` 必须满足 `^[A-Za-z0-9._:-]{16,128}$`。
- 项目名为 1–200 Unicode scalar；需求原文为 1–20,000 Unicode scalar 且不超过 100,000 UTF-8 bytes；每项目最多 64 个 revision。
- `productLines` 为现有四值枚举，1–4 项且唯一；`markets` 与 `languages` 各 1–16 项，单项分别不超过 64/16 Unicode scalar，规范化后不得重复。
- `skuCandidates` 继续为 3–5；`evidence`、`facts`、`claims` 各最多 512；`channels` 最多 4 且 ID 唯一；所有标识和文本继续满足现行 Fact Pack schema。
- 客户端仅提交项目名、需求原文、产品线、市场、语言及非授权候选 SKU/evidence/fact/claim/channel 内容。服务端覆盖并固定 tenant、owner、project ID、项目状态、schema/source policy、安全、knowledge、business-success、production 和 commercial authority 字段。
- 本包没有价格审批系统。服务端必须固定 `commercial.priceAuthority.status=MISSING`、`approver=null`；任何 PRICE fact 或 quote request 都使 evaluator 返回 BLOCK，draft request 不得被创建。客户端提交价格权限、批准状态或对外承诺字段必须 `422`，不得静默采用。

### Canonical bytes, time and integrity contract

- 原始请求先做有界 UTF-8、重复 key 拒绝和 closed DTO 校验；随后服务端构造完整 `MingshuoProjectFactPackV1` 投影。
- full-pack canonical bytes 唯一算法为：`json.dumps(value, ensure_ascii=False, allow_nan=False, sort_keys=True, separators=(",", ":")).encode("utf-8")`；`fact_pack_digest` 唯一算法为 `sha256:` 加上述 bytes 的 SHA-256 小写十六进制。
- 禁止对原始 client JSON、Node relay 输出、SQLite JSON 文本或响应 DTO 计算事实 digest。`fact_pack.py` 提供的唯一 canonical projection/digest API 与 evaluator 使用同一完整 pack 值。
- 每个不可变 revision 同库存储 canonical bytes、`requirements_revision_id`、requirements digest、pack version、pack digest、decision、reasons、fact/evidence/claim digests、`evaluated_utc_day`、evaluator/schema policy version。读取时以已存 `evaluated_utc_day` 复算原决定和全部 digest，证明历史 revision 自洽，不把当前日期写回旧 revision。
- 创建 draft request 时必须对同一不可变 canonical bytes 使用当前服务端 UTC day 再评估；跨日到期、时钟回拨、当前结果非 PASS 或任何摘要漂移均拒绝且不写 draft request，不修改旧 revision。

### SQLite, tenancy, idempotency and lifecycle contract

- 唯一运行库为受控 `backend/data/mingshuo.sqlite3`；不得按 tenant 另建文件，不得使用 Scene Pack、会计、史馆或军机处表保存本域真值。
- 所有查询和写入谓词都必须包含 `(tenant_id, owner_user_id, project_id)`；revision 唯一性绑定同一 owner/tenant/project，request-key 唯一范围为 `(tenant_id, owner_user_id, request_key)`。
- 服务端 idempotency fingerprint 必须绑定 operation、tenant、owner、project、当前 Fact Pack version/digest 和固定 request-state-contract version，不含任何客户端 authoritative field。相同 key + 相同 fingerprint 返回同一现有记录；相同 key + 不同 fingerprint 稳定 `409`。
- SQLite 连接必须 `foreign_keys=ON`、WAL、`synchronous=FULL`、有界 busy timeout；写事务使用 `BEGIN IMMEDIATE`。并发只允许一个 winner，失败整体 rollback；unique collision 仅在身份和 fingerprint 全等时返回既有结果。
- `mingshuo.sqlite3` 必须成为现有 `RUNTIME_DATA_ENTRIES` 的第八个闭合登记项，冻结表、trigger、user version 和真实 schema digest；`readiness.py` 与 `sqlite_backup.py` 继续数据驱动复用该唯一 registry，不修改其产品实现。
- 候选必须原子更新 release manifest schema、build/verify/RC acceptance 三个消费者及其测试到同一新 runtime registry digest；任何新旧 digest 混用、缺库、多库、未知文件、schema/trigger 漂移、WAL 非一致快照、备份篡改或恢复后 identity/replay 漂移均 fail-closed。
- 本包只证明非生产合成数据的闭合备份/恢复演练，不宣称真实客户数据加密备份、生产 RPO/RTO、生产恢复或灾备已完成；真实客户数据和生产部署继续禁止。

## Acceptance Criteria

- [ ] approval commit 是冻结基线的直接单亲子，只包含 formal approval、Task、Plan 三条路径；product candidate 是该 approval 的唯一直接单亲子。
- [ ] product candidate 精确为十九路径 `5 ADD + 14 MODIFY`，全部 `100644`，不得出现第二十路径。
- [ ] 新项目、需求 revision、Fact Pack revision 与 draft request 均绑定当前认证身份，未知与跨 owner/tenant 使用同一 `404` 且不泄露存在性。
- [ ] canonical bytes/digest、requirements binding、历史时钟与当前时钟复评估闭合；过期或漂移在 draft 写入前 fail-closed。
- [ ] 只有当前、已持久化、复算一致且以当前 UTC day 仍为 PASS 的 revision 能创建非授权 draft request；`HOLD/BLOCK/STOP`、旧版本、悬空引用、价格请求或跨租户引用不得产生写入。
- [ ] 幂等重放、并发 winner、失败回滚、重启读回、response 序列化失败、非法 JSON/字段/边界均有真实负向测试。
- [ ] 第八库被统一 readiness、backup/restore/rehearse 和 Release registry identity 接受；缺失时可启动空数据环境，存在时必须精确 schema；未知或漂移均拒绝。
- [ ] draft request 只表示“可进入工部/户部草案编制”，不含价格、成果、外部承诺、发布、设备/工艺指令、知识晋级或业务成功结论。
- [ ] focused、backend-full、Ruff、runtime lifecycle、Release registry tests、Fact Pack relay/lineage、Harness/doctor/hook、authority regression、V2 和 diff 全绿；独立 Governance、Python 与 Security Review 无 P0–P2。

## Delivery Constraints

- 只允许 manifest exact19；不修改 `readiness.py`、`sqlite_backup.py`、Scene Pack、accounting/work-products、Shiguan、Junjichu、前端、BFF、Harness、authority、外部配置或其他数据库。
- 不接 IMA、KnowledgeRouter、MCP、LangGraph、外部模型、网络、真实客户数据、真实价格、真实凭据、OPC、设备控制、工艺放行或生产部署。
- 不生成成果文件、不确认成果、不下载、不归档、不发布、不交易；本包不宣称第一交付里程碑已经完成。
- 不继承任何历史 donor、Scene Pack 或会计成果的 approval、authority、candidate、验证、审查、业务状态或存储身份。
- 远端漂移、machine STOP、第二十路径、第二 evaluator、无法在 exact19 内闭合数据生命周期、验证失败或独立审查 P0–P2 时立即停止。

## Affected Modules

- 模块：铭硕项目/需求/Fact Pack revision、非授权 draft request、认证 API、SQLite 运行数据 registry/readiness/backup/release identity。
- 允许路径：formal approval manifest 中精确十九条 product paths。

## Technical Plan

1. 先写认证、租户、canonical bytes、版本、时钟过期、幂等、并发、rollback、schema drift 和 Release digest 分叉的真实 RED。
2. 在 `models.py` 定义 closed DTO；`storage.py` 建立单一铭硕域数据库与原子事务；不得复制其他域表。
3. 在 `service.py` 绑定 `CurrentUser`、服务端 UTC 与唯一 evaluator；生成并验证 canonical pack bytes、digest 和不可变 revision 关系。
4. 在 `api/mingshuo.py` 开放冻结四个 endpoint，使用稳定脱敏状态；`main.py` 只挂载 router。
5. `fact_pack.py` 只增加完整 pack canonical projection/digest；`__init__.py` 只导出本域必要入口，不改变既有 evaluator 决策语义。
6. 在 runtime registry 登记真实 schema；以现有数据驱动 readiness/backup 实现证明第八库的空库、存在、备份、篡改、恢复和 schema fail-closed。
7. 机械计算新 registry digest并原子同步 deployment schema 与三条 release consumers/tests；不得保留旧 digest 的可执行接受路径。
8. 未提交阶段完成 focused、Ruff、Release registry 回归与三审；冻结 exact19 后创建一次本地 candidate。提交后完成完整矩阵、最终三审与 machine verify-candidate；全部通过且远端仍为 approval 才允许普通快进。
9. 本包落地后再签发“方案/报价 producer + 中性 WorkProduct/Artifact + 人审”与“V4/BFF + 下载/史馆/任务回看”successor，直至真实浏览器闭环。

## Implementation Report

只读盘点确认：`3b0e4541…` 已提供唯一 Python Fact Pack evaluator及受限 Node relay；当前 `/scene-pack/proposal-quotation-tender` 能保存通用规则预分析并创建 V4 mission，但没有 Fact Pack/project/version/digest 绑定。现有人工确认与 XLSX 下载只服务会计成果，史馆与军机处强链只服务既有 reply/case；不得借名宣布铭硕闭环已完成。

盘点同时确认，`backend/app/readiness.py` 和 `backend/app/operations/sqlite_backup.py` 只接受闭合 `RUNTIME_DATA_ENTRIES`，而 Release schema/build/verify/RC runner 还冻结 registry digest。原 exact9 若直接创建 `mingshuo.sqlite3`，会让 readiness 以 unknown runtime entry 失败，亦无法形成受控 Release identity；因此本草案在 approval 前扩为原子 exact19，而不是上线后另补孤立数据治理。

本治理草案尚未创建 formal approval、产品 candidate、数据库、API、浏览器入口、交付物或归档；没有读取真实客户数据，也没有部署。

## Acceptance Review

Pending strict governance validation, independent Governance/Python/Security Review and Owner exact canonical digest confirmation. 通过本包仅意味着“认证需求 → 版本化 Fact Pack → 非授权草案请求”的后端第一段及其非生产数据生命周期可验证；方案/报价内容、人审、下载、史馆与 V4 仍须后继包验证。
