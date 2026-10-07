# 兵部 Revenue OS P0 审查记录

- 审查时间：2026-10-08 02:35:22 +08:00
- 任务：BINGBU-REVENUE-OS-P0-20261007
- 变更候选：`e149a80d3063578eba0509b5bc2ce64e970f47f8`
- 集成提交：`a3dd40cba59564642cb53b2f072b1e49820f5a94`
- owner：Codex /root
- 范围：产品合同、Codex 提示词、兵部后端/API、BFF、前端 UI/UX、测试和治理边界

## Codex 静态与离线验收

| 检查 | 结果 |
| --- | --- |
| 后端聚焦测试 | 通过：10 passed |
| 后端全量 pytest | 通过：5307 passed，32 skipped，4 warnings |
| 后端 Ruff | 通过 |
| 前端聚焦测试 | 通过：119/119 |
| 前端全量测试 | 通过：909 passed，0 failed，0 skipped |
| TypeScript typecheck | 通过 |
| Frontend lint | 通过 |
| Frontend production build | 通过，包含 /bingbu、/bingbu/import、机会详情、战情室及 BFF 路由 |
| Harness baseline | 通过：159 个基线文件 |
| Harness doctor | 通过结构检查；状态为 BOOTSTRAP_OBSERVE，按设计不授权产品执行 |
| Product authority candidate | 通过：CANDIDATE_ELIGIBLE_FOR_OWNER_ACCEPTANCE |

## DeepSeek 异构审查

- 期望模型：litellm/deepseek-reasoner
- 入口：OpenCode `v2.0.23`
- agent：项目 .opencode/agents/design-review.md，只读、禁止修改/提交/推送/部署
- 执行方式：本地 opencode run --standalone --model litellm/deepseek-reasoner --agent design-review --format json --auto ...
- 实际结果：未得到模型审查结论。LiteLLM 网关 http://127.0.0.1:4000/v1 在 2026-10-08 02:38:51 +08:00 返回 ConnectionRefused: Unable to connect. Is the computer able to access the url?
- 数据边界：未读取或输出 API key，未调用真实 DeepSeek 直连端点，未上传客户数据，未修改仓库文件。

## 结论

**CONDITIONAL_APPROVE（离线 P0 集成）**：静态审查、离线测试和治理校验支持把 P0 集成到 `ext-dev`；实现满足当前合同的 provider-neutral、人工审批和无外部副作用约束。

**待办门槛**：启用真实 DeepSeek provider 或进入涉及客户数据的生产试运行前，必须先恢复本地 LiteLLM 网关并重新执行只读 deepseek-reasoner 红蓝审查，记录 BLOCKER/HIGH/MEDIUM/LOW、文件行号、复现路径、结论和 owner。责任人：兵部/工部共同确认；截止：下一次真实 provider 变更前。

## 已知风险

1. 本次没有 DeepSeek reasoner 的模型结论，因此不能把“异构审查已通过”写成事实。
2. P0 storage 是进程内实现；多实例部署前要补 owner-scoped 持久化和并发恢复验证。
3. 当前实现保留了真实 provider 的注入边界，但没有宣称真实 API 连通性或 CRM 写入能力。

