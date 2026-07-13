# 任务拆解

## 任务 1

- 目标：建立唯一后端 systemd production runner 与安装证明。
- 输入：现有 requirements、gunicorn.conf、两份 unit 和恢复手册。
- 输出：最小 unit/README 修改及根级契约测试。
- 验收：RED→GREEN、隔离 venv 实际安装、candidate verification-loop。
- 依赖：真实服务接管和 immutable artifact 不在本闭环。
