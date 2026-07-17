# 并行分叉决策交接单（2026-07-18）

> 两个自主 agent（Codex 写者 + Claude/Opus 审查+独立实现）并行做了同一批 packet，
> 各自造了不同版本。**机械合并不可行**——同一功能两套实现，必须逐个选事实源。
> 本单给你 + Codex 收敛用。gongbu 物理安全已干净解耦交付,其余是决策。

## 逐 packet 状态

| Packet | ext（Codex 版）现状 | 我的版本 | 关键差异 | 建议 |
| --- | --- | --- | --- | --- |
| **P6 测试隔离** | ✅ 已在 ext（conftest FENGQUN_RUNTIME_ROOT + 守卫） | 同（已被合入） | 无分叉 | 无需动 |
| **P7 收官对账** | Codex closeout 在 ext | 我出过独立复审 GO | 无冲突 | 保留 ext |
| **gongbu 电池安全** | ❌ ext 无任何电池安全修复 | `integration/gongbu-safety-20260718`（唯一、干净、54 passed） | 只有我做了 | **采纳我的**（零冲突，一键合） |
| **P8 guoli** | Codex 版在 ext，**带 misleading-LIVE 缺陷**：单条陈旧样本仍标 "LIVE 0% n=1"（`rejected/len(entries)` 全时段、无窗口） | `task/p8-guoli-strip`：窗口化（近7天≥20才 LIVE，否则 STALE/INSUFFICIENT_SAMPLE，拒未来 ts） | ext 有诚实 metadata(window=ALL_RECORDED/as_of) 但仍标 LIVE；我的把陈旧/薄样本降级不标 LIVE | **把我的 `_yushi_rejection_rate` 窗口化端进 ext 的 guoli**（由 guoli owner=Codex 做,避免 3-way Frankenstein + 撞坏其测试）；前端卡任选一版 |
| **P9 hanlin** | Codex read-model 在 ext | `task/p9-hanlin-remnant`：修了"重置按钮谎报成功"（后端 no-op 却显示已恢复）+ 删死 mock | ext 是否仍有谎报按钮需 Codex 核 | 核 ext 是否已消除谎报;若无,端我的诚实化 |
| **census CEN-01..05** | ext census.md **无** MANOR-01/EXT-04/显式排除 | `task/census-cen-revision`：补完整性(庄园/御座/jiqun_ai/webhook)+P0–P9对账 | ext 冻结名单不完整 | 采纳我的 CEN 增补(纯 docs) |

## 立即可做（零风险）
```
# gongbu 物理安全——Codex 的 mid-merge 一清即可一键采纳:
git merge integration/gongbu-safety-20260718
```

## 需 owner 端（不该我机械合）
- **guoli honesty**：ext 现在对外会把陈旧/单条数据标 LIVE。修法=把 `task/p8-guoli-strip` 的
  `_yushi_rejection_rate`（past/recent 窗口 + `_MIN_SAMPLE=20` + 7天 recency + 拒未来 ts →
  STALE/INSUFFICIENT_SAMPLE，比率只用近窗）端进 ext 的 guoli.py（保留 Codex 的 corrupt-ledger
  try/except + fact_metadata）。**这是缺陷修复,不是口味**——ext 目前撒 LIVE 谎。
- **P9/census**：选事实源后我可把我的版本做成干净集成分支(像 gongbu),或 Codex 端进去。

## 阻塞
ext 工作树 Codex **mid-merge**（.git/MERGE_HEAD，AA summary.md 未解）——任何合入等它清。

## 根因（防复发）
两个自主 agent 无协调地并行做同一批 packet = 必然分叉。下次:一个 packet 一个 owner，
写者/审查者不能同时各写一份实现。
