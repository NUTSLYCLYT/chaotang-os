# 规格说明：fix-courtos-brain-boundary-scope-20260713

## 背景

用户要求把独立的个人知识库 `~/CourtOS-Brain`（自有 git 仓库，28 个 commit，含 `super-brain-obsidian-watch.service` 后台同步）通过 `git subtree add` 合并进本仓库 `courtos-brain/`，历史以 subtree merge 的第二 parent 形式保留。

迁移带来 `courtos-brain/AGENTS.md`，使仓库内出现第 4 个 `AGENTS.md` 文件（根 / `frontend/` / `backend/` 之外）。第一次修复尝试把 `courtos-brain` 当作第 4 条"主线"正式注册进 `.harness/manifest/project-harness.json`、`.harness/rules/project-boundaries.md` 表格和 `scripts/harness-doctor.mjs`，但这违反了 `AGENTS.md:38` 与 `.harness/wiki/architecture.md:43` 已写死的硬约束："所有 agent 工作入口必须落在 `frontend/`、`backend/` 和根 `.harness/` 三层结构内"，且没有留下强制变更记录。Codex stop-time review 两次拦截：第一次指出未注册的第四入口，第二次指出"注册为第四主线"本身违反三层约束、且缺变更记录。

## 范围

- 撤销"第 4 主线"注册：从 `project-harness.json` 移除 `courtosBrain` 模块，从 `project-boundaries.md` 的主线表移除对应行，从 `harness-doctor.mjs` 移除对应校验循环。
- 把 `courtos-brain/AGENTS.md` 改名为 `courtos-brain/VAULT-GUIDE.md`，使其不再是会被 agent 工具自动发现的"AGENTS.md"入口，内容不变。
- 在 `.harness/wiki/architecture.md` 加一行说明：`courtos-brain/` 是迁移进来的个人知识归档，明确不构成第四层入口，不出现在事实源列表或 doctor 校验里。
- 在 `.harness/rules/project-boundaries.md` 用一段说明文字（非表格行）记录 `courtos-brain/` 的定位和排除理由。
- 补齐本次变更的强制记录（本目录）。

## 非目标

- 不改动 `courtos-brain/` 内部内容（`_wiki/`、`00-Inbox/` 等），只改治理文件名和外部引用它的方式。
- 不新增第四条主线，也不把 `courtos-brain/` 挪进 `frontend/`、`backend/` 或 `.harness/` 内部。
- 不涉及 `super-brain-obsidian-watch.service`、Obsidian vault 注册表（已在迁移会话中处理，路径已指向 `courtos-brain/`，本次不再变动）。

## 验收标准

- 仓库内 `AGENTS.md` 文件数量回到 3 个（根 / `frontend` / `backend`），`courtos-brain/` 下不再有 `AGENTS.md`。
- `project-harness.json` 不含 `courtosBrain` 模块；`project-boundaries.md` 主线表仍只有 3 行。
- `node scripts/harness-doctor.mjs` 0 errors。
- 存在本目录下的完整变更记录（summary / spec / tasks / ci_result）。

## 验证计划

- `node scripts/harness-doctor.mjs`
- `find . -maxdepth 3 -iname AGENTS.md`（确认仅 3 个）
- 人工检查 `project-boundaries.md`、`architecture.md`、`project-harness.json` diff
