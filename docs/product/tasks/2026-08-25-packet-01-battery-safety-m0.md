# Packet 01 — Battery Safety M0 Task

状态：`DRAFT_AWAITING_OWNER_DIGEST_ACCEPTANCE`
任务 ID：`PACKET-01-BATTERY-SAFETY-M0-20260825`
唯一基线：`origin/ext-dev@58b769223794af752d3b36ffc83dfa6351b0e0c6`
基线 tree：`d746c28c13612693700d03fe11e1349b3a73cf5f`

## 1. 用户与结果

面向在朝堂 OS 中提交电池、PACK、BMS 或储能安全任务的已认证用户。用户得到的不是自动维修或设备控制，而是一份已被确定性安全门约束、必须经本人确认、并且只能沿已确认工部·技术司路由执行的拟旨与分析结果。

本 Packet 的最小产品结果是：

1. 在任何模型调用前，对原始用户文本执行无网络、无缓存的确定性电池安全分级。
2. 明确火灾、爆炸、热失控及前兆归为 `P0 / BLACK`；其余命中电池安全范围但严重度未确认的事件归为 `P1 / BLACK`。
3. `P0` 与 `P1` 都强制 `requires_human_confirmation=true`，并强制工部·技术司进入拟旨授权路由。
4. 模型、会审结论、调用方路由偏好和后续执行都不能删除、降低或绕过该安全不变量。
5. 复用现有 owner-bound、version/fingerprint/decree/route-bound、一次性 `DraftAuthorityRegistry`；不创建第二套人签或授权存储。
6. P0 拟旨必须展示“现场断电、撤离、消防待命；不得远程复位或直接下发维修”的保守边界。P1 在人工确认无火情/热失控前不得降级或下发维修。

## 2. 基线事实与设计边界

基线后端是扁平 `backend/app/` 架构；旧 donor 的 `backend/src/` 不属于目标架构，禁止恢复。现有真实链为：

`POST /api/v1/chancellor-drafts` → 模型拟旨 → 路由快照 → owner-bound 一次性拟旨 authority → `POST /api/v1/decrees/chancellor` → 已批准路由执行。

Packet 01 只在这条链上增加确定性 preservation gate：

`原始用户文本` → `battery safety classify` → `约束模型与拟旨` → `API 独立复核` → `现有人签` → `执行前再复核`。

不得增加 API namespace、数据库表、前端控制面、第二结果账本、第二 authority 或新外部副作用。

## 3. 固定 donor hunks

Donor 只提供行为语义，不提供可直接复制的目标字节。不得 checkout、merge、cherry-pick、整文件复制或恢复旧 `backend/src`。

### P17：确定性分级与失败关闭

- commit：`057ddd2051d9da97e4d5ce6ddc0454cad27df148`
- tree：`0788a3fd15304db10b4ae6c6a1afce5b6911ffe1`
- parent：`9956a5a9a0a8ad5d8465c637dd8c7b81d08f50f8`
- source hunk：`backend/src/real_department_engines.py`
- source patch SHA-256：`57044363e9da521ee9cfaab92d66badb0bc60ada952e1a643d698c96ae09d45c`
- test hunk：`backend/tests/test_real_department_engines.py`
- test patch SHA-256：`5a9f842c7a12d9692d8da13fd2ec1fbd15655b16e13661a7b947fe71d5f89ae1`

只吸收以下语义：

- 火、爆、燃、烟、热失控、漏液/气、排气、鼓包、破裂、穿刺、短路、高温/超温及恶化趋势属于 P0 信号。
- 其余命中电池/储能事故或安全审查范围但严重度未确认的请求至少为 P1。
- P0/P1 均为 BLACK、均要求人工确认，不能因“正常”“通过”等良性短语静默降为低风险。
- P0 约束现场断电、撤离、消防待命，禁止远程复位或直接下发维修。
- 旧缓存绕过语义在新架构中通过“分类器纯函数、逐请求计算、不得接入业务缓存”实现，不迁移旧缓存模块。

### P18 V4：路由不可覆盖

- commit：`870d10a79c21b8ea9245c4df306faa98936b4fec`
- tree：`87157b19963913e2d914b55ad20523333a833488`
- parent：`9bbee594252f5c4a256ea352078ff090f0767077`
- source hunk：`backend/src/swarm_execution_loop.py`
- source patch SHA-256：`deeb1fdb7f87f91d560b428521cabbbb3b4302ad1d5b2f0fc41e4b13d2260852`
- test hunk：`backend/tests/test_swarm_execution_loop_api.py`
- test patch SHA-256：`1bf5fbe389051e257f2b8cd69844224c6624d97ec66cfa46c8c34fdff5c20cc1`

只吸收以下语义：

- 调用方或模型给出的部门列表是偏好，不是绕过物理安全门的授权。
- 命中电池安全范围时，工部·技术司必须同时出现在批准记录和实际执行中。
- 记录参与者与实际执行者必须一致。

上述四个 donor patch 的固定顺序组合摘要：`sha256:dfa321d210c3c8756b38b87b4c904b53a1a628f035d12a27fa7be01fd7d408e3`。

## 4. 精确产品路径

候选必须且只能修改以下八条路径：

1. `backend/app/agents/chancellor/graph.py`
2. `backend/app/agents/chancellor_draft/battery_safety.py`（新增）
3. `backend/app/agents/chancellor_draft/graph.py`
4. `backend/app/api/chancellor_drafts.py`
5. `backend/tests/test_battery_safety.py`（新增）
6. `backend/tests/test_chancellor_draft_graph.py`
7. `backend/tests/test_chancellor_drafts_api.py`
8. `backend/tests/test_chancellor_graph.py`

任何第九路径、路径重命名、schema/authority/Harness/CI/ADR 变更或前端改动都必须停止并重新审批。

## 5. 行为契约

### 5.1 分类器

`battery_safety.py` 提供封闭、可重复的值对象与纯函数。其输出至少能表达：`NOT_APPLICABLE | P1 | P0`、`BLACK`、是否要求人工确认、必选部门/司、禁止动作和稳定规则版本。

范围判断必须同时需要电池域信号与事故/安全审查上下文；单独出现泛化“安全”、普通软件 bug、市场或合同文本不得误触发。分类器不调用模型、网络、数据库、环境开关、时间或缓存。

### 5.2 拟旨图

- 在首次模型调用前分类原始 user messages，并把不可降级约束加入系统输入。
- 对模型结构化响应做确定性后处理：强制工部·技术司、风险等级、人工确认和禁止动作进入用户可见拟旨；不得删掉其他合法部门。
- 安全不变量必须进入 `decree_text`、route snapshot 与 fingerprint 的规范输入，使用户确认绑定安全后的精确字节。
- 重试/结构修复不能丢失安全约束。

### 5.3 API 独立复核

`chancellor_drafts.py` 在注册 authority 之前，用原始 user messages 独立复核 DRAFT_READY 响应。若图返回的拟旨、decree、路由或安全限制不一致，失败关闭，不注册 authority，不伪装成功。

### 5.4 执行前复核

`chancellor/graph.py` 在证据会话、模型和任何部/司调用之前，根据已确认 decree 重新检查安全标记，并验证批准路由仍包含工部·技术司。缺失时以稳定的 route-stage 失败关闭；不得用模型补救，也不得静默追加未经用户确认的路由。

## 6. 冻结 RED 基线

基线 `58b7692…` 尚无 `battery_safety.py`，当前模型可生成不含工部·技术司的电池安全 DRAFT_READY，API 会把该路由注册为 authority，执行图只验证名录合法性而不验证电池安全强制路由。因此以下新测试在产品施工开始时必须先 RED：

| RED ID | 测试文件 / 测试名 | 基线预期失败 |
| --- | --- | --- |
| RED-01 | `test_battery_safety.py::test_p0_hazard_signals_are_black_and_require_confirmation` | 分类器模块不存在 |
| RED-02 | `test_battery_safety.py::test_unconfirmed_battery_incident_is_p1_black_not_p2` | 分类器模块不存在 |
| RED-03 | `test_battery_safety.py::test_benign_phrase_cannot_downgrade_real_incident` | 分类器模块不存在 |
| RED-04 | `test_chancellor_draft_graph.py::test_battery_safety_draft_forces_gongbu_technical_bureau_before_fingerprint` | 当前图接受模型遗漏的工部路由 |
| RED-05 | `test_chancellor_drafts_api.py::test_api_refuses_unenforced_battery_ready_response_without_registering_authority` | 当前 API 会注册模型/假图给出的不安全路由 |
| RED-06 | `test_chancellor_graph.py::test_execution_rejects_battery_decree_without_approved_gongbu_before_any_call` | 当前执行图接受任意名录合法路由 |

同时固定 preservation 负例：非电池文本不改变路由；只有泛化“安全”不触发；合法工部·技术司 route 可执行；所有测试离线且不得调用真实模型。

## 7. 验收

候选只有同时满足 M0 manifest 中完整 verification matrix 才可进入 Owner 精确候选审批。最低业务断言：

- P0/P1 分类、良性短语反降级、域外不误触发全部通过。
- 模型遗漏或试图降级时，安全后处理仍产生工部·技术司和 BLACK 人签约束。
- API 对不一致输出拒绝注册 authority。
- 指纹、decree 与 route snapshot 绑定安全后的同一语义。
- 执行缺少批准工部·技术司时，在任何模型/部/司调用前 STOP。
- 现有 owner 隔离、一次性 authority、财务专用拟旨、普通路由和全后端测试无回归。

## 8. 失败呈现与停止条件

分类或不变量无法确定时必须失败关闭。HTTP 边界沿用现有净化错误，不泄露提示词、内部异常、密钥或模型正文；不得把失败写成 DRAFT_READY 或成功下旨。

出现以下任一情况立即停止并重新审批：

- 基线或远端 `ext-dev` 离开 `58b7692…`，且尚未形成独立 approval commit；
- 需要第九产品路径或修改 schema、数据库、API namespace、前端、authority、Harness、CI、ADR；
- 需要复制 donor 整文件、恢复 `backend/src` 或新增第二套确认/授权存储；
- 发现新的 P0 安全问题，或现有 owner-bound 一次性 authority 无法承载人签；
- RED 无法在指定基线上复现，或 GREEN 只能通过放宽安全门、跳过测试、联网或真实模型获得。

## 9. 回滚边界

本 Packet 不做数据迁移、不写生产数据、不发起外部动作。回滚仅允许对未来唯一产品候选 commit 做整提交反向回退，恢复其 approval commit 的 tree；不得局部保留分类器、API 校验或执行校验中的任一层。回滚后现有拟旨 authority 和普通路由恢复基线行为，数据库与用户资产无需变更。

本草案不等于 GO。只有三文件治理提交由 Owner 精确批准并推送、`product-authority.mjs --authorize --task PACKET-01-BATTERY-SAFETY-M0-20260825` 在 canonical 机器返回 GO 后，才可开始一个单亲子产品候选。
