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
| **P8 guoli** | Codex 版在 ext，**带 misleading-LIVE 缺陷**：单条陈旧样本仍标 "LIVE 0% n=1"（`rejected/len(entries)` 全时段、无窗口） | `task/p8-guoli-strip`：窗口化（近7天≥20才 LIVE，否则 STALE/INSUFFICIENT_SAMPLE，拒未来 ts） | ext 有诚实 metadata(window=ALL_RECORDED/as_of) 但仍标 LIVE；我的把陈旧/薄样本降级不标 LIVE | **协调式 front+back+metadata 改动，不是后端单点 port**——见下方更正 |
| **P9 hanlin** | Codex read-model 在 ext | `task/p9-hanlin-remnant`：修了"重置按钮谎报成功"（后端 no-op 却显示已恢复）+ 删死 mock | ext 是否仍有谎报按钮需 Codex 核 | 核 ext 是否已消除谎报;若无,端我的诚实化 |
| **census CEN-01..05** | ext census.md **无** MANOR-01/EXT-04/显式排除 | `task/census-cen-revision`：补完整性(庄园/御座/jiqun_ai/webhook)+P0–P9对账 | ext 冻结名单不完整 | 采纳我的 CEN 增补(纯 docs) |

## 立即可做（零风险）
```
# gongbu 物理安全——Codex 的 mid-merge 一清即可一键采纳:
git merge integration/gongbu-safety-20260718
```

## 需 owner 端（不该我机械合）
- **guoli honesty**：ext 现在对外会把陈旧/单条数据标 LIVE。这是**真缺陷**,但修它是**协调式
  front+back+metadata 改动,不是后端单点 port**。我上一版"端进后端、保留 Codex 的 fact_metadata"
  的建议**是错的**（Codex 复审指出,已更正）——原因两条:
  1. **时间窗口会被误标**:若比率改成近 7 天窗口计算,但 fact_metadata 仍是 Codex 的
     `window.kind="ALL_RECORDED"` + `_timestamp_bounds` 全时段 start/end,则**元数据说全时段、
     数值却是7天窗**,自相矛盾、对外误标。窗口一改,metadata 必须同步改成 rolling-7d 的边界。
  2. **前后端契约会破**:新增 `STALE`/`INSUFFICIENT_SAMPLE` 状态 + `value=null` + `sample_size`
     改为近窗计数——ext 现有前端(Codex 的)只认 `LIVE`/`NO_DATA`,不处理新状态,会渲染错。
  **两个"看似简单"的选项都是错的(各自会退化):**
  - ✗ **后端单点 graft**(把我的窗口化端进 ext 后端、保留 Codex metadata):窗口误标 + 破前端契约(见上)。
  - ✗ **整体采纳我的 P8**(第一版更正曾误列为"正确"——Codex 复审再次指出,错):我的 guoli.py
    **缺 ext 已有的两样**——(i) corrupt-ledger `try/except(OSError,ValueError)` 故障保护(我直接
    `truth_ledger._load()`,坏账本 → 500);(ii) `fact_metadata`(window/as_of/includes_demo)契约字段。
    整体替换会**退化故障保护 + 丢既有契约字段**。
  - ✓ **唯一正确路径 = 综合两版优点的协调改动(由 guoli owner=Codex 做)**:
    1. **保留** ext 的 corrupt-ledger try/except 故障保护 + fact_metadata 契约字段;
    2. **加入** 我的诚实窗口化(past/recent、`_MIN_SAMPLE=20`、7天 recency、拒未来 ts →
       STALE/INSUFFICIENT_SAMPLE、比率只用近窗);
    3. **同步** window metadata 改成近窗口径(rolling-7d 边界,不再 ALL_RECORDED,避免误标);
    4. **前端** 加 STALE/INSUFFICIENT_SAMPLE 渲染;
    5. **契约测试** 覆盖新状态 + 故障保护 + 窗口 metadata 一致性。
    五处一起,不能只改一处。ext 目前对外撒 LIVE 谎必须修,但修法是这个综合,不是二选一取代。
- **P9/census**：选事实源后我可把我的版本做成干净集成分支(像 gongbu),或 Codex 端进去。

## 阻塞
ext 工作树 Codex **mid-merge**（.git/MERGE_HEAD，AA summary.md 未解）——任何合入等它清。

## 根因（防复发）
两个自主 agent 无协调地并行做同一批 packet = 必然分叉。下次:一个 packet 一个 owner，
写者/审查者不能同时各写一份实现。
