# Claude Code 独立审查交接单：G0 execution authority

## 审查对象

`fix-r0-execution-authority-20260720`。实现候选 SHA、tree 与 binary diff digest 在提交后填写。审查必须绑定同一 exact HEAD，且只能只读。

## 三路审查

1. Authority：v1 是否永远 inactive；change/Packet/用户确认/Markdown 是否仍可能自行授予施工权；R0 PRD 与根入口是否受保护。
2. Security：strict JSON、unknown/duplicate key、摘要、path traversal、ancestor symlink、计划 inventory 和同仓 checker 边界是否 fail closed。
3. Git/Evidence：B/H/parent/tree/name-status/binary diff、范围、测试结果与回滚是否可复现；是否混入用户文件或历史 WIP。

## 必审文件

- `AGENTS.md`
- `.harness/manifest/project-harness.json`
- `.harness/manifest/execution-authority.v1.json`
- `.harness/contracts/execution-authority.schema.json`
- `scripts/lib/execution-authority.mjs`
- `scripts/execution-authority.mjs`
- `scripts/execution-authority.nodetest.mjs`
- `scripts/harness-doctor.mjs`
- `.harness/agents/project-owner.md`
- `.harness/rules/project-workflow.md`
- `.harness/templates/change-template/summary.md`
- 本 change 四件套与 CI 证据

## 结论格式

每一路输出 `GO`、`GO_WITH_ACTIONS` 或 `NO_GO`，逐项列出证据、严重级别和处置。任一 HIGH/MEDIUM 未关闭即整体 `NO_GO`。

## 禁止事项

- 审查会话不得修改文件、提交、push、merge 或运行有外部副作用的命令。
- 不得把本地 review 称为托管平台 required check。
- 不得把 inactive guard 称为 amendment 已批准或 R0 已实施。
