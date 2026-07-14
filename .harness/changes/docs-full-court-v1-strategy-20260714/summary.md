# 变更摘要：docs-full-court-v1-strategy-20260714

| 字段 | 值 |
| --- | --- |
| Change ID | docs-full-court-v1-strategy-20260714 |
| 类型 | docs |
| 状态 | APPLIED |
| Owner | Project Agent（用户 2026-07-14 裁决） |
| 创建日期 | 20260714 |

## 裁决内容

开发路线由"只做刑部首发切片"调整为 **FULL_COURT_V1 全朝廷全功能内测集成**：

- 功能宇宙现在冻结（FULL_COURT_V1），新想法只进 `docs/plans/FULL_COURT_V2_BACKLOG.md`；
- 上线范围以后决定（全量跑通后按七维评分收敛 GA/Beta/Internal/Deferred/Retired）；
- 发散的是产品能力，不是代码事实源；重复实现只保留一个 canonical owner；
- 所有功能至少 L3（接入统一 DecisionTask 主链），核心 L4；
- 旧蓝图中"非刑部禁止开发/第二切片解冻门"自此只约束发布范围，不约束开发范围；
- 单写者、单一事实链、不伪造 LIVE、人工圣裁等安全约束不变。

完整战略见本目录 `strategy.md`。

## 范围

- 主线：跨线（根级产品策略）
- 文件：
  - `docs/product/CHAOTANG_CONVERGENCE_GUIDE.md`（顶部新增"2026-07-14 开发策略裁决"节）
  - `docs/plans/chaotang-os-launch-blueprint-2026-07-14.md`（头部新增范围裁决注记）
  - `.harness/changes/chore-evidence-driven-shangshufang-workflow-20260714/blueprint.md`（头部新增范围裁决注记）
  - `docs/plans/FULL_COURT_V2_BACKLOG.md`（新建）
  - 本目录 `strategy.md`、`codex-census-prompt.md`、`claude-census-review-prompt.md`
- 验证：`node scripts/harness-doctor.mjs`（纯文档变更，无代码/契约改动）

## 下一步

1. **主线归并作战（用户 2026-07-14 已批准先行）**：Codex 执行 `codex-absorption-plan.md`（P0–P7，逐 Packet 停下等 Claude 审查，审查报告落 `packet-reviews/`）；审查依据 `mainline-absorption-review.md`。
2. Codex 执行 `codex-census-prompt.md`（只读盘点）→ `CENSUS_READY_FOR_CLAUDE_REVIEW`；
3. Claude Code 按 `claude-census-review-prompt.md` 独立审查 → `CENSUS_REVIEW_GO`；
4. GO 后生成统一底座（Wave 1）剩余 Task Packets，继续 `integration/full-court-v1`。
