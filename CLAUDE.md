@AGENTS.md

# Claude 入口

本文件只做极简启动提示。项目事实源是同目录 `AGENTS.md` 与 `.harness/`，不维护第二套规则。

## 启动顺序

1. 读取 `AGENTS.md`，确认任务归属（前端 / 后端 / 跨线）。
2. 前端任务 → 进入 `frontend/`，读 `frontend/AGENTS.md`。
3. 后端任务 → 进入 `backend/`，读 `backend/AGENTS.md`。
4. 跨线或项目级任务 → 读 `.harness/manifest/project-harness.json`。
5. 架构变更后运行 `node scripts/harness-doctor.mjs`。

## Claude Code 配置

- Agents：`.claude/agents/`（7 个 gongbu-* 工部 agents）
- Skills：`.claude/skills/`（前端设计、建部套件、用户模式）
- Hooks：`.claude/hooks/`
- 大神：`skills/personas/`（40 个顾问 personas，供蜂群会审）
