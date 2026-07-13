# 任务：docs-claude-code-specific-rules-20260714

## 任务 1

- 目标：把用户提供的5条 Claude Code 操作规则加入根 `AGENTS.md`
- 前置条件：`AGENTS.md` 当前干净（`git status --short -- AGENTS.md` 无输出），未处于任何并行session的合并冲突中
- 输入：用户在对话中给出的规则原文（复杂任务先Plan mode / 规划阶段不改文件 / 审查只审查不重写 / 调研大模块用子代理主会话只留结论 / 范围外问题记录不顺手修）
- 输出：`AGENTS.md` 末尾新增"## Claude Code specific rules"一节，5条原样收录
- 涉及文件：`AGENTS.md`
- 状态 / 数据变化：纯文档编辑，无运行时状态变化
- 验证命令与证据：`node scripts/harness-doctor.mjs` → `0 errors, 0 warning(s)`；人工通读确认新增章节与既有"不可绕过"条款无冲突、格式一致
- 回滚边界：分两次提交落地——`8dee499`（`AGENTS.md` + 本目录4个文件）、`f09dae3`（订正本目录3个文件的回滚描述）。两者对同一批文件都有改动，必须倒序 revert：`git revert f09dae3` 后 `git revert 8dee499`（已用 `--no-commit` 验证两步均无冲突）；顺序反了会在本目录3个文件上产生冲突
- 完成定义：`harness-doctor.mjs` 0 errors；变更记录四文件填写完整（**未通过**，见任务2、任务3）

## 任务 2（补充：Codex stop-time review 第一次拦截）

- 目标：修正"变更记录错误描述了实际提交范围与回滚方式"
- 前置条件：任务1的回滚描述写"`git checkout AGENTS.md`即可完全撤销"，但实际提交`8dee499`是`AGENTS.md`+本目录4个文件一起落地（5 files changed），只checkout AGENTS.md会留下孤儿变更记录
- 输入：`git show --stat 8dee499`
- 输出：三个文件（spec.md/tasks.md/ci_summary.md）的回滚描述改为提及本目录4个文件与`AGENTS.md`是同一次提交，建议`git revert 8dee499`或手动checkout+删目录
- 涉及文件：`request_analysis/spec.md`、`request_analysis/tasks.md`、`ci_result/ci_summary.md`
- 状态 / 数据变化：无
- 验证命令与证据：`node scripts/harness-doctor.mjs` 0 errors
- 回滚边界：`git checkout` 这三个文件
- 完成定义：三处回滚描述提及正确的提交范围（**未通过**，见任务3——`git revert 8dee499`本身在有后续commit时不准确）

## 任务 3（补充：Codex stop-time review 第二次拦截）

- 目标：修正"回滚命令仍不准确"
- 前置条件：任务2写的`git revert 8dee499`没有考虑到任务2自己产生的提交`f09dae3`也改了同一批3个文件（ci_summary.md/spec.md/tasks.md）——两次提交对同一批文件都有改动时，只revert较早那个会跟较晚那个冲突
- 输入：`git revert --no-commit 8dee499`（未按顺序，实测）、`git revert --no-commit f09dae3` 后 `git revert --no-commit 8dee499`（按倒序，实测）
- 输出：
  - 实测确认：先revert `8dee499`（不按时间倒序）→ 3个文件产生`CONFLICT (modify/delete)`，`git revert --abort`恢复
  - 实测确认：先revert `f09dae3` 再revert `8dee499`（按时间倒序）→ 两步均`exit 0`无冲突，`git revert --abort`恢复（此为验证性操作，非真实回滚，已完整abort不留痕迹）
  - 三个文件的回滚描述改为准确的两步倒序revert顺序，并说明为什么顺序错了会冲突
- 涉及文件：`request_analysis/spec.md`、`request_analysis/tasks.md`、`ci_result/ci_summary.md`
- 状态 / 数据变化：无（两次revert实验均已完整`--abort`，工作树/AGENTS.md/本目录内容验证与实验前一致）
- 验证命令与证据：
  - `git revert --no-commit 8dee499` → 3处`CONFLICT (modify/delete)`，`git revert --abort`
  - `git revert --no-commit f09dae3 && git revert --no-commit 8dee499` → 两步均exit 0，`git status --short`确认4个文件标记删除+`AGENTS.md`标记修改（符合预期的干净回滚结果），`git revert --abort`
  - `git status --short -- .harness/changes/docs-claude-code-specific-rules-20260714/ AGENTS.md`（abort后）→ 空输出，确认恢复干净
  - `grep -c "Claude Code specific rules" AGENTS.md`（abort后）→ 1，确认规则段落还在
  - `node scripts/harness-doctor.mjs` → `0 errors, 0 warning(s)`
- 回滚边界：`git checkout` 这三个文件
- 完成定义：回滚描述给出经实测验证、按正确时间倒序的两步revert命令，不再有会产生冲突的错误顺序；`harness-doctor.mjs` 0 errors
