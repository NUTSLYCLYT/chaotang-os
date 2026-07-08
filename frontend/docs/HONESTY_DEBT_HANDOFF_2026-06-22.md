# 交接单 · 诚实债(给六部工位 UI 主人)

> 张小龙天才建议:把假数据从"看不见的账"变成"满屏可见的灰徽"。
> `pnpm guard:honesty` 已把债机器化。当前**只 2 个部门卡欠债**——挂上徽即转绿。

## 欠债清单(`pnpm guard:honesty` 实时核)
| 部门卡 | 债 | 谁挂 |
|---|---|---|
| `gongbu-client.tsx`(工部) | 渲染 MOCK_TASKS 假看板、无来源标 → 假冒真(前轮评估判"最欺骗") | 工部 UI 主人 |
| `libu-client.tsx`(礼部) | seed/mock 数据、无可信度徽 | 礼部 UI 主人(今日活跃,本窗口不碰) |

> 其余(hubu/bingbu/jinyiwei/xingbu)已有来源标记,审计判绿。

## 怎么挂(照 personnel 范式,3 步)
范式见 `personnel-client.tsx`(commit `aaa0c7e`):
1. import:`import { ConfidenceSourceBadge, sourceToLabel } from '@/features/personnel/components/confidence-source-badge';`(组件已建,全朝堂可复用)
2. 在该卡的来源处放:`<ConfidenceSourceBadge confidence={0.6} sourceLabel={sourceToLabel(<该卡 source 串>)} />`
   - 无 source 字段的(如工部 MOCK_TASKS),直接传 `sourceLabel="DEMO"` + 一个低 confidence(0.5–0.7)。
3. 跑 `pnpm guard:honesty` 必须转绿。

## 纪律
- 假数据**老实显灰 DEMO**;接了真后端(蜂群/Turso)→ confidence 升、sourceLabel 变 LIVE_SWARM/LIVE(自动变帝金)。
- 徽的目的不是好看,是**制造一点"假数据的不适"**,逼着把灰的接成金的。它该有点刺眼。
- `guard:honesty` 转绿前,这两个卡就是"假冒真"——别在它们上面再叠功能。

> 组件:`src/features/personnel/components/confidence-source-badge.tsx`(若要全局复用,可提到 `src/components/`,由 UI 窗口定)。
