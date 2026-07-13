# 变更摘要：fix-courtos-brain-boundary-scope-20260713

| 字段 | 值 |
| --- | --- |
| Change ID | fix-courtos-brain-boundary-scope-20260713 |
| 类型 | fix |
| 状态 | DONE |
| Owner | Project Agent |
| 创建日期 | 20260713 |

## 范围

- 主线：根项目（跨线协调 / 架构清单 / 所有权边界）
- 文件：
  - `.harness/manifest/project-harness.json`（移除 `courtosBrain` 模块）
  - `.harness/rules/project-boundaries.md`（主线表回到 3 行，改用说明文字记录 `courtos-brain/` 排除）
  - `scripts/harness-doctor.mjs`（移除 `courtosBrain` 校验循环）
  - `.harness/wiki/architecture.md`（追加一行说明）
  - `courtos-brain/AGENTS.md` → `courtos-brain/VAULT-GUIDE.md`（改名，内容不变）
  - `courtos-brain/.agents/` → `courtos-brain/vault-workflows/skills/grow-courtos-knowledge/`（第一轮改名，仅去掉最外层目录，内层仍留有 `skills/`、`agents/`、`SKILL.md`）
  - `courtos-brain/vault-workflows/skills/grow-courtos-knowledge/` → `courtos-brain/vault-workflows/grow-courtos-knowledge-notes/`（第二轮改名，逐段清除：`SKILL.md`→`workflow-reference.md`，`agents/openai.yaml`→`provider-configs/openai-interface.yaml`，去掉 `skills/` 段）
  - `courtos-brain/VAULT-GUIDE.md`（两轮都更新了内部路径引用，最终版本明确"这不是活入口，`$grow-courtos-knowledge` 只是历史文档提及"）
  - `.harness/rules/project-boundaries.md`（第四轮：校验方法拆成两条命令，治理文件名检查排除 `_wiki/`；第五轮：改成指向自动化检查；第六轮：删掉 frontmatter 判断说明，改成精确大小写文件名匹配说明；第七轮：加"校验方法 0"符号链接说明；第八轮：说明删掉 `.git` 豁免）
  - `scripts/harness-doctor.mjs`（第五轮：新增 `courtos-brain boundary scan`，递归扫描 + 按 frontmatter 形状判断；第六轮：删掉 frontmatter 判断，改成无条件精确大小写文件名匹配；第七轮：在目录判断前加符号链接检查；第八轮：删掉 `.git` 目录豁免）
- 验证：`node scripts/harness-doctor.mjs`（含 `courtos-brain boundary scan`）；`find . -maxdepth 3 -iname AGENTS.md`

## 背景

上一会话把独立个人知识库通过 `git subtree add` 迁移进 `courtos-brain/`，带来第 4 个 `AGENTS.md`。Codex stop-time review 八轮拦截，逐步收紧：

1. 首次修复把 `courtos-brain` 注册成第 4 主线，违反 `AGENTS.md:38` / `architecture.md:43` 的三层入口硬约束，且没留变更记录 → 撤销注册，改为排除声明，补齐变更记录。
2. `courtos-brain/.agents/skills/grow-courtos-knowledge/` 仍是可被自动发现的活技能（`SKILL.md` 有 Claude Skill frontmatter，`agents/openai.yaml` 有 Codex `default_prompt`）→ 把最外层 `.agents/` 改名为 `vault-workflows/`。
3. 第 2 轮的改名不彻底：内层 `skills/`、`agents/` 目录段和 `SKILL.md` 文件名原样保留，仍匹配自动发现约定，"零可执行入口"没有真正达成 → 逐段重命名到 `vault-workflows/grow-courtos-knowledge-notes/`，并把排除规则从"顶层目录改名即可"改成"路径任意一段命中约定名单都算违规"。
4. 第 3 轮写进规则文件的"校验方法"断言两条 `find` 命令都必须无匹配，但治理文件名检查在当前仓库上真实返回 4 个匹配（`_wiki/` 下的知识笔记，非治理文件）——新写的验收规则本身立即失败 → 把检查拆成"目录段（全仓库无例外）"与"治理文件名（排除 `_wiki/` 知识内容树）"两条，并写明排除理由。
5. 第 4 轮的"排除 `_wiki/`"仍是盲区——按路径豁免意味着以后写进 `_wiki/` 的任何东西都不再被检查，而这正是 `courtos-brain` 知识生长流程会持续写入的地方 → 把手动 `find` 白名单换成 `scripts/harness-doctor.mjs` 里的自动化 `courtos-brain boundary scan`，按 frontmatter 形状（`description:` 存在即违规，`type:` 存在且无 `description:` 即惰性内容）判断，不看路径。
6. 第 5 轮的"按 frontmatter 形状判断"这个前提本身不成立——`AGENTS.md`/`CLAUDE.md` 的发现约定按精确文件名触发，遵守约定的工具不看 frontmatter 就会把内容当指令读，没有任何 frontmatter 形状能让一个叫这些名字的文件变安全 → 删掉 frontmatter 判断，改成无条件、精确大小写文件名匹配；顺带发现精确大小写匹配天然就不会误伤 `courtos-brain/` 自己那 4 个小写同名笔记，不需要专门为它们写例外。
7. 第 6 轮的目录段检查和文件名检查都靠 `readdir` dirent 的 `isDirectory()` 判断，但符号链接的 dirent 类型是 `DT_LNK`，`isDirectory()` 对符号链接恒为 false——一个叫 `agents`/`skills` 的符号链接会完整跳过目录段检查和递归，链接指向的任何内容（包括真实的活 Skill 目录树）都在扫描盲区外 → 在目录判断之前加一条无条件符号链接检查，命中即报错，不解析链接目标；内容归档没有使用符号链接的正当理由，直接全面禁止。
8. 第 7 轮加的符号链接检查排在最前面没错，但 `if (item.name === '.git') continue;` 是另一个独立盲区——只要目录名是 `.git`，整个分支直接跳过、不递归，藏进 `.git/` 内部的任何东西（符号链接、`agents`/`skills` 目录、嵌套仓库）从来没机会被扫描到，因为压根没走到那一层 → 删掉这条豁免。`courtos-brain/` 本身不是嵌套 git 仓库（`git subtree add` 不带 `.git`，实测确认当前不存在），这条豁免本来就没有正当理由，删掉后 `.git`（如果真出现）跟普通目录一视同仁地被递归扫描。
