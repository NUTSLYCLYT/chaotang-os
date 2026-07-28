# Dev 蜂群司级能力包接入：实施计划

> **执行前提**：设计已获用户确认；本计划只在现有同步下旨主链内接入能力包。不得修改 ADR 0028，不引入异步任务、通用 swarm router、YAML 事件总线、旧 `dev` 的数据库模型或 HTTP API。任何 Git 提交或推送仍须获得用户对该具体动作的单独授权。

**目标**：将 `dev` 中可复用的专业蜂群重构为现有六部 39 司注册表中的静态“司级能力包”。部门 Agent 先按业务意图选司；只有被选中的司加载其能力包约束，再按原顺序形成司议、部议、军机处会审（仅多部门）和丞相终审。既有主链、证据边界及史馆“一旨一 REPLY”不变。

**实现策略**：能力包是纯代码、静态注册、无状态的提示词/结果约束适配器，而非后台执行器。它们只能帮助司级 Agent 形成建议、草案、清单和风险；不签约、不付款、不发布、不部署、不改变跨部门路由，也不能自行访问网络、调用锦衣卫或写入史馆。

**技术范围**：Python 3.11、现有后端、现有可注入聊天模型与离线假模型测试；不增加依赖、HTTP 路由、SQLite 表、环境变量或真实网络调用。

## 1. 建立能力包契约与静态注册表

**文件：**

- 新建 `backend/app/agents/bureaus/capabilities.py`
- 修改 `backend/app/agents/bureaus/__init__.py`
- 新建 `backend/tests/test_bureau_capabilities.py`

**实施：**

1. 在 `capabilities.py` 定义不可变、`slots=True` 的 `CapabilityProfile`：`capability_id`、`department`、`bureau`、`source_label`、`purpose`、`deliverables`、`guardrails`。
2. 定义 `CAPABILITY_PROFILES: tuple[CapabilityProfile, ...]` 作为唯一能力目录。每条能力使用现有 `(department, bureau)` 复合主键，不能创建第 40 个司或改变 `BUREAU_PROFILES`。
3. 定义只读索引和 fail-closed 查询函数：`capability_profiles_for(department, bureau)` 返回该司有序能力；`capability_profile_for(capability_id)` 返回唯一能力。未知能力、未知部门/司或跨部门组合抛出稳定 `ValueError`。
4. 模块加载时校验：ID 非空且唯一；所有字段/交付物/护栏非空；关联司由 `bureau_profile_for` 解析成功；不允许重复的 `(department, bureau, capability_id)`。校验失败直接阻断，不做动态修复。
5. 从 `__init__.py` 显式导出新接口，不改变现有 `BUREAU_PROFILES`、`invoke_bureau_agent` 等公共接口。

**先写测试：**

- 目录项不可变、带 slots，ID 与复合键唯一。
- 每项绑定现有司；同名“制度司”不能跨吏部/刑部混淆。
- 未知/跨部门查询 fail closed，不返回空的替代能力。
- 目录不包含 `court`、`jinyiwei`、`shiguan_archive`、`ai_ops` 或独立调度/归档能力。

**验证：**

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_bureau_capabilities.py -q
```

预期：目录测试全部通过，且无需网络、密钥或运行态 SQLite。

## 2. 登记确认范围内的旧蜂群语义

**文件：**

- 修改 `backend/app/agents/bureaus/capabilities.py`
- 修改 `backend/tests/test_bureau_capabilities.py`

**实施：**在 `CAPABILITY_PROFILES` 中登记以下精确映射，`source_label` 固定为 `dev swarm migration`，只用于追溯，不能成为运行时分支或从 Git 动态加载代码：

| 部门 / 司 | capability_id | 受限交付物 |
| --- | --- | --- |
| 兵部 / 线索司 | `lead_acquisition` | 客群、渠道、线索优先级建议 |
| 兵部 / 报价司 | `commercial_opportunity` | 商机阶段、推进假设与边界 |
| 户部 / 会计司 | `financial_analysis` | 成本、预算和敏感性分析建议 |
| 户部 / 盐铁司 | `quotation_analysis` | 报价草案、成本拆解和毛利风险 |
| 刑部 / 合同司 | `contract_review` | 条款问题清单和谈判建议 |
| 刑部 / 合规稽查司 | `legal_compliance` | 合规核查清单和整改建议 |
| 工部 / 产研司 | `product_planning`、`trend_simulation` | 需求范围/优先级；情景假设和风险 |
| 工部 / 物料司 | `sourcing` | 供应风险、替代方案和采购建议 |
| 工部 / 技术司 | `pack_rd`、`hardware_design`、`sdlc_advisory`、`code_review_advisory` | 技术方案、依赖、研发/审查建议 |
| 工部 / 质量司 | `battery_stage_gate` | 阶段门禁、验收项和缺陷风险 |
| 工部 / 现场司 | `process_manufacturing` | 工艺/现场问题和改进建议 |
| 工部 / 承诺司 | `delivery_aftercare` | 交付承诺边界、售后闭环建议 |
| 礼部 / 品牌司 | `brand_strategy` | 品牌定位、表达与风险提示 |
| 礼部 / 内容司 | `content_quality` | 内容草案、事实校验点、发布门禁建议 |
| 礼部 / 客户沟通司 | `social_content_operations` | 对外沟通/社媒草案和禁用表述 |
| 吏部 / 招聘司 | `persona_screening` | 候选画像、筛选标准和面试建议 |

排除旧 `court`、`jinyiwei`、`tianjian`、`shiguan_archive`、`ai_ops` 及 `storage_aftercare` 的调度/持久化实现；有用业务语义仅按上表归入已有司。对报价、合同、付款、签署、发布、部署、招聘录用和对外承诺追加统一“建议/草案/待审批”护栏。

**先写测试：**

- 每个 ID 精确绑定表中部门、司、交付物与非空护栏。
- 排除项不在目录，且无能力关联军机处、丞相、锦衣卫或史馆。
- 映射覆盖已确认旧蜂群语义，但不扩大到未确认模块。

**验证：**

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_bureau_capabilities.py -q
```

## 3. 将能力包约束编入既有司级提示词

**文件：**

- 修改 `backend/app/agents/bureaus/prompts.py`
- 修改 `backend/app/agents/bureaus/agent.py`
- 修改 `backend/tests/test_bureaus_agent.py`
- 修改 `backend/tests/test_bureau_capabilities.py`

**实施：**

1. 在 `prompts.py` 增加 `capability_prompt_section(department, bureau)`，从静态目录按固定顺序渲染能力名称、目标交付物和不可执行护栏。未绑定能力的司返回明确“无专属能力包”的段落，绝不加载默认通用 swarm。
2. 将该段落放在 `bureau_system_prompt` 的司职责之后、`NO_IRREVERSIBLE_ACTION_CONSTRAINT` 之前。保留严格 JSON `{"opinion": ...}` 契约，不增加字段，不让模型输出内部 capability ID。
3. `invoke_bureau_agent` 的签名、模型次数、证据协议和错误封装保持不变；能力包只影响系统提示词。启用 `evidence_session` 时，仍只能由本司经过 `invoke_bureau_with_evidence` 发起现有受控调查。
4. 不在能力包中调用第二次模型、调用其他司、访问网络或直接读写 Shiguan/Jinyiwei。

**先写测试：**

- 已绑定司的 prompt 同时含职责、能力交付物、不可逆动作约束和精确 JSON 契约。
- 未绑定司没有错误默认能力；同名跨部门司只显示本部门能力。
- 假模型调用 `invoke_bureau_agent` 仍只有一轮模型调用并返回剥离空白的 `opinion`。
- 有 `evidence_session` 时，能力包不删除/弱化 `READY/NEEDS_DATA` 和“仅司级可调查”协议。

**验证：**

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_bureaus_agent.py tests/test_bureau_capabilities.py -q
```

## 4. 固化“选司后自动触发”的边界

**文件：**

- 修改 `backend/app/agents/ministries/agent.py`
- 修改 `backend/tests/test_bureaus_agent.py`
- 新建 `backend/tests/test_ministries_agent.py`

**实施：**

1. 保持 `invoke_ministry_agent` 参数、`MinistryOpinion` 返回值及“部门模型选司 → 按选择顺序串行调用司 → 部级综合”结构不变。
2. 在选司通过现有严格校验后，调用只读 `capability_profiles_for(department, bureau)` 进行注册表完整性校验；调用不改变 `selected_bureaus`，不产生额外路由。
3. 未绑定能力的已选司正常执行；绑定能力的已选司因步骤 3 的系统提示词自动获得专业约束。这就是按业务意图自动触发，而不是全局默认运行。
4. 注册表损坏、跨部门选司、司调用失败、JSON 不合规或部级综合失败时，继续抛出 `MinistryAgentInvocationError` 并中止后续调用；不得返回部分部议或回退旧 swarm。

**先写测试：**

- 单部门选中“报价司”时顺序仍为部门路由、报价司、部级综合；报价司 prompt 有 `quotation_analysis`，未选司零调用。
- 多个已选司按模型返回顺序串行，能力包不重排。
- 未绑定能力的司只用原职责；能力目录查询异常时 fail closed，且不进行部级综合。
- 非法、重复、跨部门选择维持既有失败行为。

**验证：**

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_bureaus_agent.py tests/test_ministries_agent.py -q
```

## 5. 验证单部门端到端与史馆契约不变

**文件：**

- 修改 `backend/tests/test_chancellor_graph.py`
- 必要时修改 `backend/tests/test_decrees_api.py`（仅加离线断言）

**实施：**

1. 为报价、合同、产品、内容等代表性意图构造假模型序列，使对应能力司被既有路由选中。
2. 断言单部门图的拓扑和响应字段不变：`route_type == "single"`、一个部门、`council_verdict is None`、既有 `bureau_opinions` 与三条建议规则不变。
3. 断言 `processing_path` 仅含上书房、丞相首次分流、部门、实际选中司、部门补充、丞相终审；不能出现 capability/swarm/worker/task-run 节点或军机处。
4. 在已有临时史馆库 API 测试中断言成功下旨仍只生成一条 `REPLY`，能力 ID 和旧 swarm 执行记录不写入史馆。

**先写测试：**

- 每个代表性能力司形成有效意见，终审模型只收到原有分层意见文本。
- 史馆归档数恰为一，`source_text` 仍为原旨意。
- 没有新增 HTTP 端点、`swarm_runs`、后台队列或结果查询。

**验证：**

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_chancellor_graph.py tests/test_decrees_api.py -q
```

## 6. 验证跨部门会审仍由军机处唯一串行协调

**文件：**

- 修改 `backend/tests/test_junjichu_agent.py`
- 修改 `backend/tests/test_chancellor_graph.py`

**实施：**

1. 构造“产品方案 + 报价 + 合同合规”跨部门意图，使丞相产生已验证的 `multi` 列表。
2. 各部门各自选中能力司，但保持 `run_junjichu_council` 的部门串行调用；能力层不得并发、递归调用或提前综合。
3. 断言军机处只接收 `MinistryOpinion`，不接收 capability 注册表、不调用 `capability_profiles_for`、不产生自己的能力结果或证据请求。
4. 一个部门或司失败时仍短路：后续部门、军机处和丞相终审均不执行。

**先写测试：**

- 调用顺序严格为每部“路由 → 已选司 → 部议”完成后才会审；无并行。
- `processing_path` 只在原有位置出现一次军机处，并保持实际部门/司顺序。
- 军机处输入有司议/部议，不含 capability ID 或“已执行”类断言。

**验证：**

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_junjichu_agent.py tests/test_chancellor_graph.py -q
```

## 7. 回归证据、锦衣卫与高风险操作边界

**文件：**

- 修改 `backend/tests/test_bureaus_agent.py`
- 修改 `backend/tests/test_chancellor_graph.py`
- 必要时修改 `backend/tests/test_evidence_protocol.py`

**实施：**

1. 用能力绑定司的假模型分别返回无事实建议、`NEEDS_DATA` 和带已提供证据的 `READY`，复用既有协议断言。
2. 验证能力包不会让报价、合同、品牌内容、研发计划绕过事实声明：依赖外部事实时仍须引用现有证据或请求 `NEEDS_DATA`。
3. 验证报价、合同、招录、发布、部署等被限制为建议/草案；不允许声称已签署、付款、发布或部署。
4. 不新增锦衣卫来源、URL、网络调用、配置、凭据、写接口或真实服务依赖；测试仅用假模型、fixture 和必要的临时 SQLite。

**先写测试：**

- 仅已选司能进入既有受控调查；部门、军机处和丞相均不能。
- 未采纳证据不进入最终快照；成功下旨仍是一条 `REPLY`。
- 所有新增测试未设置 `JINYIWEI_EXTERNAL_NETWORK_ENABLED` 且无密钥仍通过。

**验证：**

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_bureaus_agent.py tests/test_chancellor_graph.py -q
```

## 8. 全量验证、任务回填与交接

**文件：**

- 修改 `docs/product/tasks/2026-07-27-dev-swarm-bureau-capabilities.md`
- 如有新的、非显然的可复用约束，回填实现证据；不修改 ADR 0028。

**实施：**

1. 在任务文件回填实际修改文件、测试命令和结果；不得把未执行动作写成完成。
2. 检查无 `swarm_orchestrator`、`swarm_runs`、SQLAlchemy、Celery/队列、动态 YAML、新 API 路由、持久化 checkpointer 或旧 `dev` import。
3. 依次运行后端定向测试、全量后端测试、Ruff 和仓库 harness；最后 `git diff --check`。
4. 宣称完成前核对绝对工作区路径、当前分支、HEAD、`git status --short`，区分本任务与用户已有改动。仅在用户明确授权后暂存、提交或推送。

**验证：**

```powershell
cd backend
.venv\Scripts\python.exe -m pytest -q
.venv\Scripts\python.exe -m ruff check app tests
cd ..
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test
git diff --check
```

预期：全部命令退出码为 0；若 `git diff --check` 报告用户既有文件的问题，单独报告，不擅自修改或混入本任务。

## 不在本计划内

- “已受理 + 后台运行 + 结果查询”、运行状态持久化、重试和服务重启恢复。
- 重新引入 `dev` 的通用 swarm 编排器、事件总线、任务数据库、旧 Web UI/API 或 SQLAlchemy 模型。
- 为能力包新增真实网络/工具调用、锦衣卫数据源、自动发布/部署/签约/支付权限。
- 修改 ADR 0028、丞相/军机处主拓扑、史馆归档数或现有公共 HTTP 契约。

如需这些范围，必须由用户单独授权，并先新增或修订 ADR、产品任务和恢复语义验证。
