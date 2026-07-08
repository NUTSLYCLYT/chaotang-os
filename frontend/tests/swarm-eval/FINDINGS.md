# 蜂群能力实测发现（2026-06-03 · live 实测）

> 用真实 admin 会话（admin/admin123 → 真实后端 HS256 JWT）打通链路后的实测结论。
> 复现：`node tests/swarm-eval/brain-check.mjs`

## 🔴 核心结论：智能体大脑当前处于 rule/骨架兜底，不是真 LLM

两条能力路径**独立实测，均为兜底**：

| 路径 | 端点 | 实测结果 | 耗时 |
|---|---|---|---|
| 三院议事 | `POST /api/governance/deliberate` | 上游 legal-agent `/consult` 不可达 → 中书 draft="…待门下复核"(骨架)、门下机械"再议" | ~21.8s(等超时) |
| 真编排器 | `POST /api/court/chaotang/decree/draft` | `data.source="rule"`、`stakesReason="评估失败,保守设为中等风险"`、draft="拟旨:<原文>" | ~0.14s |

**含义**：现在跑任何能力评测，量到的都是**骨架文案**，不是 LLM 真本事。**评测前必先 `brain-check` 显示 🟢 LLM-LIVE**，否则白跑。

## ✅ 顺带实证：鉴权链路 + auth 对齐正确

- 前端登录 → 真实后端 token `{user_id:1, tenant_slug:"default", role:"admin", exp:<ISO>}` —— 正是本会话 auth 对齐针对的形状。
- `deliberate` 用该真实 token 返回 200（getUserIdFromSession/resolveTenantId/role 授权全部正确接受真实 token）。
- 即：**测试套件 + 鉴权全链路 live 可用，只差大脑没接上。**

## 🔧 要测真能力，先接大脑（不在前端可控范围）

1. **jiqun_ai 的 LLM 层**：`draft_decree` 的"评估失败"说明编排器调 LLM/OpenClaw 失败。排查 jiqun_ai 的模型配置（Ollama :11434 / OpenClaw / API key），让 `orch.draft_decree` 真正走 LLM（`source` 应 ≠ `rule`）。
2. **前端 `LEGAL_AGENT_URL`**：deliberate 走的 legal-agent `/consult` 在本环境不存在。两个选择：
   - (a) 部署/指向真正的 legal-agent；或
   - (b) 把 deliberate 改接 jiqun_ai 真编排器 `/api/chaotang/decree/draft|dispatch`（真实可达路径，比 dead /consult 更对）。run-eval 可加 `--endpoint chaotang` 直接评真编排器。
3. 接上后：`node brain-check.mjs` 应显示 🟢 LLM-LIVE，再 `run-eval → judge → scorecard` 出真实能力画像。

## 已知会污染结果的其它管路缺陷（见 README）

`/api/v1/swarms/*` 全 MOCK；`agents/run` fire-and-forget 卡 running；`agent_runs` 历史列未写入；9 态状态机死代码；门下 n-gram 误准/误驳高；`/api/chat` 旁路预算。
