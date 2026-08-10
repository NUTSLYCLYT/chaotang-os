# 规格说明：fix-ext-transparent-promotion-authority-20260810

## 背景

Gitee PR !20 将已验收候选 `ac9ca4c15afc3244aaeee148303574fbc0c145ef` 以标准 no-ff
merge 提升到 `feature-chaotang-ext`。最终提交 `056e588397f5a74a19aa5f7d17f00b3be697604b`
的 tree 与候选完全一致，但候选链成为第二父历史，导致执行权威把内容未变的主线误判为无效。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | PR !20 最终 tree 等于已验收候选 tree | `git show -s --format='%H %T %P' 056e5883...`，2026-08-10 | Project Agent | 否 |
| 已确认事实 | 当前唯一 Doctor 错误是 candidateH 不在 pinned HEAD 第一父链 | `node scripts/harness-doctor.mjs`，2026-08-10 | Project Agent | 是 |
| 已确认事实 | 原批准 candidateH 仍位于推广分支第二父的第一父历史 | hardened Git history check，2026-08-10 | Project Agent | 否 |
| 未知问题 | 无 | 不适用 | 不适用 | 否 |

## 数据流与调用链

`loadExecutionAuthorityV2` → `verifyActivePacketGitIdentity` → 第一父历史检查 → 严格透明推广检查。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| approved candidate Git identity | execution-authority manifest | resolver / CLI / Doctor | candidate H、tree 与 exact diff 继续保持原绑定 |
| transparent promotion topology | Git commit/tree/parent objects | resolver | 两父、祖先关系、tree 相等、candidate 第二父第一父链四项同时满足 |

## 范围

- 新增透明平台推广拓扑识别。
- 新增正向与失效关闭回归测试。
- 更新执行权威文档与变更证据。

## 非目标

- 不修改产品实现、L0 冻结对象、W08 批准证据或 manifest。
- 不接受普通第二父可达、冲突解决 merge、`ours` merge 或无祖先关系的 tree 替换。
- 不清理旧分支、worktree 或用户未提交资产。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| candidate 已在 pinned HEAD 第一父链 | 按原规则通过 | 既有测试 |
| 两父透明推广且 tree 未变 | 通过 | 新增正例 |
| merge tree 与第二父 tree 不同 | 拒绝 | 新增反例 |
| 第一父不是第二父祖先 | 拒绝 | 新增反例 |
| Git 查询失败或对象异常 | 拒绝 | helper fail closed + fsck/既有安全测试 |

## 风险与回滚边界

风险是误把任意第二父可达当成授权延续。控制方式是四项约束全部成立才接受，任何 Git 异常返回 false。
回滚只需撤销本独立提交；不会改变产品 tree 或批准证据。

## 计划确认记录

- 批准人：用户
- 批准日期：2026-08-10
- 批准范围：继续完成 EXT 主线收拢、治理门修复并上传 Gitee。
- 明确未批准：重写历史、降低其他门禁、删除资产或并行开发第二主线。

## 验收标准

1. 真实 PR !20 拓扑被识别为受信透明推广。
2. tree 改写与无祖先关系的伪推广仍被拒绝。
3. authority v2 测试、授权命令、根/后端 Doctor 全部通过。
4. 独立修复经 Gitee PR 合入 EXT，最终本地与远端一致。

## 验证计划

- `node --test scripts/execution-authority-v2.nodetest.mjs`
- `node scripts/execution-authority-v2.mjs --check`
- `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08`
- `node scripts/harness-doctor.mjs`
- `node backend/scripts/harness-doctor.mjs`
- `git diff --check`
