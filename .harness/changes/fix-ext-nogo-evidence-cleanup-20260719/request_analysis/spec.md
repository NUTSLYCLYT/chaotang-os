# 规格说明：fix-ext-nogo-evidence-cleanup-20260719

## 背景

- 远端 `feature-chaotang-ext` 在 `4b0deee3335f874f98bd83b5b62e67452aed064b` 的合并中重新加入了 6 个此前整合包刻意不携带的旧 change 目录。
- 其中两份 `claude-code-review-1.md` 明确为 `NO_GO`，但没有 `SUPERSEDED_BY`；另外四组分别处于 `READY_FOR_REVIEW`、`DRAFT`、`EXTERNAL_REVIEW_PENDING` 或与 P6.4 重复的状态。
- P6.4 的正式 `review-v1.md` 已证明同根因在 `df21744` 修复并 GO。把旧证据留在当前树会形成两个相互冲突的发布事实源。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 6 个目录共 47 个文件由 `4b0deee` 重新加入；两份明确 NO_GO，无 superseded 标记 | `git diff --name-status e69f279..4b0deee`；逐文件判词扫描 | Codex + 只读子代理交叉核对 | 是 |
| 已确认事实 | 当前 D6 只匹配 `review-vN.md`，看不见 `claude-code-review-*.md` | `scripts/lib/packet-review-local-feedback.mjs:121` | 源码静态核对 | 否（本包人工兜底） |
| 已确认事实 | ledger 已自洽，docs disclaimer 可保留；Alembic review 内容为 GO，但终态行不在最后导致真实 D6 拒绝 | 文件全文、最新-review 全仓扫描、直接 verifier | Codex + Claude | 是（机械规范化） |
| 未知问题 | 无 | 不适用 | 独立复审继续寻找反例 | 否 |

## 数据流与调用链

本包只改变 Git 当前树中的发布证据集合：污染起点 `4b0deee` → 最新发布前驱 `af652e9` → 删除冲突历史证据 → 新 change 记录删除原因与验证 → 独立 review/approval → D6 no-ff 发布。运行时调用链、API 与数据均不变。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| Packet 发布事实 | 根 `.harness/changes/**/summary.md` 与 `packet_review/` | 人工审查、D6、后续 agent | 本包核定的六目录不得继续与其下游 GO 并存；其他命名的历史 review 必须如实披露并单独治理 |
| 历史审计事实 | Git commit history | 事故复盘与追溯 | 删除当前树文件不删除 Git 历史 |

## 范围

删除以下整目录，共 47 个文件：

1. `.harness/changes/feat-menxiasheng-routing-veto-20260717/`（5）
2. `.harness/changes/refactor-department-router-canonical-consolidation-20260717/`（6）
3. `.harness/changes/feat-guoli-thin-slice-20260717/`（5）
4. `frontend/.harness/changes/feat-guoli-thin-slice-20260717/`（13）
5. `.harness/changes/feat-hanlin-min-read-model-20260717/`（13）
6. `.harness/changes/feat-chancellor-llm-routing-recommendation-20260717/`（5）

并机械规范化 `.harness/changes/fix-alembic-single-authority-20260717/packet_review/review-v1.md`：不改变文字与裁决，只把唯一 `PACKET_REVIEW_GO` 移为最后非空行。

## 非目标

- 不回滚 `4b0deee` 的其他运行时、测试或文档成果。
- 不删除或改写正式 GO 的 Alembic 复审结论；只调整终态行位置。架构状态免责声明与已自洽红灯台账不改。
- 不在本包修改 D6；该行为变更需要独立 TDD、复审和顺序发布。
- 不在本包删除 `merge-p6-department-agent-consolidation-20260717/packet_review/independent-review-opus-20260718.md`：它记录的两个实现 blocker 已分别由 P16/P17 关闭，第三项是业主 scope 裁决；但它缺少 superseded 标记且 D6 同样失明。本包把它登记为下一 D6 加固/证据终态治理包的显式输入。
- 不顺带整合 P18，也不触碰主工作树已暂存/未跟踪内容。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 旧 NO_GO 已被下游修复 | 当前树删除旧目录，仅由 P6.4 GO 表达发布终态 | P6.4 review 与删除后扫描 |
| 旧 change 仍需追溯 | 从 Git 历史读取，不在当前树重建 | `git show 4b0deee:<path>` |
| D6 当前失明 | 本包必须叠加人工/Claude 独立复审 | review/approval + D6；下一包补机器闸 |
| 非标准命名历史 NO_GO 仍在当前树 | 不以窄 glob 宣称全树无 NO_GO；披露其 P16/P17 消解关系并移交下一包 | `independent-review-opus-20260718.md`、P16/P17 summary |
| 标准 `review-vN.md` 终态格式 | 每个 change 的最新 review 必须有唯一终态，且最后非空行是 GO 才可发布 | 全仓 latest-review 扫描 + D6 direct verifier |

## 风险与回滚边界

- 风险：误删正式终态证据。控制：只删除只读审计核定的 6 个整目录，精确计数 47；三个保留项单独复核。
- 风险：误把证据清理宣称为运行时修复。控制：summary/CI 明示 runtime 未变。
- 回滚：若审查发现目录仍是活跃事实源，撤销本包删除即可；禁止回滚 `4b0deee` 的其他成果。

## 计划确认记录

- 批准人：业主
- 批准日期：2026-07-19
- 批准范围：全部收口、提交并上传；按 D6 顺序拆分原子包
- 明确未批准：夹带主工作树并行改动；绕过独立复审；将多个 approval 混成一次 push

## 验收标准

1. 六个目录从候选树消失，删除数精确为 47。
2. `git diff` 不包含六目录之外的历史文件删除，也不修改运行时代码。
3. 三个明确保留项存在且内容自洽；Alembic review 仅发生终态行位置规范化。
4. 三层 harness doctor、diff check 全绿。
5. 扫描结论必须限定实际 glob；所有发现的非标准 review NO_GO 要披露处置，不得以偏概全。
6. 全仓每个 change 的最新标准 review 均为唯一、末行 GO；D6 direct verifier 放行。
7. 独立 review 结论为 GO，D6 对最终 no-ff 候选放行后才可上传。

## 验证计划

- `git diff --name-status 4b0deee..HEAD` 与删除计数脚本。
- `rg` 扫描六目录路径与当前树的未消化判词。
- `git diff --check`。
- `node scripts/harness-doctor.mjs`。
- `cd frontend && pnpm harness:doctor`。
- `cd backend && python3 scripts/harness_doctor.py`。
- 独立 Claude Packet Review 与 D6 本地 push verifier。
