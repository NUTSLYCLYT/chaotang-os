# jiqun_ai 全面升级计划

## 目标
1. 14 个蜂群 flow 配置全部升级到顶尖质量（核心分析步骤用 R1 推理，QA 步骤用 flash 省成本）
2. 逐个测试验证 QA 评分达到 A 级（≥4.0/5）
3. 对接 chaotang-ui-ms 前端（`/jiqun/api/*` → `http://localhost:8081/api/*`）

## 关键发现

### 模型策略（实验验证 2026-06-03）
| 步骤类型 | 当前 | 优化后 | 理由 |
|---|---|---|---|
| 核心分析/方案设计 | swarm-worker / swarm-quick | deepseek-reasoner | R1 推理链，QA +0.36分，从fail→pass |
| QA 评估 | swarm-worker | deepseek-chat (flash) | 轻量，成本降 10x，准确率够用 |
| 轻量步骤（归档/格式化） | swarm-worker | swarm-quick / swarm-worker | 保持现状 |

### 14 个蜂群分类
**核心业务链（优先测试）**
- `haolong` → `opc` → `product` → `quotation`（业务主链，5步各）
- `pack_rd` → `battery_stage_gate`（研发链，12+6步）
- `sourcing`（采购链，7步）

**支撑蜂群**
- `finance`（4步）、`legal`（4步）、`ima`（4步）
- `xiaohongshu`（4步）、`sdlc`（5步）、`ai_ops`（4步）

**简单蜂群（最后验证）**
- `court`（9步特殊）、`storage_aftercare`（6步）

### 前端对接关键
- 前端地址：`/jiqun/api/*` → next.config.ts fallback → `http://localhost:8081/api/*`
- 后端入口：`web/main.py` FastAPI，PORT=8081 已在 .env 配好
- 前端依赖端点：`GET /api/swarm/config`、`GET /api/swarm/sessions`、`POST /api/swarm/run`

---

## 阶段与任务

### Phase 0：基础设施就绪 ✅
- [x] 依赖安装（fastapi/sqlalchemy/yaml）
- [x] .env 配置（LITELLM_PROXY_KEY + DEEPSEEK_API_KEY）
- [x] providers.yaml → active: litellm_proxy
- [x] 测试全通（956/956）
- [x] R1 实验验证（OPC: B+3.64 → A 4.0）

### Phase 1：模型层升级（当前阶段）
- [ ] 1.1 更新 providers.yaml model_tiers（smart/generation → deepseek-reasoner，validation → deepseek-flash）
- [ ] 1.2 升级 flow_opc.yaml（solution_architect → R1，qa → flash）
- [ ] 1.3 批量升级其他核心 flow 的分析步骤
- [ ] 1.4 结构化输出替代 JSON fence 解析（选 2-3 个 flow 试点）

### Phase 2：逐蜂群测试（测试顺序）
| # | 蜂群 | 步骤数 | 标准测试输入 | 目标分 |
|---|---|---|---|---|
| 1 | opc | 5 | 储能PACK制造商市场进入 | ≥4.0 |
| 2 | haolong | 5 | 新能源商用车客户获取 | ≥4.0 |
| 3 | product | 5 | 电池管理系统产品规划 | ≥4.0 |
| 4 | quotation | 5 | 100kWh工商业储能系统报价 | ≥4.0 |
| 5 | finance | 4 | 储能项目投资可行性分析 | ≥4.0 |
| 6 | legal | 4 | 储能设备采购合同审查 | ≥4.0 |
| 7 | pack_rd | 12 | 280Ah LFP PACK研发任务书 | ≥3.8 |
| 8 | battery_stage_gate | 6 | PACK项目Stage Gate评审 | ≥4.0 |
| 9 | sourcing | 7 | 280Ah LFP电芯供应商筛选 | ≥4.0 |
| 10 | ima | 4 | 动力电池行业知识归档 | ≥4.0 |
| 11 | xiaohongshu | 4 | 新能源储能产品小红书推广 | ≥4.0 |
| 12 | sdlc | 5 | BMS软件开发需求拆解 | ≥4.0 |
| 13 | ai_ops | 4 | 蜂群系统运维巡检任务 | ≥4.0 |
| 14 | court | 9 | 蜂群治理决策流程 | ≥3.8 |

### Phase 3：前端对接
- [ ] 3.1 启动 web/main.py 服务（PORT=8081）
- [ ] 3.2 验证 `/api/swarm/config` 返回 14 个蜂群
- [ ] 3.3 从 chaotang-ui-ms `/jiqun/swarm` 页面触发测试运行
- [ ] 3.4 验证会话列表、实时流式输出正常显示
- [ ] 3.5 环境变量注入（chaotang-ui-ms .env 配置 JIQUN_API_URL）

---

## 验收标准
- 14 个蜂群全部能正常运行（无崩溃）
- ≥ 12/14 达到 A 级（≥4.0/5）
- chaotang-ui-ms 蜂群页面能显示所有蜂群、触发任务、查看结果
- git 提交：每个测试通过的 flow 固化 commit

## 风险
| 风险 | 概率 | 应对 |
|---|---|---|
| DeepSeek-reasoner 部分复杂 flow 超时 | 中 | 设 timeout=120s，超时回退 swarm-strong |
| RAGFlow 知识库外部依赖不可用 | 高 | 所有测试用 no_knowledge 变体或禁用 knowledge_pre_retrieval |
| pack_rd 12步流程质量难达标 | 中 | 先跑通，QA<4.0 则拆分为 2 个子流程 |
| court flow 特殊六部架构 | 低 | 独立测试，不纳入主链评分 |
