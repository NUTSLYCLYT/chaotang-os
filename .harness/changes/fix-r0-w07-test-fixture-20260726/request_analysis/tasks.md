# 任务：fix-r0-w07-test-fixture-20260726

## 任务 1：测试夹具分支幂等化

- 目标：消除 authority 测试对调用 worktree 当前分支名的耦合。
- 前置条件：本地 EXT exact H `142856e2`；用户批准 test-only remediation。
- 输入：已复现 `fatal: a branch named 'feature-chaotang-ext' already exists`。
- 输出：临时 ref 在不存在或已存在时都精确指向 fixture candidate H。
- 涉及文件：`scripts/execution-authority-v2.nodetest.mjs`。
- 状态 / 数据变化：只改变临时测试仓库；无产品或 authority runtime 状态变化。
- 验证命令与证据：focused test、108 项 authority suite、doctor、W07 STOP。
- 回滚边界：撤销 `-f` 参数。
- 完成定义：全部验证通过且 changed runtime files 为 0。

## 状态

- [x] EXT 分支上下文 RED：107/108，同名分支失败。
- [x] focused GREEN：1/1。
- [x] authority suite GREEN：108/108。
- [x] root doctor：0 errors / 0 warnings。
- [x] W07：`STOP / NO_ACTIVE_WORK_PACKAGE`。
- [x] exact candidate 在临时 `feature-chaotang-ext` clone 中复验：108/108。
- [ ] 独立只读审查与受控 EXT 整合。
