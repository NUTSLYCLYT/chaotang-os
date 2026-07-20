# 规格说明：fix-r0-execution-authority-20260720

## 背景

产品 PRD 为 `FROZEN_PRODUCT_SCOPE / IMPLEMENTATION_REQUIRES_AMENDMENT`，但当前主线没有机器可读 execution authority。旧 `task/fix-p0-p15-execution-authority-reconciliation-next-20260719` 基于旧 HEAD、复用 P25 且最终 exact-tree review 未完成，只能作为设计素材。G0 新护栏必须在当前集成 HEAD 重制，并永远保持未激活。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 主线缺少 manifest/schema/resolver/consumer | RED：`node --test scripts/execution-authority.nodetest.mjs` 因 module not found 失败，2026-07-20 | Codex 实跑 | 是 |
| 已确认事实 | 旧强分支与当前集成线 3/3 分叉，Packet ID P25 冲突 | `git rev-list --left-right --count`、旧 change 与主线 P25 | 只读审计 | 是 |
| 已确认事实 | 真实集成基线为 `4ed5a037...`，`origin/HEAD` 仍指旧 master | `git rev-parse`、`git symbolic-ref refs/remotes/origin/HEAD` | Codex 实跑 | 否 |
| 未知问题 | 托管平台 required check/非提交者强制复核是否启用 | 仓库代码无法证明 | Repo 管理员 | 是，限制 ENFORCED 声明 |

## 数据流与调用链

`AGENTS/project-owner/workflow` → `node scripts/execution-authority.mjs --authorize` → loader 严格读取 schema/manifest/所有受管文档与 14 个计划 → 校验 exact shape、摘要、扁平 inventory、普通文件/无 symlink → resolver 固定输出 `STOP / canExecuteCanonicalPlan:false`。根 doctor 消费同一 loader/resolver。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `execution-authority.v1` | `.harness/manifest/execution-authority.v1.json` | CLI、project owner、root doctor | v1 只有 `AMENDMENT_REQUIRED/INACTIVE/null`，没有 ACTIVE 路径 |
| JSON Schema | `.harness/contracts/execution-authority.schema.json` | resolver、reviewer | Draft 2020-12；additionalProperties=false |
| Resolver | `scripts/lib/execution-authority.mjs` | CLI、doctor、tests | strict JSON、digest、inventory、path 与内容语义 fail closed |

## 范围

只处理根级执行权威治理护栏。允许修改根 `.harness/`、`scripts/`、`AGENTS.md`；不进入前后端 runtime。

## 非目标

- 不激活 amendment。
- 不合并旧 authority WIP。
- 不修改 14 份历史计划正文。
- 不创建或复用 P/PKT 编号。
- 不修改远端默认分支、生产运行或客户数据。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| v1 出现 ACTIVE 或非空 approval | resolver/CLI/doctor 全部 STOP | Node 负例 |
| 新增、缺失、嵌套或 symlink plan | inventory/path 校验 STOP | Node 集成与路径负例 |
| 根入口或 R0 PRD 删除 amendment 语义 | 内容针与 digest 校验 STOP | Node 负例 |
| change/Packet/review 写 GO | 不改变 resolver 决策 | unknown field/activation 负例 |

## 风险与回滚边界

风险：同仓 checker 无法防止同一恶意提交同时删除 checker；必须靠 Claude Code 非实现会话和托管平台分支保护复核。回滚为整包 revert；v1 仅增加 inactive guard，不迁移业务数据。

## 计划确认记录

- 批准人：项目业主（用户）
- 批准日期：2026-07-20
- 批准范围：先完成 G0，一个包闭环后继续全部；采纳省 Token/TDD/verification；Claude Code 独立审查。
- 明确未批准：真实客户材料、生产部署、远端默认分支修改、历史分支/worktree 删除。

## 验收标准

- v1 没有自激活路径，`--authorize` 必须退出 2 并返回 STOP。
- 14 个计划全部且仅一次登记，canonical 顺序固定。
- 根入口、产品宪法、R0 PRD 和消费者策略绑定摘要与关键未授权语义。
- root/frontend/backend doctor 通过。
- Claude Code Authority/Security/Git-Evidence 三路对同一 exact HEAD 给出无 HIGH/MEDIUM 阻塞结论。

## 验证计划

Node syntax/test → CLI check/authorize → root/frontend/backend doctor → git diff/check → 冻结 SHA/tree/diff digest → Claude Code 三路只读审查 → 修复后重跑。
