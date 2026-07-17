# P9 方案审查 v1

## 结论

APPROVED

## 审查要点

- 事实源保持为既有 `truth_ledger`，不新增表、状态机或第二套翰林后端。
- 权限事实源放在 FastAPI `require_admin`，不依赖前端 header 或页面白名单。
- UI 只投影既有读模型，并明确 `TRUTH_LEDGER/FALLBACK`。
- 删除零引用 mock 与不存在契约的写动作，范围是收敛而非扩张。
- P8 未完成时只形成 P9 候选，不合入 ext。

## 必须验证

1. admin 正例、普通用户 403、匿名 401。
2. 真账本、空账本、损坏账本。
3. 前端未知来源 fail-closed 为 FALLBACK。
4. 浏览器中真实投影只读且来源可见。
