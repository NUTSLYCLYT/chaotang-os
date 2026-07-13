# 任务拆解

## 任务 1

- 目标：prod doctor 能证明 JWT runtime identity 并 fail closed。
- 输入：backend health metadata、expected key id、外部临时 probe token。
- 输出：`jwt-runtime-identity` 检查项。
- 验收：匹配 + protected 2xx 才 ready；其他情况 STOP；token 不出现在输出。
- 依赖：backend `/api/health` 与只读 `/api/tasks`。
