# Tasks：Scene Pack V1 下一轮草案

## 1. 归档契约设计

- 定义 SceneRun 到史馆 `REPLY` 的字段映射。
- 明确 demo、证据来源、风险、缺失项、下一步动作如何归档。

## 2. 后端归档 hook

- 在 SceneRun 创建后调用现有史馆 storage。
- 归档失败 fail-soft，但必须可审计。

## 3. 投标 Pack real_v1

- 扩展 registry 状态为 `real_v1`。
- 实现需求真值矩阵、Bid/No-Bid、澄清问题、符合性偏差、成本/报价阻断。

## 4. 前端展示

- 投标场景从占位切换为真实链路。
- 看板详情展示投标关键字段。

## 5. 验证

- 后端 targeted pytest。
- 前端 typecheck/lint/build。
- Playwright MCP 路径。
- root harness 与 scoped authority。
