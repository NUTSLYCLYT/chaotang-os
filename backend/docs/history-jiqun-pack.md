# 历史文档：jiqun-flow / PACK 研发蜂群

本文件保留 `backend/README.md` 曾经承载的 jiqun-flow / PACK 研发蜂群叙事。它是后端能力演进史和行业样板资料，不再作为 `chaotang-os/backend` 当前入口。

当前后端入口以 `backend/README.md`、`backend/AGENTS.md`、`backend/harness/README.md` 和 `backend/harness/manifest.json` 为准。

---

# jiqun-flow

**World's first LLM-native multi-agent engine for battery PACK design automation**

> "LLM integration for battery digital twins is currently aspirational rather than deployed in production."
> — arxiv:2509.02366, September 2025 (peer-reviewed, verified)

jiqun-flow is what that paper describes as a future direction. **It exists. It works. It ships HTML reports.**

---

## What it does

Send a customer requirement in natural language → receive a complete engineering evaluation in minutes:

```bash
python scripts/run_flow.py config/flow_pack_rd.yaml \
  "12V 1100Wh outdoor storage, 0.2C charge/discharge, aluminum enclosure"

# Output:
# ✅ Presale cost estimate (BOM-grounded, reads internal price DB)
# 🔗 Supply chain gate (blocks if no backup supplier found)
# 🔋 Cell selection + BMS matching (no PCB design — assembly-model-aware)
# 📡 Communication protocol adapter (RS485/CAN/BLE, not firmware dev)
# ⚖️  5-dimension technical review (requirement fit / producibility / procurement / cost / testability)
# 📄 reports/{run_id}.html  — self-contained, browser-preview + print-to-PDF
# 🔄 knowledge/flywheel/{run_id}.json  — structured decision log for data flywheel
```

---

## Quick start

```bash
git clone https://github.com/your-org/jiqun-flow
cd jiqun-flow
pip install -e ".[all]"

# Configure your LLM provider
cp config/providers.yaml.example config/providers.yaml
# edit: set your DeepSeek / OpenAI / Ollama API key

# Run a canonical example
python scripts/run_flow.py config/flow_pack_rd.yaml \
  "$(cat examples/01_outdoor_storage/input.txt)"
```

## Chaotang operating manual

If you are using the Chaotang/Codex workflow, start here:

- `docs/CHAOTANG_2026_06_05_06_CLOSEOUT.md` — 2026-06-05/06 商机闭环、质量门、Golden 审批和部署收口
- `docs/shiguan/README.md` — 史馆入口：能力建设档案
- `docs/shiguan/user_quickstart.md` — 下载用户快速上手
- `docs/codex_capability_map.md` — Codex 能力边界
- `docs/chaotang_execution_protocol.md` — 朝堂开发执行协议

Useful commands:

```bash
bash scripts/bootstrap_chaotang.sh
python scripts/chaotang_task_protocol.py "修复 OPC 评分脚本并提交"
python scripts/commit_closeout_check.py
python scripts/commit_closeout_check.py --staged-only
```

Logged-in resource profile:

```bash
GET /api/resources/profile
POST /api/resources/profile {"mode": "hybrid"}
```

**Docker (zero-config reproducibility):**

```bash
docker compose up
# then POST to http://localhost:8080/run with {"task": "your PACK requirement"}
```

---

## Architecture: 3-layer SDK strategy

```text
┌──────────────────────────────────────────────────────┐
│  Layer 3  Private · Moat                              │
│  runtime_prompts/ · failure case DB · knowledge graph │
├──────────────────────────────────────────────────────┤
│  Layer 2  Open Examples · Ecosystem entry             │
│  examples/01_outdoor_storage/                         │
│  examples/02_basestation_lowtemp/                     │
│  examples/03_ebike_motor/                             │
├──────────────────────────────────────────────────────┤
│  Layer 1  Open Core · Industry substrate              │
│  FlowEngine · YAML flow spec · Plugin API             │
└──────────────────────────────────────────────────────┘
     ↑ open (CUDA)                ↑ closed (GPU chip)
```

The scheduling runtime is open. The domain prompts and failure data are proprietary.

---

## Extending with your own swarm

```python
from src.flow_engine import FlowEngine

# Use the built-in PACK flow
engine = FlowEngine("config/flow_pack_rd.yaml")
log = engine.run("48V 20Ah e-bike, BLE, IP65, <5kg")

# Or build your own flow in YAML
engine = FlowEngine("my_custom_flow.yaml")

# Hook into run events
engine.register_hook("step_complete", my_callback)
```

**Custom agent in YAML:**

```yaml
steps:
  - id: my_competitive_analyzer
    name: 竞品分析专家
    prompt_key: competitive_analyzer   # → runtime_prompts/competitive_analyzer/
    depends_on: [cell_engineer]
    max_tokens: 2000
```

Add `runtime_prompts/competitive_analyzer/IDENTITY.md` with your agent's role definition. That's it.

---

## Data flywheel

Every run logs structured decision traces to `knowledge/flywheel/`:

```python
from src.run_logger import flywheel_stats, load_flywheel

# View accumulation stats
stats = flywheel_stats(flow_name="PACK研发蜂群流程")
# {'total_runs': 47, 'avg_qa_score': 3.2,
#  'edge_case_distribution': {'supply_chain_block': 23, 'requirement_violation': 18},
#  'gate_block_rates': {'supply_chain_feasibility': {'blocked_pct': 48.9, 'total': 47}}}

# Load for training corpus
records = load_flywheel(flow_name="PACK研发蜂群流程")
# → list[RunRecord] with edge_cases, gate_outcomes, final_output_fields
```

The moat is not the 16-step pipeline — it's what gets logged every time the pipeline runs.

---

## Golden test suite (regression for prompt changes)

```bash
# After modifying any runtime_prompts/*.md file:
python tests/golden/run_golden.py

# Output:
# ▶ 案例: 01_outdoor_storage  PASS  QA=3.4
# ▶ 案例: 02_basestation_lowtemp PASS  QA=2.8
# ▶ 案例: 03_ebike_motor      PASS  QA=3.1
# ✅ All passed — no regression
```

---

## Flow spec (YAML)

The `flow_pack_rd.yaml` format is the open standard. Full spec:

| Field | Description |
|-------|-------------|
| `steps[].id` | Unique step identifier |
| `steps[].depends_on` | DAG dependencies (list of step IDs) |
| `steps[].prompt_key` | Maps to `runtime_prompts/{key}/` |
| `steps[].output_rules` | Validation: `not_empty`, `min_length`, `required_sections`, `forbidden_patterns` |
| `steps[].max_tokens` | Per-step token limit |
| `repair.enabled` | QA gate with auto-repair loop |
| `repair.min_score` | Minimum QA score to pass (default 3.5) |

---

## Three canonical examples

| Example | Use case | Key test |
|---------|----------|----------|
| `01_outdoor_storage` | 12V 1100Wh outdoor, aluminum enclosure | Cost gate + supply chain |
| `02_basestation_lowtemp` | 24V 200Wh -40°C IP67 | Low-temp + industrial cert + dimensional constraint |
| `03_ebike_motor` | 48V 960Wh BLE IP65 cost-first | BLE protocol + cost optimization |

Each example includes `input.txt` + `expected_gates.json` for regression testing.

---

## Verified competitive landscape (deep research, 105 agents, 2025)

| Company | What they have | What's missing |
|---------|----------------|----------------|
| Eacomp + CATL + PKU | Materials-layer BDA (first-principles + cell-level DT) | No PACK-level design, no customer proposals |
| Ansys / Siemens / COMSOL | EV-level thermal simulation | Too expensive for SMEs, no LLM integration |
| Monolith AI / Voltx.ai | Unverified marketing claims (0/3 adversarial review) | No confirmed production deployment |
| **jiqun-flow** | **LLM-native PACK design + customer report generation** | **You're here** |

25 claims tested. 2 confirmed. The field is wide open.

---

## Roadmap

- [ ] **Data flywheel v2**: fine-tune a small model on accumulated failure cases
- [ ] **Physics consistency layer**: tag LLM-estimated vs. physics-model-computed parameters
- [ ] **Client report v2**: risk quantification + decision audit trail (not just specs)
- [ ] **SDK plugin registry**: community-contributed domain swarms
- [ ] **Docker compose**: one-command reproducibility for all 3 canonical examples

---

## License

MIT for the engine core. Domain prompts (`runtime_prompts/`) are proprietary.
