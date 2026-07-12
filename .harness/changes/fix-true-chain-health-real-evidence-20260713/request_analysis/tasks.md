# 任务：fix-true-chain-health-real-evidence-20260713

## 任务 1

- 目标：让 release gate 使用真实运行证据而非固定兼容空态。
- 输入：SwarmRun 与 SwarmTaskRun 持久化记录。
- 输出：checks、liveReady、sourceLabel、summary 和 recommendation。
- 验收：空库红、真实执行绿、质量 blocked 不等同系统 down。
