# CI 摘要：docs-claude-code-specific-rules-20260714

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `git status --short -- AGENTS.md`（编辑前） | 0（空输出） | 干净，无并行session冲突 | 编辑前安全性确认 | 本会话实测 |
| `node scripts/harness-doctor.mjs` | 0 | `0 errors, 0 warning(s)` | 根级护栏一致性 | 本会话实测 |
| `git diff --stat -- AGENTS.md` | 0 | `1 file changed, 8 insertions(+)` | 确认本次改动范围仅为8行新增，无删除、无其他文件 | 本会话实测 |
| `git revert --no-commit 8dee499`（不按时间倒序，验证性操作） | 1 | 3处`CONFLICT (modify/delete)`（本目录`ci_summary.md`/`spec.md`/`tasks.md`——这三个文件被`f09dae3`改过，`8dee499`的parent里没有这些文件，revert时判定为"被删除"与HEAD版本冲突） | 证实"单独revert 8dee499不准确"这一判断成立 | 本会话实测；`git revert --abort`已完整撤销，未留痕迹 |
| `git revert --no-commit f09dae3 && git revert --no-commit 8dee499`（按时间倒序） | 0（两步均） | `git status --short`显示本目录4个文件标记删除+`AGENTS.md`标记修改，无冲突 | 验证正确的两步倒序revert顺序 | 本会话实测；`git revert --abort`已完整撤销，`git status`/`grep`确认恢复到实验前状态 |

## 结果

`AGENTS.md`"不可绕过"条款之后新增"## Claude Code specific rules"一节，收录用户提供的5条操作规则原文。纯文档新增，不修改任何既有条款，不涉及代码或运行时逻辑。

## 未验证项

- 这5条规则本身的执行效果（如"复杂任务"的判定边界、子代理调研的实际触发时机）未在本次验证——规则文本已落地，实际遵循效果留待后续任务执行时体现。

## Diff 与回滚复核

- changed files：提交 `8dee499` 共5个文件——`AGENTS.md`（8行新增，无删除）+ 本变更记录目录4个文件（`summary.md`/`request_analysis/spec.md`/`request_analysis/tasks.md`/`ci_result/ci_summary.md`，均为新建）
- diff review：`git diff --stat` 确认改动范围精确，人工通读确认新增章节独立成段、不与既有"不可绕过"条款交叉引用出错
- 回滚是否演练：已用`git revert --no-commit`演练过两种顺序（见命令表，一种冲突一种不冲突）。**但基于commit hash的revert指令本身在本变更记录里已经连续失效三次**——`8dee499`→写"checkout AGENTS.md"→被`f09dae3`推翻→写"revert 8dee499"→被`ecedac9`（本轮订正的提交）再次推翻——根因是只要还在编辑本目录文件，任何"revert某commit"的说明都会被承载这次编辑的新提交自身弄失效，这是结构性问题，不是又找错了一次顺序。最终改用不引用任何commit hash的状态描述：从`AGENTS.md`移除"## Claude Code specific rules"整节 + 删除本变更记录整个目录。这个描述不依赖提交历史，不会再因本文件被继续编辑而失效。风险仍然极低（纯文本+文档，无数据、无运行时状态）。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| `harness-doctor.mjs` 0 errors | 命令表第2行 | 已达成 |
| 新增内容与既有条款无冲突 | 人工通读 | 已达成 |
| 变更记录四文件填写完整 | 本文件即为其一，另三份已同步填写 | 已达成 |
| 回滚描述准确、且不会因本文件后续被继续编辑而再次失效 | `AGENTS.md`/本目录三文件人工核对，均已改为状态描述（不引用任何commit hash） | 已达成——前三版分别写"checkout AGENTS.md"/"revert 8dee499"/"倒序revert f09dae3再8dee499"，均被各自的下一次订正提交自身推翻，根因是commit-hash描述与"还在编辑本文件"这件事结构性冲突；第四版改用状态描述（移除AGENTS.md章节+删目录）从根本解决 |

## 声明状态

- `VERIFIED_COMPLETE`：本次声明范围（`AGENTS.md`新增5条规则 + 不会自我失效的回滚方法）已验证完整，无遗留空模板，无遗留矛盾或不准确表述。回滚方法经过三轮订正——"checkout AGENTS.md"→"revert 8dee499"→"倒序revert f09dae3再8dee499"，每一版都被承载它的下一次提交自身推翻，因为只要还在编辑本目录文件，commit-hash描述就注定会过期。第四版换成状态描述（移除`AGENTS.md`章节+删除本变更记录目录），不再引用任何commit hash，理论上不会再因为本文件被继续编辑而失效——除非有人继续往本目录加新的commit-hash式描述。
