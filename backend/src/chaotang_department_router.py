"""Shared Chaotang department-system contract and routing helpers.

钦天监职责：每次派单建议都必须带 qintianjianTrigger，说明什么信号会改变当前部门/蜂群调用判断。
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from src.chaotang_department_payload import build_prime_minister_next_step, build_qintianjian_trigger
from src.department_identity import (
    raw_department_config,
    runtime_projection,
    validate_identity_consumer_keys,
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DEPARTMENT_CONFIG = PROJECT_ROOT / "harness" / "chaotang_department_protocol" / "departments.yaml"

MINISTRY_KEYWORDS = runtime_projection("routing_keywords")
DEPARTMENT_PERSONAS = runtime_projection("persona")

EXECUTION_VISUALIZATION_STAGES = [
    {
        "stage": "route",
        "label": "钦天监定向",
        "visible_status": "读任务、找关键词、提出会改变判断的信号。",
    },
    {
        "stage": "department",
        "label": "六部接旨",
        "visible_status": "主责部门点亮，显示人格原型、首调蜂群和安全边界。",
    },
    {
        "stage": "swarm",
        "label": "蜂群脉冲",
        "visible_status": "子蜂群并行产出证据、风险、方案和缺口。",
    },
    {
        "stage": "yushi",
        "label": "御史审查",
        "visible_status": "检查证据、付费公平、自动化权限和红黑风险。",
    },
    {
        "stage": "shiguan",
        "label": "史馆归档",
        "visible_status": "把路由、证据、结果和学习样本写入长期记忆。",
    },
    {
        "stage": "second_review",
        "label": "二审授功",
        "visible_status": "真实成果二审通过后才发功业，称号仍由功业系统判定。",
    },
]

PRACTICAL_OPERATING_DOCTRINE = {
    "name": "实用闭环铁律",
    "purpose": "让所有部门从漂亮建议收口到老板可裁决、御史可审、史馆可复用的结果。",
    "rules": [
        "先判断真实目标和 P0 缺口，再给方案。",
        "每条建议必须落成 next_action、owner、evidence、risk_gate 或 archive_record。",
        "能用确定性规则、表格、计算器或 harness 校验的内容，不交给 LLM 自由发挥。",
        "没有 sourceLabel / evidence 的结论只能标为 needs_evidence，不得包装成已验证事实。",
        "涉及资金、客户承诺、生产、权限、合规、删除或对外发布，必须进入御史或人工确认门。",
        "部门只给可审预览和裁决建议，不直接自动付款、交易、签约、发生产或删数据。",
        "所有真实结果、失败样本和客户反馈必须回史馆，变成下一轮可复用经验。",
        "每轮只推进一个最小可验证闭环，不用概念堆叠代替交付。",
    ],
    "bossFacingShape": [
        "一句话结论",
        "证据与来源",
        "缺口与风险",
        "老板可选动作",
        "禁止自动执行项",
        "下一步 owner",
        "归档/复盘入口",
    ],
}


def load_department_config(path: Path = DEFAULT_DEPARTMENT_CONFIG) -> dict[str, Any]:
    if path == DEFAULT_DEPARTMENT_CONFIG:
        config = raw_department_config()
    else:
        from src.department_identity import load_department_identity

        config = load_department_identity(path)
    validate_identity_consumer_keys(
        "six_ministries",
        config.get("six_ministries", {}),
        namespace="runtime_code",
        require_complete=True,
    )
    return config


def camelize_ministry(spec: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": spec.get("name", ""),
        "definition": spec.get("definition", ""),
        "function": spec.get("function", ""),
        "callsSwarms": spec.get("calls_swarms", []),
        "completesWork": spec.get("completes_work", []),
        "outputTypes": spec.get("output_types", []),
        "advisorLenses": spec.get("advisor_lenses", []),
        "geniusDesign": spec.get("genius_design", ""),
        "functionUpgrades": spec.get("function_upgrades", []),
        "harnessGate": spec.get("harness_gate", ""),
        "gate": spec.get("gate", ""),
    }


def count_genius_ready_ministries(ministries: dict[str, Any]) -> int:
    return sum(
        1
        for spec in ministries.values()
        if len(spec.get("advisor_lenses", [])) >= 2
        and spec.get("genius_design")
        and spec.get("function_upgrades")
        and spec.get("harness_gate")
    )


def build_dashboard_summary(ministries: dict[str, Any], config: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": "六部蜂群调度",
        "primaryAction": "输入任务后调用派单接口，得到六部、蜂群、丞相下一步和钦天监触发器。",
        "routeEndpoint": "/api/chaotang/department-system/route",
        "protocolHarness": "harness/chaotang_department_protocol",
        "readiness": {
            "sixMinistriesReady": len(ministries),
            "geniusReady": count_genius_ready_ministries(ministries),
            "requiredFieldsReady": len(config.get("contract_required_fields", [])),
            "routeGate": "department_routes",
        },
        "nextActions": [
            "先 route task，确认 primaryDepartment 和 candidateDepartments。",
            "让主责六部调用 firstSwarm 产出证据，再进入御史门禁。",
            "把结果回填史馆；客户、成本、质量或风险信号回钦天监更新触发器。",
        ],
        "operatingDoctrine": PRACTICAL_OPERATING_DOCTRINE,
    }


def build_routing_playbook(ministries: dict[str, Any]) -> list[dict[str, Any]]:
    playbook = []
    for code, spec in ministries.items():
        calls_swarms = spec.get("calls_swarms", [])
        output_types = spec.get("output_types", [])
        first_swarm = calls_swarms[0] if calls_swarms else ""
        primary_output = output_types[0] if output_types else ""
        playbook.append(
            {
                "code": code,
                "name": spec.get("name", ""),
                "firstSwarm": first_swarm,
                "callsSwarms": calls_swarms,
                "primaryOutputType": primary_output,
                "advisorLenses": spec.get("advisor_lenses", []),
                "geniusDesign": spec.get("genius_design", ""),
                "harnessGate": spec.get("harness_gate", ""),
                "operatingDoctrine": PRACTICAL_OPERATING_DOCTRINE,
                "personaPrototype": DEPARTMENT_PERSONAS.get(code, {}),
                "nextActionTemplate": (
                    f"{spec.get('name', code)}先调用 {first_swarm} 蜂群产出 {primary_output}，"
                    "再交御史审查并由史馆归档。"
                ),
            }
        )
    return playbook


def build_persona_prototypes(ministries: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        {
            "code": code,
            "name": spec.get("name", ""),
            **DEPARTMENT_PERSONAS.get(code, {}),
        }
        for code, spec in ministries.items()
    ]


def build_execution_visualization() -> dict[str, Any]:
    return {
        "pulseMetric": "visible_agent_work",
        "principle": "只展示有证据的工作状态；动画必须对应 route、swarm、gate、archive 或 review payload。",
        "stages": EXECUTION_VISUALIZATION_STAGES,
    }


def build_swarm_execution_trace(
    department_code: str,
    task: str,
    swarms: list[str] | None = None,
) -> list[dict[str, Any]]:
    persona = DEPARTMENT_PERSONAS.get(department_code, {})
    swarms = swarms or []
    first_swarm = swarms[0] if swarms else "ai_ops"
    return [
        {
            **EXECUTION_VISUALIZATION_STAGES[0],
            "actor": "qintianjian",
            "evidence": f"task={task[:48]}",
            "status": "done",
        },
        {
            **EXECUTION_VISUALIZATION_STAGES[1],
            "actor": department_code,
            "evidence": persona.get("historicalPrototype", department_code),
            "status": "done",
        },
        {
            **EXECUTION_VISUALIZATION_STAGES[2],
            "actor": first_swarm,
            "evidence": " / ".join(swarms[:4]) if swarms else first_swarm,
            "status": "running",
        },
        {
            **EXECUTION_VISUALIZATION_STAGES[3],
            "actor": "yushi",
            "evidence": persona.get("safetyBoundary", ""),
            "status": "pending",
        },
        {
            **EXECUTION_VISUALIZATION_STAGES[4],
            "actor": "shiguan",
            "evidence": "route_record + outcome_record",
            "status": "pending",
        },
        {
            **EXECUTION_VISUALIZATION_STAGES[5],
            "actor": "yushi_second_review",
            "evidence": "功业二审前不发奖",
            "status": "pending",
        },
    ]


def build_live_war_report(
    department_code: str,
    task: str,
    swarms: list[str] | None = None,
    status: str = "running",
) -> dict[str, Any]:
    """Build the user-visible live report from evidence-backed execution stages."""
    trace = build_swarm_execution_trace(department_code, task, swarms)
    completed = sum(1 for item in trace if item.get("status") == "done")
    running = sum(1 for item in trace if item.get("status") == "running")
    return {
        "module": "live_war_report",
        "order": 1,
        "title": "朝堂实时战报流",
        "status": status,
        "principle": "用真实 payload 阶段替代空 loading，让用户看见谁在工作、证据是什么、下一步去哪。",
        "summary": f"{completed} 阶段已完成，{running} 阶段正在推进。",
        "events": [
            {
                "stage": item.get("stage"),
                "label": item.get("label"),
                "actor": item.get("actor"),
                "status": item.get("status"),
                "evidence": item.get("evidence"),
                "visible_status": item.get("visible_status"),
            }
            for item in trace
        ],
        "next_action": "继续让当前部门补证据，直到御史和史馆都能接住。",
        "harness_gate": "chaotang_department_personas.live_war_report",
    }


def build_advisor_review_panel(department_code: str, task: str) -> dict[str, Any]:
    persona = DEPARTMENT_PERSONAS.get(department_code, {})
    return {
        "module": "advisor_review_panel",
        "order": 2,
        "title": "大神会审面板",
        "status": "ready",
        "principle": "重大任务必须显式呈现赞成、反对、漏洞和天才建议，避免顾问只做装饰。",
        "advisors": [
            {
                "lens": persona.get("historicalPrototype", "主责部门原型"),
                "stance": "赞成",
                "view": "主责部门可以先接任务，但必须保留证据链和下一步 owner。",
            },
            {
                "lens": persona.get("modernPrototype", "现实作战负责人"),
                "stance": "反对",
                "view": "如果只展示结果不展示中间状态，用户仍会觉得是黑盒。",
            },
            {
                "lens": "御史",
                "stance": "漏洞",
                "view": persona.get("safetyBoundary", "风险边界必须写进审查门禁。"),
            },
            {
                "lens": "钦天监",
                "stance": "天才建议",
                "view": f"把「{task[:28]}」拆成可改变决策的触发器，而不是一次性结论。",
            },
        ],
        "accepted_design": "采纳分歧式会审：每轮至少一个赞成、一个反对、一个风险、一个天才建议。",
        "next_action": "把会审结论写入战报和史馆学习样本。",
        "harness_gate": "chaotang_department_personas.advisor_review",
    }


def build_memory_replay(department_code: str, task: str) -> dict[str, Any]:
    persona = DEPARTMENT_PERSONAS.get(department_code, {})
    return {
        "module": "memory_replay",
        "order": 3,
        "title": "史馆记忆回放",
        "status": "ready",
        "principle": "每次执行都要沉淀为下次可复用的任务、证据、失败征兆和预防动作。",
        "memory_cards": [
            {
                "type": "success_pattern",
                "title": "成功模式",
                "content": "先 route，再补证据，御史准归档后才执行蜂群，二审通过后才发功业。",
            },
            {
                "type": "failure_signal",
                "title": "失败征兆",
                "content": "只展示漂亮结论、不展示 actor/evidence/status，会让蜂群显得像静态文案。",
            },
            {
                "type": "reusable_prompt",
                "title": "可复用提示",
                "content": f"请以{persona.get('historicalPrototype', department_code)}人格处理：{task[:36]}，输出证据、边界、下一步。",
            },
            {
                "type": "prevention",
                "title": "下次预防",
                "content": "所有新工作流必须先补 live report、advisor review、memory replay、forecast sandbox 四件套。",
            },
        ],
        "next_action": "把本轮 learning 注入下一次上书房和部门派单。",
        "harness_gate": "chaotang_department_personas.memory_replay",
    }


def build_forecast_sandbox(department_code: str, task: str) -> dict[str, Any]:
    return {
        "module": "forecast_sandbox",
        "order": 4,
        "title": "钦天监预测沙盘",
        "status": "ready",
        "principle": "预测必须给假设、触发信号和部门动作；不把不确定性包装成确定结论。",
        "scenarios": [
            {
                "name": "保守路线",
                "probability": "45%",
                "move": "只上线可审计 trace 和部门人格，先不扩大自动执行权限。",
                "trigger": "用户能在 5 秒内说清主责部门和下一步。",
            },
            {
                "name": "增长路线",
                "probability": "35%",
                "move": "把会审面板和史馆回放放到每个关键任务，提升复用和信任感。",
                "trigger": "用户连续两次主动点击执行蜂群或查看史馆。",
            },
            {
                "name": "极限路线",
                "probability": "20%",
                "move": "接入真实事件流、成本、延迟和失败恢复，但必须加权限、限流和人工门禁。",
                "trigger": "蜂群真实执行成功率稳定高于 harness 阈值。",
            },
        ],
        "watchlist": [
            "用户是否看懂 actor/evidence/status",
            "蜂群事件是否全部来自 payload",
            "是否有越权自动化或虚假忙碌感",
        ],
        "next_action": "选保守路线做首版上线，保留增长路线开关。",
        "harness_gate": "chaotang_department_personas.forecast_sandbox",
    }


def build_genius_experience_modules(
    department_code: str,
    task: str,
    swarms: list[str] | None = None,
) -> list[dict[str, Any]]:
    return [
        build_live_war_report(department_code, task, swarms),
        build_advisor_review_panel(department_code, task),
        build_memory_replay(department_code, task),
        build_forecast_sandbox(department_code, task),
    ]


def department_system_payload(config: dict[str, Any] | None = None) -> dict[str, Any]:
    config = config or load_department_config()
    ministries = config.get("six_ministries", {})
    return {
        "version": config.get("version"),
        "globalNextStepDesign": config.get("global_next_step_design", {}),
        "topAdvisorDesign": config.get("top_advisor_design", {}),
        "practicalOperatingDoctrine": PRACTICAL_OPERATING_DOCTRINE,
        "dashboardSummary": build_dashboard_summary(ministries, config),
        "routingPlaybook": build_routing_playbook(ministries),
        "personaPrototypes": build_persona_prototypes(ministries),
        "executionVisualization": build_execution_visualization(),
        "geniusExperienceModules": build_genius_experience_modules("gongbu", "默认朝堂任务"),
        "sixMinistries": [
            {"code": code, **camelize_ministry(spec)}
            for code, spec in ministries.items()
        ],
        "summary": {
            "sixMinistryCount": len(ministries),
            "geniusReadyCount": count_genius_ready_ministries(ministries),
            "requiredPayloadFields": config.get("contract_required_fields", []),
        },
    }


def score_ministry(code: str, task: str) -> tuple[int, list[str]]:
    task_lower = task.lower()
    hits = [keyword for keyword in MINISTRY_KEYWORDS.get(code, []) if keyword.lower() in task_lower]
    return len(hits), hits


def route_department_task(task: str, config: dict[str, Any] | None = None) -> dict[str, Any]:
    config = config or load_department_config()
    ministries = config.get("six_ministries", {})
    scored = []
    for code, spec in ministries.items():
        score, hits = score_ministry(code, task)
        scored.append((score, code, hits, spec))
    scored.sort(key=lambda item: (-item[0], item[1]))
    if scored and scored[0][0] > 0:
        selected = [item for item in scored if item[0] > 0][:3]
    else:
        selected = [(0, "gongbu", [], ministries["gongbu"])]

    primary_score, primary_code, primary_hits, primary_spec = selected[0]
    next_action = f"{primary_spec['name']}先调用 {primary_spec['calls_swarms'][0]} 蜂群形成第一版证据，再进御史和史馆。"
    return {
        "task": task,
        "primaryDepartment": {
            "code": primary_code,
            **camelize_ministry(primary_spec),
            "matchedKeywords": primary_hits,
            "score": primary_score,
        },
        "candidateDepartments": [
            {
                "code": code,
                "name": spec.get("name", ""),
                "matchedKeywords": hits,
                "score": score,
                "callsSwarms": spec.get("calls_swarms", []),
                "harnessGate": spec.get("harness_gate", ""),
            }
            for score, code, hits, spec in selected
        ],
        "nextAction": next_action,
        "primeMinisterNextStep": build_prime_minister_next_step(primary_code, next_action),
        "qintianjianTrigger": build_qintianjian_trigger(task),
        "yushiGateHint": primary_spec.get("gate", ""),
    }
