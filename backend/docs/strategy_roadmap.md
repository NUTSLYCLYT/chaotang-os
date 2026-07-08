# jiqun_ai 战略路线图（2026-06-03，大神共识驱动）

> 来源：两轮大神会审（批判 + 创意）。核心结论：**资产是那张可证伪的参数表，不是蜂群。**
> 本文把大神点子拆成"代码能做的"和"商业要做的"，并标注已落地状态。

## 北极星

把公司目标函数从"做一套 AI 组织 OS"改成 **"做储能行业唯一可信、且每天在变准的参数表 + 物理裁定引擎"**。蜂群/隐喻是手段，表是飞轮。

## 已落地（本会话产出的代码资产）

| 能力 | 实现 | 对应大神点子 |
|---|---|---|
| 确定性约束求解器（抽取/判定分离，LLM 只抽取窄事实、判定永远确定性） | `scripts/opc_constraint_check.py` | Karpathy 硬约束 eval |
| 丞相裁定的参数真值表（usable/human_confirm/reject + as_of + provenance） | `config/eval/storage_params.yaml` | 全员"表是公司" |
| **求解器优先路由**（便宜草案→求解器扫→只在物理 FAIL/WARN 升级蜂群） | `scripts/swarm_router.py` | ①倒转架构（4人撞车） |
| **UNKNOWN 热力图**（行业认知缺口 → 补数据优先级） | `scripts/unknown_heatmap.py` | ③张一鸣飞轮燃料 |
| **证伪账本 + 防腐烂**（裁定留痕 + 实测回填 + 时效告警） | `scripts/param_ledger.py` | ④Naval/Musk + 全员"表会腐烂"警告 |
| single-model vs 蜂群对比器 | `scripts/baseline_compare.py` | Karpathy baseline |
| 黄金评测集（10 例 + 人工 human_score 位） | `eval/opc_golden.yaml` | 大神② ground truth 锚 |

## 待做（商业/组织，代码做不了，但是真正的护城河）

| 方向 | 内容 | 大神 |
|---|---|---|
| **卖判断/承销，不卖软件** | 约束体检报告 → 保险/银行/EPC/业主的"AI 预审储能"险种；错了按比例赔 | Naval/Altman |
| **第三方仲裁层（反查引擎）** | 站集成商对面：客户拿任何报价单进来，3 秒判配错/漏项/超成本 | 马斯克 |
| **实测回填闭环** | 接入真实项目，每个裁定→实测→`param_ledger settle`，让表挣可信度 | 全员 skin-in-game |
| **强制刷新飞轮** | 定时触发锦衣卫重搜 + 丞相重裁定（`param_ledger stale` 已能告警，需接调度） | Altman/张一鸣 防腐烂 |
| **用完即走的"物理良心"产品** | 低频高价救命：方案发出前最后一秒拦住会出事的错误 | 张小龙 |

## 必须守住的纪律（全员警告）

1. **别再扩隐喻/蜂群**——每加一个 persona/flow 前问："这给储能客户创造了什么物理价值？" 答不上来就不加。
2. **表的 maintainer 不能是"产品部"**——要有强制刷新机制，否则 18 个月护城河变沼泽。
3. **裁定必须可追溯、可被证伪**——`param_ledger` 记录每个裁定，实测打脸就改表。判错留痕，这才是 skin in the game。
4. **simple 任务别进蜂群**——`swarm_router` 默认便宜路径；蜂群只配出现在"错了要赔钱"的硬骨头。

## 下一步建议优先级

1. 把 `swarm_router` 接进真实入口（`web/main.py` /swarm/run 前置一道路由）。
2. 扩参数表到 sourcing/pack_rd/quotation 域（同样锦衣卫搜→丞相裁定→入表）。
3. 找 1 个真实储能项目跑通"裁定→实测→回填"一整圈，产出第一个非零的"裁定命中率"。
