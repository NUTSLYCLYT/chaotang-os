# 任务：fix-canonical-jiqun-smoke-start-help-20260714

## 任务 1：收编 smoke DOWN 启动帮助

- 目标：旧绝对仓库/direct uvicorn 不再出现在活 smoke 运维入口。
- 前置条件：canonical `backend/scripts/serve-dev.sh` 已存在；生产保持 STOP。
- 输入：smoke DOWN 分支与 capability inventory。
- 输出：canonical 相对启动命令、RED→GREEN 测试、`MIGRATED_OBSERVE` 证据。
- 涉及文件：`frontend/scripts/jiqun-contract-smoke*`、inventory、change records、launch blueprint。
- 状态 / 数据变化：只改帮助和治理元数据；无 runtime/database 变化。
- 验证命令与证据：见 CI summary。
- 回滚边界：反向恢复单提交；没有部署。
- 完成定义：新增 test 1 RED→GREEN；真实 DOWN 输出正确；全局仍 STOP。
