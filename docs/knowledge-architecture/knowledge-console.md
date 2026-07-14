---
source_id: repo_archive
source_path: courtos-brain/知识库控制台.md
content_hash: sha256:3ac3b7f6c85d189b2d1012135f2f2435835f927af406025b20b40a9439f91e88
trust_tier: methodology
k0a_snapshot_token: sha256:8e944de6c327cb9868e588abe3ae34c2478ce0cc92f48e8dc0030e6011665d71
absorbed_at: 2026-07-14
---
---
type: moc
status: active
updated: 2026-07-13
---

# CourtOS-Brain 知识库控制台

## 一句话目标

把每天采集的证据，转化为可追溯的认知、决策、方法和成果；不再用“文件数量”假装知识增长。

## 自生长闭环

```text
原始证据 → 来源记录 → 高价值概念 → 决策/成果 → 结果反馈 → 修正概念与方法
```

## 四层映射

- A · 原始输入：`00-Inbox/`、日报、蜂群、研究资料
- B · 高价值知识：`_wiki/sources/`、`_wiki/concepts/`、`_wiki/entities/`
- C · 可复用方法：`.agents/skills/`
- D · 成果输出：`03-Outputs/`

## 日常入口

- “用 `$grow-courtos-knowledge` 摄取今天的新资料，只处理最值得复用的 3 个概念。”
- “用 `$grow-courtos-knowledge` 把本周研究转成一份决策简报，事实和判断分开。”
- “用 `$grow-courtos-knowledge` 巡检最近 7 天，合并重复概念并列出失效假设。”
- “从现有知识库回答这个问题；每个关键结论给出来源笔记，不确定就标注待验证。”

## 当前治理重点

1. 停止新增空壳概念和同义重复页。
2. 优先修复与当前项目、投资和 AI Agent 工作直接相关的高频概念。
3. 每次输出都要产生行动、决策或明确的“不行动”。
4. 用真实结果回写知识，而不是只做更多摘要。

## 安全边界

- Claudian/Codex 默认仅在本 Vault 内写入，并对命令或越界访问请求审批。
- 不把 API Key、Cookie、令牌写入笔记或 Skill。
- 自动任务先手工跑通 3 次，再启用定时执行。
