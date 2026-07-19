# CI 摘要：docs-agentic-workflow-kernel-pattern-adoption-20260719

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `node scripts/harness-doctor.mjs` | 0 | `project-harness-doctor: 0 errors, 0 warning(s)`；`HISTORICAL_AT_3c05aae` | 根级结构、边界、manifest、changes、前后端委托 doctor | 2026-07-19，初始 stacked worktree |
| 8 文件 Markdown 结构/本地链接检查 | 0 | `MARKDOWN_STRUCTURE_OK files=8`；`HISTORICAL_AT_3c05aae` | fence、merge marker、本地链接 | 2026-07-19，Node 只读检查 |
| Decision 关键不变量检查 | 0 | `DECISION_INVARIANTS_OK count=15`；`HISTORICAL_AT_3c05aae` | 状态、双泳道、唯一 M 顺序、benchmark/M10、安全门 | 2026-07-19，Node 只读检查 |
| 临时 `GIT_INDEX_FILE`：`git read-tree` + 精确 `git add` + `git diff --cached --check` | 0 | 8 个预期文档文件；无 whitespace error；`HISTORICAL_AT_3c05aae` | 完整拟提交差异，不污染真实 index | 2026-07-19 |
| Security / Authority / Blueprint 独立终审 | 不适用 | `GO / GO / GO AT 3c05aae`；基线变化后已失效 | 安全、事实权威、唯一路线、future amendment 完整性 | `request_analysis/adversarial-review.md`，2026-07-19 |
| Gitee merge 与 baseline rebind | 0 | `ef9b597...` 双亲、树、产品头祖先关系正确；8 文件 `HASHES_UNCHANGED=yes` | 正式合入、零丢失重绑定、dirty 主工作树隔离 | 2026-07-19，远端引用 + Pattern worktree |
| `node scripts/harness-doctor.mjs`（post-merge） | 0 | `project-harness-doctor: 0 errors, 0 warning(s)`；`HISTORICAL_AT_ef9b597` | `ef9b597...` 上的根级结构与委托 doctor | 2026-07-19，Pattern worktree |
| 8 文件 Markdown 结构/本地链接检查（post-merge） | 0 | `MARKDOWN_STRUCTURE_OK files=8`；`HISTORICAL_AT_ef9b597` | fence、merge marker、本地链接 | 2026-07-19，Node 只读检查 |
| Decision 关键不变量检查（post-merge） | 0 | `DECISION_INVARIANTS_OK count=20`；`HISTORICAL_AT_ef9b597` | 状态、双泳道、唯一 M 顺序、安全门、双层 baseline handoff | 2026-07-19，Node 只读检查 |
| 临时 `GIT_INDEX_FILE` 完整拟提交差异（post-merge） | 0 | 8 个预期文件；`TEMP_INDEX_DIFF_CHECK_OK`；`HISTORICAL_AT_ef9b597` | 全部 tracked + untracked 候选，不污染真实 index | 2026-07-19 |
| Post-merge Authority/Blueprint + Security + Git/Evidence stop-gate | 不适用 | `ALLOW / ALLOW / ALLOW AT ef9b597`；目标漂移后已失效 | 历史磁盘快照、事实权威、安全和 Git 证据 | `request_analysis/adversarial-review.md`，2026-07-19 |
| 提交前目标漂移与第二次 baseline rebind | 0 | `e69f279...` 是 `ef9b597...` 直接子提交；路径无交集；8 文件 `HASHES_UNCHANGED=yes` | 产品/PRD digest 漂移、零丢失重绑定 | 2026-07-19，远端引用 + Pattern worktree |
| `node scripts/harness-doctor.mjs`（e69 final） | 0 | `project-harness-doctor: 0 errors, 0 warning(s)` | `e69f279...` 上的根级结构与委托 doctor | 2026-07-19，Pattern worktree |
| 8 文件 Markdown 结构/本地链接检查（e69 final） | 0 | `MARKDOWN_STRUCTURE_OK files=8` | fence、merge marker、本地链接 | 2026-07-19，Node 只读检查 |
| Decision 关键不变量检查（e69 final） | 0 | `DECISION_INVARIANTS_OK count=24` | 最终状态、双泳道、唯一 M 顺序、安全门、数据入口、风险 namespace、双层 handoff | 2026-07-19，Node 只读检查 |
| Product/PRD 语义对账（e69 final） | 0 | `PRODUCT_PATTERN_SEMANTICS_OK`、`PRD_ENTRY_GATE_REFERENCES_OK`、`DATA_AND_RISK_NAMESPACE_OK` | R0 数据红线、风险口径、R1 cohort/§8.2/OQ 与 Pattern stop-ship | 2026-07-19，精确文档检查 |
| 临时 `GIT_INDEX_FILE` 完整拟提交差异（e69 final） | 0 | 8 个预期文件；`TEMP_INDEX_DIFF_CHECK_OK`；真实 index 为空 | 全部 tracked + untracked 候选，不污染真实 index | 2026-07-19 |
| e69 Authority/Blueprint + Security + Git/Evidence stop-gate | 不适用 | `ALLOW / ALLOW / ALLOW` | 最新磁盘快照、事实权威、安全和 Git 证据 | `request_analysis/adversarial-review.md`，2026-07-19 |

## 结果

产品 PR 已正式合入，Pattern 分支先重绑定到 `ef9b597...`，又因产品一致性修复重绑定到 `e69f279...`。两次工作文件内容均未损失；产品/PRD digest 漂移使 `ef9b597...` 的验证与批准转为历史证据。`e69f279...` 上的机器验证、产品语义对账与独立复审已全部通过，本 documents-only change 可恢复 `VERIFIED_COMPLETE`。

## 未验证项

- M0–M10 exact-HEAD 对账、正式 amendment、六能力 authority reconciliation 与运行时均未执行。
- WorkBuddy 准确目标产品、版本、许可证/商业条款仍待冻结。

## Diff 与回滚复核

- changed files：8 个，均为 Decision、导航或本 root change 文档；前后端运行代码为零。
- diff review：`e69f279...` 临时 index `diff --check` 通过；Authority/Blueprint、Security 与 Git/Evidence 均为 `ALLOW`。
- 回滚是否演练：已复核精确文档删除路径；未执行删除。无运行时、schema、数据迁移或外部状态可回滚。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 来源、双泳道、模式矩阵 | Decision §2–4 | `DOCUMENTED_AND_VALIDATED` |
| 安全与 stop-ship | Decision §5 | `DOCUMENTED_AND_VALIDATED` |
| M0–M10 唯一映射 | Decision §6 | `DOCUMENTED_AND_VALIDATED` |
| benchmark 规格与 amendment 编制协议 | Decision §8–10 | `DOCUMENTED_AND_VALIDATED` |
| 机器验证与独立复审 | 本文件命令表 + `request_analysis/adversarial-review.md` | `VERIFIED_AT_e69f279` |

## 声明状态

- `VERIFIED_COMPLETE / BASELINE_REBOUND / DOCUMENTS_ONLY / RUNTIME_NOT_AUTHORIZED`
