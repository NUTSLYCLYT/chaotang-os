# Runtime Prompts

本目录存放朝堂 OS 各 Agent 的运行时 prompt 文件。每个子目录对应一个 Agent 角色，包含该角色的 `AGENTS.md`（职责定义）和 prompt 配置。

这是**运行时配置目录**，不是 harness 运行包。Prompt 内容描述 Agent 如何执行；质量验证由 `backend/harness/` 的对应 harness 负责。

## 目录一览（71 个角色）

### 通用与编排
| 目录 | 角色 |
| --- | --- |
| `arch_planner` | 架构规划师 |
| `architecture_reviewer` | 架构评审师 |
| `code_generator` | 代码生成器 |
| `critic` | 批判性评审员 |
| `evaluate_analyst` | 评估分析师 |
| `executive_summary` | 执行摘要生成器 |
| `expert_review_gate` | 专家评审闸门 |
| `hermes_agent` | Hermes 专家 Agent |
| `prompt_optimizer` | Prompt 优化师 |
| `regression_tester` | 回归测试员 |

### 商业与市场
| 目录 | 角色 |
| --- | --- |
| `commercial_manager` | 商务经理 |
| `competitive_research` | 竞品研究专家 |
| `customer_success` | 客户成功经理 |
| `idea_analyst` | 商机分析师 |
| `idea_analyst_ops` | 商机分析师（运营版） |
| `lead_acquisition` | 获客 AI |
| `lead_archive` | 归档 AI |
| `lead_outreach` | 触达 AI |
| `market_intel` | 市场情报专家 |
| `opc_leader` | OPC 负责人 |
| `xhs_monitor` | 小红书监控员 |
| `xhs_researcher` | 小红书研究员 |
| `xhs_strategy` | 小红书策略师 |

### 财务与法务
| 目录 | 角色 |
| --- | --- |
| `compliance_check` | 合规检查员 |
| `contract_counsel` | 合同顾问 |
| `cost_analyst` | 成本分析师 |
| `cost_engineer` | 成本工程师 |
| `finance_analyst` | 财务分析师 |
| `finance_cashflow` | 现金流分析师 |
| `finance_investment` | 投资分析师 |
| `finance_risk` | 财务风控 |
| `legal_compliance` | 法律合规 |
| `legal_review` | 法务评审 |
| `presale_cost_estimator` | 售前成本估算师 |
| `quotation_analyst` | 报价分析师 |
| `security_auditor` | 安全审计员 |

### 产品与研发
| 目录 | 角色 |
| --- | --- |
| `content_publish` | 内容发布专员 |
| `product_manager` | 产品经理 |
| `product_planning` | 产品规划师 |
| `requirements_analyst` | 需求分析师 |
| `solution_architect` | 解决方案架构师 |
| `spec_normalizer` | 规格标准化师 |
| `tech_solution` | 技术方案师 |

### 供应链与制造
| 目录 | 角色 |
| --- | --- |
| `bms_hw_engineer` | BMS 硬件工程师 |
| `bms_summary` | BMS 摘要生成器 |
| `bms_sw_engineer` | BMS 软件工程师 |
| `cell_engineer` | 电芯工程师 |
| `cell_spec_collector` | 电芯规格采集员 |
| `cross_module_checker` | 跨模块检查员 |
| `manufacturing_reviewer` | 制造评审师 |
| `pack_rd_leader` | PACK 研发负责人 |
| `pack_reliability_tester` | PACK 可靠性测试师 |
| `pack_summary_expert` | PACK 汇总专家 |
| `planning_scheduler` | 计划排程师 |
| `process_test_summary` | 工艺测试摘要 |
| `quality_inspector` | 质检员 |
| `sourcing_dispatcher` | 采购派单员 |
| `sourcing_synthesizer` | 采购综合分析师 |
| `stage_gate_reviewer` | 阶段门评审师 |
| `structure_thermal_engineer` | 结构热设计工程师 |
| `supplier_intel` | 供应商情报员 |
| `supply_chain_feasibility` | 供应链可行性评估师 |

### 售后与客服
| 目录 | 角色 |
| --- | --- |
| `appointment_agent` | 预约助手 |
| `battery_project_reviewer` | 电池项目评审师 |
| `call_analyzer` | 通话分析师 |
| `failure_analyst` | 失效分析师 |
| `kb_researcher` | 知识库研究员 |
| `medical_analyst` | 医疗分析师 |
| `qa_tech_support` | 质量技术支持 |
| `qa_tester` | 质量测试员 |
| `virtual_inquirer` | 虚拟问询员 |

## 使用规则

- 每个目录下的 `AGENTS.md` 定义该 Agent 的 system prompt、输入输出格式和边界约束。
- 修改 prompt 时需同步更新 `AGENTS.md`；如改变输出格式，需核对调用该 Agent 的 flow 配置（`backend/config/flow_*.yaml`）。
- 不要在本目录存放 golden case、测试脚本或运行记录——这些属于 `backend/harness/`。

## 与 harness 的关系

| 内容 | 位置 |
| --- | --- |
| Agent 运行时 prompt 配置 | `runtime_prompts/`（本目录） |
| Agent 设计与协作文档 | `agent_design/` |
| 部门协议质量验证 | `harness/chaotang_department_protocol/` |
| 商机闭环验证 | `harness/chaotang-commercial-loop/` |
