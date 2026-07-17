"""tests/test_persona_registry.py — 大神按证据厚度自动分席。"""
from __future__ import annotations

from src import persona_registry as pr


def _mk(tmp_path, name, files: dict[str, int]):
    """造一个 persona 目录:{相对路径: 字节数}。"""
    d = tmp_path / name
    d.mkdir(parents=True, exist_ok=True)
    for rel, size in files.items():
        f = d / rel
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_bytes(b"x" * size)
    return d


def test_classify_tier_by_bytes_not_filecount():
    assert pr.classify_tier(1, 30_000) == pr.ADVISOR     # 薄:30KB
    assert pr.classify_tier(5, 60_000) == pr.JUDGE        # 厚:60KB
    assert pr.classify_tier(1, 50_000) == pr.JUDGE        # 50KB 边界达标
    # 关键:文件数多但字节小(空壳灌水)不算判官 —— 以字节为准
    assert pr.classify_tier(7, 8_000) == pr.ADVISOR


def test_thin_persona_is_advisor_rag_gated(tmp_path):
    _mk(tmp_path, "karpathy", {"SKILL.md": 28_000})
    p = pr.get_persona("karpathy", persona_dir=tmp_path)
    assert p.tier == pr.ADVISOR
    assert p.can_conclude is False
    assert p.rag_required is True


def test_rich_persona_is_judge(tmp_path):
    _mk(tmp_path, "taleb-perspective",
        {"SKILL.md": 40_000, "references/a.md": 40_000, "references/b.md": 40_000})
    p = pr.get_persona("taleb-perspective", persona_dir=tmp_path)
    assert p.tier == pr.JUDGE
    assert p.can_conclude is True
    assert p.rag_required is False


def test_list_personas_sorted_judges_first(tmp_path):
    _mk(tmp_path, "thin1", {"SKILL.md": 20_000})
    _mk(tmp_path, "rich1", {"SKILL.md": 60_000, "references/x.md": 30_000, "references/y.md": 30_000})
    _mk(tmp_path, "thin2", {"SKILL.md": 25_000})
    out = pr.list_personas(persona_dir=tmp_path)
    assert [p.name for p in out][0] == "rich1"          # 判官席排最前
    assert out[0].tier == pr.JUDGE
    assert {p.name for p in out if p.tier == pr.ADVISOR} == {"thin1", "thin2"}


def test_empty_dir_not_enrolled(tmp_path):
    (tmp_path / "ghost").mkdir()
    assert pr.get_persona("ghost", persona_dir=tmp_path) is None
    assert pr.list_personas(persona_dir=tmp_path) == []


def test_roster_summary_shape(tmp_path):
    _mk(tmp_path, "rich1", {"SKILL.md": 80_000, "references/x.md": 10_000, "references/y.md": 10_000})
    _mk(tmp_path, "thin1", {"SKILL.md": 20_000})
    s = pr.roster_summary(persona_dir=tmp_path)
    assert s["total"] == 2 and s["judge_count"] == 1 and s["advisor_count"] == 1
    assert s["judges"] == ["rich1"] and s["advisors"] == ["thin1"]


# ── 真实仓内 20 位大神:厚薄分席符合预期 ──────────────────────────────────────

def test_real_roster_splits_into_two_benches():
    s = pr.roster_summary()  # 默认扫 skills/personas/
    assert s["total"] >= 15, "应扫到全部入役大神"
    # 资料薄的裸名大神必在观点席；芒格资料已补厚，按字节阈值进入判官席。
    assert "karpathy" in s["advisors"]
    assert "munger-perspective" in s["judges"]
    # 资料厚的 -perspective 必在判官席
    assert any(name.endswith("-perspective") for name in s["judges"])


# ── 守护 lens + 协议对账 ──────────────────────────────────────────────────────

def test_is_guardian_lens():
    assert pr.is_guardian_lens("harness-god") is True
    assert pr.is_guardian_lens("flow-engine-god") is True
    assert pr.is_guardian_lens("karpathy") is False


def test_load_protocol_advisors_real():
    named = pr.load_protocol_advisors()
    assert "harness-god" in named          # 守护 lens 也被点名
    assert "charity-majors" in named       # 协议在用但仓里无料
    assert len(named) >= 15


def test_reconcile_surfaces_empty_shells_and_guardians():
    rc = pr.reconcile_roster()
    # 守护 lens 单列,不混进参谋
    assert "harness-god" in rc["guardian_lenses"]
    # 空壳已全部补齐:协议点名的每一位都有料服务
    assert rc["served_missing_source"] == []
    served = set(rc["served_judge"]) | set(rc["served_advisor"])
    assert "karpathy" in served and "drucker" in served
    assert isinstance(rc["registered_unused"], list)
    # 守护 lens 不混进参谋席
    assert "harness-god" not in served


def test_alias_resolution_points_thin_name_to_richer_dir():
    # zhang-xiaolong(裸名 1 文件) 经别名解析到 zhangxiaolong-perspective(多文件 references)
    assert pr.resolve_alias("zhang-xiaolong") == "zhangxiaolong-perspective"
    p = pr.get_persona("zhang-xiaolong")
    assert p is not None
    assert p.file_count >= 2          # 拿到了带 references 的厚目录,不再是孤零零 1 文件
    # 注:tier 仍以字节为准(该目录 ~32KB < 50KB → 观点席),别名只保证接到真料


def test_ported_advisors_now_have_source():
    rc = pr.reconcile_roster()
    served = set(rc["served_judge"]) | set(rc["served_advisor"])
    # port + 别名后,这几位脱离空壳
    for name in ("bruce-schneier", "peter-thiel", "andrew-ng", "zhang-xiaolong"):
        assert name in served, f"{name} 应已有料服务"
        assert name not in rc["served_missing_source"]
    # 别名目标不再算孤儿
    assert "zhangxiaolong-perspective" not in rc["registered_unused"]


def test_web_built_personas_enter_as_rag_grounded_advisors():
    # deming / charity-majors 从网上调研新建,带 references 可 RAG 接地
    rc = pr.reconcile_roster()
    served = set(rc["served_judge"]) | set(rc["served_advisor"])
    for name in ("deming", "charity-majors"):
        assert name in served and name not in rc["served_missing_source"]
        p = pr.get_persona(name)
        assert p.file_count >= 2          # SKILL.md + references/research.md
        # 纪律:新建料先进观点席(过 eval 才升判官),不可直接下结论
        assert p.tier == pr.ADVISOR and p.rag_required is True
