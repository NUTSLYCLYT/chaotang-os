# chaotang-os

朝堂 OS：以中国古代朝廷为域模型的个人 AI Agent 操作系统。产品主线为 `ext-dev` 分支，
由 M0 单人 owner 产品权威（ADR 0028）治理。

## 当前状态（2026-10-07 实况，替代旧"从零重建"描述）

技术栈已定型并经 ADR 批准（ADR 0006/0007/0008/0009）：

- `backend/`：Python + FastAPI + uvicorn + pip/venv，扁平 `app/` 包；LangGraph 运行时 +
  唯一 DeepSeek provider（声明式 `backend/config/providers.yaml`）。
- `frontend/`：Next.js App Router + React + TypeScript（`src/app/`、`src/lib/`，
  BFF 经 `backendClient.ts` 调后端）。

已交付能力（事实源：`ARCHITECTURE.md` 与 46 个 ADR）：

- 端到端业务闭环：上书房下旨 → 丞相 Agent → 史馆归档（ADR 0028 闭环）。
- 24 个后端业务域（史馆/锦衣卫/军机处/钦天监/户部现金安全/军机处案卷等），
  各域独立 owner-scoped SQLite，域间边界由 ARCHITECTURE.md 固定。
- 锦衣卫证据域：来源注册表 fail-closed、MCP 只读接入（腾讯自选股，OAuth PKCE +
  DPAPI 隔离）、外网默认关闭、schema v4 审计。
- 能力评测胶囊：5 个候选 × 黄金评测集（38 case 全绿，`authorizesPromotion=false`
  零权限离线边界），T03 目标 53 能力位推进中（路线图见
  `docs/product/eval-expansion-roadmap.md`）。
- 生产部署：未定，立项建议见 `docs/product/deployment-proposal.md`。

## Agent 与工程入口

- 工作规则：`AGENTS.md`（canonical hash 锁定，改动须同步 `check_harness.mjs` 常量）
- 多 AI 协调铁律：`docs/multi-ai-coordination-rules.md`
- Worktree 治理铁律：`docs/worktree-governance.md`
- 架构边界：`ARCHITECTURE.md`
- Agentic 工作流：`docs/agentic-engineering.md`
- Codex/Claude Code 兼容基线：`docs/tooling-compatibility.md`
- Codex 产品经理 / Claude Code 程序团队交接：`docs/product-collaboration.md`
- 产品任务模板：`docs/product/tasks/TEMPLATE.md`
- Claude Code 专业角色：`.claude/agents/`
- 一键自动交付：在 Codex 中输入 `自动交付：<需求>` 或调用 `$product-flow`
- Harness 验证：`node scripts/check_harness.mjs`
- 检查器自测：`node scripts/check_harness.mjs --self-test`
- Stop hook 协议自测：`node .agents/hooks/check-harness.mjs --self-test`
- 自动交付 runner 自测：`node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test`
- Worktree 门禁：`node scripts/check-worktrees.mjs`
