# Tasks：唯一事实源融合蓝图

## Task 1 — 本地事实调查

- 阅读全朝廷方案、launch blueprint、Step 0 inventory 与 ADR-001–005。
- 确认仓库/分支/HEAD/dirty 状态和 Blueprint 前置条件。

## Task 2 — 设计与起草

- 冻结一个 canonical 写内核、legacy observation、adapter 和无永久双写原则。
- 输出 C0–C10 依赖图与冷启动步骤。

## Task 3 — 对抗复审

- 独立检查遗漏写面、依赖错误、迁移风险、不可执行验收和首发范围膨胀。
- 关闭全部 CRITICAL，记录其余风险。

## Task 4 — 验证

- 运行 Markdown/diff 检查和根 Harness doctor。
- 更新 CI summary 与最终状态。
