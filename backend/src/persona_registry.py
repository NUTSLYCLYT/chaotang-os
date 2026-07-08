"""src/persona_registry.py — 大神入役登记 + 按证据厚度自动分席。

钦天监签字方案(2026-06-30):20 位大神按"语料厚薄"自动分两席,让证据决定发言权:

  - 判官席 (judge)  : 语料厚(SKILL.md + references 多文件)。可下结论、可参与会审裁决。
  - 观点席 (advisor): 语料薄(仅 SKILL.md 等)。只能提"一个视角/一句警示",
                       发言强制走 RAG;检索没命中 → 不准下结论、confidence 自动标低。

数据驱动:不靠人设名气,靠目录里真实的文件数 + 字节数。薄语料大神补够料后会自动升席。
不依赖 LLM,纯文件系统统计,可在 CI / nightly flywheel 里离线跑。
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

_PERSONA_DIR = Path(__file__).resolve().parent.parent / "skills" / "personas"

# 分席阈值(钦天监签字口径):以**字节为准**——内容量才是真证据,文件数会被空壳灌水
# (例:7 个近空文件 8KB 不该算判官)。file_count 仅作展示。
JUDGE_MIN_BYTES = 50_000

JUDGE = "judge"      # 判官席:可下结论
ADVISOR = "advisor"  # 观点席:RAG 接地,不可下结论

# 大神作答共享纪律(2026-07-01 钦天监签字,eval 飞轮实证驱动):
# 判分实测发现——大神为讲道理编造具体真人真事(如"我在 Tesla 给 Elon 演示"),被 judge 判为幻觉。
# B2B 决策系统里用户会把"某大神说他在某公司…"当真事引用,故禁编造。留一处,作答路径统一注入。
PERSONA_GROUNDING_RULE = (
    "【作答纪律】用假设化/抽象例子说明观点即可(如'假设某团队…'),"
    "严禁编造具体真人真事的经历、对话、数字或公司内幕当作事实——"
    "那会被判为幻觉且在 B2B 决策里造成误导。观点要生动靠逻辑和假设情景,不靠杜撰履历。"
)

# 协议名 → 仓内 persona 目录 别名映射(免费升级:同一个人的两个名字对上)。
# 守护 lens(-god)不在此列。补料/port 后只需在此登记别名,无需改 advisor_protocols.yaml。
PROTOCOL_ALIASES: dict[str, str] = {
    "zhang-xiaolong": "zhangxiaolong-perspective",  # 协议薄名 → 仓内厚料孤儿
    "bruce-schneier": "schneier-perspective",       # port 自全局
    "peter-thiel": "peter-thiel-perspective",       # port 自全局
    "andrew-ng": "andrew-ng-perspective",           # port 自全局
    "deming": "deming-perspective",                 # 从网上调研新建
    "charity-majors": "charity-majors-perspective", # 从网上调研新建
    # 批量从网上调研新建(钦天监方案 A 第3层放量)
    "ben-graham": "ben-graham-perspective",
    "drucker": "drucker-perspective",
    "kahneman": "kahneman-perspective",
    "kent-beck": "kent-beck-perspective",
    "martin-fowler": "martin-fowler-perspective",
    "jensen-huang": "jensen-huang-perspective",
    "chris-voss": "chris-voss-perspective",
    "neil-rackham": "neil-rackham-perspective",
    "aaron-ross": "aaron-ross-perspective",
    "paula-scher": "paula-scher-perspective",
    "richard-posner": "richard-posner-perspective",
    "seth-godin": "seth-godin-perspective",
}


def resolve_alias(name: str) -> str:
    """把协议里的大神名解析到仓内真实 persona 目录名。"""
    return PROTOCOL_ALIASES.get(name, name)


@dataclass(frozen=True)
class Persona:
    name: str
    tier: str
    file_count: int
    total_bytes: int
    # 判官席可下结论;观点席只提视角
    can_conclude: bool
    # 观点席发言必须先命中 RAG,否则不采纳
    rag_required: bool

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "tier": self.tier,
            "file_count": self.file_count,
            "total_bytes": self.total_bytes,
            "can_conclude": self.can_conclude,
            "rag_required": self.rag_required,
        }


def classify_tier(file_count: int, total_bytes: int) -> str:
    """按证据厚度分席(以字节为准):厚→判官,薄→观点。file_count 仅供展示。"""
    if total_bytes >= JUDGE_MIN_BYTES:
        return JUDGE
    return ADVISOR


def _measure(persona_path: Path) -> tuple[int, int]:
    """统计一个 persona 目录的文件数与总字节(递归,含 references)。"""
    files = [p for p in persona_path.rglob("*") if p.is_file()]
    total = 0
    for p in files:
        try:
            total += p.stat().st_size
        except OSError:
            continue
    return len(files), total


def _build(name: str, file_count: int, total_bytes: int) -> Persona:
    tier = classify_tier(file_count, total_bytes)
    return Persona(
        name=name,
        tier=tier,
        file_count=file_count,
        total_bytes=total_bytes,
        can_conclude=(tier == JUDGE),
        rag_required=(tier == ADVISOR),
    )


def list_personas(persona_dir: Path | None = None) -> list[Persona]:
    """扫描 skills/personas/*,返回按席位(判官在前)+ 证据厚度排序的大神列表。"""
    root = persona_dir or _PERSONA_DIR
    if not root.is_dir():
        return []
    personas: list[Persona] = []
    for d in root.iterdir():
        if not d.is_dir() or d.name.startswith("."):
            continue
        fc, tb = _measure(d)
        if fc == 0:
            continue  # 空目录不入役
        personas.append(_build(d.name, fc, tb))
    # 判官席优先,再按字节数厚→薄
    personas.sort(key=lambda p: (p.tier != JUDGE, -p.total_bytes, p.name))
    return personas


def get_persona(name: str, persona_dir: Path | None = None) -> Persona | None:
    root = persona_dir or _PERSONA_DIR
    d = root / resolve_alias(name)  # 协议薄名 → 仓内真实目录
    if not d.is_dir():
        return None
    fc, tb = _measure(d)
    if fc == 0:
        return None
    return _build(name, fc, tb)


def roster_summary(persona_dir: Path | None = None) -> dict:
    """给 nightly flywheel / API 用的花名册摘要。"""
    personas = list_personas(persona_dir)
    judges = [p.name for p in personas if p.tier == JUDGE]
    advisors = [p.name for p in personas if p.tier == ADVISOR]
    return {
        "total": len(personas),
        "judge_count": len(judges),
        "advisor_count": len(advisors),
        "judges": judges,
        "advisors": advisors,
        "personas": [p.to_dict() for p in personas],
    }


# ── 协议对账:谁真在朝堂服务 vs 谁有料 ─────────────────────────────────────────

_PROTOCOL_PATH = Path(__file__).resolve().parent.parent / "config" / "advisor_protocols.yaml"


def is_guardian_lens(name: str) -> bool:
    """守护大神/治理 lens(-god):流程把关,靠撰写不靠语料,不进参谋龙虎榜。"""
    return name.endswith("-god") or name.endswith("_god")


# C2 运行时护栏:谁能当"放行人"(定灯)。大神/律师永远不能。
_ALLOWED_GATEKEEPERS = frozenset({"yushi", "御史", "harness", "release_gate", "guard_rails"})


def is_valid_gatekeeper(name: str) -> bool:
    """C2 铁律:只有御史/harness 规则能放行(定灯);任何大神/律师/参谋一律 False。

    派单/裁决路径调用此函数把关——把"大神不是放行人"从约定变成代码拦截(堵缺陷#3)。
    """
    return name in _ALLOWED_GATEKEEPERS


def assert_not_gating(advisors: list[str]) -> None:
    """断言:参谋名单里没有人混进放行人角色。违反即抛(绝不静默)。"""
    bad = [a for a in advisors if is_valid_gatekeeper(a)]
    if bad:
        raise ValueError(f"C2 违反:大神/律师不得当放行人,却出现在 gate 路径:{bad}")


def load_protocol_advisors(protocol_path: Path | None = None) -> set[str]:
    """从 config/advisor_protocols.yaml 收齐"真正被朝堂调用"的大神名。"""
    import yaml

    path = protocol_path or _PROTOCOL_PATH
    if not path.exists():
        return set()
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    names: set[str] = set()

    def grab(x):
        if isinstance(x, dict):
            for k, v in x.items():
                if k in ("advisors", "lenses", "gods", "guardians") and isinstance(v, list):
                    names.update(str(a) for a in v)
                grab(v)
        elif isinstance(x, list):
            for i in x:
                grab(i)

    grab(data.get("profiles") or {})
    grab(data.get("swarms") or {})
    return names


def reconcile_roster(
    persona_dir: Path | None = None,
    protocol_path: Path | None = None,
) -> dict:
    """把"协议在用的大神"和"仓里有料的 persona"对账,照出四类真相:

      served_judge / served_advisor : 协议在用 + 仓里有料(已分席)
      served_missing_source         : 协议点名但仓里没料(待补 —— 空壳大神)
      guardian_lenses               : 守护 -god lens(单列,不评分)
      registered_unused             : 仓里有料但协议没调用(孤儿 persona)
    """
    protocol = load_protocol_advisors(protocol_path)
    personas = {p.name: p for p in list_personas(persona_dir)}

    guardians = sorted(n for n in protocol if is_guardian_lens(n))
    advisors_named = {n for n in protocol if not is_guardian_lens(n)}

    served_judge, served_advisor, missing = [], [], []
    used_dirs: set[str] = set()
    for n in sorted(advisors_named):
        target = resolve_alias(n)            # 别名解析:协议薄名 → 仓内真实目录
        p = personas.get(target)
        if p is None:
            missing.append(n)
            continue
        used_dirs.add(target)
        # 展示名用协议名,但分席依据是解析到的真实目录的料
        if p.tier == JUDGE:
            served_judge.append(n)
        else:
            served_advisor.append(n)

    # 孤儿:仓里有料但没被协议调用(含别名)的目录
    unused = sorted(
        name for name in personas
        if name not in advisors_named and name not in used_dirs
    )

    return {
        "protocol_advisor_count": len(advisors_named),
        "served_judge": served_judge,
        "served_advisor": served_advisor,
        "served_missing_source": missing,   # 空壳:待 port / 待从网上建
        "guardian_lenses": guardians,
        "registered_unused": unused,        # 孤儿:有料但没被朝堂调用
    }


# ── RAG 接地强制门(B:让观点席"不准凭空下结论")─────────────────────────────

def gate_conclusion(
    name: str,
    rag_hit: bool,
    *,
    eval_passed: bool = False,
    persona_dir: Path | None = None,
) -> dict:
    """大神这次发言能不能"下结论"?派单时调用,强制 RAG 接地纪律。

      - 判官席(语料厚 / 已过 eval 升席):始终可下结论。
      - 观点席(rag_required):**只有本次检索命中(rag_hit)才准下结论**;
        没命中 → 降级为"仅提一个视角",不可作为裁决依据。
    返回 {can_conclude, mode, reason};绝不静默——拒绝必带理由。
    """
    p = get_persona(name, persona_dir)
    if p is None:
        return {"can_conclude": False, "mode": "unknown",
                "reason": f"未入役大神:{name}"}
    if p.can_conclude or eval_passed:
        return {"can_conclude": True, "mode": "judge",
                "reason": "判官席/已过 eval,可下结论"}
    if rag_hit:
        return {"can_conclude": True, "mode": "advisor_grounded",
                "reason": "观点席 + RAG 命中,可基于证据下结论"}
    return {"can_conclude": False, "mode": "advisor_view_only",
            "reason": "观点席且 RAG 未命中 → 仅提视角,不可下结论(防空壳冒充权威)"}
