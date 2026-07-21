# 变更摘要：docs-branch-worktree-hygiene-guardrail-20260721-20260721

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录需求与证据；产品实施必须绑定获批 amendment 和 exact-HEAD 执行权威。

| 字段 | 值 |
| --- | --- |
| Change ID | docs-branch-worktree-hygiene-guardrail-20260721-20260721 |
| 类型 | docs |
| 状态 | VERIFIED_PARTIAL |
| Owner | Project Agent |
| 创建日期 | 20260721 |

## 范围

- 主线：`origin/feature-chaotang-ext@4ed5a037`（唯一权威，不改动）；根级 `.harness/` 治理层
- 文件：本变更记录 + `worktree-audit.sh` 审计脚本存档路径引用
- 验证：`git worktree list` 前后计数对比 + `git merge-base --is-ancestor` 逐条核验
