# 马丁·福勒思想体系调研(源料 · 供 RAG 接地)

> 建档:2026-06-30。来源为公开权威资料,见文末。本档供朝堂大神发言时检索接地,
> 凡引用结论须能回链到此处来源;检索未命中则该结论降权/不采纳(观点席纪律)。

## 1. 重构 Refactoring

- 重构是一种**有纪律的、行为保持(behavior-preserving)的**重构既有代码内部结构的技术,核心是一连串细小的变换。
- 关键认知:**步子越小越快**——每一步都让代码保持可运行、保持绿(测试通过),再把小步组合成大改动。
- 重构不是专门划块时间去做的活动:"Refactoring is something you do all the time in little bursts."(随时随地、小爆发式地做。)
- 测试是重构的安全网;Fowler 强调"没有测试就在跑的系统才真该让你害怕"。
- 《Refactoring: Improving the Design of Existing Code》是该领域奠基之作(1999 初版,2018 第二版改用 JavaScript 示例)。

## 2. 为人写代码 / 好设计

- 名言:"Any fool can write code that a computer can understand. Good programmers write code that humans can understand."
- Fowler 认为好设计最有价值的一条规则之一是**避免重复(DRY)**。
- 采用 CI、重构、敏捷等实践的整体目的,是让软件交付变成"routine, low-stress, and consistently valuable to users"(日常、低压、对用户持续有价值)。

## 3. 演进式设计 Evolutionary Design

- Fowler 对比**计划式设计(planned design,开工前画好详尽蓝图)**与**演进式设计(design emerging during implementation,设计在实现中浮现)**。
- 论点:XP 的三项使能实践——**测试、持续集成、重构**——把"软件改动成本曲线"压平到足以让演进式设计可行,而且比计划式设计更有效。
- 含义:把改动变便宜,就能把设计决策延迟到信息最充分的时刻,避免过早过度设计。

## 4. 持续集成 Continuous Integration

- 定义:团队成员**频繁**(通常每人至少每天)把工作集成进主干,从而每天多次集成。
- 每次集成都由**自动化构建(含测试)**验证,以尽快发现集成错误。
- 思想内核:集成越痛,就越要频繁地做,把"大爆炸式合并"拆成无数次低风险小合并。

## 5. 微服务取舍与遗留改造

- **MonolithFirst(单体优先)**:新应用即便预期将来会受益于微服务,也应**先做成单体**。
  - 经验规律:几乎所有成功的微服务故事,都是从一个长大、变得太大的单体里拆出来的;而几乎所有"一开始就按微服务从零搭"的系统,最终都陷入严重麻烦。
  - 理由:即便有经验的架构师在熟悉领域,开工时也很难把边界切对;先做单体能在拆分前看清正确边界,否则"微服务会在错的边界上糊一层糖浆(treacle)",更难改。
- **Microservice Premium(微服务溢价)**:Fowler 提出此词,描述微服务给项目带来的可观固定成本与风险(分布式复杂度);初期需要速度与反馈,这份溢价是应当回避的拖累。
- **Sacrificial Architecture(牺牲式架构)**:别怕造一个将来会被丢弃的单体,尤其当单体能让你快速到市场时。
- **StranglerFig(绞杀榕模式)**:Fowler 在 2000 年代提出(灵感来自澳大利亚昆士兰雨林中绞杀榕的生长)。改造遗留单体时**逐个功能增量替换**,在旧系统外围建新应用,功能被微服务逐步取代,直至老系统被"绞杀"掏空——而非一次性推倒重写。

## 6. 名言(表达 DNA 源)

- "Any fool can write code that a computer can understand. Good programmers write code that humans can understand."
- "Refactoring is something you do all the time in little bursts."(意译自其重构论述)
- "You should be afraid to be running a system without tests."
- 关于设计:避免重复(duplication)是好设计最有价值的规则之一。

## 7. 在朝堂自我进化系统中的映射

- 重构纪律 = flow/引擎改动前先有可跑 eval/测试托底,小步改、每步保持绿。
- 演进式设计 = flow 边界/路由形状随真实样本演进;用 CI/eval 压平改动成本,延迟决策。
- 持续集成 = 棘轮门/eval_ci:每次候选改动频繁集成、自动验证,绿了固化、坏了立刻修。
- MonolithFirst + 微服务溢价 = 蜂群/flow 拆分先问"边界看清了吗、复杂度配得上溢价吗",默认单体优先。
- 绞杀榕 = 旧链路逐步替换、慎用推倒重写。

---

## 来源(Sources)

- [Refactoring — martinfowler.com](https://martinfowler.com/books/refactoring.html)
- [Evolutionary Design (Is Design Dead?) — Artima 访谈](https://www.artima.com/intv/evolution.html)
- [bliki: MonolithFirst — martinfowler.com](https://martinfowler.com/bliki/MonolithFirst.html)
- [Microservice Trade-Offs — martinfowler.com](https://martinfowler.com/articles/microservice-trade-offs.html)
- [Don't start with a monolith — martinfowler.com](https://martinfowler.com/articles/dont-start-monolith.html)
- [Microservices Guide — martinfowler.com](https://martinfowler.com/microservices/)
- [Sacrificial Architecture: Learning from abandoned systems — Stack Overflow Blog](https://stackoverflow.blog/2021/03/01/sacrificial-architecture-learning-from-abandoned-systems/)
- [Martin Fowler — Wikiquote](https://en.wikiquote.org/wiki/Martin_Fowler)
- [Quotes by Martin Fowler — Goodreads](https://www.goodreads.com/author/quotes/25215.Martin_Fowler)
