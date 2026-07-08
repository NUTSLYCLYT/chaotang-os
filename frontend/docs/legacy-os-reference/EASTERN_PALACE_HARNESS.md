# 东宫系统工程化Harness

**项目名**: 东宫 (Eastern Palace / Prince System)  
**目标**: 朝堂OS内集成自主运营平台，让太子(AI)自主执行业务，定期向皇帝(老板)汇报  
**时间**: 4周 (并行开发)  
**交付物**: 完整的人机分工架构 + 9个Agent自主系统 + 皇帝决策仪表板

---

## 系统架构总览

```
皇帝 (老板/决策者)
  ├─ 丞相 (战略决策)    ← 已有，无改动
  │   ├─ 意图理解
  │   ├─ 三省会审
  │   └─ 战略奏折
  │
  └─ 太子/东宫 ⭐ NEW (日常运营，自主执行)
      ├─ Policy Engine (自我约束)
      ├─ 9个垂直Agent (社交/销售/广告/代码/财务...)
      ├─ Agent协调器 (Hermes)
      ├─ 成本控制器 (Budget Manager)
      ├─ 风险预警系统 (Anomaly Detector)
      └─ 奏折生成器 (Memorial Generator)
         ├─ 日报 (06:00)
         ├─ 周报 (每周一 09:00)
         └─ 实时告警 (Critical alerts)

信息流：
  皇帝下旨 → 丞相理解 → 执行决策
                         ↓
                    政策下发给太子
                         ↓
              太子受约束地自主执行
                         ↓
                  奏折汇报给皇帝
                         ↓
                     皇帝裁决
                         ↓
                    更新政策/任务
```

---

## Phase 1: 东宫框架搭建 & Policy Engine (周1-2)

### 目标
建立太子的决策框架和政策约束引擎，使其能自主执行但受皇帝约束。

### 可交付物

#### 1.1 代码结构
```
backend/app/prince/
├── __init__.py
├── orchestrator.py              # 太子大脑(main loop)
├── policy_engine.py             # 约束检查引擎
├── agent_coordinator.py         # 9个Agent协调
├── memorial_generator.py        # 奏折生成器
├── budget_manager.py            # 成本控制
├── anomaly_detector.py          # 风险预警
└── models/
    ├── prince_decision.py       # Decision数据模型
    ├── prince_policy.py         # Policy配置模型
    ├── prince_memorial.py       # Memorial奏折模型
    └── prince_log.py            # 执行日志模型

celery_app/tasks/
├── prince_daily_report.py       # 06:00日报任务
├── prince_weekly_report.py      # 周一周报任务
├── prince_sync_policies.py      # 从皇帝同步政策
└── prince_agent_dispatch.py     # 派遣Agent任务
```

#### 1.2 Policy Engine 核心逻辑
```python
# backend/app/prince/policy_engine.py

class PrincePolicy:
    """太子的自我约束引擎"""
    
    # 皇帝可配置的约束
    policies = {
        "brand": {
            "voice": "professional",
            "forbidden_topics": ["politics"],
            "tone": "friendly"
        },
        "finance": {
            "daily_cap": 5000,
            "per_transaction_cap": 2000,
            "roi_minimum": 3.0,
            "monthly_burn_rate": 100000
        },
        "risk_matrix": {
            "HIGH": ["新产品", "价格变更>10%", "预算>10k"],
            "MEDIUM": ["广告策略调整"],
            "LOW": ["日常优化"]
        }
    }

class PolicyEvaluator:
    """决策前的政策检查"""
    
    async def evaluate(decision: Decision) -> Verdict:
        # 检查品牌一致性
        # 检查财务约束
        # 检查风险等级
        # 返回 APPROVE / ESCALATE / BLOCK

class DecisionLogger:
    """记录所有决策(用于历史回顾)"""
    
    # 存储决策 → decision_logs表
    # 支持皇帝事后审查
```

#### 1.3 数据库新表 (5个)
```sql
-- 东宫政策表
CREATE TABLE prince_policies (
    id SERIAL PRIMARY KEY,
    name VARCHAR,
    policy_json JSONB,  -- 完整Policy对象
    created_at TIMESTAMP,
    updated_by VARCHAR  -- 皇帝更新的记录
);

-- 决策日志表
CREATE TABLE prince_decisions (
    id SERIAL PRIMARY KEY,
    agent_name VARCHAR,
    decision_type VARCHAR,  -- "social_post", "email", "ad", etc.
    decision_json JSONB,
    policy_check JSONB,     -- 政策检查结果
    verdict VARCHAR,        -- APPROVE / ESCALATE / BLOCK
    created_at TIMESTAMP
);

-- 奏折表
CREATE TABLE prince_memorials (
    id SERIAL PRIMARY KEY,
    memorial_type VARCHAR,  -- "daily", "weekly", "alert"
    content TEXT,           -- Markdown格式
    kpi_json JSONB,
    alerts JSONB,
    suggestions JSONB,
    created_at TIMESTAMP,
    read_by_emperor BOOLEAN DEFAULT FALSE
);

-- Agent状态表
CREATE TABLE prince_agent_status (
    id SERIAL PRIMARY KEY,
    agent_name VARCHAR UNIQUE,
    last_run TIMESTAMP,
    status VARCHAR,         -- "idle", "running", "error"
    metrics_json JSONB,     -- KPI指标
    updated_at TIMESTAMP
);

-- 成本跟踪表
CREATE TABLE prince_cost_tracking (
    id SERIAL PRIMARY KEY,
    date DATE,
    agent_name VARCHAR,
    cost_usd FLOAT,
    roi FLOAT,
    notes TEXT
);
```

#### 1.4 Celery任务注册
```python
# celery_app/tasks/prince_tasks.py

@app.task(name="prince.daily_sync_policies")
def daily_sync_policies():
    """每天 00:05 从皇帝读新政策"""
    pass

@app.task(name="prince.daily_report", cron="0 6 * * *")
def daily_report():
    """每天 06:00 生成日报"""
    pass

@app.task(name="prince.weekly_report", cron="0 9 * * 1")
def weekly_report():
    """每周一 09:00 生成周报"""
    pass

# 被各Agent调用的基础任务
@app.task(name="prince.evaluate_decision")
def evaluate_decision(decision: Dict) -> Dict:
    """太子决策前自动检查"""
    evaluator = PolicyEvaluator()
    return await evaluator.evaluate(decision)
```

#### 1.5 API端点 (先后端，暂不前端)
```python
# backend/app/api/v1/prince.py

@router.get("/prince/policies")
async def get_policies():
    """获取当前政策约束"""
    return current_policies

@router.post("/prince/policies")
async def update_policies(new_policy: PolicySchema):
    """皇帝更新太子的政策"""
    # 验证 → 存DB → 推送给太子
    pass

@router.get("/prince/status")
async def get_prince_status():
    """获取太子的实时状态 (9个Agent + 成本)"""
    return {
        "agents": [...],
        "daily_cost": 1234.56,
        "daily_kpi": {...},
        "alerts": [...]
    }

@router.post("/prince/decision/evaluate")
async def evaluate_decision(decision: DecisionSchema):
    """太子提交决策给自己检查"""
    verdict = await policy_evaluator.evaluate(decision)
    return verdict

@router.get("/prince/memorials")
async def list_memorials(type: str = "all"):
    """获取奏折列表 (daily/weekly/alert)"""
    return memorials

@router.get("/prince/memorials/{id}")
async def get_memorial(id: int):
    """读取某份奏折"""
    memorial = await db.get(PrincememorialLog, id)
    return memorial.content  # Markdown

@router.post("/prince/memorials/{id}/decree")
async def emperor_decree(id: int, decree: DecreeSchema):
    """皇帝对奏折的裁决"""
    # 记录裁决 → 更新Policy/Task → 推送给太子
    pass

@router.get("/prince/cost/tracking")
async def cost_tracking(date_range: str = "week"):
    """成本追踪 (天/周/月)"""
    return cost_analysis
```

#### 1.6 验收标准
- [ ] Policy引擎能正确评估决策(HIGH/MEDIUM/LOW)
- [ ] 决策日志完整记录到DB
- [ ] Celery任务可正常调度 (使用Beat)
- [ ] API端点在本地 curl 通过
- [ ] 5个新表创建成功，migration通过
- [ ] 单元测试覆盖80%+

### 时间估计: **5 business days**

### 关键依赖
- 无 (独立可做)

### 风险
- Policy配置过于复杂 → 解决: 简化为JSON schema，可视化编辑
- 性能问题 (每次决策检查Policy) → 解决: Policy缓存到Redis，Policy变更时清缓存

---

## Phase 2: 9个Agent改造 + 奏折生成 (周2-3)

### 目标
将Polsia的9个Agent改造为东宫的子代理，接受Policy约束，生成可聚合的日志。

### 可交付物

#### 2.1 Agent基类重构
```python
# backend/app/prince/agents/base_agent.py

class PrinceAgent(BaseAgent):
    """东宫代理的基类"""
    
    def __init__(self, name: str, policy_engine: PolicyEngine):
        self.name = name
        self.policy_engine = policy_engine
        self.executor = AgentExecutor()  # 调用Claude
    
    async def run(self, task: Task) -> ExecutionResult:
        # 1. 获取当前Policy
        policy = await self.policy_engine.get_policy_for_agent(self.name)
        
        # 2. 构造带Policy约束的prompt
        constrained_prompt = self.build_prompt(task, policy)
        
        # 3. 调用Claude (subprocess)
        result = await self.executor.call_claude(constrained_prompt)
        
        # 4. 政策检查 (任务执行前)
        decision = Decision(
            agent=self.name,
            action=result.action,
            cost=result.estimated_cost
        )
        verdict = await self.policy_engine.evaluate(decision)
        
        if verdict == Verdict.BLOCK:
            raise PolicyViolationError(f"Action blocked by policy: {decision}")
        
        if verdict == Verdict.ESCALATE:
            # 高风险，上报皇帝，等待裁决
            await self.escalate_to_emperor(decision, result)
            return ExecutionResult(status="pending_emperor_decree")
        
        # 5. 执行 (APPROVE)
        exec_result = await self.execute(result)
        
        # 6. 记录日志 (便于汇总)
        await self.log_execution({
            "agent": self.name,
            "task": task,
            "decision": decision,
            "verdict": verdict,
            "result": exec_result,
            "timestamp": now()
        })
        
        return exec_result
    
    async def execute(self, action: Action) -> ExecutionResult:
        """实际执行action (各Agent覆盖)"""
        pass
    
    async def log_execution(self, log_data: Dict):
        """记录执行日志到DB"""
        await db.create(AgentExecutionLog, log_data)
        # 同时发送事件到Redis，用于实时仪表板
        await redis.publish(f"agent:{self.name}:log", json.dumps(log_data))

class SocialMediaAgent(PrinceAgent):
    """社交媒体代理"""
    
    async def execute(self, action: Action) -> ExecutionResult:
        # 检查: 是否超过日发帖数?
        # 检查: 内容是否符合brand_guidelines?
        # 调用Twitter API
        # 返回 {status: "posted", url: "..."}

class EmailAgent(PrinceAgent):
    """销售邮件代理"""
    
    async def execute(self, action: Action) -> ExecutionResult:
        # 检查: 目标lead是否已在database?
        # 检查: 是否超过日发邮件数?
        # 调用SendGrid
        # 返回 {status: "sent", message_id: "..."}

# ... 其他7个Agent类似
```

#### 2.2 9个Agent的改造清单
```
1. SocialMediaAgent
   ├─ 改造: 添加daily_post_quota检查
   ├─ 日志: 每条post → 记录{post_id, engagement_expected, cost}
   └─ 约束: 不发政治/宗教内容 (brand_guidelines)

2. EmailOutreachAgent
   ├─ 改造: 添加daily_email_quota检查
   ├─ 日志: 每封邮件 → 记录{recipient, reply_status, conversion}
   └─ 约束: 不重复发给同一人>3次

3. AdsManagementAgent
   ├─ 改造: 添加daily_budget_check
   ├─ 日志: 每次优化 → 记录{campaign, spend, roi, actions_taken}
   └─ 约束: ROI不降，CAC<$100

4. CodeGenerationAgent
   ├─ 改造: 非核心功能 + 安全检查
   ├─ 日志: 每个PR → 记录{scope, tests_coverage, review_status}
   └─ 约束: PR需经code_review agent通过

5. FinanceAgent
   ├─ 改造: 记录所有交易 + 异常检测
   ├─ 日志: 每笔交易 → 记录{type, amount, category}
   └─ 约束: 单笔提现>$10k需皇帝批准

6. CompetitorResearchAgent
   ├─ 改造: 集成锦衣卫(Tavily)真网搜
   ├─ 日志: 每次搜索 → 记录{query, sources_found, key_insights}
   └─ 约束: 信息需核查

7. CustomerSupportAgent
   ├─ 改造: 实时邮件监听 + 自动回复
   ├─ 日志: 每个ticket → 记录{issue, resolution, satisfaction}
   └─ 约束: 复杂问题上报

8. BusinessPlanningAgent
   ├─ 改造: 基于历史数据做预测
   ├─ 日志: 每份计划 → 记录{period, kpis, confidence}
   └─ 约束: 月度计划需皇帝审批

9. MarketingAgent (新增)
   ├─ 职责: 营销活动协调
   ├─ 日志: 每个活动 → 记录{campaign, reach, conversion}
   └─ 约束: >$5k活动需皇帝批准
```

#### 2.3 奏折生成器
```python
# backend/app/prince/memorial_generator.py

class MemorialGenerator:
    """生成奏折 (日报/周报/告警)"""
    
    async def generate_daily_memorial(self) -> Memorial:
        """06:00 生成日报"""
        
        # 1. 收集昨日Agent执行日志
        logs = await db.query(AgentExecutionLog).filter(
            created_at >= yesterday_06:00,
            created_at < today_06:00
        )
        
        # 2. 聚合KPI
        kpi = {
            "revenue": sum([log.revenue for log in logs]),
            "cost": sum([log.cost for log in logs]),
            "roi": revenue / cost,
            "conversion_rate": ...,
            "agents_health": {
                "social_media": agent_status.last_success_rate,
                "email": agent_status.reply_rate,
                ...
            }
        }
        
        # 3. 检测异常
        alerts = []
        if kpi["cost"] > daily_budget_80pct:
            alerts.append({
                "level": "WARNING",
                "message": f"今日成本已达预算80%: ${kpi['cost']:.2f}"
            })
        
        if kpi["conversion_rate"] < yesterday * 0.7:
            alerts.append({
                "level": "WARNING",
                "message": f"转化率下降30%: {kpi['conversion_rate']:.1%}"
            })
        
        # 4. 太子的建议 (基于历史数据)
        suggestions = await self.generate_suggestions(kpi, logs)
        
        # 5. 组织奏折 (Markdown)
        memorial_text = f"""
# 朝堂日报 · {date.strftime('%Y年%m月%d日')}

## 📊 昨日成果

| 指标 | 数值 | 环比 |
|-----|------|------|
| 收入 | ${kpi['revenue']:,.2f} | ↑ {kpi['revenue_change']:.1%} |
| 成本 | ${kpi['cost']:,.2f} | ↑ {kpi['cost_change']:.1%} |
| ROI | {kpi['roi']:.1f}x | ↑ {kpi['roi_change']:.1%} |
| 转化率 | {kpi['conversion_rate']:.1%} | ↑ {kpi['conv_change']:.1%} |

### 各部门状态

**社交媒体**: {logs['social_media'].success_count}条发布，互动率 {logs['social_media'].engagement_rate:.1%}
**销售开拓**: {logs['email'].sent_count}封邮件，回复率 {logs['email'].reply_rate:.1%}
**广告投放**: {logs['ads'].campaign_count}个活动，ROAS {logs['ads'].roas:.1f}x
**代码开发**: {logs['code'].pr_count}个PR，合并率 {logs['code'].merge_rate:.1%}
**财务**: 新增 ${logs['finance'].new_revenue:,.2f}，支出 ${logs['finance'].expenses:,.2f}

## ⚠️ 异常告警

{alerts_markdown}

## 🎯 太子建议

{suggestions_markdown}

## 📋 待皇帝裁决

- [ ] 是否{suggestion_1}? (成本+$500)
- [ ] 是否{suggestion_2}? (风险等级: 中)
- [ ] 新的政策约束?

---

*奏折生成时间: {now()}*
*备注: 以上数据可能存在延迟(最后一次同步: {last_sync_time})*
        """
        
        memorial = Memorial(
            type="daily",
            content=memorial_text,
            kpi=kpi,
            alerts=alerts,
            suggestions=suggestions,
            created_at=now()
        )
        
        await db.create(PrinceMemorial, memorial)
        return memorial
    
    async def generate_weekly_memorial(self) -> Memorial:
        """周一 09:00 生成周报"""
        # 类似日报，但:
        # - 时间范围: 上周一~周日
        # - 重点: 趋势分析 + Agent效能评估
        # - 建议: 下周策略调整
        pass
    
    async def generate_alert_memorial(self, alert: Alert) -> Memorial:
        """实时生成告警奏折"""
        # 立即推送给皇帝
        # 示例: "竞品上线新功能，建议调查"
        pass
    
    async def generate_suggestions(self, kpi: Dict, logs: List) -> List[Suggestion]:
        """生成太子的智能建议"""
        suggestions = []
        
        # 示例1: 如果ROI下降，建议调整策略
        if kpi['roi'] < kpi['roi_yesterday']:
            suggestions.append({
                "title": "ROI下降，建议调整广告策略",
                "action": "增加高效渠道投入，减少低效渠道",
                "estimated_impact": "+15% ROI",
                "cost": "+$500"
            })
        
        # 示例2: 如果某个Agent失效，建议检查
        if logs['email'].reply_rate < 0.05:
            suggestions.append({
                "title": "邮件回复率过低，建议优化模板",
                "action": "运行A/B测试新的邮件模板",
                "estimated_impact": "reply_rate +20%",
                "cost": "0"
            })
        
        return suggestions
```

#### 2.4 Agent执行日志表 (新增)
```sql
CREATE TABLE prince_agent_execution_log (
    id SERIAL PRIMARY KEY,
    agent_name VARCHAR,
    task_id VARCHAR,
    action_type VARCHAR,  -- "post", "email", "ad", etc.
    outcome_json JSONB,
    metrics_json JSONB,   -- {engagement, replies, cost, roi}
    cost_usd FLOAT,
    created_at TIMESTAMP
);

CREATE INDEX idx_agent_execution_log_created ON prince_agent_execution_log(created_at);
```

#### 2.5 验收标准
- [ ] 9个Agent都继承PrinceAgent基类
- [ ] 每个Agent都能记录执行日志到DB
- [ ] Policy检查在执行前工作
- [ ] 日报生成器能成功汇总所有Agent日志
- [ ] Markdown格式奏折可读性好
- [ ] 建议逻辑合理(不乱推荐)
- [ ] 单元测试覆盖80%+

### 时间估计: **7 business days**

### 关键依赖
- Phase 1完成 (Policy Engine)

### 风险
- Agent改造引入bug → 解决: 充分的集成测试
- 日志记录过多导致性能问题 → 解决: 异步日志，归档老数据

---

## Phase 3: 前端东宫仪表板 (周3)

### 目标
为皇帝设计东宫管理界面，查看太子状态、阅读奏折、做出裁决。

### 可交付物

#### 3.1 新路由和页面
```
/chaotang/eastern-palace/
├── /status              # 东宫实时状态
├── /memorials           # 奏折列表
├── /memorials/:id       # 阅读奏折 + 做裁决
├── /policies            # 政策管理
└── /cost-tracking       # 成本分析
```

#### 3.2 组件设计
```tsx
// web/app/chaotang/eastern-palace/page.tsx

export default function EasternPalace() {
  return (
    <CourtLayout title="东宫" subtitle="太子运营中枢">
      <Tabs>
        <Tab label="📊 实时状态">
          <PrinceStatusDashboard>
            <AgentStatusGrid />      {/* 9个Agent的健康度 */}
            <DailyCostChart />        {/* 成本趋势 */}
            <KPIMetrics />            {/* 关键指标卡片 */}
            <AlertsList />            {/* 实时告警 */}
          </PrinceStatusDashboard>
        </Tab>
        
        <Tab label="📜 奏折">
          <MemorialsList>
            {/* 列表: 日报/周报/告警 */}
            {/* 过滤: 已读/未读 */}
            {/* 搜索: 按日期/Agent/关键词 */}
          </MemorialsList>
        </Tab>
        
        <Tab label="📋 政策管理">
          <PolicyManagement>
            {/* 显示当前生效的Policy */}
            {/* 允许皇帝编辑 (JSON editor) */}
            {/* 显示政策历史 */}
          </PolicyManagement>
        </Tab>
        
        <Tab label="💰 成本分析">
          <CostTrackingDashboard>
            {/* 日/周/月成本 */}
            {/* 按Agent分类 */}
            {/* ROI走势 */}
          </CostTrackingDashboard>
        </Tab>
      </Tabs>
    </CourtLayout>
  );
}
```

#### 3.3 关键组件细节

##### PrinceStatusDashboard
```tsx
<div className="grid grid-cols-4 gap-4">
  {/* 9个Agent卡片 */}
  {agents.map(agent => (
    <AgentStatusCard key={agent.name}>
      <div className="agent-name">{agent.display_name}</div>
      <div className="status">{agent.status}</div>  {/* idle/running/error */}
      <div className="metrics">
        {agent.last_run && (
          <p>最后执行: {formatTime(agent.last_run)}</p>
        )}
        {agent.kpi && (
          <div>
            {agent.kpi_key}: {agent.kpi_value}
          </div>
        )}
      </div>
      <button onClick={() => viewAgentLog(agent.id)}>查看日志</button>
    </AgentStatusCard>
  ))}
  
  {/* 成本卡片 */}
  <CostCard>
    <h3>今日成本</h3>
    <div className="cost-number">${todayCost.toFixed(2)}</div>
    <div className="cost-trend">
      {costTrend >= 0 ? "↑" : "↓"} {Math.abs(costTrend).toFixed(1)}%
    </div>
    <div className="budget-bar">
      <ProgressBar 
        value={todayCost} 
        max={dailyBudget}
        color={todayCost > dailyBudget * 0.8 ? "warning" : "success"}
      />
      <span>{Math.round(todayCost / dailyBudget * 100)}% 预算已用</span>
    </div>
  </CostCard>
</div>

{/* 实时告警面板 */}
<AlertsPanel>
  {alerts.map(alert => (
    <AlertItem 
      key={alert.id}
      level={alert.level}  {/* INFO/WARNING/CRITICAL */}
    >
      <p>{alert.message}</p>
      <div className="actions">
        {alert.requires_approval && (
          <>
            <button onClick={() => approveAlert(alert.id)}>批准</button>
            <button onClick={() => rejectAlert(alert.id)}>拒绝</button>
          </>
        )}
      </div>
    </AlertItem>
  ))}
</AlertsPanel>
```

##### MemorialViewer (奏折阅读 + 裁决)
```tsx
export function MemorialViewer({ memorialId }) {
  const memorial = useMemorial(memorialId);
  const [decree, setDecree] = useState("");
  
  return (
    <div className="memorial-viewer">
      {/* Markdown渲染 */}
      <div className="memorial-content">
        <MarkdownRender content={memorial.content} />
      </div>
      
      {/* 下方: 皇帝的裁决区 */}
      {!memorial.read_by_emperor && (
        <div className="emperor-decree-panel">
          <h3>陛下的圣旨</h3>
          
          {/* 快速选项 */}
          <div className="decree-options">
            <button onClick={() => submitDecree("approve")}>
              ✅ 朕批准了 (执行所有建议)
            </button>
            <button onClick={() => submitDecree("partial")}>
              📋 挑选建议 (自定义)
            </button>
            <button onClick={() => submitDecree("reject")}>
              ❌ 朕反对了 (太子停止该计划)
            </button>
          </div>
          
          {/* 自由文本: 皇帝的备注 */}
          <textarea
            placeholder="陛下可以在此留下任何指示..."
            value={decree}
            onChange={e => setDecree(e.target.value)}
          />
          
          {/* 更新政策 */}
          <PolicyAdjustmentPanel
            onPolicyChange={(newPolicy) => {
              // 上传新Policy给太子
              submitPolicyUpdate(newPolicy);
            }}
          />
          
          <button 
            className="btn-submit"
            onClick={() => submitEmperorDecree(memorial.id, decree)}
          >
            📜 下达圣旨
          </button>
        </div>
      )}
      
      {memorial.read_by_emperor && memorial.emperor_decree && (
        <div className="decree-review">
          <h3>朕的圣旨</h3>
          <MarkdownRender content={memorial.emperor_decree} />
          <p className="decree-time">
            决策时间: {formatDateTime(memorial.decree_at)}
          </p>
        </div>
      )}
    </div>
  );
}
```

##### PolicyManagement
```tsx
export function PolicyManagement() {
  const [policies, setPolicies] = useState<PrincePolicy[]>([]);
  const [editing, setEditing] = useState(null);
  
  return (
    <div className="policy-management">
      <h2>东宫运营政策</h2>
      
      <Tabs>
        <Tab label="📋 当前生效">
          <PolicyViewer policy={policies.current} />
          <button onClick={() => setEditing('custom')}>
            🖊️ 编辑政策
          </button>
        </Tab>
        
        <Tab label="⏱️ 历史版本">
          <PolicyHistory policies={policies.history} />
        </Tab>
      </Tabs>
      
      {/* JSON编辑器 */}
      {editing === 'custom' && (
        <JSONEditor
          value={policies.current}
          onChange={newPolicy => {
            // 验证Policy合法性
            // 上传给太子
            submitPolicyUpdate(newPolicy);
            setEditing(null);
          }}
          schema={policySchema}  // 用Schema做验证和自动完成
        />
      )}
    </div>
  );
}
```

#### 3.4 CSS设计系统 (朝代风格)
```css
/* web/app/globals.css - 东宫相关类 */

.eastern-palace-container {
  background: linear-gradient(135deg, #0a1628 0%, #1a2a3a 100%);
  border: 2px solid #c8a862;  /* 鎏金 */
  border-radius: 8px;
  padding: 2rem;
}

.prince-status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.agent-status-card {
  background: rgba(200, 168, 98, 0.05);
  border-left: 3px solid #c8a862;
  padding: 1rem;
  border-radius: 4px;
}

.agent-status-card.idle {
  opacity: 0.6;
}

.agent-status-card.running {
  animation: pulse 2s infinite;
  border-left-color: #4ade80;
}

.agent-status-card.error {
  border-left-color: #ef4444;
  background: rgba(239, 68, 68, 0.05);
}

.memorial-content {
  font-family: 'Noto Serif SC', serif;
  line-height: 1.8;
  color: #e8dcc0;
}

.emperor-decree-panel {
  border: 2px dashed #c8a862;
  padding: 1.5rem;
  margin-top: 2rem;
  background: rgba(200, 168, 98, 0.03);
}

.decree-option-button {
  background: linear-gradient(135deg, #c8a862 0%, #a8881f 100%);
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  color: #0a1628;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.decree-option-button:hover {
  box-shadow: 0 0 20px rgba(200, 168, 98, 0.3);
  transform: translateY(-2px);
}
```

#### 3.5 验收标准
- [ ] 所有5个页面都能加载
- [ ] Agent状态实时更新 (WebSocket)
- [ ] 奏折Markdown渲染正确
- [ ] 皇帝可以提交裁决
- [ ] Policy编辑器可以验证JSON
- [ ] 响应式设计 (手机/平板)
- [ ] 朝代风格一致

### 时间估计: **5 business days**

### 关键依赖
- Phase 2完成 (奏折生成)

---

## Phase 4: 完整闭环集成测试 (周4)

### 目标
验证整个东宫系统的端到端流程，确保质量达到生产级。

### 可交付物

#### 4.1 集成测试场景
```python
# backend/tests/integration/test_prince_system.py

class TestPrinceSystem:
    
    async def test_complete_daily_cycle(self):
        """完整的日常循环: 早上06:00 ~ 晚上20:00"""
        
        # 1. 06:00 太子读取皇帝的Policy
        policies = await prince.sync_policies()
        assert policies is not None
        
        # 2. 07:00-09:00 各Agent开始运营
        #    社交媒体发布3条
        social_result = await social_agent.run(
            task=Task(type="post", content="Hello world")
        )
        assert social_result.status == "approved"
        assert social_result.action == "posted"
        
        #    邮件发送5封
        email_result = await email_agent.run(
            task=Task(type="outreach", leads_count=5)
        )
        assert email_result.sent_count == 5
        
        #    广告优化2个活动
        ads_result = await ads_agent.run(
            task=Task(type="optimize", campaigns=2)
        )
        assert ads_result.roi_improvement > 0
        
        # 3. 09:00-17:00 其他Agent继续运营
        # ...
        
        # 4. 18:00 太子汇总日报
        daily_memorial = await memorial_generator.generate_daily_memorial()
        assert daily_memorial is not None
        assert daily_memorial.kpi['revenue'] > 0
        assert len(daily_memorial.alerts) >= 0
        
        # 5. 18:01 日报推送给皇帝
        # (验证邮件发送)
        email_sent = await check_emperor_notification()
        assert email_sent is True
        
        # 6. 皇帝阅读并做出裁决
        decree = EmperorDecree(
            memorial_id=daily_memorial.id,
            action="approve",
            custom_instructions="明天增加社交预算"
        )
        result = await emperor_submit_decree(decree)
        assert result.status == "decree_recorded"
        
        # 7. 太子读取新Policy，明天执行时应用
        updated_policies = await prince.sync_policies()
        assert updated_policies['social_media']['daily_budget'] > original_budget
    
    async def test_policy_violation_escalation(self):
        """测试: 违反Policy时自动上报皇帝"""
        
        # 尝试执行一个违反Policy的决策
        decision = Decision(
            agent="ads",
            action="new_campaign",
            cost=15000  # 超过per_transaction_cap (2000)
        )
        
        # Policy Engine应该评估为ESCALATE
        verdict = await policy_engine.evaluate(decision)
        assert verdict == Verdict.ESCALATE
        
        # Agent应该自动上报皇帝，而不是执行
        result = await ads_agent.run_with_decision(decision)
        assert result.status == "pending_emperor_decree"
        
        # 皇帝收到告警
        alert = await check_escalation_alert()
        assert alert is not None
        assert alert.level == "HIGH"
    
    async def test_cost_tracking(self):
        """验证成本追踪准确性"""
        
        # 执行一天的Agent任务
        total_expected_cost = 0
        
        for agent_name in AGENT_NAMES:
            result = await agent_run(agent_name)
            total_expected_cost += result.cost
        
        # 生成成本报告
        cost_report = await cost_tracking.get_daily_report()
        
        # 验证数值一致
        assert abs(cost_report.total - total_expected_cost) < 0.01  # <$0.01偏差
        
        # 验证按Agent分类正确
        for agent_name in AGENT_NAMES:
            assert cost_report.by_agent[agent_name] > 0
    
    async def test_e2e_emperor_workflow(self):
        """端到端测试: 皇帝从阅读奏折到下达圣旨"""
        
        # 1. 日报生成
        memorial = await memorial_generator.generate_daily_memorial()
        
        # 2. 皇帝前端打开奏折
        frontend_response = await frontend.get(
            f"/api/prince/memorials/{memorial.id}"
        )
        assert frontend_response.status_code == 200
        assert frontend_response.json()['type'] == "daily"
        
        # 3. 皇帝提交裁决
        decree_payload = {
            "memorial_id": memorial.id,
            "action": "approve",
            "policy_updates": {
                "social_media": {
                    "daily_budget": 6000  # 增加预算
                }
            },
            "instructions": "加大社交投入，测试新渠道"
        }
        
        response = await frontend.post(
            f"/api/prince/memorials/{memorial.id}/decree",
            json=decree_payload
        )
        assert response.status_code == 200
        
        # 4. 太子读到新Policy
        updated_policies = await prince.sync_policies()
        assert updated_policies['social_media']['daily_budget'] == 6000
        
        # 5. 验证下一次执行时应用了新Policy
        next_result = await social_agent.run(task)
        assert next_result.budget_limit == 6000
```

#### 4.2 性能测试
```python
# backend/tests/performance/test_prince_performance.py

class TestPrincePerformance:
    
    async def test_policy_evaluation_latency(self):
        """Policy评估延迟 <100ms"""
        
        decision = generate_random_decision()
        
        start = time.time()
        verdict = await policy_engine.evaluate(decision)
        elapsed = time.time() - start
        
        assert elapsed < 0.1  # 100ms
    
    async def test_daily_memorial_generation_latency(self):
        """日报生成延迟 <30秒"""
        
        # 假设一天生成了10000条Agent日志
        for i in range(10000):
            await create_fake_agent_log()
        
        start = time.time()
        memorial = await memorial_generator.generate_daily_memorial()
        elapsed = time.time() - start
        
        assert elapsed < 30  # 30秒
    
    async def test_concurrent_agent_execution(self):
        """9个Agent并发执行时的性能"""
        
        tasks = [
            agent.run(generate_task())
            for agent in AGENTS
        ]
        
        start = time.time()
        results = await asyncio.gather(*tasks)
        elapsed = time.time() - start
        
        assert elapsed < 10  # 9个并发任务 <10秒
        assert len(results) == 9
        assert all(r.status == "success" for r in results)
```

#### 4.3 负荷测试
```bash
# 用locust模拟皇帝和太子的交互

# 配置
from locust import HttpUser, task, between

class EmperorUser(HttpUser):
    wait_time = between(1, 5)
    
    @task
    def check_prince_status(self):
        self.client.get("/api/prince/status")
    
    @task
    def read_memorial(self):
        self.client.get("/api/prince/memorials?type=daily")
    
    @task
    def submit_decree(self):
        self.client.post(
            f"/api/prince/memorials/{random_id}/decree",
            json={"action": "approve"}
        )

# 运行
# locust -f locustfile.py -u 10 -r 2 --run-time 1h
```

#### 4.4 文档和Runbook
```markdown
# 东宫系统操作指南 (Runbook)

## 日常运维检查清单 (每天)

- [ ] 06:00 太子日报是否生成? (检查DB或邮件)
- [ ] 所有9个Agent是否都是green状态?
- [ ] 今日成本是否超预算?
- [ ] 是否有critical告警需要皇帝处理?

## 故障排查

### 问题: 日报未生成
症状: 06:30 皇帝未收到日报邮件
排查:
1. 检查celery任务是否运行: `celery -A celery_app inspect active`
2. 检查Agent日志表是否有数据: `SELECT COUNT(*) FROM prince_agent_execution_log WHERE created_at > now() - interval '24h'`
3. 检查memorial_generator日志

### 问题: Agent卡住
症状: Agent状态长时间显示"running"
排查:
1. 检查Agent进程: `ps aux | grep claude`
2. 强制重启Agent: `celery -A celery_app revoke <task_id>`

## 部署检查清单

部署前:
- [ ] 所有单元测试通过
- [ ] 集成测试通过
- [ ] 性能测试满足SLA
- [ ] 数据库migration成功
- [ ] Celery Beat schedule配置正确

部署后:
- [ ] 所有API端点返回200
- [ ] WebSocket连接正常
- [ ] 日报可正常生成
- [ ] 前端页面可加载
```

#### 4.5 验收标准
- [ ] 所有集成测试通过
- [ ] 性能测试达标 (延迟<标准)
- [ ] 负荷测试可承载 100+并发
- [ ] 完整的Runbook和故障排查指南
- [ ] 文档完整，包括API文档、架构图等
- [ ] 代码覆盖率 >80%
- [ ] 零critical issue

### 时间估计: **5 business days**

### 关键依赖
- Phase 3完成 (前端)

---

## 总体时间规划

| Phase | 周次 | 任务 | 关键交付 |
|-------|------|------|--------|
| 1 | 周1-2 | 框架+Policy | backend完整，Policy Engine就位 |
| 2 | 周2-3 | Agent改造+奏折 | 9个Agent + 日报/周报 |
| 3 | 周3 | 前端仪表板 | 东宫管理界面 |
| 4 | 周4 | 集成测试+部署 | 生产级代码，完整文档 |

**总耗时**: 4周 (可并行化到3.5周)

---

## 风险和缓解

| 风险 | 影响 | 缓解方案 |
|-----|------|--------|
| Agent改造引入bug | 线上故障 | 充分的单元/集成测试，灰度发布 |
| Policy配置复杂 | 用户困惑 | JSON Schema + UI编辑器 + 默认配置 |
| 性能不达标 | 用户体验差 | 提前做性能测试，架构优化 |
| Celery任务堆积 | 日报延迟 | 增加Worker数，任务优先级管理 |
| 数据库容量 | 查询变慢 | 定期归档历史数据，添加索引 |

---

## 成功标准

✅ **项目成功** = 

1. **功能完整**
   - 9个Agent都能自主运营
   - Policy约束工作正常
   - 日报/周报/告警都能生成
   
2. **质量达标**
   - 代码覆盖率 >80%
   - 性能达标 (P95 <500ms)
   - 零critical issue

3. **用户满意**
   - 皇帝能方便地管理太子
   - 日报清晰易读
   - 裁决流程顺畅

4. **文档完整**
   - API文档 (OpenAPI)
   - 架构文档
   - Runbook和故障排查指南
   - 开发指南 (如何添加新Agent)

---

## 下一步: 启动Phase 1

确认后，我将：

1. ✅ 创建项目目录结构
2. ✅ 生成base_agent.py 和 policy_engine.py
3. ✅ 设计5个新DB表的Alembic迁移
4. ✅ 编写单元测试
5. ✅ 启动开发

**准备好了吗？** 🚀
