"""洞A(状态落库)+ 洞B(御史白名单)修复测试。存储用 tmp_path 隔离,不碰真 data/。"""
from pathlib import Path

from src import court_roles
from src import court_state_store as css


# ---- 洞A:状态持久化 ----
def test_state_roundtrip(tmp_path: Path):
    p = tmp_path / "s.json"
    assert css.get_state("doc1", path=p) is None          # 无记录
    css.set_state("doc1", "已准奏", action="apply_fixes", actor="u", updated_at="t", path=p)
    assert css.get_state("doc1", path=p) == "已准奏"        # 存住,读得回
    # 审计痕
    import json
    rec = json.loads(p.read_text())["doc1"]
    assert rec["actor"] == "u" and rec["action"] == "apply_fixes"


def test_state_overwrite_latest_wins(tmp_path: Path):
    p = tmp_path / "s.json"
    css.set_state("d", "待审", path=p)
    css.set_state("d", "已归档", path=p)
    assert css.get_state("d", path=p) == "已归档"


# ---- 洞B:御史白名单 ----
def test_whitelist_promotes_to_yushi(tmp_path: Path):
    cfg = tmp_path / "roles.yaml"
    cfg.write_text("yushi: [shen]\nharness: [ci_bot]\n", encoding="utf-8")
    assert court_roles.effective_role("shen", "user", path=cfg) == "yushi"     # 白名单提升
    assert court_roles.effective_role("ci_bot", "user", path=cfg) == "harness"
    assert court_roles.effective_role("someone", "user", path=cfg) == "user"   # 不在白名单原样
    assert court_roles.effective_role("shen", None, path=cfg) == "yushi"


def test_empty_whitelist_no_one_is_yushi(tmp_path: Path):
    cfg = tmp_path / "roles.yaml"
    cfg.write_text("yushi: []\nharness: []\n", encoding="utf-8")
    # 安全默认:空白名单 → 谁都不是御史(自封无效)
    assert court_roles.effective_role("anyone", "admin", path=cfg) == "admin"
