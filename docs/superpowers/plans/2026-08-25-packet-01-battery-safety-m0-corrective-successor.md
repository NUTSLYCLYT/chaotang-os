# Packet 01 — Battery Safety M0 Corrective Successor Plan

状态：`DRAFT_NON_AUTHORIZING / INDEPENDENT_REVIEW_GO / PRODUCT_STOP_UNTIL_OWNER_DIGEST_AND_MACHINE_GO`

任务：`PACKET-01-BATTERY-SAFETY-M0-CORRECTIVE-SUCCESSOR-20260825`

基线：`origin/ext-dev@a0fef05eb57d2c65113f86b79be6886ea881b72d`

基线 tree：`ff84103cd9c587659028d2f2e28904fae71ae269`

## Phase 0 — Freeze Corrective Governance

1. 本轮只编制 Task、Plan、proposed approval；不运行 product authority，不修改产品代码，不提交或推送。
2. Task 必须显式终止 predecessor 为 `NO_GO_BY_INDEPENDENT_REVIEW`，并逐项绑定 `BAT-P0-01`、`BAT-P0-02`、`BAT-P1-01`、`BAT-P1-02`、`BAT-P2-01`、`BAT-P2-02`。
3. proposed approval 以 strict JSON 和项目 schema 验证；记录 RFC8785 canonical digest、raw SHA-256 和三文件 bundle digest，三者不得混称。bundle digest 的唯一算法是：计算三份 UTF-8 原始文件的 `bytes` 与 `rawSha256`，将 `{path, mode:"100644", bytes, rawSha256:"sha256:<hex>"}` 按 `path` 字典序组成 JSON array，再对 RFC8785 canonical bytes 做 SHA-256；它只绑定三文件传输包，不是 approval authority 身份。
4. 独立 reviewer 只读检查范围、严重性、测试可证性、路径充分性和非目标；任何漏项先修草案再重新摘要。
5. 最终实时核验 `origin/ext-dev` 仍精确等于本基线；若漂移立即 STOP，不 re-anchor。
6. Owner 必须精确确认 canonical approval digest 后，才可另行授权正式三文件 approval commit；本轮授权不包含该动作。

## Phase 1 — Future Approval And Machine Authority

以下步骤全部属于未来授权，不在本轮执行：

1. 把 proposed approval 的相同 JSON 字节物化到
   `.harness/approvals/PACKET-01-BATTERY-SAFETY-M0-CORRECTIVE-SUCCESSOR-20260825.json`，与 Task、Plan 组成精确三文件 approval commit；proposed 临时路径不进入提交。
2. approval commit 必须是 `a0fef05eb57d2c65113f86b79be6886ea881b72d` 的唯一单亲子，且 changed paths 精确匹配 manifest 的 `approvalCommitPaths`。
3. 另获 push 授权后，只普通 fast-forward 推送该精确治理提交；远端漂移即 STOP。
4. 在远端精确等于 approval commit 且干净隔离工作树中运行：
   `node scripts/product-authority.mjs --authorize --task PACKET-01-BATTERY-SAFETY-M0-CORRECTIVE-SUCCESSOR-20260825`。
5. 只有 `GO / APPROVED_FOR_ONE_CHILD` 且 approval digest 精确匹配 Owner 确认值，才允许申请产品写入授权。

## Phase 2 — RED Before Product Changes

1. 从冻结基线建立新的干净候选，不继承旧 exact9 candidate、tree、nonce 或 evidence 身份。
2. 先将 Task 冻结的 11 个负向测试物化为 RED；每个 RED 必须指向对应真实缺陷，而不是导入错误、依赖缺失或测试桩错误。
3. 对 `BAT-P0-01` 参数化全部非 `user` role 并证明整请求拒绝、全链零副作用；对 `BAT-P0-02` 参数化全部同义表达；对 `BAT-P2-02` 同时证明纯软件不误报、软件语境不能压制同句中英文物理 P0；对 `BAT-P2-01` 分别证明异步 job 和同步 authority 的顺序缺口，并用同步屏障证明只读复核后并发替换会让原 version/fingerprint/decree 的精确 reserve/consume 失败关闭；对 `BAT-P1-02` 分别证明全部用户可见模型派生字段、禁令同义变体、固定来源标签、立即行动顺序和 fallback 缺口。
4. 保存 RED 命令、失败断言、基线 SHA/tree 和测试文件摘要到仓库外证据目录；不把运行产物写入候选。

## Phase 3 — Exact10 Corrective Implementation

按以下依赖顺序完成最小修改：

1. 输入信任边界：只要任一客户端消息 role 非 `user`，就在 API schema/handler 层拒绝整个请求并 fail-closed，禁止剔除后继续；所有后续组件共享同一可信用户文本投影，拒绝路径的模型、authority、job、route、数据库业务写入和部门调用均为零。
2. 分类优先级：先识别 P0 同义危险事实，再处理普通上下文排除；区分纯软件/代码/APP 故障与物理电池危险，但软件语境不得压制同一句中的物理 P0。
3. 等级单调性：注册和执行前都重分类；marker 只可收紧，不能把 P0 降为 P1/NOT_APPLICABLE。
4. 执行前置门：同步/异步先用现有只读 authority snapshot 对 payload decree、绑定 route 和安全等级复核，再以原 version/fingerprint/decree 精确 reserve/consume；并发替换时必须失败关闭。安全门必须早于 authority 消费/预留、job 持久化和其他业务副作用。
5. 输出后置门：对 `rationale`、所有用户可见部/司意见、`council_verdict`、`final_verdict`、每条 `recommendations` 和所有 fallback 做确定性复核；覆盖远程复位/重启/旁路 BMS、直接维修/送电/充放电和绕过人工确认三类禁令及中英文直接同义变体，发现禁令时替换完整不安全响应并留下审计原因。P0、P1 和 fallback 首段严格按“固定 `立即行动：` → 禁止动作 → 人工确认 → `sourceLabel=USER_TEXT_RULE_CLASSIFICATION_NON_LIVE`/证据边界”输出；不得声称 LIVE 设备、传感器、遥测或现场证据。
6. 只修改 approval 的 exact10；需要第十一路径即 STOP。禁止重构无关图、API、数据库或测试基础设施。

## Phase 4 — GREEN And Frozen Candidate

1. 11 个冻结负向测试全部 GREEN，并逐项映射到六项 finding；HTTP 状态、调用计数、持久化状态、marker/visible level、全部用户可见响应字段、固定来源标签和立即行动顺序同时验证。
2. 运行 proposed approval 的 focused、完整 backend、Ruff、exact10 structure 和治理回归矩阵。
3. 在产品字节冻结后申请一次本地 candidate commit 授权；未获授权不得 commit。
4. 候选必须是 approval commit 的唯一单亲子，changed paths 精确为 exact10，`2 ADD + 8 MODIFY`、全部 `100644`。
5. 记录 candidate commit/tree、逐路径 mode/blob OID manifest、full-index binary patch digest 和工作树 clean 证明；这些是候选身份，不回填或修改已批准 approval。

## Phase 5 — Independent Review And Ten-Round Acceptance

1. 在同一 candidate SHA/tree 上进行独立 Python Review 与 Security Review，重点复核角色注入、同义词优先级、等级单调性、副作用顺序、最终输出/fallback 和软件误报。
2. 任一未关闭 P0–P2 立即标记 `NO_GO_BY_INDEPENDENT_REVIEW`，不得进入连续验收。
3. 复审 GO 后，连续 10 次运行同一个精确命令：
   `node scripts/product-authority.mjs --verify-candidate --task PACKET-01-BATTERY-SAFETY-M0-CORRECTIVE-SUCCESSOR-20260825`。
4. 每轮必须重跑 proposed approval 的同一十项验证，保存 candidate SHA/tree、approval digest、evidence digest、exit code 和时间；任一失败、字节变化或验证配置变化从第 1 轮重计。
5. 只有 10/10 返回 `PASS / CANDIDATE_ELIGIBLE_FOR_OWNER_ACCEPTANCE`，且身份完全一致，才向 Owner 提交验收摘要。

## Phase 6 — Owner Acceptance And Delivery

1. Owner 按 candidate SHA/tree、canonical approval digest、exact10 blob manifest、patch digest、10 个 evidence digest 和独立复审结论做精确接受。
2. candidate push、试点、发布、部署、真实模型、公网和外部设备动作均不在本任务内，必须分别获得新 authority。
3. 回滚单位是未来完整 candidate commit，并需单独授权；禁止 reset、force-push 或局部拆除安全门。

## Evidence Matrix

| Finding | RED/GREEN 节点 | 关键负向断言 |
| --- | --- | --- |
| `BAT-P0-01` | `test_client_non_user_role_fails_closed_without_side_effects` | 任一非 `user` role 使整个请求失败关闭；禁止剔除后继续；模型、authority、job、route、数据库业务写入和部门调用全部为零。 |
| `BAT-P0-02` | `test_common_p0_hazard_synonyms_fail_closed` | 全部冻结同义词为 P0/BLACK；模型和副作用为零。 |
| `BAT-P1-01` | `test_canonical_p1_marker_cannot_bind_p0_facts` | 可见 P0 事实不能被 marker 降级；注册与执行复核一致。 |
| `BAT-P1-02` | `test_all_user_visible_battery_response_fields_reject_prohibited_actions`、`test_battery_fallback_preserves_non_live_source_immediate_action_black_and_human_confirmation`、`test_battery_safety_response_labels_user_text_rule_as_non_live`、`test_battery_safety_response_starts_with_immediate_next_step` | 全部用户可见模型派生字段中的三类禁令及直接同义变体被完整替换；P0/P1/fallback 首段先给确定性立即行动，再给禁令、人工确认和非 LIVE 来源标签。 |
| `BAT-P2-01` | `test_async_battery_safety_gate_precedes_job_reservation_and_persistence`、`test_sync_battery_safety_gate_precedes_authority_consumption` | 安全复核先行；并发替换使精确 reserve/consume 失败关闭；门失败时 job/authority/route/model/department 全部零副作用。 |
| `BAT-P2-02` | `test_plain_battery_software_bug_does_not_trigger_physical_gate`、`test_software_context_cannot_suppress_physical_p0_hazard` | 纯软件故障不误报物理事故；软件语境与真实 P0 并存时仍为 P0/BLACK，且模型和全部业务副作用为零。 |

## Stop Conditions

远端漂移、Owner digest 未确认、authority STOP、RED 无法稳定证明、需要第十一路径、任何矩阵失败、候选/证据身份变化、工作树污染或独立复审出现 P0–P2 时立即 STOP。不得 re-anchor、降级 finding、删减负向测试或复用 predecessor 的 NO-GO 证据。
