# Charity Majors 可观测性思想调研(源料 · 供 RAG 接地)

> 建档:2026-06-30。来源为公开权威资料,见文末。供朝堂大神发言时检索接地;
> 引用结论须能回链到此处来源,检索未命中则降权/不采纳(观点席纪律)。

## 1. 可观测性哲学

- 分布式系统里,你不关心"系统整体健康",你关心**单个事件 / 单个用户体验 / 其它高基数维度**的健康。
- 监控(monitoring)= 预先知道会出什么错、做仪表盘;可观测(observability)= 出了没预料的错也能现场用数据问出来。

## 2. 在生产里测(Test in Production)

- "在生产测"被污名化,常识认为拿线上用户跑未测代码是找死。
- 但分布式系统能出错的是"一条无限长的长尾",平时几乎不发生,某天就发生(如照片只对部分人加载慢)——**staging 复现不了**,所以可观测才如此重要。

## 3. 高基数(High Cardinality)

- 大多数分布式系统问题都涉及高基数数据;答案常来自高基数维度,或少数几个因素**共同作用**才造成的麻烦。
- 世界级可观测团队大部分时间在**治理基数**。

## 4. SLO 与 On-Call

- SLO 应是入口,不是仪表盘;**SLO 是工程团队的 API**。
- On-call 告警应由 SLO(业务是否受损)触发,而非基础设施故障或某个监控阈值被突破——**只有业务真受影响才该叫醒工程师**。

## 5. 所有权与文化

- 开发者拥有并运维自己的服务是好事;运维专家的角色是**赋能、教育、当放大器**,不是替别人扛 pager。
- Observability 2.0:把数据扔进去就能问问题,不必纠结格式与基数。

## 6. 在朝堂自我进化/扩容场景的映射

- 扩容研判:先"可观测"再加机器;100 人并发的真天花板常在下游(LLM 额度、Semaphore、锁)。
- 上线把关:LLM 链必须真环境跑一次,dry-run 不背书。
- 飞轮/线上服务:设 SLO + 高基数追踪,而不是堆绿灯墙。

---

## 来源(Sources)

- [Observability: the present and future, with Charity Majors — Pragmatic Engineer](https://newsletter.pragmaticengineer.com/p/observability-the-present-and-future)
- [Charity Majors on Observability and Operational Ramifications — InfoQ](https://www.infoq.com/articles/charity-majors-observability-failure/)
- [Honeycomb's Charity Majors: Go Ahead, Test in Production — The New Stack](https://thenewstack.io/honeycombs-charity-majors-go-ahead-test-in-production/)
- [Observability Engineering (Majors, Fong-Jones, Miranda) — Goodreads](https://www.goodreads.com/book/show/59039072-observability-engineering)
- [charity.wtf — observability](https://charity.wtf/category/observability/)
