# CI 摘要：fix-courtos-brain-boundary-scope-20260713

## 命令

- `node scripts/harness-doctor.mjs`
- `find . -maxdepth 3 -iname AGENTS.md`
- `grep -rn "courtosBrain" .harness/manifest/project-harness.json scripts/harness-doctor.mjs`
- `grep -c "^| " .harness/rules/project-boundaries.md`

## 结果

- `harness-doctor`：`project-harness-doctor: 0 errors, 0 warning(s)`（含委托的 frontend / backend doctor 均绿）。
- `AGENTS.md` 数量：3 个（`./AGENTS.md`、`./frontend/AGENTS.md`、`./backend/AGENTS.md`），`courtos-brain/` 下确认已不存在。
- `courtosBrain` 关键字在 manifest 与 doctor 脚本中均无残留匹配。
- `project-boundaries.md` 主线表：1 表头 + 1 分隔行 + 3 数据行 = 5 行，确认未新增第 4 主线数据行。

## 补充（任务 4）

- `find courtos-brain -iname AGENTS.md -o -iname CLAUDE.md -o -ipath "*/.agents/*" -o -ipath "*/.claude/commands/*"`：无匹配，确认 `.agents/` 已完全改名，`.claude/` 目录本身为空。
- `find courtos-brain/vault-workflows -type f`：`SKILL.md`、`agents/openai.yaml`、`references/vault-map.md` 三个文件内容原样保留，仅路径改变。
- 复跑 `node scripts/harness-doctor.mjs` 仍为 0 errors（对本次改动范围而言；同一时刻仓库内另有与 controlPlane rollout-history 网关相关的 2 个 error，经 `git diff --stat` 确认属并发的另一条改动线，未涉及本次改动的任何文件，不在本变更验收范围内）。

## 补充（任务 5，第三轮拦截后的最终校验）

- `find courtos-brain -type d \( -name '.agents' -o -name 'agents' -o -name 'skills' -o -name 'commands' -o -name '.claude' \)`：**无匹配**（此前任务 4 遗漏了未加点前缀的 `agents/`、`skills/` 内层目录，本轮已清除）。
- `find courtos-brain -iname 'AGENTS.md' -o -iname 'CLAUDE.md' -o -iname 'SKILL.md'`：命中 4 个，均为知识库内容笔记而非治理文件——`_wiki/sources/agents.md`（frontmatter 是 `name/type/source_kind/schema_version`，记录"AGENTS.md 这份原始文件"的证据摘要）、`_wiki/concepts/claude.md`、`_wiki/entities/model/claude.md`、`_wiki/entities/tool/claude.md`（frontmatter 是 `name/type/status`，是关于 Claude 这个概念/实体的知识笔记）。均不含 `name:` + `description:` 的 Skill 触发格式，也不在任何被 agent 工具扫描的目录约定下，判定为惰性内容，不处理。
- `node scripts/harness-doctor.mjs`：`0 errors, 0 warning(s)`。
- `find courtos-brain/vault-workflows -type f`：`grow-courtos-knowledge-notes/workflow-reference.md`、`grow-courtos-knowledge-notes/provider-configs/openai-interface.yaml`、`grow-courtos-knowledge-notes/references/vault-map.md`，三个文件内容原样保留。

## 补充（任务 6，第四轮拦截：规则文本本身的验收命令没对上现实）

- 问题复现：`project-boundaries.md` 里任务 5 写的"校验方法"断言 `find courtos-brain -iname 'AGENTS.md' -o -iname 'CLAUDE.md' -o -iname 'SKILL.md'` 必须无匹配，但任务 5 自己的 CI 记录（上面那条）已经如实写出这条命令命中 4 个 `_wiki/` 笔记——规则文本和已知事实互相矛盾，按规则文本原样执行就是失败。
- 修复：规则文本改为两条独立命令，治理文件名检查加 `| grep -v '^courtos-brain/_wiki/'`。
- 复跑结果（按 `project-boundaries.md` 最新文本原样执行）：
  - `find courtos-brain -type d \( -name '.agents' -o -name 'agents' -o -name 'skills' -o -name 'commands' -o -name '.claude' \)` → 空，exit 0。
  - `find courtos-brain -iname 'AGENTS.md' -o -iname 'CLAUDE.md' -o -iname 'SKILL.md' | grep -v '^courtos-brain/_wiki/'` → 空，exit 1（grep 无匹配行的正常退出码，符合预期）。
  - `node scripts/harness-doctor.mjs` → `0 errors, 0 warning(s)`。

## 补充（任务 7，第五轮拦截：路径豁免本身是盲区）

- 把 `.harness/rules/project-boundaries.md` 里手写的 `find ... | grep -v '^courtos-brain/_wiki/'` 白名单，换成 `scripts/harness-doctor.mjs` 里新增的 `courtos-brain boundary scan`（递归扫描全部 `courtos-brain/`，目录段检查零例外，治理文件名检查按 frontmatter 形状判断，不看路径）。
- 正常状态验证：`node scripts/harness-doctor.mjs` 输出对已有 4 个 `_wiki/` 笔记逐个给出 `[ok] courtos-brain boundary: content note, not governance: <path>`，总计 `0 errors, 0 warning(s)`。
- 阳性验证（证明盲区真的被堵住）：临时在 `courtos-brain/_wiki/sources/CLAUDE.md` 写入带 `description:` 字段的伪造 Skill frontmatter（模拟"知识生长流程未来往 `_wiki/` 写入一份真的活配置"的场景）→ 复跑 `node scripts/harness-doctor.mjs` 输出 `[error] courtos-brain boundary: courtos-brain/_wiki/sources/CLAUDE.md matches a governance filename without the recognized inert content-note shape ...`，`1 error(s)`。删除该临时文件后复跑，回到 `0 errors, 0 warning(s)`。旧的路径豁免规则在这个场景下会直接放行，不会报错——这就是"盲区"的具体样子，新检查证明能堵住。

## 补充（任务 8，第六轮拦截：frontmatter 判断这个前提本身站不住）

- 问题：任务 7 的判断逻辑允许"带 `type:`、不带 `description:`"的 `CLAUDE.md`/`AGENTS.md` 通过。但真实的发现约定不看 frontmatter——文件名精确匹配就会被读成指令。判断逻辑本身在保护一个不存在的安全边界。
- 修复：`scripts/harness-doctor.mjs` 的 `scanCourtosBrainBoundary` 删掉读取/解析 frontmatter 的代码，治理文件名检查改成 `governanceFilenames.has(item.name)`（`Set` 里是精确大小写的 `'AGENTS.md'`、`'CLAUDE.md'`、`'SKILL.md'`，`Set.has` 本身大小写敏感），命中即报错，无豁免分支。
- 验证（真实执行，非推演）：
  1. 正常状态：`node scripts/harness-doctor.mjs` → `[ok] courtos-brain boundary scan complete`，`0 errors, 0 warning(s)`；输出里不再逐条提及 `_wiki/` 下那 4 个小写笔记（它们从不匹配 `Set`，不再需要单独判断）。
  2. 阳性验证（专门针对"上一轮会放行"的那种 frontmatter 形状）：在 `courtos-brain/_wiki/sources/CLAUDE.md`（精确大小写）写入 `type: source` / `schema_version: 1`、**不带** `description:` 的内容——这正是任务 7 判定"惰性、放行"的形状 → 复跑 `node scripts/harness-doctor.mjs` 输出 `[error] courtos-brain boundary: reserved governance filename found: courtos-brain/_wiki/sources/CLAUDE.md — agent tooling reads AGENTS.md/CLAUDE.md/SKILL.md by exact filename regardless of content, so no frontmatter can make this inert; rename it`，`1 error(s)`。删除临时文件后复跑，回到 `0 errors, 0 warning(s)`。

## 补充（任务 9，第七轮拦截：符号链接绕过目录段/文件名检查）

- 问题：`readdir(..., {withFileTypes:true})` 返回的 dirent 对符号链接恒为 `isDirectory() === false`（dirent 类型是 `DT_LNK`，不看链接指向什么）。一个名叫 `agents` 的符号链接会跳过 `if (item.isDirectory())` 整段逻辑——既不命中"forbidden agent-discovery directory"，也不会被递归扫描。
- 修复：在目录判断之前加 `if (item.isSymbolicLink()) { error(...); continue; }`，无条件拒绝，不解析链接目标。
- 阳性验证（真实复现旧检查会漏掉的场景，非推演）：
  1. 在仓库外建 `/tmp/evil-agents-target/skills/x/SKILL.md`，写入带 `description:` 的真 Skill frontmatter。
  2. 在 `courtos-brain/vault-workflows/` 下建符号链接 `agents -> /tmp/evil-agents-target`。
  3. 用任务 8 之前的检查逻辑推演：`agents` 是符号链接，`isDirectory()` 为 false，既不进目录段检查分支也不递归，`governanceFilenames.has('agents')` 也是 false（"agents" 不在文件名集合里）——完全不报错，链接指向的活 Skill 树全程未被扫描到。
  4. 用修复后的代码实测：`node scripts/harness-doctor.mjs` 输出 `[error] courtos-brain boundary: symlink found (forbidden — could point at a live agent/skill tree): courtos-brain/vault-workflows/agents`，`1 error(s)`。
  5. 删除符号链接和 `/tmp/evil-agents-target` 后复跑，回到 `0 errors, 0 warning(s)`。

## 补充（任务 10，第八轮拦截：`.git` 豁免是另一个独立盲区）

- 确认前置事实：`find courtos-brain -maxdepth 1 -name .git` → 空，`courtos-brain/` 当前没有嵌套 `.git` 目录（`git subtree add` 不会带来 `.git`）。
- 问题：`scanCourtosBrainBoundary` 里 `if (item.name === '.git') continue;` 让整个 `.git/` 子树完全不被递归，不管符号链接检查还是目录段/文件名检查都从没机会看到里面的内容。
- 修复：删掉这一行豁免；`.git`（如果出现）像任何其他目录一样被递归扫描。
- 阳性验证（真实复现，用普通 `rm`/`rmdir` 清理——本机 hook 拦截 `rm -rf`）：
  1. `mkdir -p courtos-brain/.git/agents` + 在其中放一个文件，模拟"藏进未扫描的 `.git/` 里的违规目录"。
  2. 旧逻辑推演：命中 `.git` 豁免直接 `continue`，`agents` 目录连递归都不会被走到，不会报错。
  3. 修复后实测：`node scripts/harness-doctor.mjs` → `[error] courtos-brain boundary: forbidden agent-discovery directory: courtos-brain/.git/agents`，`1 error(s)`。
  4. `git status --short -- courtos-brain/.git` 全程输出为空，确认测试用的假 `.git` 目录从未被 git 追踪、未污染仓库状态。
  5. 用 `rm` 删文件、`rmdir` 逐层删目录（不用 `rm -rf`）清理干净，复跑 `node scripts/harness-doctor.mjs` → `0 errors, 0 warning(s)`。
