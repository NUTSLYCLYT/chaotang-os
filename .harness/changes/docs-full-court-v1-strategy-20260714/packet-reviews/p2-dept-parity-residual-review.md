# 审查报告：P1-F1 parity residual（task/p2-dept-parity-residual）

| 绑定项 | 值 |
| --- | --- |
| BASE_SHA | `92d84d7`（分支基点，与 ext HEAD 之间仅隔纯 docs 审查提交，无代码交叉） |
| HEAD_SHA | `345b7e2d5de66ca998b43cb456761e51855502f8` |
| branch / worktree | `task/p2-dept-parity-residual` / `~/Projects/.fullcourt-worktrees/p2-dept-parity-residual` |
| change ID | `fix-flow-store-legacy-tripwire-20260715`（residual 归属 P2 change，正确） |
| git status --porcelain | 空（clean） |
| push 暴露 | ls-remote task/* = 0 条（08:02 复核，见 regression-fix 报告同批） |
| 审查 diff 范围 | `92d84d7..345b7e2`（单提交，4 文件 +136） |
| ext merge | 审查时点未合入，本报告放行；**v2 后记**：已以 `31ad69a` 合入 ext（git 戳 `2026-07-15 08:19:46 +0800`，merge --no-ff 引用本报告），合入后复跑 parity 5 pass、根 doctor 0 errors |

## 利益声明

`dept-yaml-parity.nodetest.ts` 主体（含重复 v1Code 折叠守门）由审查者本人（Claude）
按用户"解决问题"指令编写并交付；Codex 完成采纳、变异验证、全套回归与提交。
本审查因此把重点放在 **Codex 的独立验证增量**上，测试设计本身的缺陷风险由
stop-review 对抗通道兜底（已经历"可漏报"一轮质询并补重复守门）。

## 独立复核

| 项 | 证据 | 判定 |
| --- | --- | --- |
| 变异验证（关键增量） | 临时改户部 agentCode 为 `li_bu` → 3 passed / 1 failed，错误信息精确指向 backend `hu_bu` ≠ frontend `li_bu`——守门真实有效，非恒绿 | PASS |
| parity 测试 | Codex 5 passed；审查者在其 worktree 独立重跑 5 passed | PASS |
| 后端 identity/protocol | 21 passed | PASS |
| tsc / 全量 nodetest / doctor | 0 errors / 1018 pass+7 基线 / 三层 0 errors | PASS |
| 范围 | 仅 1 测试文件+3 证据文件，无产品代码改动 | PASS |

## 裁决

PACKET_REVIEW_GO —— P1-F1 条件正式关闭，放行合 ext。
