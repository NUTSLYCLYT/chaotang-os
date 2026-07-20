# CI 摘要：fix-r0-execution-authority-20260720

## Exact-HEAD

| 项 | 值 |
| --- | --- |
| B | `4ed5a0379e87c6ea65ed9a3ad89dca962aa785fe` |
| H | `35f083b001231f12d515e185add6d4128dd931b8` |
| tree | `c1a6136113327bf15abe570dada97696a1220cd0` |
| B..H binary diff SHA-256 | `89029b93f1345c0658e1bb909f510c85a13da319649a35617343c2c4eaef0b2b` |
| 范围 | 3 commits，20 files；仅根治理、scripts、AGENTS 与本 change |

## TDD 证据

实现前依次观察到四次预期 RED：resolver 模块缺失、受管文档语义 validator 缺失、ancestor symlink reader 缺失、CLI 无参数 fail-closed 断言失败（实际 64、预期 2）。对应实现落地后全部转 GREEN。

## 最终命令证据

下表在 H=`35f083b0` 上运行；同一组命令又在 `/tmp` detached clean worktree 中复跑，确认不依赖主工作区 5 项未跟踪文件。

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `node --test scripts/execution-authority.nodetest.mjs` | 0 | 注册测试文件 PASS |
| `node scripts/execution-authority.nodetest.mjs` | 0 | 9/9 PASS |
| `node scripts/execution-authority.mjs --check` | 0 | `VALID_INACTIVE_GUARD`；不授权施工 |
| `node scripts/execution-authority.mjs --authorize` | 2 | `STOP / AMENDMENT_APPROVAL_REQUIRED` |
| `node scripts/execution-authority.mjs` | 2 | 无参数按 authorize fail closed |
| `node scripts/execution-authority.mjs --check --authorize` | 64 | 多余/歧义参数拒绝 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors / 0 warnings；委托前端/后端 doctor 通过 |
| `git diff --check B..H` | 0 | PASS |
| `git merge-base --is-ancestor B H` | 0 | PASS |

## Claude Code 独立只读审查

| 审查线 | 结论 | 中高风险 | 备注 |
| --- | --- | --- | --- |
| Authority | `GO_WITH_ACTIONS` | 无 | independently matched H/tree/diff；Node 被该会话策略阻止 |
| Security | `GO_WITH_ACTIONS` | 无代码阻断项 | 对抗检查通过；Node 被该会话策略阻止 |
| Git/Evidence | `GO_WITH_ACTIONS` | 两项证据 MEDIUM，已由本次记录关闭 | 指出最终 CI 与 exact-H 报告尚未落盘 |
| Command Execution | `GO` | 无 | 独立实际执行 7 条命令，9/9 与退出码全部符合预期 |

报告见 `../claude_code_review/*-final.md`。这些均是本地只读审查，不是托管平台 required check。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| v1 固定 inactive/STOP | Node suite、CLI、Authority/Security review | PASS |
| 无参数与歧义参数 fail closed | CLI 退出 2/64、Node suite、Command Execution review | PASS |
| 全计划 inventory/digest | Node suite、root doctor、Authority/Git review | PASS |
| 根入口/R0 PRD 旁路阻断 | Node suite、Authority/Security review | PASS |
| clean exact-H 三层 doctor | detached clean worktree，0 errors / 0 warnings | PASS |
| Claude Code exact-HEAD review | 三路审查 + 独立命令执行审查 | PASS_LOCAL |
| 托管平台 required check | 未配置/未验证 | PENDING_EXTERNAL |

## 未验证与边界

- 托管平台分支保护、required check 与非提交者强制复核未验证。
- 未批准 M0–M10 amendment，`--authorize` 仍必须 STOP。
- 未实施 R0 产品功能，未修改远端默认分支，未部署生产。
- 回滚未演练；本变更无数据迁移，可按 3 个实现提交整包 revert。

## 声明状态

- `VERIFIED_EXACT_HEAD_LOCAL`
- `EXECUTION_AUTHORITY=AMENDMENT_REQUIRED`
- `NOT_ENFORCED`
