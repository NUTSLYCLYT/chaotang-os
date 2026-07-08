# 工部 · PACK 整合与蜂群对接设计(2026-06-29)

> 资源:① 电池真数据(batterynew/knowledge,已建底座)② H盘 PACK 真文档(/mnt/h,规格书/测试报告/技术协议)③ 后端 jiqun PACK 蜂群(pack_rd_sizing/cost_validator/swarm_orchestrator)。
> 一句话:**真数据进工部底座,产线计算转后端蜂群,工部前端是驾驶舱**(铁律9)。

## 一、三层架构(各归各位)
```
① 真数据底座(工部本地·参考)          ② 工部驾驶舱(咨询/展示)        ③ 后端 PACK 蜂群(产线)
   battery-products.ts(电芯/PACK目录) → BOM供应链司/方案架构司选型查规格 → :8081 pack_rd 真sizing/真成本
   H盘规格书/测试报告(客户端解析→洞见)   质量验收司质门可见               swarm_orchestrator 真编排
```
- 底座只供"查规格/比价/低温选型初筛";**真 PACK sizing、成本拆分、报价 = 后端 pack_rd 蜂群**(铁律9,绝不前端重算)。

## 二、① 电池真数据底座(✅ 已建)
`src/features/gongbu/lib/battery-products.ts` —— 4 电芯(LFP/NCM/LTO)+ PACK 方案目录 + 选型函数
(`selectCellsForTemp` 低温初筛 / `cellsByChemistry` / `findCell`)。源:产品部 2026-04-01 参考数据。诚实:价格区间非锁价。4 断言绿。
→ 接入工部 **BOM供应链司 / 方案架构司**。

## 三、② H盘 PACK 真文档(待建·按混合架构)
`/mnt/h` 有真文档:`12V1000A启动电池技术规格设计方案`、`INR18650/21700测试报告`、`YK10B/30A/40电池组技术协议`、各规格书。
- **铁律13.2 混合架构**:原文留客户端/本地解析,**只上脱敏洞见**(规格摘要/关键参数),原文不上云。
- 复用已建 `contracts/evidence` + `evidence-classify`:这些文档 = `spec` 类证据,deptAffinity=工部。
- 落地:文档解析(客户端)→ 抽规格洞见 → 进工部方案架构司参考 + 喂后端蜂群做 sizing 输入。

## 四、③ 对接后端 PACK 蜂群(照本仓现有 jiqun-api,不新造)
后端真件:`pack_rd_sizing.py` / `pack_rd_cost_validator.py` / `swarm_orchestrator.py` / `prompts_pack_rd.py`。
本仓已有对接层 `src/lib/jiqun-api.ts`(`jiqunPost`/`jiqunFetcher`,带 Bearer)+ swarm 契约(`contracts/swarm.ts`)。
对接方式(BFF,不直改后端):
```
工部驾驶舱 → jiqunPost(':8081 pack_rd/swarm run', {选型+规格洞见}) → 后端蜂群真算 sizing/成本
           → 拉 status/output → 驾驶舱渲染(质门灯带/编排链/WIP,见「工部-PACK蜂群驾驶舱设计.md」)
```
- **sourceLabel 诚实**:真连上蜂群=LIVE_SWARM;不可达=FALLBACK(经 reality-state 归一,不伪装)。
- 复用现有 `review_depth: 'live_swarm'` / `swarm_required` / `swarm_runtime_status` 契约字段。

## 五、工部各司 × 数据/蜂群映射
| 司 | 用什么 |
|---|---|
| 方案架构司 | battery-products 选型 + H盘规格洞见 + 调蜂群出方案 |
| BOM供应链司 | battery-products 价格/MOQ/交期底座 + 蜂群真 BOM 成本 |
| 质量验收司 | H盘测试报告洞见 + 蜂群质门(pack_rd_cost_validator)结果可见 |
| 交付承诺门司 | 蜂群 sizing/成本 → 高危交付承诺过人工确认门 |
| 排期产能司 | 电芯 lead_time 底座 + 蜂群产能 |

## 六、红线
- 铁律9:pack_rd 真算全在后端,工部前端零产线计算,只底座查询(咨询)+ 调蜂群 + 展示。
- 铁律13.2:H盘原文不上云,只上脱敏洞见。
- 铁律2:对接用现有 jiqun-api + swarm 契约,不新造平行客户端。
- 诚实:价格区间标"参考非锁价";蜂群不可达标 FALLBACK 不伪装 LIVE_SWARM。
- 后端在另一主仓 jiqun_ai_fresh——契约对接走 BFF,前端不直改后端(可用 gongbu-backend-bridge agent)。

## 七、落地序
A(✅已做)电池底座 → B H盘文档解析→洞见(客户端,接 evidence)→ C 工部驾驶舱 UI(质门可见,复用冻结系统)→ D 对接 :8081 pack_rd 蜂群(jiqun-api)→ E sourceLabel 诚实接 reality-state。
