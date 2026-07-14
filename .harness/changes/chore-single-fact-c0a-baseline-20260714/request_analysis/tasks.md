# Tasks：C0A clean base 与业务入口 inventory

## Task 1 — 固定父提交

- 从 ext 的 exact SHA 创建独立 worktree/branch。
- 记录 SHA、tree、worktree、branch 和 clean 状态。

## Task 2 — RED

- 为 capability governance 增加业务事实面覆盖测试。
- 证明 inventory v1 因缺少 canonical business entry 而失败。

## Task 3 — GREEN

- inventory 升 v2，登记12个 BUSINESS 入口族。
- 保持未知 telemetry 为 null；只允许一个 canonical terminal writer。

## Task 4 — 验证

- 运行专项 Node test、root Harness doctor、JSON/差异检查。
- 记录未实施的 C0B/C0C/C0D。
