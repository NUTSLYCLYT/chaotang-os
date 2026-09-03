# CapabilityRegistry V1 readiness

状态：`READINESS_ONLY`

日期：2026-09-03

基线：`origin/ext-dev` 的本地只读投影，临时专用 worktree 为
`/tmp/chaotang-capability-registry-readiness-20260903`，起始提交为
`f168281231e425154ed1f1544888690ef1e44c09`。

## Status

Draft

Readiness-only governance package. Product authority remains `STOP / canExecuteProductWork=false`; this task does not authorize product candidate work.

## Product Definition

- 用户确认：2026-09-03，用户授权 `00-ext-dev-主线总控` 仅创建 `CapabilityRegistry V1 readiness` 三文件前置治理包并验证；若验证通过，可提交并普通 fast-forward 推送。
- 问题：朝堂已有 Skill、Agent、MCP、候选胶囊、司级能力和前端演示入口，但缺一个不产生副作用的统一能力总账契约。
- 目标用户：朝堂产品团队、前端/UI 团队、后端实施者、总控丞相、军机处、翰林院、吏部、鸿胪寺、刑部。
- 目标：用三份文档明确 CapabilityRegistry V1 的 readiness、schema contract、candidate scope、验证矩阵和回滚方式。
- 非目标：不修改产品代码、不实施 candidate、不部署、不安装插件、不调用外部账号、不触发发布/报价/交易/发送。

## Acceptance Criteria

- [x] 只新增三份非产品代码治理文件。
- [x] 保留产品 authority STOP 事实，不误导为 GO。
- [x] 明确 CapabilityRegistry V1 schema owner、canonical writer 和只读投影来源。
- [x] 明确 CapabilityRegistryItem、CapabilityCard、AgentPersonaCard、ExternalCapabilityReview、CapabilityPromotionCase 字段。
- [x] 明确能力归属、晋升、降级、裁撤、外部能力和高风险复核规则。
- [x] 明确后续 candidate 最小范围、测试矩阵、验收标准、回滚方式和不应开发内容。
- [x] 不触碰前端、后端、Dadian 冻结边界、authority、Harness、CI 和部署。

## Delivery Constraints

- 范围：仅三份文档治理文件。
- 兼容性：不得改变现有丞相、军机处、六部、锦衣卫、史馆、前端页面、后端 API、Harness 和 authority 行为。
- 风险与限制：当前 product authority STOP；当前 root Harness 为 BOOTSTRAP_OBSERVE 且 `harness-doctor --check` 返回 HARNESS_INVALID；产品 candidate 必须等待后续 machine authority GO。
- 技能计划：已使用 `product-manager-ai-workflow` 思路补齐目标、状态、边界和验收；已使用 `skill-manager` 思路处理能力分级、复用和淘汰规则。
- Codex-only：是；不使用 Claude CLI、Claude runner 与 gstack-claude。

## Affected Modules

- 模块：CapabilityRegistry V1 前置治理文档。
- 允许路径：`docs/product/tasks/2026-09-03-capability-registry-v1-readiness.md`、`docs/superpowers/specs/2026-09-03-capability-registry-v1-contract.md`、`docs/superpowers/plans/2026-09-03-capability-registry-v1-candidate-scope-and-validation.md`。
- 依赖模块：只读参考 `AGENTS.md`、`.harness/agents/project-owner.md`、`.harness/rules/project-boundaries.md`、Runtime Skill registry、司级能力清单、锦衣卫 MCP registry、能力胶囊候选目录和前端 visual demo registry。

## Technical Plan

- 架构边界：V1 是只读 projection，不创建第二套 Agent 系统、第二套任务账本或第二事实源。
- 接口与依赖：后续 candidate 才能新增 `/api/capabilities/*`；本轮只定义契约。
- 实施顺序：先 readiness，再 contract，再 candidate scope and validation；验证只检查文档范围与现有 Harness/authority 状态。
- 验证计划：`git status --short`、`git ls-files --others --exclude-standard`、`node scripts/product-authority.mjs --status`、`node scripts/check_harness.mjs`、`node scripts/harness-doctor.mjs --check`，必要时用受控权限重跑受 Git 权限影响的检查。
- 技术风险：当前 closed Harness 不允许新增 `.harness/changes` 文件，因此三文件包落在 docs 治理区；`.harness/wiki/architecture.md` 与 `.harness/wiki/harness-inventory.md` 当前基线缺失，只能记录缺口。

## Implementation Report

- 改动摘要：新增三份 CapabilityRegistry V1 readiness 文档，未修改产品代码。
- 自审：已将外部能力默认鸿胪寺、高风险刑部复核、公共活字默认翰林院、常驻司/临时项目组/蜂群边界写入契约。
- 验证：三文件范围检查通过；`node scripts/check_harness.mjs` 在受控权限下通过；`node scripts/harness-doctor.mjs --check` 在受控权限下返回 PASS；`node scripts/product-authority.mjs --status` 返回 STOP，符合不做产品 candidate 的边界。
- 实际使用的 skill：product-manager-ai-workflow、skill-manager。
- 验证命令与结果：`git status --short` 仅显示三份新增 docs；`git ls-files --others --exclude-standard` 仅显示三份新增 docs；`node scripts/check_harness.mjs` 通过；`node scripts/harness-doctor.mjs --check` 通过；`node scripts/product-authority.mjs --status` 返回 `APPROVAL_NOT_SELECTED`；`node --test scripts/harness-doctor.test.mjs` 10/10 通过；`node --test scripts/product-authority.test.mjs` 11/12 通过，唯一失败为既有测试中临时 Git 仓库提交 mode drift 负例失败，未指向本三文件包。
- 未运行项与原因：产品 candidate、部署、外部插件、外部账号调用均不在本轮授权内。
- 剩余风险：产品实现必须等待 machine authority GO；`.harness/wiki/architecture.md` 与 `.harness/wiki/harness-inventory.md` 在当前基线缺失；product-authority 负例 mode drift 自测仍需后续专门排查。

## Acceptance Review

- 验收结果：Accepted for readiness documentation only; not accepted for product candidate work.
- 验收证据：三份新增 docs 文件；核心 Harness 检查 PASS；doctor 检查 PASS；product authority status STOP；未触碰产品代码、Dadian 冻结边界、authority、Harness、CI、部署和外部能力。
- 未通过项：`node --test scripts/product-authority.test.mjs` 仍有 1 个既有负例测试失败，需后续单独排查；该失败不授权产品施工。

## 0. 本轮裁决

本治理包只做 CapabilityRegistry V1 的前置治理和实施准备。它不授权产品施工，不授权创建真实
candidate，不授权部署，不授权外部插件安装、第三方账号调用、报价、发送、发布、交易或任何现实
执行动作。

本轮允许的唯一写入范围是三份非产品代码治理文件：

- `docs/product/tasks/2026-09-03-capability-registry-v1-readiness.md`
- `docs/superpowers/specs/2026-09-03-capability-registry-v1-contract.md`
- `docs/superpowers/plans/2026-09-03-capability-registry-v1-candidate-scope-and-validation.md`

后续产品 candidate 必须等待机器 authority 明确返回 GO，并由 Owner 另行确认 exact task、base、
allowed paths、candidate SHA/tree、commit、push 和部署边界。

## 1. Authority 与 Harness 事实

当前 ext-dev 基线的仓库入口要求：

- 先读 `AGENTS.md`。
- 再读 `.harness/agents/project-owner.md`。
- 再读 `.harness/rules/project-boundaries.md`。
- 产品施工必须服从 `scripts/product-authority.mjs`。

本轮实际验证结果：

- `node scripts/product-authority.mjs --status` 返回 `STOP / canExecuteProductWork=false`，原因为
  `APPROVAL_NOT_SELECTED`。
- 用户已明确授权本轮只创建三文件 readiness 治理包，因此可以记录治理设计；该授权不等同于产品
  candidate GO。
- 当前基线不存在 `scripts/execution-authority.mjs`；仓库实际采用 `scripts/product-authority.mjs`
  和 `scripts/execution-authority-scene-pack-v1.mjs` 等分线 authority。
- 当前基线不存在 `.harness/wiki/architecture.md` 和 `.harness/wiki/harness-inventory.md`。这两份
  用户要求读取的事实源在本基线上缺失，不能假装已读取；本包将其列为后续治理资料缺口。
- `node scripts/harness-doctor.mjs --check` 当前返回 `STOP / HARNESS_INVALID`，不能被解释为
  READY。
- `node scripts/check_harness.mjs` 在受限环境中触发 `spawnSync git EPERM`；该环境问题不应放宽
  产品门禁。

因此，本轮结论是：可以提交 readiness 文档，但不能启动产品 candidate。

## 2. 当前本地盘点事实

以下事实来自本轮只读盘点，不得扩展解释为所有能力已经可上线。

### 2.1 已存在的组织与运行技能

现有后端已存在一个强约束的下游 Runtime Skill 总账雏形：

- `backend/app/agents/runtime_skills/registry.py`
- `backend/app/agents/runtime_skills/models.py`
- `backend/app/agents/runtime_skills/roles/junjichu.py`
- `backend/app/agents/runtime_skills/roles/ministries.py`
- `backend/app/agents/runtime_skills/roles/bureaus/skill_registry.py`
- `backend/app/agents/bureaus/profiles.py`

其中已声明：

- 军机处 council 级技能：1 个。
- 六部 ministry 级技能：6 个。
- 司级 bureau Runtime Skill：39 个。
- 司级能力身份在 `BUREAU_PROFILES` 中固定，覆盖吏部、户部、礼部、兵部、刑部、工部。
- `DownstreamSkillRegistry` 会校验唯一 `skill_id`、唯一 `agent_id`、层级绑定、司级工具策略和清单
  数量，属于可复用的 canonical runtime inventory。

### 2.2 已存在的司级能力包

`backend/app/agents/bureaus/capabilities.py` 已存在静态 `CapabilityProfile`，当前包含部分真实能力包，
例如：

- 线索获取
- 商机推进
- 财务分析
- 报价分析
- 合同审查
- 合规审查
- 产品规划
- 趋势推演
- 供应链选项
- PACK 研发
- 硬件设计
- 软件交付生命周期建议
- 代码审查建议
- 电池阶段门评估
- 制造过程评估
- 交付与售后
- 品牌策略
- 内容质量
- 社媒内容运营
- 人设筛选

这些能力包目前绑定到既有司级身份，适合作为 CapabilityRegistry V1 的内部能力投影来源之一。

### 2.3 已存在的锦衣卫外部只读 MCP 能力

`backend/app/jinyiwei/mcp/registry.py` 已实现受控 MCP 注册表，具备以下安全特征：

- 仓库配置驱动，HTTP 或 Agent 不能动态添加任意 URL、凭据或能力。
- YAML 读取拒绝重复 key，避免配置覆盖歧义。
- 服务、工具、mapping 和 discovered schema 通过 fingerprint 绑定。
- 工具 effect 当前只允许 `READ_ONLY`。
- endpoint 必须为 HTTPS，禁止用户凭据、query、fragment。
- credential 只能使用 `env://...` 引用。
- 私网 CIDR、OAuth origin、返回大小、超时、限流均有显式字段。

`backend/config/jinyiwei_mcp.yaml` 当前只看到一个真实外部服务：

- server：`westock`（腾讯自选股）
- tools：`data_search`、`data_minute`、`data_quote`
- effect：`READ_ONLY`
- source kind：`PROFESSIONAL_DATA`
- access policy：`SERVICE_AUTHENTICATED_FREE`

这说明锦衣卫已经具备“受控外部事实源”的雏形，但 CapabilityRegistry V1 仍需把这些外部能力投影到
鸿胪寺候选和刑部复核视角。

### 2.4 已存在的能力胶囊候选

`backend/harness/capability_candidates/` 已存在 capability candidate 结构，当前包括：

- `README.md`
- `authority-manifest.json`
- `rites-message-quality-gate/capsule.json`
- `rites-message-quality-gate/capsule.lock.json`

这说明项目已经有“能力候选/胶囊/锁定”的治理方向。CapabilityRegistry V1 不应替换它，而应读取其
只读投影，显示候选状态、来源、证据与风险。

### 2.5 已存在的前端能力入口雏形

前端已有若干视觉与入口组件：

- `frontend/src/features/honglusi-visual/`
- `frontend/src/features/junjichu-visual/`
- `frontend/src/features/ministries-visual/`
- `frontend/src/features/jinyiwei-visual/`
- `frontend/src/features/court-visuals/`

其中 `frontend/src/features/honglusi-visual/honglusiRegistry.ts` 当前为 `DEMO` 目录，包含模型智囊、
MCP 使团、自动化行署、合作方服务等演示能力。V1 必须避免把 DEMO 目录误写成真实能力事实。

## 3. 当前缺口

CapabilityRegistry V1 readiness 认定以下缺口必须先被清楚处理：

1. 缺统一能力总账 API：现在能力分散在 Runtime Skill、司级能力包、MCP 注册表、前端 DEMO、能力
   胶囊候选目录中。
2. 缺统一 schema owner：还没有一个只读 `CapabilityRegistryItem` 契约解释这些来源如何合并。
3. 缺统一归属规则：内部司级技能、外部 MCP、Prompt/模板/印版、项目临时能力、蜂群能力的归属还未
   机器可读。
4. 缺能力晋升/降级路径：翰林院荐才、吏部考绩、鸿胪寺候选、刑部复核和军机处项目调用还没有统一
   过程对象。
5. 缺 Agent 人格卡：目前存在部门/司级职责，但缺统一的展示语气、幽默边界、禁止行为、进化目标与
   成本效率目标。
6. 缺真实来源标签：前端演示能力必须继续明确 `DEMO`，不能与后端真实注册能力混用。
7. 缺用户能看懂的推荐映射：五个高付费场景需要看到“为什么推荐这些能力、缺什么、下一步让谁做”。
8. 缺小样本防权威规则在能力评分上的明确复用说明。
9. 缺未激活能力零权限在外部能力和待审能力上的统一表达。
10. 缺可回滚的最小产品候选范围。

## 4. Readiness 原则

CapabilityRegistry V1 必须坚持以下原则：

1. 一个总账，多源只读投影：总账不替换现有运行系统，只归一化展示。
2. 真实能力与演示能力分离：`DEMO`、`draft`、`trial`、`approved`、`retired` 必须明确。
3. 外部能力默认归鸿胪寺：MCP、插件、API、外部账号、外部模型、Codex、Claude Code、DeepSeek
   Harness、OpenClaw 等均先进入外部能力候选，不能直接变成常驻部门。
4. 高风险必须刑部复核：涉及权限、凭据、租户、隐私、付费、结算、发布、发送、报价、交易、浏览器
   自动操作的能力，默认需要刑部。
5. Prompt、模板、方法论、知识包、印版默认归翰林院：只有真实复用、效果改善和安全检查通过后才
   进入公共能力池。
6. 长期负责业务结果的能力才进入各部各司：不能因为某个工具好用就立刻增设常驻司。
7. 单项目能力归军机处临时项目组：项目结束后必须沉淀、裁撤或归档。
8. 并行核验/辩论/多候选生成归蜂群：蜂群是战术算力与多视角结构，不是常驻组织。
9. 低频、重复、效果差由吏部建议降级、合并或裁撤。
10. 用户首屏不展示复杂概念：能力总账服务于“发生什么、需要我决定什么、朝堂下一步替我做什么”。

## 5. Readiness 通过条件

本三文件包如果提交，只表示以下事项已准备好：

- CapabilityRegistry V1 的治理定位已经明确。
- 最小 schema 和归属规则已经明确。
- 后续 product candidate 的最小变更范围、验收标准和回滚方式已经明确。
- 当前 authority STOP 被明确保留。
- 产品 candidate 等待 machine authority GO。

本三文件包不表示：

- 任何新 API 已经上线。
- 任何前端入口已完成。
- 任何外部能力已被安装、授权或调用。
- 任何能力已从 DEMO 自动晋升为真实能力。
- 任何付费、分润、交易、发布、报价或现实执行能力已被批准。
