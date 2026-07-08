# 整合映射:太子 / 六部 引擎 → 产品主线(权威 SoT 对照)

> 大神结论一句话:**产品主线(lyt)已有 100% 概念的冻结正主。整合 = 把
> chaotang-os 引擎映射到既有契约(复用,不另造),只把真正新增的「治理增量」
> 嫁接到正主家里;平行原型退役为参考。**

日期 2026-06-02。准绳:`src/lib/contracts/*`(SoT)+ `agent.ts` 11 个冻结 AgentCode(Tier-0 严禁增删)。

---

## 一、铁律前提(不可违反)

1. **AgentCode 冻结 11 个**:prime_minister / scribe / li_bu / hu_bu / li_bu_rites /
   bing_bu / xing_bu / gong_bu / qin_tian_jian / jin_yi_wei / tai_yi_yuan。**严禁增删。**
2. **太子不在其中** → 太子 ≠ 第 12 个 agent。**太子 = 朝廷的「自主运营模式」**:
   由 prime_minister 中枢编排、六部执行、xing_bu 制度风控约束的一种运行态。
3. **视觉冻结 + contracts 是 SoT**:新增只能落 `lib/contracts` 并 conform 既有风格(zod)。

---

## 二、权威映射(我的引擎 → 产品正主 → 处置)

| chaotang-os 引擎件 | 产品冻结正主 | 处置 |
|---|---|---|
| `MinistryAgent(户部)` | `hu_bu` 户部·金融投资 + `contracts/hubu.ts` + `dept(finance)` | **复用正主**,引擎退役 |
| `MinistryAgent(工部)` | `gong_bu` 工部·产品技术 + `dept` | 复用正主 |
| `MinistryAgent(钦天监)` | `qin_tian_jian` 钦天监·未来推演 + `contracts/qintian.ts` | 复用正主 |
| `MinistryAgent(兵部)` | `bing_bu` 兵部·竞品战略 + `contracts/bingbu.ts` | 复用正主 |
| 情报总线 IntelBus | `jin_yi_wei` 锦衣卫·全球情报 + `contracts/intel.ts` + `/api/court/intel` | 复用正主 |
| 丞相会审 clawteam | `prime_minister` 丞相·中枢编排 + `contracts/prime-minister.ts` | 复用正主 |
| **PolicyEngine / 治理** | **`xing_bu` 刑部·制度风控** + `features/governance` | **嫁接增量(见三)** |
| reflexion / DecisionTrace | `scribe` 史官·记忆审计 | 嫁接增量 |
| 反事实奏折 memorial | `contracts/memorial.ts`(已落库状态机) | 嫁接增量(加段) |
| prince_* 落库 | 产品已有 memorial/task 落库 + `/api/court/*` + upstream :18003 | **弃我的 SQLite,归正主库** |
| 翰林太子 | 已改 **纪晓岚**(features/hanlin) | ✅ 已完成 |

**核心洞察:六部/丞相/情报/奏折/落库——全是产品已有的正主,我那套是平行原型,应退役。**

---

## 三、真正值得嫁接的「治理增量」(产品还没有的差异化)

这 4 样是我引擎里**产品契约确实空缺**、且是"让企业敢把权交给 AI"的护城河。
嫁接进**既有正主**,不另立系统:

| 增量 | 嫁接到 | 形态 |
|---|---|---|
| **渐进授权**(动作类按毕业逐步从提案→自动执行) | `xing_bu`/governance + 新 `contracts/authorization.ts` | 一个授权状态机契约 |
| **高危双签**(2 独立审批才放行) | governance 审批流 + `agent.escalationTargets` | 审批规则 |
| **反事实奏折**(报"没做/待裁/若批准") | `contracts/memorial.ts` 加 `counterfactual/blocked/waiting` 段 | 契约字段扩展 |
| **RLVR 飞轮**(决策结局→可验证奖励数据) | `scribe` 审计流 → 训练数据导出 | 后端审计副产物 |

「太子自主运营模式」= 上述渐进授权 + 双签 + SLA 套在 prime_minister 编排之上的**运行策略**,
在 `features/governance`(或新 `features/donggong`)做面,后端走既有 `/api/court/*` + upstream。

---

## 四、太子(运营模式)的产品定义(收口唯一性)

- **太子 = 监国自主运营模式**,不是 agent、不占 AgentCode。
- 它做的事:在皇帝授权下,让 prime_minister 编排六部**自主跑日常**,xing_bu 把关,
  到阈值/高危则 escalate 皇帝;产出反事实奏折。
- 与其他"太子"歧义已清:翰林那处→**纪晓岚**;court-console 流水线 `taizi_intake`→已显示**丞相**。
  **全产品用户可见的"太子"唯此一个(运营模式)。**

---

## 五、退役清单(chaotang-os 平行原型)

保留为**参考原型**(不删,标注 deprecated),不再作为生产路径:
`prince/{intel_bus,governance,memorial,reflexion,taizi_loop,...}`、`bridge/taizi-court-briefing.py`、
私有 `~/.chaotang/taizi.db`。其价值已被本映射吸收为"治理增量"提案。

---

## 六、建议执行顺序(照映射收口)

1. **定义 `contracts/authorization.ts`**(渐进授权+双签+SLA 状态机),conform zod 风格。
2. **扩 `contracts/memorial.ts`**:加反事实三段(blocked/waiting/counterfactual)。
3. **governance feature 加"自主运营/太子模式"面**:读 authorization + memorial,御批/合并入口。
4. 后端(legal-agent upstream :18003)实现这两个契约;chaotang-os 引擎逻辑作为实现参考移植。
5. chaotang-os 平行件标 deprecated。

> 不先动代码、先立这张映射,是因为产品是冻结生产舱、contracts 是 SoT——
> 整合的正确顺序是**先对齐契约,再按契约施工**。
