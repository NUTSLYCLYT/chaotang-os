# 肯特·贝克思想体系调研(源料 · 供 RAG 接地)

> 建档:2026-06-30。来源为公开权威资料,见文末。本档供朝堂大神发言时检索接地,
> 凡引用结论须能回链到此处来源;检索未命中则该结论降权/不采纳(观点席纪律)。

## 1. 测试驱动开发(TDD)与红-绿-重构

Kent Beck 在 1990 年代末把 TDD 作为极限编程(Extreme Programming, XP)的一部分重新发掘并系统化,
2003 年出版《Test-Driven Development: By Example》。TDD 的核心节奏是 **Red–Green–Refactor**:

- **Red(红)**:先写一个小测试,它现在还跑不过,甚至可能编译不过。
- **Green(绿)**:用最快的方式让测试通过,过程中"犯下任何必要的罪"都行。
- **Refactor(重构)**:消除刚才为了让测试通过而制造的所有重复与脏代码。

Beck 后来又写了《Canon TDD》一文,把这套规范节奏重新讲清楚:先列测试清单、写一个测试、让它通过、整理、再回到清单。

## 2. "Make it work, make it right, make it fast"

Beck 反复强调的工作顺序:**先让它能跑(work),再让它正确/干净(right),最后才让它快(fast)——按这个顺序。**
含义是把"让代码能工作"和"改进设计"两件事的关注点分开,反对过早优化。

## 3. 简单设计四原则(Four Rules of Simple Design)

Beck 在 XP("白皮书")中提出,一段设计够不够简单,看四条,且有优先级:

1. **通过所有测试(Passes the tests)** —— 最重要,首先得真的能按预期工作。
2. **揭示意图(Reveals intention)** —— 代码要让读者读懂你写它时的目的。
3. **没有重复(No duplication)** —— "每件事只说一次,且只说一次"(once and only once)。
4. **元素最少(Fewest elements)** —— 在满足上面三条后,类/方法/模块数量越少越好。

(Martin Fowler 在 *BeckDesignRules* 中复述并讨论了这四条的优先级取舍。)

## 4. 《Tidy First?》:整理优先?经验式软件设计

2023 年《Tidy First? A Personal Exercise in Empirical Software Design》提出:

- 区分 **行为改动(behavior change)** 与 **结构改动(structural change / tidying)**,二者不要混在一次提交里。
- **Tidying = "可爱、毛茸茸的小重构"**(cute, fuzzy, little refactorings),是"极客式的自我关怀"(geek self-care)。
- 复杂度取决于代码如何被组织成部分、各部分之间的**耦合(coupling)**有多强、各部分自身的**内聚(cohesion)**有多高;耦合与内聚就是复杂度的度量。
- 引入**贴现现金流(discounted cash flow)与期权(optionality)**视角:整理是一笔投资,要判断它能否让"接下来的改动"更便宜——"整理优先?"是个真问题,不总是该先整理。
- 名言:"Software design is an exercise in human relationships."(软件设计是一门处理人际关系的功夫。)
- 历史渊源:2005 年 Beck 与《结构化设计》作者 Larry Constantine、Ed Yourdon 同台,重读后意识到他们提出的耦合/内聚相当于"软件设计的牛顿运动定律"。

## 5. 极限编程(XP)价值观与名言(表达 DNA 源)

- XP 五大价值:**沟通(Communication)、简单(Simplicity)、反馈(Feedback)、勇气(Courage)、尊重(Respect)**。强调缩短反馈环、小步前进、敢于改。
- "I'm not a great programmer; I'm just a good programmer with great habits."(我不是个伟大的程序员,只是个有好习惯的好程序员。)
- "Make it work, make it right, make it fast."
- "When in doubt, take smaller steps."(拿不准时,把步子迈小一点。)
- Beck 也是敏捷宣言(Agile Manifesto)签署者之一,并与 Erich Gamma 合作开发了 JUnit。

## 6. 在朝堂自我进化系统中的映射

- 红-绿-重构 = 本仓的 TDD 纪律:先写会失败的测试,再实现,再清理。
- "先能跑再做对再求快" = 候选先过功能,再过质量门,最后才谈性能优化。
- 简单设计四原则 = 代码评审与质量基线的判据:先看测试通过,再看重复与意图。
- Tidy First? = 结构改动与行为改动分提交,正对应本仓"一个 commit 只表达一件事"的纪律。
- 缩短反馈环 = eval/质量门要快、要频繁,慢测试等于没反馈。

---

## 来源(Sources)

- [Test-Driven Development — martinfowler.com (bliki)](https://martinfowler.com/bliki/TestDrivenDevelopment.html)
- [Canon TDD — Kent Beck (Software Design: Tidy First? newsletter)](https://newsletter.kentbeck.com/p/canon-tdd)
- [Beck Design Rules (Four Rules of Simple Design) — martinfowler.com](https://martinfowler.com/bliki/BeckDesignRules.html)
- [Tidy First? — Kent Beck (Google Books)](https://books.google.com/books/about/Tidy_First.html?id=-WndEAAAQBAJ)
- [Tidy First? A Summary of Kent Beck's Book on Empirical Software Design — workingsoftware.dev](https://www.workingsoftware.dev/summary-of-tidy-first-book/)
- [Kent Beck — official site](https://kentbeck.com/)
- [Test-Driven Development: By Example — Goodreads](https://www.goodreads.com/book/show/387190.Test_Driven_Development)
