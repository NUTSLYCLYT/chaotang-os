# CI 摘要：docs-branch-worktree-hygiene-guardrail-20260721-20260721

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `git branch -m feature-chaotang-ext wip/six-capability-absorption-governance-20260721` | 0 | 改名成功 | 野生本地 ext 隔离 | 2026-07-21 会话终端输出 |
| `worktree-audit.sh`（全量枚举 96 worktree） | 0 | 62 YES / 34 NO，输出完整清单 | 全部 worktree | `scratchpad/worktree-audit-result.txt`，2026-07-21 |
| 循环 `git worktree remove` × 47 + `git branch -d` × 35 | 0 | OK=47 FAIL=0，全部分支删除成功 | 第一批清理 | 会话终端输出，2026-07-21 |
| `git worktree list \| wc -l`（清理后复核） | 0 | 96 → 49 | 全量复核 | 会话终端输出，2026-07-21 |

## 结果

野生本地 ext 已隔离；机械化审计脚本产出并验证；第一批 47 个已吸收+干净 worktree 清理完成，
0 失败；仓库 worktree 总数从 96 降至 49；栅栏规则文字化记录于本变更 spec.md。

## 未验证项

- 剩余 15 个「已吸收但 DIRTY」worktree 的具体 diff 内容未逐条核验，未纳入本次清理
- 34 个独有分支未逐条归类为「归档」or「待补吸收」，留待下一轮审计
- 栅栏规则尚未在实际下一个 packet 生命周期中验证是否被遵守（规则刚建立，无历史周期可回测）

## Diff 与回滚复核

- changed files：本次会话未修改任何仓库受控源文件；仅本地 `.git/worktrees/*` 元数据与本地
  分支引用发生变化，均不在 `git diff` / `git status` 可见范围内（不是受控内容变更）
- diff review：不适用（无受控文件 diff）
- 回滚是否演练：未演练，但回滚路径已在 spec.md「风险与回滚边界」中记录（原 SHA 重建 worktree）

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 野生 ext 隔离，防误 push/merge | `git branch --list "wip/six-capability*"` 确认改名 | 已满足 |
| 审计脚本可复用、只读、幂等 | 脚本存档 + 96 行确定性输出 | 已满足 |
| 第一批清理 0 失败 | OK=47 FAIL=0 | 已满足 |
| worktree 总数可验证下降 | 96 → 49 | 已满足 |
| 栅栏规则文字化可引用 | spec.md 验收标准段 | 已满足 |
| 34 个独有分支逐条裁决 | 无 | 未满足，留待后续审计 |

## 声明状态

- `VERIFIED_PARTIAL`：本记录范围内的四项任务（隔离/脚本/第一批清理/规则记录）均已执行并有
  终端输出证据；34 个独有分支的逐条裁决与第二批 DIRTY worktree 清理明确排除在本次范围外，
  留待后续变更记录处理。
