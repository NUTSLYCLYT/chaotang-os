# src/chaotang_orchestrator.py
"""朝堂编排核心:拟旨分类 / DAG 装配 / 事件翻译 / 异步 run。

边界注(2026-07-08,防铁律3误收敛):draft_decree 是**拟旨/圣旨路径**的丞相(LLM 分诊,
人确认后才会审);chancellor_router.decide 是**密旨直发路径**的丞相(确定性关键词,
不调 LLM)。两者不是同一意图两实现,收敛前先过铁律7三问,详见 chancellor_router 模块注。
"""

from __future__ import annotations

import json
import os
import re
import secrets

from src.manor_groups import groups_for_ministers
from src.minister_personas import council_prompt

_STRONG_MODEL = "openai/swarm-strong"
_CHEAP_MODEL = "openai/swarm-worker"
_API_BASE = "http://127.0.0.1:4444/v1"
_API_KEY_ENV = "LITELLM_PROXY_KEY"

# 拟旨专用：DeepSeek 直连（JSON结构化输出更稳定）
_DRAFT_MODEL = "openai/deepseek-chat"
_DRAFT_API_BASE = "https://api.deepseek.com/v1"
_DRAFT_API_KEY_ENV = "DEEPSEEK_API_KEY"


def _assess_stakes_safe(raw_command: str) -> dict:
    """调 risk_assessor，失败时保守返回 medium。"""
    try:
        from src.risk_assessor import assess_stakes

        return assess_stakes(raw_command)
    except Exception:
        return {"stakes": "medium", "reason": "评估不可用"}


_DRAFT_SYSTEM = (
    "你是朝堂丞相。皇帝下达口谕,你需:1) 用一句话复述意图;"
    "2) 给出 2-4 个可选的处理分类(category),每类说明拟召哪些大臣。"
    "大臣代号只能取:hu_bu(户部财务) li_bu(吏部人事) xing_bu(刑部法务) "
    "gong_bu(工部产研) li_bu_rites(礼部市场) bing_bu(兵部执行) "
    "jin_yi_wei(锦衣卫情报) qin_tian_jian(钦天监预测) scribe(史官复盘)。"
    "taskType 取:analysis|strategy|execution|creative|compliance|forecast|intel|health|general。"
    # 可追溯性硬约束(大神会审 2026-06-04 · 把"无依据黑箱"变成 schema 非法输出):
    # 只为"分诊/起草"这一层的判断留推理链,解释"为什么这样分诊",不要编造执行层的具体数值/方案。
    "可追溯性(必填):reasoning 写'为什么把意图理解成这样';每个 category 必填 evidence"
    "(逐字引用口谕原文中支撑该分类的原话片段)与 basis(为什么召这些大臣、不召别的)。"
    "evidence 必须是口谕里真实出现的字句,凭据不足时如实写明,绝不编造。"
    '严格输出 JSON:{"draft":..,"intent":..,"reasoning":..,"categories":[{"label":..,'
    '"description":..,"taskType":..,"ministers":[..],"confidence":0-1,'
    '"evidence":"口谕原文片段","basis":"召这些大臣的理由"}]}'
)


def _llm_json(prompt: str, *, model: str = _DRAFT_MODEL) -> str:
    """调真实 LLM,返回字符串(期望 JSON)。默认用 DeepSeek 直连，JSON结构化更稳定。"""
    from src.model_adapter import ModelAdapter

    if model == _DRAFT_MODEL:
        adapter = ModelAdapter(
            model=model, api_base=_DRAFT_API_BASE, api_key=os.getenv(_DRAFT_API_KEY_ENV)
        )
    else:
        adapter = ModelAdapter(
            model=model, api_base=_API_BASE, api_key=os.getenv(_API_KEY_ENV)
        )
    res = adapter.call(system_prompt=_DRAFT_SYSTEM, user_prompt=prompt)
    return res.get("output", "")


def _kb_search(query: str) -> list[dict]:
    """KB 检索,返回 [{source, snippet, score}]。失败返回 []。"""
    try:
        from src.knowledge_rag import get_rag

        hits = get_rag().search(query, top_k=3) or []
        out = []
        for h in hits:
            out.append(
                {
                    "source": h.get("source", "chroma"),
                    "snippet": (h.get("content") or h.get("text") or "")[:200],
                    "score": h.get("score", 0.0),
                }
            )
        return out
    except Exception:
        return []


def _parse_json_block(text: str) -> dict:
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        raise ValueError("no json")
    return json.loads(m.group(0))


def _lenient_json(text: str) -> dict:
    """宽松解析:救 LLM 常见 JSON 错(尾逗号)。漏逗号救不了,交给上层退原文。"""
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        raise ValueError("no json")
    s = re.sub(r",(\s*[}\]])", r"\1", m.group(0))  # 去尾逗号 ,} ,]
    return json.loads(s)


def _memorial_from_aggregate(text: str) -> dict:
    """把 aggregate 奏折文本解析成 final_output —— **永不返回空**。

    LLM 生成 JSON 常漏逗号/带尾逗号(实跑见 final_output=NO,一个逗号丢整份奏折)。
    分层:严格解析 → 宽松修复 → 都失败退 raw_memorial 原文(标 parse_failed)。
    保证奏折正文不因格式瑕疵全丢:前端至少能显原文,不白屏、不假成功。
    """
    for parse in (_parse_json_block, _lenient_json):
        try:
            d = parse(text)
            if isinstance(d, dict) and d:
                return d
        except Exception:
            continue
    return {
        "raw_memorial": text,
        "parse_failed": True,
        "headline": "奏折已生成(结构化解析失败,显原文)",
        "source_label": "RAW_TEXT",
    }


def _label_opinion_sources(fo: dict) -> None:
    """#8 标源:给奏折每条部门意见标 硬/软/确定性门,让上书房一眼看清哪段可信。就地改 fo。

    ENGINE_BACKED = 有真实部门引擎撑腰(兵部/锦衣卫/刑部/户部);
    DETERMINISTIC_GATE = 工部,确定性验收另见 gongbu_verdict 段;
    LLM_ONLY = 纯 LLM 会审未接地(吏部/礼部…);SYNTHESIS = 丞相/研发组非部门会审。
    """
    ops = fo.get("opinions")
    if not isinstance(ops, list):
        return
    for op in ops:
        if not isinstance(op, dict):
            continue
        code = str(op.get("agentCode", ""))
        bare = code[len("council_") :] if code.startswith("council_") else code
        if bare == "gong_bu":
            op["source_label"] = "DETERMINISTIC_GATE"
            op["source_note"] = "确定性验收见 gongbu_verdict 段"
            continue
        if code == "decree" or code.startswith("group_"):
            op["source_label"] = "SYNTHESIS"
            op["source_note"] = "丞相/执行环节,非部门会审"
            continue
        try:
            from src.real_department_engines import get_raw_engine_fn_for_minister

            if get_raw_engine_fn_for_minister(bare) is not None:
                op["source_label"] = "ENGINE_BACKED"
                op["source_note"] = "真实部门引擎撑腰"
                continue
        except Exception:
            pass
        op["source_label"] = "LLM_ONLY"
        op["source_note"] = "纯 LLM 会审,未接地(诚实标注)"


def draft_decree(raw_command: str) -> dict:
    """拟旨:意图 + KB 检索 → 推荐分类(每类带 groups + citations)。"""
    import concurrent.futures as _cf

    with _cf.ThreadPoolExecutor(max_workers=2) as _pool:
        _cit_fut = _pool.submit(_kb_search, raw_command)
        _stakes_fut = _pool.submit(_assess_stakes_safe, raw_command)
        citations = _cit_fut.result()
        _stakes_result = _stakes_fut.result()

    reasoning = ""
    try:
        parsed = _parse_json_block(_llm_json(raw_command))
        source = "llm"
        cats_in = parsed.get("categories", [])
        draft_text = parsed.get("draft", "")
        intent = parsed.get("intent", raw_command[:60])
        reasoning = parsed.get("reasoning", "")  # 可追溯性:分诊推理链
    except Exception:
        source = "rule"
        draft_text = f"拟旨:{raw_command[:60]}"
        intent = raw_command[:60]
        cats_in = [
            {
                "label": "丞相直办",
                "description": "通用处理",
                "taskType": "general",
                "ministers": ["scribe"],
                "confidence": 0.4,
            }
        ]

    categories = []
    for c in cats_in:
        ministers = [m for m in c.get("ministers", []) if m]
        categories.append(
            {
                "id": f"cat_{secrets.token_hex(4)}",
                "label": c.get("label", "未命名分类"),
                "description": c.get("description", ""),
                "taskType": c.get("taskType", "general"),
                "ministers": ministers,
                "groups": groups_for_ministers(ministers),
                "confidence": float(c.get("confidence", 0.5)),
                "citations": citations,
                "evidence": c.get("evidence", ""),  # 可追溯性:口谕原文支撑片段
                "basis": c.get("basis", ""),  # 可追溯性:召这些大臣的理由
            }
        )
    # routing_truth(会审Karpathy 2026-07-08):LLM 丞相的分诊也落账,账本看见全部流量——
    # 否则尺子只看得见密旨直发一半,两个丞相的对照永远做不了。best-effort 不断主链路。
    try:
        from src.orchestration_plan import record_routing_decision

        top = categories[0] if categories else {}
        record_routing_decision(
            {
                "mode": "llm_draft",
                "entry_swarms": [],
                "ministries": [
                    {"code": m, "score": None} for m in top.get("ministers", [])
                ],
                "abstained": [],
            },
            raw_command,
            chosen_by="llm_chancellor",
        )
    except Exception:
        pass
    return {
        "draft": draft_text,
        "intent": intent,
        "reasoning": reasoning,  # 可追溯性:分诊推理链
        "recommendedCategories": categories,
        "source": source,
        "stakes": _stakes_result.get("stakes", "medium"),
        "stakesReason": _stakes_result.get("reason", ""),
    }


# ---------------------------------------------------------------------------
# assemble_flow: 据分类装配 DAG flow YAML
# ---------------------------------------------------------------------------
from pathlib import Path
import yaml as _yaml

from src.manor_groups import load_manor_groups

_GEN_DIR = Path(__file__).resolve().parent.parent / "config" / "_generated"

_SUBAGENT_SYSTEM = (
    "你是庄园基层执行子代理。按下方结构化任务说明完成具体工作,直接产出可用结果。"
    "若信息不足,基于已知合理推断并标注假设,不要空转。"
)
_COUNCIL_SYSTEM = (
    "你是{minister}大臣,参与军机处会审。针对圣旨与丞相理解,给出本部门专业意见、"
    "关键风险与可执行建议,200-400 字,务实不空泛。"
)


def _fetch_real_engine_doc(code: str, task_text: str) -> dict | None:
    """若该大臣 code 有真实部门专用引擎,同步调用一次返回原始 court_doc。

    未注册/调用失败/无产出 → None,调用方一律回退现状,不抛异常。
    """
    if not task_text:
        return None
    try:
        from src.real_department_engines import get_raw_engine_fn_for_minister

        adapter = get_raw_engine_fn_for_minister(code)
        if adapter is None:
            return None
        return adapter(task_text)
    except Exception:
        return None


def _format_grounding(doc: dict | None, *, intel_context: str = "") -> str:
    """把 court_doc 格式化成拼进会审 prompt 的文本,可选附加锦衣卫核实过的情报上下文。"""
    if not doc and not intel_context:
        return ""
    parts = []
    if doc:
        items_text = "；".join(
            str(i.get("title", "")) for i in (doc.get("items") or [])[:5]
        )
        parts.append(
            "\n\n【真实引擎参考 —— 来自本部门专用引擎的确定性判定,不是你自己编的】\n"
            f"判定:{doc.get('light', '')} | {doc.get('headline', '')}\n"
            f"要点:{items_text or '(无具体条目)'}\n"
            "请在会审意见里参考以上真实判定,不得与之矛盾编造相反结论;"
            "如需补充你的专业视角,清楚区分哪些是引擎给的确定性判定、哪些是你的补充意见。"
        )
    if intel_context:
        parts.append(
            f"\n\n【锦衣卫已核实情报 —— 供你参考,不是你自己查的】\n{intel_context}"
        )
    return "".join(parts)


def _real_engine_grounding(code: str, task_text: str) -> str:
    """兼容旧调用点:单个大臣的真实引擎 grounding,不含跨部门情报上下文。"""
    return _format_grounding(_fetch_real_engine_doc(code, task_text))


def assemble_flow(
    plan: dict,
    *,
    task_id: str,
    out_dir: "Path | None" = None,
    max_subagents_per_group: "int | None" = None,
) -> str:
    """据 plan(ministers + groups)装配临时 DAG flow YAML,返回文件路径。"""
    out_dir = out_dir or _GEN_DIR
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    all_groups = {g.id: g for g in load_manor_groups()}

    steps: list[dict] = []
    # L0 丞相理解:单一根步骤(规避多根 DAG 的引擎缺陷 + 为下游提供 intent 上下文)
    steps.append(
        {
            "id": "decree",
            "name": "decree",
            "model": _STRONG_MODEL,
            "api_base": _API_BASE,
            "api_key_env": _API_KEY_ENV,
            "prompt_inline": (
                "你是丞相。复述并结构化皇帝口谕:用 3-5 句给出任务目标、关键问题、预期产出。"
                f"意图参考:{plan.get('intent', '')}"
            ),
        }
    )
    task_text = str(plan.get("rawCommand") or plan.get("intent") or "")
    # 锦衣卫(如在本次会审名单里)先取一次真实情报,喂给其余大臣当上下文——跟 L4
    # (上书房 swarm_execution_loop._run_departments_cross_referenced)同款设计,
    # 只取一次避免对锦衣卫真实引擎(Tavily)重复调用。会审各步骤本身仍是并行执行
    # (depends_on 都是 decree),互引发生在装配阶段的文本拼接,不影响并行时序。
    _JINYIWEI_CODE = "jin_yi_wei"
    jinyiwei_doc = (
        _fetch_real_engine_doc(_JINYIWEI_CODE, task_text)
        if _JINYIWEI_CODE in plan["ministers"]
        else None
    )
    intel_context = ""
    if jinyiwei_doc and jinyiwei_doc.get("source_label") == "LIVE_ENGINE":
        intel_context = "；".join(
            str(i.get("title", "")) for i in (jinyiwei_doc.get("items") or [])[:5]
        )

    council_ids = []
    for code in plan["ministers"]:
        sid = f"council_{code}"
        council_ids.append(sid)
        base_prompt = council_prompt(code, _COUNCIL_SYSTEM.format(minister=code))
        if code == _JINYIWEI_CODE:
            grounding = _format_grounding(jinyiwei_doc)
        else:
            grounding = _format_grounding(
                _fetch_real_engine_doc(code, task_text), intel_context=intel_context
            )
        steps.append(
            {
                "id": sid,
                "name": sid,
                "model": _STRONG_MODEL,
                "api_base": _API_BASE,
                "api_key_env": _API_KEY_ENV,
                "depends_on": ["decree"],
                "prompt_inline": base_prompt + grounding,
            }
        )

    group_step_ids = []
    for gid in plan["groups"]:
        g = all_groups.get(gid)
        if not g:
            continue
        workers = g.subagent_max
        if max_subagents_per_group:
            workers = min(workers, max_subagents_per_group)
        disp_id = f"group_{gid}_dispatch"
        spawn_id = f"group_{gid}"
        related = [
            f"council_{m}" for m in g.ministers if f"council_{m}" in council_ids
        ] or ["decree"]
        steps.append(
            {
                "id": disp_id,
                "name": disp_id,
                "model": _STRONG_MODEL,
                "api_base": _API_BASE,
                "api_key_env": _API_KEY_ENV,
                "depends_on": related,
                "prompt_inline": (
                    f"你是{g.name}组长。据会审意见,把任务拆成至多 {workers} 个独立子任务。"
                    "每个子任务输出为一段结构化说明,含:目标/期望输出/边界/建议数据源。"
                    '严格输出 JSON:{"subtasks":["<子任务1结构化说明>", ...]}'
                ),
            }
        )
        effective_runtime = g.resolved_runtime()
        group_step: dict = {
            "id": spawn_id,
            "name": spawn_id,
            "step_type": (
                effective_runtime
                if effective_runtime != "openclaw"
                else "openclaw_dispatch"
            ),
            "spawn_from_field": "subtasks",
            "spawn_agent_id": disp_id,
            "spawn_max_workers": workers,
            "spawn_merge": "numbered",
            "model": _CHEAP_MODEL,
            "api_base": _API_BASE,
            "api_key_env": _API_KEY_ENV,
            "depends_on": [disp_id],
            "prompt_inline": _SUBAGENT_SYSTEM,
        }
        if effective_runtime == "openclaw" and g.openclaw_base_url_env:
            group_step["openclaw_base_url"] = os.getenv(g.openclaw_base_url_env, "")
        steps.append(group_step)
        group_step_ids.append(spawn_id)

    steps.append(
        {
            "id": "aggregate",
            "name": "aggregate",
            "model": _STRONG_MODEL,
            "api_base": _API_BASE,
            "api_key_env": _API_KEY_ENV,
            "depends_on": group_step_ids or council_ids or ["decree"],
            "prompt_inline": (
                "你是丞相。汇总会审与各组执行结果,产出奏折(八段式)JSON:"
                '{"background":..,"objective":..,"opinions":[{"agentCode":..,"text":..}],'
                '"risks":[..],"recommendation":..,'
                '"executionPath":[{"phase":..,"task":..,"owner":..,"status":"planned"}],'
                '"decisionsNeeded":[..],"nextSteps":[..]}'
            ),
        }
    )

    cfg = {
        "flow_name": f"朝堂:{plan.get('intent', '')[:40]}",
        "default_model": _STRONG_MODEL,
        "default_api_base": _API_BASE,
        "default_api_key_env": _API_KEY_ENV,
        "qa_version": "v2",
        "steps": steps,
    }
    path = out_dir / f"chaotang_{task_id}.yaml"
    path.write_text(
        _yaml.safe_dump(cfg, allow_unicode=True, sort_keys=False), encoding="utf-8"
    )
    return str(path)


# ---------------------------------------------------------------------------
# 事件翻译 + 容错执行 + 预算
# ---------------------------------------------------------------------------
from datetime import datetime

from src.model_adapter import BudgetExceeded, LLMCallBudget
from src.flow_engine import FlowEngine  # 模块级引用,便于测试 monkeypatch


def step_to_sheng(name: str) -> "str | None":
    """步骤名 → 三省归属。
    - council_* → zhongshu (中书省:起草/会审)
    - group_* / aggregate → shangshu (尚书省:下发/执行/汇总)
    - QA 在 FlowEngine 内部运行,由调用方在 aggregate 完成后人工注入 menxia 事件。
    - decree → None(丞相前置,非三省)
    """
    if name.startswith("council_"):
        return "zhongshu"
    if name.startswith("group_") or name == "aggregate":
        return "shangshu"
    return None


def translate_event(ev: dict) -> "dict | None":
    """引擎事件 → 朝堂 SSE 语义事件;返回 None 表示不转发。"""
    t = ev.get("type")
    if t == "heartbeat":
        return None
    if t == "flow_start":
        return {
            "type": "council.summon",
            "total": ev.get("total"),
            "steps": ev.get("steps", []),
        }
    if t in ("step_start", "step"):
        name = ev.get("name", "") or ""
        sheng = step_to_sheng(name)
        if name == "decree":
            if t == "step":
                return {
                    "type": "decree.understood",
                    "summary": (ev.get("output") or "")[:600],
                }
            return None
        if name.startswith("council_"):
            return {
                "type": "minister.opinion",
                "agentCode": name[len("council_") :],
                "name": name,
                "status": ev.get("status", "running"),
                "output": (ev.get("output") or "")[:600],
                "sheng": sheng,
            }
        if name.startswith("group_") and not name.endswith("_dispatch"):
            gid = name[len("group_") :]
            if t == "step_start":
                return {
                    "type": "group.dispatch",
                    "groupId": gid,
                    "name": name,
                    "sheng": sheng,
                }
            status = ev.get("status", "success")
            return {
                "type": "group.aggregated",
                "groupId": gid,
                "status": status,
                "summary": (ev.get("output") or "")[:600],
                "sheng": sheng,
            }
        if name == "aggregate" and t == "step":
            return {
                "type": "council.aggregated",
                "summary": (ev.get("output") or "")[:600],
                "sheng": sheng,
            }
        return None
    if t == "token":
        return {
            "type": "subagent.step",
            "step": ev.get("step"),
            "content": ev.get("content", ""),
        }
    if t in ("done", "error"):
        return ev
    return None


def run_chaotang_task(
    task_id: str,
    q,
    *,
    flow_path: str,
    task_input: str = "",
    budget_max_calls: int = 80,
    min_success_groups: int = 1,
    stakes: str = "low",
) -> None:
    """同步执行装配后的 DAG flow,把引擎事件翻译进 q。供线程调用。"""
    from web.task_registry import mark_status, update_monitor

    # ── governance pause gate ──────────────────────────────────────
    if stakes in ("medium", "high"):
        from web.task_registry import create_governance_event

        gov_event = create_governance_event(task_id)
        q.put(
            {
                "type": "governance.pause",
                "stakes": stakes,
                "message": "丞相已分析完毕，请批准出动蜂群",
                "requiresApproval": True,
            }
        )
        if not gov_event.wait(timeout=300):
            q.put({"type": "error", "message": "治理审批超时（5分钟），任务已取消"})
            return
        q.put({"type": "governance.approved", "stakes": stakes})
    # ── end governance gate ────────────────────────────────────────

    # NOTE: budget ContextVar is not propagated into FlowEngine's spawn ThreadPoolExecutor workers; subagent fan-out is bounded structurally by spawn_max_workers × group count. Full per-call budget across threads is a known follow-up (engine-level copy_context).
    LLMCallBudget.set(budget_max_calls)
    ok_groups: list[str] = []
    # 三省状态追踪:记录已激活过的 sheng,避免重复发 active 事件
    _active_shengs: set[str] = set()

    def _emit_sansheng(sheng: str, status: str, summary: str = "") -> None:
        """发一条三省语义事件。"""
        _SHENG_NAMES = {
            "zhongshu": "中书省",
            "menxia": "门下省",
            "shangshu": "尚书省",
        }
        q.put(
            {
                "type": "sansheng",
                "sheng": sheng,
                "shengName": _SHENG_NAMES.get(sheng, sheng),
                "status": status,
                "summary": summary,
            }
        )

    def forward(ev: dict) -> None:
        out = translate_event(ev)
        if out is None:
            return
        # 三省阶段事件:首次出现某 sheng 的步骤时,发 active;步骤完成时可发 done
        sheng = out.get("sheng")
        if sheng:
            if sheng not in _active_shengs:
                _active_shengs.add(sheng)
                _emit_sansheng(sheng, "active")
            # council_* 步骤完成(minister.opinion 且 status=success/done)→ 中书省进度
            if out["type"] == "minister.opinion" and out.get("status") in (
                "success",
                "done",
            ):
                _emit_sansheng(
                    "zhongshu",
                    "progress",
                    summary=f"大臣 {out.get('agentCode', '')} 完成会审",
                )
            # aggregate 完成 → 尚书省 done
            if out["type"] == "council.aggregated":
                _emit_sansheng("shangshu", "done", summary=out.get("summary", "")[:200])
        if out["type"] == "group.aggregated":
            if out.get("status") == "error":
                q.put(
                    {
                        "type": "risk.flagged",
                        "level": "high",
                        "label": f"{out['groupId']} 组执行失败",
                        "detail": "已降级,继续汇总",
                    }
                )
            else:
                ok_groups.append(out["groupId"])
        q.put(out)

    def on_flow_start(total, name, step_names):
        update_monitor(
            task_id, flow_name=name, total_steps=total, step_names=step_names
        )
        forward({"type": "flow_start", "total": total, "steps": step_names})

    def on_step_start(i, name, model=None):
        update_monitor(task_id, current_step=i, current_step_name=name)
        forward({"type": "step_start", "step": i, "name": name})

    def on_step_done(i, total, name, elapsed, status, output=""):
        update_monitor(task_id, completed_steps=i + 1)
        forward(
            {
                "type": "step",
                "step": i,
                "total": total,
                "name": name,
                "status": status,
                "output": output,
            }
        )
        # aggregate 完成 → 尚书省收尾后立即注入门下省(QA 复核)事件
        if name == "aggregate" and status in ("success", "done", ""):
            _emit_sansheng(
                "menxia", "active", summary="丞相汇总完成,门下省开始 QA 复核"
            )

    def on_token(step_idx, token):
        forward({"type": "token", "step": step_idx, "content": token})

    try:
        engine = FlowEngine(flow_path, qa_version="v2")
        run_log = engine.run(
            task_input,
            on_flow_start=on_flow_start,
            on_step_start=on_step_start,
            on_step_done=on_step_done,
            on_token=on_token,
        )
        run_status = getattr(run_log, "run_status", "normal")
        if run_status in ("error", "budget_exceeded"):
            raise RuntimeError(f"run 终止:{run_status}")
        if len(ok_groups) < min_success_groups:
            raise RuntimeError(f"成功组数 {len(ok_groups)} < 阈值 {min_success_groups}")
        # FlowEngine 只从 QA 形态的末步提取 final_output;我们的 aggregate 直接产 JSON,
        # 故在此把 aggregate 输出解析为 final_output 并落盘,供奏折详情读取。
        fo = getattr(run_log, "final_output", None) or {}
        if not fo:
            for s in getattr(run_log, "steps", None) or []:
                if getattr(s, "agent_name", "") == "aggregate" and getattr(
                    s, "output", ""
                ):
                    fo = _memorial_from_aggregate(s.output)
                    break
            if fo:
                _label_opinion_sources(fo)  # #8:每条部门意见标 硬/软/确定性门
                try:
                    from src.step_log import save_final_output

                    save_final_output(run_log.run_id, fo, run_log.qa_result or {})
                    run_log.final_output = fo
                except Exception:
                    pass
        # 工部确定性验收:把"算得准那版"(no-LLM 重算门)补进奏折工部段。
        # 会审阶段无精算,故在研发组产出后核串并数;抽不到→UNKNOWN,诚实标源,禁假 PASS。
        try:
            _gv = _gongbu_deterministic_verdict(run_log, task_input)
            if _gv and isinstance(fo, dict):
                _gated = bool((_gv.get("provenance") or {}).get("deterministic_gated"))
                fo["gongbu_verdict"] = {
                    "light": _gv.get("light"),
                    "headline": _gv.get("headline"),
                    "items": _gv.get("items"),
                    "deterministic_gated": _gated,
                    "source_label": "DETERMINISTIC_GATE" if _gated else "UNVERIFIED",
                }
                try:
                    from src.step_log import save_final_output

                    save_final_output(run_log.run_id, fo, run_log.qa_result or {})
                    run_log.final_output = fo
                except Exception:
                    pass
                q.put(
                    {
                        "type": "gongbu.verdict",
                        "light": _gv.get("light"),
                        "headline": _gv.get("headline"),
                        "deterministic_gated": _gated,
                    }
                )
        except Exception:
            pass
        q.put(
            {
                "type": "memorial.drafted",
                "runId": run_log.run_id,
                "memorialId": run_log.run_id,
                "qualityScore": (run_log.quality_score or {}).get("total_score"),
            }
        )
        # QA 复核完成(奏折已起草) → 门下省完成
        _emit_sansheng("menxia", "done", summary="门下省 QA 复核完成,奏折已起草")
        _finished_at = datetime.now().isoformat(timespec="seconds")
        mark_status(task_id, "done", run_id=run_log.run_id, finished_at=_finished_at)
        q.put(
            {
                "type": "done",
                "taskId": task_id,
                "runId": run_log.run_id,
                "memorialId": run_log.run_id,
            }
        )
        # H-1: 终态双写回 DB(tasks 表 + memorials 索引表)
        _persist_task_done(task_id, run_log, _finished_at)
        _auto_submit_department_protocol(run_log, task_id)
    except BudgetExceeded as be:
        q.put({"type": "error", "message": f"预算超限:{be}"})
        mark_status(task_id, "error", error=str(be))
        _persist_task_error(task_id, str(be))
    except Exception as e:
        q.put({"type": "error", "message": str(e)})
        mark_status(task_id, "error", error=str(e))
        _persist_task_error(task_id, str(e))


# ── 工部确定性验收:把"算得准那版"补进奏折 ────────────────────────────────
_GONGBU_TASK_MARKERS = (
    "pack",
    "电池",
    "电池包",
    "串并",
    "锂电",
    "电芯",
    "bms",
    "储能",
)


def _sizing_from_natural_language(text: str) -> "dict | None":
    """从研发组自然语言里抽**唯一**串并数(+电芯容量/化学)构造精算 dict。

    只在方案已收敛(全文唯一一种 NSMP)时抽;出现多方案(如 "19S6P 改为 20S4P")
    → 返回 None,让确定性门保持诚实 UNKNOWN,绝不硬抽一个假装确定(禁假 PASS)。
    抽不全的字段留空,由 pack_rd_sizing 自行判 UNKNOWN。
    """
    import re

    pairs = re.findall(r"(\d{1,3})\s*[SsＳ串]\s*(\d{1,3})\s*[PpＰ并]", text or "")
    uniq = {(int(a), int(b)) for a, b in pairs}
    if len(uniq) != 1:
        return None  # 0 个或多方案未定 → 诚实 UNKNOWN
    series, parallel = next(iter(uniq))
    out: dict = {"series_S": series, "parallel_P": parallel}
    cap = re.search(r"(\d+(?:\.\d+)?)\s*[Aa][Hh]", text or "")
    if cap:
        out["cell_capacity_ah"] = float(cap.group(1))
    if re.search(r"LFP|磷酸铁锂", text or "", re.I):
        out["chemistry"], out["cell_nominal_v"] = "LFP", 3.2
    elif re.search(r"NCM|NMC|三元", text or "", re.I):
        out["chemistry"], out["cell_nominal_v"] = "NCM", 3.7
    return out


def _gongbu_deterministic_verdict(run_log, task_input: str) -> "dict | None":
    """工部确定性验收(no-LLM 重算门)补进奏折的"算得准那版"。

    军机处会审阶段拿不到精算(只有圣旨),故确定性重算门放在**研发组产出精算之后**的
    验收位:取 group_rnd(缺则 aggregate)输出的串并数 → pack_rd_sizing 重算 → 对不上标
    红、抽不到围栏 JSON 标 UNKNOWN(禁假 PASS)。非 pack/工程任务不触发,返回 None。
    """
    text = (task_input or "").lower()
    if not any(m in text for m in _GONGBU_TASK_MARKERS):
        return None
    presale = ""
    for want in ("group_rnd", "aggregate"):
        for s in getattr(run_log, "steps", None) or []:
            if getattr(s, "agent_name", "") == want and getattr(s, "output", ""):
                presale = s.output
                break
        if presale:
            break
    if not presale:
        return None
    try:
        from src.gongbu_review_verdict import run_gongbu_review

        case_id = getattr(run_log, "run_id", None)
        doc = run_gongbu_review(presale, task_input, case_id=case_id, archive=False)
        # A:研发组常用自然语言(如 "19S6P")而非 fenced JSON。若门抽不到(未 gated),
        # 尝试从文本 regex 抽**唯一**串并数构造精算再核一次;多方案/抽不到 → 保持诚实 UNKNOWN。
        if not (doc.get("provenance") or {}).get("deterministic_gated"):
            recovered = _sizing_from_natural_language(presale)
            if recovered:
                import json as _json

                synth = presale + "\n\n```json\n" + _json.dumps(recovered) + "\n```"
                doc2 = run_gongbu_review(
                    synth, task_input, case_id=case_id, archive=False
                )
                if (doc2.get("provenance") or {}).get("deterministic_gated"):
                    return doc2
        return doc
    except Exception:
        return None


# ── H-1: 任务终态持久化 helpers ──────────────────────────────────────────

import logging as _log_mod

_orch_logger = _log_mod.getLogger(__name__)


def _persist_task_done(task_id: str, run_log, finished_at: str) -> None:
    """run 完成后把终态写回 DB:tasks 表(done+run_id+步骤数)+memorials 索引表。

    失败记 error 日志但不阻断主流程(双写降级安全模式)。
    """
    try:
        from src.db.engine import SessionLocal
        from src.db.flow_store import update_task_status, upsert_memorial
        from src.chaotang_store import _get_default_tenant_id  # type: ignore[attr-defined]
        from src.chaotang_api import enrich_memorial
        from web.run_utils import run_summary

        tenant_id = _get_default_tenant_id()
        total = len(getattr(run_log, "steps", None) or [])

        db = SessionLocal()
        try:
            # tasks 终态
            update_task_status(
                session=db,
                task_id=task_id,
                status="done",
                task_status="report_ready",
                run_id=run_log.run_id,
                finished_at=finished_at,
                last_stage="report_ready",
                completed_steps=total,
                total_steps=total,
                legacy_writer_id="chaotang-orchestrator-p3-pending",
            )
            # memorials 索引表:派生完整 memorial 字段(含 riskLevel,KP-8)
            try:
                summary = run_summary(run_log)
                summary["final_output"] = getattr(run_log, "final_output", None)
                mem = enrich_memorial(summary)
                upsert_memorial(
                    session=db,
                    memorial_id=run_log.run_id,
                    tenant_id=tenant_id,
                    task_id=task_id,
                    title=mem.get("title", ""),
                    source_department=mem.get("sourceDepartment", ""),
                    agent_code=mem.get("agentCode", ""),
                    priority=mem.get("priority", "medium"),
                    status="approved" if mem.get("status") == "approved" else "pending",
                    summary=mem.get("summary", ""),
                    created_at=mem.get("createdAt", ""),
                    legacy_writer_id="chaotang-orchestrator-p3-pending",
                )
            except Exception as _me:
                _orch_logger.error(
                    "upsert_memorial 失败 run_id=%s: %s", run_log.run_id, _me
                )
            db.commit()
        except Exception as _e:
            db.rollback()
            _orch_logger.error(
                "_persist_task_done DB 写失败 task_id=%s: %s", task_id, _e
            )
        finally:
            db.close()
    except Exception as _e:
        _orch_logger.error(
            "_persist_task_done 会话创建失败 task_id=%s: %s", task_id, _e
        )


def _auto_submit_department_protocol(run_log, task_id: str) -> None:
    """Optionally send completed orchestrator runs through department protocol.

    This is deliberately non-blocking: the business run is already complete, and
    protocol submission must not turn a successful user workflow into a failure.
    """
    try:
        from src.chaotang_department_autosubmit import safe_submit_run_log

        result = safe_submit_run_log(
            run_log, flow_name=getattr(run_log, "flow_name", None)
        )
        if result.get("status") == "error":
            _orch_logger.error(
                "department protocol autosubmit failed task_id=%s: %s",
                task_id,
                result.get("error"),
            )
    except Exception as exc:
        _orch_logger.error(
            "department protocol autosubmit crashed task_id=%s: %s", task_id, exc
        )


def _persist_task_error(task_id: str, error_msg: str) -> None:
    """run 失败后把终态写回 DB:tasks 表(error+error_msg)。"""
    try:
        from src.db.engine import SessionLocal
        from src.db.flow_store import update_task_status
        from datetime import datetime, timezone

        db = SessionLocal()
        try:
            update_task_status(
                session=db,
                task_id=task_id,
                status="error",
                task_status="failed",
                finished_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
                last_stage="error",
                error=error_msg[:500],
                legacy_writer_id="chaotang-orchestrator-p3-pending",
            )
            db.commit()
        except Exception as _e:
            db.rollback()
            _orch_logger.error(
                "_persist_task_error DB 写失败 task_id=%s: %s", task_id, _e
            )
        finally:
            db.close()
    except Exception as _e:
        _orch_logger.error(
            "_persist_task_error 会话创建失败 task_id=%s: %s", task_id, _e
        )
