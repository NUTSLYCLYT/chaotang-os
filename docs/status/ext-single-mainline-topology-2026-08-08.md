# EXT 单主线拓扑与处置账本（2026-08-08）

## 结论

唯一可写产品主线是正式仓库 `/home/ubuntu/Projects/chaotang-os` 的
`feature-chaotang-ext`。其他副本、分支和 worktree 只作为证据源、能力源或未完成
工作区，不再直接承担产品发布。

```text
Gitee origin/feature-chaotang-ext (8feae838)
                 ^ push
                 |
formal feature-chaotang-ext (d36bb797 -> 本轮候选)
                 ^ fast-forward only
                 |
codex/ext-mainline-composition-20260807
                 |
                 +-- 重制 S3 校真契约（允许）
                 +-- 收拢/处置账本（允许）

chaotang-ext-certification (858c9f47) ---- 只读能力证据源
                 |
                 +-- S3 思想：已在当前 EXT 重制
                 +-- S4 单屏：停放，当前 R0 冻结
                 +-- S5 evolve：停放，需 exact amendment
                 +-- S6 旧收官：过时，不作为当前完成证明

chaotang-ext-gongbu-egb0 ----------------- 脏工作区，冻结并保留
professional-agent-overlay-clean --------- 独立 agent/天道收敛线，不混入本次产品提交
harness-only / harness-dev ---------------- 能力与护栏参考线，不作为产品主线
```

## 主线事实

| 项目 | 当前事实 | 处置 |
| --- | --- | --- |
| 正式仓库 | `/home/ubuntu/Projects/chaotang-os` | 唯一事实源 |
| 产品主线 | `feature-chaotang-ext@d36bb797` | 本轮仅 fast-forward |
| 远端 | `git@gitee.com:msxn/chaotang-os.git` | 用户已授权收拢后 push |
| 远端前驱 | `origin/feature-chaotang-ext@8feae838` | 本地主线领先 248 个提交 |
| 本轮候选 | `codex/ext-mainline-composition-20260807` | 隔离修改、验证、提交 |
| 执行权威 | `R0-W08 = GO / APPROVED_WORK_PACKAGE` | 只做产品验收加固范围 |

## 两个旧副本为何不能直接合并

`chaotang-ext-certification` 是独立 Git 仓库，名称虽同为
`feature-chaotang-ext`，但其 HEAD 为 `858c9f47`，并非正式主线。正式主线相对它已有
411 个独有提交；旧副本的价值应按“能力 + 契约 + 测试”提取，不能按文件或整支历史
覆盖。

其子 worktree `chaotang-ext-gongbu-egb0` 当前含用户未提交的工部契约工作，包括 4 个
已修改护栏文件及多组未跟踪契约/fixture/测试文件。它是高风险在制品，必须保留原状，
本轮不读取为产品事实源、不提交、不删除。

## 旧朝会提交处置

| 能力/提交 | 价值判断 | 本轮处置 |
| --- | --- | --- |
| `0290dd7` S1/S2 runner 与 cron | 运行能力存在，但 cron 仍指向旧副本 | 保留运行证据；不在 W08 内切换 |
| `abbce1c` S3 校真闸 | 不可替代的反假绿契约 | 不 cherry-pick；在当前 EXT 以新 RED 重制 |
| `74f2060` S4 皇帝单屏 | 与当前 R0 产品冻结冲突 | 停放 |
| `7cf6292` S5 evolve bridge | 有闭环价值，但改动被冻结区域和外部知识目录 | 等 exact amendment |
| `cecfdf4` S6 旧收官 | 建立在旧副本与未完成 S2/S5 上 | 过时，不沿用完成状态 |
| 其余治理/契约提交 | 部分内容已被正式主线更新版本覆盖 | 仅作审计参考，不整支吸收 |

## 运行态边界

当前用户 crontab 的 daily-court 条目仍执行
`/home/ubuntu/Projects/chaotang-ext-certification/backend/scripts/run_daily_court.sh`，超时已为
1440 分钟。它证明“运行入口仍在旧副本”，不证明旧副本是主线。R0-W08 明确冻结 daily
court 与 evolve 激活，因此本轮只记录，不偷偷换路径。

## 最终状态定义

本轮完成的含义是：S3 与收拢证据进入正式 `feature-chaotang-ext`，该分支通过门禁并推送
Gitee；旧副本降级为只读证据源。它不等于 S5 或运行切换已获授权。后者必须由新的 exact
amendment 单独激活。
