# 朝堂OS + 东宫系统 整体项目Harness

**项目启动日期**: 2026-06-02  
**项目所有者**: 用户 (一人公司)  
**项目范围**: 朝堂OS完整功能系统 = 前台(丞相战略) + 中台(东宫自主运营) + 后台(锦衣卫情报)  
**预计总时间**: 16周 (可压缩到12周)

---

## 项目总体里程碑

```
2026-06
  └─ 周1 (6/2-6/6)
     ├─ 东宫框架搭建 (Phase 1.1-1.2) ⭐ 当前
     ├─ Policy Engine 核心逻辑 (Phase 1.2)
     └─ 初步验证

2026-06-2周
  └─ Agent改造 + 奏折生成 (Phase 1.3-1.4)
     ├─ 9个Agent升级为东宫代理
     ├─ 日报/周报/告警生成
     └─ Celery调度配置

2026-06-3周
  └─ 前端东宫仪表板 (Phase 2)
     ├─ 实时状态面板
     ├─ 奏折阅读+裁决
     ├─ 政策管理界面
     └─ 成本分析仪表板

2026-06-4周
  └─ 集成测试 + 优化 (Phase 3)
     ├─ 端到端测试
     ├─ 性能测试
     ├─ 生产部署
     └─ 文档完成

2026-07+
  └─ 功能扩展
     ├─ 高级Agent能力
     ├─ 多用户支持
     ├─ 云端部署
     └─ SaaS化
```

---

## 项目三层架构

### 第1层：前台 - 丞相系统 (战略决策)
**状态**: ✅ 已完成 (前一阶段)  
**核心能力**:
- Claude + 三省会审 (中书/门下/尚书)
- 深度推演 (ClawTeam + 6位专家)
- 锦衣卫真网搜 (Tavily)
- 实时奏折生成 (SSE)

**关键文件**:
- `web/app/chaotang/` - 丞相前端路由
- `web/lib/ai/` - LiteLLM并行调用
- `bridge/` - ClawTeam / OpenClaw 桥接

**KPI**: 奏折质量、决策速度、信息准确性

---

### 第2层：中台 - 东宫系统 (日常运营) ⭐ **当前重点**
**状态**: 🔄 开发中 (Phase 1-4)  
**核心能力**:
- 9个垂直Agent (社交/销售/广告/代码/财务...)
- Policy约束引擎 (皇帝定制政策)
- 自主决策 + 定期汇报 (奏折)
- 成本控制 + 风险预警

**关键文件**:
- `backend/app/prince/` - 东宫核心逻辑
- `backend/alembic/` - 数据库迁移
- `web/app/chaotang/eastern-palace/` - 东宫前端

**KPI**: Agent执行效率、成本ROI、决策准确率

---

### 第3层：后台 - 锦衣卫系统 (情报支撑)
**状态**: ✅ 部分完成  
**核心能力**:
- Tavily真网搜 (竞品/政策/舆情)
- OpenClaw信息检索
- Hermes情报汇总 + 定时推送
- 记忆库 + 知识图谱

**关键文件**:
- `bridge/jinyiwei-intel.py` - 情报桥接
- `~/.hermes/` - 信息汇总引擎
- Memory system - 知识图谱

**KPI**: 信息覆盖率、实时性、准确性

---

## 东宫系统详细规划 (Phase 1-4)

### Phase 1: 框架搭建 (周1-2)

#### Phase 1.1: 数据库设计 ✅ COMPLETE
- [x] 6个SQLAlchemy模型
- [x] Alembic迁移脚本
- [x] 验证脚本
- [x] 文档完整

**可交付物**:
- `backend/app/prince/models.py` (280行)
- `backend/alembic/versions/0001_create_prince_tables.py` (120行)
- `PRINCE_DATABASE_GUIDE.md` (400+行)
- `backend/scripts/verify_prince_tables.py` (250+行)

**状态**: ✅ 完成  
**后续**: 立即执行迁移

---

#### Phase 1.2: Policy Engine (周2)
**预计**: 5 business days

**待做**:
- [ ] 实现 `backend/app/prince/policy_engine.py`
- [ ] PolicyEngine 类 (约束检查)
- [ ] PolicyEvaluator 类 (决策评估)
- [ ] 单元测试 >=80%

**可交付物**:
- `backend/app/prince/policy_engine.py` (~300行)
- `backend/tests/unit/test_policy_engine.py` (~200行)
- 文档: Policy配置指南

**验收标准**:
- Policy检查 <100ms
- 决策评估逻辑正确
- 单元测试全绿

---

#### Phase 1.3: Agent改造 (周2-3)
**预计**: 5 business days

**待做**:
- [ ] 改造BaseAgent添加policy_check()
- [ ] 改造9个Agent为PrinceAgent
- [ ] 添加execution_log记录
- [ ] 集成测试

**可交付物**:
- `backend/app/prince/agents/` - 9个改造后的Agent
- `backend/app/prince/agent_coordinator.py` - Agent协调器
- `backend/tests/integration/test_prince_agents.py`

**验收标准**:
- 所有Agent都继承PrinceAgent
- Policy检查工作正常
- 日志记录完整

---

#### Phase 1.4: Celery任务 + 奏折生成 (周3)
**预计**: 5 business days

**待做**:
- [ ] 实现 `backend/app/prince/memorial_generator.py`
- [ ] 配置Celery Beat任务
- [ ] 日报/周报/告警生成
- [ ] 奏折存储到DB

**可交付物**:
- `backend/app/prince/memorial_generator.py` (~400行)
- `backend/celery_app/prince_tasks.py`
- `backend/celery_app/beat_schedule.py`

**验收标准**:
- 日报按时生成 (06:00)
- 奏折Markdown格式正确
- 建议逻辑合理

---

#### Phase 1.5: 后端API + 数据模型 (周3-4)
**预计**: 5 business days

**待做**:
- [ ] 实现 `backend/app/api/v1/prince.py`
- [ ] GET/POST endpoints (policies/status/decisions/memorials)
- [ ] WebSocket支持 (实时更新)
- [ ] 错误处理

**可交付物**:
- `backend/app/api/v1/prince.py` (~200行)
- API文档 (OpenAPI/Swagger)

**验收标准**:
- 所有端点返回200/正常错误码
- WebSocket连接稳定
- 性能达标

---

#### Phase 1.6: 前端东宫仪表板 (周4)
**预计**: 5 business days

**待做**:
- [ ] 创建 `web/app/chaotang/eastern-palace/` 路由
- [ ] PrinceStatusDashboard (实时状态)
- [ ] MemorialViewer (奏折+裁决)
- [ ] PolicyManagement (政策编辑)
- [ ] CostTracking (成本分析)

**可交付物**:
- `web/app/chaotang/eastern-palace/page.tsx`
- `web/components/court/prince/` 组件库
- `web/styles/eastern-palace.css` (朝代风格)

**验收标准**:
- 所有5个页面可加载
- Agent状态实时更新 (WebSocket)
- 响应式设计 (手机/平板)

---

#### Phase 1.7: 集成测试 + 优化 (周4)
**预计**: 5 business days

**待做**:
- [ ] 端到端集成测试
- [ ] 性能测试 (延迟/吞吐)
- [ ] 负荷测试 (100+并发)
- [ ] 文档完成

**可交付物**:
- `backend/tests/integration/test_prince_system.py`
- 性能测试报告
- Runbook和故障排查指南

**验收标准**:
- 集成测试全绿
- 性能达标 (P95 <500ms)
- 零critical issue

---

### Phase 2: 高级功能 (周5-8) [可选]
- 多Agent协作优化
- 历史数据分析
- 自适应策略调整
- 高级告警规则

---

### Phase 3: 扩展与优化 (周9-12) [可选]
- 云端部署
- 多用户支持
- SaaS化
- 第三方集成

---

### Phase 4: 生产运维 (周13-16) [可选]
- 24/7监控
- 故障自动恢复
- 性能优化
- 用户支持

---

## 技术栈与工具

### 后端
- **框架**: FastAPI (Python 3.11)
- **数据库**: PostgreSQL 16
- **异步任务**: Celery + Redis + Beat
- **向量数据库**: ChromaDB
- **ORM**: SQLAlchemy (async)

### 前端
- **框架**: Next.js 14 + React 19
- **样式**: Tailwind CSS v4
- **构建**: Turbopack
- **API客户端**: HTTPX (backend) / fetch (frontend)

### 开发工具
- **数据库迁移**: Alembic
- **代码质量**: ruff + mypy (Python), ESLint (TypeScript)
- **测试**: pytest (backend), Vitest (frontend)
- **E2E**: Playwright
- **CI/CD**: GitHub Actions

### AI能力
- **主模型**: Claude Sonnet 4.6 (编码)
- **推理**: Claude Opus 4.8 (战略)
- **轻量**: Claude Haiku 4.5 (批处理)
- **网搜**: Tavily API
- **本地模型**: DeepSeek (成本控制)

---

## 工作流程与角色分工

### 角色
- **用户 (一人公司)**
  - 产品决策
  - 架构评审
  - 最终测试
  
- **Claude Code (AI助手)**
  - 完整开发
  - 代码审查
  - 测试编写
  - 文档生成

### 每日工作流
```
早晨:
  ├─ 查看昨日东宫奏折 (日报)
  ├─ 检查告警 (有无异常)
  └─ 决定今日方向

开发:
  ├─ Phase工作 (按计划)
  ├─ 代码审查 (高质量)
  ├─ 单元测试 (>=80%)
  └─ 集成验证

晚间:
  ├─ 代码提交
  ├─ 进度更新
  └─ 下日计划
```

---

## 成功指标 (OKR)

### 东宫系统 (中台)
- **O1**: 9个Agent完全自主运营
  - KR1: Agent成功率 >95%
  - KR2: 日成本 <$500 (可控)
  - KR3: 日报按时生成率 100%

- **O2**: Policy约束工作正常
  - KR1: Policy评估延迟 <100ms
  - KR2: 决策准确率 >90%
  - KR3: 零unintended escalations

- **O3**: 用户体验优秀
  - KR1: 前端页面加载 <2s
  - KR2: WebSocket实时性 <1s
  - KR3: 用户满意度 >4/5

### 整体系统 (三层合一)
- **O1**: 完整的人机分工
  - KR1: 战略决策由人类完成
  - KR2: 日常运营由AI自主执行
  - KR3: 情报实时推送给决策者

- **O2**: 成本效率最优
  - KR1: 月运营成本 <$5000
  - KR2: ROI >3倍
  - KR3: 无浪费支出

---

## 风险与缓解

| 风险 | 影响 | 概率 | 缓解方案 |
|-----|------|------|--------|
| 数据库迁移失败 | 无法启动 | 低 | 充分的测试、备份 |
| Agent改造引入bug | 线上故障 | 中 | 充分的单元/集成测试 |
| Policy过于复杂 | 用户困惑 | 中 | UI编辑器 + 默认配置 |
| 性能不达标 | 用户体验差 | 低 | 提前性能测试 |
| PostgreSQL扩容 | 查询变慢 | 低 | 定期归档、索引优化 |

---

## 依赖关系

```
Phase 1.1 (数据库) ✅
    ↓
Phase 1.2 (Policy Engine)
    ↓
Phase 1.3 (Agent改造)
    ├─ Phase 1.4 (Celery任务)
    ├─ Phase 1.5 (API)
    └─ Phase 1.6 (前端)
        ↓
Phase 1.7 (集成测试)
    ↓
✨ 东宫系统v1.0就绪
```

**并行关系**:
- Phase 1.4, 1.5, 1.6 可并行执行 (无依赖)
- Phase 1.2 必须在 1.3 之前 (Agent需要Policy)
- Phase 1.7 必须在最后 (集成所有模块)

---

## 成功标准 (Go-Live)

东宫系统可进入生产环境当且仅当:

- [ ] 所有Phase 1子任务完成
- [ ] 代码覆盖率 >80%
- [ ] 所有集成测试通过 (绿色)
- [ ] 性能测试达标 (P95 <500ms)
- [ ] 零critical bug
- [ ] 完整的Runbook文档
- [ ] 用户满意度 >4/5 (如有测试用户)

---

## 文件清单 (完整项目)

```
chaotang-os/
├── EASTERN_PALACE_HARNESS.md              ← 东宫详细规划 (5000+行)
├── PROJECT_MASTER_HARNESS.md              ← 整体项目规划 (本文档)
├── QUICK_SETUP.md                         ← 快速开始指南
├── SETUP_CHECKLIST.md                     ← 检查清单
│
├── backend/
│   ├── app/
│   │   ├── prince/
│   │   │   ├── __init__.py
│   │   │   ├── models.py                  ← 6个SQLAlchemy模型
│   │   │   ├── policy_engine.py           ← Policy Engine (待开发)
│   │   │   ├── orchestrator.py            ← 太子大脑 (待开发)
│   │   │   ├── agent_coordinator.py       ← Agent协调 (待开发)
│   │   │   ├── memorial_generator.py      ← 奏折生成 (待开发)
│   │   │   ├── budget_manager.py          ← 成本控制 (待开发)
│   │   │   ├── anomaly_detector.py        ← 异常检测 (待开发)
│   │   │   └── agents/                    ← 9个改造后的Agent (待改造)
│   │   ├── api/v1/
│   │   │   └── prince.py                  ← Prince API端点 (待开发)
│   │   └── ...
│   ├── alembic/
│   │   ├── env.py                         ← 迁移配置
│   │   └── versions/
│   │       └── 0001_create_prince_tables.py  ← 迁移脚本
│   ├── scripts/
│   │   └── verify_prince_tables.py        ← 验证脚本
│   └── ...
│
├── web/
│   ├── app/chaotang/
│   │   ├── eastern-palace/                ← 东宫路由 (待开发)
│   │   └── ...
│   ├── components/court/prince/           ← 东宫组件 (待开发)
│   └── ...
│
└── docs/
    ├── PRINCE_DATABASE_GUIDE.md
    ├── PHASE_1_1_SUMMARY.md
    └── ...
```

---

## 项目时间轴

| 周 | 目标 | 状态 | 交付 |
|----|------|------|------|
| W1 (6/2-6/6) | 数据库+Policy | 🔄 进行中 | Phase 1.1-1.2 |
| W2 (6/9-6/13) | Agent改造+奏折 | ⏳ 待开始 | Phase 1.3-1.4 |
| W3 (6/16-6/20) | API+前端 | ⏳ 待开始 | Phase 1.5-1.6 |
| W4 (6/23-6/27) | 集成优化 | ⏳ 待开始 | Phase 1.7 |
| W5+ | 高级功能+部署 | ⏳ 可选 | v1.1+ |

---

## 关键决策记录 (ADR)

### ADR-001: 为什么用东宫(太子)而不是皇帝来运营?
**决策**: AI自主运营(东宫), 人类战略决策(丞相)和最终裁决(皇帝)  
**原因**:
- AI适合日常重复任务
- 人类决策更准确
- 成本效率最优 (按需计费)
- 风险控制最佳 (人工把关)

### ADR-002: 为什么用Policy约束而不是完全自主?
**决策**: Policy约束 + 自主执行 + 异常上报  
**原因**:
- 防止Agent越界
- 保护品牌一致性
- 成本可控
- 用户信心足

### ADR-003: 为什么数据库用PostgreSQL而不是其他?
**决策**: PostgreSQL 16  
**原因**:
- JSONB支持灵活数据
- 性能优秀
- 开源免费
- 工具生态完善

---

## 支持与联系

**问题反馈**: 见具体Phase文档的"故障排查"部分  
**架构问题**: 见本Harness文档  
**代码问题**: 见CLAUDE.md (项目编码规范)

---

## 最终目标

```
     皇帝 (用户老板)
      ↓ 下旨/裁决
    丞相 (Claude战略)    东宫 (AI自主)    锦衣卫 (情报)
      ↓ 建议                ↓ 执行          ↓ 汇总
     三省会审           9个Agent运营     Tavily网搜
      ↓ 奏折              ↓ 日报/告警       ↓ 情报
     → 皇帝 ←  ← ← ← ← ← ← ← ← ← ← ← ← ← ← ←
```

**愿景**: 一个人用AI完整管理自己的SaaS公司，每天花30分钟看奏折，做决策。其他23.5小时，AI全自主运营。

**期限**: 2026年6月底前v1.0上线，7月底v1.1生产就绪。

---

✨ **朝堂OS + 东宫系统 = 完整的AI+人机分工体系**

**让我们开始执行吧！** 🚀
