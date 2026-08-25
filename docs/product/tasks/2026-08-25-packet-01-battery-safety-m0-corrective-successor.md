# Packet 01 — Battery Safety M0 Corrective Successor

任务 ID：`PACKET-01-BATTERY-SAFETY-M0-CORRECTIVE-SUCCESSOR-20260825`

冻结基线：`origin/ext-dev@a0fef05eb57d2c65113f86b79be6886ea881b72d`

冻结基线 tree：`ff84103cd9c587659028d2f2e28904fae71ae269`

> 状态：`DRAFT_NON_AUTHORIZING / PREDECESSOR_NO_GO_BY_INDEPENDENT_REVIEW / PRODUCT_STOP`
>
> 本草案遵守 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`。它只定义纠偏范围和验收合同，
> 不构成 machine GO，不授权产品写入、提交、推送、试点、发布或部署。

## Status

Draft

细分状态：`DRAFT_NON_AUTHORIZING / INDEPENDENT_GOVERNANCE_AND_SECURITY_REVIEW_GO / OWNER_DIGEST_CONFIRMATION_PENDING / PRODUCT_STOP`

## Product Definition

- 目标用户：把电池事故或电池技术问题交给朝堂判断的普通用户，以及需要对安全结论负责的 Owner 和审核者。
- 用户行为：用户提交电池相关描述；系统在任何模型调用、authority 注册/消费、任务持久化或执行副作用前，先判定事故等级并给出不可降级的安全响应。
- 最终成果：一份可审计的电池安全判断，包含等级、证据事实、固定可见来源标签、10 秒内可识别的立即行动、禁止动作、人工确认要求、路由和最终回复；纯软件问题不会被误报为物理事故。
- 所属闭环：办事闭环。
- 当前成熟度：`ADVISORY / NO_GO_BY_INDEPENDENT_REVIEW`。
- 目标成熟度：`VERIFIED`；不声称专业工程签字、现实设备控制或付费验证。
- 前序任务：`PACKET-01-BATTERY-SAFETY-M0-SUCCESSOR-20260825` 已终止为 `NO_GO_BY_INDEPENDENT_REVIEW`。旧 exact9 字节、candidate 身份和验证证据不得继承为通过证据。

## Independent Review Findings Bound To This Successor

| ID | 级别 | 已证实问题 | 必须达到的纠偏结果 |
| --- | --- | --- | --- |
| `BAT-P0-01` | P0 | 客户端可提交 `assistant` role；分类/API 复核只拼接 `user` 消息，但模型接收全部消息，危险事实可绕过前置分类并进入后续 authority 链。 | 只要任一客户端消息的 role 不是 `user`，就在输入边界拒绝整个请求并 fail-closed；禁止剔除后继续。分类、模型输入、注册与执行复核只使用同一可信用户文本投影，且模型、authority 注册/预留/消费、job 持久化、route snapshot、数据库业务写入和部门调用全部为零。 |
| `BAT-P0-02` | P0 | 常见事故表达被 `_SAFETY_CONTEXT` 提前判为 `NOT_APPLICABLE`，包括“正在燃烧、已经失火、发烟、电解液泄漏、火苗、烧起来、on fire、火海、烧穿、焚毁、在烧”。 | P0 危险词优先于普通上下文排除；中英文常见同义表达全部 fail-closed 为 P0，禁止调用模型或产生业务副作用。 |
| `BAT-P1-01` | P1 | canonical P1 marker 能绑定可见 P0 事实；执行链信任 marker 等级，仅在 marker 缺失时重新分类。 | marker 只能收紧不能降级；每次注册和执行前都按可见可信用户事实重分类，并采用 `max(marker_level, visible_level)` 的 fail-closed 结果。 |
| `BAT-P1-02` | P1 | 最终模型输出与 fallback 没有确定性复核，可能给出“立即远程复位、直接下发维修、无需人工确认”等禁令，fallback 又可能漏掉 BLACK、人工确认和 P0 应急动作。 | 确定性后置 safety guard 扫描或替换全部用户可见模型派生字符串，包括 `rationale`、部/司意见、`council_verdict`、`final_verdict` 和每条 `recommendations`；覆盖远程复位/重启/旁路 BMS、直接维修/送电/充放电和绕过人工确认三类禁令及其中英文直接同义变体。P0、P1 和 fallback 均按“`立即行动：` → 禁止动作 → 人工确认 → 来源标签/证据边界”顺序输出；所有 fallback 保留 BLACK 和对应 P0/P1 确定性行动。 |
| `BAT-P2-01` | P2 | 执行安全门晚于副作用：异步路径先预留/持久化 job，同步路径先消费 authority。 | 同步与异步执行均先用只读 authority snapshot 复核绑定的 decree、route 和安全结果，再以原 version/fingerprint/decree 精确 reserve/consume；并发替换导致后续 reserve/consume 失败关闭。门失败时 authority 消费/预留、job 持久化、route snapshot、模型和部门调用计数全部为零。 |
| `BAT-P2-02` | P2 | “电池管理软件出现故障”“电池 APP 报警功能故障”等纯软件问题因通用“故障/告警/报警”被误判为物理事故。 | 只有物理电池/电芯/PACK/储能柜上下文与危险事实组合才进入安全门；纯软件、代码、APP 问题保持普通软件路由，但软件语境绝不能压制同一句中的物理 P0 事实。中英文“软件故障 + 冒烟/燃烧/on fire”等混合输入必须 fail-closed 为 P0/BLACK，且模型和全部业务副作用为零。 |

## Frozen Negative Tests

以下节点名是后继实现的最小 RED/GREEN 合同；不得删除、改弱或以 mock 成功替代：

1. `backend/tests/test_chancellor_drafts_api.py::test_client_non_user_role_fails_closed_without_side_effects`
2. `backend/tests/test_battery_safety.py::test_common_p0_hazard_synonyms_fail_closed`
3. `backend/tests/test_battery_safety.py::test_software_context_cannot_suppress_physical_p0_hazard`
4. `backend/tests/test_battery_safety.py::test_canonical_p1_marker_cannot_bind_p0_facts`
5. `backend/tests/test_chancellor_graph.py::test_all_user_visible_battery_response_fields_reject_prohibited_actions`
6. `backend/tests/test_chancellor_graph.py::test_battery_fallback_preserves_non_live_source_immediate_action_black_and_human_confirmation`
7. `backend/tests/test_chancellor_graph.py::test_battery_safety_response_labels_user_text_rule_as_non_live`
8. `backend/tests/test_chancellor_graph.py::test_battery_safety_response_starts_with_immediate_next_step`
9. `backend/tests/test_decrees_api.py::test_async_battery_safety_gate_precedes_job_reservation_and_persistence`
10. `backend/tests/test_decrees_api.py::test_sync_battery_safety_gate_precedes_authority_consumption`
11. `backend/tests/test_battery_safety.py::test_plain_battery_software_bug_does_not_trigger_physical_gate`

角色测试至少参数化覆盖 `assistant`、`system`、`tool` 和混合 role 列表，并断言整个请求被拒绝而不是剔除后继续；同义词测试至少参数化覆盖本任务表中列出的全部中英文表达；软件/物理混合测试至少覆盖“电池 APP 报警功能故障，但电芯正在冒烟”和“battery app alarm bug, but the cell is on fire”。输出后置门测试必须逐字段覆盖全部用户可见模型派生字符串及三类禁令的中英文直接同义变体，替换后完整响应不得残留不安全动作。同步与异步顺序测试必须检查真实调用计数和持久化状态，不能只断言 HTTP 状态码，并须覆盖在只读复核后并发替换 authority 时，原 version/fingerprint/decree 的精确 reserve/consume 失败关闭且不产生业务副作用。

固定可见来源标签为 `sourceLabel=USER_TEXT_RULE_CLASSIFICATION_NON_LIVE`，只表示“用户陈述文本 + 确定性规则分类”，不得显示、映射或暗示 `LIVE` 设备、传感器、遥测或现场核验事实。P0 响应第一段必须以 `立即行动：人员立即远离并通知现场应急/消防；仅在安全前提下切断电源。` 开始；P1 响应第一段必须以 `立即行动：立即停止使用和充放电并隔离；由有资质人员现场检查。` 开始；相应 fallback 使用同一开头。若该可见标签和顺序合同无法在 exact10 内实现，立即 STOP 重新申请范围。

## Scope Contract

后继产品候选只允许以下 exact10 路径，按字典序冻结：

1. `backend/app/agents/chancellor/graph.py`
2. `backend/app/agents/chancellor_draft/battery_safety.py`
3. `backend/app/agents/chancellor_draft/graph.py`
4. `backend/app/api/chancellor_drafts.py`
5. `backend/app/api/decrees.py`
6. `backend/tests/test_battery_safety.py`
7. `backend/tests/test_chancellor_draft_graph.py`
8. `backend/tests/test_chancellor_drafts_api.py`
9. `backend/tests/test_chancellor_graph.py`
10. `backend/tests/test_decrees_api.py`

在本基线上候选结构必须精确为 `2 ADD + 8 MODIFY`，模式均为 `100644`。需要第十一条产品路径、数据库迁移、前端修改、认证/租户合同变化或外部现实动作时立即 STOP，重新申请范围，不得隐式扩张。

明确非目标：不控制真实设备，不远程复位或下发维修，不调用生产模型/公网/secret/生产数据，不改 Four-Gate、P14、Authority、Harness、CI、前端、数据库 schema 或第二事实源，不整分支 merge/cherry-pick，不发布或试点。

## Delivery Constraints

- 当前允许动作只限三份治理草案、治理检查和独立只读复审；不得运行 product authority、物化产品字节、提交或推送。
- 后继产品阶段必须使用绑定批准提交的干净隔离工作树和唯一写入者；旧 dirty candidate 只可作问题证据，不能整体复制。
- 只实施让冻结 RED 转为 GREEN 的最小 exact10 修改；不能通过放宽危险词、跳过输出复核或降低副作用断言换取通过。
- 本 Packet 没有前端差异，因此不虚构浏览器链证明；真实设备、真实模型和试点验证属于后续独立 authority。

## Affected Modules

- 模块：中书省拟旨前可信消息投影与电池安全分类；draft 注册、canonical marker 和执行前等级复核；decree 同步/异步执行入口的副作用顺序；丞相最终回复/fallback 的确定性安全后置门；对应 backend 单元与 API 回归测试。
- 允许路径：`backend/app/agents/chancellor/graph.py`、`backend/app/agents/chancellor_draft/battery_safety.py`、`backend/app/agents/chancellor_draft/graph.py`、`backend/app/api/chancellor_drafts.py`、`backend/app/api/decrees.py`、`backend/tests/test_battery_safety.py`、`backend/tests/test_chancellor_draft_graph.py`、`backend/tests/test_chancellor_drafts_api.py`、`backend/tests/test_chancellor_graph.py`、`backend/tests/test_decrees_api.py`。
- 依赖模块：现有 draft/decree 执行链、工部·技术司路由及根级 product authority/harness；只复用，不扩边界。

## Acceptance Criteria

- [ ] Owner 精确确认 proposed approval 的 canonical digest；raw SHA-256 只作字节传输校验。
- [ ] 正式 approval commit 是冻结基线的唯一单亲子，只含正式 approval、Task、Plan 三条治理路径；机器 authority 明确返回 `GO / APPROVED_FOR_ONE_CHILD`。
- [ ] 实施前先证明上述 11 个负向测试在冻结基线/前序字节上按预期为 RED，再以 exact10 最小修改转为 GREEN。
- [ ] `BAT-P0-01` 至 `BAT-P2-02` 六项逐项关闭，禁止用文档说明代替可执行测试。
- [ ] 候选是 approval commit 的唯一单亲子，只含 exact10，保持 `2 ADD + 8 MODIFY`、`100644`，工作树干净。
- [ ] proposed approval 冻结的十项验证全部通过；同一 candidate SHA/tree 上连续 10 次 `--verify-candidate` 全部通过。
- [ ] 独立 Python Review 与 Security Review 均无未关闭 P0–P2；任一新 P0–P2 使候选立即 NO-GO。
- [ ] Owner 按 candidate SHA/tree、canonical approval digest、exact10 blob manifest 和 10 轮 evidence digest 做最终接受；push、试点、发布和部署仍需分别授权。

## Source And Evidence Contract

- 事实源：可信 `user` 消息投影、确定性电池分类器、canonical marker、执行前复核结果和持久化审计记录；模型文本不是安全等级事实源。用户可见安全响应固定显示 `sourceLabel=USER_TEXT_RULE_CLASSIFICATION_NON_LIVE`，不得把用户陈述或规则分类冒充 `LIVE` 设备、传感器、遥测或现场事实。
- 安全优先级：`P0 > P1 > NOT_APPLICABLE`；marker、模型、fallback、路由或后续 Agent 均不得降低等级。
- 副作用顺序：分类和执行安全门必须发生在模型、authority 注册/消费、job 预留/持久化、route snapshot、数据库业务写入和部门调用之前。
- 输出顺序：P0、P1 及其 fallback 的首段必须先给出上述固定 `立即行动：`，随后依次给出禁止动作、人工确认和来源标签/证据边界；用户不应在 10 秒内寻找安全动作。
- 失败状态：任一客户端 role 非 `user`、等级冲突、任一用户可见模型派生字符串包含禁令、分类异常或证据不足时 fail-closed；不得剔除不可信 role 后继续，也不得伪造已执行、已修复、已人工确认或已有实时设备证据。
- 三文件 bundle digest：按 UTF-8 原始字节计算每份文件的 `bytes` 与 `rawSha256`，再将三条 `{path, mode:"100644", bytes, rawSha256:"sha256:<hex>"}` 按 `path` 字典序排列为 JSON array，使用 RFC8785 canonical bytes 做 SHA-256；该值只绑定三文件传输包，不是 approval authority 身份。
- 回滚：未来候选只能整提交 revert，且需单独授权；禁止 reset、force-push 或只回退安全链的一层。

## Technical Plan

实施顺序固定为：非 `user` role 整请求失败关闭与可信输入投影 → P0 优先分类及软件/物理混合语境判定 → marker 等级单调合并 → 同步/异步副作用前置门 → 全量用户可见输出/fallback 后置门与固定来源标签/立即行动顺序 → exact10 全矩阵。详细 RED、GREEN、候选冻结、十轮验收和 Owner 接受步骤以配套 Plan 为准。

## Implementation Report

- 已完成：冻结基线实时核验；前序 exact9 的完整 backend 测试、Ruff 和治理回归；独立 Python/Security Review；六项 P0–P2 归因与 exact10 纠偏边界设计。
- 已证实前序验证：focused `432 passed, 1 skipped`；full backend `4258 passed, 4 skipped`；Ruff、Product Authority regression、Root Harness、Harness Doctor、V2 check/regression 在前序候选环境通过。
- 前序环境说明：第一次并行 pytest 因共享临时/捕获环境冲突被终止，改用唯一临时目录串行重跑后通过；不把该环境失败隐藏为产品通过。
- 未完成：本 Corrective Successor 尚无 Owner digest 确认、正式 approval、machine GO、RED、产品修改、candidate、10 轮验收或最终接受。
- 当前产品状态：前序候选已终止为 `NO_GO_BY_INDEPENDENT_REVIEW`；不得对用户声称电池安全能力已完成。

## Stop Conditions

远端离开冻结基线、machine authority STOP、exact10 扩张、RED 不可证明、任一负向测试或完整矩阵失败、工作树污染、候选身份变化或独立复审出现 P0–P2 时立即 STOP。不得 re-anchor、放宽测试或复用前序 NO-GO 证据。

## Acceptance Review

- 治理草案：严格 JSON/schema、摘要和差异检查已通过；独立治理复审与安全复审均为 `GO / P0-P3=0`，现冻结等待 Owner 精确确认 canonical approval digest。
- 产品实现：未授权、未开始。
- 候选提交/推送/试点/发布/部署：未授权。
