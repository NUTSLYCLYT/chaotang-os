# CourtOS 资源精华吸收与上线基线

## 本文件目的

把本机已有的 skills、agents、CourtOS-Brain、VAM 产物、历史文档和部门资料，收束成上线可用的“资源精华吸收计划”。本文件只吸收方法、结构、边界、验收规则和知识源索引，不把原始私密资料、运行产物、合同、财报、人物文件、模型文件或本地缓存放入 git。

## 一句话结论

上线前最值得吸收的不是更多页面，而是五类精华：工程门禁、财务/投资分析范式、证据链知识库、视觉资产规则、运营演示素材。它们必须服务 P0 裁决闭环：上书房问题 -> 丞相/军机处会审 -> 奏折 -> 裁决 -> 风险门 -> 史馆归档 -> 下次引用旧案。

## 当前主线基线

| 领域 | 主仓 | 当前基线 | 状态 |
|---|---|---|---|
| 前端 | `/home/ubuntu/workspace/frontend/chaotang-web-lyt` | `ed44458 test(ui): add three-axis office layout harness` | 已推送 |
| 后端 | `/home/ubuntu/fe/fengQun/jiqun_ai_fresh` | `4e811f0 chore: ignore local claude worktrees` | 已推送 |
| 知识库 | `/home/ubuntu/CourtOS-Brain` | 外部知识源 | 不直接并入代码 |
| 视觉工具链 | 本地视觉资产工作台 | 视觉资产/验证工具 | 不并入前端核心 |
| skills/agents | `/home/ubuntu/.codex/skills`, `/mnt/d/AI/claude-config/skills`, `/home/ubuntu/.openclaw/agents` | 方法库/角色库 | 只吸收规则 |

## 吸收原则

1. 只吸收“精华”，不搬仓库。
2. 只进主线需要的契约、门禁、提示词、知识源索引、验收标准。
3. 原始财务、合同、客户、人物、模型、VAM、IMA、H 盘资料不入 git。
4. 任何金融/股票/投资能力必须标注“非投资建议”，只输出分析框架、风险、证据、反方观点和待确认数据。
5. 任何知识源进入裁决前必须带 `sourceLabel`、证据路径、时间戳、置信度和人工确认状态。
6. `DEMO/FALLBACK/MOCK` 不得伪装为真能力。
7. 上线只证明老板裁决闭环，不证明所有部门都完全替代真人。

## 资源精华裁决表

| 资源 | 路径 | 吸收状态 | 进哪里 | 价值 | 上线动作 |
|---|---|---|---|---|---|
| 发布与回滚方法 | `.codex/skills/shipping-and-launch` | P0 吸收 | `docs/courtos_launch/12_QA_RELEASE_GATE.md` 后续补强 | 上线安全、回滚、监控 | 已作为本文件约束 |
| 三轴 UI 门禁 | `docs/THREE_AXIS_DEPARTMENT_OFFICE_UI_HARNESS.md` | P0 已吸收 | 前端 harness | 保证办公室型页面不散 | `npm run harness:three-axis-ui` |
| 户部财务/投资 skills | `finance`, `financial-statements`, `daily-stock-analysis`, `eastmoney_financial_data` | P1 吸收 | 后端户部/锦衣卫知识源设计 | 报表、股票、估值、财务分析 | 先做只读数据接入，不做荐股 |
| OpenClaw 金融 agents | `.openclaw/agents/finance-*`, `quant-analyst`, `portfolio-rebalancer`, `risk-manager` | P1 吸收 | 户部/锦衣卫/钦天监角色设计 | 多视角金融分析 | 抽取角色职责，不复制人格文件 |
| OpenClaw 法务 agents | `.openclaw/agents/legal-*` | P1 吸收 | 刑部风险门 | 合同/诉讼/红队观点 | 进入刑部后续契约 |
| CourtOS-Brain 日报/蜂群 | `CourtOS-Brain/01-Daily-Briefings`, `05-Swarms` | P1 吸收 | 史馆/锦衣卫知识源索引 | 历史判断、复盘、行动线索 | 建 ingestion manifest，不复制全文 |
| CourtOS-Brain 股票/金融 | `CourtOS-Brain/05-Swarms/Stock` | P1 吸收 | 户部投资研究库 | 牛熊观点、交易日志、复盘 | 只做研究材料，不做自动交易 |
| CourtOS-Brain 行业知识 | `_wiki/concepts`, `_wiki/sources`, `06-Chaotang-Xianhu` | P1 吸收 | 锦衣卫/行业情报 | 电池、储能、AI、供应链 | sourceLabel 必须标外部/历史 |
| 视觉工具链输出 | 本地视觉资产工作台输出目录 | P2 吸收 | 视觉资产 ledger | 人物、截图、演示素材 | 不进前端核心，不进上线门禁 |
| Hermes/skills | `hermes-agent/skills`, `.hermes/skills` | P2 吸收 | 产品运营/内容自动化 | 研究、内容、自动化经验 | 只抽方法，不并运行时 |
| 历史 OS 文档 | `docs/CHAOTANG_*`, `legacy-os-reference` | P0/P1 已大量吸收 | launch docs | 项目边界、吸收门禁 | 保持文档索引，不再散开 |

## 上线必须吸收的 6 个精华

### 1. 资源评分闸

每个资源只能判为：

| 状态 | 含义 | 上线处理 |
|---|---|---|
| `PROD` | 真链路、可观测、可回滚 | 进入主线 |
| `FIX` | 方向对但依赖缺口 | 排队修，不当上线证明 |
| `DEMO` | 只能展示 | 必须明示 demo |
| `STOP` | 分散或风险高 | 从上线范围移除 |

### 2. 知识源标签

所有外部/历史资源统一进入这些标签：

| sourceLabel | 用法 |
|---|---|
| `historical_archive` | CourtOS-Brain 历史日报、蜂群、复盘 |
| `internal_uploaded_file` | 用户上传财报、合同、部门备份 |
| `manual_confirmed` | 人工确认过的数据 |
| `web_research` | 联网查证结果 |
| `agent_inference` | AI 推理，不可直接裁决 |
| `unknown` | 禁止进入最终裁决 |

### 3. 户部顶级分析框架

户部上线后应按“六司一门”扩展：

| 模块 | 目标 | 资源来源 |
|---|---|---|
| 会计司 | 账务结构、凭证、科目、报表 | `financial-statements`、用户财务资料 |
| 出纳司 | 现金、银行、付款、收款 | 用户流水、付款申请 |
| 预算司 | 预算、ROI、现金压力 | 当前户部 contract |
| 审计司 | 异常、证据、内控缺口 | `finance-audit-judge`、审计 skills |
| 投资司 | 股票/基金/项目投资研究 | `finance-*`, `quant-analyst`, `daily-stock-analysis` |
| 融资司 | 贷款申报、融资计划书 | 财报、现金流、行业材料 |
| 风险门 | 金额、合同、对外承诺、人事、生产 | CourtOS risk gate |

上线 P0 只承诺：只读分析、证据链、风险提示、奏折草案、人工裁决。不得承诺自动替代财务负责人签字、自动付款、自动报税、自动荐股。

### 4. 金融/股票世界级分析框架

采纳 TradingAgents 风格，但必须本土化为“锦衣卫采证 + 户部估值 + 钦天监情景 + 刑部红线 + 老板裁决”。

| 维度 | 输出 |
|---|---|
| 数据层 | K 线、财报、估值、新闻、公告、资金流，全部带来源 |
| 基本面 | 收入、利润、现金流、负债、行业位置 |
| 技术面 | 趋势、均线、量价、波动率，只做辅助 |
| 情绪面 | 新闻、研报、社媒、政策 |
| 风险面 | 退市、流动性、监管、黑天鹅、仓位 |
| 反方观点 | 牛方/熊方/审计方必须分开 |
| 裁决边界 | 只给研究结论和风险，不给“买入/卖出”指令 |

### 5. 视觉资产规则

VAM 和 ComfyUI 资源只作为：

1. 演示人物素材。
2. 截图验证素材。
3. 视频/路演素材。
4. 视觉风格参考。

禁止：

1. 把 VAM runtime 并入前端核心。
2. 把大量 `.vap`、模型、截图放进 git。
3. 把 NSFW 或未授权人物素材放进上线产品。
4. 用视觉资产替代真实业务链路。

### 6. 上线验证组合

上线前最小命令：

```bash
# frontend
npm run eval:hubu
npm run guard:no-vam
npm run build
THREE_AXIS_BASE_URL=http://127.0.0.1:3002 THREE_AXIS_BASE_PATH=/chaotang npm run harness:three-axis-ui

# backend
.venv/bin/python scripts/validate_flows.py
.venv/bin/python scripts/validate_registry_sync.py
.venv/bin/python scripts/commit_closeout_check.py
```

后端如要扩大验证，优先跑户部、归档、loop、web API 相关测试，不跑真实外部调用。

## 资源进入产品的安全路径

```text
资源目录
  -> manifest 只读索引
  -> sourceLabel 分类
  -> evidence 摘要，不复制原文
  -> 进入锦衣卫/户部/史馆只读知识库
  -> 生成奏折草案
  -> 风险门
  -> 人工裁决
  -> 史馆归档
```

## 不允许上线前做的事

1. 不把 H 盘/IMA/各部门备份直接复制进 git。
2. 不把 `.vap`、模型、图片大包、运行产物进 git。
3. 不新增大规模依赖。
4. 不重构前后端主链路。
5. 不把股票分析包装成投资建议。
6. 不把 demo 页面说成生产能力。
7. 不把所有 skills/agents 搬进项目。
8. 不再开新的大页面主线。

## 第一批可执行任务

| ID | 任务 | 仓库 | 是否改代码 | 验收 |
|---|---|---|---|---|
| RE-01 | 建立 CourtOS-Brain ingestion manifest，只列目录、用途、sourceLabel、敏感等级 | 后端 | 是，新增只读 manifest/scripts | 不复制原文 |
| RE-02 | 给户部设计金融/股票只读研究 contract | 后端 | 是，docs + schema/test | 明确非投资建议 |
| RE-03 | 前端加“资源来源/可信度”徽章规范 | 前端 | 是，小范围 UI | build + screenshot |
| RE-04 | 史馆增加“历史旧案/知识源”召回说明 | 前端/后端 | 是，小范围 | 可看到来源类型 |
| RE-05 | 上线基线报告固定当前 commit、验证命令、回滚方式 | 前端 docs | 文档 | 可用于 PR/发布 |

## 上线裁决

当前可以进入“内测上线准备”，但不建议直接公开大规模上线。

可上线范围：

1. 上书房/部门办公室/诸司的基础体验。
2. 户部付款/报表预览 UI 与 contract。
3. 后端八部 grounding、户部财务/供应链/付款/报表契约。
4. 三轴 UI harness 和核心构建门禁。

暂不作为上线承诺：

1. 自动替代完整财务部。
2. 自动股票交易或荐股。
3. 自动报税、自动付款、自动签合同。
4. AI 盒子私有化部署。
5. VAM 人物系统在线 runtime。

## 下一步

先执行 `RE-05` 固定上线基线报告，再做 `RE-01` 只读知识源 manifest。这样既能“吸收资源精华”，又不会污染主线或泄露私密数据。
