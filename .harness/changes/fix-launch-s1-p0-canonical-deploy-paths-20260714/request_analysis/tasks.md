# 任务：fix-launch-s1-p0-canonical-deploy-paths-20260714

## 任务 1：逐路径 RED

- 目标：让每个 P0 旧部署路径在修复前被机械门禁捕获。
- 输入：六个目标文件中的已确认旧仓名和绝对路径。
- 输出：`scripts/canonical-deploy-paths.nodetest.mjs` 的六个独立子测试。
- 验收：首次运行 0/6 通过，失败分别指向六个目标。

## 任务 2：最小 GREEN

- 目标：只替换代码真源与部署路径，不改变运行行为。
- 输入：canonical repo remote、monorepo 目录结构、RED 输出。
- 输出：六个部署入口全部指向 `chaotang-os`。
- 验收：同一测试 6/6 通过。

## 任务 3：候选 PR 证据循环

- 目标：证明变更可审查且没有越权宣称。
- 输入：候选 branch diff。
- 输出：三层 change 证据与 verification-loop 结果。
- 验收：计划内机械检查通过；未执行生产接管和浏览器检查的原因被记录。
