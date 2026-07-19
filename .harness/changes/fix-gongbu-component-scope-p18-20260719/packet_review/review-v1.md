# P18 固定 SHA 独立复审

## 绑定范围

- Packet ID: P18
- Change ID: `fix-gongbu-component-scope-p18-20260719`
- Predecessor integration SHA: `cfc2e88db875139ddb8745ecd1e65033c46f4f6b`
- Reviewed head SHA: `c271255790d12b47fe1c698bcb96b1248dea42f7`
- Reviewer: Claude Code Opus（独立 detached worktree，只读）
- Review date: 2026-07-19

受审 HEAD 精确等于上述 SHA，基线是其祖先。`B..H` 恰 10 个路径：6 个
实现/配置/测试路径与 4 个本 change Harness 路径；无旧审查、其他 packet 或旧分支
ancestry 夹带。`git diff --check` 干净。

## 独立执行证据

| 检查 | 独立结果 |
| --- | --- |
| 13 条关键安全回归 | 13 passed / 71 deselected |
| 五模块聚焦 | 104 passed |
| 后端全量 | 2825 passed / 37 skipped / 4 warnings / 0 failed |
| D6 回归 | 42 passed / 0 failed |
| 根级 doctor | 0 errors / 0 warnings |
| 前端 doctor | 0 errors / 0 warnings |
| 后端 doctor | 0 errors / 0 warnings |
| 自建 token/scope 探针 | 29/29 passed |

四条 warning 为既有的 FastAPI duplicate operation ID 两条与 OpenClaw fallback 两条，
不是本包引入。审查者确认 v7 的小写 BMS/PACK 漏判已由双向 RED/GREEN 证据真实关闭：
BMS/PACK 忽略大小写且保留 ASCII token 边界；PCS 继续区分大小写；
`package/backpack/packet/100 pcs` 等负例不入域。

## 安全与契约复核

- 中文组件范围与拉丁 token 边界没有恢复业务隐喻、软件单体或模组假阳性。
- route、run、rule、real、live、锦衣卫先行、串行、并行与异常重试读取同一事实投影；
  内嵌和外部 `review_plan` 不互相遮蔽。
- 原生 black court document 保持对象和形状；非 black 或无真实引擎结果时强制复核与人签。
- `department_ids` 不能删除物理安全强制工部；`selected_swarms`、`swarm_tasks` 与
  `task_runs` 同源一致。
- Harness 如实记录 v1/v2-v5/v7 的历史阻断和 v8 的待发布状态，没有提前宣称发布。

## Findings

无 HIGH。无 MEDIUM。

LOW（仅记录，不在本包扩修）：

1. 若干组件短语已被更宽的明确硬件词覆盖，属于死配置维护噪音，无行为影响。
2. 大写 `PCS` 作为数量单位时可能触发保守人工复核；方向 fail-safe，符合明示策略。
3. 后端全量在审查 worktree 产生一个未跟踪知识归档文件；它由既有测试写入，未进入
   受审树、不是 P18 引入，审查者按只读约束未删除。

## 结论

证据完整，v7 MEDIUM 已关闭，未发现阻断发布的安全降级、契约混形或证据失实。

PACKET_REVIEW_GO
