# 规格说明：chore-ext-remote-synchronization-20260803

## 背景

EXT 本地主线已经收敛了 W06/W06R/W07/W08 及最新上书房修复，但远端
`origin/feature-chaotang-ext` 仍停留在旧 predecessor。直接 push 被本地
packet-review 门拒绝。需要先建立一次远端同步治理方案，明确历史基线、候选形状和
审查边界；本变更不直接执行 push。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 远端为 `8feae838`，本地为 `47e3802e`，本地领先 237 提交 | `git ls-remote`、`git rev-list` | EXT Master Governance | 是 |
| 已确认事实 | pre-push 要求单一 no-ff merge、第一父为远端 predecessor、单次一个 approval/root change | `node scripts/packet-review-pre-push.mjs --status`、hook 拒绝输出 | EXT Master Governance | 是 |
| 已确认事实 | 当前 activation `d8d8a6ae` 不是远端 predecessor 的祖先 | `git merge-base --is-ancestor` | EXT Master Governance | 是 |
| 未知问题 | 远端是否应接受完整历史，还是需要重新建立同步 activation | 需要治理 owner 决策和独立审查 | 待指定 | 是 |

## 数据流与调用链

本地 EXT exact HEAD → 远端同步候选 → packet-review pre-push → 远端 `feature-chaotang-ext`。
候选必须保持当前审查树不变；任何冲突解决或树变化都必须产生新的实现 HEAD 和新的独立审查。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| EXT git ref | 本地 `feature-chaotang-ext` | `origin/feature-chaotang-ext` | `git rev-parse`、`git diff-tree` |
| 同步候选形状 | packet-review local feedback contract | pre-push hook | first-parent、tree、approval 数量检查 |

## 范围

- 记录远端与本地基线差异。
- 设计单次受控同步候选的 DAG 与验证命令。
- 记录阻塞原因、回滚边界和所需批准。

## 非目标

- 不执行 push。
- 不使用 `git push --no-verify`。
- 不重写或删除本地历史。
- 不修改产品运行时、数据库、部署配置或 3050。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 待填写 | 待填写 | 待填写 |

## 风险与回滚边界

| 直接强推 | 继续被 hook 拒绝，或绕过本地治理 | 保持 BLOCKED，不使用 `--no-verify` |
| 生成合成 merge | 若不满足单一 Packet 规则则继续拒绝 | 先完成治理复核 |
| 远端基线确认后同步 | 只允许 exact candidate 推送 | 需新的 owner approval 与独立 review |

## 计划确认记录

- 批准人：
- 批准日期：
- 批准范围：
- 明确未批准：

## 验收标准

本变更的退出条件是形成可审查的同步方案，并明确是否需要新的 activation/amendment。
它不等价于远端已更新。

## 验证计划

只读审计：`git ls-remote origin refs/heads/feature-chaotang-ext`、`git rev-list --count`、
`node scripts/packet-review-pre-push.mjs --status`、`git diff --check`。
