# 朝堂 OS 项目工作入口

朝堂 OS 已有真实前后端业务代码、API、证据链和测试。项目唯一产品主线是 `ext-dev`；根层只协调
`frontend/`、`backend/` 与项目级 Harness，不持有第四套产品运行时。

## 启动顺序

1. 阅读 `.harness/agents/project-owner.md` 与 `.harness/rules/project-boundaries.md`。
2. 阅读 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`。
3. 前端工作继续读 `frontend/AGENTS.md`；后端工作继续读 `backend/AGENTS.md`。
4. 运行 `node scripts/check_harness.mjs` 和 `node scripts/harness-doctor.mjs --check`。
5. `node scripts/harness-doctor.mjs --status` 只报告 `BOOTSTRAP_OBSERVE`；
   `node scripts/harness-doctor.mjs --ready` 在后续门禁完成前固定 `NOT_READY`。
6. 产品任务还须运行 `node scripts/product-authority.mjs --status`；无 task 参数时不选择 approval，固定 STOP。

## 三层边界

- 根 `.harness/`：项目入口、边界、closed manifest 和只读观察；事实源见
  `.harness/manifest/project-harness.json`。
- `frontend/`：用户体验与浏览器契约；当前 frontend Harness 状态为 `ABSENT`。
- `backend/`：运行、评测和证据事实源；当前 backend Harness 状态为 `PARTIAL`。
- 根 `.claude/`、`.codex/`、`.agents/` 仅配置如何调用工具，不构成产品事实源或第四主线。

## 权限与质量门

- 当前产品 authority 为 `STOP`，`canExecuteProductWork=false`。Harness PASS、文档、聊天、测试或
  `BOOTSTRAP_OBSERVE` 均不能产生产品 GO。
- `product-authority.m0.v1` 是唯一产品施工 consumer。只有 Owner 已确认 digest 的 approval manifest
  先以独立提交落地，且 `--authorize --task <exact-id>` 返回 GO，才允许该 manifest 的一次产品施工。
- 产品候选必须是 approval commit 的精确单亲子，并通过 `--verify-candidate --task <exact-id>`；候选
  SHA/tree 仍须 Owner 第二次确认，commit/push/merge/deploy 继续分别授权。
- 任何实质任务先冻结 goal、base/tree、exact paths、non-goals、验收和证明命令；机器门返回 STOP
  时只做获批的治理、事故、证据或只读工作。
- 行为变更先建立 RED，再做最小 GREEN；同一最终候选按任务合同完成完整验证。
- Git 写操作前核对绝对工作区、分支、HEAD 和状态；提交、推送、合并、部署均需具体授权。
- 共享脏工作区的未知改动属于用户；不得 reset、stash、清理、覆盖或顺手带入候选。

## Skill 与工程路由

- 每回合先检查证据并选择最小可用 Skill；事实冲突、权限不清或风险扩大时停止。
<!-- adaptive-routing-contract:start -->
- 先盘问：优先检查现有证据，只询问会实质改变目标、范围、验收、风险或授权的问题；信息足够即停止，关键歧义无法消除则标记 `Blocked`。
- Codex 自动选择并说明理由：直接执行仅用于明确、局部、可逆、低风险、不改变业务行为且容易验证的工作；局部行为修改在足够时使用 Matt Skills；跨模块、未知根因、高风险或验证链较长时使用 Superpowers。
- 允许按证据 `直接执行 → Matt Skills → Superpowers` 升级；连续验证失败时必须说明证据并升级到 Superpowers；已有明确授权的高风险事项使用 Superpowers，缺少授权或未解决歧义时进入 `Blocked`。
- 质量门禁包括根因、测试和新鲜验证，不因所选 Skill 降低；范围实质变化时重新盘问。
- Matt Skills 缺失时不自动安装；使用等价 Codex 原生步骤，无法满足门禁时升级到 Superpowers。
- worktree 操作继续使用 `using-git-worktrees`；本仓库实质工程任务继续使用 `codex-engineering-workflow` 统一路由。
<!-- adaptive-routing-contract:end -->
- 已授权工程使用 `$codex-engineering-workflow`；Codex-only 任务禁止 `gstack-claude`、Claude CLI
  和 Claude runner。第三方 Skill 不进入仓库或 CI。

## 产品协作

- `ARCHITECTURE.md`、`docs/agentic-engineering.md`、`docs/codex-engineering-workflow.md`、
  `docs/product-collaboration.md` 与 `docs/tooling-compatibility.md` 是现有导航。
- Codex 客户端中，默认担任产品经理；用户确认任务为 Ready 后才能实施。
- Claude Code 主会话默认担任程序团队负责人；产品定义或验收不清时返回 Blocked。
- `$product-flow` 或“自动交付：”只委托已授权范围，不扩大高风险、付费、生产或 Git 权限。

## 当前验证

- `node scripts/check_harness.mjs --self-test`
- `node --test scripts/harness-doctor.test.mjs`
- `node --test scripts/product-authority.test.mjs`
- `node .agents/hooks/check-harness.mjs --self-test`
- `node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test`

所有 AI、自动化和实现任务必须遵守 ADR 0028；未经用户单独明确授权，不得修改、绕过或用旧
`dev` 代码替代。前后端 setup、lint、typecheck、test、build/run 命令以各自 `AGENTS.md` 为准。

## 多 AI 协调铁律（2026-10-06 owner 拍板，所有 agent 必须遵守）

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

## Worktree 治理铁律（2026-10-07 owner 拍板，所有 agent 必须遵守）

背景：2026-10-06 实测 worktree 膨胀至 25 个，其中 4 个挂在 C 盘 Temp（随时被系统清理→注册表
损坏，曾引发 13 个 worktree 全损事故），另有一批验证用完未收。2026-10-07 已大扫除 17 个，
抢救内容（patch + 未跟踪文件）存于 `H:/ChaotangBackups/worktree-rescue-20261007/`（MANIFEST.md 可查）。

规则：
1. **新 worktree 只能建在白名单目录**：首选 `H:/ChaotangWorktrees/<任务名>`，其次
   `H:/ChaotangStaging/`、`H:/ChaotangSource/`、`D:/OrcaWorkspaces/`。
   **绝对禁止**建在 C 盘（含 Temp、AppData、用户目录）。
2. **detached HEAD 验证/仿真 worktree 用完立即 `git worktree remove`**，不留过夜、不攒堆。
3. **任务分支合并进 `ext-dev` 后**：先删 worktree，再删本地分支（`git branch -d`），
   远端分支去留由 owner 决定。
4. **每次会话收尾前必须运行 `node scripts/check-worktrees.mjs`**：exit 1 表示存在越界
   worktree，必须当场处置或明确上报 owner；禁止留到下次会话。
5. 删除脏 worktree 前必须抢救：`git -C <路径> diff HEAD > 备份.patch` +
   未跟踪文件拷贝（参考 `worktree-rescue-20261007` 的目录结构），先备份后删除。
