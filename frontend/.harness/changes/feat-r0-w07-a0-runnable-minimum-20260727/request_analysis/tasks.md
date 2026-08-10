# 任务拆解

## 任务 1：类型合同与 fail-closed adapter

- 输入：后端 `ContractTaskReadModelV1` OpenAPI。
- 输出：generated TS contract、read model parser、action policy。
- 验收：未知 action/blocker 拒绝，PARTIAL 刷新无 resume。

## 任务 2：现有页面最小接入

- 输出：`ContractReviewPanel` 与 Shiguan exact readback。
- 保护文件：`ShangshufangPage.tsx`、`ShiguanPage.tsx`。
- 唯一写者：当前 Codex implementation worktree；只允许 hunk 级修改。
- 验收：不新增 route/page/BFF，旧非合同工作流保持。

## 任务 3：真实后端浏览器证据

- 输入：临时数据库、合成合同任务、真实 `/api/auth/login` JWT。
- 输出：`w07-contract-runnable-minimum.spec.ts` 证据。
- 验收：`/shangshufang` 下载可用，`/shiguan` exact receipt 可回读。
- 非目标：生产部署、3050、持久数据库。
