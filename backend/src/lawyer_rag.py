"""src/lawyer_rag.py — 律师法条库轻量检索(rag_hit 只能由系统算出,堵自报洞)。

不引 chroma/embedding(记忆教训:向量库脆弱)。改用**真检索真法条文本**:把查询里的法律术语
与 skills/personas/*-lawyer/references/statutes.md 的真实条文做重叠匹配,命中真法条 = 接地。

用途:刑部判决前算 rag_hit —— 命中律师法条库才允许观点席律师下权威结论(gate_conclusion),
没命中 → 降级"需人工"。**rag_hit 由本模块算,绝不接受调用方自报**(schneier 铁律)。
可后续平滑升级为向量 RAG,不改调用方契约。
"""
from __future__ import annotations

import re
from pathlib import Path

# Personas are a repository-level shared evidence source, not backend-local
# runtime code.  Resolve from ``backend/src`` back to the worktree root so the
# legal corpus remains available in clean worktrees and installed checkouts.
_PERSONA_DIR = Path(__file__).resolve().parent.parent.parent / "skills" / "personas"

# 法律领域术语词典(命中这些才算"有法可依"的法律问题,非泛泛文本)
_LEGAL_LEXICON = (
    "违约金", "定金", "验收", "合同解除", "合同效力", "要约", "承诺", "赔偿", "保证金",
    "质保", "尾款", "付款", "交付", "所有权", "知识产权", "专利", "商标", "著作权",
    "商业秘密", "竞业限制", "劳动合同", "工伤", "经济补偿", "试用期", "社保",
    "个人信息", "数据", "隐私", "跨境", "敏感信息", "合规", "安全生产", "产品质量",
    "招投标", "诉讼时效", "管辖", "证据", "保全", "仲裁", "履约", "条款",
)


def _terms(text: str) -> set[str]:
    t = text or ""
    return {w for w in _LEGAL_LEXICON if w in t}


_CN_DIGIT = " 一二三四五六七八九"


def _arabic_to_cn(n: int) -> str:
    """条号阿拉伯数字 → 民法典中文写法(合同条款均 100-999)。621→六百二十一,618→六百一十八,502→五百零二。"""
    if n < 100 or n > 999:
        return ""
    h, t, o = n // 100, (n // 10) % 10, n % 10
    s = _CN_DIGIT[h] + "百"
    if t == 0 and o > 0:
        s += "零"
    if t > 0:
        s += _CN_DIGIT[t] + "十"
    if o > 0:
        s += _CN_DIGIT[o]
    return s


def verify_citation(basis: str) -> dict:
    """核验引证条号是否在法条库中找得到(把"AI 引证"变"可核引证",schneier)。

    返回 {has_citation, verified, cited, unverified}。verified=True 表示引的每个条号都能在库里核到。
    库里核不到的条号 → unverified(可能 LLM 引错/编造,须人工核对,绝不当法律事实)。
    """
    nums = [int(x) for x in re.findall(r"第\s*(\d+)\s*条", basis or "")]
    if not nums:
        return {"has_citation": False, "verified": False, "cited": [], "unverified": []}
    corpus = "\n".join(f.read_text(encoding="utf-8") for f in _kb_files())
    unverified = [n for n in nums
                  if (f"第{_arabic_to_cn(n)}条" not in corpus) and (f"第{n}条" not in corpus)]
    return {"has_citation": True, "verified": not unverified, "cited": nums, "unverified": unverified}


def _kb_files() -> list[Path]:
    if not _PERSONA_DIR.is_dir():
        return []
    return sorted(_PERSONA_DIR.glob("*-lawyer/references/*.md"))


def retrieve(query: str, *, top_k: int = 3) -> list[dict]:
    """检索律师法条库,返回与查询法律术语重叠最高的条文片段。"""
    q = _terms(query)
    if not q:
        return []
    hits: list[dict] = []
    for f in _kb_files():
        persona = f.parent.parent.name
        for line in f.read_text(encoding="utf-8").splitlines():
            shared = q & _terms(line)
            if shared and ("第" in line and "条" in line or "法" in line):
                hits.append({"persona": persona, "snippet": line.strip()[:120],
                             "matched": sorted(shared), "score": len(shared)})
    hits.sort(key=lambda h: -h["score"])
    return hits[:top_k]


def is_grounded(query: str, *, min_score: int = 1) -> bool:
    """查询是否命中真法条(rag_hit 的唯一来源)。命中 → 律师可下权威结论。"""
    hits = retrieve(query, top_k=1)
    return bool(hits) and hits[0]["score"] >= min_score
