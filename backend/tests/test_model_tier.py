"""② 分层模型路由接进 decree_swarm_router 测试(钦天监 A2②)。"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from src.decree_swarm_router import select_model_tier  # noqa: E402


def test_redline_to_human():
    assert select_model_tier("三花智控仓位是否该减")["tier"] == "redline-human"


def test_high_value_to_hermes():
    for c in ["这篇方案定稿出稿", "战略决策", "对外客户合同"]:
        assert select_model_tier(c)["tier"] == "hermes-expert", c


def test_cheap_to_local_genius():
    for c in ["批量摘要这100条", "翻译这段草稿", "数据去重打标"]:
        assert select_model_tier(c)["tier"] == "genius-local", c


def test_normal_to_litellm():
    assert select_model_tier("写个普通项目状态说明")["tier"] == "litellm-cheap"


def test_redline_beats_high_value():
    # 既像出稿又踩股票红线 → 红线优先,不自动出稿
    assert select_model_tier("帮我出稿:这只股票该不该买")["tier"] == "redline-human"


def test_explicit_value_overrides():
    assert select_model_tier("随便", value="high")["tier"] == "hermes-expert"
    assert select_model_tier("随便", value="low")["tier"] == "genius-local"


def test_result_shape():
    r = select_model_tier("批量初筛")
    assert r["tier"] and r["target"] and r["cost"] and r["reason"]


if __name__ == "__main__":
    import subprocess

    sys.exit(subprocess.call([sys.executable, "-m", "pytest", __file__, "-q"]))
