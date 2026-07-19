# 规格说明：fix-canon-idempotency-authority-p25-20260719

## 背景

中央 P21 已把完整 CANON-IDEMPOTENCY-01 原子规格合入 root change，但把它定性为 archive-only。该定性依赖两条不成立的事实：“P19/最新远端已退役 CANON 文档”和“业主明确裁定只保留历史证据”。Git 审计显示 P19 只清理六个冻结旧 change 目录；CANON/ABS/PRIV 文档只存在于从未集成的 `7daf` 兄弟线。用户批准的是继续治理和收口，不是制造退役事件。

同时，中央 `docs/README.md` 要求技术实施方案归对应 harness/changes。因此正确状态不是恢复 `docs/plans` 产品 SSOT，而是让 P21 `atomic-spec.md` 成为 current engineering authority，并继续明确 runtime 未实现。

## 当前实现与证据

| 分类 | 结论 | 证据 | 是否阻塞 |
| --- | --- | --- | --- |
| 已确认事实 | P19 对 ABS/PRIV/CANON/六能力文档 diff 为 0 | `authority-adjudication.md`、P19 B..M | 阻塞错误 archive 叙述 |
| 已确认事实 | `7daf` 与 P19 线从共同祖先分叉，从未进入中央 | merge-base/commit graph | 阻塞“中央删除”叙述 |
| 已确认事实 | P21 review 只批准 archive-only 集成 | P21 immutable review/approval | P25 必须新审批 |
| 已确认事实 | P21 `atomic-spec.md` 内容已双领域 review GO，runtime 仍 absent | P21 spec/reviews/census/tests | 可作为 current engineering spec |
| 未知问题 | production KMS、retention、scope material fields、真实迁移 | 无获批政策或实现 | 阻塞 runtime，不阻塞 P25 |

## 目标事实源

```text
P21 packet review/approval
  -> 只证明 P21 当时的 archive-only B/H/R/M 合法

P25 authority adjudication + new review/approval
  -> supersede P21 authority interpretation
  -> P21/atomic-spec.md = current engineering spec
  -> runtime remains absent and separately gated
```

## 范围

- 纠正 P21 当前树的错误状态和解释。
- 保留旧 P21 review/approval 原文与 Git 历史。
- 建立工程规格的唯一当前路径；不创建产品 SSOT。
- 诚实区分 P25 文档治理 100/100 与 runtime 0/100。

## 非目标

- 不恢复 `7daf` 全部 14 个 durable docs 或 58 个历史 change evidence。
- 不 revert P19，不复活其六个旧目录。
- 不改 Idempotency 规格的技术 contract 主体。
- 不实现代码、schema、migration、KMS、adapter、数据迁移或 deployment。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 阅读 P21 summary/spec | 能找到 P25 supersede 与 current authority | exact text review |
| 阅读 P21 packet review | 保持 P21 当时 archive-only 批准原文 | zero diff on packet_review paths |
| 查找 current authority | 只指向 P21 `atomic-spec.md` | repository grep |
| 查找 runtime 状态 | 始终 absent/not implemented/not authorized | status consistency grep |
| 查看 `docs/plans` | P25 零新增/零修改 | exact path diff |

## 风险与回滚边界

- 最大风险是把 P25 写成 P21 当时已经批准 current authority；必须明确 P25 是新裁决，P21 review 不变。
- 次要风险是“current engineering spec”被误读成 runtime implementation；所有入口必须并列 `RUNTIME_ABSENT / NOT_AUTHORIZED`。
- P25 回滚可恢复 P21 当前树到 archive-only，但这会重新引入已证伪叙述，只能通过后续有审批的 change 执行。

## 计划确认记录

- 批准人：业主。
- 批准日期：2026-07-19。
- 批准范围：继续任务、采用推荐技能与大神建议、综合治理收口并提交上传。
- 明确未批准：代码、schema、migration、数据库、真实数据、KMS、provider 或部署。

## 验收标准

1. P19/7daf/P21 历史叙述精确，可由 commit/path diff 复算。
2. P21 `atomic-spec.md` 是唯一 current engineering authority；`docs/plans` 无变化。
3. P21 原 packet review/approval 无 diff；P25 有独立固定 SHA review/approval。
4. runtime/status/权限边界一致，无实现夸大。
5. tests、doctors、diff/path scope 与 D6 全绿。

## 验证计划

- 运行 P21 focused facts regression，确认 census 未漂移。
- 运行 root/backend harness doctor。
- 检查 P19 exact allowlist、P21 packet_review zero diff、唯一 current authority 和 `docs/plans` zero diff。
- 提交 H 后由独立 reviewer 审精确 B..H；只允许 R 添加 P25 review/approval。
- 以 base 为 first parent 构造 no-ff M，运行 D6 后上传。
