# approvals-20261007 归档说明

## 归档对象

- `CT-G3-HARNESS-FINGERPRINT-20261006.json`（原位于 `.harness/approvals/`）
- `CT-G3-PUSH-MERGE-SYNC-REMOTES-20261006.json`（原位于 `.harness/approvals/`）

## 原因

两份 manifest 的 `request.productPaths` 均包含 `scripts/check_harness.mjs`。
按 `scripts/product-authority.mjs` 的 `PROTECTED_PRODUCT_PATHS` 规则，M0 approval
永远不能把 harness 自身文件列为 product path——即这两份记录**按现行规则结构性不可修复**，
继续留在 `.harness/approvals/` 会使 `check_harness` 长期红灯
（`PRODUCT_PATH_PROTECTED`；PUSH-MERGE 另有 `REQUEST_BASE_INVALID`：
`baseCommit` 记录为短 SHA 且与记录的 `baseTree` 不属于同一提交）。

## 处置

2026-10-07 owner 授权"灭红灯"清理（含 hash 常量同步、无效 manifest 处置、任务文档补章）。
记录**原样归档**于此（一字未改），仅移动位置以脱离 M0 manifest 扫描范围；
历史审计不受影响，两份记录对应的 2026-10-06 工作均已经 owner 会话确认并完成推送
（见提交 `2956be3a`、`a617c93d` 及 `CT-G3-PUSH-RESUME-AFTER-REINSTALL-RECOVERY-20261006.json` 的验证记录）。

**教训（写给未来 agent）**：M0 approval 不覆盖 harness 自身；harness 修改属
owner 直接治理动作，不要用 M0 manifest 模板登记。短 SHA、未排序路径、
非白名单工具名（仅允许 node/npm/python3）、超 300s 的 timeoutMs 均为无效格式。
