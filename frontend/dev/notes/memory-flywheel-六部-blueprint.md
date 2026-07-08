# 记忆飞轮接入六部会审 · 上线后第一个 Stage-2 PR 蓝图

> 2026-06-24。承「顶级建议」:给已落地的优秀六部编排(一脊二擎一闸一契约)加记忆,从"每次重判"→"越判越准"。
> **前置(硬)**:① 主闭环已上线(有真实裁决可召回/反写)② 并发手改 study/throne 已落定(避撞车)。在此之前只存蓝图不动码。
> 守住灵魂(Karpathy):agent 出卡 / 代码合卡 / LLM 永不当最终法官 —— 记忆只增强召回与校准,**绝不替代 aggregateMinistryCards 的确定性聚合**。

## 设计:在现有编排两端各插一道,中间不动
现有(不改):`selectMinistries → 并行 runRealMinistryCard/runRedBlueLoop → aggregateMinistryCards`
```
① 召回(拟旨/选部前)  ──读──▶ 主库 tasks 里同类已裁决案(topic+riskTrigger kNN top-3)
       注入丞相/各部 card 的 context(标 MIXED,旧案非本次实时)
   现有六部会审照常跑(灵魂不动)
② 反写(史馆归档/sign-off 采纳那一刻) ──写──▶ 记忆:本次圣裁+证据+缺证补全+用户最终怎么改
       触发点钉死 user_action=采纳(非结论生成时),防近亲繁殖
```

## 落点(精确 file)
- **召回读路径**:新 `src/core/courtos/ministries/recall-precedents.ts`(server-only,纯函数):
  `recallPrecedents(taskId, topic, riskTriggers): Promise<Precedent[]>` —— 读主库 `tasks`(已存裁决,**不需 jiqun**),按 topic/关键词召回 top-3 已裁决案的 {圣裁, userAction, 兑现 delta}。
  注入点:`runMinistryReviewWithRealAgents` 的 `text` 拼装处(real-ministry-review.ts:22 附近),把召回案拼进 context。
- **反写写路径**:复用已有 sign-off→主库写入(裁决已落 `tasks`);**补一个"可召回摘要"字段**(≤2000字结论+真 trace_id+资产类型 SSOT 键),不塞全文(全文已在 tasks)。
- **env 闸(照团队既有范式)**:`COURT_MEMORY_RECALL=0` 默认关(像 `COURT_REAL_MINISTRY_AGENTS`),上线后灰度开。关时行为与现状逐字一致。
- **源标**:召回注入 → MIXED(旧案非实时);绝不因注入旧案标 LIVE。

## 回归断言(铁律4,会咬)
1. `COURT_MEMORY_RECALL=0` 时,六部会审输出与现状逐字相同(召回不改默认行为)。
2. 反写只在 `user_action=采纳` 触发;结论生成态/驳回态零写入(防近亲繁殖)。
3. 召回案注入后,聚合源标必含 MIXED(不冒充 LIVE)。
4. 召回用结构化键(部门码走 SSOT contracts/dept.ts,防孤儿边——已有 dept-ssot.nodetest 兜底)。

## Rollout(贴既定 5 阶段)
1. 上线主闭环(Stage1,现在卡这)→ 攒第一批真实裁决。
2. 本 PR:建召回读路径 + 反写摘要字段 + env 闸(默认关)+ 4 断言。**只写不开**。
3. 灰度开 `COURT_MEMORY_RECALL=1`,盯"召回命中率/省了几轮深办"(deming 记分板)。
4. 命中率证明复利后,再接 jiqun Hermes FTS5 做语义召回(替/补主库关键词召回)。

## 为什么现在只存蓝图
- 记忆飞轮要真实裁决才有料 → 上线前是空转。
- 核心 loop 正并发手改 → 现在改撞车。
- 守 ship-first + 需求拉动(Howard Marks/Grove):让上线产生的第一批真实裁决拉动本 PR,而非工程推动。
