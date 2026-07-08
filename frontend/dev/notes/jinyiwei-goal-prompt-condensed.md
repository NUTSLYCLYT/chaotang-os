# 锦衣卫三栏架构 — goal 精简版

```
实施 P0: 锦衣卫三栏布局 · 对标上书房

创建 4 个新文件:
1. src/features/intel/JinyiweiPage.tsx — 主布局(三栏 grid + 净室/收起辅政 + 三层背景噪点)
2. src/features/intel/components/JinyiweiScrollStage.tsx — 暗色密报卷轴(嵌入 IntelHeroMap + IntelFilterBar)
3. src/features/intel/components/JinyiweiLeftColumn.tsx — 左栏(戚继光 PortraitBanner + 夜巡三判 + SignalFeedCompact)
4. src/features/intel/components/SignalFeedCompact.tsx — 紧凑信号行(等级色标+可信度点+时效)

更新:
- src/app/(dashboard)/intel/page.tsx → 简化为 <JinyiweiPage />

Grid: 对标 ShangshufangPage line 5365
  lg:grid-cols-[300px_minmax(420px,1fr)_300px]
  xl:grid-cols-[330px_minmax(520px,1fr)_330px]
  2xl:grid-cols-[350px_minmax(620px,1fr)_350px]
  收起辅政 → lg:grid-cols-1 · 净室 → max-w-[1600px] lg:grid-cols-1

锦衣卫色系(与上书房暖金区分):
  卷底 #0A0E1A · 火漆边 #8B1A1A · 金线 #D4A84B · 正文 #C8B890
  朱砂 #E0553A · accent #FB923C

P1: EvidenceScoreStrip(证据评分条,替代旧抽屉假按钮)
P2: 连接 Tavily RAG → dispatch pipeline → 实时信号

验收: pnpm build 零错误 / 三栏响应式 / 收起辅政+净室 / 地图正常交互
```
