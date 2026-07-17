# 规格说明：fix-p5-1-literal-normalization-repair-20260717

## 背景

P5.1 的旧实现头 `64a2369` 把引号内 SQL 字符串统一 `.lower()`，导致
`IN ('OPEN')` 与 `IN ('open')`、默认值 `'OPEN'` 与 `'open'` 被误判等价。
虽然修复头 `8ae79eb` 已获独立 Claude review-v2 GO，权威远端
`origin/feature-chaotang-ext` 当前仍为含旧实现的 merge `bbb1000`。共享远端历史
不做重写；本包必须从该精确远端前序建立可 fast-forward 修复。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 远端 ext 精确为 `bbb1000`，含 `64a2369` 旧实现 | `git ls-remote origin refs/heads/feature-chaotang-ext`；2026-07-17 | Git / Project Agent | 是 |
| 已确认事实 | 旧 CHECK/default 规范化会把仅字面量大小写不同的语义折叠 | blocker 文档与旧 RED 复现 | pytest + 独立 Claude | 是 |
| 已确认事实 | `8ae79eb` 保护引号内内容并已获精确头 GO | P5.1 `review-v2.md` / `approval-v2.json` | Claude Code 独立复审 | 否 |
| 已确认事实 | P6 工作树有 26 项未提交工作，当前冻结在 `bbb1000` | P6 `git status --short` | 只读 Git | 否；本包不触碰 |
| 未知问题 | PostgreSQL 方言上的 adoption 行为 | 本包不连接真实 PostgreSQL | 登记未验证 | 否；生产 strict 边界延续 |

## 数据流与调用链

`remote bbb1000 -> literal-safe normalization repair -> exact-head review -> review-only commit -> clean no-ff candidate -> fast-forward ext`

`P6 dirty worktree -> 保持冻结 -> ext 修复完成后复制到修复后的集成基线 -> P6 独立复审`

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| CHECK/default SQL 文本 | SQLite inspector + Alembic 迁移 DDL | unversioned database adoption | 引号外关键字/空白可规范化，引号内内容原样 |
| `source_label` 默认值 | 006/009 migrations 的 `FALLBACK` | `_EXPECTED_SERVER_DEFAULTS` | 精确大小写比较 + adoption e2e |
| ext 前序 SHA | `git ls-remote origin` | packet approval / merge candidate | 必须精确绑定 `bbb1000` |

## 范围

- 移植 `8ae79eb` 已审的生产修复与两条负例。
- 带入 NO_GO/blocker/incident 证据，并纠正远端已污染的事实。
- 新建根级修复记录，重新验证和审查 `bbb1000..repair-H`。

## 非目标

- 不重写或 force-push 远端历史。
- 不恢复或修改 P6 的未提交实现。
- 不顺便修复 reviewer 登记的 `datetime('NOW')`、括号剥离、既有
  `current_timestamp` 字面量碰撞或单向测试锁；这些另立包。
- 不连接、迁移、备份真实数据库，不启动或重启服务。
- D6 悬挂 NO_GO 终检另立 gate 变更，本包只记录并在 ext 修复后实施。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| CHECK 字面量仅大小写不同 | 必须判不等价 | 定向负例 + SQLite CHECK 实证 |
| DEFAULT 字面量仅大小写不同 | 必须判不等价 | 定向负例 |
| SQL 关键字/引号外空白不同 | 仍应判等价 | 对抗性正例 / adoption e2e |
| 修复候选基线漂移 | 立即停止，重新绑定与复审 | `git ls-remote` + approval SHA |
| P6 或主工作树存在脏改动 | 不读取为事实源、不修改、不清理 | 隔离 repair worktree |

## 风险与回滚边界

风险是再次把 review-v2 的文档结论误当成代码已经进入 ext，或在合并时改变被审树。
因此审批绑定精确 B/H 与报告摘要，review-only commit 只能新增报告和信封，最终 merge
tree 必须与 review commit tree 相同。回滚仅为 revert 新 fast-forward merge；本包不执行
真实数据迁移，数据库回滚不适用。

## 计划确认记录

- 批准人：用户
- 批准日期：2026-07-17
- 批准范围：停止 P6，回修 P5.1；复审 GO 前不得合 ext；GO 后按安全顺序继续。
- 明确未批准：真实数据库/服务操作、force-push、丢弃 P6 未提交工作。

## 验收标准

1. `bbb1000..repair-H` 包含已审字面量修复与两条负例，且不含 P6 内容。
2. 旧实现两条负例 RED；repair-H 两条及 adoption 文件 GREEN。
3. 007–015 代表集、静态检查和两层 doctor 通过；范围外既有红灯单独登记。
4. Claude 对精确 `B=bbb1000`、`H=repair-H` 给出新的 `PACKET_REVIEW_GO`。
5. review-only 与 merge candidate 满足本地反馈闸，远端漂移为零后才可 push。

## 验证计划

- 定向 adoption 回归与旧函数 RED 复现。
- authority/adoption/007–015 代表集、Ruff、compileall。
- `backend/scripts/harness_doctor.py` 与根 `scripts/harness-doctor.mjs`。
- 独立 Claude 只读全差异审查，复核 remote SHA 与 clean tree。
