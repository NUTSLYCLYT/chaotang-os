# P25 固定 SHA 独立复审报告 v1

## 绑定范围

- Packet ID: P25
- Change ID: `fix-canon-idempotency-authority-p25-20260719`
- Predecessor integration SHA: `023f198077a0fb6928f554ed1be81b1afb819f40`
- Reviewed head SHA: `70386d38a3b3693540959a0812bd1df26b1bf59f`
- Reviewer: Codex 独立只读 reviewer
- Review date: 2026-07-19

H 是 B 的单亲直接后继。`B..H` 修改 P21 change 内 7 份 Markdown，并新增一个 P25 root change、6 份 Markdown；未修改 P21 原 `packet_review/`，也未触及产品文档、前后端实现、测试、schema、migration 或数据。

## 历史裁决

- `7daf36b^` 精确为共同祖先 `4b0deee`。
- `merge-base(7daf36b, af652e9)` 精确为 `4b0deee`。
- P19 的 B..M 只删除核定的六个旧 change 目录、共 47 个文件，并机械调整一份既有 review 终态行。
- P19 对 ABS-02P、PRIV-01、CANON readiness 和六能力父文档没有删除事件；这些内容位于未集成的 `7daf` 兄弟线。
- P21 的 archive-only review 对其原精确 B/H 有效，但未批准 current authority。P25 通过新的固定 SHA 审批链 supersede 该解释，没有改写历史审批。

结论：P19、`7daf` 与 P21 的关系可由 commit graph、merge-base 和路径 diff 独立复算，P25 没有 revert P19 或制造 retroactive approval。

## 范围与事实源

| 检查 | 独立结果 |
| --- | --- |
| H 父提交 | 精确等于 B |
| 新增 root change | 仅 `fix-canon-idempotency-authority-p25-20260719` |
| P21 `packet_review/review-v1.md` | 相对 B 零 diff，blob hash 不变 |
| P21 `packet_review/approval-v1.json` | 相对 B 零 diff，blob hash 不变 |
| current engineering authority | 唯一指向 P21 `atomic-spec.md` |
| 产品 SSOT | 未创建、未恢复 |
| runtime 状态 | `ABSENT / NOT_IMPLEMENTED / NOT_AUTHORIZED` |
| `docs/`、`frontend/`、`backend/` | 零 diff |
| tests/schema/migration/data | 零 diff |
| `git diff --check` | PASS |

P25 将 `atomic-spec.md` 定义为现行工程规格，符合 `docs/README.md` 对技术实施方案归 harness/changes 的规则。它没有把规格冒充产品事实源、运行实现、外部 exactly-once 或业务交付。

## 旧 MEDIUM 关闭复核

旧 H 的 `atomic-spec.md` 曾写“删除本 change 证据即可”，会允许唯一 authority 被无替代删除。

新 H 已将 Rollback 冻结为：

- P25 文档纠偏只能由后续获批 change 取代；
- 当前唯一工程 authority 不得无替代删除；
- 回滚或迁移必须指定等价或更严格的 successor authority；
- production claim 出现后禁止 destructive downgrade；
- runtime 只能关闭新写入并 fail closed、保留 ledger/readers、采用 forward-fix。

该表述与 P21 `rollback.md`、P25 rollback、STOP 条件和执行权限一致。旧 MEDIUM 已关闭。

## 验证证据

| 检查 | 结果 |
| --- | --- |
| focused current-facts regression | `72 passed, 4 skipped` |
| 根级 harness doctor | `0 errors, 0 warnings` |
| backend harness doctor | `0 errors, 0 warnings` |
| packet-review gate 回归 | H 中记录 `42 passed, 0 failed` |
| whitespace/path scope | PASS |

独立 reviewer 环境重跑 packet-review gate 时，临时 Git 仓库创建受到沙箱 `spawnSync git EPERM` 限制；这是 reviewer 环境限制，不是测试断言或候选树失败。该套件未被 P25 修改，H 中保留了成功执行证据，最终候选仍须由 D6 直接验证。

## 100/100 与审批边界

- `100/100` 只表示 P25 authority 文档纠偏闭环在 review、approval、候选 merge 与 D6 全部完成后的条件性状态。
- Idempotency runtime 明确为 `0/100`。
- 六能力全局综合治理没有统一 rubric，不宣称分数。
- 本 Packet 未授权代码、schema、migration、数据库、KMS、provider、真实数据、部署或 plaintext 数据处理。
- 后续 runtime 必须另立 change、重做 census，并满足 atomic spec 的领域、安全、数据治理和 L1–L3 门禁。

## Findings

无 HIGH。无 MEDIUM。

旧 MEDIUM 已在新 H 精确关闭。范围、历史、authority 唯一性、回滚/STOP、评分口径和授权边界一致，准予创建仅含 P25 review 与 approval 的 review-only commit，并进入 no-ff candidate D6。

PACKET_REVIEW_GO
