# P7 browser smoke 处置

日期：2026-07-17。

P7 只修改测试 fixture 与根级对账文档，不修改 frontend runtime tree。检查项目允许端口：

| 端口 | 占用者 | 处置 |
| ---: | --- | --- |
| 3002 | PID 2299468，`/home/ubuntu/Projects/chaotang-os/frontend` | 不停止用户既有服务 |
| 3050 | PID 2207，`/home/ubuntu/workspace/frontend/chaotang-master-wt` | 不停止其他工作树服务 |

因此本 SHA 未运行 browser smoke，状态为 `NOT_RUN_PORT_OWNERSHIP_BLOCKED`。没有改用其他
端口，也没有截图现存服务冒充 P7 证据。frontend full、TypeScript、architecture guard 和
doctor 全绿只作为静态/测试替代证据，不冒充浏览器体验。

解除条件：释放 3002 或 3050 后，在 P7 精确 reviewed SHA 启动 production build，复跑统一
上书房→军机处→圣裁旅程并提交 trace/screenshot/network 证据。解除前 campaign 禁止 DONE。
