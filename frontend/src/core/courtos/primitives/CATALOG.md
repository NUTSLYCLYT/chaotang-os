# 朝堂决策操作系统 · 通用原语库 CATALOG（2026-06-29）

> 部门无关的决策原语。**任何决策系统（人事/财务/采购/医疗/法律/投资…）= 组装这些原语 + 接它的真数据 + 它的领域规则。**
> 不各写一套(铁律2)。`import { ... } from '@/core/courtos/primitives'`。

## 11 个原语

| 原语 | 位置 | 干什么 |
|---|---|---|
| 盖章流水线 | `primitives/stamp-pipeline` | 多方各盖章(pass/caution/block)·worst-wins合并·不群聊(O(N)) |
| 可信度加权 | `primitives/credibility` | 谁判断历来准→加权;样本不足不冤枉新人(达利欧护城河) |
| 同义词匹配 | `primitives/skill-match` | 语义等价(磷酸铁锂=锂电),修关键词匹配精度 |
| 下旨分流 | `decree-classifier` | 动词判开创(立项)/处置(裁决) |
| 立项成熟度 | `project-maturity` | 真字段占比→从X%到可拍板 |
| 真假三色标 | `lib/reality/reality-state` | 🟢真/🟡估/🔴缺,每个数标清来源 |
| 内外对比 | `features/hubu/lib/dept-external-hook` | 内部真实vs外部基准+外部数据口子 |
| 缺证诚实 | (各引擎约定) | 缺→标缺不编,不替你猜 |
| 单向门预警 | `features/hubu/lib/hubu-engines:detectOneWayDoor` | 不可逆/大额→人工亲裁 |
| 预测红线 | `features/qintian/lib/price-forecast` | 🟡预测永不冒充真 |
| 决策→责任链 | `features/libu/lib/execution-chain` | 通过→DRI/RACI谁在何时做什么 |

## 组装范式：建一个新决策系统(任意领域)
```ts
import { classifyDecree, projectMaturity, mergeStamps, credibilityWeight } from '@/core/courtos/primitives';

// 1. 入口:下旨分流(开创→立项)
const kind = classifyDecree(command);
// 2. 该领域的真引擎(你写):接真数据→裁决+缺证(标真假三色)
const verdict = myDomainEngine(realData);   // 缺则标缺不编
// 3. 多方会审:各方盖章→合并
const review = mergeStamps(decision, [stampA, stampB, ...]);
// 4. 立项成熟度:从X%填到可拍板
const maturity = projectMaturity(dims);
// 5. (可选)可信度加权多人判断 / 决策→责任链
```

## 已落地的实例(证明原语通用)
- **吏部**：招人盖章流水线(选才+锦衣卫+户部+刑部)、辞退跨部门会审、可信度加权、猎头同义词匹配。
- **户部**：价库内外对比、单向门、立项成熟度、下旨分流。
- **钦天监**：预测红线。
> 同一套原语，换领域换数据换规则即成新系统——这是平台,不是六个部门。
