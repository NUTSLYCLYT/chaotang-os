# Request Analysis：军机处专项骨架 V1

## 用户目标

把朝堂升级为“面向个人和企业的 AI 高管团队与智能体组织治理系统”的第一步：让用户提出目标后，系统能设立专项、组建项目组、生成任务卡和验收标准。

## 本轮建议最小范围

只做 P0：军机处专项骨架。

- `ProjectOrganization`
- 军机处设立专项 UI/API
- 从 SceneRun 创建专项
- 项目纲领、成员矩阵、任务卡、验收标准投影

## 不进入本轮

- `EngineeringWorkOrder`
- `ExternalCapabilityProvider`
- `ExternalCapabilityGrant`
- `ExternalAgentRun`
- `CapabilityRegistryItem`
- `CapabilityPromotionCase`
- `CapabilityEvaluationRecord`
- `ShiguanOutcomeRecord`
- 工部真实调用 Codex / Claude Code / DeepSeek Harness
- 鸿胪寺真实 provider 授权与审计
- 翰林院荐才榜
- 吏部考绩
- SceneRun 正式归档到史馆

## 成功标准

- 用户不用懂 Agent/MCP，也能从一个目标生成专项。
- 用户能看到：当前做什么、谁负责、缺什么、下一步点哪里。
- 每个专项至少有一个主办部门。
- `ABSTAINED` 成员必须保留不召理由。
- 每个任务卡必须有验收标准。
- SceneRun 创建专项必须 owner/tenant 隔离。
- 不产生外部副作用。

## 风险

- 若范围扩到工部/鸿胪寺/吏部/翰林院，会引入外部权限、能力注册和考绩事实源，必须拆成后续 amendment。
- 若 ProjectOrganization 持久化与 BoardMission 重叠，容易形成第二任务账本；实现时应只做军机处专项投影，并明确与 SceneRun/BoardMission 的关系。
