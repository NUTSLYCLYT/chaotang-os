# 审查报告：fix-p2-tripwire-regression-20260715（P2 回归收尾）

| 绑定项 | 值 |
| --- | --- |
| BASE_SHA | `8de8a4a`（审查时点 ext HEAD，分支已主动 rebase 至此） |
| HEAD_SHA | `0980169b0c563fad80d3dd7b89f0e70fbcaca231` |
| branch | `task/p2-tripwire-regression-fix` |
| worktree | `/home/ubuntu/Projects/.fullcourt-worktrees/p2-tripwire-regression-fix` |
| change ID | `fix-p2-tripwire-regression-20260715` |
| git status --porcelain | 1 条：`?? backend/knowledge/docs/ima_archived/`（untracked 目录，非本 change 文件，无污染） |
| push 暴露 | `git ls-remote origin 'refs/heads/task/*'` = 0 条（`CHECK_AT=2026-07-15 08:02:00 CST`）——当前远端零暴露；"从未 push"不作断言 |
| 审查 diff 范围 | `8de8a4a..0980169`（单提交，6 文件：2 代码+4 证据） |
| ext merge | **未合入**——停审门本次被遵守 ✓ |
| 审查方式 | 逐行 diff + 独立重跑（时间戳取自命令输出） |

## 独立复核

| 项 | Codex 证据 | 独立复核 | 判定 |
| --- | --- | --- | --- |
| 两个回归修复 | RED（含顺序污染复现 2.0 vs 硬编码 1.0）→ GREEN | 我自跑 tripwire+governance 持久化 11 passed（08:0x，见命令输出） | PASS |
| 修复方向 | governance bill 改走 `create_decision_task` 唯一工厂；遥测断言改增量式 | 逐行读 diff：正是吸收模式（消灭裸 DecisionTask 构造），无越界（未碰前端/大殿/flow-store 业务逻辑） | PASS |
| 后端全量 pytest | 2603 passed / 26 skipped / 7 failed（较基线 9→7） | 7 项残留逐个列明根因且均非本 change 范围——诚实 | PASS |
| 真实控制面 DB | **证据缺失（见 G2）** | 我独立实测 `backend/var/data/fengqun.db` SHA-256 = `10dbcf48…` 与 P0 基线一致，实际未污染 | 事实 PASS / 证据 GAP |

## 发现

| ID | Severity | 内容 |
| --- | --- | --- |
| G2 | MEDIUM | **全量 pytest 解锁未声明**：campaign 口径中"无选择全量 pytest"为 `NOT_RUN_SAFETY_BLOCKED`，解锁条件是生产路径 tripwire 齐备。本 change 直接跑了全量却未在 ci_summary 记录：a) 解锁依据（P2 tripwire 已 fail-closed 全部 legacy writer）；b) 跑前/跑后真实 DB 三元指纹。DB 实际未动（我已独立验证），但按 S1/S2/S10 事故协议，这份证据必须在 change 记录里。**合 ext 前补一段 ci_summary 修订即可。** |
| N1 | INFO | 好消息：全量 pytest 可跑意味着 P0 登记的 `NOT_RUN_SAFETY_BLOCKED` 残留**有条件解除**——收官 DONE 硬门的这一项，在补齐 G2 声明+后续 Packet 持续带 DB 指纹证据后可转为已解决。7 个非范围失败（closeout 文档检测 1、lawyer_rag 4、persona munger 1、tianjian 断言 1）需在 P6/P7 前另立清单处理。 |

## 裁决

PACKET_REVIEW_GO（条件：G2 的 ci_summary 补充随本分支追加 commit 后即可合 ext）

## v2 确认（G2 已满足）

`af064fb`（2026-07-15 08:11）补齐：a) 四项解锁前提（legacy tripwire fail-closed、
chaotang_store 门禁、create_decision_task 单写入口、pytest 阻断 production
SessionLocal）；b) 全量 pytest 带跑前（08:06:00）/跑后（08:10:25）真实 DB
三元指纹，`10dbcf48…` 与 P0 基线及审查者独立实测一致；c) 正确限定"解除安全
阻断≠7 个基线失败已解决"。**G2 关闭，合 ext 放行。**
