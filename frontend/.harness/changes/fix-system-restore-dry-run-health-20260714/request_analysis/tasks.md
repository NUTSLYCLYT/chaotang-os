# 任务拆解

## 任务 1：dry-run 可信健康

- 目标：退出码、HTTP 健康和端口监听证据一致，且无重启副作用。
- 输入：systemd 状态、HTTP 端点、`ss` 输出。
- 输出：修复脚本、两条隔离回归测试。
- 验收：TDD RED→GREEN，实际 dry-run 与 doctor 通过。
- 依赖：bash、curl、systemctl、ss；测试用 fake PATH 隔离。
