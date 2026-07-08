# 研究发现

## 实验数据

### R1 vs swarm-quick 对比（2026-06-03）
- **输入**：某新能源商用车零部件制造商，年营收8亿，储能PACK业务进入
- **swarm-quick**（flow_opc_no_knowledge）：B+ 3.64/5，QA fail，步骤全通
- **deepseek-reasoner**（flow_opc_r1_test）：A 4.0/5，QA pass，步骤全通，26秒
- **结论**：零改 prompt，切 R1，+0.36分，fail→pass。R1 发现 BOM 定价矛盾（推理能力体现）

### 可用模型清单
**LiteLLM Proxy (:4444)**
- `swarm-quick`：快速轻量（默认）
- `swarm-strong`：高质量
- `swarm-worker`：通用工作
- `swarm-review`：审查专用
- `swarm-judge`：判断专用
- `claude-sonnet-4-6`、`claude-opus-4-7`、`claude-haiku-4-5`
- `swarm-deepseek-pro/flash`：通过 Clash 不稳定（已标注）

**DeepSeek 直连**（DEEPSEEK_API_KEY 已配）
- `deepseek-reasoner`：R1 推理链，有 reasoning_content，最强
- `deepseek-chat`：映射到 deepseek-v4-flash，快速低成本

### 前端集成架构
```
chaotang-ui-ms (Next.js :3050)
  └── /jiqun/api/* (next.config.ts fallback rewrite)
       └── http://localhost:8081/api/*
            └── jiqun_ai_fresh (FastAPI web/main.py)
                 └── PORT=8081 (.env 已配)
```

### 核心 API 端点（前端需要）
- `GET  /api/swarm/config` → 返回所有蜂群定义 + 事件绑定
- `GET  /api/swarm/sessions` → 历史会话列表
- `POST /api/swarm/run` → 启动跨蜂群编排
- `GET  /api/swarm/sessions/{id}` → 会话详情（图 + 事件）
- `GET  /api/runs` → 单蜂群历史运行列表
- `GET  /api/runs/{run_id}/stream` → SSE 实时流

### Flow 步骤分类（用于模型分配策略）
| 步骤类型 | 示例 step_id | 推荐模型 |
|---|---|---|
| 领导/分析（核心推理） | opc_leader, pack_rd_leader, solution_architect | deepseek-reasoner |
| 工程专家（计算密集） | bms_hw_engineer, cell_engineer, cost_engineer | deepseek-reasoner |
| 市场/客户（创意写作） | market_intel, customer_success, lead_outreach | swarm-strong / deepseek-chat |
| QA/评估（轻量验证） | qa_tech_support, qa_check, security_auditor | deepseek-chat |
| 归档/格式化（简单） | lead_archive, ima_curator, spec_normalizer | swarm-quick |

### 已知问题
1. `market_intel` step 依赖 web_search tool（需外部 MCP server 运行）
2. `knowledge_pre_retrieval` 依赖 RAGFlow（外部服务，测试时需禁用）
3. `pack_rd` 12 步流程可能触发 context budget 压缩（需监控 zone 告警）
4. `court` flow 无 qa_version 配置（需补充）
5. `run_if` 安全漏洞已修复（评估失败默认 False）
