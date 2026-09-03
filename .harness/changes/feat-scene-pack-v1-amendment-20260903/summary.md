# 变更摘要：feat-scene-pack-v1-amendment-20260903

> 执行授权：`SCOPE_EXPANDED_ENTERPRISE_GROWTH_PENDING_EXACT_APPROVAL / MACHINE_AUTHORITY_STOP`
> 本目录记录 Scene Pack V1 的范围、边界和验证计划；在 B2B 与企业增长范围扩展获得新 exact digest 批准并完成 scoped authority 绑定前，不授权修改 frontend/backend 产品代码。

| 字段 | 值 |
| --- | --- |
| Change ID | feat-scene-pack-v1-amendment-20260903 |
| 类型 | feat |
| 状态 | SCOPE_EXPANDED_ENTERPRISE_GROWTH_PENDING_EXACT_APPROVAL |
| Owner | Product Owner `lyt` / Execution Owner `Codex` |
| 创建日期 | 20260903 |
| 用户授权 | 2026-09-03 chat：批准为“场景入口 + 军机处看板最小闭环”创建并执行获批 amendment；后续追加要求 `b2b-inquiry-conversion` 与 `enterprise-growth-diagnosis` 由 `stubbed` 升级为 `real_v1`；不授权 push、merge 或 deploy |
| 当前 checkout | `docs/r0-trusted-kernel-amendment-20260720@b20e2c78b6fa83e49193b810b76c9ca33ff00948` |
| 本地 `ext-dev` | `ext-dev@0cfc865ceb0c02973113671e6290155ea2cda6d3` |
| 本地 `origin/ext-dev` | `origin/ext-dev@6a2c4dd8d4cf13ed34d5665deef4307ac2801569` |

## 范围

- 主线：Scene Pack V1 第一批真实场景闭环，作为现有朝堂主链的入口、运行记录和军机处投影。
- 文件候选：后端模型/API、前端大殿入口、共用场景页、军机处场景看板、演示数据和 Playwright 最小验收。
- 首批真实场景：`single-product-export-diagnosis`、`b2b-inquiry-conversion`、`contract-cashflow-risk`、`enterprise-growth-diagnosis`。
- 占位场景：`proposal-quotation-tender`。
- 验证：authority、root/frontend/backend harness doctor、后端 API 测试、前端类型/build、Playwright 入口到看板闭环。

## 非目标

- 不创建第二套 Agent 系统、任务事实源、权限系统、flow 编排器或外部执行器。
- 不自动签约、自动付款、自动报价、自动群发、自动发邮件或自动对外发布。
- 不声明法务/签约/报价为“已通过”；合规、合同、报价和外联动作均保留人工确认门。
- 不 push、merge、deploy。

## 当前裁决

本 change 已记录用户批准范围，并根据最新指令扩大到 B2B 询盘成交与企业经营增长诊断真实链路。由于 amendment digest 已再次变化，旧 exact digest 批准失效；下一步必须重新批准新 digest 并绑定 scoped authority，再进入产品实现。
