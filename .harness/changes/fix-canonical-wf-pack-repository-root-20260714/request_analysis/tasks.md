# 任务：fix-canonical-wf-pack-repository-root-20260714

## 任务 1：收编 wf_pack repository root

- 目标：工作流不再向旧 sibling checkout 派发 Agent 操作。
- 前置条件：canonical backend 位于该 workflow 文件上一级；不执行高成本 workflow。
- 输入：旧 `REPO` 常量、capability inventory。
- 输出：script-relative canonical root、RED→GREEN test、`MIGRATED_OBSERVE` 证据、S1 路径清零记录。
- 涉及文件：`backend/scripts/wf_pack_rd_cost_split.js`、`backend/tests/test_wf_pack_rd_cost_split_source.py`、inventory、plan、change record。
- 状态 / 数据变化：仅源码/治理元数据；无 runtime/database/provider 变化。
- 验证命令与证据：CI summary。
- 回滚边界：反向恢复单提交；未部署、未运行 workflow。
- 完成定义：1 RED→GREEN；所有登记旧入口不再 `MIGRATE_REQUIRED`；全局仍 STOP。
