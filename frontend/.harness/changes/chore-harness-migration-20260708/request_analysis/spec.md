# 需求说明：chore-harness-migration-20260708

## 背景

用户要求把前端项目和当前文档接入 `chaotang-os` 的当前三层 harness 架构。当前前端目标目录是 `frontend/`。

## 范围

- 新增 `.harness/`，包含 agents、rules、skills、wiki、changes、templates 和 MCP index。
- 新增 `harness:doctor` 与 `harness:new-change` 脚本。
- 更新根 `AGENTS.md`、前端 `AGENTS.md`、前端 `README.md` 指向当前 harness 入口。
- 更新 `CLAUDE.md`，新增长期 harness 使用和编写文档。
- 当前入口规则按 `chaotang-os` 三层架构重写，不保留旧单仓口径。

## 非目标

- 不做业务代码重构。
- 不改路由、UI、鉴权或外部运行行为。
- 不删除既有 `harness/` 领域评测资产。
- 不保留旧单仓 agent 入口规则。

## 验收标准

- `.harness/agents/frontend-owner.md` 存在并说明 owner 工作流。
- `.harness/rules/*.md` 定义产品边界、结构、编码标准和工作流。
- `.harness/skills/*/SKILL.md` 有 frontmatter。
- `coding-skill` 包含适配 `src/app`、`src/features`、`src/core`、`src/lib/shared` 和 styling 的分层规格。
- `.harness/wiki/*.md` 提供架构、领域、API、文档和发布事实。
- `CLAUDE.md`、`README.md`、`AGENTS.md` 和 harness 文档都指向新的 `.harness` 入口。
- 新 change 模板能创建可用审计目录。
- `node scripts/harness-doctor.mjs` 通过。

## 风险

- 当前代码库较大，结构规则必须适配既有 `src/app`、`src/features`、`src/core`、`src/lib`。
- 已交付 change 如果缺少文件或有占位符，会导致 doctor 失败。

## 验证计划

- 运行 `node scripts/harness-doctor.mjs`。
- 运行 `node scripts/new-change.mjs chore harness-migration` 并检查渲染后的模板。

