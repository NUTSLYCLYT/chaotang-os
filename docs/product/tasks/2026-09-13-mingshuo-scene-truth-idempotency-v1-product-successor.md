# 铭硕场景入口事实诚实与幂等 V1 Product Successor

任务 ID：`MINGSHUO-SCENE-TRUTH-IDEMPOTENCY-V1-PRODUCT-SUCCESSOR-20260913`

冻结基线：`origin/ext-dev@0ac8fe9083913839fbeba2aec8909baa964fd3c8`；tree：`70b7ce20283b39dda27008fd5f5534037dfb515d`。

## Status

Draft

`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Product Definition

本 successor 关闭铭硕第一交付入口在真实浏览器验收中暴露的两个最早阻断：一是非空占位文本被误报为资料完整、低风险并可继续；二是相同表单可无提示重复创建多个 SceneRun/BoardMission。它只把 `single-product-export-diagnosis` 恢复为事实诚实、不可冒充业务放行的预检入口，并为浏览器提交增加 owner/tenant scoped request-key 幂等。

当前主线已经有唯一 Mingshuo Fact Pack evaluator、认证 API、V4 军机处和既有 WorkProduct/史馆能力。本包不得复制这些事实源，也不实现报价、下载、确认或归档。后续纵切必须引用本轮不可变 SceneRun 输入身份并进入现有 Mingshuo Fact Pack，再复用 WorkProduct、人工确认、下载与史馆。

历史 `0e7353acb` A1 字节仅作为 `BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE` 的语义参考；不得 cherry-pick 或覆盖当前 S4、V4、输入预算、响应预序列化和后继安全修复。

## Acceptance Criteria

- [ ] Candidate 只修改 manifest 精确十路径，结构必须为 `1 ADD + 9 MODIFY`，全部 `100644`。
- [ ] 单品出海的非空字段只证明“用户提交了文本”，不证明认证、价格、产能、交期、参数或市场事实为真；结果不得返回 `CONDITIONAL_GO`、低风险、数值置信度、产品就绪评分、推荐市场或 `canProceed=true`。
- [ ] 完整输入只能形成 `PRECHECK_ONLY`、公共 `confidence=null`、`riskGrade=medium`、`opportunityGrade=low`、`canProceed=false`、`status=completed` 和 `boardMission.stage=awaiting_input`；空字段、明确缺失占位或确定性冲突形成 `BLOCKED/high/low/blocked`。`awaiting_input` 只表示资料补齐，不表示已创建可执行商业任务。
- [ ] `无`、`没有`、`未知`、`未提供`、`未报价`、`待提供`、`待补充`、`待确认` 等闭合集合只在对应结构化字段中作为缺失占位，不能以泛化自然语言分类器替代 Mingshuo Fact Pack。
- [ ] `未经核验`、`用户申报` 等限制语不得被删除；有具体值时保留原文并进入 verification gaps，不得升级为已验证事实。
- [ ] 单品输入原文、attachments、demo、pack slug、operation 和版本化 canonicalization 形成不可变 RFC 8785 UTF-8 source snapshot；服务端对所有字符串递归 NFC 后的同一闭合对象计算 `sha256:<64 lowercase hex>` `serverInputDigest`，读取时重新核验。source snapshot、digest 和 request key 只允许持久层复核，不得进入公共 run/mission JSON、`details`、错误、日志、遥测、V4 列表/详情或浏览器 console。
- [ ] 幂等键只通过既有 JSON body 传输：前端 `requestKey` 精确映射后端 `request_key`；它必须是浏览器 `crypto.randomUUID()` 生成的 canonical lowercase UUID v4，服务端严格拒绝缺失、非 v4、非 canonical 或超长值，禁止 fallback 自动生成。
- [ ] 同一 owner/tenant/operation/key 加相同 fingerprint 必须返回同一 run/mission；冲突 fingerprint 稳定返回 `409 {"status":"error","reason":"idempotency_conflict"}`，不泄漏已存在身份且不产生任何新行。键记录与 SceneRun 一一对应，不允许创建无 run 的预留垃圾行，不形成独立于现有 run 生命周期的无界存储面。
- [ ] 两个独立连接/线程在同 key 同 payload 或冲突 payload 下必须串行化：`BEGIN IMMEDIATE` → scoped replay/冲突检查 → 创建 run/mission/key mapping → 公共 JSON 序列化验证 → commit；唯一约束精确绑定 `(tenant_id, owner_user_id, operation_scope, request_key)`。
- [ ] 浏览器未知写入状态只在 `sessionStorage` 保存 principal-bound 的 request key、非权威 `clientRevisionFingerprint`、pack slug、input revision 和 expiry，不保存原始输入；该 fingerprint 采用与服务端相同的递归 NFC、字段集、顺序和 SHA-256，仅决定本地是否允许复用 pending key，绝不能替代 `serverInputDigest`。刷新后不得静默换 key 或自动重放，必须提示先到任务列表核对。同一会话中用户重新填入完全相同版本并明确重试时复用原 key；匹配成功或明确放弃后才清除。过期记录只可阻断并提示核对，不得自动创建新写入；登出或认证 principal 改变时丢弃不匹配 pending metadata。
- [ ] 成功返回后原“提交诊断”不可再次无提示创建任务；只有用户修改输入并明确重新诊断时才生成新 key。服务端仍是最终幂等门，不能只依赖按钮禁用。
- [ ] 写入响应必须在 transaction commit 前完成公共 JSON 序列化；snapshot/digest 校验、mapping insert/foreign-key、replay 序列化、冲突或存储失败不得残留 run、mission 或 request-key 行。
- [ ] 现有 `scene_runs.confidence INTEGER NOT NULL` 不迁移、不重建：当前单品 V1 内部持久化精确使用 `-1` 哨兵，并由验证通过的 truth-contract identity 绑定；模型/API/前端的公共投影只允许 `null`。任何其他 pack、无有效 identity、identity/snapshot/digest 漂移或 legacy row 都不得把 `-1` 当作分数，也不得把历史数值继续展示成当前可信评分。
- [ ] 私有 `scene_run_request_identities` relation 的 closed schema 精确冻结为：`tenant_id`、`owner_user_id`、`operation_scope`、`request_key`、`pack_slug`、`canonicalization_version`、`identity_schema_version`、`truth_contract_version`、`source_snapshot_json`、`server_input_digest`、`run_id`、`created_at`；复合主键为前四项，`run_id` 唯一且外键到 `scene_runs.id`。mapping 不单存 mission id；mission 必须由现有 `board_missions.run_id UNIQUE` 推导，读取时同时验证 run/mission pack 与 principal 一致。
- [ ] legacy 单品行必须只读、零回写地降级为 `status=blocked`、`verdict=LEGACY_UNVERIFIED`、`confidence=null`、`riskGrade=high`、`opportunityGrade=low`、`canProceed=false`、mission `blocked`；无 snapshot、非法 snapshot、digest 不匹配、mapping 指向缺失 run/mission 均 fail-closed。
- [ ] 前端用 input revision/key 约束响应；请求飞行期间任一输入变化立即隐藏旧结果、禁用旧任务链接并废弃该展示 revision。即使改回原文，也必须显式重新诊断；409、422、401、已知 5xx 与未知网络/超时分别显示，不自动重试或静默换 key。
- [ ] 前端对单品公共 `confidence=null` 精确显示“未评分”，不得显示 `null%`、0%、替代分数或由风险等级暗示产品评分；其他四个 Scene Pack 的数字展示保持不变。
- [ ] 运行时泄漏断言必须覆盖 API response、BFF response、V4 list/detail、`SceneRequestError` 和 browser console spy，证明 snapshot、server/client digest 与 request key 均不出现。
- [ ] owner/tenant 隔离、S4 规则分析、其他四个 Scene Pack、现有 V4 列表/详情、输入预算和控制台无错误全部回归通过。

## Delivery Constraints

- 只允许十条 product paths；不得出现第十一条路径。
- 不修改 Mingshuo Fact Pack、Mingshuo 数据库、WorkProduct、会计成果库、史馆、鸿胪寺、大殿、上书房、Harness 或 authority。
- 不创建新 BFF 路由；前端只在既有 scene client 和组件边界内传递 request key。
- 不修改现有 BFF：因为它只转发认证与内容类型，request key 必须在 JSON body 内传输，禁止依赖 `Idempotency-Key` header。
- 不调用模型、IMA、MCP、外部网络、真实客户数据或凭据；不生成真实报价、市场建议、认证判断或生产发布。
- 不把 `completed` 解释为业务完成、人工确认、下载可用、史馆归档或商业成功。
- 远端漂移、machine STOP、路径扩大、S4 回退、第二事实源、验证失败或独立审查 P0–P2 时立即停止。

## Affected Modules

- 模块：Scene Pack 单品出海预检、SceneRun/BoardMission 持久化、浏览器提交控制与 V4 安全展示。
- 允许路径：manifest 中精确十路径；后端五条、前端五条。

## Technical Plan

1. 在新 authority 下先增加真实 RED：复现占位输入错误低风险放行、历史无身份/非法 snapshot/digest 漂移数据冒充当前结果、同 key 重放重复写入、同 key 冲突输入、双连接竞争、提交后重复点击、stale response 和未知写入结果。
2. 将 A1 donor 的“不可评分预检、原文快照、摘要和 legacy 降级”语义最小移植到当前 Scene Pack 实现，逐项保留当前 S4 和响应预序列化后继。
3. 在现有 Scene Pack SQLite transaction 内增加 closed-schema 私有 `scene_run_request_identities`；使用 `BEGIN IMMEDIATE`、四字段复合主键、唯一 `run_id` 外键和完整 rollback。mapping 只引用 run，mission 通过现有 `board_missions.run_id UNIQUE` 推导并复核，不允许拼接不同 run/mission。
4. 保留现有 SQLite `INTEGER NOT NULL`，以 truth-contract identity 保护内部 `-1` 哨兵；API/model/frontend 只输出 nullable 公共投影，legacy 或身份失败一律保守降级。
5. 前端为一个输入 revision 持有 JSON body request key 和非权威 `clientRevisionFingerprint`；服务端独立计算 `serverInputDigest`。两者采用明确递归 NFC，但只有服务端 digest 决定 replay/409。输入变化使旧响应失效；未知结果只保存无原文的短期 pending identity，成功或显式放弃前不换 key；成功后不允许同一版本重复提交。
6. 完成 focused、backend-full、frontend-full/typecheck/lint/build、Harness/doctor/hook/authority/V2、exact10 preimage、真实浏览器正常与负向链及独立 Governance/TypeScript/Python/Security Review。

## Implementation Report

2026-09-13 在干净 `0ac8fe9` 非生产环境完成真实浏览器诊断：注册、登录、SceneRun、军机处 V4 列表/详情/证据和跨租户隔离可用；但包含“无认证、未报价、未知产能、未知交期、参数未经核验”的合成输入得到 `CONDITIONAL_GO`、低风险、`missingItems=[]`、`canProceed=true`。同一输入再次点击又产生两个不同的 run/mission，列表从一项增至三项。

证据保存在 `/tmp/chaotang-rc-browser-evidence-20260913/README.md` 及其截图中。当前只编制治理草案，没有修改产品、创建正式 approval、运行新 authority、commit、push 或部署。

## Acceptance Review

Pending corrected strict validation and independent review. Proposed JSON 虽因现有正式 schema 使用 `APPROVED_FOR_ONE_CHILD`，但它位于非正式 proposed 路径、未提交且未获 Owner 精确摘要确认；复制到正式 approval path 并形成独立 approval commit 前没有任何执行权。本治理包通过只证明十路径范围可供 Owner 精确确认；不代表产品已实施，也不代表铭硕方案/报价、人工确认、下载或史馆闭环已经完成。
