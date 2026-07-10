# 规格说明：docs-frontend-backend-contract-alignment-plan-20260709

## 背景

用户要求针对前后端业务和接口不匹配的情况输出一份实施方案 Markdown。

## 范围

- 分析当前前端访问层、后端路由和业务事实源边界。
- 输出分阶段实施方案。
- 明确验证矩阵、优先级、回滚策略和当前本地工作区注意事项。
- 按方案开始阶段 0：自动生成前端调用与后端 route 盘点。
- 按 P0 要求为现有 transport alias 补回归测试。

## 非目标

- 不在本次直接修业务接口。
- 不新增 mock 证明真实后端能力。
- 不重构前后端代码。
- 不改 UI 层布局、视觉、组件层级、导航结构、交互动线或文案表达。
- 不新增前端 BFF、Next API route、route handler、server action 或前端服务端业务代理。

## 验收标准

- `docs/` 下存在实施方案 Markdown。
- 方案能指导后续落地，包括盘点、契约、适配、后端补齐、浏览器验证。
- 跨线事实源和验证命令写清楚。
- `docs/` 下存在阶段 0 API inventory JSON/MD。
- transport alias 有前端 node test 覆盖。
