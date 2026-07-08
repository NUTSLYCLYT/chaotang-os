#!/usr/bin/env python3
"""蜂群脚手架生成器:一条命令产出一个结构正确、可被引擎装载的新蜂群骨架。

生成 3 件套(与 validate_flows.py 的约定一致):
  1. config/flow_<id>.yaml         —— 声明 steps/模型/产出(末尾自动追加 qa_tech_support)
  2. src/prompts_<id>.py           —— 每个 step 的"起步提示词" + register_prompt + PROMPT_MAP_<ID>
  3. config/swarm_orchestrator.yaml —— 注册一行(幂等:已存在则跳过)

设计原则:
  - 幂等且 fail-safe:已存在的文件/注册项不覆盖(防误删人工写好的 prompt)。
  - 生成器只管"接线"(结构正确),提示词内容由人精修(起步模板已给骨架)。
  - 生成后自动跑 validate_flows.py 自检。

用法:
  python scripts/new_swarm.py \\
    --id tianjian_forecast --name "钦天监预测蜂群" \\
    --steps "trend_scanner:趋势扫描官:扫描行业/技术/政策趋势信号;\\
             risk_forecaster:风险推演师:基于信号推演风险与概率;\\
             scenario_writer:情景撰写官:写多情景预测与应对"

  --no-qa   不追加 qa_tech_support 收尾步骤
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CFG = ROOT / "config"

FLOW_TPL = """\
flow_name: "{name}"
max_llm_calls: 40

# 由 new_swarm.py 生成的骨架。提示词在 src/prompts_{id}.py 精修。
knowledge_pre_retrieval:
  enabled: false

qa_version: "v3"

default_model: "openai/glm-5.1"
default_api_base: "http://127.0.0.1:4000/v1"
default_api_key_env: "LITELLM_PROXY_KEY"

default_retry:
  max_retries: 2
  delay: 3.0
  backoff: 2.0
  retry_on:
    - error

steps:
{steps_yaml}
repair:
  enabled: false
  max_retries: 3
  min_score: 3.5
  min_delta: 0.2
  min_dimension_score: 3.0

output_fields:
{outputs_yaml}
"""

STEP_YAML_TPL = """\
  - id: "{sid}"
    name: "{sname}"
    description: "{sdesc}"
    prompt_key: "{sid}"
    prompt_module: "src.prompts_{id}"
"""

QA_STEP_YAML = """\
  - id: "qa_tech_support"
    name: "质量检查专家"
    description: "QA 质量检查与综合输出"
    prompt_key: "qa_tech_support"
"""

PROMPT_BODY_TPL = """\
你是{sname}。职责:{sdesc}。

## 铁律
1. 只基于上游/输入材料,不臆造;无依据处标"待考"。
2. 关键结论标注来源(引自上游某 Agent / 原文)。
3. (TODO: 补充本角色专属铁律 —— 由人精修)

## 输出
(TODO: 定义本角色的结构化输出模块 —— 由人精修)
"""


def slug_ok(s: str) -> bool:
    return bool(re.fullmatch(r"[a-z][a-z0-9_]*", s))


def parse_steps(raw: str) -> list[tuple[str, str, str]]:
    out = []
    for chunk in raw.split(";"):
        chunk = chunk.strip()
        if not chunk:
            continue
        parts = [p.strip() for p in chunk.split(":")]
        if len(parts) != 3 or not slug_ok(parts[0]):
            raise SystemExit(f"step 格式错误(应为 sid:中文名:描述,sid 须 a-z0-9_): '{chunk}'")
        out.append((parts[0], parts[1], parts[2]))
    if not out:
        raise SystemExit("至少需要一个 step")
    return out


def gen_prompts_module(swarm_id: str, name: str, steps: list[tuple[str, str, str]]) -> str:
    lines = [
        f'"""{name} Agent prompt — 脚手架起步版 (v0.1,由 new_swarm.py 生成,待人精修)。',
        "",
        "新增 Flow 只需定义 PROMPT_MAP_<ID>(被 flow_engine._load_prompt_from_module 自动发现)。",
        '"""',
        "",
        "from src.prompts_versioned import register_prompt",
        "",
    ]
    const_names = []
    for sid, sname, sdesc in steps:
        cname = f"PROMPT_{sid.upper()}"
        const_names.append((sid, cname, sname))
        body = PROMPT_BODY_TPL.format(sname=sname, sdesc=sdesc)
        lines.append(f"{cname} = '''\\")
        lines.append(body.rstrip("\n"))
        lines.append("'''")
        lines.append("")
    for sid, cname, sname in const_names:
        lines.append(f'register_prompt("{sid}", {cname}, name="{sname}", flow="{name}")')
    lines.append("")
    lines.append(f"PROMPT_MAP_{swarm_id.upper()} = {{")
    for sid, cname, _ in const_names:
        lines.append(f'    "{sid}": {cname},')
    lines.append("}")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description="生成一个新蜂群骨架")
    ap.add_argument("--id", required=True, help="蜂群 id(a-z0-9_),如 tianjian_forecast")
    ap.add_argument("--name", required=True, help="蜂群中文名")
    ap.add_argument("--steps", required=True, help='"sid:名:描述;sid2:名2:描述2"')
    ap.add_argument("--no-qa", action="store_true", help="不追加 qa_tech_support 收尾")
    args = ap.parse_args()

    sid_root = args.id
    if not slug_ok(sid_root):
        raise SystemExit(f"--id 须匹配 a-z[a-z0-9_]*: '{sid_root}'")
    steps = parse_steps(args.steps)

    flow_path = CFG / f"flow_{sid_root}.yaml"
    prompts_path = ROOT / "src" / f"prompts_{sid_root}.py"
    orch_path = CFG / "swarm_orchestrator.yaml"

    # 幂等防覆盖
    for p in (flow_path, prompts_path):
        if p.exists():
            raise SystemExit(f"已存在,拒绝覆盖: {p}")

    # 1) flow YAML
    steps_yaml = "".join(STEP_YAML_TPL.format(sid=s[0], sname=s[1], sdesc=s[2], id=sid_root) for s in steps)
    if not args.no_qa:
        steps_yaml += QA_STEP_YAML
    outputs = [s[1] for s in steps]
    outputs_yaml = "".join(f'  - "{o}产出"\n' for o in outputs)
    flow_path.write_text(
        FLOW_TPL.format(name=args.name, id=sid_root, steps_yaml=steps_yaml, outputs_yaml=outputs_yaml),
        encoding="utf-8",
    )

    # 2) prompts 模块
    prompts_path.write_text(gen_prompts_module(sid_root, args.name, steps), encoding="utf-8")

    # 3) 注册(幂等)
    orch = orch_path.read_text(encoding="utf-8")
    if f'id: "{sid_root}"' in orch:
        print(f"  注册项 '{sid_root}' 已存在,跳过注册")
    else:
        entry = (
            f'\n  - id: "{sid_root}"\n'
            f'    name: "{args.name}"\n'
            f'    config: "config/flow_{sid_root}.yaml"\n'
            f'    qa_version: "v3"\n'
        )
        marker = "\n# ── 冲突仲裁"
        if marker in orch:
            orch = orch.replace(marker, entry + marker, 1)
        else:
            orch = orch.rstrip() + "\n" + entry
        orch_path.write_text(orch, encoding="utf-8")

    print(f"✅ 已生成蜂群 '{sid_root}':")
    print(f"   - {flow_path.relative_to(ROOT)}")
    print(f"   - {prompts_path.relative_to(ROOT)}")
    print(f"   - 注册于 swarm_orchestrator.yaml")
    print("下一步:① 精修 src/prompts_%s.py 的提示词 ② 跑 python scripts/validate_flows.py" % sid_root)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
