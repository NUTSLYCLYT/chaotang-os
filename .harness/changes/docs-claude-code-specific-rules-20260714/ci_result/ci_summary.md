# CI 摘要：docs-claude-code-specific-rules-20260714

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `git status --short -- AGENTS.md`（编辑前） | 0（空输出） | 干净，无并行session冲突 | 编辑前安全性确认 | 本会话实测 |
| `node scripts/harness-doctor.mjs` | 0 | `0 errors, 0 warning(s)` | 根级护栏一致性 | 本会话实测 |
| `git diff --stat -- AGENTS.md` | 0 | `1 file changed, 8 insertions(+)` | 确认本次改动范围仅为8行新增，无删除、无其他文件 | 本会话实测 |
| `git revert --no-commit 8dee499`（不按时间倒序，验证性操作，第一次实验） | 1 | 3处`CONFLICT (modify/delete)`（本目录`ci_summary.md`/`spec.md`/`tasks.md`——这三个文件被`f09dae3`改过） | 证实"单独revert 8dee499不准确" | 本会话实测于HEAD=ecedac9之前；`git revert --abort`已完整撤销 |
| `git revert --no-commit f09dae3 && git revert --no-commit 8dee499`（按时间倒序，第一次实验） | 0（当时两步均） | 当时`git status --short`显示4个文件标记删除+`AGENTS.md`标记修改，无冲突 | 一度验证"倒序revert"可行 | 本会话实测于HEAD=ecedac9之前；`git revert --abort`已完整撤销 |
| `git revert --no-commit f09dae3 && git revert --no-commit 8dee499`（同一条命令，第二次实测，本轮HEAD已推进到0b74711之后） | 1 | **CONFLICT (content)**——`ci_summary.md`/`spec.md`/`tasks.md`三个文件全部冲突，与第一次实验的"无冲突"结果矛盾 | **关键证据**：证明"倒序revert"这条此前被记录为"已验证通过"的方法，在后续`ecedac9`/`0b74711`两次提交落地后已经失效——commit-hash式回滚指令的验证结果本身也会随本文件被继续编辑而过期，不是验证一次就能一直当作证据用 | 本会话实测；`git revert --abort`已完整撤销 |

## 结果

`AGENTS.md`"不可绕过"条款之后新增"## Claude Code specific rules"一节，收录用户提供的5条操作规则原文。纯文档新增，不修改任何既有条款，不涉及代码或运行时逻辑。

## 未验证项

- 这5条规则本身的执行效果（如"复杂任务"的判定边界、子代理调研的实际触发时机）未在本次验证——规则文本已落地，实际遵循效果留待后续任务执行时体现。

## Diff 与回滚复核

- changed files：涉及 `AGENTS.md` + 本变更记录目录4个文件（`summary.md`/`ci_result/ci_summary.md`/`request_analysis/spec.md`/`request_analysis/tasks.md`）。累积行数**不写具体数字**——用 `git diff --stat 8dee499^ -- AGENTS.md .harness/changes/docs-claude-code-specific-rules-20260714/` 现查即可。**教训**：上一版这里写过"5 files changed, 187 insertions(+)"这个具体数字，但那次订正本身就是一次新提交，落地那一刻这个数字就已经不准了——跟前面"回滚指令绑定commit hash会过期"是同一类错误，只是把"绑定commit hash"换成了"绑定某一时刻的行数统计"，本质没变。只要这份变更记录还会被继续编辑，任何写死在文档里的具体数字（不只是commit hash）都不可靠，只有"命令本身"（`8dee499^`是固定锚点）是稳定的。
- diff review：`git diff --stat 8dee499^ -- ...` 确认累积改动范围，人工通读确认新增章节独立成段、不与既有"不可绕过"条款交叉引用出错
- 回滚是否演练：已用`git revert --no-commit`演练过（见命令表）。**重要教训**：倒序revert（`f09dae3`再`8dee499`）第一次实测（HEAD=ecedac9之前）无冲突，但同一条命令在`ecedac9`/`0b74711`两次提交落地后**再次实测就冲突了**——这证明连"已经实测验证过"这句话本身，只要证据对象是具体commit hash而不是文件状态，也会随后续编辑过期，不能一次验证就当永久证据用。这是本变更记录第三次遇到"commit-hash式回滚描述结构性失效"的问题（前两次是描述本身错，这次是曾经正确的验证结果本身也过期了）。最终采用不引用任何commit hash的状态描述：从`AGENTS.md`移除"## Claude Code specific rules"整节 + 删除本变更记录整个目录——这句话不依赖任何提交历史，本质上是比较"有这个变更"和"没有这个变更"两个状态的文件差异，因此不会因本文件被继续编辑而过期。风险仍然极低（纯文本+文档，无数据、无运行时状态）。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| `harness-doctor.mjs` 0 errors | 命令表第2行 | 已达成 |
| 新增内容与既有条款无冲突 | 人工通读 | 已达成 |
| 变更记录四文件填写完整 | 本文件即为其一，另三份已同步填写 | 已达成 |
| 回滚描述、changed files 统计均不含会随本文件后续编辑而过期的写死内容 | `AGENTS.md`/本目录4个文件人工核对：回滚描述已改为状态描述（不引用commit hash）；changed files 已改为"给命令、不写死数字" | 已达成——回滚描述经历"checkout AGENTS.md"→"revert 8dee499"→"倒序revert（验证通过但后来又冲突）"→状态描述四版；changed files 经历"只讲8dee499"→"改成累积但写死187 insertions"→"给命令不写数字"三版。两条线的根因相同：只要这份文档还会被继续编辑，任何写死的具体值（不管是commit hash 还是行数统计）都会在下一次编辑时过期，唯一稳定的做法是只记录可复现的检验方法，不断言某个具体数值是"当前事实" |

## 声明状态

- `VERIFIED_COMPLETE`：本次声明范围（`AGENTS.md`新增5条规则 + 不依赖提交历史或行数快照的验证/回滚描述）已验证完整，无遗留空模板，无遗留矛盾或不准确表述。这份变更记录本身在"如何描述会变化的东西"上栽了两次同一类跟头：先是回滚指令绑定具体 commit hash（三版都被后续提交推翻），后是"changed files"绑定具体行数（写下"187 insertions"的那次提交本身就让它过期）。两者的共同教训——本文档在被反复编辑的过程中，不应该断言任何"当前是多少"的具体数值，只应该记录"如何查当前是多少"的可复现命令。此后若还要再编辑本变更记录，只要不违反这条原则（不写死数字/commit hash，只写命令），就不会再重蹈覆辙。
