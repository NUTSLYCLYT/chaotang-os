# 任务：chore-ext-99-branch-convergence-k0-20260803

## 任务 1

- 目标：建立 EXT 99-ref 只读能力融合台账，支持 exact ref 校验、整体状态和 family 投影。
- 前置条件：EXT 基线固定在 `b78a4f8...`；隔离 worktree；v2 对 `R0-W08` 返回 GO；不复制任何 dirty donor 文件。
- 输入：99 个审计源分支、既有 EXT-A9 处置 taxonomy、合并总方案。
- 输出：schema、99-record manifest、47 families、只读 CLI、16 个 Node 行为测试、wiki 和 root Harness registration。
- 涉及文件：`.harness/contracts/ext-branch-convergence.schema.json`、`.harness/manifest/ext-branch-convergence.v1.json`、`.harness/manifest/project-harness.json`、`scripts/ext-branch-convergence.mjs`、测试、wiki、doctor 和本 change record。
- 状态 / 数据变化：只修改 Git 工作区中的版本化治理文件；不修改 refs、Runtime、数据库或外部系统。
- 验证命令与证据：见 `../ci_result/ci_summary.md`；专项 tests、CLI、root doctor、authority、diff check。
- 回滚边界：只移除/反向应用本 Packet 文件；EXT 集成分支和所有 donor refs 不变。
- 完成定义：专项 16/16、CLI PASS 99/47、validator 对任意 JSON 形状为 total function、malformed container/record 在全部 CLI mode 结构化 fail-closed、candidate reachability 与 direct-canonical duplicate relation PASS、root doctor 按获批顺序闭环、独立只读 review GO；在 review 前保持 `IMPLEMENTED_LOCAL / REREVIEW_PENDING`。
