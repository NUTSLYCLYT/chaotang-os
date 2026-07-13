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
- 回滚是否演练：**已演练**（见命令表倒数两行）。本次改动分两次提交：`8dee499`（`AGENTS.md`+本目录4个文件）、`f09dae3`（订正本目录3个文件的回滚描述，未再碰`AGENTS.md`）。两次提交对本目录同一批文件都有改动，只revert较早的`8dee499`会与较晚的`f09dae3`冲突（已实测复现，3处`modify/delete`冲突）；必须按时间倒序——先`git revert f09dae3`，再`git revert 8dee499`，两步均实测无冲突。单独`git checkout AGENTS.md`同样不准确，会留下孤儿变更记录文件。风险仍然极低（纯文本+文档，无数据、无运行时状态，实验性revert已完整abort且验证过工作树恢复到实验前状态）。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| `harness-doctor.mjs` 0 errors | 命令表第2行 | 已达成 |
| 新增内容与既有条款无冲突 | 人工通读 | 已达成 |
| 变更记录四文件填写完整 | 本文件即为其一，另三份已同步填写 | 已达成 |
| 回滚描述准确、经实测验证 | 命令表倒数两行（先revert 8dee499冲突复现，倒序revert无冲突） | 已达成——第一版"git checkout AGENTS.md即可完全撤销"和第二版"git revert 8dee499"均被推翻订正，第三版给出经实测的两步倒序revert |

## 声明状态

- `VERIFIED_COMPLETE`：本次声明范围（`AGENTS.md`新增5条规则 + 准确且经实测验证的回滚方法）已实测验证完整，无遗留空模板，无遗留矛盾或不准确表述。回滚方法本身经过两轮订正才最终经实测确认（先说"checkout AGENTS.md"→推翻→说"revert 8dee499"→推翻（会与后续订正commit冲突）→最终确认"倒序revert f09dae3再8dee499"无冲突），三处文档已同步为最终版本。
