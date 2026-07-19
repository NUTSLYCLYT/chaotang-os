# P21 固定 SHA 独立复审

## 绑定范围

- Packet ID: P21
- Change ID: `docs-canon-idempotency-01-spec-20260719`
- Predecessor integration SHA: `475763a2d24308ca793b44914c8d4f38be651a05`
- Reviewed head SHA: `9c6bd037da82cf2681e1a45f8bd26015e37bcc7f`
- Reviewer: Claude Code Opus（独立 detached worktree，只读）
- Review date: 2026-07-19

`B..H` 恰 14 个新增 Markdown，全部位于本 change 目录。没有恢复
`docs/plans/canon-readiness/`、six-capability blueprint/catalog 或其他产品 SSOT；
无 Python、TypeScript、schema、migration、数据库、provider、KMS 或数据变更。

## 独立执行证据

| 检查 | 独立结果 |
| --- | --- |
| 11 文件 facts regression | 131 passed / 3 skipped |
| D6 回归 | 42 passed / 0 failed |
| 根级 doctor | 0 errors / 0 warnings |
| 前端 doctor | 0 errors / 0 warnings |
| 后端 doctor | 0 errors / 0 warnings |
| `git diff --check` | clean |

审查者确认 v1 的一项 MEDIUM 与三项 LOW 均已关闭：规范性范围不再授权更新退役
SSOT；历史 review 文件名与磁盘一致；`SPEC_READY` 明确不属于当前产品；评分列名明确
为历史草案估算。

## 证据与授权边界

- 六份 `request_analysis/review/` 文件均有历史横幅，不能作为当前集成批准。
- P20 D6 仅扫描 `packet_review/`，不会把历史 review 的 GO/NO_GO 当成终态。
- `atomic-spec.md` 是历史规格证据，不是活跃产品事实源；未来必须重新批准、重做 census、
  另立当前 SSOT 与 runtime change。
- 9/16、26/100 和历史 GO 都有历史限定，禁止宣称已经进入当前产品 KPI。
- runtime/schema/data/provider/KMS/backfill 继续是 `NOT_AUTHORIZED`。

## Findings

无 HIGH。无 MEDIUM。

LOW（仅记录，不改动已受审 H）：

1. tasks 中仍有“更新治理分数/提升 spec count”的历史措辞，但治理评估已明确这些分数
   不写回当前产品 KPI。
2. census 保留原草案基线 SHA，未单独增加历史横幅；文件结尾已明确它是 docs-only
   基线，未来实现必须重做 inventory。

## 结论

证据完整；退役 SSOT 零恢复，历史审查与当前批准隔离，无 runtime 越权或状态夸大。

PACKET_REVIEW_GO
