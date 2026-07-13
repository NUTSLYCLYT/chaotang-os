# CI 摘要：docs-claude-code-specific-rules-20260714

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `git status --short -- AGENTS.md`（编辑前） | 0（空输出） | 干净，无并行session冲突 | 编辑前安全性确认 | 本会话实测 |
| `node scripts/harness-doctor.mjs` | 0 | `0 errors, 0 warning(s)` | 根级护栏一致性 | 本会话实测 |
| `git diff --stat -- AGENTS.md` | 0 | `1 file changed, 8 insertions(+)` | 确认本次改动范围仅为8行新增，无删除、无其他文件 | 本会话实测 |

## 结果

`AGENTS.md`"不可绕过"条款之后新增"## Claude Code specific rules"一节，收录用户提供的5条操作规则原文。纯文档新增，不修改任何既有条款，不涉及代码或运行时逻辑。

## 未验证项

- 这5条规则本身的执行效果（如"复杂任务"的判定边界、子代理调研的实际触发时机）未在本次验证——规则文本已落地，实际遵循效果留待后续任务执行时体现。

## Diff 与回滚复核

- changed files：`AGENTS.md`（仅8行新增，无删除）
- diff review：`git diff --stat` 确认改动范围精确，人工通读确认新增章节独立成段、不与既有"不可绕过"条款交叉引用出错
- 回滚是否演练：未演练（风险极低，纯文本新增，`git checkout AGENTS.md` 即可完全撤销）

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| `harness-doctor.mjs` 0 errors | 命令表第2行 | 已达成 |
| 新增内容与既有条款无冲突 | 人工通读 | 已达成 |
| 变更记录四文件填写完整 | 本文件即为其一，另三份已同步填写 | 已达成 |

## 声明状态

- `VERIFIED_COMPLETE`：本次声明范围（`AGENTS.md`新增5条规则）已实测验证完整，无遗留空模板，无遗留矛盾表述。
