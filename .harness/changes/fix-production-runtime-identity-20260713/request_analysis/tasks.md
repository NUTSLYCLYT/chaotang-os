# 任务：fix-production-runtime-identity-20260713

## 任务 1

- 目标：找出 3050/8081 响应漂移根因并最小修复发布门禁。
- 输入：运行进程、cwd、当前 HEAD、Next rewrites 与 HTTP 响应。
- 输出：运行归属检查、回归测试、真实冒烟证据。
- 验收：旧工作树 STOP；当前工作树代理透明；下一阻塞诚实记录。
