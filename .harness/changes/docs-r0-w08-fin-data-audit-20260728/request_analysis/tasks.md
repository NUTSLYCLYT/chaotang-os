# 任务：docs-r0-w08-fin-data-audit-20260728

## 任务 1

- 目标：审计当前仓已有金融/财务数据源能力，并给出免费数据源候选与接入边界。
- 前置条件：R0-W08 authority 为 GO；本 Packet 只做文档和证据，不修改产品代码。
- 输入：`backend/src`、`backend/tests`、`backend/config`、`backend/harness`、`.harness/changes` 中 finance/sec/polymarket 相关源码与文档。
- 输出：`summary.md`、`spec.md`、`financial-data-source-audit.md`、`ci_summary.md`。
- 涉及文件：仅 `.harness/changes/docs-r0-w08-fin-data-audit-20260728/`。
- 状态 / 数据变化：无运行时数据变化，无外部请求，无 DB 变化。
- 验证命令与证据：`git diff --check`、`node scripts/harness-doctor.mjs`、只读源码检索。
- 回滚边界：删除本 change 目录即可。
- 完成定义：能够准确回答当前仓已有数据源、免费源候选、缺失项和 W08 边界。

## 任务 2

- 目标：形成后续金融 provider 层最小接入建议。
- 前置条件：不启动 W09，不影响 W08 产品验收。
- 输入：现有 `verified_facts`、`sec_edgar`、`polymarket_lookup`、investment gate。
- 输出：provider registry 字段、fail-closed gates、下一步 FIN-A queue。
- 涉及文件：`financial-data-source-audit.md`。
- 状态 / 数据变化：无。
- 验证命令与证据：文档审查。
- 回滚边界：删除本 change 目录即可。
- 完成定义：明确哪些可继续完善、哪些只允许原型、哪些必须法务/安全复核。
