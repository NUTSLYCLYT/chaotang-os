# 任务：fix-system-restore-dry-run-health-20260714

## 任务 1：用隔离服务复现 dry-run 假绿

- 目标：证明 unit 存在但 inactive、端点全挂时旧脚本错误返回 0。
- 前置条件：不访问或重启真实服务。
- 输入：fake systemctl/curl/ss/sleep PATH。
- 输出：失败型 dry-run 和手动健康型 dry-run 两个契约测试。
- 涉及文件：`frontend/scripts/system-restore.nodetest.mjs`。
- 状态 / 数据变化：仅临时目录，测试结束删除。
- 验证命令与证据：首次 `node --test ...` 为 1 failed/1 passed。
- 回滚边界：删除测试文件。
- 完成定义：RED 精确显示 exit 0 与“全部正常”的错误组合。

## 任务 2：最小修复健康与端口证据

- 目标：dry-run 单次探测所有端点、累计失败并正确解析 `ss`。
- 前置条件：任务 1 RED 已保存。
- 输入：现有 `maybe_restart`、`wait_healthy` 和汇总逻辑。
- 输出：无重启的可信 dry-run。
- 涉及文件：`frontend/scripts/system-restore.sh`。
- 状态 / 数据变化：dry-run 无外部写入；正常模式行为保持。
- 验证命令与证据：新测试 2/2；实际 dry-run 端点/端口全绿。
- 回滚边界：整体 revert 脚本与测试。
- 完成定义：退出码、HTTP 证据和 LISTEN 证据一致。

## 任务 3：verification-loop 与精确提交

- 目标：验证该最小闭环且不带入并行部门路由改动。
- 前置条件：GREEN。
- 输入：本轮四类文件（脚本、测试、根/前端记录）。
- 输出：单一 ext commit。
- 涉及文件：本 change record 与 frontend 对应 record。
- 状态 / 数据变化：git commit；不 push。
- 验证命令与证据：doctor、S1 tests、shell syntax、实际 dry-run、diff/secret。
- 回滚边界：revert 单提交。
- 完成定义：精确暂存不包含现有并行脏文件和本地缓存。
