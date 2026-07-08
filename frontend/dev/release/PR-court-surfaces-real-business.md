# PR: feat/court-surfaces-real-business → master

> 朝堂接真业务 + 蜂群融合 + 决策质量可测量。规模:220 files, ~±11k 行, 81 commits。

## 概述
把朝堂从"演示门面"推向"真在跑":各部接真数据/真 agent、上游收口单一真相源、决策质量从"无法判断"变成"可测量可改进"。融合设计=**一脊·二擎·一闸·一契约**(咨询本地 LLM / 执行 jiqun / 圣裁为闸 / 统一奏折+诚实 sourceLabel)。

## 主要变更

### 1. 蜂群融合 · 咨询引擎接真(本会话核心)
- **3/6 高判错代价部接真 LLM agent**:户部(钱)/刑部(法律否决)/工部(交付),经 `runRealMinistryCard`(真 callLLM 结构化红蓝卡;命中 live+解析成功→LIVE,任何失败→回退确定性 heuristic FALLBACK)。礼/人/兵留规则(够用·省成本)。`COURT_REAL_MINISTRY_AGENTS=0` 一键回退。
- **诚实标源**:规则红蓝卡停止继承外层 LLM 的 LIVE 冒充真推理(硬标 FALLBACK);决策诚实分层 MIXED(铁律3)。
- 纯 `aggregateMinistryCards` 确定性汇总(不让 agent 判 agent,冲突升御座)。

### 2. 上游单一真相源 + 统一熔断(融合地基)
- `src/lib/upstreams.ts` 唯一上游真相源(SWARM_BACKEND/LLM_GATEWAY/LEGAL_AGENT + courtos 遗物待拆)。
- `src/lib/server/upstream-breaker.ts` 通用熔断(courtosFetch 短超时快失败 / jiqunFetch 尊重调用方 signal);courtos-breaker 变垫片。
- `guard:upstreams` 守裸上游引用(113→74,warn-only,UPSTREAMS_STRICT=1 升阻断);court/backend·dept·governance/intel/shiguan 已迁。
- `docs/TOPOLOGY.md` 唯一拓扑;`:18003` 澄清为法务真 provider(非幽灵)。

### 3. 可见性 + 决策质量可测量
- **引擎健康灯**:`/api/court/upstreams-health` + `EngineHealthBadge`(顶栏三色显咨询/执行jiqun/法务 live+熔断)。
- **决策质量 eval**:`scripts/decision-eval.mjs` 把"是不是好决策"变成数字。Deming 闭环抓出并修复"总灯永远 RED"(无判别力)+ "真 agent 越权判红":**87%→93%→100%**。
- 判别力回归进 `test:core`(decision-discrimination.nodetest:真高危→RED / benign→不得RED / 缺证→不得RED),锁死防回退。

### 4. 六部/部门页面 + 真数据接入(分支早期)
- 户部接真 H 盘真账;太医院/礼部/人事去假数据(诚实空态);六部页面;部门聚合脱敏。

## 测试 / 验证
- `pnpm test:core` 253/253 · `pnpm build`(real env)绿 · 接真数据契约 e2e(readback/hubu/fastfail)绿
- `guard:honesty / freeze / realdata / upstreams` 全过;`gate:daily` DECISION PASS(浏览器 flaky 降非阻断 WARN)
- 关键改动过独立会审(code-reviewer / expert-panel / healthcare-reviewer);高危改动带回归断言(铁律4)

## 风险 / 注意
- jiqun :8081 当前 DOWN(独立仓);**#4 执行臂(圣裁→jiqun)故意未建**,等第一笔真实产线任务拉动(Howard Marks 克制)。
- e2e basePath 自适应(`resolveBasePath`);复用 pnpm dev 跑 e2e 不必传 PLAYWRIGHT_BASE_PATH。
- decision-eval 重复跑命中 LLM 缓存,真基线测量宜冷跑或加真实样本。

## 待办(合并后)
- 把真实业务决策样本加进 `decision-eval.mjs` SCENARIOS,建真质量基线。
- guard:upstreams 74→0(剩 hanlin/流式/jiqun 消费者,流式需 stream-safe 熔断)。
- 按需打穿剩余部门 / 起 jiqun 接执行臂。

🤖 Generated with [Claude Code](https://claude.com/claude-code)
