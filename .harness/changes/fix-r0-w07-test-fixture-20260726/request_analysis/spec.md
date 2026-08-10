# 规格说明：fix-r0-w07-test-fixture-20260726

## 背景

Reviewer reassignment overlay fast-forward 到本地 EXT 后，authority 全量测试为
`107/108`。唯一失败的临时仓库从 EXT worktree 克隆，已自带
`feature-chaotang-ext`，随后使用非幂等 `git branch` 再次创建同名分支而失败。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | exact tree 在治理分支通过，在 EXT 分支上下文因同名临时分支失败 | `node --test ...`，2026-07-26 | Codex 已复现 | 是 |
| 已确认事实 | authority、overlay、ledger 和 W07 STOP 门禁通过 | amendment checker、doctor、v2 authorize | Codex 已验证 | 否 |
| 推测 | 无 | 不适用 | 不适用 | 否 |

## 数据流与调用链

测试克隆仓库 → detached checkout 冻结基线 → 生成临时候选 commit →
将临时 `feature-chaotang-ext` ref 指向候选 → 构造注册/激活证据。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| 临时 EXT ref | 测试夹具 | W07 端到端 authority fixture | `git branch -f` 在 ref 缺失或已存在时都绑定 exact candidate |

## 范围

只修改 `scripts/execution-authority-v2.nodetest.mjs` 的临时分支创建参数，
并维护本 change record。

## 非目标

- 不修改 authority 运行时代码、manifest 或 overlay。
- 不激活 W07。
- 不修改产品代码。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 临时分支不存在 | 创建并指向 candidate H | focused test |
| 临时分支已由 EXT clone 创建 | 强制更新并指向 candidate H | EXT 分支上下文全量测试 |

## 风险与回滚边界

风险限于测试夹具错误地移动临时 ref；fixture 已 detached checkout，且后续验证要求
ref 精确等于 candidate H。回滚为撤销测试文件的一行参数变更。

## 计划确认记录

- 批准人：lyt
- 批准日期：2026-07-26
- 批准范围：isolated test-only remediation、TDD、单一测试文件。
- 明确未批准：W07 activation、运行时代码、push、deploy、DB migration、3050。

## 验收标准

EXT 分支上下文 focused test 与 108 项 authority suite 全部通过；doctor 0/0；
W07 仍 STOP；diff 仅测试文件和 Packet。

## 验证计划

1. focused EXT-context regression。
2. 三套 authority tests。
3. amendment checker 与 root doctor。
4. v2 check 和 W07 authorize STOP。
5. exact diff/status review。
