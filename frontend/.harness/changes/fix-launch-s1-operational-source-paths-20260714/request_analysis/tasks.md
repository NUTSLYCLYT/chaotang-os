# 任务拆解

## 任务 1

- 目标：把 cron/monitor/restore 的运行目录收敛到 canonical monorepo。
- 输入：八个执行文件与上一闭环 runner 契约。
- 输出：最小路径修改、逐文件门禁和证据记录。
- 验收：0/8 RED→8/8 GREEN；联合契约与候选验证完成。
- 依赖：不依赖生产接管或真实 cron 安装。
