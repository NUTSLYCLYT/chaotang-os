# 规格说明：docs-branch-worktree-hygiene-guardrail-20260721-20260721

## 背景

2026-07-21 盘点发现 96 个 git worktree、18 个未合 `candidate/*` 分支挂在仓库上。审计文档
（`docs/status/archive/2026-07-20-ext-branch-convergence-audit.md`）已确认：
`origin/feature-chaotang-ext@4ed5a037` 是唯一权威主线，分支集成已基本完成；混乱不在 git
拓扑本身，而在于已合入历史分支和被替代旧版没有被清理，长期堆积增加认知税、也提高误操作
（误 push/force push 覆盖权威历史）风险。本记录固化一条可复用的机械化裁决流程和一条前向
栅栏规则，防止债务重新堆积。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 清理前 96 个 worktree，机械核验后 62 个是 ext 祖先（已吸收），34 个独有 | `git worktree list \| wc -l`；`worktree-audit.sh` 逐条 `git merge-base --is-ancestor` 输出，2026-07-21 | 已验证 | 否 |
| 已确认事实 | 第一批「已吸收+工作区干净」47 个 worktree 已用 `git worktree remove` + `git branch -d` 清理，0 失败 | 本会话命令输出（OK=47 FAIL=0），2026-07-21 | 已验证 | 否 |
| 已确认事实 | 本地野生 `feature-chaotang-ext@7daf36ba`（落后远端权威38、独有1，含未吸收治理设计资产）已改名为 `wip/six-capability-absorption-governance-20260721`，避免被误 push/merge | `git branch --list "wip/six-capability*" -vv`，2026-07-21 | 已验证 | 否 |
| 推测 | 剩余 15 个「已吸收但 DIRTY」worktree 中的未提交改动多为 review 笔记残留，非产品代码 | 未逐条读 diff | 待人工核验 | 是（阻塞第二批清理，不阻塞本记录） |
| 未知问题 | 34 个独有分支中，哪些是「被新版替代永不再合」、哪些是「未裁决独有资产」尚未逐条归类 | 不适用 | 待下一轮审计 | 否（不阻塞栅栏规则生效） |

## 数据流与调用链

```
新 packet 开工
  → task/* worktree（实现/复审，指针可漂移）
  → candidate/*（基线+复审实现组合，成为 ext 祖先后不必再合）
  → 合入 origin/feature-chaotang-ext
  → 【栅栏卡点】当场 git worktree remove + git branch -d
```

裁决四件套（判断一条分支是否可安全清理）：
```
精确 SHA + Packet ID + approval/review + 当前树 diff
机械代理：git merge-base --is-ancestor <sha> origin/feature-chaotang-ext
        + git status --porcelain（工作区是否干净）
```

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `worktree-audit.sh` | 本次会话产出，存于 `/tmp/claude-1000/.../scratchpad/worktree-audit.sh`（会话级临时目录，未入库） | 后续人工或 agent 复用做批量裁决 | 纯只读审计，不执行删除，输出清单供人工/agent 二次确认 |
| 分支命名分类表 | `docs/status/archive/2026-07-20-ext-branch-convergence-audit.md` §2 | 本记录、后续裁决 | 已是既有事实源，本记录不重复定义，仅引用 |

## 范围

- 覆盖：worktree/分支清理流程的机械化裁决方法 + 前向栅栏规则
- 不覆盖：R0 产品功能实现、执行权威 amendment（见 `docs-r0-trusted-kernel-amendment-20260720`）

## 非目标

- 不对 34 个独有分支做逐条产品价值裁决（留待下一轮审计）
- 不删除任何远端分支或 tag（本次只操作本地 worktree + 本地分支引用）
- 不改变 `origin/feature-chaotang-ext` 权威地位或历史

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| worktree 工作区 DIRTY | 不进入自动清理批次，需人工核 diff | `git status --porcelain` 非空即排除 |
| 分支非 ext 祖先（独有提交） | 不删除，标记待人工裁决（归档 or 补吸收） | `git merge-base --is-ancestor` 返回非 0 |
| 分支为当前活跃工作（如 R0 amendment 执行体） | 即使命中「独有」也不进清理清单，人工识别排除 | 本次排除 4 个：`branch-governance-convergence-20260720`、`packet-skill-lifecycle-20260721`、`r0-anti-hallucination-01-20260720`、`r0-w01-amendment-repin-20260721` |
| 本地分支与远端同名但内容不同（如野生 ext） | 禁止 push/merge，先改名转 `wip/*` 隔离 | 已执行，见「当前实现与证据」 |

## 风险与回滚边界

- `git worktree remove` 只删除工作区快照与索引，底层 commit 仍在 `.git/objects` 直至被 gc；
  `git branch -d`（非 `-D`）只删除已确认是祖先分支的本地引用，不影响远端。
- 回滚路径：`git worktree list --porcelain` 操作前已记录完整清单（`worktree-audit-result.txt`），
  如需恢复某个 worktree，可用原分支 SHA 重新 `git worktree add`（前提：本地 objects 未被 gc）。
- 本次操作未触碰任何远端分支、未 push、未 force 操作，风险面仅限本地磁盘状态。

## 计划确认记录

- 批准人：仓库所有者（本会话对话确认「1 2 3 4 同意」+「要」）
- 批准日期：2026-07-21
- 批准范围：本地野生 ext 改名、机械化审计脚本生成与执行、第一批 47 个已吸收+干净 worktree 清理、栅栏规则记录本身
- 明确未批准：第二批（15 个 DIRTY）清理；34 个独有分支的逐条归类与处置；任何远端/force 操作

## 验收标准

- 栅栏规则文字化并可被后续 packet 引用："task → candidate → 合入 ext → 当场删除 worktree + 分支；
  review-vN 超过 v3 视为 packet 边界画错的信号，需重新拆包而非继续开新版本"
- 审计脚本可复用、幂等、只读默认（先出清单不直接删）

## 验证计划

- 下次开新 packet 前，跑一次 `worktree-audit.sh` 确认 worktree 总数未失控回升
- review-vN 计数超过 3 时，触发对该 packet 的边界重审，而非继续追加 v4/v5
