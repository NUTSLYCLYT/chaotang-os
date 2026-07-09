# 朝堂前端 Owner Agent

这是 `chaotang-os/frontend` 的前端调度中枢。它只负责前端体验线。

## 角色

前端 Owner 负责让每个前端变更经过可审计的 harness：明确意图、限定范围、完成实现、跑机械检查、留下证据和 change 记录。

前端线拥有：

- Next.js App Router 页面、组件、布局、导航和浏览器行为。
- 朝堂 OS 的用户可见体验：上书房、军机处、史馆、六部、庄园和 LIVE / MIXED / DEMO 边界。
- 前端发布门禁、Playwright 验证、截图证据、浏览器可见回归。
- `frontend/.harness/` 下的前端规则、skills、wiki、模板和变更记录。

前端线不拥有：

- 外部能力执行和非前端运行逻辑。
- 非前端质量基线、运行记录和评测事实。
- 未经 API 契约或运行证据支持的“真实能力”声明。

## 必读文件

| 领域 | 文件 |
| --- | --- |
| 根项目入口 | `../AGENTS.md` |
| 前端入口 | `AGENTS.md` |
| 产品边界 | `.harness/rules/product-boundaries.md` |
| 项目结构 | `.harness/rules/project-structure.md` |
| 编码标准 | `.harness/rules/coding-standard.md` |
| 工作流 | `.harness/rules/dev-workflow.md` |
| 架构事实 | `.harness/wiki/architecture.md` |
| API 契约 | `.harness/wiki/api-contracts.md` |

## Skill 调度

| 阶段 | Skill |
| --- | --- |
| 0 项目定向 | `.harness/skills/project-analysis/SKILL.md` |
| 1 需求分析 | `.harness/skills/request-analysis/SKILL.md` |
| 2 / 4 / 6 审查 | `.harness/skills/expert-reviewer/SKILL.md` |
| 3 编码 | `.harness/skills/coding-skill/SKILL.md` |
| 4 代码审查 | `.harness/skills/code-review/SKILL.md` |
| 5 单测 | `.harness/skills/unit-test-write/SKILL.md` |
| 5 E2E | `.harness/skills/e2e-test-write/SKILL.md` |
| 10 部署验证 | `.harness/skills/deploy-verify/SKILL.md` |
| 卡住或怀疑漂移 | `.harness/skills/frontend-doctor/SKILL.md` |

## 工作流

实质前端变更遵循 `.harness/rules/dev-workflow.md` 的 11 阶段：

```text
0 启动
1 需求分析 -> 2 方案审查 -> 3 实现 -> 4 代码审查 -> 5 测试编写
                                                               |
                         7 提交 / 推送 <- 6 测试审查 <----+
                              |
                8 CI 验证 -> 9 E2E -> 10 部署验证 -> 11 用户验收
```

本目录的可用 CI/门禁包括：

- `pnpm harness:doctor`
- `pnpm exec tsc --noEmit`
- `pnpm build`
- `pnpm test:e2e`
- `pnpm harness:chaotang:gates`
- `pnpm gate:prod-release`

## 冷启动

1. 确认当前目录是 `chaotang-os/frontend`。
2. 读取根 `../AGENTS.md` 与前端 `AGENTS.md`。
3. 运行 `pnpm harness:doctor`。
4. 查看 `.harness/changes/` 中最近的 active change。
5. 如果没有对应 change，使用 `pnpm harness:new-change <type> <short-name>` 创建。

## 不可绕过

- 不把非前端运行事实、质量规则或生产执行逻辑搬进前端。
- 不把 DEMO/FALLBACK 包装成 LIVE。
- 不改端口纪律：dev 3002，production 3050，3001 禁用。
- 高风险前端变更必须有 review 与回归证据。
- agent 反复犯错时，优先补规则、skill checklist、guard 或测试，而不是只在聊天里提醒。
