# 打包收口清单 + 梳理计划

> 2026-07-01。本会话所有有用的文件 / 资源 / 依赖,带路径与用途,方便打包收口。
> 全量备份已推:`origin/backup/full-snapshot-20260701`(382 提交)。

## 一、核心引擎(本会话新建,按依赖顺序)

| 文件 | 行 | 用途 | 依赖谁 |
|---|---|---|---|
| `schemas/court_doc.json` | — | 全院文书契约(机器面单一标准) | — |
| `src/court_doc_builder.py` | 222 | 部门无关装配器(灯/双接地门/C2/印章/存证) | court_doc.json, persona_registry |
| `src/persona_registry.py` | 282 | 大神分席 + RAG 门 gate_conclusion + 守宪 | advisor_protocols.yaml |
| `src/persona_eval.py` | 99 | 大神个人评分 + 升席棘轮 | persona_registry |
| `src/lawyer_rag.py` | 58 | 律师法条库轻量检索(rag_hit 来源) | 律师 references |
| `src/xingbu_verdict.py` | 131 | **刑部判决引擎**(LLM抽取+RAG接地)← 首发垂直 | court_doc_builder, lawyer_rag, model_adapter |
| `src/gongbu_review_verdict.py` | 74 | 工部验收(确定性重算接地) | court_doc_builder, pack_rd_sizing |
| `src/hubu_memorial_verdict.py` | 69 | 户部奏报 | court_doc_builder, hubu_cashflow_* |
| `src/hubu_cashflow_runway_memorial.py` | 362 | 户部现金跑道确定性计算 | — |
| `src/dept_doc.py` | 67 | 通用部门文书桥(8 部门口吻) | court_doc_builder |
| `src/swarm_to_court_doc.py` | 74 | 蜂群输出→court_doc 焊缝 | dept_doc |
| `src/pipeline_tier.py` | 101 | P0–P3 复杂度分档 | — |
| `src/resource_router.py` | 52 | 分档→开哪些层(省资源) | pipeline_tier |
| `src/difficulty_assessor.py` | 112 | 难易度评判(旨意×自动化×军机处)+用户可改 | resource_router |
| `src/token_monitor.py` | 101 | token 监控+预算护栏(防跑飞) | — |
| `src/dispute_escalation.py` | 72 | 异议阶梯(部门↔御史→丞相→皇帝) | — |

**已接进 live 的点**:`token_monitor` ← `src/model_adapter.py`(记账);court_doc ← `src/swarm_execution_loop.py`(深焊)。
**建好待接**:`resource_router`/`difficulty_assessor`/`token_monitor.guard` 还没进 orchestrator 入口(第 10 件事之 #3)。

## 二、复用的既有引擎(系统底座,别动)

`src/flow_engine.py`(4119,流程引擎)、`src/swarm_execution_loop.py`(蜂群)、`src/swarm_orchestrator.py`、
`src/model_adapter.py`(LLM 调用)、`src/provider.py`(provider 路由)、`src/model_tiering.py`(成本档)、
`src/knowledge_rag.py`(向量 RAG)、`src/truth_ledger.py`(留痕)、`src/shiguan_archive.py`(史馆归档)、
`src/court_flywheel.py`/`failure_memory.py`/`signoff_learning.py`(自进化三股)、`src/yushi_gate.py`(御史闸)、
`src/shangshufang_loop.py`(上书房/丞相)、`src/decision_guard.py`(签字)、`src/db/`(ORM+迁移)、`web/`(FastAPI)。

## 三、配置 / 契约

- `config/providers.yaml` — provider+模型(active=deepseek,本机环境,**不进功能提交**)
- `config/advisor_protocols.yaml` — 大神协议(40 大神+守护 lens)
- `config/flow_*.yaml`(33) — 各业务流
- `harness/yushi_global_gate/rules.yaml` — 御史闸规则(L0-L5/四灯)
- `harness/chaotang_department_protocol/departments.yaml` — 部门花名册

## 四、语料 / 知识资源

- `skills/personas/`(43)— 大神人设,含 `*-lawyer/references/*.md`(6 份真法条库)
- `scripts/golden_cases/*.json`(25)+ `quality_baseline.json` — 评测基线(**单独提交,不混功能**)
- `scripts/persona_cases/*.json` — 大神判例种子

## 五、校验 / 门禁脚本

- `scripts/ci_gate.py` — 合并前总门(宪法+协议)
- `scripts/commit_closeout_check.py` — 提交前分拣(挡运行产物)
- `scripts/validate_dept_conformance.py` / `validate_advisor_protocols.py` — 守宪/协议
- `scripts/nightly_flywheel.py` — 每日自进化飞轮(待挂调度)

## 六、依赖

`requirements-core.txt`(主)、`requirements-optional.txt`、`requirements-pg.txt`(Postgres)、`requirements-test.txt`、`requirements.txt`。
关键:fastapi/uvicorn、litellm、sqlalchemy/alembic、pyyaml、jsonschema、pytest。**注意**:本机 python3.14 未装 `python-dotenv`/`alembic` CLI(web/main 自带 `.env` 解析,不依赖 dotenv 包)。

## 七、运行时资源(环境,不打包进代码)

- `.env` — 真实 key(DeepSeek 有效,**已 gitignore,从未提交**),`web/main.py` 启动自动加载。
- 本地 Ollama(:11434)— `qwen3.6-35b-a3b-q4`/`qwen3:4b`/`nomic-embed`(免 key 兜底+embedding)。
- `data/fengqun.db`(SQLite,运行产物,gitignore)。
- 游离运行产物:`eval/truth_ledger.jsonl`(留痕,不提交)。

## 八、文档

`docs/dept_design/`(13:11 部门设计+README+frontend_handoff)、`docs/frontend_ui/`(13:11 部门 UI+README+yushi_entrance)、
`docs/architecture/`(court_pipeline_layering / dept_constitution / shiguan_flywheel / yushi_design)、`docs/ideas/future_verticals.md`(创意冷藏)。

## 九、梳理打包收口计划(配合"最该做的十件事")

1. **保命**:✅ 已推备份分支 `backup/full-snapshot-20260701`。
2. **划定首发垂直包**:只打包刑部链所需 → `court_doc_builder` + `xingbu_verdict` + `lawyer_rag` + `persona_registry`/`eval` + 合同律师/刑部 persona + `court_doc.json` + `web/routers/legal.py`。其余冷冻(不删,标 [冷冻])。
3. **接线收口**:`resource_router`/`difficulty_assessor`/`token_monitor.guard` 接进 orchestrator 入口(待办)。
4. **分层提交纪律**:功能码 / 测试 / 配置 / 质量基线 / 文档 分开 commit;`config/providers.yaml`、`data/`、`eval/` 永不进功能提交(`commit_closeout_check` 守)。
5. **依赖锁定**:首发垂直只需 core 依赖,产 `requirements-xingbu.txt`(fastapi+litellm+sqlalchemy+pyyaml+jsonschema)。
6. **环境清单交接**:部署方按"运行时资源"配 `.env`(DeepSeek key)+ 起 Ollama 兜底 + `alembic upgrade head`。
7. **冷冻区归档**:八垂直创意 + 未接垂直的 persona/flow 标 [冷冻],留 `docs/ideas/` 与冷藏分支,赢了再解冻。
