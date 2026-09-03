# Scene Pack V1 下一轮修正案草案：史馆归档 + 投标场景 real_v1

## 状态

`DRAFT_ONLY`。本文件不是产品施工授权。

## 一、史馆正式归档

目标：Scene Pack 运行完成后，在不暴露归档内部失败给前端成功契约的前提下，将可归档结果写入现有史馆 `REPLY` 档案。

候选范围：

- 后端 Scene Pack storage/API 增加 best-effort archive hook。
- 复用 `app.shiguan.storage.create_archive` 与既有 `MEMORIAL/REPLY` 契约。
- `SceneRun` 保留自身运行记录；史馆保留正式回奏档案，不互相替代。
- 归档 payload 必须包含场景 slug、裁决、风险、缺失项、下一步、证据引用和 demo 标记。
- 归档失败不得把 SceneRun 成功伪装为史馆成功；应以内部状态或证据字段标注待核。

非目标：

- 不新增第三类史馆档案类型。
- 不迁移历史 SceneRun。
- 不开放客户端伪造 owner 或归档状态。

## 二、`proposal-quotation-tender` real_v1

目标：把方案 / 报价 / 投标建议从占位场景提升为可演示真实链路，输出需求真值矩阵、Bid/No-Bid、澄清问题、符合性偏差、成本/报价阻断与七天行动计划。

必须复用：

- `flow_product`：技术需求与配置适配。
- `flow_jinyiwei`：客户、法规、项目公开信息待核。
- `flow_quotation`：成本、报价、付款与毛利风险。
- `flow_haolong`：投标文件目录、澄清函和行动计划。
- 丞相：Bid/No-Bid 裁决。
- 军机处：任务承接。
- 史馆：结果归档。

阻断规则：

- 无客户需求原文，不生成方案。
- 无成本证据，不生成正式报价。
- 无技术验证，不承诺性能。
- 无产能证据，不承诺交期。
- 无认证证据，不声明认证已通过。

输出仍必须符合 Scene Pack 统一契约，并额外包含：

- `bidDecision`
- `requirementTruthMatrix`
- `clarificationQuestions`
- `complianceDeviationTable`
- `costReadiness`
- `quotationReadiness`
- `tenderFileOutline`

## 三、验收建议

- 后端 API 测试覆盖：归档成功、归档失败不影响 SceneRun、投标缺成本 blocked、投标 demo completed。
- 前端覆盖：投标场景卡显示真实链路，demo 提交后进入看板详情。
- Playwright MCP 覆盖：投标 demo 从 `/dadian` 到 `/junjichu/scene-board`。
- Harness/authority：新增 exact amendment digest 后更新 scoped authority 或创建下一轮独立 scoped authority。
