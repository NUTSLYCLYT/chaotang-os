# 工部 · PACK 蜂群驾驶舱设计(2026-06-28)

> 守护大神:工部·Karpathy(agent编排/质门)+ 将作大匠·马斯克(质门/成本)。
> 一句话:**PACK 理念引进工部前端(怎么编排怎么呈现),PACK 产线留后端 jiqun(谁真干活)**。

## 〇、铁律9 边界(最高约束,先钉死)
- ❌ **禁**:在工部前端重建 PACK swarm / pack_rd 拆分 / 报价 / BOM / 真产线——那是后端 `jiqun :8081` 资产,前端重建=第二套产线必腐烂。
- ✅ **准**:工部前端 = PACK 蜂群的**驾驶舱**——把后端真蜂群开得明明白白、质门看得见;真活全 HTTP 转 `:8081`。
- 判据:工部前端**一行真产线计算都不自己算**;只编排展示 + 调后端。

## 一、PACK 理念 → 工部前端 4 件可视化(理念落地在 UI)
| PACK 理念 | 工部驾驶舱怎么呈现 |
|---|---|
| 分工编排(任务→拆子任务→派蜂群) | **编排链时间线**:一个工程任务拆成几个子蜂群,各自状态红黄绿 |
| 质门把关(每步过质门才进下一步) | **质门灯带**:每个质门 pass/fail/卡住,卡在哪一眼看到(马斯克:质门可见) |
| 单件流 WIP 上限(大野耐一) | **WIP 计数**:在跑的子任务数 / 上限,超限排队可见 |
| 真蜂群涌现 vs 单 agent | **蜂群格**:N 个 agent 并行跑的实时态(复用现有 swarm 组件范式) |

## 二、后端契约(调,不重建)
工部驾驶舱通过 BFF 调后端真 PACK 蜂群:
```
POST :8081 /api/swarm/run        # 派一个工程任务给真 PACK 蜂群
GET  :8081 /api/swarm/{id}/status # 拉编排链/质门/WIP 实时态(驱动驾驶舱)
GET  :8081 /api/swarm/{id}/output # 拉蜂群产出(质检过的)
```
- 前端只持有 swarm id + 渲染 status;**产出/成本/拆分全是后端算好的**,前端不二次计算。
- sourceLabel 诚实:真连上 `:8081` = LIVE_SWARM;后端不可达 = FALLBACK(明示降级,不伪装)。

## 二.A、上书房入口闭环验收
- 入口必须是上书房正文下方的「旨 / 密」按钮和旨意输入框,不依赖独立的三方闭环测试区。
- 用户提交 PACK 蜂群协同评估后,上书房中央圣旨正文必须可见「蜂群任务执行状态」和「户部预算台账」。
- 后端派发必须走 `POST /api/court/shangshufang/pack-swarm-loop`,再转 `jiqun /api/swarm/run`,并保留 `session_id` / `task_id` / trace。
- 户部侧必须创建 PACK 蜂群建设预算与估值记录;证据不足时状态应保持待核算/需补证,不得伪装为已放行。
- 回归用例:`PACK_SWARM_SHANGSHUFANG_E2E=1 pnpm exec playwright test e2e/pack-swarm-shangshufang-entry.spec.ts --project=chromium`。

## 三、UI(对齐户部/刑部成熟度,复用冻结系统)
- `gongbu-office-page.tsx`(已存在 8 组件,在此基础上升级,**不重造**):
  - 中区 hero = **PACK 编排驾驶舱**(编排链 + 质门灯带 + WIP + 蜂群格)
  - 复用 `DepartmentPageCanvas/Stage` + `GlassPanel` + 帝金 token + 现有 swarm 组件
- 工部编制(roster)可照刑部 `xingbu-roster` 范式补,诚实标真/骨架。

## 四、落地序 + 谁做
| 序 | 做什么 | 归属 |
|---|---|---|
| A | 后端 `:8081` swarm 契约对齐(run/status/output 字段) | **gongbu-backend-bridge agent**(前后端桥接专用) |
| B | 工部驾驶舱 UI(编排链+质门灯带+WIP,复用冻结系统) | 前端专员(对齐户部成熟度) |
| C | sourceLabel 接 reality-state(LIVE_SWARM/FALLBACK 诚实) | 同 B |

## 五、红线
- 铁律9:真产线全转 `:8081`,前端零产线计算。
- 诚实:后端不可达标 FALLBACK,不用假蜂群冒充 LIVE_SWARM。
- 不碰 globals/token/keyframe;复用现有 swarm 组件,不重造。
- 后端在另一主仓 `jiqun_ai_fresh`——契约对接走 BFF,前端不直接改后端。

## 🎲 大神视角(Karpathy + 马斯克)
⚠️ 最大坑:把 PACK 蜂群逻辑在前端"抄一遍演示版"——立刻变两套、前端那套永远假。
💡 工部的"强"= 把后端真蜂群的**质门开得最透明**(哪步卡了、为什么、成本多少),不是自己算。驾驶舱做到位,工部就是六部里"最懂工程协同"的那个——靠呈现真相,不靠重复造轮子。
