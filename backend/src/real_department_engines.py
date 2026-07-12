"""src/real_department_engines.py — 真实部门引擎共享注册表(2026-07-03 会审)。

背景:蜂群体系有三层——① chaotang_orchestrator 动态会审(纯 LLM 角色扮演大臣人设)
② swarm_execution_loop 部门规则模板/通用LLM立场 ③ 真实部门引擎(bingbu_battlecard/
gongbu_review_verdict/hubu_cashflow/yushi_verdict/jinyiwei_agent)。①②从未调用过③。

本模块不是"新建能力"，是把已经建好的③做成一份共享注册表，让①②都能取用，
避免同一段"调真实引擎"逻辑在两条链路里各写一遍。

当前注册兵部/锦衣卫/刑部/户部(经quotation)四个部门——共同点是引擎入口都是纯自由文本，
跟 confirmed_edict 天然匹配。工部(gongbu_review_verdict 需要 presale_output+task_input
两个输入)、户部另一条 hubu_cashflow(需要 FinanceEvidencePack 结构化输入)、御史(审计payload)
仍未接——硬接等于逼系统编数据凑接口，直接违反 dept_constitution.md C6(禁假PASS)。
礼部(lipu)/吏部(libu_personnel)/钦天监(tianjian)2026-07-06 已立项建引擎并接入:
- 礼部 adapt_lipu / src/lipu_vet.py:成稿硬声明素材回链复核(反幻觉,确定性)。
- 吏部 adapt_libu_personnel:双身份分派器。①任免/权限→libu_appointment_vet(责任图红线
  无owner/高权限越权 + agent分席复用persona_registry/promotion_gate,纯确定性)②招聘→
  libu_vet(决策锚定复用recruit_check + 资质红线接config真清单 + hire_outcome飞轮)。
- 钦天监 adapt_tianjian:tianjian_verdict 情景推演+Polymarket真实市场,仅走 L3 会审。
工部(需presale+task双输入)/户部cashflow(需结构化包)/御史(需payload)仍未接:硬接=逼造
数据违 dept_constitution C6,留作需要时单独立项。

任何引擎调用失败/无有效产出 → 返回 None，调用方一律退回现有兜底逻辑，绝不崩、绝不假 PASS。
"""

from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path
from typing import Callable

# 灯 → 部门立场(与 swarm_execution_loop 现有 position 词表对齐)
_LIGHT_POSITION = {"green": "准奏", "yellow": "补证", "red": "复核", "black": "驳回"}

# 真实引擎调用可见度日志(纯观测,不影响主流程)。2026-07-04 提出:兵部/刑部/户部/
# 锦衣卫的真实调用现在接入常任/易触发关键词,每次confirm-edict都可能真的打网络/
# 调LLM,但没人有数据知道到底多频繁、多贵——先把频率/耗时记下来,再决定要不要收窄。
_ENGINE_CALL_LOG = (
    Path(__file__).resolve().parent.parent / "eval" / "real_engine_calls.jsonl"
)


def _log_engine_call(dept_name: str, *, elapsed_ms: float, outcome: str) -> None:
    """outcome: hit(真产出)/empty(引擎跑了但无有效产出)/error(异常)。写失败静默跳过,
    绝不因为记日志这件事影响真实判定流程。"""
    try:
        _ENGINE_CALL_LOG.parent.mkdir(parents=True, exist_ok=True)
        with open(_ENGINE_CALL_LOG, "a", encoding="utf-8") as f:
            f.write(
                json.dumps(
                    {
                        "ts": time.time(),
                        "dept": dept_name,
                        "elapsed_ms": round(elapsed_ms, 1),
                        "outcome": outcome,
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )
    except Exception:
        pass


def _call_adapter_observed(
    dept_name: str, adapter: Callable[[str], dict | None], task_text: str
) -> dict | None:
    """统一的"调真实引擎 + 记可见度"入口,L3(minister)/L4(swarm)两条消费路径都走这里,
    不用在两处各自重复计时逻辑。

    ② 真引擎缓存(2026-07-06):相同(部门+任务)命中直接返回,不重烧最贵的外呼
    (兵部 flow / 户部报价 flow 等)。锦衣卫是实时情报/异动雷达,不缓存(避免返回过期
    情报)。SWARM_ENGINE_CACHE=0 可关。缓存任何异常一律静默降级,绝不阻断真调用。"""
    cache_on = (
        os.environ.get("SWARM_ENGINE_CACHE", "1") == "1"
        and dept_name != "锦衣卫"
        # pytest 下关缓存:测试常注入不同 adapter 行为(如"引擎失败")验证兜底,
        # 缓存按(部门+任务)命中会短路 adapter、破坏失败注入与测试隔离。
        and "PYTEST_CURRENT_TEST" not in os.environ
    )
    cache_key = f"dept_engine::{dept_name}::{task_text}"
    if cache_on:
        try:
            from src.direct_cache import DirectCache

            hit = DirectCache().get(cache_key)
            if hit is not None:
                _log_engine_call(dept_name, elapsed_ms=0.0, outcome="cache_hit")
                return hit
        except Exception:
            pass

    started = time.time()
    try:
        doc = adapter(task_text)
    except Exception:
        _log_engine_call(
            dept_name, elapsed_ms=(time.time() - started) * 1000, outcome="error"
        )
        return None
    outcome = "hit" if doc else "empty"
    _log_engine_call(
        dept_name, elapsed_ms=(time.time() - started) * 1000, outcome=outcome
    )
    if cache_on and doc:
        try:
            from src.direct_cache import DirectCache

            DirectCache().set(cache_key, doc, mode="dept_engine")
        except Exception:
            pass
    return doc


def _court_doc_to_ministry_contract(
    doc: dict, *, swarm_id: str, swarm_role: str
) -> dict:
    """把 court_doc(light/headline/items/provenance)映射成 ministry_outputs_from_swarm
    (src/shangshufang_loop.py)已经在消费的契约字段，下游不用改一行代码。"""
    light = doc.get("light", "yellow")
    items = doc.get("items") or []
    provenance = doc.get("provenance") or {}
    grounded = bool(
        provenance.get("deterministic_gated") or provenance.get("rag_grounded")
    )
    confidence = (
        "高" if grounded else ("中" if provenance.get("gate") == "passed" else "低")
    )

    key_findings = [str(i.get("title", "")) for i in items if i.get("title")][:6]
    missing_evidence = [str(i.get("fix")) for i in items if i.get("fix")]
    if not items:
        # 真实引擎诚实报告"无数据"(如锦衣卫没检索到情报),不是"没有意见"——
        # 必须落进 missing_evidence,否则 evidence_audit 会把它误判成"无凭无据的断言"。
        missing_evidence = [
            str(doc.get("shielded") or doc.get("headline") or "无可核证据")
        ]

    risks = [
        {
            "risk": str(i.get("title", "")),
            "severity": "高" if i.get("level") in ("red", "black") else "中",
            "reason": str(i.get("fix") or doc.get("headline", "")),
            "requires_human_confirmation": i.get("level") == "black",
        }
        for i in items
        if i.get("level") in ("red", "yellow", "black")
    ][:5]

    evidence_used = [
        {
            "title": str(i.get("title", ""))[:80],
            "source_type": "COURT_DOC",
            "claim_supported": str(i.get("title", "")),
            "quote_or_location": str(i.get("evidence_ref") or ""),
            "confidence": confidence,
        }
        for i in items
    ]

    # 自动化档位(灯×可逆性):绿自动放行/黄自动留痕/可逆红一键放行/不可逆红必须人签。
    # 让系统"该自动的全自动,不可逆处才留人",不违"决策权在客户"。
    from src.automation_tier import tier_for_doc

    auto = tier_for_doc(doc)

    return {
        "swarm_id": swarm_id,
        "swarm_role": swarm_role,
        "evidence_used": evidence_used,
        "source_label": "LIVE_ENGINE",
        "position": _LIGHT_POSITION.get(light, "补证"),
        "summary": str(doc.get("headline", "")),
        "key_findings": key_findings or [str(doc.get("headline", ""))],
        "missing_evidence": missing_evidence,
        "risks": risks,
        "recommended_next_action": str(doc.get("shielded") or doc.get("headline", "")),
        "confidence": confidence,
        "auto_action": auto["tier"],
        "auto_action_label": auto["label"],
        "requires_human": auto["human_needed"],
        "auto_action_reason": auto["reason"],
    }


def adapt_bingbu(task_text: str) -> dict | None:
    """真实兵部引擎(flow_haolong → court_doc)。异常/无产出 → None,调用方兜底规则。"""
    try:
        from src.bingbu_battlecard import run_bingbu_battlecard

        doc = run_bingbu_battlecard(task_text, archive=False)
    except Exception:
        return None
    if not isinstance(doc, dict) or not doc.get("items"):
        return None
    return doc


_KEYWORD_SPLIT_RE = re.compile(r"[，,。.？?！!、；;：:\s]+")

# 候选池上限——不做游标分页，量级真的成为问题(单租户"入库"级情报堆到
# 数千条以上)再引入更精细的检索策略。
_KNOWN_EVIDENCE_POOL_LIMIT = 200

# 2026-07-12 Codex 停止前三次审查纠正："reverse substring match can merge
# unrelated historical evidence"——候选短语/历史 query 如果只有 1-2 个字，
# 大概率是噪音(单字/双字组合的巧合命中概率太高)，这里只挡掉这种极短情况，
# 不再用来区分"通用词"和"具体实体"——那件事交给下面的停用词表，见
# 2026-07-12 四次审查纠正的说明。
_MIN_MATCH_LEN = 2

# 2026-07-12 Codex 停止前四次审查纠正："min-length fix overcorrects and
# drops valid short entities"——三次审查后把最短长度提到4个字符，确实挡住
# 了"核实"/"情况"这类2字通用词的误命中，但也连带挡掉了"华为"/"厦门"这类
# 同样2-3字、但语义具体的真实体名——中文专有名词很多本来就短，长度本身
# 分不出"通用词"和"具体实体"。改成停用词表:只挡掉这个领域(供应商/合同/
# 投资/尽调类任务)里明确是通用连接词/套话/动词/名词的高频词，不看长度
# 本身。
#
# 2026-07-12 Codex 停止前五次审查纠正："short stopword gate reopens
# unrelated evidence merges"——第一版停用词表只收了连接词/套话/动词
# (核实/确认/是否等)，把最短长度降回2之后，"合同"/"证据"/"报告"/"客户"/
# "公司"这类同样通用、同样2-3字、但词性是名词而不是动词的高频业务词，
# 完全没被挡住——这类通用名词在供应商/合同/投资/尽调类任务描述里几乎
# 无处不在，跟当初"核实"这类通用动词造成的误合并是同一类风险，只是换了
# 一个词性。这里把通用业务名词也补进停用词表。不是穷举，语料量大了
# 发现漏网的通用词(不管是动词还是名词)再补。
_GENERIC_STOPWORDS = frozenset({
    # 通用连接词/套话/代词/动词
    "核实", "确认", "审查", "评估", "追加", "情况", "是否", "关于", "针对",
    "需要", "相关", "问题", "核查", "说明", "内容", "方案", "进行", "这份",
    "这个", "那个", "一下", "请问", "麻烦", "如何", "为什么", "什么", "哪些",
    "哪个", "怎么", "怎样", "是不是", "有没有", "我们", "你们", "他们",
    # 通用业务名词——不指向"是谁/是什么"，只是这个领域几乎任何任务描述
    # 都可能出现的容器词
    "合同", "客户", "公司", "项目", "数据", "信息", "文件", "结果", "意见",
    "证据", "资料", "报告", "风险", "产品", "服务", "业务", "市场", "交易",
    "协议", "条款", "标的", "金额", "费用", "价格", "时间", "人员", "部门",
    "材料", "供应商", "合作方",
})


def _candidate_keywords(task_text: str, *, max_candidates: int = 5) -> list[str]:
    """从一整段任务描述里粗略切出几个候选关键词短语。

    2026-07-12 Codex 停止前审查发现：把整段(甚至截断到120字的)任务描述
    当成一个整体子串去 LIKE 匹配，要求历史 claim/query 逐字包含这一大段
    文本才算命中——两次任务描述只要措辞稍有不同(现实中几乎总是如此)就
    永远不会命中，等同于让"读历史复用"这个功能形同虚设。这里按常见中文
    标点/空白切分成短语，取长度>=_MIN_MATCH_LEN 且不在通用停用词表里的
    前几个作为候选，命中任意一个就算相关——中文没有天然空格分词，jieba
    之类的真分词是更大的依赖，这里先用标点切分这种"朴素"办法，语料量/
    匹配质量真的成为问题再升级。

    注意：这只是候选短语的其中一个来源。没有标点分隔的追加式后续问法
    (例如"某供应商资质尽调追加核实"，中间没有逗号)切不出比整句更短的
    候选——这种情况交给 `_merge_known_evidence` 里的反向包含检查处理，
    不是这个函数单独就能覆盖的，见该函数的说明。"""
    parts = [
        p
        for p in _KEYWORD_SPLIT_RE.split(task_text)
        if len(p) >= _MIN_MATCH_LEN and p not in _GENERIC_STOPWORDS
    ]
    return parts[:max_candidates]


def _merge_known_evidence(task_text: str, fresh_findings: list) -> list:
    """把共享情报池里已经核实过的"入库"级历史情报，合并进本次检索结果——
    下一个任务问到同一个主题时不用重新打一次真实检索。合并进来的历史情报
    仍然会被 gather_intel 内部的 _finding_to_item 重新过一遍确定性 vet 门
    (它对所有 findings 一视同仁，不因为来源是"历史缓存"就跳过分级或放水)。
    查历史本身失败不影响真实检索结果，直接退回原始 findings。

    2026-07-12 Codex 停止前二次审查纠正："keyword split still misses common
    unpunctuated follow-ups"——第一版只按标点切候选词，遇到"某供应商资质
    尽调追加核实"这种中间没有逗号/句号的追加式后续问法，`_candidate_keywords`
    的正则切不出比整句更短的片段(`re.split` 找不到分隔符时原样返回整段
    文本)，退化回"整段当一个候选"的老问题，第一轮修复实际上只覆盖了
    "恰好带标点"这一种情况。这里改成:不在 SQL 层做关键词过滤，而是先拉
    该租户近期"入库"级情报的候选池，再在 Python 侧做双向子串检查——
    ①候选短语出现在历史 claim/query 里(标点切分帮得上的情况)，②反过来，
    历史 query 整个作为子串出现在这次的任务描述里(不管有没有标点，"旧问题
    +追加内容"这种最常见的后续问法天然满足这条)。两个方向都不依赖标点，
    也不依赖猜中一个刚好对齐的滑动窗口大小。

    2026-07-12 Codex 停止前三次审查纠正："reverse substring match can merge
    unrelated historical evidence"——反向检查(历史 query 整个是新任务描述
    的子串)如果不设门槛，一条很短、很通用的历史 query(比如两三个字的
    "核实"/"情况")几乎必然是任何任务描述的子串，会把完全不相关主题的历史
    情报也合并进来。

    2026-07-12 Codex 停止前四次审查纠正："min-length fix overcorrects and
    drops valid short entities"——三次审查后直接把最短长度提到4个字符，
    确实挡住了"核实"/"情况"这类通用词，但也连带挡掉了"华为"/"厦门"这类
    同样短、但语义具体的真实体名——长度本身分不出"通用词"和"具体实体"。
    改成:`row["query"]` 只要不在 `_GENERIC_STOPWORDS` 通用停用词表里，
    达到最基本的 `_MIN_MATCH_LEN`(挡掉单字这种噪音)就纳入反向检查，
    不再用一刀切的长度门槛牺牲短实体名的召回。"""
    try:
        from src.db.engine import SessionLocal
        from src.jinyiwei_evidence_store import query_evidence
        from src.tenant import resolve_current_tenant_id

        tenant_id = resolve_current_tenant_id()
        db = SessionLocal()
        try:
            pool = query_evidence(
                db,
                tenant_id=tenant_id,
                include_pending=False,
                limit=_KNOWN_EVIDENCE_POOL_LIMIT,
            )
        finally:
            db.close()
    except Exception:  # noqa: BLE001 - 查历史失败不影响真实检索
        return fresh_findings
    if not pool:
        return fresh_findings

    candidates = _candidate_keywords(task_text)
    known = [
        row
        for row in pool
        if any(kw in row["claim"] or kw in row["query"] for kw in candidates)
        or (
            row["query"]
            and len(row["query"]) >= _MIN_MATCH_LEN
            and row["query"] not in _GENERIC_STOPWORDS
            and row["query"] in task_text
        )
    ]
    if not known:
        return fresh_findings
    reused = [{"claim": row["claim"], "sources": row["sources"]} for row in known]
    return reused + fresh_findings


def _persist_department_evidence(*, query: str, findings: list, doc: dict) -> None:
    """镜像 web/routers/jinyiwei.py::_persist_brief_items 的写回逻辑——六部
    派单读到的锦衣卫结论也要写回共享池，不是只有 /api/intel/brief 这一个
    入口在维护它。最佳努力：入库失败不影响六部派单本身的返回。"""
    items = doc.get("items") if isinstance(doc, dict) else None
    if not items:
        return
    try:
        from src.db.engine import SessionLocal
        from src.jinyiwei_evidence_store import upsert_evidence
        from src.tenant import resolve_current_tenant_id

        tenant_id = resolve_current_tenant_id()
        db = SessionLocal()
        try:
            for finding, item in zip(findings, items):
                claim = (
                    str(finding.get("claim", ""))
                    if isinstance(finding, dict)
                    else ""
                )
                if not claim:
                    continue
                upsert_evidence(
                    db,
                    tenant_id=tenant_id,
                    query=query,
                    claim=claim,
                    sources=item.get("sources"),
                    item=item,
                    source_label=str(doc.get("source_label") or "LIVE_ENGINE"),
                )
            db.commit()
        finally:
            db.close()
    except Exception:  # noqa: BLE001 - 入库失败不影响六部派单本身
        pass


def adapt_jinyiwei(task_text: str) -> dict | None:
    """真实锦衣卫引擎(Tavily真实检索 → jinyiwei_vet 确定性可信度分级 → court_doc)。

    2026-07-04 接入 src.jinyiwei_search.tavily_search 作真实检索源(此前
    search_fn=None,只能诚实返回"未获取到可核情报")。TAVILY_API_KEY 缺失/请求
    失败/查无结果时 tavily_search 本身会返回 []，gather_intel 仍然诚实退回空态
    court_doc,不编造——这本身是有效输出,不在此处判 None。

    2026-07-12(锦衣卫共享证据服务阶段2)：读写穿透持久情报池——真实检索前先
    查已核实过的历史情报合并进来，真实检索/分级完成后把新条目写回池子。用
    闭包捕获 search_fn 实际返回的 findings(而不是自己提前调用 tavily_search)，
    是为了保持跟改动前完全一致的惰性:只有 gather_intel 真的调用 search_fn
    时才会触发检索/查历史，被 mock 掉 gather_intel 的既有测试不会因此意外
    触发真实网络请求(TAVILY_API_KEY 在测试环境里通过 web.main 的 .env 加载
    是真实有效值,提前调用 tavily_search 会导致既有测试打真实网络请求)。
    """
    captured_findings: list = []

    def _search_and_capture(query: str) -> list:
        from src.jinyiwei_search import tavily_search

        try:
            fresh = tavily_search(query) or []
        except Exception:  # noqa: BLE001 - 诚实空态,不编造
            fresh = []
        merged = _merge_known_evidence(query, fresh)
        captured_findings[:] = merged
        return merged

    try:
        from src.jinyiwei_agent import gather_intel

        doc = gather_intel(task_text, search_fn=_search_and_capture, archive=False)
    except Exception:
        return None
    if isinstance(doc, dict):
        _persist_department_evidence(
            query=task_text, findings=captured_findings, doc=doc
        )
    return doc if isinstance(doc, dict) else None


def adapt_xingbu(task_text: str) -> dict | None:
    """刑部真实引擎调度(2026-07-07 补合同红线确定性门为第二司):
    ①合同红线门(xingbu_contract_vet,确定性,回链红线清单)——命中合同信号且抽到可核红线项时优先;
    ②LLM findings(xingbu_verdict)——纯自由文本兜底。都无有效产出→None。"""
    try:
        from src.xingbu_contract_vet import (
            _looks_like_contract,
            build_contract_verdict,
            vet_contract,
        )

        if _looks_like_contract(task_text):
            items = vet_contract(task_text)
            meaningful = [
                it
                for it in items
                if "未从合同抽到" not in it["title"] and "清单缺失" not in it["title"]
            ]
            if meaningful:
                return build_contract_verdict(task_text, archive=False)
    except Exception:
        pass

    try:
        from src.xingbu_verdict import run_verdict_from_text

        doc = run_verdict_from_text(task_text, archive=False)
    except Exception:
        return None
    if not isinstance(doc, dict) or not doc.get("items"):
        return None
    return doc


# 跟兵部/刑部/锦衣卫不同:quotation的QA硬核查(C1-C10)是为报价单量身定制的死板流程,
# 喂一个不相关的council任务("要不要招人")进去,C6/C7等会因为抽不到真实BOM/毛利数据而
# 误判FAIL(不是NA),产出一个假的"户部:驳回"红灯——LLM"抽不到点"和"数据不达标"两种情况
# 在这个流程里无法区分,不像刑部的findings=[]那样能安全空转。所以在调用真实引擎前先做
# 关键词范围检查,不相关任务直接 None,退回现有规则模板,复用 decree_swarm_router.py 的
# quotation 意图关键词,不重新发明一套。
_QUOTATION_KEYWORDS = ("报价", "报价单", "quote", "价格", "几钱", "多少钱", "成本核算")


def adapt_hubu_quotation(task_text: str) -> dict | None:
    """真实户部引擎(quotation_verdict:真实flow_quotation→QA硬核查→court_doc)。

    2026-07-04 新建,纯自由文本入口(报价需求描述)。真实LLM调用,非确定性、无缓存,
    比 hubu_cashflow(需要 FinanceEvidencePack 结构化输入)更适合接自由文本会审链路——
    但只在任务确实是报价相关时才调用,见上方关键词guard的说明。
    """
    if not any(kw in task_text for kw in _QUOTATION_KEYWORDS):
        return None
    try:
        from src.quotation_verdict import run_quotation_verdict

        doc = run_quotation_verdict(task_text, archive=False)
    except Exception:
        return None
    if not isinstance(doc, dict) or not doc.get("items"):
        return None
    return doc


def _extract_finance_pack(task_text: str) -> dict | None:
    """从下旨文本抽结构化现金流事实包(JSON):优先 ```json 围栏,其次首个含 cash/bank/monthly_flows
    的 {..}。抽不到/解析失败/无财务字段 → None(诚实,绝不凭空构造事实包)。"""
    candidates: list[str] = []
    lo = task_text.find("```json")
    if lo != -1:
        hi = task_text.find("```", lo + 7)
        if hi != -1:
            candidates.append(task_text[lo + 7 : hi].strip())
    b, e = task_text.find("{"), task_text.rfind("}")
    if b != -1 and e > b:
        candidates.append(task_text[b : e + 1])
    for c in candidates:
        try:
            obj = json.loads(c)
        except Exception:
            continue
        if isinstance(obj, dict) and any(
            k in obj for k in ("cash", "bank", "monthly_flows")
        ):
            return obj
    return None


# 现金流类下旨关键词(判断要不要去读公司真实现金流数据存储)
_CASHFLOW_KEYWORDS = (
    "现金流",
    "现金跑道",
    "跑道",
    "资金缺口",
    "回款",
    "偿债",
    "资金链",
)


def _load_canonical_cashflow_pack() -> dict | None:
    """读公司真实现金流事实包(FinanceEvidencePack 形状 JSON)。路径 env HUBU_CASHFLOW_PACK 覆盖,
    默认 data/hubu/cashflow_pack.json(灌真数据/金蝶导入产出后才存在,属真实数据不进功能提交)。
    不存在/解析失败/无财务字段 → None(诚实退回,绝不凭空构造)。"""
    path = os.environ.get("HUBU_CASHFLOW_PACK")
    if not path:
        if "PYTEST_CURRENT_TEST" in os.environ:
            return None  # 测试隔离:pytest 下不自动读默认存储,除非显式 env 指定
        path = "data/hubu/cashflow_pack.json"
    try:
        fp = Path(path)
        if not fp.is_absolute():
            fp = Path(__file__).resolve().parent.parent / path
        if not fp.exists():
            return None
        obj = json.loads(fp.read_text(encoding="utf-8"))
    except Exception:
        return None
    if isinstance(obj, dict) and any(
        k in obj for k in ("cash", "bank", "monthly_flows")
    ):
        return obj
    return None


def adapt_hubu_cashflow(task_text: str) -> dict | None:
    """真实户部现金跑道引擎(确定性:FinanceEvidencePack → 现金流计算 → court_doc)。

    仅当下旨携带结构化现金流事实包(JSON)时触发——这套确定性门需要真实结构化财务数据,
    free-text 下旨没有就返 None 诚实退回(绝不凭空构造事实包硬跑,违反 dept_constitution C6 禁假PASS)。
    真数据(金蝶导出→verified_facts)灌进下旨后覆盖面自然扩大。复用已建好的
    hubu_memorial_verdict.preview_cashflow_court_doc(pack_from_body→run_cashflow_court_doc)。
    """
    body = _extract_finance_pack(task_text)
    if not body and any(kw in task_text for kw in _CASHFLOW_KEYWORDS):
        # free-text 现金流类下旨:公司已导入真实现金流数据时用它跑确定性门,否则仍 None 退回
        body = _load_canonical_cashflow_pack()
    if not body:
        return None
    try:
        from src.hubu_memorial_verdict import preview_cashflow_court_doc

        doc = preview_cashflow_court_doc(body)
    except Exception:
        return None  # 字段缺失/类型错 → 诚实退回,不静默编数
    if not isinstance(doc, dict) or not doc.get("items"):
        return None
    return doc


# 付款审批类下旨关键词
_PAYMENT_KEYWORDS = ("付款", "审批", "拨款", "打款", "支付", "用款", "尾款", "付账")
_OFFICE_CN = {"accounting": "会计司", "treasury": "出纳司", "budget": "预算司"}


def _extract_payment_case(task_text: str) -> dict | None:
    """抽结构化付款 case(需含 paymentRequest + accounting + treasury + budget 4 段):
    优先内嵌 JSON,其次公司存储(env HUBU_PAYMENT_CASE / 默认 data/hubu/payment_case.json,gitignored)。
    抽不到/缺段 → None(诚实退回,绝不凭空构造 case)。"""
    need = ("paymentRequest", "accounting", "treasury", "budget")

    def _ok(o):
        return isinstance(o, dict) and all(k in o for k in need)

    b, e = task_text.find("{"), task_text.rfind("}")
    if b != -1 and e > b:
        try:
            o = json.loads(task_text[b : e + 1])
            if _ok(o):
                return o
        except Exception:
            pass
    path = os.environ.get("HUBU_PAYMENT_CASE")
    if not path:
        if "PYTEST_CURRENT_TEST" in os.environ:
            return None  # 测试隔离:pytest 下不自动读默认存储,除非显式 env 指定
        path = "data/hubu/payment_case.json"
    try:
        fp = Path(path)
        if not fp.is_absolute():
            fp = Path(__file__).resolve().parent.parent / path
        if fp.exists():
            o = json.loads(fp.read_text(encoding="utf-8"))
            if _ok(o):
                return o
    except Exception:
        pass
    return None


def _payment_preview_to_court_doc(preview: dict) -> dict:
    """户部付款预览(build_hubu_payment_preview)→ 全院 court_doc(light/headline/items/provenance)。
    灯由裁决建议+风险闸决定;items 由三司门的每条 check 映射,red 项(未过硬闸)自然置顶下游用。"""
    decision = preview.get("decision") or {}
    rec = str(decision.get("recommendation", "")).lower()
    risk_gates = decision.get("riskGates") or []
    light = (
        "green"
        if rec == "approve" and not risk_gates
        else ("red" if rec in ("reject", "block") or risk_gates else "yellow")
    )
    items: list[dict] = []
    for office, gate in (preview.get("gates") or {}).items():
        for chk in (gate or {}).get("checks", []) or []:
            passed = bool(chk.get("passed"))
            sev = str(chk.get("severity", "warn"))
            level = "green" if passed else ("red" if sev == "critical" else "yellow")
            gaps = chk.get("gaps") or []
            items.append(
                {
                    "level": level,
                    "title": f"{_OFFICE_CN.get(office, office)}·{chk.get('name', '')}",
                    "fix": str(chk.get("detail", ""))
                    + (f" 缺:{'、'.join(map(str, gaps))}" if gaps else ""),
                }
            )
    mem = preview.get("memorial") or {}
    return {
        "doc_type": "archive",
        "dept": "hubu",
        "light": light,
        "headline": str(mem.get("summary") or mem.get("title") or "户部付款裁决"),
        "shielded": "、".join(str(a) for a in (decision.get("nextActions") or [])[:2]),
        "items": items,
        "provenance": {
            "deterministic_gated": True,
            "gate": "passed" if light == "green" else "pending",
        },
        "source_label": "LIVE_ENGINE",
        "metrics": mem.get("metrics") or {},
    }


def adapt_hubu_payment(task_text: str) -> dict | None:
    """真实户部付款裁决引擎(确定性:会计→出纳→预算三门 → 户部奏折 court_doc)。

    B(2026-07-06):把已建好、只挂在 payment API 的 3司确定性链接进上书房下旨会审链。
    仅付款审批类下旨 + 携带结构化 payment case(内嵌 JSON 或公司存储)时触发;
    无 case → None 诚实退回(绝不凭空构造 case 硬跑,守 C6 禁假PASS)。
    复用 hubu_payment_preview.build_hubu_payment_preview(只读、不真付款、不写库)。"""
    if not any(kw in task_text for kw in _PAYMENT_KEYWORDS):
        return None
    case = _extract_payment_case(task_text)
    if not case:
        return None
    try:
        from src.hubu_payment_preview import build_hubu_payment_preview

        preview = build_hubu_payment_preview(case)
        doc = _payment_preview_to_court_doc(preview)
    except Exception:
        return None
    return doc if isinstance(doc, dict) and doc.get("items") else None


def adapt_hubu(task_text: str) -> dict | None:
    """户部真实引擎调度:报价→quotation;付款审批+case→3司确定性链;现金流+数据→现金跑道门;
    都不命中→None(退回规则模板/flow_finance)。按优先级串联,任一命中即返回。"""
    return (
        adapt_hubu_quotation(task_text)
        or adapt_hubu_payment(task_text)
        or adapt_hubu_cashflow(task_text)
    )


# 礼部只在任务确实是"对外出稿/发布"时才调真实引擎——跟 quotation 同理,避免把无关会审
# 任务(如"要不要招人")喂进 flow_lipu 空转产假灯。复用礼部的内容类意图词,不新发明一套。
_LIPU_KEYWORDS = (
    "推文",
    "文案",
    "公众号",
    "新闻稿",
    "对外",
    "发布",
    "稿件",
    "撰稿",
    "宣传",
    "品牌",
    "素材",
    "小红书",
    "官网",
    "对客户",
)


# 品牌战略路关键词:命中则跑 flow_brand_strategy(而非 flow_lipu),但复用同一把 lipu_vet
# 反幻觉门(2026-07-06 会审:品牌战略是礼部子蜂群,同源反幻觉,复用不重造引擎)。
_BRAND_STRATEGY_KEYWORDS = (
    "品牌战略",
    "品牌定位",
    "企业文化",
    "视觉识别",
    "品牌资产",
    "slogan",
    "VI",
    "品牌手册",
    "定调子",
)


def adapt_lipu(task_text: str) -> dict | None:
    """礼部真实引擎调度:品牌战略→flow_brand_strategy;对外出稿→flow_lipu。二者共用 lipu_vet
    反幻觉门(硬声明素材回链,确定性)。都不命中→None 退回人设 prompt。

    2026-07-06 补品牌战略子蜂群接入:不造新引擎,复用礼部已建的素材回链门。"""
    try:
        from src.lipu_vet import run_brand_strategy_vet, run_lipu_vet

        if any(kw in task_text for kw in _BRAND_STRATEGY_KEYWORDS):
            doc = run_brand_strategy_vet(task_text, archive=False)
        elif any(kw in task_text for kw in _LIPU_KEYWORDS):
            doc = run_lipu_vet(task_text, archive=False)
        else:
            return None
    except Exception:
        return None
    if not isinstance(doc, dict) or not doc.get("items"):
        return None
    return doc


_LIBU_KEYWORDS = (
    "招聘",
    "面试",
    "简历",
    "岗位",
    "胜任力",
    "选人",
    "用人",
    "招人",
    "人才",
    "录用",
    "候选人",
)


# 吏部任免/权限路关键词(走 libu_appointment_vet 确定性责任图/分席,不跑 LLM flow)。
_LIBU_APPOINT_KEYWORDS = (
    "任免",
    "任命",
    "权限",
    "授权",
    "负责",
    "owner",
    "责任",
    "追责",
    "判官",
    "观点席",
    "升席",
    "分席",
    "谁负责",
)


def adapt_libu_appointment(task_text: str) -> dict | None:
    """真实吏部任免引擎(libu_appointment_vet:责任图红线 + agent分席,纯确定性,不跑 flow)。

    2026-07-06 会审落地(吏部双身份的"任免"那半)。责任图查无owner/高权限越权/自审/无替补;
    命中大神名+席位词则走 persona_registry 分席 + persona_eval.promotion_gate 硬棘轮。"""
    if not any(kw in task_text for kw in _LIBU_APPOINT_KEYWORDS):
        return None
    try:
        from src.libu_appointment_vet import run_libu_appointment

        doc = run_libu_appointment(task_text, archive=False)
    except Exception:
        return None
    if not isinstance(doc, dict) or not doc.get("items"):
        return None
    return doc


def adapt_libu_recruit(task_text: str) -> dict | None:
    """真实吏部招聘引擎(libu_vet:真实flow_libu招聘方案→决策锚定+资质红线+飞轮→court_doc)。

    跟礼部同款带关键词 guard(招聘类才调,避免无关会审喂进 flow_libu 空转)。"""
    if not any(kw in task_text for kw in _LIBU_KEYWORDS):
        return None
    try:
        from src.libu_vet import run_libu_verdict

        doc = run_libu_verdict(task_text, archive=False)
    except Exception:
        return None
    if not isinstance(doc, dict) or not doc.get("items"):
        return None
    return doc


def adapt_libu_personnel(task_text: str) -> dict | None:
    """吏部真实引擎调度(双身份):任免/权限→责任图分席(确定性,优先);招聘→招聘复核。
    都不命中→None 退回人设 prompt。任免优先,因它纯确定性、无需 LLM flow。"""
    return adapt_libu_appointment(task_text) or adapt_libu_recruit(task_text)


def adapt_tianjian(task_text: str) -> dict | None:
    """真实钦天监引擎(tianjian_verdict:真实flow_tianjian情景推演+Polymarket真实市场→court_doc)。

    2026-07-06 接入。纯自由文本入口,跟兵部/刑部同款——不加关键词 guard:钦天监只在会审
    已选中该大臣(L3 minister code qin_tian_jian)时才触发,且引擎对依据未核会诚实判待核
    (非产假红灯),空产出→None 安全退回人设 prompt。真实LLM调用,非确定性。"""
    try:
        from src.tianjian_verdict import run_tianjian_forecast

        doc = run_tianjian_forecast(task_text, archive=False)
    except Exception:
        return None
    if not isinstance(doc, dict) or not doc.get("items"):
        return None
    return doc


# 部门中文名 → 原始 adapter(返回 court_doc 原始 dict 或 None)。
# L3(丞相动态会审)直接消费这份，只需要 light/headline/items 拼文本。
REAL_ENGINE_ADAPTERS: dict[str, Callable[[str], dict | None]] = {
    "兵部": adapt_bingbu,
    "锦衣卫": adapt_jinyiwei,
    "刑部": adapt_xingbu,
    "户部": adapt_hubu,
    "礼部": adapt_lipu,
    "钦天监": adapt_tianjian,
    "吏部": adapt_libu_personnel,
}

# swarm_id(L4 上书房链路用) → 部门中文名。key 必须是 SWARM_DEFS(swarm_execution_loop)
# 的真实 sid,否则永不触发。2026-07-06 修:礼部上轮误登记为 "lipu"(注册表flow id,非L4 sid)
# 是死键,正确 sid 是 "libu_communication_swarm"。钦天监不在 SWARM_DEFS(它是参谋蜂群、
# 非六部上书房链路),只走下方 L3 minister 路,故不在此登记。
_SWARM_ID_DEPT: dict[str, str] = {
    "bingbu_strategy_swarm": "兵部",
    "jinyiwei_intel_swarm": "锦衣卫",
    "xingbu_legal_risk_swarm": "刑部",
    "hubu_finance_swarm": "户部",
    "libu_communication_swarm": "礼部",
    "libu_org_execution_swarm": "吏部",
}

# minister persona code(L3 丞相会审用,见 src/minister_personas.py) → 部门中文名。
# 礼部=li_bu_rites(li_bu 是吏部)、钦天监=qin_tian_jian。engine-backed 部门应同时登记
# L3(此表)+L4(_SWARM_ID_DEPT),两路都能取到真实引擎;钦天监无 L4 dept swarm,仅此一路。
_MINISTER_CODE_DEPT: dict[str, str] = {
    "bing_bu": "兵部",
    "jin_yi_wei": "锦衣卫",
    "xing_bu": "刑部",
    "hu_bu": "户部",
    "li_bu_rites": "礼部",
    "qin_tian_jian": "钦天监",
    "li_bu": "吏部",
}


def get_real_engine_fn_for_swarm(
    swarm_id: str, *, swarm_role: str
) -> Callable[[str], dict | None] | None:
    """给 swarm_execution_loop.run_department_swarm 用:返回一个 (task_text)->契约dict|None 的函数。

    未注册的 swarm_id 返回 None,调用方保持现状(走 live/rule 兜底),不受本次改动影响。
    """
    dept_name = _SWARM_ID_DEPT.get(swarm_id)
    adapter = REAL_ENGINE_ADAPTERS.get(dept_name) if dept_name else None
    if adapter is None:
        return None

    def _fn(task_text: str) -> dict | None:
        doc = _call_adapter_observed(dept_name, adapter, task_text)
        if doc is None:
            return None
        return _court_doc_to_ministry_contract(
            doc, swarm_id=swarm_id, swarm_role=swarm_role
        )

    return _fn


def get_raw_engine_fn_for_minister(code: str) -> Callable[[str], dict | None] | None:
    """给 chaotang_orchestrator.assemble_flow 用:返回原始 adapter(court_doc dict|None)。

    未注册的 minister code 返回 None,调用方维持现状纯人设 prompt。
    """
    dept_name = _MINISTER_CODE_DEPT.get(code)
    adapter = REAL_ENGINE_ADAPTERS.get(dept_name) if dept_name else None
    if adapter is None:
        return None
    return lambda task_text: _call_adapter_observed(dept_name, adapter, task_text)
