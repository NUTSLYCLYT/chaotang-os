"""P0-B 表面积棘轮门(2026-07-14 新建)——只挡新增,不验证归属。

**本文件不是 P0-B 硬门。** 归属校验的权威验证在
`test_p0b_cross_user_behavioral.py`(跨用户行为门)。

划清职责的原因(2026-07-14 Codex 停止前审查纠正):本文件初版自称"P0-B 硬门",
但它只数 `query(DecisionTask).filter_by(id=` 的出现次数,根本验证不了归属——
修复 P0-B 是在裸查**后面加一行 user_id 校验**,裸查还在、计数不变;反过来
删掉 jinyiwei 已有的校验,计数同样不变。初版还写着"修复一处请下调基线",
这条指示本身就是错的(修复不减少裸查数),说明"计数=归属"的前提从根上不成立。
一个存在漏洞时仍然全绿的门,比没有门更危险——它给人已设防的错觉。

本文件保留的唯一职责:**表面积棘轮**——DecisionTask 按 id 裸查的总处数不许
增长。新增一处裸查(无论是否带校验)都会让本测试红,强制新代码显式进入
P0-B 视野:要么在行为门里补一条跨用户测试,要么在这里有意识地上调基线并
说明理由。行号一律不进基线(会漂移),只计数。

基线(2026-07-14 实测,含已修点):
- jinyiwei.py ×1(fill-gap,已有归属校验)
- shangshufang.py ×8(其中 tasks/{id}/status 已于 2026-07-14 修复)
- swarm_runs.py ×1
计数不区分 guarded/unguarded——因为它区分不了,这正是它不是硬门的原因。
"""

from __future__ import annotations

import ast
from pathlib import Path

ROUTERS = Path(__file__).resolve().parent.parent / "web" / "routers"

# 2026-07-14 计数改为 AST,不再用正则。正则计数在两个方向上都失真,无法两全:
#   - 六次纠正:含 filter(DecisionTask. → 一条链 `query(DecisionTask).filter(DecisionTask.x)`
#     被数两次(同一查询双计);
#   - 七次纠正:去掉 filter 后又漏形态——`query(DecisionTask, CourtReview)`(多实体)、
#     `query(DecisionTask.id)`(列查询)、`select(DecisionTask)`(2.0 风格)都读 DecisionTask
#     行却匹配不上窄正则(漏计新增查询)。
# AST 计数只认"查询入口 Call 节点":`.query(...)` / `.get(...)` / `select(...)`
# (含 `sa.select(...)` 属性形态)——每条查询算一次(链上的 .filter/.first 不是入口,不重复计)。
# 八次纠正:入口的判定改为"该 Call 的**任一参数子树**里引用了 DecisionTask",不再只看
# args[0]、不再只认裸 Name/`DecisionTask.col`。否则会漏合法形态:
#   - query(CourtReview, DecisionTask)  DecisionTask 在第二个参数;
#   - query(models.DecisionTask)        限定名引用;
#   - query(DecisionTask.id.label('x')) / query(func.count(DecisionTask.id))  嵌套表达式;
#   - sa.select(DecisionTask)            select 以属性形态出现。
# 仍不双计:.filter(DecisionTask.status...) 的 func.attr 是 "filter",不在入口集合里。
# 仍不误计:dict.get('key') 参数不含 DecisionTask;query(CourtReview).filter(DecisionTask...)
# 的 query 自身参数不含 DecisionTask(join 列由行为门 _LOOKUP 的布尔检测覆盖)。
# 已知残余天花板:别名 import(`DecisionTask as DT` 后 query(DT))仍漏——需 import 解析,
# 与行为门同一天花板,见 test_p0b_cross_user_behavioral 顶部声明。
# 见 test_ast_counter_is_form_tolerant_and_dedup 的合成自检。

_ENTRY_METHODS = frozenset({"query", "get", "select"})


def _call_refs_decision_task(call: ast.Call) -> bool:
    # 九次纠正:关键字形态 `session.get(entity=DecisionTask, ident=tid)` 的实参在
    # call.keywords 里,不在 call.args。只看 args 会让 keyword-form 的 get/query
    # 整个绕过。这里把位置实参和关键字实参的值子树一起扫。
    subtrees = list(call.args) + [kw.value for kw in call.keywords]
    for arg in subtrees:
        for sub in ast.walk(arg):
            if isinstance(sub, ast.Name) and sub.id == "DecisionTask":
                return True
            if isinstance(sub, ast.Attribute) and sub.attr == "DecisionTask":
                return True
    return False


def _is_query_entry_func(f: ast.AST) -> bool:
    if isinstance(f, ast.Attribute):
        return f.attr in _ENTRY_METHODS
    if isinstance(f, ast.Name):
        return f.id == "select"
    return False


def _count_query_entries(src: str) -> int:
    n = 0
    for node in ast.walk(ast.parse(src)):
        if (
            isinstance(node, ast.Call)
            and (node.args or node.keywords)
            and _is_query_entry_func(node.func)
            and _call_refs_decision_task(node)
        ):
            n += 1
    return n


# 文件名 → DecisionTask 查询入口数(每条查询一次;不区分是否带归属校验——本门区分不了)。
_BASELINE = {
    "court_compat.py": 1,
    "jinyiwei.py": 1,
    "shangshufang.py": 11,
    "swarm_runs.py": 1,
}


def _count_lookups() -> dict[str, int]:
    counts: dict[str, int] = {}
    for path in sorted(ROUTERS.glob("*.py")):
        n = _count_query_entries(path.read_text(encoding="utf-8"))
        if n:
            counts[path.name] = n
    return counts


def test_ast_counter_is_form_tolerant_and_dedup():
    """AST 计数器的合成自检:各种合法 ORM 形态都算一次(正则会漏),链续接不重复计
    (正则会双计),join 列/dict.get/别的模型不误计。"""
    cases = {
        "db.query(DecisionTask).first()": 1,
        "db.query(DecisionTask, CourtReview).all()": 1,       # 多实体,DT 在首位
        "db.query(CourtReview, DecisionTask).all()": 1,       # DT 在第二位(旧漏)
        "db.query(models.DecisionTask).first()": 1,           # 限定名(旧漏)
        "sa.select(DecisionTask).where(x)": 1,                # select 属性形态(旧漏)
        "db.query(DecisionTask.id.label('x')).all()": 1,      # 嵌套表达式(旧漏)
        "db.query(func.count(DecisionTask.id)).scalar()": 1,  # 嵌套 func(旧漏)
        "db.query(DecisionTask.id).filter_by(x=1)": 1,        # 列查询
        "select(DecisionTask).where(x)": 1,                   # 2.0 裸 select
        "db.query(DecisionTask).filter(DecisionTask.status.in_(y))": 1,  # 链续接不双计
        "db.get(DecisionTask, tid)": 1,
        "db.get(entity=DecisionTask, ident=tid)": 1,          # keyword 形态(旧漏)
        "session.get(DecisionTask, ident=tid, options=[o])": 1,
        "payload.get('key')": 0,                              # dict.get 不误计
        "request.headers.get('x', default='y')": 0,           # keyword 但不含 DT
        "db.query(CourtReview).filter_by(id=x)": 0,           # 别的模型
        "db.query(CourtReview).filter(DecisionTask.id==CourtReview.task_id)": 0,  # join 列,query 自身不含 DT
    }
    for src, expected in cases.items():
        assert _count_query_entries(src) == expected, f"AST 计数错:{src}"


def test_p0b_lookup_surface_area_ratchet():
    """DecisionTask 裸查表面积不许增长。新增一处 = 新增一处必须证明归属安全的
    地方 → 必须同时在 test_p0b_cross_user_behavioral.py 补一条跨用户测试,
    然后有意识地上调这里的基线。计数减少(端点被删/重构)也要求更新基线,
    避免基线与现实脱节后这道门静默失效。"""
    actual = _count_lookups()
    assert actual == _BASELINE, (
        f"DecisionTask 裸查表面积偏离基线。actual={actual} expected={_BASELINE}。\n"
        "多了:每一处新裸查都必须在 test_p0b_cross_user_behavioral.py 有对应的"
        "跨用户拒绝测试(照 jinyiwei.py fill-gap 的 requester_id 校验写),然后"
        "上调本基线。\n"
        "少了:端点被删或重构,请更新基线。\n"
        "注意:本门只管表面积,不验证归属——归属是 test_p0b_cross_user_behavioral.py"
        "的职责,别把这里全绿当成 P0-B 已清零。"
    )
