# 户部/兵部 各司配 skill —— 交主工头(2026-06-28)

> 架构方已给刑部 8 司配好 skill(`src/features/xingbu/lib/xingbu-roster.ts`)作范例。
> 户部/兵部 roster 是主工头地盘,架构方不直接改;此为同法套用的设计,主工头落地。

## 范例:刑部 roster 的字段(照此给户部/兵部加)
给每个司加两字段(诚实标真/骨架):
```ts
skill: string;     // 该司本命方法 + 数据源(运行态能力,非 Claude skill)
reuses: string[];  // 接真时复用哪些已建骨架件(为空=待建)
engine: boolean;   // 是否已接真(诚实:别全标 true)
```
并给个 `xxxEngineStats(): {real, total}`(像 `xingbuEngineStats`)做"几真几骨架"诚实展示。

## 户部各司建议 skill(主工头按真实编制校准)
| 司 | skill | reuses | 真? |
|---|---|---|---|
| 投资司 | NPV/IRR/回收期 + 内外对比 | invest-finance | ✅(已真) |
| 成本司 | BOM 成本拆分 + 采购价库填真价 | bom-cost, price-library | ✅(已真) |
| 出纳/会计/预算司 | 引擎司模板(纯函数算+缺证诚实) | hubu-engines | 按实标 |
| 一句话录入 | AI 抽字段降门槛 | decision-extract | ✅(已真) |

## 兵部各司建议 skill(对照刑部范式)
| 司 | skill | reuses | 真? |
|---|---|---|---|
| 商机司 | 客户名单批量验客 | customer-import, prospect-qualify | ✅(已真) |
| 成交概率司(待建) | ICP评分+成交base rate(概率博弈非NPV) | reference-class | 骨架 |
| 其余销售司 | 镜像 bingbu-engines 视图适配 | bingbu-engines, bingbu-roster | 按实标 |

## 红线
- **诚实**:`engine` 只标真接了引擎的司,别全标 true(刑部 8 司只标 2 真)。
- **SSOT**(铁律2):司名取已有引擎 SSOT,skill 字段只补"方法+数据源"描述,别另立平行司名表。
- 接真路径在 `reuses` 写清复用哪个件,接真时不从零。
