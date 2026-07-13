# 变更摘要：chore-harness-normalization-20260713

| Field | Value |
| --- | --- |
| Change ID | chore-harness-normalization-20260713 |
| Type | chore |
| Status | DRAFT |
| Owner | Project Agent |
| Created | 20260713 |

## 范围

- 主线：根项目、后端 harness、文档。
- 文件：
  - 新建 `backend/agent_design/README.md`（agent_design 目录索引）
  - 新建 `backend/runtime_prompts/README.md`（71 个 Agent prompt 索引）
  - 新建 `backend/harness/_shared/naming-conventions.md`（harness 命名规范）
  - 更新 `backend/harness/manifest.json`（增加 `referenceArtifacts`、`namingConventions`、共享文件条目）
  - 更新 `backend/scripts/harness_doctor.py`（增加 `referenceArtifacts` 检查）
  - 更新 `docs/README.md`（建立 API 审计和实施方案分类结构）
  - 更新 `.harness/manifest/project-harness.json`（增加 backend.referenceArtifacts、docs.categories）
  - 更新 `scripts/harness-doctor.mjs`（增加 referenceArtifacts 检查）
  - 更新 `.harness/wiki/harness-inventory.md`（补充 agent_design、runtime_prompts 条目）
- 验证：`node scripts/harness-doctor.mjs`（0 errors）

## 背景

`backend/agent_design/`（100+ AGENTS.md）和 `backend/runtime_prompts/`（71 个角色目录）
未被任何 harness 清单追踪，doctor 脚本无法感知；`docs/` 下 30+ API 审计文件无结构分类；
后端 harness 命名混用 kebab-case 与 snake_case 无文档说明。本变更通过新增索引、规范文档、
更新清单和检查脚本统一覆盖以上四个问题。
