# 任务：fix-courtos-brain-boundary-scope-20260713

## 任务 1

- 目标：撤销 `courtos-brain` 作为第 4 主线在 manifest / boundary 表 / doctor 里的注册
- 输入：`.harness/manifest/project-harness.json`、`.harness/rules/project-boundaries.md`、`scripts/harness-doctor.mjs` 的前一版本变更
- 输出：三处均回退到只承认根 / 前端 / 后端三层结构，`project-boundaries.md` 改用说明文字而非表格行记录 `courtos-brain/` 的排除
- 验收：`grep -c courtosBrain .harness/manifest/project-harness.json` 为 0；`node scripts/harness-doctor.mjs` 0 errors

## 任务 2

- 目标：让 `courtos-brain/` 不再是可被 agent 工具自动发现的入口
- 输入：`courtos-brain/AGENTS.md`
- 输出：`git mv` 为 `courtos-brain/VAULT-GUIDE.md`，内容不变
- 验收：`find . -maxdepth 3 -iname AGENTS.md` 只列出 3 个文件

## 任务 3

- 目标：在根级架构文档留下"为什么 `courtos-brain/` 存在但不是入口"的可追溯说明
- 输入：`.harness/wiki/architecture.md` 当前事实源清单
- 输出：追加一行说明并指向 `project-boundaries.md` 的详细定位
- 验收：人工检查该行存在且指向正确

## 任务 4（补充：Codex stop-time review 二次拦截）

- 目标：`courtos-brain/.agents/skills/grow-courtos-knowledge/` 仍是可被 agent 工具自动发现的活技能（`SKILL.md` 带 Claude Skill 格式 frontmatter，`agents/openai.yaml` 带 Codex `default_prompt`），与"不是 agent 工作入口"的边界声明矛盾
- 输入：`courtos-brain/.agents/skills/grow-courtos-knowledge/`（`SKILL.md`、`agents/openai.yaml`、`references/vault-map.md`）
- 输出：`git mv` 整个 `.agents/` 目录为 `vault-workflows/`，内容不变，只去掉会被自动发现的目录名约定；同步更新 `VAULT-GUIDE.md` 里的路径引用；`project-boundaries.md` 补充"任何匹配已知 agent/skill 自动发现约定的文件名/路径都必须改名或移出"的通用规则
- 验收：`find courtos-brain -iname AGENTS.md -o -iname CLAUDE.md -o -ipath "*/.agents/*" -o -ipath "*/.claude/commands/*"` 无匹配（`SKILL.md` 文件本身仍存在，但已脱离任何自动发现路径约定）

## 任务 5（补充：Codex stop-time review 三次拦截）

- 目标：任务 4 的验收标准本身有漏洞——只改了最外层 `.agents/` → `vault-workflows/`，但内部仍嵌套着未加点前缀的 `skills/`、`agents/` 目录段和 `SKILL.md` 文件名，这些同样是已知自动发现约定，"零可执行入口"承诺没有兑现
- 输入：`courtos-brain/vault-workflows/skills/grow-courtos-knowledge/`（`SKILL.md`、`agents/openai.yaml`、`references/vault-map.md`）
- 输出：
  - `skills/grow-courtos-knowledge/` → `grow-courtos-knowledge-notes/`（去掉 `skills/` 段）
  - `SKILL.md` → `workflow-reference.md`（去掉保留文件名）
  - `agents/openai.yaml` → `provider-configs/openai-interface.yaml`（去掉 `agents/` 段）
  - 同步更新 `VAULT-GUIDE.md` 路径引用，明确 `$grow-courtos-knowledge` 现在只是历史文档提及，不是可调用命令
  - `project-boundaries.md` 的排除规则改为逐段检查（路径里任意一段命中 `.agents`/`agents`/`skills`/`commands`/`.claude` 都算违规），并给出可直接执行的校验命令
- 验收：`find courtos-brain -type d \( -name '.agents' -o -name 'agents' -o -name 'skills' -o -name 'commands' -o -name '.claude' \)` 与 `find courtos-brain -iname 'AGENTS.md' -o -iname 'CLAUDE.md' -o -iname 'SKILL.md'` 均无匹配；`node scripts/harness-doctor.mjs` 0 errors

## 任务 6（补充：Codex stop-time review 四次拦截）

- 目标：任务 5 写进 `project-boundaries.md` 的"校验方法"本身断言"两条命令都必须无匹配"，但第二条命令（治理文件名检查）在当前仓库上直接返回 4 个匹配——`_wiki/sources/agents.md`、`_wiki/concepts/claude.md`、`_wiki/entities/model/claude.md`、`_wiki/entities/tool/claude.md`。这些是知识库内容笔记（frontmatter 是 `name/type/schema_version`，不是 Skill 触发用的 `name/description`），不是治理文件，本来就不该被这条规则命中；问题是规则文本没有排除它们，导致"新增验收规则在当前仓库中立即失败"
- 输入：`.harness/rules/project-boundaries.md` 里任务 5 新增的"校验方法"段落
- 输出：把治理文件名检查改成 `find courtos-brain -iname 'AGENTS.md' -o -iname 'CLAUDE.md' -o -iname 'SKILL.md' | grep -v '^courtos-brain/_wiki/'`，显式排除 `_wiki/` 知识内容树，并写明排除理由（frontmatter 形状不同、改名会破坏证据完整性）；目录段检查（第 1 条命令）保持不变，因为它本来就是空匹配
- 验收：两条命令按 `project-boundaries.md` 最新文本原样执行，均返回空；`node scripts/harness-doctor.mjs` 0 errors

## 任务 7（补充：Codex stop-time review 五次拦截）

- 目标：任务 6 的"排除 `_wiki/`"修复本身是新的盲区——豁免是按路径给的，不是按内容给的，而 `courtos-brain` 自己的知识生长流程会持续往 `_wiki/` 写新文件；只要豁免路径不变，以后写进 `_wiki/` 的任何东西（哪怕真的是一份活的 Skill 定义）都会被这条规则无条件放过
- 输入：`.harness/rules/project-boundaries.md` 里任务 6 新增的路径排除写法；`scripts/harness-doctor.mjs`
- 输出：把手动 `find` 校验方法换成 `scripts/harness-doctor.mjs` 里的自动化检查——新增 `courtos-brain boundary scan`：递归扫描 `courtos-brain/`，目录段检查保持全树无例外；治理文件名检查改成按 frontmatter 形状判断（有 `description:` 判违规，有 `type:` 且无 `description:` 判惰性内容），不再豁免任何路径。`project-boundaries.md` 改为指向这个自动化检查，删除手写 `find` 白名单
- 验收：
  1. 正常状态下 `node scripts/harness-doctor.mjs` 对已有 4 个 `_wiki/` 笔记全部判定为 `[ok] ... content note, not governance`，0 errors。
  2. 往 `courtos-brain/_wiki/sources/CLAUDE.md` 临时写入带 `description:` 字段的伪造 Skill frontmatter，`node scripts/harness-doctor.mjs` 必须报 `[error] courtos-brain boundary: ...`；删除该临时文件后复跑必须回到 0 errors（已实测两种状态，见 ci_summary）。

## 任务 8（补充：Codex stop-time review 六次拦截）

- 目标：任务 7 的"按 frontmatter 形状判断"这个前提本身错了——`AGENTS.md`/`CLAUDE.md` 的发现约定是按精确文件名触发，遵守约定的工具读到这个文件名就把内容当指令处理，不会先看 frontmatter 里有没有 `description:` 才决定要不要读。给一个 `description:` 换成 `type:` 就能让 `CLAUDE.md` "变安全"，这个假设本身就不成立
- 输入：`scripts/harness-doctor.mjs` 里 `scanCourtosBrainBoundary` 的 frontmatter 判断逻辑；`.harness/rules/project-boundaries.md` 对应说明
- 输出：删掉 frontmatter 读取/判断，治理文件名检查改成无条件、精确大小写匹配 `AGENTS.md`/`CLAUDE.md`/`SKILL.md`——命中就报错，不再有"惰性内容"这个豁免分支。同时把匹配从大小写不敏感改成大小写敏感，这样 `courtos-brain/` 自己知识库里那 4 个小写同名笔记（`agents.md`、`claude.md` ×3）天然就不在检查范围内，不需要任何专门为它们写的例外逻辑
- 验收：
  1. 正常状态 `node scripts/harness-doctor.mjs` 输出里不再逐一提及那 4 个 `_wiki/` 笔记（因为它们从不匹配这条规则），`courtos-brain boundary scan complete`，0 errors。
  2. 往 `courtos-brain/_wiki/sources/CLAUDE.md`（精确大小写）写入**带 `type:`/`schema_version:`、不带 `description:`** 的内容笔记形状 frontmatter——即上一轮会被判定"惰性、放行"的那种形状——复跑必须报错，证明新规则不再被 frontmatter 形状绕过。删除临时文件后复跑必须回到 0 errors（已实测，见 ci_summary）。

## 任务 9（补充：Codex stop-time review 七次拦截）

- 目标：任务 8 的目录段检查和治理文件名检查都靠 `readdir(..., {withFileTypes:true})` 返回的 dirent 类型判断"是不是目录"，但符号链接的 dirent 类型是 `DT_LNK`，`item.isDirectory()` 对符号链接恒为 `false`（不管链接指向什么）。一个名叫 `agents`/`skills`/`.agents`/`commands`/`.claude` 的符号链接会跳过 `if (item.isDirectory())` 整个分支，既不触发目录段检查，也不会被递归扫描——链接指向的任何内容（哪怕是一整棵真实的 Skill 目录树）都在扫描盲区之外
- 输入：`scripts/harness-doctor.mjs` 里 `scanCourtosBrainBoundary` 的目录判断顺序
- 输出：在目录判断之前先加 `item.isSymbolicLink()` 检查——命中就报错并 `continue`，不解析链接目标、不递归。`courtos-brain/` 是内容归档，没有使用符号链接的正当理由，直接全面禁止最简单也最不会有后续遗漏。`project-boundaries.md` 加"校验方法 0"说明为什么这条必须排在目录段检查和文件名检查之前
- 验收：
  1. 正常状态（无符号链接）：`node scripts/harness-doctor.mjs` → `0 errors, 0 warning(s)`。
  2. 阳性验证：在 `courtos-brain/vault-workflows/` 下建一个名叫 `agents` 的符号链接，指向仓库外一个真实存在 `skills/x/SKILL.md`（带 `description:`）的目录——这是任务 8 的检查会完全漏掉的场景（`isDirectory()` 为 false，不会报"forbidden agent-discovery directory"，也不会递归进去看到里面的 `SKILL.md`）→ 复跑必须报 `[error] courtos-brain boundary: symlink found ...`。删除符号链接和临时目标目录后复跑必须回到 0 errors（已实测，见 ci_summary）。

## 任务 10（补充：Codex stop-time review 八次拦截）

- 目标：任务 9 加的符号链接检查排在 `if (item.isDirectory())` 分支内部的 `if (item.name === '.git') continue;` 之后才生效吗？不是——顺序上符号链接检查确实排最前面，但 `.git` 豁免本身是另一个独立盲区：只要目录名是 `.git`，`scanCourtosBrainBoundary` 直接 `continue`，完全不递归进去。这意味着丢进 `.git/` 内部的任何东西——符号链接、`agents`/`skills` 目录、甚至一整个嵌套 git 仓库——从来没有机会被任何一条检查看到，因为压根没扫描到那一层
- 输入：`scripts/harness-doctor.mjs` 里 `scanCourtosBrainBoundary` 中 `if (item.name === '.git') continue;` 这一行
- 输出：删掉这行豁免。`courtos-brain/` 本身不是嵌套 git 仓库（`git subtree add` 不会带来 `.git`，实测 `find courtos-brain -maxdepth 1 -name .git` 为空），所以这条豁免本来就没有正当理由存在；删掉后 `.git`（如果真的出现）会被当成普通目录递归扫描，跟其他目录一视同仁
- 验收：
  1. 正常状态：`find courtos-brain -maxdepth 1 -name .git` 为空，`node scripts/harness-doctor.mjs` → `0 errors, 0 warning(s)`。
  2. 阳性验证（真实复现旧豁免会漏掉的场景）：在 `courtos-brain/.git/agents/` 下放一个文件（模拟"藏进 `.git/` 里的违规目录"），用任务 9 之前的逻辑推演——`.git` 命中豁免，`continue`，永远不会递归进去看到里面的 `agents/`——完全不报错。用修复后的代码实测：`node scripts/harness-doctor.mjs` 报 `[error] courtos-brain boundary: forbidden agent-discovery directory: courtos-brain/.git/agents`，`1 error(s)`。用普通 `rm`/`rmdir`（不用 `rm -rf`，本机有钩子拦截）删除测试文件和目录，且全程未被 git 追踪（`git status --short -- courtos-brain/.git` 输出为空，证明测试没有污染仓库状态）。删除后复跑回到 `0 errors, 0 warning(s)`。
