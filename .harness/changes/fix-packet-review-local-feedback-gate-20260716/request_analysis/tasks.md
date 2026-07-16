# 任务：fix-packet-review-local-feedback-gate-20260716

## 任务 1：核心 DAG/envelope 验证器

- 目标：只从 Git objects 验证 B→H→R→M 和结构化 approval。
- 前置条件：用户已批准 D6-L；激活前历史不追溯。
- 输入：remote/local 40 位 SHA、remote/ref、candidate 内 approval/report。
- 输出：allowed/status 或 fail-closed 错误。
- 涉及文件：`scripts/lib/packet-review-local-feedback.mjs`、对应 Node 测试。
- 状态 / 数据变化：无运行态写入。
- 验证命令与证据：先 RED 后 GREEN；真实临时 Git repo 正反例。
- 回滚边界：删除新模块与测试即可。
- 完成定义：旧 GO、错绑定、夹带、错 merge tree 均拒绝。

## 任务 2：pre-push 入口与安装器

- 目标：只拦截 origin/ext，安全共存其他 hooks。
- 前置条件：任务 1 GREEN。
- 输入：Git pre-push stdin 与 remote 参数。
- 输出：本地反馈门；status 固定诚实声明。
- 涉及文件：CLI、安装器、hook 测试。
- 状态 / 数据变化：显式安装时才写 Git hooks 目录；仓库测试只写临时目录。
- 验证命令与证据：linked worktree、core.hooksPath、幂等、卸载、非 dispatcher 拒绝。
- 回滚边界：`--uninstall` 只删除本子 hook。
- 完成定义：测试全绿且不能覆盖用户 hook。

## 任务 3：护栏收口

- 目标：登记 manifest/验证矩阵与本 change 证据。
- 前置条件：任务 1–2 GREEN。
- 输出：CI 摘要、根 doctor 0/0、diff check。
- 回滚边界：纯文档/manifest 原子回滚。
- 完成定义：标记 READY_FOR_REVIEW，不安装到真实 hooks、不推送。
