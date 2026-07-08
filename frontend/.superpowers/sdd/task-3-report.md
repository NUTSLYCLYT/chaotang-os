# Task 3 实施报告 — 上书房引用旧案徽章 + 史馆空态 CTA

**Commit:** 41d2c55
**tsc:** 0 errors
**build:** 成功 (Next.js Compiled)
**分支:** feat/shiguan-value

---

## 1. retrospectiveStatus 透传链路

Task 1 已在 archive-store.ts 的 findSimilarCourtArchives 把 shiguan_archives.retrospective_status 映射到 PriorCase.retrospectiveStatus。Task 3 补完了后续断点：

- local-decision-loop.ts LocalDecisionRecord.archive_hints[] 新增 retrospectiveStatus?: string
- draft-edict/route.ts 在 priorCases.map 加 retrospectiveStatus: item.retrospectiveStatus
- jiqun-api.ts ShangshufangDraftResponse.archive_hints[] 新增 retrospectiveStatus?: string
- ShangshufangPage.tsx draftEdictToView 消费 item.retrospectiveStatus 生成 outcomeLabel

链路：shiguan_archives.retrospective_status → PriorCase.retrospectiveStatus（Task 1）→ LocalDecisionRecord.archive_hints[].retrospectiveStatus（Task 3）→ API response → draftEdictToView 渲染文本

---

## 2. 徽章克制策略（铁律4）

徽章在 draftEdictToView 的 meta.badges 里，仅在 result.archive_hints?.length > 0 时插入：
  { label: `引用旧案 ${result.archive_hints.length} 条`, tone: 'blue' }

克制手段：
- tone 选 'blue'（信息蓝，最低调 tone），不用金/红
- 只显计数，无放大、无 boxShadow、无 blastRadius
- 0 条时不渲染（三目短路），不冒充有先例
- 旧案结果在正文 rows 里，不在徽章，避免把结论推到视觉重心

outcomeLabel 逻辑（不编造）：
  retrospectiveStatus && != 'not_started' → 原值（达成/未达成/部分）
  否则 → '未回填'

正文格式：《[原问题]》· 上次结果：[outcomeLabel] · [裁决] · [来源]

---

## 3. 史馆空态 CTA

chronicleRows.length === 0 时，在 TimelinePanel 上方渲染：
- 文字 "史馆还没有档案 — 去上书房下第一道旨，裁决采纳后这里自动留档。"
- Link 用 withBasePath('/shangshufang')（已有 import）
- 色调 slatey-400/20 + slatey-300（已有 class）
- DataState 的 emptyMessage 是 string 不支持 Link，故用 inline div 同款风格
- TimelinePanel 本身仍渲染（保留 filter tabs）

---

## 5 文件改动

local-decision-loop.ts: +1 archive_hints 类型加 retrospectiveStatus
draft-edict/route.ts: +1 序列化映射加 retrospectiveStatus
jiqun-api.ts: +1 API 契约类型加 retrospectiveStatus
ShangshufangPage.tsx: +6/-1 徽章 + outcomeLabel 渲染
ShiguanPage.tsx: +14 史馆空态 CTA
