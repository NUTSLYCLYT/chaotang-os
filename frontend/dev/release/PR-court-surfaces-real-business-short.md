# feat: 朝堂接真业务 + 蜂群融合 + 决策质量可测量

把朝堂从"演示门面"推向"真在跑"。220 files / 81 commits。融合=一脊·二擎·一闸·一契约。

## 主要变更
- **蜂群半真**:户/刑/工 3 部接真 LLM agent(失败回退 heuristic·诚实标源);礼/人/兵留规则。`COURT_REAL_MINISTRY_AGENTS=0` 可回退。
- **诚实**:规则卡不冒充 LIVE,决策诚实分层 MIXED(铁律3)。
- **上游单源**:`upstreams.ts` 唯一真相源 + 统一熔断;`guard:upstreams` 113→74;courtos 遗物逐路由止血待拆。
- **可见+可测**:引擎健康灯(`/upstreams-health`);决策质量 eval(Deming 闭环 87→93→100)+ 判别力回归进 test:core。
- **真数据**:户部真账/太医院去假/六部页面/部门聚合脱敏。

## 验证
test:core 253 · build(real) · 接真 e2e(readback/hubu/fastfail) · 4 guard · gate:daily PASS · 关键改动过独立会审+回归断言。

## 注意
jiqun:8081 当前 DOWN;**#4 执行臂故意未建**,等第一笔真实产线任务拉动。

🤖 Generated with [Claude Code](https://claude.com/claude-code)
