# 多 AI 协调铁律（2026-10-06 owner 拍板，所有 agent 必须遵守）

> 本文件自 AGENTS.md 逐字迁出（2026-10-07），以保持 AGENTS.md ≤80 行并同步
> `check_harness.mjs` 的 canonical hash。规则内容一字未改。

背景：本仓库同时有 WorkBuddy、Codex 等多个 AI 直接工作。2026-10-06 实测发生两起冲突：
remote URL 被改回 HTTPS（导致推送挂死）+ owner 移除的 pre-push 钩子被重建（挡推送）。

规则：
1. **禁止修改 git remote URL**。origin 必须保持 `git@gitee.com:msxn/chaotang-os.git`（SSH），
   github 保持 `https://github.com/NUTSLYCLYT/chaotang-os.git`。任何 agent 不得以任何理由
   （含"修复连接"）改动 remote 配置；连接问题上报 owner 处理。
2. **禁止重建被 owner 移除的 git hooks**。移除 pre-push 冻结钩子 = owner 已按治理流程
   （.harness/approvals/ 审批记录）解除冻结；重建它等于推翻 owner 决定。若认为需要恢复
   冻结，先向 owner 提出并获批准。
3. **推送前必须 fetch + merge**（勿 rebase，保护线性历史与在途工作）；推送冲突时上报，
   不得 force push。
4. **工作区有未提交改动时先确认归属**再操作（`git status` 看到非自己产生的修改，不 stage、
   不 reset，先在 commit message 或 PR 描述中注明来源）。
5. 每次会话开始先读 `git remote -v` 与 `.harness/approvals/` 最新一条，确认当前治理状态。
