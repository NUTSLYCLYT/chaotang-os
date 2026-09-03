# CapabilityRegistry V1 candidate scope and validation

状态：`READINESS_ONLY`

## 1. 后续 candidate 的最小目标

当且仅当 machine authority 对 CapabilityRegistry V1 exact task 返回 GO 后，才允许实施最小产品
candidate。

V1 candidate 的目标不是新增大功能，而是把现有能力以只读方式统一展示，让用户、丞相、军机处、
翰林院、吏部、鸿胪寺和刑部都能看到同一份能力总账。

一句话目标：

> 用户不用懂 Skill、Agent、MCP、蜂群和 Harness，也能知道朝堂有哪些能力、能干什么、归谁管、是否
> 可靠、下一步该点哪里。

## 2. 最小产品变更范围

后续 candidate 建议只允许以下范围，具体路径仍需 exact authority 确认。

### 2.1 后端只读 projection

建议新增或扩展：

- `backend/app/capabilities/`
- `backend/app/api/capabilities.py`
- `backend/tests/test_capability_registry*.py`

职责：

- 从现有 runtime skill registry 读取军机处、六部和 39 个司级技能。
- 从 `backend/app/agents/bureaus/capabilities.py` 读取司级 capability profile。
- 从锦衣卫 MCP registry/config 读取外部只读工具。
- 从 `backend/harness/capability_candidates/` 读取能力候选胶囊。
- 输出统一 `CapabilityRegistryItem` 只读投影。
- 不写数据库，不安装插件，不调用外部账号，不执行外部工具。

### 2.2 只读 API

建议 API：

- `GET /api/capabilities`
- `GET /api/capabilities/{capability_id}`
- `GET /api/capabilities/by-home/{home}`
- `GET /api/capabilities/recommendations/high-paid-scenes`
- `GET /api/capabilities/external/reviews`
- `GET /api/capabilities/personas`

API 必须：

- 只读。
- 不触发能力执行。
- 不触发外部网络。
- 不触发安装。
- 不改变任何权限。
- 对 DEMO、draft、trial、approved、blocked、retired 明确打标。
- 对小样本评分返回 `scored=false`。

### 2.3 前端只读入口

建议新增/完善三个只读入口：

1. 翰林院荐才榜：展示可复用 Prompt、模板、印版、知识包、方法论和能力候选；强调“用过才入库”。
2. 吏部能力考绩：展示能力使用次数、样本状态、风险、成本、复用潜力和晋升/降级建议。
3. 鸿胪寺外部能力候选：展示 MCP、插件、外部模型、外部 Agent、Codex/Claude Code/DeepSeek
   Harness/OpenClaw 等外部能力的准入状态。

前端入口必须只显示：

- 这是什么能力？
- 能帮我完成什么？
- 现在能不能用？
- 为什么还不能用？
- 要让它可用，下一步谁来审？

按钮只允许受控动作文案，不直接执行外部副作用：

- `请丞相评估是否适用`
- `提交翰林院试用`
- `请求吏部考绩`
- `请求鸿胪寺准入`
- `请求刑部复核`
- `加入军机处项目组候选`
- `查看证据`
- `查看来源`

禁止按钮：

- `立即安装`
- `立即授权`
- `自动发布`
- `自动报价`
- `自动群发`
- `立即交易`
- `一键部署`

### 2.4 不触碰冻结边界

除非后续 authority 另行明确，本 V1 candidate 不得修改：

- `frontend/src/features/dadian/`
- `frontend/src/app/(dashboard)/dadian/`
- `backend/web/routers/dadian.py`
- 根 authority、Harness、CI、ADR 0028。

如果当前基线没有这些路径，也不能新增同名绕行实现。

## 3. 页面与交互设计

### 3.1 总账首页

页面标题建议：`朝堂能力总账`

首屏结构：

- 顶部：能力总数、已批准、待试用、外部待审、高风险需复核。
- 左侧：归属筛选（翰林院、鸿胪寺、军机处、六部、锦衣卫、钦天监、史馆、内务府）。
- 中间：能力卡片列表。
- 右侧：当前选中能力详情。
- 底部：五个高付费场景推荐入口。

每张卡片必须显示：

- 能力名称。
- 归属部门/司。
- 类型。
- 状态。
- 风险。
- 成本。
- 是否真实可用。
- 下一步按钮。

### 3.2 翰林院荐才榜

核心价值：把好用的 Prompt、模板、方法论、印版、知识包变成公共活字，让朝堂越用越强。

页面内容：

- 新入榜能力。
- 真实复用榜。
- 待补证能力。
- 推荐入库原因。
- 使用后效果回执。
- 可一键生成“荐才奏请”，但不自动晋升。

按钮：

- `保存为私有印版`
- `提交翰林院`
- `查看复用回执`
- `请求吏部考绩`
- `生成改进建议`

### 3.3 吏部能力考绩

核心价值：控制能力膨胀，让朝堂保持精简、高效、便宜、可靠。

页面内容：

- 能力考绩榜。
- 低频能力。
- 重复能力。
- 高风险能力。
- 高成本低收益能力。
- 候选晋升案。
- 裁撤/合并建议。

按钮：

- `发起晋升案`
- `建议合并`
- `建议降级`
- `建议退休`
- `要求补充样本`
- `查看真实任务证据`

### 3.4 鸿胪寺外部能力候选

核心价值：让朝堂吸收外部最强能力，但不让外部工具乱进国门。

页面内容：

- MCP 使团。
- 外部模型。
- Codex / Claude Code / DeepSeek Harness / OpenClaw。
- GitHub 开源项目。
- 外部 API。
- 插件和浏览器自动化。
- 权限、数据暴露、风险和准入状态。

按钮：

- `请求只读试用`
- `请求沙箱验证`
- `请求刑部复核`
- `查看权限清单`
- `查看回滚方案`
- `拒绝接入`

### 3.5 军机处项目组候选

核心价值：用户提出目标后，军机处能选择需要哪些部门、哪些司、哪些公共活字、哪些外部能力候选。

页面内容：

- 当前目标。
- 推荐项目组。
- 主办部门。
- 协办部门。
- 候选能力。
- 缺失能力。
- 验收标准。
- 不召理由。

按钮：

- `生成项目纲领`
- `调整项目组`
- `请丞相裁决`
- `查看不召理由`
- `进入专项详情`

## 4. 状态设计

能力状态：

| 状态 | 展示文案 | 是否可执行 | 含义 |
| --- | --- | --- | --- |
| `demo` | 演示样例 | 否 | 只能展示，不进入真实路由 |
| `draft` | 草稿待审 | 否 | 有资料，未验证 |
| `trial` | 试用中 | 仅沙箱/只读 | 可在受控任务中试用 |
| `approved` | 已批准 | 按权限 | 已通过证据和评测 |
| `blocked` | 阻断 | 否 | 风险或资料缺口未解决 |
| `retired` | 已退休 | 否 | 保留归档，不再推荐 |

激活状态：

| 状态 | 权限 |
| --- | --- |
| `inactive` | 零权限 |
| `sandbox` | 仅脱敏/合成/本地试用 |
| `readonly` | 只读，不写外部系统 |
| `active` | 已批准范围内执行，但仍受人工确认和 authority 限制 |

## 5. 测试矩阵

后续 candidate 至少需要以下测试。

### 5.1 后端单元测试

- Runtime skill registry 能投影出 1 个军机处、6 个部级、39 个司级能力。
- 司级 `CapabilityProfile` 可以绑定回真实部门/司。
- MCP 工具投影默认归鸿胪寺，并保留锦衣卫来源。
- 外部工具 effect 非只读时必须被标为高风险或阻断。
- `DEMO` 前端目录不得被当作真实后端能力。
- `sampleCount < 3` 时 `scored=false`。
- `activationState=inactive` 时权限为零。
- 重复 `id` fail-closed。
- 缺失 canonical source ref fail-closed。

### 5.2 后端 API 测试

- `GET /api/capabilities` 返回统一能力清单。
- 能按归属部门筛选。
- 能按类型筛选。
- 能查看单个能力详情。
- 外部能力 review 正确标记 `requiresXingbuReview`。
- 五个高付费场景返回推荐能力映射。
- API 不触发外部网络、不安装、不写库。

### 5.3 前端测试

- 能力总账页面可以展示能力卡。
- 翰林院入口只显示可复用/待审/试用能力。
- 吏部入口显示考绩状态和小样本诚实提示。
- 鸿胪寺入口显示外部能力权限、风险和准入状态。
- 禁止出现 `立即安装`、`自动发布`、`自动报价`、`自动群发`、`一键部署` 等按钮。
- DEMO 能力必须显示演示标签。

### 5.4 Playwright 验收

- 用户进入能力总账，看到总数和分类。
- 点击鸿胪寺候选，看到外部 MCP 能力只读状态。
- 点击翰林院荐才榜，看到“提交翰林院”但不发生真实晋升。
- 点击吏部考绩，看到小样本不打权威分。
- 点击五个高付费场景之一，看到推荐部门/司与下一步。

### 5.5 Harness 与 authority

- 产品 candidate 前必须有 exact approval manifest。
- `product-authority.m0.v1` 对 exact task 返回 GO 后才施工。
- candidate 必须是 approval commit 的精确单亲子。
- 验证通过后仍需 Owner 对 candidate SHA/tree 二次确认。
- commit/push/deploy 均需另行授权。

## 6. 验收标准

CapabilityRegistry V1 candidate 只有满足以下条件才可认为通过：

1. 当前能力可以统一列出。
2. 每个能力有类型、归属、风险、成本、状态和证据来源。
3. 外部能力默认进入鸿胪寺。
4. 可复用 Prompt、模板、方法论、印版、知识包默认进入翰林院。
5. 能力晋升和裁撤由吏部提出建议，不由 Agent 自行决定。
6. 高风险外部能力需要刑部复核。
7. 五个高付费场景能看到推荐能力映射。
8. 未激活能力零权限。
9. 小样本不得显示权威评分。
10. 不破坏现有丞相、军机处、六部、锦衣卫、史馆、Harness 和冻结边界。
11. 无任何自动安装、授权、发送、发布、报价、交易、部署行为。

## 7. 回滚方式

若后续 candidate 出现问题，回滚策略必须简单：

1. 删除或禁用新增 `/api/capabilities/*` 只读路由。
2. 删除或隐藏前端能力总账入口。
3. 保留原 Runtime Skill、MCP registry、军机处、六部和锦衣卫模块不变。
4. 不迁移数据库时，不需要数据回滚。
5. 如引入缓存，只允许删除派生缓存，不删除 canonical source。

## 8. 不应开发的内容

V1 不开发：

- 能力商城交易。
- 算筹/功勋结算。
- 真实人民币支付。
- 自动安装插件。
- 自动授权外部账号。
- 自动调用 Codex / Claude Code / DeepSeek Harness / OpenClaw 执行真实工程。
- 自动发邮件、发消息、报价、上架、部署、发布或签约。
- 新的 Agent 运行时。
- 新的任务事实源。
- 新的史馆账本。
- 新的大殿改版。

## 9. 下一阶段建议

建议后续按四步推进：

1. `CapabilityRegistry V1 exact approval`：Owner 明确 exact base、allowed paths、schema、API、UI
   和测试命令。
2. `Backend readonly projection candidate`：只做后端统一投影和 API。
3. `Frontend readonly entries candidate`：只做翰林院、吏部、鸿胪寺三个入口和总账页。
4. `Quality and scene mapping candidate`：补五个高付费场景推荐映射、Playwright 和体验文案。

每一步都必须单独验收，避免一次性把能力市场、奖励系统、外部工具准入和真实执行全部混在一起。
