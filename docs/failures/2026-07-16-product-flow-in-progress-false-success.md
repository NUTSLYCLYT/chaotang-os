# Product Flow 将未完成任务误报为成功

## Summary

Claude Code 因非交互权限阻塞而主动结束时，进程退出码为 0，但产品任务仍停留在
`In Progress`。runner 只透传进程退出码，导致自动交付出现假绿风险。

## Root Cause

runner 使用 `--permission-mode acceptEdits`，该模式允许文件编辑但不会自动批准依赖安装、构建和
测试命令。Claude 遵循“不要等待交互式输入”的提示返回阻塞说明并正常退出；runner 启动前只检查
`Ready`，退出后没有重新读取任务状态，因此把“回答已完成”和“交付已完成”混为一谈。

## Prevention

runner 提供仅在用户明确授权时启用的 `--bypass-permissions` 开关，并把授权边界写入 Claude 提示；
默认调用仍使用 `acceptEdits`。无论使用哪种权限模式，runner 都在子进程退出后重新读取任务文件，
只接受 `Implemented`，对 `Blocked` 和其他残留状态返回非零。

## Detection

`run-claude-delivery.mjs --self-test` 覆盖 `Implemented`、`Blocked`、`In Progress` 与 Claude 非零
退出码四种收尾情况，其中 `In Progress + exit 0` 必须返回协议错误。仓库级
`node scripts/check_harness.mjs` 同时校验 product-flow 脚本和本失败记录的结构完整性。

## Evidence

- Runner：`.agents/skills/product-flow/scripts/run-claude-delivery.mjs`
- 自动交付技能：`.agents/skills/product-flow/SKILL.md`
- 受影响任务：`docs/product/tasks/2026-07-16-bootstrap-frontend-backend-foundations.md`
- 产品协作协议：`docs/product-collaboration.md`
