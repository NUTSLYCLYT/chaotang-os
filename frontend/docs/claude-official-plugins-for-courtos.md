# Claude Code 官方插件用于朝堂 OS

视频号链接：`https://weixin.qq.com/sph/AwanxQABBi`

可见标题：`质变封神！一行命令，官方插件彻底重塑，Claude Code 能力上限`

本机已安装并启用 Claude Code 官方插件市场：`claude-plugins-official`。

## 已安装插件

核心插件：

- `frontend-design@claude-plugins-official`
- `typescript-lsp@claude-plugins-official`
- `code-review@claude-plugins-official`
- `security-guidance@claude-plugins-official`
- `feature-dev@claude-plugins-official`
- `claude-code-setup@claude-plugins-official`
- `claude-md-management@claude-plugins-official`
- `commit-commands@claude-plugins-official`
- `pr-review-toolkit@claude-plugins-official`

已补齐 TypeScript LSP 依赖：

```bash
npm install -g typescript-language-server
```

验证命令：

```bash
claude plugin list --json
typescript-language-server --version
pnpm exec tsc --noEmit
pnpm test:core
```

## 朝堂 OS 使用原则

插件不是拿来堆功能页的，而是拿来提高每次融合质量的。

朝堂当前原则：

- 尽量融合进原界面。
- 不新增可见的统一 Loop 页面。
- 用户只看经营结论、风险、缺证、分歧、后令和来源。
- Agent、Loop、蜂群、Harness 默认走暗线。
- 高风险必须保留人工确认。

## 插件对应朝堂岗位

`feature-dev`

对应：丞相 + 军机处。

用途：做大功能前先走需求澄清、代码探索、架构方案、实现、复核。适合“把庄园密旨融合进原军机处”“把附件上传接入上书房”等中大型功能。

推荐说法：

```text
Use /feature-dev to implement attachment upload in the existing Shangshufang command bar.
Keep it fused into the original UI. Do not add a new upload page.
```

`frontend-design`

对应：工部 UI + 礼部表达。

用途：升级视觉、布局、交互密度。适合朝堂暗金驾驶舱、卷轴奏折、红黄绿灰状态、底部操作台。

推荐说法：

```text
Use frontend-design to upgrade the existing Junjichu scroll.
Keep the palace shell and business dashboard core.
Show sourceLabel, risks, evidence gaps, conflicts, and one primary action.
```

`typescript-lsp`

对应：工部代码工匠。

用途：提高 TS/TSX 代码理解能力，支持定义跳转、引用、错误定位。日常默认启用，不需要每次手动调用。

`security-guidance`

对应：刑部 + 御史台。

用途：对改动做安全检查，尤其是上传文件、API、用户输入、外链、鉴权、fallback 等。

朝堂里重点检查：

- 上传附件不能任意执行。
- 外部链接不能绕过来源标识。
- 高风险结论不能直接归档为准奏。
- FALLBACK/DEMO 不能伪装 LIVE。

`code-review`

对应：御史台正式审查。

用途：PR 或较大变更后跑多视角代码审查。

推荐说法：

```text
/code-review
```

`pr-review-toolkit`

对应：六部专项复核。

用途：分别查测试、错误处理、类型设计、注释准确性、代码简化。

推荐说法：

```text
Review recent changes for test gaps, silent failures, type design, and code simplification.
```

`claude-code-setup`

对应：军机处工具配置官。

用途：扫描当前项目，推荐 hooks、skills、MCP、commands、subagents。

推荐说法：

```text
Recommend Claude Code automations for this CourtOS frontend repo.
Respect the rule: fuse new capability into existing screens.
```

`claude-md-management`

对应：史馆。

用途：把项目规则、经验、约束沉淀到 CLAUDE.md。

推荐说法：

```text
Audit CLAUDE.md and update it with today's CourtOS fusion rules.
```

`commit-commands`

对应：史官落档。

用途：自动整理 commit 和 PR。

推荐命令：

```text
/commit
/commit-push-pr
```

## 高手工作流

小改动：

```text
1. 直接说明目标。
2. 要求融合进原界面。
3. 实现后跑 pnpm exec tsc --noEmit 和 pnpm test:core。
4. 让 pr-review-toolkit 查测试、错误、类型、简化。
```

中大型功能：

```text
1. /feature-dev 澄清需求。
2. 探索原代码，不先写新页面。
3. frontend-design 定 UI 融合方式。
4. 实现。
5. security-guidance / code-review / pr-review-toolkit 复核。
6. /commit 或 /commit-push-pr 归档。
```

朝堂专用提示词：

```text
Use the official Claude Code plugins to implement this CourtOS change.
Use feature-dev for structure, frontend-design for UI quality, security-guidance for risk gates, and pr-review-toolkit for final review.

Rules:
- Fuse into existing Shangshufang / Junjichu / Memorial / Shiguan / Estate screens.
- Do not add a visible unified-loop page.
- Do not expose internal agent topology or technical logs.
- Preserve sourceLabel, evidence gaps, risks, conflicts, nextAction, and human confirmation gates.
- Run typecheck and core tests before finishing.
```

## 一行安装命令

视频里说的核心就是官方插件可以一行安装：

```bash
claude plugin install frontend-design@claude-plugins-official
```

同理：

```bash
claude plugin install feature-dev@claude-plugins-official
claude plugin install security-guidance@claude-plugins-official
claude plugin install typescript-lsp@claude-plugins-official
```

本机这些已经装好。
