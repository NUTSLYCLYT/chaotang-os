# 规则：项目边界

## 主线

| 主线 | 路径 | 拥有 | 不拥有 |
| --- | --- | --- | --- |
| 前端 | `frontend/` | Next.js UI、浏览器工作流、前端契约、视觉/发布门禁 | 后端蜂群执行、prompt、provider、生产数据库逻辑 |
| 后端 | `backend/` | 蜂群执行、运行时 prompt、flow engine、provider 路由、后端 harness | 浏览器 UI、Next.js 构建产物、前端发布页面 |
| 根项目 | `.harness/`、`docs/` | 跨线协调、架构清单、所有权边界 | 运行时业务逻辑 |

根级 `.claude/`（`agents/`、`skills/`、`hooks/`）是 Claude Code 这个开发工具本身的配置层，**不是第四条内容主线**，不违反 `AGENTS.md:38`"所有 agent 工作入口必须落在 frontend/backend/根 harness 三层结构内"这条约束。区别在于：`AGENTS.md:38` 管的是"内容/所有权主线"——像 `courtos-brain/` 差点变成的那种，自己一整棵业务/知识内容树，要求单独的事实源和 harness 验证。`.claude/` 不持有业务逻辑、不持有运行时状态、不产出需要独立验证的"事实"；它定义的 agent（如 `gongbu-quality-gate`）实际检查的对象——`frontend/src/features/...`、`backend/src/...`——完全落在三层结构内，`.claude/` 只是"怎么调这个 agent"的配置，不是"这个 agent 在哪工作"。7 个既有 `gongbu-*` agents 与 `chaotang-build-office` 等 skills 均遵循此约定，见根 `CLAUDE.md`"Claude Code 配置"一节。

`courtos-brain/` 是等待安全独立化的历史 subtree，**不是 agent 工作入口，不构成第四主线**，不纳入三层 harness 验证，也不出现在 `.harness/manifest/project-harness.json` 的模块表里。生产代码不得默认依赖该仓内路径；独立远端、克隆恢复、内容对账和依赖解除全部完成前也不得直接删除。完整门禁见 `.harness/wiki/courtos-brain-extraction.md`。为保证暂留期间的边界在文件系统层面成立（而不只是文档声明）：

- 没有 `AGENTS.md` / `CLAUDE.md`（治理说明见 `courtos-brain/VAULT-GUIDE.md`）。
- 没有任何名为 `.agents/`、`agents/`、`skills/`、`commands/`、`.claude/` 的目录，也没有任何名为 `SKILL.md` 的文件，无论嵌套多深。原 `courtos-brain/.agents/skills/grow-courtos-knowledge/`（`SKILL.md` 带 Claude Skill frontmatter，`agents/openai.yaml` 带 Codex `default_prompt`，两层路径都会被对应工具按约定名自动发现）已整体改名为 `courtos-brain/vault-workflows/grow-courtos-knowledge-notes/`：`SKILL.md` → `workflow-reference.md`，`agents/openai.yaml` → `provider-configs/openai-interface.yaml`。内容原样保留，只消除路径上的约定名。

**校验方法**：自动化，跑 `node scripts/harness-doctor.mjs`（`courtos-brain boundary scan` 部分）。不用手动 `find` 命令，也不看文件内容：

0. 符号链接检查：全 `courtos-brain/` 递归扫描，任何符号链接（不管指向文件还是目录、指向仓库内还是仓库外）一律报错。这条排在最前面，因为下面两条都靠 `readdir` 的 dirent 类型判断"是不是目录"，而符号链接本身的 dirent 类型是 `DT_LNK`，不是 `DT_DIR`——一个名叫 `agents` 的符号链接会让 `isDirectory()` 返回 false，直接跳过目录段检查和递归，把链接指向的任何内容都藏在扫描盲区里。内容归档不需要符号链接，直接全面禁止，不去解析链接目标。
1. 目录段检查：全 `courtos-brain/` 递归扫描（真实目录，非符号链接），任何目录名命中 `.agents`、`agents`、`skills`、`commands`、`.claude` 一律报错，没有路径例外。**没有 `.git` 豁免**：`courtos-brain/` 是普通 subtree merge 进来的目录树，不是嵌套 git 仓库，没有理由存在 `.git/`；早期版本跳过了 `.git` 目录不递归（图省事，避免扫 git 内部对象），这本身就是盲区——任何丢进未被扫描的 `.git/` 里的东西（嵌套仓库、符号链接、伪装的 agents 目录）都会被无条件放过。真出现 `.git/` 就按普通目录一样扫描，不特殊对待。
2. 治理文件名检查：任何位置只要文件名**精确匹配大小写**的 `AGENTS.md`、`CLAUDE.md`、`SKILL.md`，一律报错，不读 frontmatter，也没有路径例外。

第 2 条曾经试过按 frontmatter 形状判断（带 `description:` 才算违规，带 `type:` 就放行）——这个前提本身是错的：`AGENTS.md`/`CLAUDE.md` 的发现约定是按精确文件名触发的，遵守约定的工具读到这个文件名就会把内容当指令读，不管里面写了什么 frontmatter；没有任何 frontmatter 形状能让一个叫 `AGENTS.md`/`CLAUDE.md`/`SKILL.md` 的文件变"安全"。所以现在是无条件按精确文件名匹配（大小写敏感）。这不会误伤 `courtos-brain/` 自己知识库里那些同名但小写的内容笔记（`_wiki/sources/agents.md`、`_wiki/concepts/claude.md` 等）——真正被约定盯上的是精确大小写的 `AGENTS.md`/`CLAUDE.md`/`SKILL.md`，小写版本本来就不在任何工具的发现规则里，区分两者不需要猜内容，只需要精确比较文件名。

新增/迁移到 `courtos-brain/` 下的任何内容，只要目录名命中上述名单，或文件名精确匹配治理文件名，`node scripts/harness-doctor.mjs` 就会直接报错。

## Harness 术语

- 根 `.harness/`：整个项目的工程操作系统。
- `frontend/.harness/`：前端线的工程操作系统。
- `backend/harness/`：后端运行/评测 harness 包。

不要把一个层级的证据拿去证明另一个层级，除非契约明确说明证据如何跨边界传递。

## 证据规则

- 前端声明需要浏览器、构建或类型检查证据。
- 后端蜂群声明需要 harness、测试或 golden case 证据。
- 跨项目架构声明需要根 doctor 与清单证据。
- 用户可见的运行时事实必须保持 LIVE / MIXED / DEMO 边界清楚。

## 大殿冻结边界

- `/dadian` 大殿页面体验已经定稿，默认不得再改动页面结构、布局、滚动行为、底部栏、丞相今日要务展示规则或状态文案。
- 大殿后端事实源已经定稿，默认不得再改动 `backend/web/routers/dadian.py` 暴露的 `/api/court/dadian/*`、`/api/court/chancellor-advice`、`/api/court/decision-judgment` 合约。
- 后续任务如未明确点名“大殿”或“dadian 后端接口”，应避开 `frontend/src/features/dadian/`、`frontend/src/app/(dashboard)/dadian/`、`backend/web/routers/dadian.py` 与对应测试。
- 若用户明确要求修改大殿，必须先说明会触碰冻结边界，并在 `.harness/changes/` 更新变更记录，写明原因、事实源和验证命令。
